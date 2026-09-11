import { getAuth } from '@/lib/auth';
import { NextRequest } from 'next/server';
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = '/api/auth/sign-in/email';
  return getAuth().handler(new Request(url, { method: 'POST', headers: request.headers, body: await request.text() || '{}' }));
}
