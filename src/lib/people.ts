import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { schedulePeople, users } from '@/db/schema';
import type { DB } from '@/db/types';
import { hashPassword, normalizeEmail, verifyPassword } from './auth/password';
import { deleteUserSessions } from './auth/session';
import { PERSON_COLORS } from './colors';
import { ValidationError } from './errors';

export type Role = 'family' | 'caretaker';

export type PersonView = {
  personId: number;
  name: string;
  color: string;
  userId: number | null;
  email: string | null;
  role: Role | null;
  disabled: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const LAST_FAMILY = 'At least one person needs family access.';

function checkName(name: string): string {
  const n = name.trim();
  if (!n) throw new ValidationError('Add a name.', 'name');
  return n;
}

function checkPassword(password: string, field = 'password') {
  if (password.length < MIN_PASSWORD) throw new ValidationError('Use at least 8 characters.', field);
}

function checkColor(color: string) {
  if (!(PERSON_COLORS as readonly string[]).includes(color)) throw new ValidationError('Pick one of the colors.', 'color');
}

/** Each person's color by name, for the little dots next to "who saved this". */
export async function colorsByName(db: DB): Promise<Record<string, string>> {
  const rows = await db.select({ name: schedulePeople.name, color: schedulePeople.color }).from(schedulePeople);
  return Object.fromEntries(rows.map((r) => [r.name, r.color]));
}

async function leastUsedColor(db: DB): Promise<string> {
  const used = await db.select({ color: schedulePeople.color }).from(schedulePeople);
  const counts = PERSON_COLORS.map((c) => used.filter((u) => u.color === c).length);
  return PERSON_COLORS[counts.indexOf(Math.min(...counts))];
}

export async function listPeople(db: DB): Promise<PersonView[]> {
  const rows = await db
    .select({
      personId: schedulePeople.id,
      name: schedulePeople.name,
      color: schedulePeople.color,
      userId: users.id,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
    })
    .from(schedulePeople)
    .leftJoin(users, eq(schedulePeople.userId, users.id))
    .orderBy(asc(schedulePeople.id));
  return rows.map(({ disabledAt, ...r }) => ({ ...r, disabled: Boolean(disabledAt) }));
}

export async function createAccount(db: DB, input: { name: string; email: string; role: Role; password: string }): Promise<number> {
  const name = checkName(input.name);
  const email = normalizeEmail(input.email);
  if (!EMAIL.test(email)) throw new ValidationError('Enter an email like name@example.com.', 'email');
  if (input.role !== 'family' && input.role !== 'caretaker') throw new ValidationError('Pick what they can do.', 'role');
  checkPassword(input.password);

  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) throw new ValidationError('Someone already uses that email.', 'email');

  const passwordHash = await hashPassword(input.password);
  const color = await leastUsedColor(db);
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ name, email, passwordHash, role: input.role }).returning({ id: users.id });
    await tx.insert(schedulePeople).values({ name, color, userId: user.id });
    return user.id;
  });
}

/** Throws when `userId` is the last family member who can still sign in. */
async function keepOneFamily(db: DB, userId: number) {
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (target?.role !== 'family') return;
  const others = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'family'), isNull(users.disabledAt), ne(users.id, userId)));
  if (!others.length) throw new ValidationError(LAST_FAMILY, 'role');
}

export async function setRole(db: DB, userId: number, role: Role): Promise<void> {
  if (role !== 'family' && role !== 'caretaker') throw new ValidationError('Pick what they can do.', 'role');
  if (role === 'caretaker') await keepOneFamily(db, userId);
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function disableAccount(db: DB, userId: number): Promise<void> {
  await keepOneFamily(db, userId);
  await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, userId));
  await deleteUserSessions(db, userId);
}

export async function resetPassword(db: DB, userId: number, password: string): Promise<void> {
  checkPassword(password);
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  await deleteUserSessions(db, userId);
}

export async function changeOwnPassword(db: DB, userId: number, current: string, next: string): Promise<void> {
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new ValidationError("That's not your current password.", 'current');
  }
  checkPassword(next, 'next');
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
}

/** A name on the schedule without an account (a sitter, a daycare). */
export async function addSchedulePerson(db: DB, input: { name: string; color?: string }): Promise<number> {
  const name = checkName(input.name);
  const color = input.color ?? (await leastUsedColor(db));
  checkColor(color);
  const [row] = await db.insert(schedulePeople).values({ name, color }).returning({ id: schedulePeople.id });
  return row.id;
}

export async function updateSchedulePerson(db: DB, id: number, input: { name?: string; color?: string }): Promise<void> {
  const set: { name?: string; color?: string } = {};
  if (input.name !== undefined) set.name = checkName(input.name);
  if (input.color !== undefined) {
    checkColor(input.color);
    set.color = input.color;
  }
  if (!Object.keys(set).length) return;
  const [person] = await db.update(schedulePeople).set(set).where(eq(schedulePeople.id, id)).returning({ userId: schedulePeople.userId });
  if (person?.userId && set.name) await db.update(users).set({ name: set.name }).where(eq(users.id, person.userId));
}
