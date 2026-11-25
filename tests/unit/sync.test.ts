import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { classSessions, places, sources } from '@/db/schema';
import type { DB } from '@/db/types';
import { ensurePlaces } from '@/lib/classes/places-seed';
import { type Fetcher, isSyncDue, markWatchSeen, runSync } from '@/lib/classes/sync';
import { createTestDb } from '../helpers/test-db';

const fixture = (name: string) => readFileSync(path.join(process.cwd(), 'tests/fixtures/sources', name), 'utf8');
const NOW = new Date('2026-11-25T15:00:00Z'); // 10:00 am in New York
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const DAY = 24 * 60 * 60;
const TRL = 'TRL: TODDLER REQUEST LIVE! A FAMILY FRIENDLY HAPPY HOUR FEATURING A SING-ALONG';

type Page = { status: number; text: string };

/** A pretend internet: answers from the saved pages and remembers every URL asked for. */
function fakeWeb(overrides: (url: string) => Page | undefined = () => undefined) {
  const calls: string[] = [];
  const pages: Record<string, Page> = {
    'https://www.bklynlibrary.org/robots.txt': { status: 200, text: fixture('bpl-robots.txt') },
    'https://youngethels.com/events': { status: 200, text: fixture('youngethels.html') },
    'https://www.thebramble.space/classes': { status: 200, text: '<html><body><h1>Classes</h1><p>Let us jam</p></body></html>' },
    'https://www.gooddayplaycafe.com/classes': { status: 200, text: '<html><body>Lil Boppers Thursdays</body></html>' },
    'https://www.treasuretrunktheatre.com/classes-at-tt-park-slope/': { status: 200, text: '<html><body>Park Slope</body></html>' },
  };
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const forced = overrides(url);
    if (forced) return forced;
    if (pages[url]) return pages[url];
    if (url.startsWith('https://www.bklynlibrary.org/locations/')) return { status: 200, text: fixture('bpl-branch.html') };
    if (url.startsWith('https://www.bklynlibrary.org/calendar/')) return { status: 200, text: fixture('bpl-detail.html') };
    if (url.startsWith('https://www.prospectpark.org/wp-json/')) return { status: 200, text: fixture('tribe.json') };
    return { status: 404, text: '' };
  };
  return { fetcher, calls };
}

async function setup(): Promise<DB> {
  const db = await createTestDb();
  await ensurePlaces(db);
  return db;
}

const library = (calls: string[]) => calls.filter((u) => u.includes('bklynlibrary.org'));
const source = async (db: DB, adapter: 'young-ethels' | 'tribe-events') => (await db.select().from(sources).where(eq(sources.adapter, adapter)))[0];
const sessionsOf = async (db: DB, sourceId: number) => db.select().from(classSessions).where(eq(classSessions.sourceId, sourceId));

/** Runs at NOW, +31 s and +62 s: robots.txt, then Park Slope's schedule, then Central's. */
async function readLibrarySchedules(db: DB) {
  await runSync(db, fakeWeb().fetcher, NOW);
  await runSync(db, fakeWeb().fetcher, later(31));
  await runSync(db, fakeWeb().fetcher, later(62));
}

