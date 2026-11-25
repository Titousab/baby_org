import { describe, expect, test } from 'vitest';
import { places } from '@/db/schema';
import type { ClassItem } from '@/lib/classes/list';
import { saveManualClass } from '@/lib/classes/manual';
import { placeStatusLine, visibleIdeas } from '@/lib/classes/view';
import { createTestDb } from '../helpers/test-db';

const idea = (title: string, ageMin: number | null, ageMax: number | null): ClassItem => ({
  key: title,
  placeId: 1,
  placeName: 'Central Library',
  color: 'sage',
  kind: 'idea',
  title,
  date: '2026-11-28',
  start: '10:00',
  durationMin: 30,
  ageMin,
  ageMax,
  ageOverridden: false,
  priceText: 'Free',
  statusText: null,
  bookingUrl: null,
  note: null,
  manualId: null,
});

describe('nearby ideas', () => {
  test("ideas for other ages are left out; unknown ages stay", () => {
    const items = [idea('Toddler Storytime', 18, 36), idea('Teen Coding', 156, 216), idea('Birdwatching', null, null)];
    expect(visibleIdeas(items, '2025-01-01').map((i) => i.title)).toEqual(['Toddler Storytime', 'Birdwatching']);
    expect(visibleIdeas(items, null).map((i) => i.title)).toEqual(['Toddler Storytime', 'Teen Coding', 'Birdwatching']);
  });
});

describe('status line in the places sheet', () => {
  const today = '2026-11-25';
  test('says when the schedule was last read, also next to an error', () => {
    const ok = { lastSuccessAt: new Date('2026-11-25T11:02:00Z'), lastError: null };
    expect(placeStatusLine(ok, today)).toBe('Updates automatically · checked 6:02 am');
    const failing = { lastSuccessAt: new Date('2026-11-24T11:02:00Z'), lastError: "Couldn't read the schedule. Showing what we had." };
    expect(placeStatusLine(failing, today)).toBe("Couldn't read the schedule. Showing what we had. Last read Nov 24.");
    expect(placeStatusLine({ lastSuccessAt: null, lastError: null }, today)).toBe('Updates automatically · not checked yet');
    expect(placeStatusLine(null, today)).toBe('Typed in by hand');
  });
});

describe('booking links on hand-typed classes', () => {
  test('a link typed without https:// gets it; something that is not a web address is refused', async () => {
    const db = await createTestDb();
    const [p] = await db.insert(places).values({ slug: 'gd', name: 'Good Day', color: 'peach', kind: 'class' }).returning();
    const base = {
      placeId: p.id,
      title: 'Lil Boppers',
      firstDate: '2026-12-03',
      startTime: '10:00',
      durationMin: 45,
      ageMin: 18,
      ageMax: 36,
      priceText: null,
      note: null,
      repeatsWeekly: true,
      untilDate: null,
    };
    await saveManualClass(db, { ...base, bookingUrl: 'gooddayplaycafe.as.me/schedule/ff6e00f5' });
    const { manualClasses } = await import('@/db/schema');
    expect((await db.select().from(manualClasses))[0].bookingUrl).toBe('https://gooddayplaycafe.as.me/schedule/ff6e00f5');
    await expect(saveManualClass(db, { ...base, bookingUrl: 'javascript:alert(1)' })).rejects.toMatchObject({
      field: 'bookingUrl',
      message: "That link doesn't look like a web address.",
    });
  });
});
