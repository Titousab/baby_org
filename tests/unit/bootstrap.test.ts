import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { schedulePeople, settings, users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { ensureOwner, ensureSettings } from '@/lib/bootstrap';
import { createTestDb } from '../helpers/test-db';

const OWNER = { OWNER_NAME: 'Dad', OWNER_EMAIL: ' Dad@Example.com ', OWNER_PASSWORD: 'first-pass-123' };

describe('ensureSettings', () => {
  test('creates exactly one settings row with the default coverage window', async () => {
    const db = await createTestDb();
    await ensureSettings(db);
    await ensureSettings(db);
    const rows = await db.select().from(settings);
    expect(rows).toHaveLength(1);
    expect(rows[0].coverageDays).toEqual([1, 2, 3, 4, 5]);
    expect(rows[0].coverageStart).toBe('08:00');
    expect(rows[0].coverageEnd).toBe('18:30');
    expect(rows[0].ezraBirthdate).toBeNull();
  });
});

describe('ensureOwner', () => {
  test('creates the first family account from env, with a normalized email and a schedule person', async () => {
    const db = await createTestDb();
    expect(await ensureOwner(db, OWNER)).toBe('created');

    const [owner] = await db.select().from(users);
    expect(owner.name).toBe('Dad');
    expect(owner.email).toBe('dad@example.com');
    expect(owner.role).toBe('family');
    expect(await verifyPassword('first-pass-123', owner.passwordHash)).toBe(true);
    expect(await verifyPassword('wrong', owner.passwordHash)).toBe(false);

    const [person] = await db.select().from(schedulePeople).where(eq(schedulePeople.userId, owner.id));
    expect(person.name).toBe('Dad');
    expect(person.color).toBe('butter');
  });

  test('does nothing once someone exists', async () => {
    const db = await createTestDb();
    await ensureOwner(db, OWNER);
    expect(await ensureOwner(db, { ...OWNER, OWNER_EMAIL: 'other@example.com' })).toBe('exists');
    expect(await db.select().from(users)).toHaveLength(1);
  });

  test('skips when any owner value is missing', async () => {
    const db = await createTestDb();
    expect(await ensureOwner(db, { OWNER_NAME: 'Dad', OWNER_EMAIL: 'dad@example.com' })).toBe('skipped');
    expect(await db.select().from(users)).toHaveLength(0);
  });
});
