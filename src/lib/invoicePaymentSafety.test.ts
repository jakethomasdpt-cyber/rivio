import test from 'node:test';
import assert from 'node:assert/strict';
import { assertInvoiceUnpaid, expireInvoiceCheckoutSessions, createCheckoutForLockedInvoice, withInvoicePaymentOperation, stripeCreationWithDeclineRecovery } from './invoicePaymentSafety.ts';

function stripeFixture(sessions: any[], intents: any[] = []) {
  const expired: string[] = [];
  const stripe: any = { checkout: { sessions: {
    async *list() { yield* sessions; },
    async retrieve(id: string) { return sessions.find(s => s.id === id); },
    async expire(id: string) { expired.push(id); return { ...sessions.find(s => s.id === id), status: 'expired' }; },
  } }, paymentIntents: { async *list() { yield* intents; }, async retrieve(id: string) { return intents.find(i => i.id === id); } } };
  return { stripe, expired };
}
const invoice = { id: 'invoice', created_at: '2026-10-19T00:00:00Z', status: 'sent', paid_amount: 0, total: 250, veda_metadata: {} };
test('all historical open sessions expire, unrelated invoices remain untouched', async () => {
  const f = stripeFixture(['old', 'new', 'unrelated'].map(id => ({ id, status: 'open', payment_status: 'unpaid', metadata: { invoice_id: id === 'unrelated' ? 'other' : 'invoice' } })));
  await expireInvoiceCheckoutSessions(f.stripe, invoice);
  assert.deepEqual(f.expired, ['old', 'new']);
});
test('completed unpaid ACH, paid sessions, active intents and expiration races fail closed', async () => {
  for (const session of [{ status: 'complete', payment_status: 'unpaid' }, { status: 'complete', payment_status: 'paid' }]) {
    const f = stripeFixture([{ id: 'session', metadata: { invoice_id: 'invoice' }, ...session }]);
    await assert.rejects(expireInvoiceCheckoutSessions(f.stripe, invoice), /completed or processing/);
  }
  const f = stripeFixture([], [{ id: 'pi', status: 'processing', metadata: { invoice_id: 'invoice' } }]);
  await assert.rejects(expireInvoiceCheckoutSessions(f.stripe, invoice), /active or already recorded/);
  const race = stripeFixture([{ id: 'session', status: 'open', metadata: { invoice_id: 'invoice' } }]);
  race.stripe.checkout.sessions.expire = async () => { throw new Error('Session already complete'); };
  await assert.rejects(expireInvoiceCheckoutSessions(race.stripe, invoice), /already complete/);
});
test('partial, paid and ambiguous payment reservations cannot be cancelled', () => {
  for (const patch of [{ paid_amount: 1 }, { status: 'paid' }, { status: 'partially_paid' }, { veda_metadata: { paymentSafetyPending: 'operation' } }]) {
    assert.throws(() => assertInvoiceUnpaid({ ...invoice, ...patch }));
  }
});
function poolFixture(initial: any) {
  let row = structuredClone(initial), snapshot: any;
  const calls: string[] = [];
  const client = { release() {}, async query(sql: string, values?: any[]) {
    calls.push(sql);
    if (sql === 'BEGIN') snapshot = structuredClone(row);
    if (sql === 'ROLLBACK') row = snapshot;
    if (sql.startsWith('SELECT *')) return { rows: [structuredClone(row)] };
    if (sql.includes('payment_attempts')) return { rows: [] };
    if (sql.includes("jsonb_build_object('paymentSafetyPending'")) row.veda_metadata.paymentSafetyPending = values![1];
    if (sql.includes("veda_metadata - 'paymentSafetyPending'")) delete row.veda_metadata.paymentSafetyPending;
    return { rows: [] };
  } };
  return { pool: { async connect() { return client; } } as any, calls, row: () => row };
}
test('cancelled checkout is rejected before Stripe creation', async () => {
  const f = poolFixture({ ...invoice, status: 'cancelled' });
  let created = false;
  const stripe: any = { checkout: { sessions: { async create() { created = true; } } } };
  await assert.rejects(createCheckoutForLockedInvoice(f.pool, stripe, invoice.id, { total: 250 }, {}), /Cancelled/);
  assert.equal(created, false);
  assert.ok(f.calls.some(sql => sql.includes('FOR UPDATE')));
});
test('ambiguous Stripe outcome retains a committed reservation and blocks void/retry', async () => {
  const f = poolFixture(invoice);
  await assert.rejects(withInvoicePaymentOperation(f.pool, invoice.id, async () => { throw new Error('Network timeout'); }), /Network timeout/);
  assert.ok(f.row().veda_metadata.paymentSafetyPending);
  assert.throws(() => assertInvoiceUnpaid(f.row()), /reconciliation/);
  assert.equal(f.calls.filter(sql => sql === 'COMMIT').length, 1);
});
test('successful operation clears reservation only after remote work and persistence complete', async () => {
  const f = poolFixture(invoice);
  await withInvoicePaymentOperation(f.pool, invoice.id, async () => { assert.ok(f.row().veda_metadata.paymentSafetyPending); });
  assert.equal(f.row().veda_metadata.paymentSafetyPending, undefined);
  assert.equal(f.calls.filter(sql => sql === 'COMMIT').length, 2);
});

