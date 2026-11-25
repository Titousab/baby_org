import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import type { DB } from '@/db/types';
import { fmtTime, minutesNowNY } from '@/lib/time';
import { hashPassword, normalizeEmail, verifyPassword } from './password';
import { clearFailures, loginLock, recordFailure } from './rate-limit';
import { createSession } from './session';

const NO_MATCH = "That email and password don't match.";

let dummyHash: Promise<string> | undefined;
/** Compared against when the email is unknown, so a wrong email takes as long as a wrong password. */
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

export async function signIn(
  db: DB,
  email: string,
  password: string,
  now: Date = new Date(),
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const key = normalizeEmail(email);

  const lockedUntil = await loginLock(db, key, now);
  if (lockedUntil) {
    return { ok: false, message: `Too many tries. Try again at ${fmtTime(minutesNowNY(lockedUntil))}.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, key));
  const matches = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || user.disabledAt || !matches) {
    await recordFailure(db, key, now);
    return { ok: false, message: NO_MATCH };
  }

  await clearFailures(db, key);
  return { ok: true, token: await createSession(db, user.id, now) };
}
