'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireFamily } from '@/lib/auth/current-user';
import { type ActionResult, guard, ValidationError } from '@/lib/errors';
import { addSchedulePerson } from '@/lib/people';
import { addShift, clearDayOff, copyDay, copyWeek, deleteShift, getWeek, setDayOff, updateShift } from '@/lib/schedule/repo';
import { addDays } from '@/lib/time';

const text = (form: FormData, key: string) => String(form.get(key) ?? '');

function refresh() {
  revalidatePath('/calendar/caretakers');
  revalidatePath('/');
}

export async function saveShiftAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    const db = await getDb();
    const newName = text(form, 'newName').trim();
    const id = Number(form.get('id'));
    await db.transaction(async (tx) => {
      // "+ Someone new": add the name to the schedule list together with their first shift.
      const personId = newName ? await addSchedulePerson(tx, { name: newName }) : Number(form.get('personId'));
      const input = { date: text(form, 'date'), personId, start: text(form, 'start'), end: text(form, 'end') };
      if (id) await updateShift(tx, id, input);
      else await addShift(tx, input);
    });
    if (newName) revalidatePath('/', 'layout');
    refresh();
  });
}

export async function deleteShiftAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await deleteShift(await getDb(), id);
    refresh();
  });
}

export async function copyWeekAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    const src = text(form, 'src');
    const target = text(form, 'target');
    const mode = text(form, 'mode') === 'fill' ? 'fill' : 'replace';
    let weeks: string[];
    if (target === 'next') weeks = [addDays(src, 7)];
    else if (target === 'next4') weeks = [1, 2, 3, 4].map((n) => addDays(src, 7 * n));
    else weeks = form.getAll('pick').map(String);
    if (!weeks.length) throw new ValidationError('Pick at least one week.', 'pick');
    await copyWeek(await getDb(), src, weeks, mode);
    refresh();
  });
}

export async function copyDayAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await copyDay(await getDb(), text(form, 'src'), form.getAll('to').map(String));
    refresh();
  });
}

export async function copyPrevWeekAction(weekStart: string): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    const db = await getDb();
    const prev = addDays(weekStart, -7);
    const last = await getWeek(db, prev);
    if (!last.days.some((d) => d.shifts.length)) throw new ValidationError('Last week is empty too. Add a shift to get started.');
    await copyWeek(db, prev, [weekStart], 'replace');
    refresh();
  });
}

export async function setDayOffAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await setDayOff(await getDb(), text(form, 'date'), text(form, 'label'));
    refresh();
  });
}

export async function clearDayOffAction(date: string): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await clearDayOff(await getDb(), date);
    refresh();
  });
}
