import { describe, expect, test } from 'vitest';
import { users } from '@/db/schema';
import { createSession, validateSession } from '@/lib/auth/session';
import { signIn } from '@/lib/auth/sign-in';
import { ensurePresetPeople } from '@/lib/bootstrap';
import { getDayLog, saveSlot } from '@/lib/log';
import {
  addSchedulePerson,
  changeOwnPassword,
  createAccount,
  disableAccount,
  listPeople,
  resetPassword,
  restoreAccount,
  setRole,
  updateSchedulePerson,
} from '@/lib/people';
import { createTestDb, seedUser } from '../helpers/test-db';

const TODAY = '2026-11-25';

async function withOwner() {
  const db = await createTestDb();
  const dad = await seedUser(db, { name: 'Dad', email: 'dad@example.com', color: 'butter' });
  return { db, dad };
}

describe('accounts', () => {
  test('emails are stored normalized and must be unique', async () => {
    const { db } = await withOwner();
    await createAccount(db, { name: 'Mom', email: ' Mom@Example.com ', role: 'family', password: 'starter-pass-1' });
    const mom = (await db.select().from(users)).find((u) => u.name === 'Mom');
    expect(mom?.email).toBe('mom@example.com');
    await expect(
      createAccount(db, { name: 'Other', email: 'MOM@example.com', role: 'caretaker', password: 'starter-pass-1' }),
    ).rejects.toMatchObject({ name: 'ValidationError', field: 'email', message: 'Someone already uses that email.' });
  });

  test('names, emails and passwords are checked', async () => {
    const { db } = await withOwner();
    await expect(createAccount(db, { name: ' ', email: 'a@b.co', role: 'family', password: 'starter-pass-1' })).rejects.toMatchObject({ field: 'name' });
    await expect(createAccount(db, { name: 'A', email: 'nope', role: 'family', password: 'starter-pass-1' })).rejects.toMatchObject({ field: 'email' });
    await expect(createAccount(db, { name: 'A', email: 'a@b.co', role: 'family', password: 'short' })).rejects.toMatchObject({
      field: 'password',
      message: 'Use at least 8 characters.',
    });
  });

  test('new people get the least-used color', async () => {
    const { db } = await withOwner();
    await createAccount(db, { name: 'Mom', email: 'mom@example.com', role: 'family', password: 'starter-pass-1' });
    await createAccount(db, { name: 'Lauren', email: 'lauren@example.com', role: 'family', password: 'starter-pass-1' });
    await addSchedulePerson(db, { name: 'Sitter Ana' });
    const colors = Object.fromEntries((await listPeople(db)).map((p) => [p.name, p.color]));
    expect(colors).toEqual({ Dad: 'butter', Mom: 'peach', Lauren: 'lav', 'Sitter Ana': 'sky' });
  });

  test('someone always keeps family access', async () => {
    const { db, dad } = await withOwner();
    const msg = 'At least one person needs family access.';
    await expect(setRole(db, dad, 'caretaker')).rejects.toMatchObject({ message: msg });
    await expect(disableAccount(db, dad)).rejects.toMatchObject({ message: msg });
    const mom = await createAccount(db, { name: 'Mom', email: 'mom@example.com', role: 'family', password: 'starter-pass-1' });
    await setRole(db, dad, 'caretaker');
    await expect(setRole(db, mom, 'caretaker')).rejects.toMatchObject({ message: msg });
  });

  test('removing access signs them out but keeps their past entries', async () => {
    const { db } = await withOwner();
    const selina = await createAccount(db, { name: 'Selina', email: 'selina@example.com', role: 'caretaker', password: 'starter-pass-1' });
    await saveSlot(db, { date: TODAY, slot: 'wake', time: '06:45' }, selina, TODAY);
    const token = await createSession(db, selina);
    await disableAccount(db, selina);
    expect(await validateSession(db, token)).toBeNull();
    expect((await getDayLog(db, TODAY)).slots.wake?.byName).toBe('Selina');
    expect((await listPeople(db)).find((p) => p.name === 'Selina')?.disabled).toBe(true);
    expect((await signIn(db, 'selina@example.com', 'starter-pass-1')).ok).toBe(false);
  });
});

