'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth/current-user';
import { type ActionResult, guard } from '@/lib/errors';
import { clearSlot, deleteNap, deleteNote, deleteSnack, endNapNow, saveNap, saveNote, saveSlot, saveSnack, type SlotKey, startNapNow } from '@/lib/log';
import { todayNY } from '@/lib/time';

const text = (form: FormData, key: string) => String(form.get(key) ?? '');
const optional = (form: FormData, key: string) => (form.has(key) ? text(form, key) : undefined);

export async function saveSlotAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await saveSlot(
      await getDb(),
      {
        date: text(form, 'date'),
        slot: text(form, 'slot') as SlotKey,
        time: text(form, 'time'),
        food: optional(form, 'food'),
        amount: optional(form, 'amount'),
      },
      user.id,
      todayNY(),
    );
    revalidatePath('/');
  });
}

export async function clearSlotAction(date: string, slot: SlotKey): Promise<ActionResult> {
  return guard(async () => {
    await requireUser();
    await clearSlot(await getDb(), date, slot);
    revalidatePath('/');
  });
}

export async function saveNapAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const id = Number(form.get('id')) || undefined;
    await saveNap(await getDb(), { id, date: text(form, 'date'), start: text(form, 'start'), end: text(form, 'end') }, user.id, todayNY());
    revalidatePath('/');
  });
}

export async function startNapNowAction(): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await startNapNow(await getDb(), user.id, new Date());
    revalidatePath('/');
  });
}

export async function endNapNowAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await endNapNow(await getDb(), id, user.id, new Date());
    revalidatePath('/');
  });
}

export async function deleteNapAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    await requireUser();
    await deleteNap(await getDb(), id);
    revalidatePath('/');
  });
}

export async function saveSnackAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const id = Number(form.get('id')) || undefined;
    await saveSnack(
      await getDb(),
      { id, date: text(form, 'date'), time: text(form, 'time'), food: optional(form, 'food'), amount: optional(form, 'amount') },
      user.id,
      todayNY(),
    );
    revalidatePath('/');
  });
}

export async function deleteSnackAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    await requireUser();
    await deleteSnack(await getDb(), id);
    revalidatePath('/');
  });
}

export async function saveNoteAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    const id = Number(form.get('id')) || undefined;
    await saveNote(
      await getDb(),
      { id, date: text(form, 'date'), time: text(form, 'time'), kind: text(form, 'kind'), text: text(form, 'text') },
      user.id,
      todayNY(),
    );
    revalidatePath('/');
  });
}

export async function deleteNoteAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    await requireUser();
    await deleteNote(await getDb(), id);
    revalidatePath('/');
  });
}
