import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseQuery, type Executor } from './database-query.ts';
import { invoiceBranding, brandInvoiceItems, organizationName, providerName, saveOrganizationName, generateInvoiceNumber, insertIntegrationInvoice } from './integrationBranding.ts';

function database(execute: Executor) {
  return { from: (table: string) => new DatabaseQuery(table, execute) };
}

test('public names are validated and never supplied by a global customer default', () => {
  assert.equal(organizationName(' Physical Therapy 365 '), 'Physical Therapy 365');
  assert.equal(organizationName(undefined), undefined);
  for (const invalid of [null, '', ' ', 42, 'x'.repeat(201), 'Clinic\r\nBcc: victim@example.com']) {
    assert.throws(() => organizationName(invalid), /must be/);
  }
  assert.equal(providerName(null, 'Other Clinic'), 'Other Clinic');
  assert.equal(providerName('Public Clinic', 'Legal Clinic LLC'), 'Public Clinic');
  assert.equal(providerName(null, null), 'Your Provider');
});

test('historical invoices resolve by organization AND owner, without altering issued numbers or stored lines', async () => {
  const db = database(async (sql, values) => {
    assert.match(sql, /"veda_organization_id" = \$1 AND "record"\."user_id" = \$2/);
    // A disconnected integration still needs to render its issued invoices.
    assert.doesNotMatch(sql, /is_active|deleted_at/);
    const names: Record<string, string> = { 'org-a': 'Physical Therapy 365', 'org-b': 'Another Clinic' };
    return { rows: [{ organization_name: names[String(values[0])] }], rowCount: 1 };
  });
  const items = [{ provider: 'Veda EMR', amount: 50, service: 'Treatment' }];
  for (const [org, name] of [['org-a', 'Physical Therapy 365'], ['org-b', 'Another Clinic']]) {
    const invoice = { user_id: 'owner', veda_organization_id: org, invoice_number: 'VEDA2608-00001' };
    const result = await invoiceBranding(db, invoice, { business_name: 'Legal Name LLC', brand_color: '#123456' }, items);
    assert.equal(result.workspace?.business_name, name);
    assert.equal(result.workspace?.brand_color, '#123456');
    assert.deepEqual(result.items, [{ ...items[0], provider: name }]);
    assert.equal(invoice.invoice_number, 'VEDA2608-00001');
  }
  assert.equal(items[0].provider, 'Veda EMR');
});

test('legacy mappings fall back to the workspace; native invoices keep their own providers', async () => {
  const db = database(async () => ({ rows: [{ organization_name: null }], rowCount: 1 }));
  const workspace = { business_name: 'Workspace Clinic' };
  const items = [{ provider: 'Dr. Example' }];
  const old = await invoiceBranding(db, { user_id: 'owner', veda_organization_id: 'org' }, workspace, items);
  assert.equal(old.items[0].provider, 'Workspace Clinic');
  const noQueries = database(async () => { throw new Error('Unexpected query'); });
  assert.deepEqual(await invoiceBranding(noQueries, { user_id: 'owner' }, workspace, items), { workspace, items });
  assert.equal(brandInvoiceItems({ user_id: 'owner' }, workspace, items), items);
  await assert.rejects(invoiceBranding(db, { veda_organization_id: 'org' }, workspace), /owner/);
});

test('organization name updates are scoped and omission preserves the saved name', async () => {
  const tenant = { user_id: 'owner', veda_organization_id: 'org', providerName: 'Saved Clinic' };
  const queries: unknown[][] = [];
  const db = database(async (sql, values) => {
    assert.match(sql, /^UPDATE/);
    assert.match(sql, /"user_id" =/);
    assert.match(sql, /"is_active" =/);
    queries.push(values);
    return { rows: [{ veda_organization_id: 'org' }], rowCount: 1 };
  });
  assert.equal(await saveOrganizationName(db, tenant, undefined), 'Saved Clinic');
  assert.equal(queries.length, 0);
  assert.equal(await saveOrganizationName(db, tenant, ' Physical Therapy 365 '), 'Physical Therapy 365');
  assert.deepEqual(queries[0], ['Physical Therapy 365', 'org', 'owner', true]);
  await assert.rejects(saveOrganizationName(db, tenant, ''), /must be/);
});

test('INT numbering retains date and five-digit suffix and retries database number collisions', async () => {
  assert.match(generateInvoiceNumber(), /^INT\d{4}-\d{5}$/);
  let attempts = 0;
  const db = database(async (sql, values) => {
    assert.match(sql, /^INSERT/);
    assert.match(String(values[1]), /^INT\d{4}-\d{5}$/);
    if (++attempts === 1) throw Object.assign(new Error('collision'), { code: '23505', constraint: 'invoices_invoice_number_key' });
    return { rows: [{ id: 'invoice', invoice_number: values[1] }], rowCount: 1 };
  });
  const result = await insertIntegrationInvoice(db, { user_id: 'owner' }, 'id, invoice_number');
  assert.equal(result.data?.id, 'invoice');
  assert.equal(attempts, 2);
});

test('number allocation does not retry a duplicate source invoice and stops after repeated collisions', async () => {
  let attempts = 0;
  const duplicate = database(async () => {
    attempts++;
    throw Object.assign(new Error('duplicate source'), { code: '23505', constraint: 'invoices_veda_org_invoice_unique' });
  });
  assert.equal((await insertIntegrationInvoice(duplicate, {}, 'id')).error?.code, '23505');
  assert.equal(attempts, 1);
  attempts = 0;
  const collision = database(async () => {
    attempts++;
    throw Object.assign(new Error('collision'), { code: '23505', constraint: 'invoices_invoice_number_key' });
  });
  await assert.rejects(insertIntegrationInvoice(collision, {}, 'id'), /unique invoice number/);
  assert.equal(attempts, 10);
});

test('customer-facing routes use the shared branding resolver, including receipt and email routes', () => {
  for (const route of [
    'portal/[token]', 'portal/[token]/checkout', 'stripe/checkout', 'stripe/webhook',
    'invoices/[id]/pdf', 'invoices/[id]/send', 'invoices/[id]/remind', 'invoices/[id]/mark-paid',
    'veda/invoices/[rivioInvoiceId]/send',
  ]) {
    assert.match(readFileSync(`src/app/api/${route}/route.ts`, 'utf8'), /await invoiceBranding\(dbClient,/);
  }
  const receipt = readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8');
  assert.match(receipt, /\.select\('[^']*veda_organization_id[^']*'\)/);
  for (const route of ['veda/invoices', 'veda/payments/charge']) {
    const source = readFileSync(`src/app/api/${route}/route.ts`, 'utf8');
    assert.match(source, /insertIntegrationInvoice\(dbClient,/);
    assert.match(source, /saveOrganizationName\(dbClient, tenant, body\.vedaOrganizationName\)/);
    assert.doesNotMatch(source, /provider: 'Veda EMR'/);
    assert.match(source, /invoiceNumber: (existing|existingInvoice)\.invoice_number/);
  }
});
