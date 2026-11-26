export type CheckoutReceipt = {
  additionalPaymentCents: number;
  surchargeCents: number;
  chargedAmountCents: number;
};

export function checkoutReceipt(
  invoiceCents: number,
  receivedCents: number,
  metadata: Record<string, string> | null,
): CheckoutReceipt {
  const additionalPaymentCents = Number(metadata?.additional_payment_cents ?? 0);
  const surchargeCents = Math.round(Number(metadata?.surcharge_amount ?? 0) * 100);
  if (![receivedCents, additionalPaymentCents, surchargeCents].every(
    amount => Number.isSafeInteger(amount) && amount >= 0
  )) throw new Error('Invalid Stripe payment breakdown.');

  // Older checkout sessions did not include the additional-payment field.
  if (metadata?.additional_payment_cents !== undefined
      && invoiceCents + additionalPaymentCents + surchargeCents !== receivedCents) {
    throw new Error('Stripe payment amount does not match the checkout breakdown.');
  }
  return { additionalPaymentCents, surchargeCents, chargedAmountCents: receivedCents };
}
