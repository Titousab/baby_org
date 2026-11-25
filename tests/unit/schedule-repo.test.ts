import { describe, expect, test } from 'vitest';
import { schedulePeople } from '@/db/schema';
import {
  addShift,
  clearDayOff,
  copyDay,
  copyWeek,
  deleteShift,
  getDayShifts,
  getWeek,
  listSchedulePeople,
  setDayOff,
  updateShift,
} from '@/lib/schedule/repo';
import { getSettings, updateSettings } from '@/lib/settings';
import { createTestDb, seedUser } from '../helpers/test-db';

const THIS_WEEK = '2026-11-23';
const NEXT_WEEK = '2026-11-30';

async function setup() {
  const db = await createTestDb();
  await seedUser(db, { name: 'Dad', color: 'butter' });
  const [lauren] = await db.insert(schedulePeople).values({ name: 'Lauren', color: 'lav' }).returning();
  const [selina] = await db.insert(schedulePeople).values({ name: 'Selina', color: 'sky' }).returning();
  return { db, lauren: lauren.id, selina: selina.id };
}

const plain = (week: Awaited<ReturnType<typeof getWeek>>) =>
  week.days.map((d) => d.shifts.map((s) => `${s.personName} ${s.start}-${s.end}`));

describe('shifts', () => {
  test('a shift must end after it starts', async () => {
    const { db, lauren } = await setup();
    await expect(addShift(db, { date: '2026-11-25', personId: lauren, start: '16:00', end: '08:00' })).rejects.toMatchObject({
      name: 'ValidationError',
      field: 'end',
      message: 'The end time needs to be after the start time.',
    });
  });

  test('a week runs Monday to Sunday with shifts sorted and named', async () => {
    const { db, lauren, selina } = await setup();
    await addShift(db, { date: '2026-11-25', personId: selina, start: '16:00', end: '18:30' });
    await addShift(db, { date: '2026-11-25', personId: lauren, start: '08:00', end: '16:00' });
    await setDayOff(db, '2026-11-26', 'Thanksgiving');

    const week = await getWeek(db, THIS_WEEK);
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
    ]);
    expect(week.days[2].shifts).toMatchObject([
      { personName: 'Lauren', color: 'lav', start: '08:00', end: '16:00' },
      { personName: 'Selina', color: 'sky', start: '16:00', end: '18:30' },
    ]);
    expect(week.days[3].dayOff).toBe('Thanksgiving');
    expect(week.days[2].dayOff).toBeNull();
    expect((await getDayShifts(db, '2026-11-25')).map((s) => s.personName)).toEqual(['Lauren', 'Selina']);

    await clearDayOff(db, '2026-11-26');
    expect((await getWeek(db, THIS_WEEK)).days[3].dayOff).toBeNull();
  });

  test('shifts can be changed and deleted', async () => {
    const { db, lauren, selina } = await setup();
    const id = await addShift(db, { date: '2026-11-25', personId: lauren, start: '08:00', end: '16:00' });
    await updateShift(db, id, { date: '2026-11-24', personId: selina, start: '09:00', end: '15:00' });
    expect(await getDayShifts(db, '2026-11-25')).toEqual([]);
    expect(await getDayShifts(db, '2026-11-24')).toMatchObject([{ id, personName: 'Selina', start: '09:00', end: '15:00' }]);
    await deleteShift(db, id);
    expect(await getDayShifts(db, '2026-11-24')).toEqual([]);
  });

  test('schedule people are listed by name with their colors', async () => {
    const { db } = await setup();
    expect((await listSchedulePeople(db)).map((p) => `${p.name}:${p.color}`)).toEqual(['Dad:butter', 'Lauren:lav', 'Selina:sky']);
  });
});

