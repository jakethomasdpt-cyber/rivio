import { getAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password || !body?.businessName) return NextResponse.json({ error: 'Email, password, and business name are required' }, { status: 400 });
  const url = new URL(request.url);
  url.pathname = '/api/auth/sign-up/email';
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return getAuth().handler(new Request(url, { method: 'POST', headers, body: JSON.stringify({ email: body.email, password: body.password, name: body.fullName || body.email, businessName: body.businessName }) }));
}