describe('runSync', () => {
  test('the first run sends one request per website; the library first gets only its robots.txt', async () => {
    const db = await setup();
    expect(await isSyncDue(db, NOW)).toBe(true);
    const web = fakeWeb();
    const result = await runSync(db, web.fetcher, NOW);

    expect(result.ran).toBe(true);
    expect(library(web.calls)).toEqual(['https://www.bklynlibrary.org/robots.txt']);
    expect(web.calls).toContain('https://youngethels.com/events');
    expect((await sessionsOf(db, (await source(db, 'young-ethels')).id)).map((s) => s.date)).toEqual(['2026-11-30', '2026-12-07']);
    expect((await db.select().from(classSessions).where(eq(classSessions.title, 'Introduction to Birdwatching Outings'))).length).toBe(1);
  });

  test("keeps the library's 30 seconds for every request, reads its schedules, then learns ages from a program page", async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);

    const soon = fakeWeb();
    await runSync(db, soon.fetcher, later(10));
    expect(library(soon.calls)).toEqual([]);

    const schedule = fakeWeb();
    await runSync(db, schedule.fetcher, later(31));
    expect(library(schedule.calls)).toEqual(['https://www.bklynlibrary.org/locations/park-slope']);
    const toddler = await db.select().from(classSessions).where(eq(classSessions.title, 'Toddler Storytime'));
    expect(toddler.map((s) => s.date).sort()).toEqual(['2026-11-25', '2026-12-02']);
    expect(toddler[0]).toMatchObject({ ageMin: null, priceText: 'Free' });

    const central = fakeWeb();
    await runSync(db, central.fetcher, later(62));
    expect(library(central.calls)).toEqual(['https://www.bklynlibrary.org/locations/central']);

    const detail = fakeWeb();
    await runSync(db, detail.fetcher, later(93));
    const fetched = library(detail.calls);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toMatch(/^https:\/\/www\.bklynlibrary\.org\/calendar\//);
    const [parkSlope] = await db.select().from(places).where(eq(places.slug, 'bpl-park-slope'));
    const learnedTitle = ['All Ages Storytime', 'Babies & Books', 'Toddler Storytime'].find((t) => fetched[0].includes(t.toLowerCase().split(' ')[0]));
    const learned = (await db.select().from(classSessions).where(eq(classSessions.title, learnedTitle!))).filter((s) => s.placeId === parkSlope.id);
    expect(learned[0]).toMatchObject({ ageMin: 18, ageMax: 36, durationMin: 30, statusText: 'Sign-up opens 24h before' });

    // robots.txt is remembered for a day, so Sync now two hours later reads only the schedule.
    const nextMorning = fakeWeb();
    await runSync(db, nextMorning.fetcher, later(2 * 60 * 60), { force: true });
    expect(library(nextMorning.calls)).toEqual(['https://www.bklynlibrary.org/locations/park-slope']);
  });

  test("a site whose robots.txt can't be read is left alone for now", async () => {
    const db = await setup();
    const web = fakeWeb((url) => (url === 'https://youngethels.com/robots.txt' ? { status: 503, text: '' } : undefined));
    await runSync(db, web.fetcher, NOW);
    expect(web.calls).not.toContain('https://youngethels.com/events');
  });

  test('a website that fails keeps the last good classes and says so', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const down = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 503, text: '' } : undefined));
    await runSync(db, down.fetcher, later(120), { force: true });
    const ye = await source(db, 'young-ethels');
    expect((await sessionsOf(db, ye.id)).length).toBe(2);
    expect(ye.lastError).toBe("Couldn't read the schedule (HTTP 503). Showing what we had.");
  });

  test('a site that refuses or asks to slow down is left alone until tomorrow, even with Sync now', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const busy = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 429, text: '' } : undefined));
    await runSync(db, busy.fetcher, later(120), { force: true });
    expect((await source(db, 'young-ethels')).lastError).toBe("This site asked the app to slow down. We'll try again tomorrow.");

    const again = fakeWeb();
    await runSync(db, again.fetcher, later(240), { force: true });
    expect(again.calls.some((u) => u.includes('youngethels.com'))).toBe(false);
  });

  test('a page that suddenly lists nothing at all is a problem, even weeks later', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const blank = () => fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 200, text: '<html>Redesigned!</html>' } : undefined));
    await runSync(db, blank().fetcher, later(120), { force: true });
    const ye = await source(db, 'young-ethels');
    expect(ye.lastError).toBe("Couldn't read the schedule. Showing what we had.");
    expect((await sessionsOf(db, ye.id)).length).toBe(2);

    await runSync(db, blank().fetcher, later(14 * DAY), { force: true });
    expect((await source(db, 'young-ethels')).lastError).toBe("Couldn't read the schedule. Showing what we had.");
  });

  test('a readable page with no kids events this week is fine, and old sessions go away', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const html = fixture('youngethels.html').replaceAll(/TRL: TODDLER REQUEST LIVE![^<]*/g, 'OPEN MIC');
    const quiet = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 200, text: html } : undefined));
    await runSync(db, quiet.fetcher, later(120), { force: true });
    const ye = await source(db, 'young-ethels');
    expect(ye.lastError).toBeNull();
    expect(await sessionsOf(db, ye.id)).toEqual([]);
  });

  test('one website breaking the reader does not stop the others', async () => {
    const db = await setup();
    const badFeed = JSON.stringify({ events: [{ id: 9, title: 'Family Day', description: 'for families', start_date: '2026-11-31 10:00:00' }] });
    const web = fakeWeb((url) => (url.startsWith('https://www.prospectpark.org/wp-json/') ? { status: 200, text: badFeed } : undefined));
    await runSync(db, web.fetcher, NOW);
    expect((await source(db, 'tribe-events')).lastError).toBe("Couldn't read the schedule. Showing what we had.");
    const watched = (await db.select().from(places)).filter((p) => p.watchUrl);
    expect(watched.every((p) => p.watchHash)).toBe(true);
  });

  test('"Full" marks only the session whose page said so', async () => {
    const db = await setup();
    await readLibrarySchedules(db);
    const fullPage = fixture('bpl-detail.html').replace('Advance registration is required.', 'Advance registration is required. Registration has reached capacity.');
    const web = fakeWeb((url) => (url.startsWith('https://www.bklynlibrary.org/calendar/') ? { status: 200, text: fullPage } : undefined));
    await runSync(db, web.fetcher, later(93));
    const read = library(web.calls)[0];
    const [parkSlope] = await db.select().from(places).where(eq(places.slug, 'bpl-park-slope'));
    const same = (await db.select().from(classSessions).where(eq(classSessions.placeId, parkSlope.id))).filter((s) => read.includes(s.externalId));
    expect(same).toHaveLength(1);
    expect(same[0].statusText).toBe('Full');
    const siblings = (await db.select().from(classSessions).where(eq(classSessions.title, same[0].title))).filter(
      (s) => s.placeId === parkSlope.id && s.id !== same[0].id,
    );
    expect(siblings.length).toBeGreaterThan(0);
    expect(siblings.every((s) => s.statusText === 'Sign-up opens 24h before')).toBe(true);
  });

  test('a page change at a hand-typed place raises an alert, but not on the first check', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const bramble = async () => (await db.select().from(places).where(eq(places.slug, 'bramble')))[0];
    expect((await bramble()).watchChangedAt).toBeNull();
    const changed = fakeWeb((url) =>
      url === 'https://www.thebramble.space/classes' ? { status: 200, text: '<html><body><h1>Classes</h1><p>New: Baby Yoga</p></body></html>' } : undefined,
    );
    await runSync(db, changed.fetcher, later(120), { force: true });
    expect((await bramble()).watchChangedAt).not.toBeNull();
    await markWatchSeen(db, (await bramble()).id);
    expect((await bramble()).watchChangedAt).toBeNull();
  });

  test('a page the site asks apps not to read is never fetched', async () => {
    const db = await setup();
    const web = fakeWeb((url) => (url === 'https://youngethels.com/robots.txt' ? { status: 200, text: 'User-agent: *\nDisallow: /events' } : undefined));
    await runSync(db, web.fetcher, NOW);
    await runSync(db, web.fetcher, later(60));
    expect(web.calls).not.toContain('https://youngethels.com/events');
    expect((await source(db, 'young-ethels')).lastError).toBe('This site asks apps not to read this page.');
  });

  test('two people opening Classes at once start only one sync', async () => {
    const db = await setup();
    const [a, b] = await Promise.all([runSync(db, fakeWeb().fetcher, NOW), runSync(db, fakeWeb().fetcher, NOW)]);
    expect([a.ran, b.ran].sort()).toEqual([false, true]);
  });

  test('sessions that disappear from a schedule are removed', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const html = fixture('youngethels.html').replace(TRL, 'SOMETHING ELSE');
    const changed = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 200, text: html } : undefined));
    await runSync(db, changed.fetcher, later(120), { force: true });
    expect((await sessionsOf(db, (await source(db, 'young-ethels')).id)).map((s) => s.date)).toEqual(['2026-12-07']);
  });
});
