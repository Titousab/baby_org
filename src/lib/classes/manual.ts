import { and, eq } from 'drizzle-orm';
import { ageOverrides, manualClasses } from '@/db/schema';
import type { DB } from '@/db/types';
import { ValidationError } from '@/lib/errors';
import { addDays } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Repeat = { firstDate: string; repeatsWeekly: boolean; untilDate: string | null };

/** The days within [from, to] a hand-typed class happens on. */
export function expandManual(m: Repeat, from: string, to: string): string[] {
  if (!m.repeatsWeekly) return m.firstDate >= from && m.firstDate <= to ? [m.firstDate] : [];
  const days: string[] = [];
  let d = m.firstDate;
  while (d < from) d = addDays(d, 7);
  for (; d <= to; d = addDays(d, 7)) {
    if (m.untilDate && d > m.untilDate) break;
    days.push(d);
  }
  return days;
}

export type ManualClassInput = {
  id?: number;
  placeId: number;
  title: string;
  firstDate: string;
  startTime: string;
  durationMin: number;
  ageMin: number | null;
  ageMax: number | null;
  priceText: string | null;
  note: string | null;
  bookingUrl: string | null;
  repeatsWeekly: boolean;
  untilDate: string | null;
};

export async function saveManualClass(db: DB, input: ManualClassInput): Promise<number> {
  const title = input.title.trim();
  if (!title) throw new ValidationError('Add the class name.', 'title');
  if (!DATE.test(input.firstDate)) throw new ValidationError('Pick the first day.', 'firstDate');
  if (!TIME.test(input.startTime)) throw new ValidationError('Pick a start time.', 'startTime');
  if (!Number.isInteger(input.durationMin) || input.durationMin < 5 || input.durationMin > 480) {
    throw new ValidationError('Length should be between 5 minutes and 8 hours.', 'durationMin');
  }
  for (const [field, v] of [['ageMin', input.ageMin], ['ageMax', input.ageMax]] as const) {
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 216)) throw new ValidationError('Ages are in months, like 18.', field);
  }
  if (input.ageMin !== null && input.ageMax !== null && input.ageMax < input.ageMin) {
    throw new ValidationError('The oldest age has to be at least the youngest.', 'ageMax');
  }
  if (input.untilDate && (!DATE.test(input.untilDate) || input.untilDate < input.firstDate)) {
    throw new ValidationError('The last day has to be on or after the first day.', 'untilDate');
  }

  const values = {
    placeId: input.placeId,
    title,
    firstDate: input.firstDate,
    startTime: input.startTime,
    durationMin: input.durationMin,
    ageMin: input.ageMin,
    ageMax: input.ageMax,
    priceText: input.priceText?.trim() || null,
    note: input.note?.trim() || null,
    bookingUrl: input.bookingUrl?.trim() || null,
    repeatsWeekly: input.repeatsWeekly,
    untilDate: input.repeatsWeekly ? input.untilDate || null : null,
  };
  if (input.id) {
    await db.update(manualClasses).set(values).where(eq(manualClasses.id, input.id));
    return input.id;
  }
  const [row] = await db.insert(manualClasses).values(values).returning({ id: manualClasses.id });
  return row.id;
}

export async function deleteManualClass(db: DB, id: number): Promise<void> {
  await db.delete(manualClasses).where(eq(manualClasses.id, id));
}

export const titleKey = (title: string) => title.trim().toLowerCase();

/** A family member's ages for a class (by place and name), kept across syncs. */
export async function setAgeOverride(db: DB, placeId: number, title: string, min: number | null, max: number | null, userId: number) {
  if (min !== null && max !== null && max < min) throw new ValidationError('The oldest age has to be at least the youngest.', 'ageMax');
  const key = titleKey(title);
  await db
    .insert(ageOverrides)
    .values({ placeId, titleKey: key, ageMin: min, ageMax: max, updatedBy: userId })
    .onConflictDoUpdate({ target: [ageOverrides.placeId, ageOverrides.titleKey], set: { ageMin: min, ageMax: max, updatedBy: userId } });
}

export async function clearAgeOverride(db: DB, placeId: number, title: string) {
  await db.delete(ageOverrides).where(and(eq(ageOverrides.placeId, placeId), eq(ageOverrides.titleKey, titleKey(title))));
}
