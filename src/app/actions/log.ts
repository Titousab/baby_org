'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireUser } from '@/lib/auth/current-user';
import { type ActionResult, guard } from '@/lib/errors';
import { clearSlot, deleteNote, saveNote, saveSlot, type SlotKey } from '@/lib/log';
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
        endTime: optional(form, 'endTime'),
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
