import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutReceipt } from './checkoutReceipt.ts';

test('settles card and ACH additional payments separately from invoice principal', () => {
  for (const surchargeCents of [0, 300]) {
    const received = 10000 + 1500 + surchargeCents;
    assert.deepEqual(checkoutReceipt(10000, received, {
      additional_payment_cents: '1500',
      surcharge_amount: String(surchargeCents / 100),
    }), { additionalPaymentCents: 1500, surchargeCents, chargedAmountCents: received });
  }
});

test('rejects an inconsistent checkout before recording settlement', () => {
  for (const additional of ['1500', '-1', '1.5', 'NaN']) {
    assert.throws(() => checkoutReceipt(10000, 10000, {
      additional_payment_cents: additional, surcharge_amount: '0',
    }));
  }
});

test('accepts existing checkout metadata without an additional payment', () => {
  assert.deepEqual(checkoutReceipt(10000, 10300, { surcharge_amount: '3' }), {
    additionalPaymentCents: 0, surchargeCents: 300, chargedAmountCents: 10300,
  });
});
