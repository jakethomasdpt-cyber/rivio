'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface SavedMethod {
  id: string;
  type: string;
  last4?: string;
  bank_name?: string;
}

interface SavedAchPayButtonProps {
  portalToken: string;
  total: number;
  savedMethods: SavedMethod[];
}

export default function SavedAchPayButton({ portalToken, total, savedMethods }: SavedAchPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the first saved bank account
  const method = savedMethods[0];
  if (!method) return null;

  const bankLabel = method.bank_name
    ? `${method.bank_name} ····${method.last4}`
    : `Bank account ····${method.last4}`;

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${portalToken}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: 'ach',
          saved_payment_method_id: method.id,
        }),
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
    <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-emerald-50 p-5 shadow-sm transition-shadow hover:shadow-md dark:border-blue-800 dark:from-blue-950/30 dark:to-emerald-950/30">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Quick Pay</p>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              No fee
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {bankLabel}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Your saved bank account · settles in 3–5 days
          </p>
          {error && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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
            <>Pay {formatCurrency(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
