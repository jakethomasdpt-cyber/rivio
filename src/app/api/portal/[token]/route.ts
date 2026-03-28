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

    return NextResponse.json({
      ...invoiceData,
      line_items: lineItems || [],
      workspace: workspace,
    });
  } catch (err) {
    console.error('GET /api/portal/[token] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
