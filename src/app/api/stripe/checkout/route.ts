import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Get invoice with line items
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoice_id);

    // Generate or use existing portal token
    let portalToken = invoice.portal_token;
    if (!portalToken) {
      portalToken = Buffer.from(`${invoice_id}-${Date.now()}`).toString(
        'base64'
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: (lineItems || []).map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.service,
            description: `Provider: ${item.provider}`,
          },
          unit_amount: Math.round(item.rate * 100),
        },
        quantity: item.quantity,
      })),
      success_url: `${appUrl}/portal/${portalToken}?payment=success`,
      cancel_url: `${appUrl}/portal/${portalToken}`,
      metadata: {
        invoice_id,
        user_id: user.id,
        portal_token: portalToken,
      },
    });

    // Update invoice with stripe session ID and portal token
    await supabase
      .from('invoices')
      .update({
        stripe_checkout_session_id: session.id,
        portal_token: portalToken,
      })
      .eq('id', invoice_id)
      .eq('user_id', user.id);

    return NextResponse.json({
      url: session.url,
    });
  } catch (err) {
    console.error('POST /api/stripe/checkout error:', err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
