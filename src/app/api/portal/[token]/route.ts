import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: portalToken } = await params;
    const supabase = createServerSupabaseClient();

    // Get invoice by portal token
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, clients(name, email, phone, address, city, state, zip)')
      .eq('portal_token', portalToken)
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check portal token expiration
    if (invoice.portal_token_expires_at) {
      const expiresAt = new Date(invoice.portal_token_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This invoice link has expired. Please contact your provider for a new link.' },
          { status: 410 }
        );
      }
    }

    // Get workspace for the invoice's user
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single();

    // Get line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    const now = new Date().toISOString();

    // Update status to viewed if sent
    if (invoice.status === 'sent') {
      await supabase
        .from('invoices')
        .update({
          status: 'viewed',
          viewed_at: now,
        })
        .eq('id', invoice.id);

      // Create timeline event
      await supabase.from('timeline_events').insert([
        {
          invoice_id: invoice.id,
          event_type: 'viewed',
          description: 'Client viewed invoice',
          created_at: now,
        },
      ]);
    }

    // Remove internal_notes from response
    const { internal_notes, ...invoiceData } = invoice;

    // Compute surcharge info for the portal UI
    const surchargeEnabled = workspace?.surcharge_enabled !== false;
    const surchargeRate = Number(workspace?.card_surcharge_rate) || 0;
    const surchargeLabel = workspace?.surcharge_label || 'Processing fee';
    const surchargeAmount = surchargeEnabled && surchargeRate > 0
      ? Math.round(invoice.total * (surchargeRate / 100) * 100) / 100
      : 0;

    // Get client's Stripe Customer ID to check for saved payment methods
    const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
    let savedPaymentMethods: { id: string; type: string; last4?: string; bank_name?: string }[] = [];

    if (client?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2026-03-25.dahlia' as any,
        });

        const methods = await stripe.paymentMethods.list({
          customer: client.stripe_customer_id,
          type: 'us_bank_account',
        });

        savedPaymentMethods = methods.data.map((pm) => ({
          id: pm.id,
          type: 'us_bank_account',
          last4: pm.us_bank_account?.last4 || undefined,
          bank_name: pm.us_bank_account?.bank_name || undefined,
        }));
      } catch (stripeErr) {
        console.error('Error fetching saved payment methods:', stripeErr);
      }
    }

    return NextResponse.json({
      ...invoiceData,
      line_items: lineItems || [],
      workspace: workspace,
      surcharge: {
        enabled: surchargeEnabled && surchargeRate > 0,
        rate: surchargeRate,
        label: surchargeLabel,
        amount: surchargeAmount,
      },
      saved_payment_methods: savedPaymentMethods,
    });
  } catch (err) {
    console.error('GET /api/portal/[token] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
