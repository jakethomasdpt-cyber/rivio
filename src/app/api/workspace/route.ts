import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createServerSupabaseClient();
    const { data, error } = await db
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      business_name, owner_name, email, phone, address, city, state, zip,
      website, logo_url, brand_color, venmo_handle, zelle_phone,
      invoice_prefix, invoice_footer, tax_rate_default,
      card_surcharge_rate, surcharge_enabled, surcharge_label,
    } = body;

    const db = createServerSupabaseClient();
    const { data, error } = await db
      .from('workspaces')
      .update({
        business_name, owner_name, email, phone, address, city, state, zip,
        website, logo_url, brand_color, venmo_handle, zelle_phone,
        invoice_prefix, invoice_footer, tax_rate_default,
        card_surcharge_rate, surcharge_enabled, surcharge_label,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
