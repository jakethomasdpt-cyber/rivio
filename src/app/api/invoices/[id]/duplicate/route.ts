import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

function generateInvoiceNumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const randomDigits = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `PT${yy}${mm}-${randomDigits}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

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
    const supabase = createServerSupabaseClient();

    // Get original invoice
    const { data: originalInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !originalInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (!lineItems) {
      return NextResponse.json(
        { error: 'Failed to fetch line items' },
        { status: 500 }
      );
    }

    // Generate unique invoice number
    let newInvoiceNumber = generateInvoiceNumber();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', newInvoiceNumber)
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        newInvoiceNumber = generateInvoiceNumber();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'Failed to generate unique invoice number' },
        { status: 500 }
      );
    }

    // Calculate new due date (today + 30 days)
    const newDueDate = addDays(new Date(), 30).toISOString().split('T')[0];

    // Create new invoice
    const { data: newInvoice, error: createError } = await supabase
      .from('invoices')
      .insert([
        {
          invoice_number: newInvoiceNumber,
          client_id: originalInvoice.client_id,
          user_id: user.id,
          status: 'draft',
          subtotal: originalInvoice.subtotal,
          tax_amount: originalInvoice.tax_amount,
          total: originalInvoice.total,
          tax_rate: originalInvoice.tax_rate,
          due_date: newDueDate,
          notes: originalInvoice.notes,
          internal_notes: originalInvoice.internal_notes,
          reminder_enabled: originalInvoice.reminder_enabled,
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Create invoice error:', createError);
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      );
    }

    // Insert line items for new invoice
    const newLineItems = lineItems.map((item) => ({
      invoice_id: newInvoice.id,
      service: item.service,
      provider: item.provider,
      rate: item.rate,
      quantity: item.quantity,
      service_date: item.service_date,
      amount: item.amount,
    }));

    const { error: lineItemsError } = await supabase
      .from('line_items')
      .insert(newLineItems);

    if (lineItemsError) {
      console.error('Insert line items error:', lineItemsError);
      return NextResponse.json(
        { error: 'Failed to create line items' },
        { status: 500 }
      );
    }

    // Create timeline event
    await supabase.from('timeline_events').insert([
      {
        invoice_id: newInvoice.id,
        event_type: 'created',
        description: 'Invoice created',
        created_at: new Date().toISOString(),
      },
    ]);

    // Fetch line items for response
    const { data: fetchedLineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', newInvoice.id);

    return NextResponse.json(
      {
        ...newInvoice,
        line_items: fetchedLineItems || [],
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/invoices/[id]/duplicate error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
