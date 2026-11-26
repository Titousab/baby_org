import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { expect, test } from 'vitest';

const dir = path.join(process.cwd(), 'drizzle');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

async function apply(db: PGlite, file: string) {
  for (const stmt of readFileSync(path.join(dir, file), 'utf8').split('--> statement-breakpoint')) {
    if (stmt.trim()) await db.exec(stmt);
  }
}

test('a nap saved in the old single-slot format moves into the nap list', async () => {
  const db = new PGlite();
  const napsMigration = files.findIndex((f) => f.includes('multiple_naps'));
  expect(napsMigration).toBeGreaterThan(0);
  for (const f of files.slice(0, napsMigration)) await apply(db, f);

  await db.exec(`INSERT INTO users (name, email, password_hash, role) VALUES ('Mom', 'mom@example.com', 'x', 'family')`);
  await db.exec(`INSERT INTO log_slots (date, slot, time, end_time, updated_by) VALUES
    ('2026-11-24', 'nap', '12:40', '14:25', 1),
    ('2026-11-24', 'lunch', '11:50', NULL, 1)`);

  await apply(db, files[napsMigration]);

  const naps = await db.query<{ date: string; start_time: string; end_time: string; created_by: number }>(
    'SELECT to_char(date, \'YYYY-MM-DD\') AS date, start_time, end_time, created_by FROM naps',
  );
  expect(naps.rows).toEqual([{ date: '2026-11-24', start_time: '12:40', end_time: '14:25', created_by: 1 }]);
  const slots = await db.query<{ slot: string }>('SELECT slot FROM log_slots');
  expect(slots.rows.map((r) => r.slot)).toEqual(['lunch']);
});

test('a snack saved in the old once-a-day format moves into the snack list', async () => {
  const db = new PGlite();
  const snacksMigration = files.findIndex((f) => f.includes('multiple_snacks'));
  expect(snacksMigration).toBeGreaterThan(0);
  for (const f of files.slice(0, snacksMigration)) await apply(db, f);

  await db.exec(`INSERT INTO users (name, email, password_hash, role) VALUES ('Mom', 'mom@example.com', 'x', 'family')`);
  await db.exec(`INSERT INTO log_slots (date, slot, time, food, amount, updated_by) VALUES
    ('2026-11-24', 'snack', '15:10', 'Yogurt and banana', 'All', 1),
    ('2026-11-24', 'lunch', '11:50', 'Pasta', 'Most', 1)`);

  await apply(db, files[snacksMigration]);

  const snacks = await db.query<{ date: string; time: string; food: string; amount: string | null; created_by: number }>(
    "SELECT to_char(date, 'YYYY-MM-DD') AS date, time, food, amount, created_by FROM snacks",
  );
  expect(snacks.rows).toEqual([{ date: '2026-11-24', time: '15:10', food: 'Yogurt and banana', amount: 'All', created_by: 1 }]);
  const slots = await db.query<{ slot: string }>('SELECT slot FROM log_slots');
  expect(slots.rows.map((r) => r.slot)).toEqual(['lunch']);
});
