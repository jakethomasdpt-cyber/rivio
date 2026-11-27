'use client';

import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js/pure';
import type { StripeCheckoutExpressCheckoutElement } from '@stripe/stripe-js';
import type { SurchargeInfo } from './StripePayButton';
import { formatCurrency } from '@/lib/utils';

interface WalletPayButtonProps {
  portalToken: string;
  total: number;
  additionalPaymentCents: number;
  onProcessingChange: (processing: boolean) => void;
  surcharge?: SurchargeInfo;
  validAmount: boolean;
  processing: boolean;
}

export default function WalletPayButton({ portalToken, total, additionalPaymentCents, onProcessingChange, surcharge, validAmount, processing }: WalletPayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSurcharge = surcharge?.enabled && surcharge.amount > 0;
  const totalWithSurcharge = hasSurcharge ? total + surcharge.amount : total;

  const amountCents = Math.round(totalWithSurcharge * 100);
  const [nativeState, setNativeState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const applePay = (window as Window & { ApplePaySession?: { canMakePayments(): boolean } }).ApplePaySession;
    let element: StripeCheckoutExpressCheckoutElement | undefined;
    let confirming = false;
    const controller = new AbortController();

    function nativeUnavailable() {
      controller.abort();
      element?.destroy();
      element = undefined;
      setNativeState('unavailable');
    }

    async function initialize() {
      if (!container || !key || !validAmount || !window.isSecureContext || !applePay?.canMakePayments()) {
        nativeUnavailable();
        return;
      }
      const stripe = await loadStripe(key);
      if (controller.signal.aborted) return;
      if (!stripe) throw new Error('Stripe did not load.');

      const response = await fetch(`/api/portal/${encodeURIComponent(portalToken)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: 'wallet', ui_mode: 'elements',
          additional_payment_cents: additionalPaymentCents, expected_total_cents: amountCents,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Wallet checkout is unavailable.');
      const session = await response.json();
      if (controller.signal.aborted) return;
      if (typeof session.clientSecret !== 'string' || !session.clientSecret || session.amountCents !== amountCents) {
        throw new Error('Wallet checkout total changed.');
      }
      const checkout = stripe.initCheckoutElementsSdk({ clientSecret: session.clientSecret });
      const result = await checkout.loadActions();
      if (controller.signal.aborted) return;
      if (result.type !== 'success') throw new Error('Wallet checkout is unavailable.');
      const { actions } = result;
      const current = actions.getSession();
      if (current.status.type !== 'open' || current.currency.toLowerCase() !== 'usd' || current.total.total.minorUnitsAmount !== amountCents) {
        throw new Error('Wallet checkout no longer matches this invoice.');
      }
      element = checkout.createExpressCheckoutElement({
        buttonHeight: 44, buttonType: { applePay: 'plain' }, buttonTheme: { applePay: 'black' },
        layout: { maxRows: 1, maxColumns: 1 }, paymentMethodOrder: ['apple_pay'],
        paymentMethods: { applePay: 'auto', googlePay: 'never', link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' },
      });
      element.on('ready', ({ availablePaymentMethods }) => {
        if (controller.signal.aborted) return;
        window.clearTimeout(timeout);
        if (availablePaymentMethods?.applePay) setNativeState('ready');
        else nativeUnavailable();
      });
      element.on('loaderror', () => {
        if (!controller.signal.aborted) nativeUnavailable();
      });
      element.on('confirm', async event => {
        if (controller.signal.aborted || confirming || event.expressPaymentType !== 'apple_pay') return;
        confirming = true;
        onProcessingChange(true);
        setError(null);
        try {
          const confirmation = await actions.confirm({ expressCheckoutConfirmEvent: event, redirect: 'if_required' });
          if (controller.signal.aborted) return;
          if (confirmation.type === 'error') {
            const message = confirmation.error.message || 'Apple Pay could not complete this payment.';
            event.paymentFailed({ reason: 'fail', message });
            setError(message);
            confirming = false;
            onProcessingChange(false);
            return;
          }
          const status = confirmation.session.status;
          const query = status.type === 'complete' && status.paymentStatus === 'paid' ? '?payment=success' : '';
          window.location.replace(`/portal/${encodeURIComponent(portalToken)}${query}`);
        } catch {
          if (!controller.signal.aborted) setError('Refresh the invoice to check your payment status before trying again.');
        }
      });
      element.mount(container);
    }

    // Let an amount edit settle before creating a session for the new total.
    const timer = window.setTimeout(() => {
      void initialize().catch(() => { if (!controller.signal.aborted) nativeUnavailable(); });
    }, 250);
    const timeout = window.setTimeout(() => {
      if (!controller.signal.aborted) nativeUnavailable();
    }, 10000);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      element?.destroy();
    };
  }, [additionalPaymentCents, amountCents, portalToken, onProcessingChange, validAmount]);

  async function handlePay() {
    setLoading(true);
    onProcessingChange(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${portalToken}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_payment_cents: additionalPaymentCents, payment_method: 'wallet' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await res.json();
      if (!url) throw new Error('Checkout is unavailable. Please try again.');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setLoading(false);
      onProcessingChange(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100">
          {/* Apple Pay / Google Pay icon — generic wallet */}
          <svg className="h-5 w-5 text-white dark:text-slate-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{nativeState === 'ready' ? 'Apple Pay' : 'Apple Pay / Google Pay'}</p>
            {hasSurcharge && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                +{surcharge.rate}% fee
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            One tap with your saved card or device wallet
          </p>
          {(hasSurcharge || nativeState === 'ready') && (
            <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              {hasSurcharge && <>{surcharge.label}: {formatCurrency(surcharge.amount)} · </>}
              Total: {formatCurrency(totalWithSurcharge)}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <div inert={processing || nativeState !== 'ready'} aria-hidden={nativeState !== 'ready'} ref={mountRef}
          className={nativeState === 'ready' ? 'min-w-36 flex-1' : 'pointer-events-none absolute w-40 opacity-0'} />
        {nativeState === 'loading' && <span role="status" className="text-sm text-slate-500">Loading wallet…</span>}
        {nativeState === 'unavailable' && <button
          type="button"
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
            <>Pay {formatCurrency(hasSurcharge ? totalWithSurcharge : total)}</>
          )}
        </button>}
      </div>
    </div>
  );
}
