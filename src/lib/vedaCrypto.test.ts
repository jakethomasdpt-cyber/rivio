import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmacSignature, mapStripePaymentMethod, verifyHmacSignature } from './vedaCrypto.ts';

test('signature verification accepts a valid signature', () => {
  const rawBody = JSON.stringify({ vedaOrganizationId: 'org_1', vedaInvoiceId: 'inv_1' });
  const timestamp = '1800000000';
  const secret = 'shared-test-secret';
  const signature = createHmacSignature({ secret, timestamp, rawBody });

  assert.deepEqual(
    verifyHmacSignature({
      secret,
      timestamp,
      rawBody,
      signature,
      nowMs: 1_800_000_000_000,
    }),
    { ok: true }
  );
});

test('signature verification rejects bad signatures', () => {
  const rawBody = JSON.stringify({ ok: true });
  const timestamp = '1800000000';
  const secret = 'shared-test-secret';

  assert.deepEqual(
    verifyHmacSignature({
      secret,
      timestamp,
      rawBody,
      signature: 'sha256=not-the-signature',
      nowMs: 1_800_000_000_000,
    }),
    { ok: false, reason: 'invalid' }
  );
});

test('signature verification rejects stale timestamps', () => {
  const rawBody = JSON.stringify({ ok: true });
  const timestamp = '1800000000';
  const secret = 'shared-test-secret';
  const signature = createHmacSignature({ secret, timestamp, rawBody });

  assert.deepEqual(
    verifyHmacSignature({
      secret,
      timestamp,
      rawBody,
      signature,
      nowMs: 1_800_000_301_000,
    }),
    { ok: false, reason: 'stale' }
  );
});

test('ACH, card, and debit labels are preserved for Veda payloads', () => {
  assert.equal(mapStripePaymentMethod('us_bank_account'), 'ach');
  assert.equal(mapStripePaymentMethod('card'), 'card');
  assert.equal(mapStripePaymentMethod('debit'), 'debit');
  assert.equal(mapStripePaymentMethod('wire'), 'other');
});
