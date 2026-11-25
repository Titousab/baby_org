import { eq, sql } from 'drizzle-orm';
import { loginAttempts } from '@/db/schema';
import type { DB } from '@/db/types';

export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

/** When the email is locked, the time the lock ends. Otherwise null. */
export async function loginLock(db: DB, email: string, now: Date): Promise<Date | null> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.email, email));
  return row?.lockedUntil && row.lockedUntil.getTime() > now.getTime() ? row.lockedUntil : null;
}

/** Counts a failed try. The fifth in a row locks the email and starts the count over. */
export async function recordFailure(db: DB, email: string, now: Date): Promise<void> {
  const [row] = await db
    .insert(loginAttempts)
    .values({ email, failures: 1 })
    .onConflictDoUpdate({ target: loginAttempts.email, set: { failures: sql`${loginAttempts.failures} + 1` } })
    .returning({ failures: loginAttempts.failures });
  if (row.failures >= MAX_FAILURES) {
    await db
      .update(loginAttempts)
      .set({ failures: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) })
      .where(eq(loginAttempts.email, email));
  }
}

export async function clearFailures(db: DB, email: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
}
