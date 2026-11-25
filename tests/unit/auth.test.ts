import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { loginAttempts, sessions, users } from '@/db/schema';
import { assertFamily, isFamily } from '@/lib/auth/permissions';
import { createSession, validateSession } from '@/lib/auth/session';
import { signIn } from '@/lib/auth/sign-in';
import { ForbiddenError } from '@/lib/errors';
import { createTestDb, seedUser } from '../helpers/test-db';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-25T20:30:00Z'); // 3:30 pm in New York
const at = (ms: number) => new Date(NOW.getTime() + ms);

describe('sessions', () => {
  test('a new session validates to its user and only the token hash is stored', async () => {
    const db = await createTestDb();
    const id = await seedUser(db, { name: 'Mom', email: 'mom@example.com' });
    const token = await createSession(db, id, NOW);

    expect(await validateSession(db, token, NOW)).toEqual({ id, name: 'Mom', email: 'mom@example.com', role: 'family' });
    const [row] = await db.select().from(sessions);
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.tokenHash).not.toBe(token);
  });

  test('an unused session expires after 365 days', async () => {
    const db = await createTestDb();
    const token = await createSession(db, await seedUser(db), NOW);
    expect(await validateSession(db, token, at(366 * DAY))).toBeNull();
  });

  test('using a session pushes its expiry out again, at most once a day', async () => {
    const db = await createTestDb();
    const token = await createSession(db, await seedUser(db), NOW);

    await validateSession(db, token, at(2 * DAY));
    const [afterUse] = await db.select().from(sessions);
    expect(afterUse.expiresAt.getTime()).toBe(at(2 * DAY + 365 * DAY).getTime());

    await validateSession(db, token, at(2 * DAY + 60 * 60 * 1000));
    const [sameDay] = await db.select().from(sessions);
    expect(sameDay.expiresAt.getTime()).toBe(afterUse.expiresAt.getTime());
  });

  test('a disabled account has no valid sessions', async () => {
    const db = await createTestDb();
    const id = await seedUser(db);
    const token = await createSession(db, id, NOW);
    await db.update(users).set({ disabledAt: NOW }).where(eq(users.id, id));
    expect(await validateSession(db, token, NOW)).toBeNull();
  });

  test('an unknown token is rejected', async () => {
    const db = await createTestDb();
    expect(await validateSession(db, 'nope', NOW)).toBeNull();
  });
});

describe('signIn', () => {
  test('email is matched trimmed and case-insensitively', async () => {
    const db = await createTestDb();
    const id = await seedUser(db, { email: 'dad@example.com' });
    const result = await signIn(db, ' DAD@example.com ', 'right-pass-1', NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect((await validateSession(db, result.token, NOW))?.id).toBe(id);
  });

  test('a wrong password gets a plain message', async () => {
    const db = await createTestDb();
    await seedUser(db);
    expect(await signIn(db, 'dad@example.com', 'wrong', NOW)).toEqual({
      ok: false,
      message: "That email and password don't match.",
    });
  });

  test('five wrong tries lock the email for 15 minutes, even against the right password', async () => {
    const db = await createTestDb();
    await seedUser(db);
    for (let i = 0; i < 5; i++) await signIn(db, 'dad@example.com', 'wrong', NOW);

    expect(await signIn(db, 'Dad@Example.com', 'right-pass-1', at(60 * 1000))).toEqual({
      ok: false,
      message: 'Too many tries. Try again at 3:45 pm.',
    });

    const later = await signIn(db, 'dad@example.com', 'right-pass-1', at(16 * 60 * 1000));
    expect(later.ok).toBe(true);
    const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.email, 'dad@example.com'));
    expect(rows.every((r) => r.failures === 0)).toBe(true);
  });

  test('unknown emails get the same message and count toward a lock', async () => {
    const db = await createTestDb();
    const first = await signIn(db, 'ghost@example.com', 'whatever', NOW);
    expect(first).toEqual({ ok: false, message: "That email and password don't match." });
    for (let i = 0; i < 4; i++) await signIn(db, 'ghost@example.com', 'whatever', NOW);
    const locked = await signIn(db, 'ghost@example.com', 'whatever', at(1000));
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.message).toMatch(/^Too many tries\. Try again at /);
  });
});

describe('permissions', () => {
  const family = { id: 1, name: 'Dad', email: 'dad@example.com', role: 'family' as const };
  const caretaker = { id: 2, name: 'Selina', email: 'selina@example.com', role: 'caretaker' as const };

  test('family can change things, caretakers cannot', () => {
    expect(isFamily(family)).toBe(true);
    expect(isFamily(caretaker)).toBe(false);
    expect(() => assertFamily(family)).not.toThrow();
    expect(() => assertFamily(caretaker)).toThrow(ForbiddenError);
    expect(() => assertFamily(caretaker)).toThrow('Only family members can change this.');
  });
});
