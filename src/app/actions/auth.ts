'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { SESSION_COOKIE, SESSION_DAYS, deleteSession } from '@/lib/auth/session';
import { signIn } from '@/lib/auth/sign-in';
import type { ActionResult } from '@/lib/errors';

export async function signInAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  if (!email.trim() || !password) return { ok: false, message: 'Enter your email and password.' };

  const result = await signIn(await getDb(), email, password);
  if (!result.ok) return { ok: false, message: result.message };

  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  redirect('/');
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  store.delete(SESSION_COOKIE);
  redirect('/signin');
}
