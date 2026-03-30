import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Public Stripe checkout endpoint — authenticated by portal token, not user session.
 * Called by the client-facing payment portal (no login required).
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
      .select('*')
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Determine payment method types
    const useAch = payment_method === 'ach' && invoice.accept_ach === true;
    const useWallet = payment_method === 'wallet' && invoice.accept_wallet === true;

    // Stripe Checkout automatically presents Apple Pay / Google Pay when 'card'
    // is included — no need to list them separately. For the wallet flow we use
    // the same 'card' method type but omit other options so the Stripe-hosted
    // page renders the wallet buttons prominently.
    const paymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = useAch
      ? ['us_bank_account']
      : ['card'];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethods,
      mode: 'payment',
      ...(useAch && {
        payment_method_options: {
          us_bank_account: {
            financial_connections: { permissions: ['payment_method'] },
          },
        },
      }),
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.service,
            description: item.provider ? `Provider: ${item.provider}` : undefined,
          },
          unit_amount: Math.round(Number(item.rate) * 100),
        },
        quantity: Number(item.quantity),
      })),
      success_url: `${appUrl}/portal/${portalToken}?payment=success`,
      cancel_url: `${appUrl}/portal/${portalToken}`,
      metadata: {
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        portal_token: portalToken,
      },
      // Propagate invoice_id to the PaymentIntent so payment_intent.succeeded
      // webhook can also look up and mark the invoice paid (needed for ACH).
      // Note: payment_intent_data is not compatible with setup_future_usage
      // on us_bank_account sessions, so we only include it for card payments.
      ...(!useAch && {
        payment_intent_data: {
          metadata: {
            invoice_id: invoice.id,
            portal_token: portalToken,
          },
        },
      }),
    });

    // Save session ID back to invoice
    await supabase
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
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
