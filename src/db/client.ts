import { mkdirSync } from 'node:fs';
import { ensureOwner, ensurePresetPeople, ensureSettings } from '@/lib/bootstrap';
import { ensurePlaces } from '@/lib/classes/places-seed';
import { runMigrations } from './migrate';
import * as schema from './schema';
import type { DB } from './types';

declare global {
  var __ezraDb: Promise<DB> | undefined;
}

async function open(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const { createPool } = await import('./pool');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { attachDatabasePool } = await import('@vercel/functions');
    const pool = createPool(process.env.DATABASE_URL);
    // On Vercel, keeps the function alive just long enough to close idle connections cleanly.
    attachDatabasePool(pool);
    return drizzle(pool, { schema });
  }

  // Local development and e2e tests: an in-process Postgres, migrated and bootstrapped on first use.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dir = process.env.PGLITE_DIR ?? './.data/pglite';
  if (!dir.startsWith('memory://')) mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await runMigrations(db);
  await ensureSettings(db);
  await ensurePresetPeople(db);
  await ensurePlaces(db);
  await ensureOwner(db, {
    OWNER_NAME: process.env.OWNER_NAME,
    OWNER_EMAIL: process.env.OWNER_EMAIL,
    OWNER_PASSWORD: process.env.OWNER_PASSWORD,
  });
  return db;
}

/** One shared database handle per server process (survives dev hot reloads). */
export function getDb(): Promise<DB> {
  globalThis.__ezraDb ??= open();
  return globalThis.__ezraDb;
}
