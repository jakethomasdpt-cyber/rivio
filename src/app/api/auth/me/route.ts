import { createAuthServerClient } from '@/lib/auth-server';
import { createDatabaseClient } from '@/lib/database';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbClient = await createAuthServerClient();
    const { data: { user }, error } = await dbClient.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminClient = createDatabaseClient();
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
