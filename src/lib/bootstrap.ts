import { eq } from 'drizzle-orm';
import { schedulePeople, settings, users } from '@/db/schema';
import type { DB } from '@/db/types';
import { hashPassword, normalizeEmail } from './auth/password';
import { PERSON_COLORS } from './colors';

export { PERSON_COLORS } from './colors';

/** Names that should be on the schedule from day one: Ezra's daycare (starting the week of Nov 30, 2026). */
export const PRESET_PEOPLE = [{ name: "Juju's House", color: 'sage' }] as const;

export async function ensureSettings(db: DB): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
}

/** Adds the preset names the first time only; after that the family is free to rename them. */
export async function ensurePresetPeople(db: DB): Promise<void> {
  await ensureSettings(db);
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ seeded: settings.presetsSeeded }).from(settings).where(eq(settings.id, 1));
    if (row?.seeded) return;
    for (const p of PRESET_PEOPLE) {
      const [existing] = await tx.select({ id: schedulePeople.id }).from(schedulePeople).where(eq(schedulePeople.name, p.name));
      if (!existing) await tx.insert(schedulePeople).values({ name: p.name, color: p.color });
    }
    await tx.update(settings).set({ presetsSeeded: true }).where(eq(settings.id, 1));
  });
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
