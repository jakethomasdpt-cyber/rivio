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

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabaseClient();

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        client_id,
        status,
        subtotal,
        tax_amount,
        total,
        created_at,
        due_date,
        sent_at,
        paid_date,
        viewed_at,
        notes,
        tax_rate,
        reminder_enabled,
        clients(name, email)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch invoices error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

    // Fetch line_items for each invoice
    const invoicesWithItems = await Promise.all(
      (invoices || []).map(async (invoice) => {
        const { data: lineItems } = await supabase
          .from('line_items')
          .select('*')
          .eq('invoice_id', invoice.id);

        return {
          ...invoice,
          line_items: lineItems || [],
        };
      })
    );

    return NextResponse.json(invoicesWithItems);
  } catch (err) {
    console.error('GET /api/invoices error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      client_id: rawClientId,
      client_name,
      client_email,
      line_items,
      tax_rate,
      due_date,
      notes,
      internal_notes,
      reminder_enabled,
      accept_credit_card,
      accept_venmo,
      accept_zelle,
      accept_ach,
    } = body;

    const supabase = createServerSupabaseClient();

    // Resolve client_id — auto-create client if name/email provided without saved client
    let client_id = rawClientId;

    if (!client_id) {
      const trimmedName = (client_name || '').trim();
      const trimmedEmail = (client_email || '').trim().toLowerCase();

      if (!trimmedName) {
        return NextResponse.json(
          { error: 'Client name is required' },
          { status: 400 }
        );
      }

      // Try to find existing client by email first
      if (trimmedEmail) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('email', trimmedEmail)
          .single();

        if (existing) {
          client_id = existing.id;
        }
      }

      // Create new client if still not found
      if (!client_id) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{ user_id: user.id, name: trimmedName, email: trimmedEmail || null }])
          .select()
          .single();

        if (clientError) {
          console.error('Auto-create client error:', clientError);
          return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
        }
        client_id = newClient.id;
      }
    }

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return NextResponse.json(
        { error: 'Line items are required' },
        { status: 400 }
      );
    }

    // Validate line item numerics — prevent NaN injection and overflow
    const MAX_RATE = 1_000_000;    // $1M max rate per unit
    const MAX_QTY = 10_000;        // 10k max quantity
    const MAX_ITEMS = 200;         // cap array size

    if (line_items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Too many line items (max ${MAX_ITEMS})` },
        { status: 400 }
      );
    }

    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      const rate = Number(item.rate);
      const qty = Number(item.quantity);

      if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) {
        return NextResponse.json(
          { error: `Line item ${i + 1}: rate must be a positive number up to $${MAX_RATE.toLocaleString()}` },
          { status: 400 }
        );
      }
      if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY || !Number.isInteger(qty)) {
        return NextResponse.json(
          { error: `Line item ${i + 1}: quantity must be a positive whole number up to ${MAX_QTY.toLocaleString()}` },
          { status: 400 }
        );
      }
      if (!item.service || typeof item.service !== 'string' || item.service.trim().length === 0) {
        return NextResponse.json(
          { error: `Line item ${i + 1}: service name is required` },
          { status: 400 }
        );
      }
      // Sanitize strings to reasonable length
      item.service = String(item.service).slice(0, 500);
      item.provider = item.provider ? String(item.provider).slice(0, 200) : '';
      item.rate = rate;
      item.quantity = qty;
    }

    // Validate tax_rate
    const parsedTaxRate = Number(tax_rate);
    if (tax_rate !== undefined && tax_rate !== null && (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 1)) {
      return NextResponse.json(
        { error: 'tax_rate must be a decimal between 0 and 1 (e.g. 0.08 for 8%)' },
        { status: 400 }
      );
    }

    // Verify client belongs to user (security check — even for auto-created clients)
    const { data: clientExists } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('user_id', user.id)
      .single();

    if (!clientExists) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Calculate subtotal and tax
    const subtotal = line_items.reduce((sum, item) => {
      return sum + item.rate * item.quantity;
    }, 0);

    const taxAmount = subtotal * (tax_rate || 0);
    const total = subtotal + taxAmount;

    // Generate unique invoice number
    let invoiceNumber = generateInvoiceNumber();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        invoiceNumber = generateInvoiceNumber();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'Failed to generate unique invoice number' },
        { status: 500 }
      );
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert([
        {
          invoice_number: invoiceNumber,
          client_id,
          user_id: user.id,
          status: 'draft',
          subtotal,
          tax_amount: taxAmount,
          total,
          tax_rate: tax_rate || 0,
          due_date,
          notes: notes || null,
          internal_notes: internal_notes || null,
          reminder_enabled: reminder_enabled || false,
          accept_credit_card: accept_credit_card !== false,
          accept_venmo: accept_venmo === true,
          accept_zelle: accept_zelle === true,
          accept_ach: accept_ach === true,
        },
      ])
      .select()
      .single();

    if (invoiceError) {
      console.error('Insert invoice error:', invoiceError);
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      );
    }

    // Insert line items
    const lineItemsToInsert = line_items.map((item) => ({
      invoice_id: invoice.id,
      service: item.service,
      provider: item.provider,
      rate: item.rate,
      quantity: item.quantity,
      service_date: item.service_date || null,
      amount: item.rate * item.quantity,
    }));

    const { error: lineItemsError } = await supabase
      .from('line_items')
      .insert(lineItemsToInsert);

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
        invoice_id: invoice.id,
        event_type: 'created',
        description: 'Invoice created',
        created_at: new Date().toISOString(),
      },
    ]);

    // Fetch line items and return full invoice
    const { data: fetchedLineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    return NextResponse.json(
      {
        ...invoice,
        line_items: fetchedLineItems || [],
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/invoices error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
