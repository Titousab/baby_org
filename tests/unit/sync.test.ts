import { readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { classSessions, places, sources } from '@/db/schema';
import type { DB } from '@/db/types';
import { ensurePlaces } from '@/lib/classes/places-seed';
import { type Fetcher, isSyncDue, markWatchSeen, runSync } from '@/lib/classes/sync';
import { createTestDb } from '../helpers/test-db';

const fixture = (name: string) => readFileSync(path.join(process.cwd(), 'tests/fixtures/sources', name), 'utf8');
const NOW = new Date('2026-11-25T15:00:00Z'); // 10:00 am in New York
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

type Pages = Record<string, { status: number; text: string }>;

/** A pretend internet: answers from the saved pages and remembers every URL asked for. */
function fakeWeb(overrides: (url: string) => { status: number; text: string } | undefined = () => undefined) {
  const calls: string[] = [];
  const pages: Pages = {
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

const isPage = (u: string) => !u.endsWith('/robots.txt');
const libraryPages = (calls: string[]) => calls.filter((u) => u.includes('bklynlibrary.org') && isPage(u));

async function sessionsTitled(db: DB, title: string) {
  return db.select().from(classSessions).where(eq(classSessions.title, title));
}

describe('runSync', () => {
  test('the first run reads one page per website and saves the classes', async () => {
    const db = await setup();
    expect(await isSyncDue(db, NOW)).toBe(true);
    const web = fakeWeb();
    const result = await runSync(db, web.fetcher, NOW);

    expect(result.ran).toBe(true);
    expect(libraryPages(web.calls)).toEqual(['https://www.bklynlibrary.org/locations/park-slope']);
    expect(web.calls).toContain('https://youngethels.com/events');
    const toddler = await sessionsTitled(db, 'Toddler Storytime');
    expect(toddler.map((s) => s.date).sort()).toEqual(['2026-11-25', '2026-12-02']);
    expect(toddler[0]).toMatchObject({ ageMin: null, priceText: 'Free' });
    expect((await sessionsTitled(db, 'Introduction to Birdwatching Outings')).length).toBe(1);
  });

  test("keeps to the library's 30 seconds, then learns a program's ages from its own page", async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);

    const soon = fakeWeb();
    await runSync(db, soon.fetcher, later(10));
    expect(libraryPages(soon.calls)).toEqual([]);

    const next = fakeWeb();
    await runSync(db, next.fetcher, later(31));
    expect(libraryPages(next.calls)).toEqual(['https://www.bklynlibrary.org/locations/central']);

    const detail = fakeWeb();
    await runSync(db, detail.fetcher, later(62));
    const fetched = libraryPages(detail.calls);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toMatch(/^https:\/\/www\.bklynlibrary\.org\/calendar\//);
    const learnedTitle = ['All Ages Storytime', 'Babies & Books', 'Toddler Storytime'].find((t) => fetched[0].includes(t.toLowerCase().split(' ')[0]));
    // Ages learned from a Park Slope event page apply to Park Slope only: branches can differ.
    const [parkSlope] = await db.select().from(places).where(eq(places.slug, 'bpl-park-slope'));
    const learned = (await sessionsTitled(db, learnedTitle!)).filter((s) => s.placeId === parkSlope.id);
    expect(learned.length).toBeGreaterThan(0);
    expect(learned[0]).toMatchObject({ ageMin: 18, ageMax: 36, durationMin: 30, statusText: 'Sign-up opens 24h before' });
  });

  test('a website that fails keeps the last good classes and says so', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const down = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 503, text: '' } : undefined));
    await runSync(db, down.fetcher, later(120), { force: true });

    expect((await db.select().from(classSessions).where(eq(classSessions.title, 'TRL: TODDLER REQUEST LIVE! A FAMILY FRIENDLY HAPPY HOUR FEATURING A SING-ALONG'))).length).toBe(2);
    const [ye] = await db.select().from(sources).where(eq(sources.adapter, 'young-ethels'));
    expect(ye.lastError).toBe("Couldn't read the schedule (HTTP 503). Showing what we had.");
  });

  test('a page that suddenly shows no events is treated as a problem, not as "no classes"', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const blank = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 200, text: '<html>Redesigned!</html>' } : undefined));
    await runSync(db, blank.fetcher, later(120), { force: true });
    const [ye] = await db.select().from(sources).where(eq(sources.adapter, 'young-ethels'));
    expect(ye.lastError).toBe("Couldn't read the schedule. Showing what we had.");
    expect((await db.select().from(classSessions).where(eq(classSessions.sourceId, ye.id))).length).toBe(2);
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
    expect(web.calls).not.toContain('https://youngethels.com/events');
    const [ye] = await db.select().from(sources).where(eq(sources.adapter, 'young-ethels'));
    expect(ye.lastError).toBe('This site asks apps not to read this page.');
  });

  test('two people opening Classes at once start only one sync', async () => {
    const db = await setup();
    const [a, b] = await Promise.all([runSync(db, fakeWeb().fetcher, NOW), runSync(db, fakeWeb().fetcher, NOW)]);
    expect([a.ran, b.ran].sort()).toEqual([false, true]);
  });

  test('sessions that disappear from a schedule are removed', async () => {
    const db = await setup();
    await runSync(db, fakeWeb().fetcher, NOW);
    const html = fixture('youngethels.html').replace(/TRL: TODDLER REQUEST LIVE![^<]*/, 'SOMETHING ELSE');
    const changed = fakeWeb((url) => (url === 'https://youngethels.com/events' ? { status: 200, text: html } : undefined));
    await runSync(db, changed.fetcher, later(120), { force: true });
    const [ye] = await db.select().from(sources).where(eq(sources.adapter, 'young-ethels'));
    const left = await db.select().from(classSessions).where(and(eq(classSessions.sourceId, ye.id)));
    expect(left.map((s) => s.date)).toEqual(['2026-12-07']);
  });
});
