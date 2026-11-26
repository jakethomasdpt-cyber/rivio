'use client';

import { useState } from 'react';
import { MAX_CHECKOUT_CENTS, parseAdditionalPayment } from '@/lib/portalPaymentAmounts';
import { formatCurrency } from '@/lib/utils';
import AchPayButton from './AchPayButton';
import SavedAchPayButton, { type SavedMethod } from './SavedAchPayButton';
import StripePayButton, { type SurchargeInfo } from './StripePayButton';
import WalletPayButton from './WalletPayButton';

interface OnlinePaymentOptionsProps {
  previewOnly?: boolean;
  portalToken: string;
  invoiceTotal: number;
  allowAch: boolean;
  allowCard: boolean;
  allowWallet: boolean;
  savedMethods: SavedMethod[];
  surcharge?: SurchargeInfo;
}

export default function OnlinePaymentOptions({
  previewOnly, portalToken, invoiceTotal, allowAch, allowCard, allowWallet, savedMethods, surcharge,
}: OnlinePaymentOptionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!allowAch && !allowCard && !allowWallet) return null;

  const additionalPaymentCents = parseAdditionalPayment(amount);
  const totalCents = Math.round(invoiceTotal * 100) + (additionalPaymentCents ?? 0);
  const surchargeCents = surcharge?.enabled ? Math.round(surcharge.amount * 100) : 0;
  const bankLimitExceeded = totalCents > MAX_CHECKOUT_CENTS;
  const cardLimitExceeded = totalCents + surchargeCents > MAX_CHECKOUT_CENTS;
  const error = additionalPaymentCents === null
    ? 'Enter a dollar amount of zero or more with up to two decimal places.'
    : bankLimitExceeded || (!allowAch && cardLimitExceeded)
      ? `The payment total must be ${formatCurrency(MAX_CHECKOUT_CENTS / 100)} or less.`
      : null;
  const buttonProps = {
    portalToken, total: totalCents / 100, additionalPaymentCents: additionalPaymentCents ?? 0,
    onProcessingChange: setProcessing,
  };

  return (
    <fieldset disabled={processing} className="min-w-0 space-y-3">
      <legend className="sr-only">Online payment options</legend>
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="optional-payment-field"
          onClick={() => { setExpanded(!expanded); setAmount(''); }}
          className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:underline dark:text-blue-400"
        >
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          Additional payment (optional)
        </button>
        <div id="optional-payment-field" hidden={!expanded} className="mt-3">
          <label htmlFor="optional-payment-amount" className="block text-sm font-medium">Additional amount (USD)</label>
          <input
            id="optional-payment-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'optional-payment-hint optional-payment-error' : 'optional-payment-hint'}
            className="mt-1 w-32 rounded-lg border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600"
          />
          <p id="optional-payment-hint" className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No fee is added to your optional payment at online checkout.
          </p>
        </div>
        {error && <p id="optional-payment-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <fieldset disabled={previewOnly || !!error} className="min-w-0 space-y-3">
        {allowAch && savedMethods.length > 0 && <SavedAchPayButton {...buttonProps} savedMethods={savedMethods} />}
        {allowAch && <AchPayButton {...buttonProps} hasSurcharge={surcharge?.enabled} />}
        {(allowCard || allowWallet) && (
          <fieldset disabled={cardLimitExceeded} className="min-w-0 space-y-3">
            {cardLimitExceeded && !error && (
              <p role="status" className="text-sm">The card total including fees exceeds the {formatCurrency(MAX_CHECKOUT_CENTS / 100)} limit.</p>
            )}
            {allowCard && <StripePayButton {...buttonProps} surcharge={surcharge} />}
            {allowWallet && <WalletPayButton {...buttonProps} surcharge={surcharge} />}
          </fieldset>
        )}
      </fieldset>
    </fieldset>
  );
}
