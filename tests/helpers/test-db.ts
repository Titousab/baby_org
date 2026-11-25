import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from '@/db/migrate';
import * as schema from '@/db/schema';
import type { DB } from '@/db/types';

/** A fresh, fully migrated in-memory database for one test. */
export async function createTestDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await runMigrations(db);
  return db;
}
