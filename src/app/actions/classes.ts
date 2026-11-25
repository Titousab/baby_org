'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { places } from '@/db/schema';
import { requireFamily } from '@/lib/auth/current-user';
import { clearAgeOverride, deleteManualClass, saveManualClass, setAgeOverride } from '@/lib/classes/manual';
import { markWatchSeen, runSync, webFetcher } from '@/lib/classes/sync';
import { PERSON_COLORS } from '@/lib/colors';
import { type ActionResult, guard, ValidationError } from '@/lib/errors';
import { normalizeWebUrl } from '@/lib/url';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const months = (form: FormData, key: string) => {
  const v = text(form, key);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new ValidationError('Ages are in months, like 18.', key);
  return n;
};
const refresh = () => revalidatePath('/calendar/classes');

export async function syncNowAction(): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    if (process.env.SYNC_DISABLED) return;
    const result = await runSync(await getDb(), webFetcher, new Date(), { force: true });
    if (!result.ran) throw new ValidationError('Already checking the websites. Try again in a minute.');
    refresh();
  });
}

export async function saveManualClassAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    const repeats = form.get('repeatsWeekly') === 'on';
    await saveManualClass(await getDb(), {
      id: Number(form.get('id')) || undefined,
      placeId: Number(form.get('placeId')),
      title: text(form, 'title'),
      firstDate: text(form, 'firstDate'),
      startTime: text(form, 'startTime'),
      durationMin: Number(text(form, 'durationMin') || 0),
      ageMin: months(form, 'ageMin'),
      ageMax: months(form, 'ageMax'),
      priceText: text(form, 'priceText') || null,
      note: text(form, 'note') || null,
      bookingUrl: text(form, 'bookingUrl') || null,
      repeatsWeekly: repeats,
      untilDate: repeats ? text(form, 'untilDate') || null : null,
    });
    refresh();
  });
}

export async function deleteManualClassAction(id: number): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await deleteManualClass(await getDb(), id);
    refresh();
  });
}

export async function setAgeOverrideAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireFamily();
    await setAgeOverride(await getDb(), Number(form.get('placeId')), text(form, 'title'), months(form, 'ageMin'), months(form, 'ageMax'), user.id);
    refresh();
  });
}

export async function clearAgeOverrideAction(placeId: number, title: string): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await clearAgeOverride(await getDb(), placeId, title);
    refresh();
  });
}

export async function markWatchSeenAction(placeId: number): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await markWatchSeen(await getDb(), placeId);
    refresh();
  });
}

/** A new place whose classes the family types in; its website is checked daily for changes. */
export async function addPlaceAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    const name = text(form, 'name');
    if (!name) throw new ValidationError('Add the place name.', 'name');
    const typed = text(form, 'websiteUrl');
    const website = typed ? normalizeWebUrl(typed) : null;
    if (typed && !website) throw new ValidationError("That website address doesn't look right.", 'websiteUrl');
    const color = (PERSON_COLORS as readonly string[]).includes(text(form, 'color')) ? text(form, 'color') : 'sage';
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    await (await getDb()).insert(places).values({
      slug,
      name,
      color,
      kind: 'class',
      websiteUrl: website || null,
      bookingUrl: website || null,
      watchUrl: website || null,
    });
    refresh();
  });
}
