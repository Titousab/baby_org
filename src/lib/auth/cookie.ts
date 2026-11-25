/** Kept dependency-free so the route guard can import it. */
export const SESSION_COOKIE = 'ezra_session';
export const SESSION_DAYS = 365;

/** The session cookie's settings, used at sign-in and each time the app is opened. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
