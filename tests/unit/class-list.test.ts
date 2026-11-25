import { describe, expect, test } from 'vitest';
import { classSessions, places, sources } from '@/db/schema';
import type { DB } from '@/db/types';
import { listClasses } from '@/lib/classes/list';
import { clearAgeOverride, expandManual, saveManualClass, setAgeOverride } from '@/lib/classes/manual';
import { createTestDb, seedUser } from '../helpers/test-db';

const TODAY = '2026-11-25'; // Wednesday
const AFTERNOON = 14 * 60 + 30;

const weeklyThu = { firstDate: '2026-11-12', repeatsWeekly: true, untilDate: '2027-01-28' };

describe('expandManual', () => {
  test('a weekly class lands on its weekday inside the window', () => {
    expect(expandManual(weeklyThu, '2026-11-25', '2026-12-01')).toEqual(['2026-11-26']);
  });
  test('nothing after its until-date', () => {
    expect(expandManual({ ...weeklyThu, untilDate: '2026-11-19' }, '2026-11-25', '2026-12-01')).toEqual([]);
  });
  test('a one-off class shows only on its day', () => {
    const once = { firstDate: '2026-12-07', repeatsWeekly: false, untilDate: null };
    expect(expandManual(once, '2026-12-01', '2026-12-07')).toEqual(['2026-12-07']);
    expect(expandManual(once, '2026-11-25', '2026-12-01')).toEqual([]);
  });
  test('a class that has not started yet is not shown early', () => {
    expect(expandManual({ firstDate: '2026-12-24', repeatsWeekly: true, untilDate: null }, '2026-11-25', '2026-12-01')).toEqual([]);
  });
});

async function setup(): Promise<{ db: DB; placeId: number; sourceId: number; user: number }> {
  const db = await createTestDb();
  const user = await seedUser(db);
  const [p] = await db.insert(places).values({ slug: 'gym', name: 'Maple Gym', color: 'sage', kind: 'class' }).returning();
  const [s] = await db.insert(sources).values({ placeId: p.id, adapter: 'young-ethels', url: 'https://example.com' }).returning();
  return { db, placeId: p.id, sourceId: s.id, user };
}

const session = (placeId: number, sourceId: number, externalId: string, date: string, startTime: string, title = 'Toddler Tumble') => ({
  placeId,
  sourceId,
  externalId,
  title,
  date,
  startTime,
  durationMin: 45,
  ageMin: 0,
  ageMax: 48,
  priceText: 'Free',
  statusText: null,
  bookingUrl: 'https://example.com/book',
});

describe('listClasses', () => {
  test('merges synced and hand-typed classes for 7 days, sorted, without ones already started today', async () => {
    const { db, placeId, sourceId } = await setup();
    await db.insert(classSessions).values([
      session(placeId, sourceId, 'a', TODAY, '09:30'),
      session(placeId, sourceId, 'b', TODAY, '15:30'),
      session(placeId, sourceId, 'c', '2026-12-02', '10:00'), // day 8: outside
    ]);
    await saveManualClass(db, {
      placeId,
      title: 'Music Circle',
      firstDate: '2026-11-12',
      startTime: '10:00',
      durationMin: 45,
      ageMin: 12,
      ageMax: 24,
      priceText: '$25',
      note: null,
      bookingUrl: null,
      repeatsWeekly: true,
      untilDate: null,
    });

    const items = await listClasses(db, TODAY, AFTERNOON);
    expect(items.map((i) => `${i.date} ${i.start} ${i.title}`)).toEqual(['2026-11-25 15:30 Toddler Tumble', '2026-11-26 10:00 Music Circle']);
    expect(items[0]).toMatchObject({ placeName: 'Maple Gym', color: 'sage', kind: 'class', priceText: 'Free', manualId: null });
    expect(items[1]).toMatchObject({ priceText: '$25', ageMin: 12, ageMax: 24 });
    expect(items[1].manualId).toBeGreaterThan(0);
  });

  test("a family member's age correction wins, and can be removed", async () => {
    const { db, placeId, sourceId, user } = await setup();
    await db.insert(classSessions).values(session(placeId, sourceId, 'b', TODAY, '15:30'));
    await setAgeOverride(db, placeId, ' toddler tumble ', 12, 24, user);
    expect((await listClasses(db, TODAY, AFTERNOON))[0]).toMatchObject({ ageMin: 12, ageMax: 24, ageOverridden: true });
    await clearAgeOverride(db, placeId, 'Toddler Tumble');
    expect((await listClasses(db, TODAY, AFTERNOON))[0]).toMatchObject({ ageMin: 0, ageMax: 48, ageOverridden: false });
  });
});

describe('saveManualClass checks what was typed', () => {
  test('name, ages and dates', async () => {
    const { db, placeId } = await setup();
    const base = {
      placeId,
      title: 'Music',
      firstDate: TODAY,
      startTime: '10:00',
      durationMin: 45,
      ageMin: 12,
      ageMax: 24,
      priceText: null,
      note: null,
      bookingUrl: null,
      repeatsWeekly: true,
      untilDate: null,
    };
    await expect(saveManualClass(db, { ...base, title: ' ' })).rejects.toMatchObject({ field: 'title', message: 'Add the class name.' });
    await expect(saveManualClass(db, { ...base, ageMin: 24, ageMax: 12 })).rejects.toMatchObject({
      field: 'ageMax',
      message: 'The oldest age has to be at least the youngest.',
    });
    await expect(saveManualClass(db, { ...base, untilDate: '2026-11-01' })).rejects.toMatchObject({ field: 'untilDate' });
    await expect(saveManualClass(db, { ...base, startTime: '9am' })).rejects.toMatchObject({ field: 'startTime' });
  });
});
