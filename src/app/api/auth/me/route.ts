import { createAuthServerClient, createServerSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createAuthServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminClient = createServerSupabaseClient();
    const { data: workspace } = await adminClient
      .from('workspaces')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ user, workspace });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
