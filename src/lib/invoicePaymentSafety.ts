import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';

export class InvoicePaymentConflict extends Error {}

export function assertInvoiceUnpaid(invoice: Record<string, any>) {
  if (invoice.veda_metadata?.paymentSafetyPending) throw new InvoicePaymentConflict('A payment operation requires reconciliation before this invoice can change.');
  if (Number(invoice.paid_amount || 0) > 0 || invoice.paid_date || ['paid', 'partially_paid', 'refunded'].includes(invoice.status)) {
    throw new InvoicePaymentConflict('Payments already exist for this invoice.');
  }
}

/** Both checkout creation and voiding hold this lock until their Stripe work settles. */
export async function withLockedInvoice<T>(pool: Pool, invoiceId: string,
  work: (client: PoolClient, invoice: Record<string, any>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    const result = await client.query('SELECT * FROM public.invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
    if (!result.rows[0]) throw new InvoicePaymentConflict('Invoice not found.');
    const value = await work(client, result.rows[0]);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function assertNoRecordedPayments(client: PoolClient, invoiceId: string) {
  const result = await client.query("SELECT id FROM public.payment_attempts WHERE invoice_id = $1 AND status NOT IN ('failed') LIMIT 1", [invoiceId]);
  if (result.rows.length) throw new InvoicePaymentConflict('Payment is pending or recorded for this invoice.');
}

async function requireInactiveIntent(stripe: Stripe, intent: Stripe.PaymentIntent) {
  if (intent.status === 'requires_payment_method') {
    // A declined/unfunded intent can be retired. Stripe rejects cancellation if payment won the race.
    intent = await stripe.paymentIntents.cancel(intent.id);
  }
  if (intent.status !== 'canceled') throw new InvoicePaymentConflict('Stripe payment is active or already recorded.');
}

/** Include historical sessions: replacing the stored latest ID does not invalidate old URLs. */
export async function expireInvoiceCheckoutSessions(stripe: Stripe, invoice: Record<string, any>) {
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const created = Math.floor(new Date(invoice.created_at).getTime() / 1000);
  if (!Number.isFinite(created)) throw new InvoicePaymentConflict('Invoice creation time is unavailable.');
  for await (const session of stripe.checkout.sessions.list({ created: { gte: created }, limit: 100 })) {
    if (session.metadata?.invoice_id === invoice.id) sessions.set(session.id, session);
  }
  if (invoice.stripe_checkout_session_id && !sessions.has(invoice.stripe_checkout_session_id)) {
    const session = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);
    sessions.set(session.id, session);
  }
  for (let session of sessions.values()) {
    if (session.status === 'complete' || session.payment_status === 'paid') {
      throw new InvoicePaymentConflict('Stripe payment is completed or processing.');
    }
    if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
    if (session.status !== 'expired') throw new InvoicePaymentConflict('Stripe checkout could not be disabled.');
    if (session.payment_intent) {
      const intent = typeof session.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(session.payment_intent) : session.payment_intent;
      await requireInactiveIntent(stripe, intent);
    }
  }
  for await (const intent of stripe.paymentIntents.list({ created: { gte: created }, limit: 100 })) {
    if (intent.metadata?.invoice_id === invoice.id) await requireInactiveIntent(stripe, intent);
  }
  if (invoice.stripe_payment_intent_id) {
    const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
    await requireInactiveIntent(stripe, intent);
  }
}

class RecoverablePaymentFailure extends Error {
  readonly original: unknown;
  constructor(original: unknown) { super('The payment operation can be retried.'); this.original = original; }
}

/** Wrap only the Stripe creation call, never persistence after a successful charge. */
export async function stripeCreationWithDeclineRecovery<T>(create: () => Promise<T>): Promise<T> {
  try { return await create(); } catch (error) {
    const failure = error as { type?: string; code?: string; payment_intent?: { status?: string }; raw?: { payment_intent?: { status?: string } } };
    const intent = failure?.payment_intent ?? failure?.raw?.payment_intent;
    if (failure?.type === 'StripeCardError' && (intent
      ? ['requires_payment_method', 'canceled'].includes(intent.status ?? '')
      : failure.code === 'card_declined')) {
      throw new RecoverablePaymentFailure(error);
    }
    throw error;
  }
}

/** Commit a reservation before remote work: ambiguous Stripe failures remain blocked for reconciliation. */
export async function withInvoicePaymentOperation<T>(pool: Pool, invoiceId: string,
  work: (client: PoolClient, invoice: Record<string, any>) => Promise<T>) {
  const operationId = randomUUID();
  await withLockedInvoice(pool, invoiceId, async (client, invoice) => {
    assertInvoiceUnpaid(invoice);
    if (invoice.status === 'cancelled') throw new InvoicePaymentConflict('Cancelled invoices cannot be paid.');
    await assertNoRecordedPayments(client, invoiceId);
    await client.query("UPDATE public.invoices SET veda_metadata = COALESCE(veda_metadata, '{}'::jsonb) || jsonb_build_object('paymentSafetyPending', $2::text) WHERE id=$1", [invoiceId, operationId]);
  });
  try {
    return await withLockedInvoice(pool, invoiceId, async (client, invoice) => {
    if (invoice.veda_metadata?.paymentSafetyPending !== operationId || invoice.status === 'cancelled') {
      throw new InvoicePaymentConflict('Payment reservation changed.');
    }
    const value = await work(client, { ...invoice, veda_metadata: { ...invoice.veda_metadata, paymentSafetyPending: undefined } });
    await client.query("UPDATE public.invoices SET veda_metadata = veda_metadata - 'paymentSafetyPending' WHERE id=$1", [invoiceId]);
    return value;
    });
  } catch (error) {
    if (error instanceof RecoverablePaymentFailure) {
      await withLockedInvoice(pool, invoiceId, async (client, invoice) => {
        if (invoice.veda_metadata?.paymentSafetyPending === operationId) {
          await client.query("UPDATE public.invoices SET veda_metadata = veda_metadata - 'paymentSafetyPending' WHERE id=$1", [invoiceId]);
        }
      });
      throw error.original;
    }
    throw error;
  }
}

/** Older checkouts could leave multiple links active. Inspect them once, before replacing a legacy session. */
async function reconcileCheckoutSessions(stripe: Stripe, invoice: Record<string, any>, hash: string, directWallet: boolean) {
  if (!invoice.stripe_checkout_session_id) return null;
  const latest = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);
  if (latest.metadata?.invoice_id !== invoice.id) throw new InvoicePaymentConflict('Stored checkout belongs to a different invoice.');
  if (latest.status === 'complete' || latest.payment_status === 'paid') {
    throw new InvoicePaymentConflict('Stripe payment is completed or processing.');
  }
  if (latest.status === 'open' && directWallet && latest.ui_mode !== 'elements') {
    throw new InvoicePaymentConflict('A hosted checkout is already open for this invoice.');
  }
  const sessions: Stripe.Checkout.Session[] = [latest];
  if (!latest.metadata?.checkout_terms_hash) {
    const created = Math.floor(new Date(invoice.created_at).getTime() / 1000);
    if (!Number.isFinite(created)) throw new InvoicePaymentConflict('Invoice creation time is unavailable.');
    // Legacy dashboard checkout had no customer ID; filtering by customer would miss those links.
    for await (const historical of stripe.checkout.sessions.list({ created: { gte: created, lte: latest.created }, limit: 100 })) {
      if (historical.metadata?.invoice_id === invoice.id && historical.id !== latest.id) sessions.push(historical);
    }
  }
  for (const session of sessions) {
    if (session.status === 'complete' || session.payment_status === 'paid') {
      throw new InvoicePaymentConflict('Stripe payment is completed or processing.');
    }
    if (session.status === 'open' && directWallet && session.ui_mode !== 'elements') {
      throw new InvoicePaymentConflict('A hosted checkout is already open for this invoice.');
    }
  }
  if (latest.status === 'open' && latest.metadata?.checkout_terms_hash === hash
    && (directWallet ? latest.ui_mode === 'elements' && latest.client_secret : latest.url)) {
    return latest;
  }
  for (const session of sessions) {
    const inactive = session.status === 'open' ? await stripe.checkout.sessions.expire(session.id) : session;
    if (inactive.status !== 'expired') throw new InvoicePaymentConflict('Previous checkout is still active.');
    if (inactive.payment_intent) {
      const intent = typeof inactive.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(inactive.payment_intent) : inactive.payment_intent;
      await requireInactiveIntent(stripe, intent);
    }
  }
  return null;
}

export async function createCheckoutForLockedInvoice(pool: Pool, stripe: Stripe, invoiceId: string,
  expected: { userId?: string; portalToken?: string; total: number; wallet?: boolean }, params: Stripe.Checkout.SessionCreateParams,
  update: { portalToken?: string; surchargeAmount?: number } = {}) {
  return withInvoicePaymentOperation(pool, invoiceId, async (client, invoice) => {
    assertInvoiceUnpaid(invoice);
    if (invoice.status === 'cancelled' || (expected.wallet && invoice.accept_wallet !== true)
      || (expected.userId && invoice.user_id !== expected.userId)
      || (expected.portalToken && invoice.portal_token !== expected.portalToken)
      || Number(invoice.total) !== Number(expected.total)
      || (invoice.portal_token_expires_at && new Date(invoice.portal_token_expires_at) < new Date())) {
      throw new RecoverablePaymentFailure(new InvoicePaymentConflict('Invoice changed or is no longer payable. Refresh the invoice.'));
    }
    await assertNoRecordedPayments(client, invoiceId);
    const hash = createHash('sha256').update(JSON.stringify(params)).digest('hex');
    try {
      const existing = await reconcileCheckoutSessions(stripe, invoice, hash, params.ui_mode === 'elements');
      if (existing) return existing;
    } catch (error) {
      // No new checkout has been requested. A refreshed attempt must check the old Stripe state again.
      throw new RecoverablePaymentFailure(error);
    }
    const session = await stripeCreationWithDeclineRecovery(async () => {
      try {
        return await stripe.checkout.sessions.create({
          ...params, metadata: { ...params.metadata, checkout_terms_hash: hash },
        }, { idempotencyKey: `invoice-checkout:${invoiceId}:${invoice.stripe_checkout_session_id || 'first'}:${hash}` });
      } catch (error) {
        // A rejected parameter cannot create a payable session. Keep hosted checkout available.
        const failure = error as { type?: string; statusCode?: number };
        if (failure.type === 'StripeInvalidRequestError' && failure.statusCode === 400) {
          throw new RecoverablePaymentFailure(error);
        }
        throw error;
      }
    });
    try {
      await client.query(`UPDATE public.invoices SET stripe_checkout_session_id = $2,
        portal_token = COALESCE($3, portal_token), surcharge_amount = COALESCE($4, surcharge_amount)
        WHERE id = $1`, [invoiceId, session.id, update.portalToken ?? null, update.surchargeAmount ?? null]);
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id);
      throw error;
    }
    return session;
  });
}

export async function cancellationSafetyInstalled(pool: Pool): Promise<boolean> {
  const result = await pool.query("SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.invoices'::regclass AND tgname='protect_cancelled_invoice' AND tgenabled <> 'D') AS installed");
  return result.rows[0]?.installed === true;
}
