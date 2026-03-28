'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface AchPayButtonProps {
  invoiceId: string;
  total: number;
}

export default function AchPayButton({ invoiceId, total }: AchPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId, payment_type: 'ach' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
          <svg
            className="h-5 w-5 text-emerald-700 dark:text-emerald-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Pay by Bank Transfer (ACH)
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Connect your bank account securely via Stripe. Funds settle in 3–5 business days.
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            onClick={handlePay}
            disabled={loading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Connecting...
              </>
            ) : (
              <>Pay {formatCurrency(total)} via Bank</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
