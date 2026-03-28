import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const supabase = createServerSupabaseClient();

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    const { data: timelineEvents } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      ...invoice,
      line_items: lineItems || [],
      timeline_events: timelineEvents || [],
    });
  } catch (err) {
    console.error('GET /api/invoices/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const body = await request.json();

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

    const updateData: Record<string, any> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.internal_notes !== undefined) updateData.internal_notes = body.internal_notes;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate;
    if (body.reminder_enabled !== undefined) updateData.reminder_enabled = body.reminder_enabled;

    updateData.updated_at = new Date().toISOString();

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateData)
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

    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    return NextResponse.json({
      ...invoice,
      line_items: lineItems || [],
    });
  } catch (err) {
    console.error('PUT /api/invoices/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const supabase = createServerSupabaseClient();

    // Check invoice status and ownership
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled invoices' },
        { status: 400 }
      );
    }

    // Delete line items first (due to foreign key)
    await supabase.from('line_items').delete().eq('invoice_id', invoiceId);

    // Delete timeline events
    await supabase
      .from('timeline_events')
      .delete()
      .eq('invoice_id', invoiceId);

    // Delete invoice
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete invoice' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/invoices/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
