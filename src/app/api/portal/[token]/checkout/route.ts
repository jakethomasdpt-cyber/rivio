import { createServerSupabaseClient } from '@/lib/supabase';
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
    const body = await request.json();
    const { payment_method } = body; // 'card' | 'ach' | 'wallet'

    const supabase = createServerSupabaseClient();

    // Look up invoice by portal token — no user session needed
    const { data: invoice, error: invoiceError } = await supabase
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
    const { data: lineItems } = await supabase
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
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('card_surcharge_rate, surcharge_enabled, surcharge_label')
      .eq('user_id', invoice.user_id)
      .single();

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
      await supabase
        .from('clients')
        .update({ stripe_customer_id: customer.id })
        .eq('id', client.id);
    }

    // ── Build Stripe line items ──────────────────────────────────────────
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lineItems.map((item) => ({
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

    // ── Credit Card Surcharge ────────────────────────────────────────────
    // Only applied to card payments when surcharge is enabled
    let surchargeAmount = 0;
    const surchargeEnabled = workspace?.surcharge_enabled !== false;
    const surchargeRate = Number(workspace?.card_surcharge_rate) || 0;
    const surchargeLabel = workspace?.surcharge_label || 'Processing fee';

    if (useCard && surchargeEnabled && surchargeRate > 0) {
      surchargeAmount = Math.round(invoice.total * (surchargeRate / 100) * 100) / 100;

      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: surchargeLabel,
            description: `${surchargeRate}% card processing fee`,
          },
          unit_amount: Math.round(surchargeAmount * 100),
        },
        quantity: 1,
      });
    }

    // ── Create Stripe Checkout Session ───────────────────────────────────
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: paymentMethods,
      mode: 'payment',
      customer: stripeCustomerId || undefined,
      line_items: stripeLineItems,
      success_url: `${appUrl}/portal/${portalToken}?payment=success`,
      cancel_url: `${appUrl}/portal/${portalToken}`,
      metadata: {
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        portal_token: portalToken,
        surcharge_amount: String(surchargeAmount),
      },
    };

    // ACH-specific options: save bank account for future use
    if (useAch) {
      sessionParams.payment_method_options = {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      };
    }

    // For card payments: propagate invoice_id to PaymentIntent
    // (not compatible with setup_future_usage on ACH sessions)
    if (!useAch) {
      sessionParams.payment_intent_data = {
        metadata: {
          invoice_id: invoice.id,
          portal_token: portalToken,
          surcharge_amount: String(surchargeAmount),
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Save session ID + surcharge amount back to invoice
    const updatePayload: Record<string, any> = {
      stripe_checkout_session_id: session.id,
    };
    if (surchargeAmount > 0) {
      updatePayload.surcharge_amount = surchargeAmount;
    }

    await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', invoice.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('POST /api/portal/[token]/checkout error:', err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
