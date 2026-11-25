import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { sessions, users } from '@/db/schema';
import type { DB } from '@/db/types';

export type SessionUser = { id: number; name: string; email: string; role: 'family' | 'caretaker' };

import { SESSION_DAYS } from './cookie';

export { SESSION_COOKIE, SESSION_DAYS } from './cookie';

const DAY_MS = 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const expiryFrom = (now: Date) => new Date(now.getTime() + SESSION_DAYS * DAY_MS);

/** Starts a session and returns the raw token for the cookie. Only its hash is stored. */
export async function createSession(db: DB, userId: number, now: Date = new Date()): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: expiryFrom(now),
  });
  return token;
}

/** Returns the signed-in user, extending the session (at most once a day) while it is in use. */
export async function validateSession(db: DB, token: string, now: Date = new Date()): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)));

  if (!row || row.disabledAt || row.expiresAt.getTime() <= now.getTime()) return null;

  if (now.getTime() - row.lastUsedAt.getTime() >= DAY_MS) {
    await db.update(sessions).set({ lastUsedAt: now, expiresAt: expiryFrom(now) }).where(eq(sessions.id, row.sessionId));
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export async function deleteSession(db: DB, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function deleteUserSessions(db: DB, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
