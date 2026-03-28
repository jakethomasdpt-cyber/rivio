import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const body = await request.json();
    const { payment_method, paid_date } = body;

    if (!payment_method) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Verify invoice belongs to user
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const finalPaidDate = paid_date || now;

    // Update invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: finalPaidDate,
        payment_method,
        updated_at: now,
      })
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      );
    }

    // Create timeline event
    await supabase.from('timeline_events').insert([
      {
        invoice_id: invoiceId,
        event_type: 'paid',
        description: 'Invoice marked as paid',
        created_at: now,
      },
    ]);

    // Fetch line items for response
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    return NextResponse.json({
      ...invoice,
      line_items: lineItems || [],
    });
  } catch (err) {
    console.error('POST /api/invoices/[id]/mark-paid error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
