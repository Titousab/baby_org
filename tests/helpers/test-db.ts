import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from '@/db/migrate';
import * as schema from '@/db/schema';
import type { DB } from '@/db/types';
import { hashPassword } from '@/lib/auth/password';

/** A fresh, fully migrated in-memory database for one test. */
export async function createTestDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await runMigrations(db);
  return db;
}

type SeedUser = { name?: string; email?: string; password?: string; role?: 'family' | 'caretaker'; color?: string };

/** Insert a user (and their schedule person) directly. Returns the user id. */
export async function seedUser(db: DB, u: SeedUser = {}): Promise<number> {
  const name = u.name ?? 'Dad';
  const [row] = await db
    .insert(schema.users)
    .values({
      name,
      email: (u.email ?? `${name.toLowerCase()}@example.com`).trim().toLowerCase(),
      passwordHash: await hashPassword(u.password ?? 'right-pass-1'),
      role: u.role ?? 'family',
    })
    .returning({ id: schema.users.id });
  await db.insert(schema.schedulePeople).values({ name, color: u.color ?? 'butter', userId: row.id });
  return row.id;
}
