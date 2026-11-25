import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { DB } from '@/db/types';
import { createTestDb, seedUser } from '../helpers/test-db';

// Server actions run with a signed-in caretaker (Selina) against a test database.
const state = vi.hoisted(() => ({ db: null as unknown as DB, userId: 0 }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db/client', () => ({ getDb: async () => state.db }));
vi.mock('@/lib/auth/current-user', async () => {
  const { assertFamily } = await import('@/lib/auth/permissions');
  const caretaker = () => ({ id: state.userId, name: 'Selina', email: 'selina@example.com', role: 'caretaker' as const });
  return {
    getCurrentUser: async () => caretaker(),
    requireUser: async () => caretaker(),
    requireFamily: async () => {
      const u = caretaker();
      assertFamily(u);
      return u;
    },
  };
});

const { saveSlotAction, saveNoteAction } = await import('@/app/actions/log');
const schedule = await import('@/app/actions/schedule');
const people = await import('@/app/actions/people');

const DENIED = { ok: false, message: 'Only family members can change this.' };
const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

beforeEach(async () => {
  state.db = await createTestDb();
  await seedUser(state.db, { name: 'Dad' });
  state.userId = await seedUser(state.db, { name: 'Selina', email: 'selina@example.com', role: 'caretaker', color: 'sky' });
});

describe('a caretaker cannot change family-only things, even by calling the server directly', () => {
  test('schedule actions are refused', async () => {
    const shift = form({ date: '2026-11-30', personId: '1', start: '08:00', end: '16:00' });
    expect(await schedule.saveShiftAction(shift)).toEqual(DENIED);
    expect(await schedule.deleteShiftAction(1)).toEqual(DENIED);
    expect(await schedule.copyWeekAction(form({ src: '2026-11-23', target: 'next', mode: 'replace' }))).toEqual(DENIED);
    expect(await schedule.copyDayAction(form({ src: '2026-11-23', to: ['2026-11-25'] }))).toEqual(DENIED);
    expect(await schedule.copyPrevWeekAction('2026-11-30')).toEqual(DENIED);
    expect(await schedule.setDayOffAction(form({ date: '2026-11-26', label: 'Thanksgiving' }))).toEqual(DENIED);
    expect(await schedule.clearDayOffAction('2026-11-26')).toEqual(DENIED);
  });

  test('people and settings actions are refused', async () => {
    const person = form({ name: 'Eve', email: 'eve@example.com', role: 'family', password: 'starter-pass-1' });
    expect(await people.createAccountAction(person)).toEqual(DENIED);
    expect(await people.addSchedulePersonAction(form({ name: 'Ana' }))).toEqual(DENIED);
    expect(await people.updatePersonAction(form({ personId: '1', name: 'Hacked', color: 'sage' }))).toEqual(DENIED);
    expect(await people.setRoleAction(form({ userId: String(state.userId), role: 'family' }))).toEqual(DENIED);
    expect(await people.resetPasswordAction(form({ userId: '1', password: 'new-pass-123' }))).toEqual(DENIED);
    expect(await people.disableAccountAction(1)).toEqual(DENIED);
    expect(await people.restoreAccountAction(1)).toEqual(DENIED);
    expect(await people.updateSettingsAction(form({ start: '07:00', end: '19:00', days: ['1'] }))).toEqual(DENIED);
  });
});

describe('class changes are family-only too', () => {
  test('adding, editing and syncing classes are refused', async () => {
    const classes = await import('@/app/actions/classes');
    const cls = form({ placeId: '1', title: 'Music', firstDate: '2026-11-25', startTime: '10:00', durationMin: '45' });
    expect(await classes.saveManualClassAction(cls)).toEqual(DENIED);
    expect(await classes.deleteManualClassAction(1)).toEqual(DENIED);
    expect(await classes.setAgeOverrideAction(form({ placeId: '1', title: 'Music', ageMin: '12', ageMax: '24' }))).toEqual(DENIED);
    expect(await classes.clearAgeOverrideAction(1, 'Music')).toEqual(DENIED);
    expect(await classes.markWatchSeenAction(1)).toEqual(DENIED);
    expect(await classes.addPlaceAction(form({ name: 'Gym', websiteUrl: 'https://gym.example', color: 'sage' }))).toEqual(DENIED);
    expect(await classes.syncNowAction()).toEqual(DENIED);
  });
});

describe('a caretaker can log the day and change their own password', () => {
  test('logging works', async () => {
    expect(await saveSlotAction(form({ date: '2026-11-25', slot: 'wake', time: '06:45' }))).toEqual({ ok: true });
    expect(await saveNoteAction(form({ date: '2026-11-25', time: '09:00', kind: 'Note', text: 'Happy morning' }))).toEqual({ ok: true });
  });

  test('changing their own password works', async () => {
    expect(await people.changeOwnPasswordAction(form({ current: 'right-pass-1', next: 'selina-new-pass' }))).toEqual({ ok: true });
  });
});
