import path from 'node:path';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import type { DB } from './types';

export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

/** Apply the SQL migrations in /drizzle to either driver. */
export async function runMigrations(db: DB): Promise<void> {
  const client = (db as unknown as { $client?: unknown }).$client;
  const config = { migrationsFolder: MIGRATIONS_FOLDER };
  if (client instanceof Pool) {
    await migratePg(db as Parameters<typeof migratePg>[0], config);
  } else {
    await migratePglite(db as Parameters<typeof migratePglite>[0], config);
  }
}
