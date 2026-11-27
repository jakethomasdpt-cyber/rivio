import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
import { register } from 'tsx/cjs/api';
import type Stripe from 'stripe';
import { parseAdditionalPayment } from './portalPaymentAmounts.ts';
import { checkoutReceipt } from './checkoutReceipt.ts';

const require = createRequire(import.meta.url);

// Load the actual App Router handler, substituting only the DB and the external
// checkout operation. The line items and metadata come directly from the handler.
test('patient checkout charges the configured percentage only on the invoice balance', async (t) => {
  const invoice = { id: 'invoice', user_id: 'clinic', total: 100, status: 'sent', accept_ach: true, accept_wallet: true };
  const workspace = { surcharge_enabled: true, card_surcharge_rate: 3, surcharge_label: 'Card fee' };
  const invoiceItems = [{ service: 'Therapy visit', quantity: 1, rate: 100 }];
  const sessions: Stripe.Checkout.SessionCreateParams[] = [];
  const db = {
    from(table: string) {
      const rows: Record<string, unknown> = { invoices: invoice, line_items: invoiceItems, workspaces: workspace };
      assert.ok(table in rows, table);
      return { select: () => ({ eq: () => ({
        data: rows[table],
        single: async () => ({ data: rows[table] }),
      }) }) };
    },
  };

  function substitute(specifier: string, exports: object) {
    const id = require.resolve(specifier);
    const original = require.cache[id];
    const replacement = new Module(id);
    replacement.exports = exports;
    replacement.loaded = true;
    require.cache[id] = replacement;
    t.after(() => {
      if (original) require.cache[id] = original;
      else delete require.cache[id];
    });
  }

  substitute('./database.ts', { createDatabaseClient: () => db, getDatabasePool: () => ({}) });
  substitute('./invoicePaymentSafety.ts', {
    InvoicePaymentConflict: class extends Error {},
    async createCheckoutForLockedInvoice(
      _pool: unknown, _stripe: unknown, _id: string, expected: { total: number }, params: Stripe.Checkout.SessionCreateParams,
    ) {
      assert.equal(expected.total, invoice.total);
      sessions.push(params);
      const total = params.line_items!.reduce((sum, item) => sum + item.quantity! * item.price_data!.unit_amount!, 0);
      return params.ui_mode === 'elements'
        ? { client_secret: 'synthetic-session-secret', url: null, amount_total: total }
        : { url: 'https://example.test/checkout' };
    },
  });
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  t.after(() => {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  const unregister = register();
  t.after(unregister);
  const { POST } = require('../app/api/portal/[token]/checkout/route.ts');
  async function checkout(method: string, additional?: unknown, fields: Record<string, unknown> = {}) {
    const body = JSON.stringify({ payment_method: method, additional_payment_cents: additional, ...fields });
    return POST(new Request('https://example.test/api/portal/token/checkout', { method: 'POST', body }), {
      params: Promise.resolve({ token: 'token' }),
    });
  }

  for (const [method, extra, expectedFee, expectedTotal] of [
    ['card', undefined, 300, 10300], // Existing callers omit the field.
    ['card', 2000, 300, 12300],
    ['card', 0, 300, 10300], // Patient clears the amount.
    ['card', 1, 300, 10301],
    ['wallet', 2000, 300, 12300],
    ['ach', undefined, 0, 10000],
    ['ach', 2000, 0, 12000],
    ['ach', 0, 0, 10000],
  ] as const) {
    const before = sessions.length;
    const response = await checkout(method, extra);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: 'https://example.test/checkout' });
    assert.equal(sessions.length, before + 1);
    const session = sessions[before];
    const items = session.line_items!;
    const fee = items.find(item => item.price_data?.product_data?.name === 'Card fee');
    assert.equal(fee?.price_data?.unit_amount ?? 0, expectedFee);
    assert.equal(items.reduce((sum, item) => sum + item.quantity! * item.price_data!.unit_amount!, 0), expectedTotal);
    const extraItem = items.find(item => /additional payment/i.test(item.price_data?.product_data?.name ?? ''));
    assert.equal(extraItem?.price_data?.unit_amount ?? 0, extra ?? 0);
    assert.equal(Boolean(extraItem), Boolean(extra));
    for (const metadata of [session.metadata, session.payment_intent_data?.metadata]) {
      assert.equal(Number(metadata?.surcharge_amount), expectedFee / 100);
      assert.equal(Number(metadata?.additional_payment_cents ?? 0), extra ?? 0);
    }
  }

  for (const [additionalCents, totalCents] of [[0, 10300], [1, 10301], [2000, 12300]]) {
    const response = await checkout('wallet', additionalCents, { ui_mode: 'elements', expected_total_cents: totalCents });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { clientSecret: 'synthetic-session-secret', amountCents: totalCents });
    const session = sessions[sessions.length - 1];
    assert.equal(session.ui_mode, 'elements');
    assert.deepEqual(session.payment_method_types, ['card']);
    assert.ok(!session.success_url && !session.cancel_url);
    const chargedCents = session.line_items!.reduce((sum, item) => sum + item.quantity! * item.price_data!.unit_amount!, 0);
    assert.equal(chargedCents, totalCents);
    for (const metadata of [session.metadata, session.payment_intent_data?.metadata]) {
      assert.equal(metadata?.invoice_id, invoice.id);
      assert.deepEqual(checkoutReceipt(10000, chargedCents, metadata as Record<string, string>), {
        additionalPaymentCents: additionalCents, surchargeCents: 300, chargedAmountCents: totalCents,
      });
    }
  }

  const validRequests = sessions.length;
  for (const invalidTotal of [12301, 12000, 10300]) {
    const response = await checkout('wallet', 2000, { ui_mode: 'elements', expected_total_cents: invalidTotal });
    assert.equal(response.status, 409, 'changed invoice, fee or additional payment must be reviewed again');
  }
  for (const invalidTotal of [undefined, '12300', 12300.5, -1]) {
    const response = await checkout('wallet', 2000, { ui_mode: 'elements', expected_total_cents: invalidTotal });
    assert.equal(response.status, 400);
  }
  for (const invalid of [-1, 1.5, '2000', 99_999_999]) {
    assert.equal((await checkout('card', invalid)).status, 400);
  }
  invoice.accept_ach = false;
  assert.equal((await checkout('ach', 2000)).status, 400, 'a disabled ACH method cannot fall back to card');
  invoice.accept_wallet = false;
  assert.equal((await checkout('wallet', 2000, { ui_mode: 'elements', expected_total_cents: 12300 })).status, 400);
  assert.equal(sessions.length, validRequests, 'invalid requests must never create a Stripe session');

  invoice.total = 750;
  invoiceItems.splice(0, invoiceItems.length, { service: 'Visit', quantity: 3, rate: 250 });
  invoice.accept_wallet = true;
  workspace.surcharge_enabled = false;
  const noFee = await checkout('wallet', 2500, { ui_mode: 'elements', expected_total_cents: 77500 });
  assert.equal(noFee.status, 200);
  assert.match(noFee.headers.get('cache-control') ?? '', /no-store/);
  assert.equal((await noFee.json()).amountCents, 77500);
  const session = sessions[sessions.length - 1];
  assert.deepEqual(session.line_items!.map(item => [item.quantity, item.price_data!.unit_amount]), [[3, 25000], [1, 2500]]);
  assert.deepEqual(checkoutReceipt(75000, 77500, session.metadata as Record<string, string>), {
    chargedAmountCents: 77500, additionalPaymentCents: 2500, surchargeCents: 0,
  });
});

test('patient-entered dollars convert to exact cents and clearing the field removes the extra', () => {
  for (const [input, expected] of [
    ['', 0], ['0.00', 0], ['20', 2000], ['.01', 1], ['20.05', 2005], ['1.2', 120],
    ['-1', null], ['1e3', null], ['20.005', null], ['1,20', null], ['1000000', null],
  ] as const) {
    assert.equal(parseAdditionalPayment(input), expected, JSON.stringify(input));
  }
});
