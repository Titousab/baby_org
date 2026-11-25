import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/cookie';

/**
 * Quick check only: no cookie means sign in. The session itself is validated on the server.
 * Opening a page also renews the cookie, so regular use keeps people signed in (365 days, rolling).
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL('/signin', request.url));

  const response = NextResponse.next();
  // Only on page loads: a form submission may be signing out and clearing this cookie.
  if (request.method === 'GET') response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: ['/((?!signin|manifest\\.webmanifest|icons/|apple-icon|icon|favicon\\.ico|_next/).*)'],
};