describe('copyWeek', () => {
  async function standardWeek() {
    const s = await setup();
    for (const d of ['2026-11-23', '2026-11-24', '2026-11-25']) {
      await addShift(s.db, { date: d, personId: s.lauren, start: '08:00', end: '16:00' });
      await addShift(s.db, { date: d, personId: s.selina, start: '16:00', end: '18:30' });
    }
    return s;
  }

  test('replace makes the target week match, wiping what was there', async () => {
    const { db, selina } = await standardWeek();
    await addShift(db, { date: '2026-12-04', personId: selina, start: '09:00', end: '10:00' }); // a Friday with nothing in the source
    await copyWeek(db, THIS_WEEK, [NEXT_WEEK], 'replace');
    expect(plain(await getWeek(db, NEXT_WEEK))).toEqual(plain(await getWeek(db, THIS_WEEK)));
  });

  test('fill keeps days that already have shifts and fills only empty ones', async () => {
    const { db, selina } = await standardWeek();
    await addShift(db, { date: '2026-11-30', personId: selina, start: '09:00', end: '12:00' });
    await copyWeek(db, THIS_WEEK, [NEXT_WEEK], 'fill');
    const next = plain(await getWeek(db, NEXT_WEEK));
    expect(next[0]).toEqual(['Selina 09:00-12:00']);
    expect(next[1]).toEqual(['Lauren 08:00-16:00', 'Selina 16:00-18:30']);
  });

  test('days off are skipped on either side', async () => {
    const { db, lauren } = await standardWeek();
    await addShift(db, { date: '2026-11-26', personId: lauren, start: '08:00', end: '16:00' }); // source Thursday
    await setDayOff(db, '2026-11-26', 'Thanksgiving');
    await setDayOff(db, '2026-12-01', 'Family day'); // target Tuesday
    await copyWeek(db, THIS_WEEK, [NEXT_WEEK], 'replace');
    const next = plain(await getWeek(db, NEXT_WEEK));
    expect(next[3]).toEqual([]); // Thursday Dec 3 not copied from a day off
    expect(next[1]).toEqual([]); // Tuesday Dec 1 is itself off
    expect(next[0]).toEqual(['Lauren 08:00-16:00', 'Selina 16:00-18:30']);
  });

  test('copying to several weeks is all or nothing', async () => {
    const { db } = await standardWeek();
    await expect(copyWeek(db, THIS_WEEK, [NEXT_WEEK, '2026-12-07', 'not-a-date', '2026-12-21'], 'replace')).rejects.toThrow();
    expect(plain(await getWeek(db, NEXT_WEEK)).flat()).toEqual([]);
    expect(plain(await getWeek(db, '2026-12-07')).flat()).toEqual([]);
  });
});

describe('copyDay', () => {
  const MON = '2026-11-23';

  async function mondayPlan() {
    const s = await setup();
    await addShift(s.db, { date: MON, personId: s.lauren, start: '08:00', end: '16:00' });
    await addShift(s.db, { date: MON, personId: s.selina, start: '16:00', end: '18:30' });
    return s;
  }

  test('copies a day onto the days picked, replacing what was there', async () => {
    const { db, selina } = await mondayPlan();
    await addShift(db, { date: '2026-11-26', personId: selina, start: '09:00', end: '10:00' });
    await copyDay(db, MON, ['2026-11-25', '2026-11-26']);
    const week = plain(await getWeek(db, THIS_WEEK));
    expect(week[2]).toEqual(['Lauren 08:00-16:00', 'Selina 16:00-18:30']);
    expect(week[3]).toEqual(week[0]);
    expect(week[1]).toEqual([]);
  });

  test('a day off is left alone', async () => {
    const { db } = await mondayPlan();
    await setDayOff(db, '2026-11-25', 'Family day');
    await copyDay(db, MON, ['2026-11-25', '2026-11-26']);
    const week = plain(await getWeek(db, THIS_WEEK));
    expect(week[2]).toEqual([]);
    expect(week[3]).toEqual(week[0]);
  });

  test('the source day and repeated days are copied once', async () => {
    const { db } = await mondayPlan();
    await copyDay(db, MON, [MON, '2026-11-25', '2026-11-25']);
    const week = plain(await getWeek(db, THIS_WEEK));
    expect(week[0]).toEqual(['Lauren 08:00-16:00', 'Selina 16:00-18:30']);
    expect(week[2]).toEqual(week[0]);
  });

  test('refuses no days, bad dates and an empty source, changing nothing', async () => {
    const { db, selina } = await mondayPlan();
    await addShift(db, { date: '2026-11-25', personId: selina, start: '09:00', end: '10:00' });
    await expect(copyDay(db, MON, [])).rejects.toMatchObject({ name: 'ValidationError', field: 'to', message: 'Pick at least one day.' });
    await expect(copyDay(db, MON, ['2026-11-26', 'not-a-date'])).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(copyDay(db, '2026-11-24', ['2026-11-25'])).rejects.toMatchObject({
      name: 'ValidationError',
      message: 'There are no shifts on this day to copy.',
    });
    const week = plain(await getWeek(db, THIS_WEEK));
    expect(week[2]).toEqual(['Selina 09:00-10:00']);
    expect(week[3]).toEqual([]);
  });
});

describe('settings', () => {
  test('defaults, updates and a window that must end after it starts', async () => {
    const { db } = await setup();
    expect(await getSettings(db)).toEqual({ ezraBirthdate: null, rules: { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:30' } });
    await updateSettings(db, { ezraBirthdate: '2025-06-10', end: '18:00' });
    expect(await getSettings(db)).toEqual({ ezraBirthdate: '2025-06-10', rules: { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' } });
    await expect(updateSettings(db, { start: '18:00', end: '08:00' })).rejects.toMatchObject({
      message: 'The end time needs to be after the start time.',
    });
    await expect(updateSettings(db, { days: [7] })).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
