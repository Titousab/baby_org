'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { requireFamily, requireUser } from '@/lib/auth/current-user';
import { type ActionResult, guard } from '@/lib/errors';
import {
  addSchedulePerson,
  changeOwnPassword,
  createAccount,
  disableAccount,
  resetPassword,
  type Role,
  setRole,
  updateSchedulePerson,
} from '@/lib/people';
import { updateSettings } from '@/lib/settings';

const text = (form: FormData, key: string) => String(form.get(key) ?? '');
const everywhere = () => revalidatePath('/', 'layout');

export async function createAccountAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await createAccount(await getDb(), {
      name: text(form, 'name'),
      email: text(form, 'email'),
      role: text(form, 'role') as Role,
      password: text(form, 'password'),
    });
    everywhere();
  });
}

export async function addSchedulePersonAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await addSchedulePerson(await getDb(), { name: text(form, 'name'), color: text(form, 'color') || undefined });
    everywhere();
  });
}

export async function updatePersonAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await updateSchedulePerson(await getDb(), Number(form.get('personId')), { name: text(form, 'name'), color: text(form, 'color') });
    everywhere();
  });
}

export async function setRoleAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await setRole(await getDb(), Number(form.get('userId')), text(form, 'role') as Role);
    everywhere();
  });
}

export async function resetPasswordAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await resetPassword(await getDb(), Number(form.get('userId')), text(form, 'password'));
  });
}

export async function disableAccountAction(userId: number): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await disableAccount(await getDb(), userId);
    everywhere();
  });
}

export async function updateSettingsAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    await requireFamily();
    await updateSettings(await getDb(), {
      ezraBirthdate: text(form, 'birthdate') || null,
      days: form.getAll('days').map(Number),
      start: text(form, 'start'),
      end: text(form, 'end'),
    });
    everywhere();
  });
}

export async function changeOwnPasswordAction(form: FormData): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireUser();
    await changeOwnPassword(await getDb(), user.id, text(form, 'current'), text(form, 'next'));
  });
}
