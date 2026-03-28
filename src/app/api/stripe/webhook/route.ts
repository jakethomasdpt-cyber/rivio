import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Guard: reject immediately if webhook secret is not configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'your_webhook_secret') {
      console.error('STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia' as const,
    });

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        Buffer.from(body),
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const invoiceId = session.metadata?.invoice_id;
      if (!invoiceId) {
        console.error('No invoice_id in webhook metadata');
        return NextResponse.json({ received: true });
      }

      const supabase = createServerSupabaseClient();
      const now = new Date().toISOString();

      // Update invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: now,
          payment_method: 'stripe',
          stripe_payment_intent_id: session.payment_intent as string,
          updated_at: now,
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Update invoice error:', updateError);
        return NextResponse.json({ received: true });
      }

      // Create timeline event
      const { error: timelineError } = await supabase
        .from('timeline_events')
        .insert([
          {
            invoice_id: invoiceId,
            event_type: 'paid',
            description: 'Invoice marked as paid',
            created_at: now,
          },
        ]);

      if (timelineError) {
        console.error('Create timeline event error:', timelineError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('POST /api/stripe/webhook error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
