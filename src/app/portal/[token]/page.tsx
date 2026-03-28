'use server';

import { Invoice, Workspace } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import StripePayButton from './StripePayButton';
import VenmoPayButton from './VenmoPayButton';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ payment?: string }>;
};

async function fetchInvoice(token: string): Promise<Invoice | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/portal/${token}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function getStatusBadgeColor(status: Invoice['status']): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'draft':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    case 'sent':
    case 'viewed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  }
}

function getStatusLabel(status: Invoice['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-20 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Invoice Portal
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-100">Invoice not found</h1>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
              There is no active invoice linked to this token. Please check your email or contact your provider for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentSuccessAlert() {
  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-green-800 dark:text-green-200">Payment successful!</h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            Thank you for your payment. A receipt has been sent to your email.
          </p>
        </div>
      </div>
    </div>
  );
}

function OverdueAlert() {
  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-red-800 dark:text-red-200">This invoice is overdue</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Please make payment as soon as possible to avoid further delays.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function PortalPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { payment } = await searchParams;
  const invoice = await fetchInvoice(token);

  if (!invoice) {
    return <NotFound />;
  }

  const workspace = invoice.workspace as Workspace | undefined;
  const businessName = workspace?.business_name || 'Invoice Portal';
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(workspace?.brand_color || '')
    ? workspace!.brand_color!
    : '#2563eb';
  const venmoHandle = workspace?.venmo_handle || '';
  const zelleContact = workspace?.zelle_phone || '';
  const businessEmail = workspace?.email || '';
  const businessWebsite = workspace?.website || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-12 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-2xl">
        {/* Header Logo */}
        <div className="mb-12 text-center">
          <div
            className="inline-flex items-center justify-center rounded-lg px-4 py-2"
            style={{ backgroundColor: brandColor }}
          >
            <span className="text-2xl font-bold text-white">{businessName}</span>
          </div>
        </div>

        {/* Payment Success Alert */}
        {payment === 'success' && <PaymentSuccessAlert />}

        {/* Main Invoice Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {/* Paid Stamp / Overdue Banner */}
          {invoice.status === 'paid' && (
            <div className="relative h-48 overflow-hidden border-b border-slate-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-slate-800 dark:from-green-950 dark:to-emerald-950">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold text-green-600/20 dark:text-green-400/20">✓</div>
                  <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-300">PAID</p>
                  {invoice.paid_date && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                      Paid on {formatDate(invoice.paid_date)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Invoice Header */}
          <div className="border-b border-slate-200 px-8 py-8 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Invoice from {businessName}
                </h1>
              </div>
              <div className={`rounded-lg px-4 py-2 text-sm font-semibold ${getStatusBadgeColor(invoice.status)}`}>
                {getStatusLabel(invoice.status)}
              </div>
            </div>
          </div>

          {/* Overdue Alert */}
          {invoice.status === 'overdue' && (
            <div className="border-b border-red-200 bg-red-50 px-8 py-4 dark:border-red-900 dark:bg-red-950">
              <div className="flex gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-200">This invoice is overdue</p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Please make payment as soon as possible.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Details Grid */}
          <div className="border-b border-slate-200 px-8 py-8 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Invoice Number
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {invoice.invoice_number}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Date Issued
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(invoice.created_at)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Due Date
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {formatDate(invoice.due_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="border-b border-slate-200 px-8 py-8 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Bill To
            </p>
            <div className="mt-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {invoice.client_name || invoice.client?.name}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {invoice.client_email || invoice.client?.email}
              </p>
              {invoice.client?.address && (
                <>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {invoice.client.address}
                  </p>
                  {(invoice.client.city || invoice.client.state || invoice.client.zip) && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {[invoice.client.city, invoice.client.state].filter(Boolean).join(', ')}{' '}
                      {invoice.client.zip}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="border-b border-slate-200 px-8 py-8 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Service
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Provider
                    </th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Rate
                    </th>
                    <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Qty
                    </th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-3 text-sm text-slate-900 dark:text-slate-100">
                        {item.service}
                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                        )}
                      </td>
                      <td className="py-3 text-sm text-slate-700 dark:text-slate-300">{item.provider}</td>
                      <td className="py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-3 text-center text-sm text-slate-700 dark:text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="border-b border-slate-200 px-8 py-8 dark:border-slate-800">
            <div className="flex justify-end">
              <div className="w-64 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                  <span className="text-slate-900 dark:text-slate-100">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Tax ({(invoice.tax_rate * 100).toFixed(1)}%)
                    </span>
                    <span className="text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Total</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <div className="px-8 py-8">
              <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-slate-100">
                Choose how to pay
              </h2>
              <div className="space-y-4">
                {/* Stripe Payment */}
                <StripePayButton invoiceId={invoice.id} total={invoice.total} />

                {/* Venmo Payment — only shown if workspace has a Venmo handle */}
                {venmoHandle && (
                  <VenmoPayButton
                    venmoHandle={venmoHandle}
                    amount={invoice.total}
                    invoiceNumber={invoice.invoice_number}
                  />
                )}

                {/* Zelle Payment — only shown if workspace has a Zelle phone/email */}
                {zelleContact && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                        <svg
                          className="h-5 w-5 text-green-700 dark:text-green-300"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">Pay with Zelle</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          Send payment to:
                          <span className="mt-2 block font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                            {zelleContact}
                          </span>
                        </p>
                        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                          Include invoice number in the payment note
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-slate-600 dark:text-slate-400">
          <p className="font-medium">{businessName}</p>
          {(businessWebsite || businessEmail) && (
            <p className="mt-1">
              {businessWebsite && (
                <a
                  href={businessWebsite.startsWith('http') ? businessWebsite : `https://${businessWebsite}`}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {businessWebsite}
                </a>
              )}
              {businessWebsite && businessEmail && ' | '}
              {businessEmail && (
                <a href={`mailto:${businessEmail}`} className="hover:underline">
                  {businessEmail}
                </a>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
