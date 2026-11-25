import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseBplDetail, parseBplListing } from '@/lib/classes/adapters/bpl';
import { parseTribeEvents } from '@/lib/classes/adapters/tribe';
import { parseYoungEthels } from '@/lib/classes/adapters/young-ethels';
import { crawlDelaySeconds, robotsAllows } from '@/lib/classes/robots';

const fixture = (name: string) => readFileSync(path.join(process.cwd(), 'tests/fixtures/sources', name), 'utf8');

describe('Brooklyn Public Library', () => {
  const { events, entries } = parseBplListing(fixture('bpl-branch.html'), 'https://www.bklynlibrary.org');

  test("keeps the little ones' programs with date, time and their own link", () => {
    const toddler = events.filter((e) => e.title === 'Toddler Storytime');
    expect(toddler.map((e) => `${e.date} ${e.start}`)).toEqual(['2026-11-25 11:15', '2026-12-02 11:15']);
    expect(toddler[0].externalId.startsWith('/calendar/toddler-storytime-park-slope-library-2026112')).toBe(true);
    expect(toddler[0].url).toBe('https://www.bklynlibrary.org/calendar/toddler-storytime-park-slope-library-20261125-1115am');
    expect(toddler[0].priceText).toBe('Free');
    expect(events.some((e) => e.title === 'Babies & Books' && e.date === '2026-12-02' && e.start === '10:30')).toBe(true);
  });

  test('leaves out programs for grown-ups, and counts everything the page listed', () => {
    expect(events.some((e) => /yoga|zumba|fitness|robotics/i.test(e.title))).toBe(false);
    expect(entries).toBe(20);
  });

  test('matches whole words, so History, Laptop or Display are not kids programs', () => {
    const card = (t: string, slug: string) => `<h5 class="card-title"><a href="/calendar/${slug}-20261201-1000am">${t}</a></h5>`;
    const html = [card('Local History Talk', 'a'), card('Laptop Lab', 'b'), card('Using the Catalog', 'c'), card('Display Case Tour', 'd'), card('Baby Lapsit', 'e'), card('Toddler Storytime', 'f')].join('');
    expect(parseBplListing(html, 'https://x').events.map((e) => e.title)).toEqual(['Baby Lapsit', 'Toddler Storytime']);
  });

  test("an event's own page gives its ages, length and sign-up rule", () => {
    const d = parseBplDetail(fixture('bpl-detail.html'));
    expect(d.ageText).toContain('18 months to 3 years');
    expect(d.durationMin).toBe(30);
    expect(d.statusText).toBe('Sign-up opens 24h before');
    expect(d.full).toBe(false);
  });
});

describe("Young Ethel's", () => {
  test('keeps the toddler sing-along and nothing for grown-ups', () => {
    const { events, entries } = parseYoungEthels(fixture('youngethels.html'));
    expect(entries).toBeGreaterThan(10);
    const trl = events.filter((e) => e.title.startsWith('TRL: TODDLER REQUEST LIVE!'));
    expect(trl.map((e) => `${e.date} ${e.start}`)).toContain('2026-11-30 16:30');
    expect(events.some((e) => /IMPROV|COMEDY|NERDS/i.test(e.title))).toBe(false);
    expect(trl[0]).toMatchObject({ durationMin: 60, url: 'https://youngethels.com/events' });
  });
});

describe('Prospect Park', () => {
  test('keeps family-friendly events and drops markets and clinics', () => {
    const { events, entries } = parseTribeEvents(fixture('tribe.json'));
    expect(entries).toBe(10);
    const titles = events.map((e) => e.title);
    expect(titles).toContain('Introduction to Birdwatching Outings');
    expect(titles.some((t) => /Greenmarket|Mobile Medical|Volunteer/i.test(t))).toBe(false);
  });
});

test('Prospect Park: adults-only events are left out', () => {
  const feed = JSON.stringify({ events: [{ id: 1, title: 'Family Lantern Walk', description: 'Fun for the whole family', start_date: '2026-12-01 17:00:00' }, { id: 2, title: 'Wine Tasting for Families', description: 'Adults only (21+)', start_date: '2026-12-01 18:00:00' }] });
  expect(parseTribeEvents(feed).events.map((e) => e.title)).toEqual(['Family Lantern Walk']);
});

describe('robots.txt', () => {
  test('the library allows its pages and asks for 30 seconds between requests', () => {
    const robots = fixture('bpl-robots.txt');
    expect(robotsAllows(robots, '/locations/park-slope')).toBe(true);
    expect(robotsAllows(robots, '/admin/x')).toBe(false);
    expect(crawlDelaySeconds(robots)).toBe(30);
    expect(robotsAllows('User-agent: *\nDisallow: /events', '/events')).toBe(false);
    expect(robotsAllows('', '/anything')).toBe(true);
  });
});

test('every reader copes with an empty or broken page', () => {
  expect(parseBplListing('<html></html>', 'https://x')).toEqual({ events: [], entries: 0 });
  expect(parseBplDetail('<html></html>')).toEqual({ ageText: null, durationMin: null, statusText: null, full: false });
  expect(parseYoungEthels('<html></html>')).toEqual({ events: [], entries: 0 });
  expect(parseTribeEvents('not json')).toEqual({ events: [], entries: 0 });
  expect(parseTribeEvents('null')).toEqual({ events: [], entries: 0 });
  expect(parseTribeEvents('{"events":null}')).toEqual({ events: [], entries: 0 });
});
