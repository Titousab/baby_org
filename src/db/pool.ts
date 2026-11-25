import { Pool, type PoolConfig } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Connection settings for the production database (Railway Postgres).
 * Hosted databases are reached over an encrypted connection. Railway uses its own certificate,
 * so the connection is encrypted without checking the certificate against public authorities.
 * An address that sets `sslmode` itself (e.g. `?sslmode=disable`) decides for itself.
 */
export function poolConfig(url: string): PoolConfig {
  const config: PoolConfig = { connectionString: url, max: 5, idleTimeoutMillis: 30_000 };
  const host = new URL(url).hostname;
  if (/[?&]sslmode=/.test(url) || LOCAL_HOSTS.has(host)) return config;
  return { ...config, ssl: { rejectUnauthorized: false } };
}

/** A pool whose dropped idle connections are logged and replaced, instead of crashing the server. */
export function createPool(url: string): Pool {
  const pool = new Pool(poolConfig(url));
  pool.on('error', (err) => console.error('Database connection dropped; it will reconnect on the next request.', err.message));
  return pool;
}
