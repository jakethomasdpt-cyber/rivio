import { randomInt } from 'node:crypto';
import type { DatabaseQuery } from './database-query.ts';

type Database = { from: (table: string) => DatabaseQuery };
type Invoice = { user_id?: string; veda_organization_id?: string | null };
type Workspace = Record<string, any>;

export function organizationName(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('vedaOrganizationName must be a non-empty string of at most 200 characters without control characters');
  }
  return value.trim();
}

// The integration connection's display_name is an internal label, not a provider name.
export function providerName(organization: unknown, workspace: unknown): string {
  for (const value of [organization, workspace]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Your Provider';
}

export async function saveOrganizationName(db: Database, tenant: {
  veda_organization_id: string; user_id: string; providerName: string;
}, value: unknown): Promise<string> {
  const name = organizationName(value);
  if (name === undefined) return tenant.providerName;
  const { data, error } = await db.from('veda_organization_mappings')
    .update({ organization_name: name })
    .eq('veda_organization_id', tenant.veda_organization_id)
    .eq('user_id', tenant.user_id).eq('is_active', true).is('deleted_at', null)
    .select('veda_organization_id').single();
  if (error || !data) throw new Error('Failed to save organization name');
  return name;
}

// Resolve at read time, including historical invoices and disconnected organizations.
// Do not mutate stored invoice numbers or overwrite providers on native Rivio invoices.
export async function invoiceBranding<T extends { provider?: string | null }>(
  db: Database, invoice: Invoice, workspace: Workspace | null, items: T[] = [],
): Promise<{ workspace: Workspace | null; items: T[] }> {
  if (!invoice.veda_organization_id) return { workspace, items };
  if (!invoice.user_id) throw new Error('Invoice owner is required');
  const { data: mapping, error } = await db.from('veda_organization_mappings')
    .select('organization_name')
    .eq('veda_organization_id', invoice.veda_organization_id)
    .eq('user_id', invoice.user_id).maybeSingle();
  if (error) throw new Error('Failed to resolve invoice organization');
  const name = providerName(mapping?.organization_name, workspace?.business_name);
  return {
    workspace: { ...workspace, business_name: name },
    items: brandInvoiceItems(invoice, { business_name: name }, items),
  };
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const random = randomInt(0, 100_000).toString().padStart(5, '0');
  return `INT${yy}${mm}-${random}`;
}

// The database's unique constraint arbitrates concurrent allocations. Only number
// collisions are retried; duplicate EMR invoices and other failures are not hidden.
export async function insertIntegrationInvoice(db: Database, values: Record<string, unknown>, selection: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await db.from('invoices')
      .insert({ ...values, invoice_number: generateInvoiceNumber() }).select(selection).single();
    if (result.error?.code !== '23505' || result.error.constraint !== 'invoices_invoice_number_key') return result;
  }
  throw new Error('Unable to allocate a unique invoice number');
}

export function brandInvoiceItems<T extends { provider?: string | null }>(invoice: Invoice, workspace: Workspace | null, items: T[]): T[] {
  if (!invoice.veda_organization_id) return items;
  return items.map(item => ({ ...item, provider: providerName(undefined, workspace?.business_name) }));
}