test('definitive Stripe card declines clear reservations and allow a retry', async () => {
  for (const payment_intent of [{ status: 'requires_payment_method' }, { status: 'canceled' }, undefined]) {
    const f = poolFixture(invoice);
    const declined = Object.assign(new Error('Card declined'), { type: 'StripeCardError', code: 'card_declined', payment_intent });
    await assert.rejects(withInvoicePaymentOperation(f.pool, invoice.id, () => stripeCreationWithDeclineRecovery(async () => { throw declined; })), /Card declined/);
    assert.equal(f.row().veda_metadata.paymentSafetyPending, undefined);
    await withInvoicePaymentOperation(f.pool, invoice.id, async () => 'retry');
  }
});
test('unknown or active-intent errors and post-success persistence errors retain reservations', async () => {
  for (const failure of [new Error('Network timeout'), Object.assign(new Error('Processing'), { type: 'StripeCardError', payment_intent: { status: 'processing' } })]) {
    const f = poolFixture(invoice);
    await assert.rejects(withInvoicePaymentOperation(f.pool, invoice.id, () => stripeCreationWithDeclineRecovery(async () => { throw failure; })));
    assert.ok(f.row().veda_metadata.paymentSafetyPending);
  }
  const f = poolFixture(invoice);
  await assert.rejects(withInvoicePaymentOperation(f.pool, invoice.id, async () => {
    await stripeCreationWithDeclineRecovery(async () => ({ status: 'succeeded' }));
    throw Object.assign(new Error('Database persistence failed'), { type: 'StripeCardError', code: 'card_declined' });
  }));
  assert.ok(f.row().veda_metadata.paymentSafetyPending);
});
test('unpaid declined intents must confirm cancellation; active intents remain blocked', async () => {
  const intent = { id: 'declined', status: 'requires_payment_method', metadata: { invoice_id: invoice.id } };
  const f = stripeFixture([], [intent]);
  f.stripe.paymentIntents.cancel = async (id: string) => ({ ...intent, id, status: 'canceled' });
  await expireInvoiceCheckoutSessions(f.stripe, invoice);
  f.stripe.paymentIntents.cancel = async () => ({ ...intent, status: 'processing' });
  await assert.rejects(expireInvoiceCheckoutSessions(f.stripe, invoice), /active or already recorded/);
  f.stripe.paymentIntents.cancel = async () => { throw new Error('Payment already succeeded'); };
  await assert.rejects(expireInvoiceCheckoutSessions(f.stripe, invoice), /already succeeded/);
});