describe('giving access back', () => {
  test('a removed person can be let back in with their old password', async () => {
    const { db } = await withOwner();
    const selina = await createAccount(db, { name: 'Selina', email: 'selina@example.com', role: 'caretaker', password: 'starter-pass-1' });
    await disableAccount(db, selina);
    await restoreAccount(db, selina);
    expect((await listPeople(db)).find((p) => p.name === 'Selina')?.disabled).toBe(false);
    expect((await signIn(db, 'selina@example.com', 'starter-pass-1')).ok).toBe(true);
  });
});

describe('passwords', () => {
  test('changing your own password needs the current one', async () => {
    const { db, dad } = await withOwner();
    await expect(changeOwnPassword(db, dad, 'wrong-current', 'new-pass-123')).rejects.toMatchObject({
      field: 'current',
      message: "That's not your current password.",
    });
    await changeOwnPassword(db, dad, 'right-pass-1', 'new-pass-123');
    expect((await signIn(db, 'dad@example.com', 'new-pass-123')).ok).toBe(true);
  });

  test('a reset password works and the old one stops working', async () => {
    const { db } = await withOwner();
    const mom = await createAccount(db, { name: 'Mom', email: 'mom@example.com', role: 'family', password: 'starter-pass-1' });
    const token = await createSession(db, mom);
    await resetPassword(db, mom, 'fresh-pass-99');
    expect(await validateSession(db, token)).toBeNull();
    expect((await signIn(db, 'mom@example.com', 'starter-pass-1')).ok).toBe(false);
    expect((await signIn(db, 'mom@example.com', 'fresh-pass-99')).ok).toBe(true);
  });
});

describe('schedule people', () => {
  test('schedule-only names can be added and renamed; renaming an account renames the person too', async () => {
    const { db, dad } = await withOwner();
    const ana = await addSchedulePerson(db, { name: 'Sitter Ana', color: 'sage' });
    await updateSchedulePerson(db, ana, { name: 'Ana', color: 'peach' });
    const dadPerson = (await listPeople(db)).find((p) => p.userId === dad);
    await updateSchedulePerson(db, dadPerson!.personId, { name: 'Anthony' });

    const people = await listPeople(db);
    expect(people.find((p) => p.personId === ana)).toMatchObject({ name: 'Ana', color: 'peach', userId: null, email: null, role: null });
    expect(people.find((p) => p.userId === dad)).toMatchObject({ name: 'Anthony', email: 'dad@example.com', role: 'family' });
    await expect(addSchedulePerson(db, { name: '  ' })).rejects.toMatchObject({ field: 'name' });
    await expect(addSchedulePerson(db, { name: 'X', color: 'neon' })).rejects.toMatchObject({ field: 'color' });
  });

  test("renaming Juju's House does not bring the preset back on the next deploy", async () => {
    const { db } = await withOwner();
    await ensurePresetPeople(db);
    const juju = (await listPeople(db)).find((p) => p.name === "Juju's House");
    await updateSchedulePerson(db, juju!.personId, { name: 'Juju daycare' });
    await ensurePresetPeople(db);
    const names = (await listPeople(db)).map((p) => p.name);
    expect(names.filter((n) => n.startsWith('Juju'))).toEqual(['Juju daycare']);
  });

  test("Juju's House is preset once", async () => {
    const { db } = await withOwner();
    await ensurePresetPeople(db);
    await ensurePresetPeople(db);
    const juju = (await listPeople(db)).filter((p) => p.name === "Juju's House");
    expect(juju).toHaveLength(1);
    expect(juju[0].userId).toBeNull();
  });
});
