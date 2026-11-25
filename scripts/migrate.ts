/**
 * Runs before `next build` on every deploy:
 * applies database migrations, makes sure settings and preset schedule names exist,
 * and creates the first family account from OWNER_* env vars if nobody exists yet.
 */
import { pathToFileURL } from 'node:url';
import { runMigrations } from '@/db/migrate';
import type { DB } from '@/db/types';
import { ensureOwner, ensurePresetPeople, ensureSettings } from '@/lib/bootstrap';

type Env = { [key: string]: string | undefined };

export async function migrateAndBootstrap(db: DB, env: Env): Promise<{ migrated: boolean; owner: 'created' | 'exists' | 'skipped' }> {
  await runMigrations(db);
  await ensureSettings(db);
  await ensurePresetPeople(db);
  const owner = await ensureOwner(db, { OWNER_NAME: env.OWNER_NAME, OWNER_EMAIL: env.OWNER_EMAIL, OWNER_PASSWORD: env.OWNER_PASSWORD });
  return { migrated: true, owner };
}

async function main() {
  const { DATABASE_URL, VERCEL_ENV } = process.env;
  if (!DATABASE_URL || (VERCEL_ENV && VERCEL_ENV !== 'production')) {
    console.log('Skipping migrations (no DATABASE_URL or preview build)');
    return;
  }
  const { createPool } = await import('@/db/pool');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const schema = await import('@/db/schema');
  const pool = createPool(DATABASE_URL);
  try {
    const result = await migrateAndBootstrap(drizzle(pool, { schema }), process.env);
    const ownerNote = {
      created: 'created the first account from OWNER_* settings',
      exists: 'accounts already exist',
      skipped: 'no accounts yet: set OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD',
    }[result.owner];
    console.log(`Database ready; ${ownerNote}.`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
