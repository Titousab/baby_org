import { expect, test } from 'vitest';
import { createPool, poolConfig } from '@/db/pool';

test('a hosted database (like Railway) is reached over an encrypted connection', () => {
  const config = poolConfig('postgresql://postgres:secret@monorail.proxy.rlwy.net:41234/railway');
  expect(config.ssl).toEqual({ rejectUnauthorized: false });
  expect(config.connectionString).toBe('postgresql://postgres:secret@monorail.proxy.rlwy.net:41234/railway');
});

test('an address that names its own sslmode is left to decide', () => {
  expect(poolConfig('postgresql://u:p@db.example.com/app?sslmode=disable').ssl).toBeUndefined();
  expect(poolConfig('postgresql://u:p@db.example.com/app?sslmode=require').ssl).toBeUndefined();
});

test('a database on this computer needs no encryption', () => {
  expect(poolConfig('postgresql://u:p@localhost:5432/app').ssl).toBeUndefined();
  expect(poolConfig('postgresql://u:p@127.0.0.1:5432/app').ssl).toBeUndefined();
});

test('a dropped connection is logged instead of crashing the server', async () => {
  const pool = createPool('postgresql://u:p@localhost:1/none');
  expect(pool.listenerCount('error')).toBeGreaterThan(0);
  expect(() => pool.emit('error', new Error('Connection terminated unexpectedly'))).not.toThrow();
  await pool.end();
});
