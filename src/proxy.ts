import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  if (process.env.RIVIO_MAINTENANCE === '1') {
    return new NextResponse('Rivio is briefly unavailable while we complete an upgrade. Please try again shortly.', {
      status: 503,
      headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const path = request.nextUrl.pathname;
  const protectedRoute = path.startsWith('/dashboard') || path.startsWith('/onboarding');
  if (!protectedRoute && path !== '/login' && path !== '/signup') return NextResponse.next();
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (protectedRoute && !session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  if (session && (path === '/login' || path === '/signup')) return NextResponse.redirect(new URL('/dashboard', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
