'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface WalletPayButtonProps {
  portalToken: string;
  total: number;
}

export default function WalletPayButton({ portalToken, total }: WalletPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${portalToken}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'wallet' }),
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
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100">
          {/* Apple Pay / Google Pay icon — generic wallet */}
          <svg className="h-5 w-5 text-white dark:text-slate-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Apple Pay / Google Pay</p>
            {/* Small logos as text badges */}
            <span className="inline-flex items-center rounded bg-black px-1.5 py-0.5 text-xs font-semibold text-white leading-none">
              Pay
            </span>
            <span className="inline-flex items-center rounded bg-white border border-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700 leading-none dark:border-slate-600 dark:text-slate-300 dark:bg-slate-700">
              G Pay
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            One tap with your saved card or device wallet
          </p>
          {error && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Opening…
            </>
          ) : (
            <>Pay {formatCurrency(total)}</>
          )}
        </button>
      </div>
    </div>
  );
}
