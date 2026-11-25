import { eq } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { manualClasses, places, seedClassesApplied, sources } from '@/db/schema';
import { ensurePlaces, SEED_CLASSES } from '@/lib/classes/places-seed';
import { createTestDb } from '../helpers/test-db';

test('the five class places, two idea places, their sources and the screenshot classes are added once', async () => {
  const db = await createTestDb();
  await ensurePlaces(db);
  await ensurePlaces(db);

  const all = await db.select().from(places);
  expect(all.map((p) => p.slug).sort()).toEqual(
    ['bpl-central', 'bpl-park-slope', 'bramble', 'good-day', 'prospect-park', 'treasure-trunk', 'young-ethels'],
  );
  expect(all.filter((p) => p.kind === 'idea').map((p) => p.slug).sort()).toEqual(['bpl-central', 'prospect-park']);
  expect(all.find((p) => p.slug === 'bramble')?.watchUrl).toBe('https://www.thebramble.space/classes');

  expect((await db.select().from(sources)).map((s) => s.adapter).sort()).toEqual(['bpl-branch', 'bpl-branch', 'tribe-events', 'young-ethels']);

  const manual = await db.select().from(manualClasses);
  expect(manual).toHaveLength(13);
  const bramble = all.find((p) => p.slug === 'bramble')!;
  expect(manual.filter((m) => m.placeId === bramble.id)).toHaveLength(8);
  expect(manual.find((m) => m.title.startsWith('Toddler Time at the Trunk'))).toMatchObject({
    ageMin: 12,
    ageMax: 24,
    priceText: '$40/class · $245 semester',
    startTime: '10:30',
    repeatsWeekly: true,
    untilDate: '2027-01-29',
  });
});

test('classes added to the seed file later are added on the next deploy; ones the family deleted stay deleted', async () => {
  const db = await createTestDb();
  await ensurePlaces(db);
  const [first] = await db.select().from(manualClasses);
  await db.delete(manualClasses).where(eq(manualClasses.id, first.id));

  const newer = {
    place: 'The Bramble',
    title: 'Music with AudraRox (January)',
    first_date: '2027-01-06',
    start_time: '10:00',
    duration_min: 45,
    age_min_months: 0,
    age_max_months: 24,
    price_text: null,
    note: null,
    booking_url: 'https://www.thebramble.space/classschedule',
    repeats_weekly: true,
    until_date: '2027-01-27',
  };
  await ensurePlaces(db, [...SEED_CLASSES, newer]);

  const titles = (await db.select().from(manualClasses)).map((m) => m.title);
  expect(titles).toHaveLength(13);
  expect(titles).toContain('Music with AudraRox (January)');
  expect(titles.filter((t) => t === first.title).length).toBe(SEED_CLASSES.filter((c) => c.title === first.title).length - 1);
});

test('a database seeded before this was tracked is not given duplicates', async () => {
  const db = await createTestDb();
  await ensurePlaces(db);
  await db.delete(seedClassesApplied);
  await ensurePlaces(db);
  expect(await db.select().from(manualClasses)).toHaveLength(13);
});

test('renaming a seeded place does not bring it back', async () => {
  const db = await createTestDb();
  await ensurePlaces(db);
  await db.update(places).set({ name: 'Bramble (Park Slope)' }).where(eq(places.slug, 'bramble'));
  await ensurePlaces(db);
  expect((await db.select().from(places)).filter((p) => p.name.includes('Bramble'))).toHaveLength(1);
});
