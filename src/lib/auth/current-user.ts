import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '@/db/client';
import { assertFamily } from './permissions';
import { SESSION_COOKIE, type SessionUser, validateSession } from './session';

/** The signed-in person for this request, or null. Looked up once per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(await getDb(), token);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return user;
}

/** For family-only changes. Throws ForbiddenError for caretakers. */
export async function requireFamily(): Promise<SessionUser> {
  const user = await requireUser();
  assertFamily(user);
  return user;
}
