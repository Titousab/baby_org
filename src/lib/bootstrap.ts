import { schedulePeople, settings, users } from '@/db/schema';
import type { DB } from '@/db/types';
import { hashPassword, normalizeEmail } from './auth/password';

export const PERSON_COLORS = ['butter', 'peach', 'lav', 'sky', 'sage'] as const;

export async function ensureSettings(db: DB): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
}

type OwnerEnv = { OWNER_NAME?: string; OWNER_EMAIL?: string; OWNER_PASSWORD?: string };

/** Creates the very first family account from env, only when nobody exists yet. */
export async function ensureOwner(db: DB, env: OwnerEnv): Promise<'created' | 'exists' | 'skipped'> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) return 'exists';

  const name = env.OWNER_NAME?.trim();
  const email = env.OWNER_EMAIL?.trim();
  const password = env.OWNER_PASSWORD;
  if (!name || !email || !password) return 'skipped';

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(users)
      .values({ name, email: normalizeEmail(email), passwordHash, role: 'family' })
      .returning({ id: users.id });
    await tx.insert(schedulePeople).values({ name, color: PERSON_COLORS[0], userId: owner.id });
  });
  return 'created';
}
