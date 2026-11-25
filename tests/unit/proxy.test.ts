import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';
import { proxy } from '@/proxy';

test('opening the app with a session cookie pushes the cookie out another 365 days', () => {
  const res = proxy(new NextRequest('http://localhost/', { headers: { cookie: 'ezra_session=abc123' } }));
  const cookie = res.cookies.get('ezra_session');
  expect(cookie?.value).toBe('abc123');
  expect(cookie?.maxAge).toBe(365 * 24 * 60 * 60);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('lax');
  expect(cookie?.path).toBe('/');
});

test('form submissions are not touched, so signing out can clear the cookie', () => {
  const res = proxy(new NextRequest('http://localhost/', { method: 'POST', headers: { cookie: 'ezra_session=abc123' } }));
  expect(res.cookies.get('ezra_session')).toBeUndefined();
});

test('without a cookie, visitors go to sign in', () => {
  const res = proxy(new NextRequest('http://localhost/calendar'));
  expect(res.status).toBe(307);
  expect(res.headers.get('location')).toBe('http://localhost/signin');
});
