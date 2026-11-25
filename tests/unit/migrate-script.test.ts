import { expect, test } from 'vitest';
import { manualClasses, places, schedulePeople, settings, users } from '@/db/schema';
import { migrateAndBootstrap } from '../../scripts/migrate';
import { createTestDb } from '../helpers/test-db';

const env = { OWNER_NAME: 'Dad', OWNER_EMAIL: 'dad@example.com', OWNER_PASSWORD: 'first-pass-123' };

test('the deploy step migrates, adds settings and presets, and creates the owner once', async () => {
  const db = await createTestDb();
  expect(await migrateAndBootstrap(db, env)).toEqual({ migrated: true, owner: 'created' });
  expect(await migrateAndBootstrap(db, env)).toEqual({ migrated: true, owner: 'exists' });

  expect(await db.select().from(users)).toHaveLength(1);
  expect(await db.select().from(settings)).toHaveLength(1);
  expect((await db.select().from(schedulePeople)).map((p) => p.name).sort()).toEqual(['Dad', "Juju's House"]);
  expect(await db.select().from(places)).toHaveLength(7);
  expect(await db.select().from(manualClasses)).toHaveLength(13);
});
