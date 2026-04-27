import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

async function getUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * GET /api/services
 *
 * Returns distinct services previously used in line items, with the most
 * recent rate, provider, and description for each service name.
 * Used for autocomplete when creating new invoices.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServerSupabaseClient();

    // Get all line items for this user's invoices, ordered by most recent first
    const { data: lineItems, error } = await supabase
      .from('line_items')
      .select(`
        service,
        rate,
        quantity,
        provider,
        description,
        created_at,
        invoice_id,
        invoices!inner(user_id, clients(name))
      `)
      .eq('invoices.user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch services error:', error);
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    // Deduplicate by service name (case-insensitive), keeping the most recent entry
    const serviceMap = new Map<string, {
      service: string;
      rate: number;
      quantity: number;
      provider: string;
      description: string | null;
      client_name: string | null;
      used_count: number;
      last_used: string;
    }>();

    for (const item of lineItems || []) {
      const key = item.service.toLowerCase().trim();
      const invoice = item.invoices as any;
      const clientData = invoice?.clients;
      const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

      if (serviceMap.has(key)) {
        // Increment count
        const existing = serviceMap.get(key)!;
        existing.used_count += 1;
      } else {
        serviceMap.set(key, {
          service: item.service,
          rate: Number(item.rate),
          quantity: Number(item.quantity),
          provider: item.provider || '',
          description: item.description || null,
          client_name: clientName || null,
          used_count: 1,
          last_used: item.created_at,
        });
      }
    }

    // Convert to array and sort by use count (most used first)
    const services = Array.from(serviceMap.values())
      .sort((a, b) => b.used_count - a.used_count);

    return NextResponse.json(services);
  } catch (err) {
    console.error('GET /api/services error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
