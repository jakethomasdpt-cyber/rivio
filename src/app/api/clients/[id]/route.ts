import { createAuthServerClient } from '@/lib/auth-server';
import { createDatabaseClient } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

async function getUser() {
  const dbClient = await createAuthServerClient();
  const { data: { user } } = await dbClient.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: clientId } = await params;
    const dbClient = createDatabaseClient();

    const { data: client, error: clientError } = await dbClient
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const { data: invoices } = await dbClient
      .from('invoices')
      .select('*')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      ...client,
      invoices: invoices || [],
    });
  } catch (err) {
    console.error('GET /api/clients/[id] error:', err);
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

    const { id: clientId } = await params;
    const body = await request.json();
    const { name, email, phone, address, city, state, zip, notes } = body;

    const dbClient = createDatabaseClient();

    // Verify client belongs to user
    const { data: existingClient } = await dbClient
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const { data: client, error } = await dbClient
      .from('clients')
      .update({
        name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update client' },
        { status: 500 }
      );
    }

    return NextResponse.json(client);
  } catch (err) {
    console.error('PUT /api/clients/[id] error:', err);
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

    const { id: clientId } = await params;
    const dbClient = createDatabaseClient();

    // Verify client belongs to user
    const { data: existingClient } = await dbClient
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single();

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Check for unpaid invoices
    const { data: unpaidInvoices } = await dbClient
      .from('invoices')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .neq('status', 'paid')
      .neq('status', 'cancelled');

    if (unpaidInvoices && unpaidInvoices.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete client with unpaid invoices' },
        { status: 400 }
      );
    }

    const { error } = await dbClient
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete client' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/clients/[id] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
