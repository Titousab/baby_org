import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { logNotes, logSlots, users } from '@/db/schema';
import type { DB } from '@/db/types';
import { ValidationError } from './errors';
import { toMin } from './time';

export const SLOTS = ['wake', 'breakfast', 'nap', 'lunch', 'snack', 'dinner'] as const;
export type SlotKey = (typeof SLOTS)[number];
export const MEAL_SLOTS: readonly SlotKey[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const AMOUNTS = ['All', 'Most', 'Some', 'A little', 'None'] as const;
export const NOTE_KINDS = ['Note', 'Health', 'Medicine', 'Diaper', 'Milestone'] as const;

export type SlotEntry = {
  slot: SlotKey;
  time: string;
  endTime: string | null;
  food: string | null;
  amount: string | null;
  byName: string;
};
export type NoteEntry = { id: number; time: string; kind: string; text: string; byName: string };
export type DayLog = { date: string; slots: Record<SlotKey, SlotEntry | null>; notes: NoteEntry[] };

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
    .select({
      slot: logSlots.slot,
      time: logSlots.time,
      endTime: logSlots.endTime,
      food: logSlots.food,
      amount: logSlots.amount,
      byName: users.name,
    })
    .from(logSlots)
    .innerJoin(users, eq(logSlots.updatedBy, users.id))
    .where(eq(logSlots.date, date));

  const slots = Object.fromEntries(SLOTS.map((s) => [s, null])) as Record<SlotKey, SlotEntry | null>;
  for (const row of slotRows) slots[row.slot as SlotKey] = { ...row, slot: row.slot as SlotKey };

  const notes = await db
    .select({ id: logNotes.id, time: logNotes.time, kind: logNotes.kind, text: logNotes.text, byName: users.name })
    .from(logNotes)
    .innerJoin(users, eq(logNotes.updatedBy, users.id))
    .where(eq(logNotes.date, date))
    .orderBy(asc(logNotes.time), asc(logNotes.id));

  return { date, slots, notes };
}

type SlotInput = { date: string; slot: SlotKey; time: string; endTime?: string; food?: string; amount?: string };

export async function saveSlot(db: DB, input: SlotInput, userId: number, today: string): Promise<void> {
  checkDate(input.date, today);
  if (!SLOTS.includes(input.slot)) throw new ValidationError('Pick what to log.', 'slot');
  const time = checkTime(input.time, 'time');

  let endTime: string | null = null;
  let food: string | null = null;
  let amount: string | null = null;

  if (input.slot === 'nap') {
    endTime = checkTime(input.endTime, 'endTime');
    if (toMin(endTime) <= toMin(time)) throw new ValidationError('The nap has to end after it starts.', 'endTime');
  } else if (MEAL_SLOTS.includes(input.slot)) {
    food = input.food?.trim() ?? '';
    if (!food) throw new ValidationError('Write what he ate, like "banana and yogurt".', 'food');
    if (input.amount) {
      if (!(AMOUNTS as readonly string[]).includes(input.amount)) throw new ValidationError('Pick how much he ate.', 'amount');
      amount = input.amount;
    }
  }

  const values = { time, endTime, food, amount, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(logSlots)
    .values({ date: input.date, slot: input.slot, ...values })
    .onConflictDoUpdate({ target: [logSlots.date, logSlots.slot], set: values });
}

export async function clearSlot(db: DB, date: string, slot: SlotKey): Promise<void> {
  await db.delete(logSlots).where(and(eq(logSlots.date, date), eq(logSlots.slot, slot)));
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
