import type { PgDatabase } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/** A Drizzle database over our schema: node-postgres in production, PGlite in dev and tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = PgDatabase<any, typeof schema>;
