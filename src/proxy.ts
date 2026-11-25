import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';

/** Quick check only: no cookie means sign in. The session itself is validated on the server. */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!signin|manifest\\.webmanifest|icons/|apple-icon|icon|favicon\\.ico|_next/).*)'],
};
