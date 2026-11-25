import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { logNotes, logSlots, naps, users } from '@/db/schema';
import type { DB } from '@/db/types';
import { ValidationError } from './errors';
import { AMOUNTS, type DayLog, MEAL_SLOTS, NOTE_KINDS, type SlotEntry, type SlotKey, SLOTS } from './log-types';
import { toMin } from './time';

export * from './log-types';

const DEFAULT_FOODS = ['Banana', 'Yogurt', 'Oatmeal', 'Toast', 'Avocado', 'Berries', 'Cheese', 'Pasta', 'Chicken', 'Rice'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkTime(value: string | undefined, field: string): string {
  if (!value || !TIME.test(value)) throw new ValidationError('Pick a time.', field);
  return value;
}

function checkDate(date: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('Pick a day.', 'date');
  if (date > today) throw new ValidationError("You can't log a day that hasn't happened yet.", 'date');
}

export async function getDayLog(db: DB, date: string): Promise<DayLog> {
  const slotRows = await db
    .select({ slot: logSlots.slot, time: logSlots.time, food: logSlots.food, amount: logSlots.amount, byName: users.name })
    .from(logSlots)
    .innerJoin(users, eq(logSlots.updatedBy, users.id))
    .where(eq(logSlots.date, date));

  const slots = Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<SlotKey, SlotEntry | null>;
  for (const row of slotRows) {
    if ((SLOTS as readonly string[]).includes(row.slot)) slots[row.slot as SlotKey] = { ...row, slot: row.slot as SlotKey };
  }

  const napRows = await db
    .select({ id: naps.id, start: naps.startTime, end: naps.endTime, byName: users.name })
    .from(naps)
    .innerJoin(users, eq(naps.updatedBy, users.id))
    .where(eq(naps.date, date))
    .orderBy(asc(naps.startTime), asc(naps.id));

  const notes = await db
    .select({ id: logNotes.id, time: logNotes.time, kind: logNotes.kind, text: logNotes.text, byName: users.name })
    .from(logNotes)
    .innerJoin(users, eq(logNotes.updatedBy, users.id))
    .where(eq(logNotes.date, date))
    .orderBy(asc(logNotes.time), asc(logNotes.id));

  return { date, slots, naps: napRows, notes };
}

type SlotInput = { date: string; slot: SlotKey; time: string; food?: string; amount?: string };

export async function saveSlot(db: DB, input: SlotInput, userId: number, today: string): Promise<void> {
  checkDate(input.date, today);
  if (!SLOTS.includes(input.slot)) throw new ValidationError('Pick what to log.', 'slot');
  const time = checkTime(input.time, 'time');

  let food: string | null = null;
  let amount: string | null = null;
  if (MEAL_SLOTS.includes(input.slot)) {
    food = input.food?.trim() ?? '';
    if (!food) throw new ValidationError('Write what he ate, like "banana and yogurt".', 'food');
    if (input.amount) {
      if (!(AMOUNTS as readonly string[]).includes(input.amount)) throw new ValidationError('Pick how much he ate.', 'amount');
      amount = input.amount;
    }
  }

  const values = { time, food, amount, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(logSlots)
    .values({ date: input.date, slot: input.slot, ...values })
    .onConflictDoUpdate({ target: [logSlots.date, logSlots.slot], set: values });
}

export async function clearSlot(db: DB, date: string, slot: SlotKey): Promise<void> {
  await db.delete(logSlots).where(and(eq(logSlots.date, date), eq(logSlots.slot, slot)));
}

type NapInput = { id?: number; date: string; start: string; end: string };

/** Adds a nap, or changes one when `id` is given. A day can have as many naps as he takes. */
export async function saveNap(db: DB, input: NapInput, userId: number, today: string): Promise<void> {
  checkDate(input.date, today);
  const start = checkTime(input.start, 'start');
  const end = checkTime(input.end, 'end');
  if (toMin(end) <= toMin(start)) throw new ValidationError('The nap has to end after it starts.', 'end');

  if (input.id) {
    await db.update(naps).set({ startTime: start, endTime: end, updatedBy: userId, updatedAt: new Date() }).where(eq(naps.id, input.id));
  } else {
    await db.insert(naps).values({ date: input.date, startTime: start, endTime: end, createdBy: userId, updatedBy: userId });
  }
}

export async function deleteNap(db: DB, id: number): Promise<void> {
  await db.delete(naps).where(eq(naps.id, id));
}

type NoteInput = { id?: number; date: string; time: string; kind: string; text: string };

export async function saveNote(db: DB, input: NoteInput, userId: number, today: string): Promise<void> {
  checkDate(input.date, today);
  const time = checkTime(input.time, 'time');
  if (!(NOTE_KINDS as readonly string[]).includes(input.kind)) throw new ValidationError('Pick what kind of note this is.', 'kind');
  const text = input.text.trim();
  if (!text) throw new ValidationError('Add a few words so the others know what happened.', 'text');

  if (input.id) {
    await db
      .update(logNotes)
      .set({ time, kind: input.kind, text, updatedBy: userId, updatedAt: new Date() })
      .where(eq(logNotes.id, input.id));
  } else {
    await db.insert(logNotes).values({ date: input.date, time, kind: input.kind, text, createdBy: userId, updatedBy: userId });
  }
}

export async function deleteNote(db: DB, id: number): Promise<void> {
  await db.delete(logNotes).where(eq(logNotes.id, id));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Foods from the latest meals ("Pasta with peas and cheese" → Pasta, Peas, Cheese), padded with defaults. */
export async function recentFoods(db: DB, limit = 10): Promise<string[]> {
  const rows = await db
    .select({ food: logSlots.food })
    .from(logSlots)
    .where(inArray(logSlots.slot, [...MEAL_SLOTS]))
    .orderBy(desc(logSlots.date), desc(logSlots.updatedAt))
    .limit(30);

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (f: string) => {
    const key = f.toLowerCase();
    if (!f || seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push(f);
  };
  for (const { food } of rows) {
    for (const part of (food ?? '').split(/,|\band\b|\bwith\b/i)) add(capitalize(part.trim()));
  }
  for (const f of DEFAULT_FOODS) add(f);
  return out;
}
