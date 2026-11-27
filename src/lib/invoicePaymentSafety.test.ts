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
    if (sql.includes('SET stripe_checkout_session_id = $2')) row.stripe_checkout_session_id = values![1];
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

test('repeated direct wallet setup reuses one session and preserves a completed checkout', async () => {
  const f = poolFixture({ ...invoice, portal_token: 'fixture-token', accept_wallet: true });
  const sessions: any[] = [];
  const { stripe, expired } = stripeFixture(sessions);
  stripe.checkout.sessions.create = async (params: any) => {
    const session = { id: 'session-' + sessions.length, client_secret: 'fixture-secret', status: 'open',
      payment_status: 'unpaid', metadata: { ...params.metadata }, ui_mode: params.ui_mode };
    sessions.push(session);
    return session;
  };
  const expected = { portalToken: 'fixture-token', total: 250, wallet: true };
  const params = { ui_mode: 'elements' as const, mode: 'payment' as const, metadata: { invoice_id: invoice.id } };
  const create = () => createCheckoutForLockedInvoice(f.pool, stripe, invoice.id, expected, params);
  const first = await create();
  assert.equal((await create()).id, first.id);
  assert.equal(sessions.length, 1);
  assert.deepEqual(expired, []);
  sessions[0].status = 'complete';
  sessions[0].payment_status = 'paid';
  await assert.rejects(create());
  assert.equal(sessions.length, 1);
  assert.deepEqual(expired, []);
});

test('loading the direct wallet does not replace an active hosted payment session', async () => {
  const f = poolFixture({ ...invoice, accept_wallet: true, stripe_checkout_session_id: 'active-hosted' });
  const { stripe, expired } = stripeFixture([{ id: 'active-hosted', status: 'open', payment_status: 'unpaid',
    ui_mode: 'hosted_page', metadata: { invoice_id: invoice.id } }]);
  let creates = 0;
  let lists = 0;
  stripe.checkout.sessions.list = async function* () { lists++; };
  stripe.checkout.sessions.create = async () => { creates++; throw Error('unexpected create'); };
  await assert.rejects(createCheckoutForLockedInvoice(f.pool, stripe, invoice.id, { total: 250, wallet: true },
    { ui_mode: 'elements', metadata: { invoice_id: invoice.id } }));
  assert.equal(creates, 0);
  assert.equal(lists, 0);
  assert.deepEqual(expired, []);
});

test('Stripe rejects invalid native parameters without blocking a later hosted checkout', async () => {
  const f = poolFixture({ ...invoice, accept_wallet: true });
  const { stripe } = stripeFixture([]);
  stripe.checkout.sessions.create = async (params: { ui_mode?: string }) => {
    if (params.ui_mode === 'elements') throw Object.assign(Error('Invalid checkout configuration'), {
      type: 'StripeInvalidRequestError', statusCode: 400,
    });
    return { id: 'fixture-hosted', url: 'https://example.test/checkout' };
  };
  const expected = { total: invoice.total, wallet: true };
  await assert.rejects(createCheckoutForLockedInvoice(f.pool, stripe, invoice.id, expected, { ui_mode: 'elements' }),
    /Invalid checkout configuration/);
  assert.equal(f.row().veda_metadata.paymentSafetyPending, undefined);
  const hosted = await createCheckoutForLockedInvoice(f.pool, stripe, invoice.id, expected, { mode: 'payment' });
  assert.equal(hosted.id, 'fixture-hosted');
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
