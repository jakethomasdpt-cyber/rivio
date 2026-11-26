import 'server-only';
import type { Invoice } from '@/types';

// A branch-scoped Vercel fixture lets the recipient review a test invoice
// without creating a patient balance or connecting a payment processor.
export function previewInvoice(token: string): Invoice | null {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.RIVIO_PREVIEW_INVOICE) return null;
  const invoice: Invoice = JSON.parse(process.env.RIVIO_PREVIEW_INVOICE);
  return invoice.portal_token === token ? invoice : null;
}
