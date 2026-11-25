import { asc, between, eq, inArray } from 'drizzle-orm';
import { daysOff, schedulePeople, shifts } from '@/db/schema';
import type { DB } from '@/db/types';
import { ValidationError } from '@/lib/errors';
import { addDays } from '@/lib/time';
import type { ShiftView } from './coverage';

export type WeekView = { weekStart: string; days: Array<{ date: string; shifts: ShiftView[]; dayOff: string | null }> };
export type ShiftInput = { date: string; personId: number; start: string; end: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftColumns = {
  id: shifts.id,
  date: shifts.date,
  personId: shifts.personId,
  personName: schedulePeople.name,
  color: schedulePeople.color,
  start: shifts.startTime,
  end: shifts.endTime,
};

function check(input: ShiftInput) {
  if (!DATE.test(input.date)) throw new ValidationError('Pick a day.', 'date');
  if (!Number.isInteger(input.personId) || input.personId <= 0) throw new ValidationError('Pick who is covering this shift.', 'who');
  if (!TIME.test(input.start)) throw new ValidationError('Pick a start time.', 'start');
  if (!TIME.test(input.end)) throw new ValidationError('Pick an end time.', 'end');
  if (input.end <= input.start) throw new ValidationError('The end time needs to be after the start time.', 'end');
}

export async function listSchedulePeople(db: DB): Promise<Array<{ id: number; name: string; color: string }>> {
  return db
    .select({ id: schedulePeople.id, name: schedulePeople.name, color: schedulePeople.color })
    .from(schedulePeople)
    .orderBy(asc(schedulePeople.id));
}

export async function getWeek(db: DB, weekStart: string): Promise<WeekView> {
  const weekEnd = addDays(weekStart, 6);
  const rows = await db
    .select(shiftColumns)
    .from(shifts)
    .innerJoin(schedulePeople, eq(shifts.personId, schedulePeople.id))
    .where(between(shifts.date, weekStart, weekEnd))
    .orderBy(asc(shifts.date), asc(shifts.startTime), asc(shifts.id));
  const off = await db.select().from(daysOff).where(between(daysOff.date, weekStart, weekEnd));
  const offByDate = new Map(off.map((o) => [o.date, o.label]));

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, shifts: rows.filter((r) => r.date === date), dayOff: offByDate.get(date) ?? null };
  });
  return { weekStart, days };
}

export async function getDayShifts(db: DB, date: string): Promise<ShiftView[]> {
  return db
    .select(shiftColumns)
    .from(shifts)
    .innerJoin(schedulePeople, eq(shifts.personId, schedulePeople.id))
    .where(eq(shifts.date, date))
    .orderBy(asc(shifts.startTime), asc(shifts.id));
}

export async function addShift(db: DB, input: ShiftInput): Promise<number> {
  check(input);
  const [row] = await db
    .insert(shifts)
    .values({ date: input.date, personId: input.personId, startTime: input.start, endTime: input.end })
    .returning({ id: shifts.id });
  return row.id;
}

export async function updateShift(db: DB, id: number, input: ShiftInput): Promise<void> {
  check(input);
  await db
    .update(shifts)
    .set({ date: input.date, personId: input.personId, startTime: input.start, endTime: input.end, updatedAt: new Date() })
    .where(eq(shifts.id, id));
}

export async function deleteShift(db: DB, id: number): Promise<void> {
  await db.delete(shifts).where(eq(shifts.id, id));
}

export async function setDayOff(db: DB, date: string, label: string): Promise<void> {
  if (!DATE.test(date)) throw new ValidationError('Pick a day.', 'date');
  const text = label.trim();
  if (!text) throw new ValidationError('Give the day a name, like "Thanksgiving".', 'label');
  await db.insert(daysOff).values({ date, label: text }).onConflictDoUpdate({ target: daysOff.date, set: { label: text } });
}

export async function clearDayOff(db: DB, date: string): Promise<void> {
  await db.delete(daysOff).where(eq(daysOff.date, date));
}

/**
 * Copies one week's shifts onto other weeks, all in one transaction.
 * 'replace' makes each target day match the source day; 'fill' only fills target days that are empty.
 * A day off on either side is left alone.
 */
export async function copyWeek(db: DB, src: string, targets: string[], mode: 'replace' | 'fill'): Promise<void> {
  await db.transaction(async (tx) => {
    const source = await tx.select().from(shifts).where(between(shifts.date, src, addDays(src, 6)));
    const off = new Set((await tx.select({ date: daysOff.date }).from(daysOff)).map((o) => o.date));

    for (const target of targets) {
      for (let i = 0; i < 7; i++) {
        const from = addDays(src, i);
        const to = addDays(target, i);
        if (off.has(from) || off.has(to)) continue;

        const existing = await tx.select({ id: shifts.id }).from(shifts).where(eq(shifts.date, to));
        if (mode === 'fill' && existing.length) continue;
        if (existing.length) await tx.delete(shifts).where(inArray(shifts.id, existing.map((e) => e.id)));

        const copies = source
          .filter((s) => s.date === from)
          .map((s) => ({ date: to, personId: s.personId, startTime: s.startTime, endTime: s.endTime }));
        if (copies.length) await tx.insert(shifts).values(copies);
      }
    }
  });
}
