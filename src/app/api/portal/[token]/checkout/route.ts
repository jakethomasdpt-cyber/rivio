import { invoiceSurchargeCents, MAX_CHECKOUT_CENTS } from '@/lib/portalPaymentAmounts';
import { invoiceBranding, brandInvoiceItems } from '@/lib/integrationBranding';
import { createCheckoutForLockedInvoice, InvoicePaymentConflict } from '@/lib/invoicePaymentSafety';
import { getDatabasePool, createDatabaseClient } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Public Stripe checkout endpoint — authenticated by portal token, not user session.
 * Called by the client-facing payment portal (no login required).
 *
 * Supports:
 *  - Credit card surcharge (configurable per workspace)
 *  - Stripe Customer creation/reuse for saved payment methods
 *  - ACH with automatic bank account saving via Financial Connections
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: portalToken } = await params;
    if (process.env.VERCEL_ENV === 'preview' && process.env.RIVIO_PREVIEW_INVOICE) {
      return NextResponse.json({ error: 'Payment collection is disabled for this invoice preview.' }, { status: 409 });
    }
    const body = await request.json();
    const { payment_method } = body; // 'card' | 'ach' | 'wallet'

    const additionalCents = body.additional_payment_cents === undefined ? 0 : body.additional_payment_cents;
    if (!Number.isSafeInteger(additionalCents) || additionalCents < 0 || additionalCents > MAX_CHECKOUT_CENTS) {
      return NextResponse.json({ error: 'Additional payment must be a nonnegative amount in whole cents.' }, { status: 400 });
    }

    const dbClient = createDatabaseClient();

    // Look up invoice by portal token — no user session needed
    const { data: invoice, error: invoiceError } = await dbClient
      .from('invoices')
      .select('*, clients(id, name, email, stripe_customer_id)')
      .eq('portal_token', portalToken)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check token expiration
    if (invoice.portal_token_expires_at) {
      const expiresAt = new Date(invoice.portal_token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This invoice link has expired. Please contact your provider.' },
          { status: 410 }
        );
      }
    }

    // Must not already be paid or cancelled
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This invoice cannot be paid.' },
        { status: 400 }
      );
    }

    // Get line items
    const { data: lineItems } = await dbClient
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Invoice has no line items' },
        { status: 400 }
      );
    }

    // Get workspace settings for surcharge config
    const { data: rawWorkspace } = await dbClient
      .from('workspaces')
      .select('business_name, card_surcharge_rate, surcharge_enabled, surcharge_label')
      .eq('user_id', invoice.user_id)
      .single();
    const { workspace } = await invoiceBranding(dbClient, invoice, rawWorkspace);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Determine payment method types
    const useAch = payment_method === 'ach' && invoice.accept_ach === true;
    const useWallet = payment_method === 'wallet' && invoice.accept_wallet === true;
    const useCard = !useAch; // card or wallet both use 'card' type

    const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = useAch
      ? ['us_bank_account']
      : ['card'];

    const surchargeRate = Number(workspace?.card_surcharge_rate) || 0;
    const surchargeLabel = workspace?.surcharge_label || 'Processing fee';
    const balanceCents = Math.round(Number(invoice.total) * 100);
    const surchargeCents = useCard && workspace?.surcharge_enabled !== false && surchargeRate > 0
      ? invoiceSurchargeCents(Number(invoice.total), surchargeRate) : 0;
    const surchargeAmount = surchargeCents / 100;
    if (balanceCents + surchargeCents + additionalCents > MAX_CHECKOUT_CENTS) {
      return NextResponse.json({ error: 'The checkout total exceeds the maximum payment amount.' }, { status: 400 });
    }

    // ── Stripe Customer (get or create) ──────────────────────────────────
    // Reuse existing Stripe Customer for returning clients, or create one.
    // This enables saved payment methods for future invoices.
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    let stripeCustomerId = client?.stripe_customer_id || null;

    if (!stripeCustomerId && client) {
      // Create a new Stripe Customer
      const customer = await stripe.customers.create({
        name: client.name || undefined,
        email: client.email || undefined,
        metadata: {
          pt365_client_id: client.id,
          invoice_user_id: invoice.user_id,
        },
      });
      stripeCustomerId = customer.id;

      // Save Stripe Customer ID back to client record
      await dbClient
        .from('clients')
        .update({ stripe_customer_id: customer.id })
        .eq('id', client.id);
    }

    // ── Build Stripe line items ──────────────────────────────────────────
    const invoiceItems = brandInvoiceItems(invoice, workspace, lineItems).map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.service,
          description: item.provider ? `Provider: ${item.provider}` : undefined,
        },
        unit_amount: Math.round(Number(item.rate) * 100),
      },
      quantity: Number(item.quantity),
    }));

    // Taxes, discounts, or fractional quantities can make the stored balance
    // differ from Stripe's integer-quantity line items. Charge the displayed balance.
    const itemTotal = invoiceItems.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
    const canItemize = itemTotal === balanceCents && invoiceItems.every(item =>
      Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.price_data.unit_amount >= 0);
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = canItemize ? invoiceItems : [{
      price_data: { currency: 'usd', product_data: { name: 'Invoice balance' }, unit_amount: balanceCents },
      quantity: 1,
    }];

    if (surchargeAmount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: surchargeLabel,
            description: `${surchargeRate}% card processing fee`,
          },
          unit_amount: surchargeCents,
        },
        quantity: 1,
      });
    }

    if (additionalCents > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Additional payment (optional)' },
          unit_amount: additionalCents,
        },
        quantity: 1,
      });
    }

    const paymentMetadata = {
      invoice_id: invoice.id,
      portal_token: portalToken,
      surcharge_amount: String(surchargeAmount),
      additional_payment_cents: String(additionalCents),
    };
    // ── Create Stripe Checkout Session ───────────────────────────────────
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: paymentMethods,
      mode: 'payment',
      customer: stripeCustomerId || undefined,
      line_items: stripeLineItems,
      success_url: `${appUrl}/portal/${portalToken}?payment=success`,
      cancel_url: `${appUrl}/portal/${portalToken}`,
      metadata: { ...paymentMetadata, user_id: invoice.user_id },
      payment_intent_data: { metadata: paymentMetadata },
    };

    // ACH-specific options: save bank account for future use
    if (useAch) {
      sessionParams.payment_method_options = {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      };
    }

    const session = await createCheckoutForLockedInvoice(getDatabasePool(), stripe, invoice.id,
      { portalToken, total: invoice.total }, sessionParams, { surchargeAmount });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof InvoicePaymentConflict) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('POST /api/portal/[token]/checkout error:', err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
