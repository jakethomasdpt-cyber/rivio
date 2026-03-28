'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

interface VenmoPayButtonProps {
  venmoHandle: string;
  amount: number;
  invoiceNumber: string;
}

export default function VenmoPayButton({
  venmoHandle,
  amount,
  invoiceNumber,
}: VenmoPayButtonProps) {
  const [showQR, setShowQR] = useState(false);

  const venmoDeepLink = `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${amount.toFixed(2)}&note=${encodeURIComponent('Invoice ' + invoiceNumber)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
          <svg
            className="h-5 w-5 text-blue-700 dark:text-blue-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Pay with Venmo</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Send payment to:
            <span className="mt-2 block font-mono text-base font-bold text-slate-900 dark:text-slate-100">
              @{venmoHandle}
            </span>
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={venmoDeepLink}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition-all hover:bg-blue-700 dark:hover:bg-blue-500"
            >
              Open Venmo
            </a>
            <button
              onClick={() => setShowQR(!showQR)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2 font-semibold text-slate-900 transition-all hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {showQR ? 'Hide' : 'Show'} QR Code
            </button>
          </div>
          {showQR && (
            <div className="mt-4 rounded-lg bg-white p-4 dark:bg-slate-900">
              <div className="flex h-40 w-40 items-center justify-center bg-slate-100 dark:bg-slate-800">
                <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                  <p className="font-semibold">QR Code</p>
                  <p className="mt-1">@{venmoHandle}</p>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">
                    {formatCurrency(amount)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Scan this code with Venmo or use the "Open Venmo" button above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
