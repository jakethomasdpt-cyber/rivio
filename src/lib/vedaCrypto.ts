import crypto from 'crypto';

export type VedaPaymentMethod = 'card' | 'debit' | 'ach' | 'bank_transfer' | 'other';

export function constantTimeEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createHmacSignature({
  secret,
  timestamp,
  rawBody,
}: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
}

export function verifyHmacSignature({
  secret,
  timestamp,
  rawBody,
  signature,
  nowMs = Date.now(),
  toleranceSeconds = 5 * 60,
}: {
  secret: string;
  timestamp: string | null;
  rawBody: string;
  signature: string | null;
  nowMs?: number;
  toleranceSeconds?: number;
}): { ok: true } | { ok: false; reason: 'missing' | 'stale' | 'invalid' | 'misconfigured' } {
  if (!secret) return { ok: false, reason: 'misconfigured' };
  if (!timestamp || !signature) return { ok: false, reason: 'missing' };

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) return { ok: false, reason: 'invalid' };

  const requestMs = parsedTimestamp > 10_000_000_000 ? parsedTimestamp : parsedTimestamp * 1000;
  const ageSeconds = Math.abs(nowMs - requestMs) / 1000;
  if (ageSeconds > toleranceSeconds) return { ok: false, reason: 'stale' };

  const normalizedSignature = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;
  const expected = createHmacSignature({ secret, timestamp, rawBody });

  return constantTimeEqual(expected, normalizedSignature)
    ? { ok: true }
    : { ok: false, reason: 'invalid' };
}

export function mapStripePaymentMethod(paymentMethodType: string): VedaPaymentMethod {
  if (paymentMethodType === 'us_bank_account') return 'ach';
  if (paymentMethodType === 'card') return 'card';
  if (paymentMethodType === 'debit') return 'debit';
  return 'other';
}
