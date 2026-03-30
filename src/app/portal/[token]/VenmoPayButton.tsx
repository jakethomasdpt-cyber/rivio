'use client';

import { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  useEffect(() => {
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);
  }, []);

  const note = encodeURIComponent('Invoice ' + invoiceNumber);

  // Deep link opens Venmo app (mobile only)
  const venmoDeepLink = `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${amount.toFixed(2)}&note=${note}`;

  // Venmo web profile (desktop fallback — opens venmo.com)
  const venmoWebLink = `https://venmo.com/${venmoHandle}`;

  // QR code encodes the deep link so mobile cameras launch the app directly
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(venmoDeepLink)}&bgcolor=ffffff&color=000000&margin=2`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-4">
        {/* Venmo icon */}
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#008CFF]/10">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#008CFF">
            <path d="M19.03 3c.61 1.01.88 2.04.88 3.35 0 4.17-3.55 9.59-6.43 13.4H7.01L4.6 5.97l5.55-.53 1.28 10.3C12.8 13.3 14.45 9.6 14.45 7c0-1.14-.2-2.07-.55-2.84L19.03 3z"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Venmo</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Pay instantly from your Venmo balance or bank
          </p>

          {/* Send-to info */}
          <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-700">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Send to</p>
            <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-slate-100">@{venmoHandle}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Include <span className="font-semibold">{invoiceNumber}</span> in the note
            </p>
          </div>

          {/* Mobile vs Desktop CTA */}
          <div className="mt-3 flex flex-wrap gap-2">
            {isMobile ? (
              <a
                href={venmoDeepLink}
                className="inline-flex items-center gap-2 rounded-lg bg-[#008CFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0070CC] active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.03 3c.61 1.01.88 2.04.88 3.35 0 4.17-3.55 9.59-6.43 13.4H7.01L4.6 5.97l5.55-.53 1.28 10.3C12.8 13.3 14.45 9.6 14.45 7c0-1.14-.2-2.07-.55-2.84L19.03 3z"/>
                </svg>
                Open Venmo App
              </a>
            ) : (
              <>
                <a
                  href={venmoWebLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#008CFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0070CC] active:scale-95"
                >
                  Open Venmo.com
                </a>
                <button
                  onClick={() => setShowQR(!showQR)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0a8 8 0 11-16 0 8 8 0 0116 0z" />
                  </svg>
                  {showQR ? 'Hide' : 'Scan'} QR Code
                </button>
              </>
            )}
          </div>

          {/* QR Code (desktop only — directs phone camera to open Venmo app) */}
          {showQR && !isMobile && (
            <div className="mt-4 flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex-shrink-0 rounded-lg bg-white p-2 shadow-sm">
                {/* Real QR code via qrserver.com — encodes the Venmo deep link */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt={`Scan to pay @${venmoHandle} on Venmo`}
                  width={140}
                  height={140}
                  className="block"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Scan with your phone</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Point your phone camera at this QR code — it will open the Venmo app automatically and pre-fill the payment.
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Amount:</span>{' '}
                    {formatCurrency(amount)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">To:</span>{' '}
                    @{venmoHandle}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile hint for desktop users who didn't show QR */}
          {!isMobile && !showQR && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              📱 On your phone? Tap "Open Venmo App" for one-tap payment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
