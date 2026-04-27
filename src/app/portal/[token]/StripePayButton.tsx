'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface SurchargeInfo {
  enabled: boolean;
  rate: number;
  label: string;
  amount: number;
}

interface StripePayButtonProps {
  portalToken: string;
  total: number;
  surcharge?: SurchargeInfo;
}

export default function StripePayButton({ portalToken, total, surcharge }: StripePayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSurcharge = surcharge?.enabled && surcharge.amount > 0;
  const totalWithSurcharge = hasSurcharge ? total + surcharge.amount : total;

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${portalToken}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'card' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Credit / Debit Card</p>
            {hasSurcharge && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                +{surcharge.rate}% fee
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Visa, Mastercard, Amex — secured by Stripe
          </p>
          {hasSurcharge && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {surcharge.label}: {formatCurrency(surcharge.amount)} · Total: {formatCurrency(totalWithSurcharge)}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-500"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing…
            </>
          ) : (
            <>Pay {formatCurrency(hasSurcharge ? totalWithSurcharge : total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
