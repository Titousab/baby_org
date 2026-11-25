import { createHash } from 'node:crypto';
import { and, asc, between, count, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { classSessions, hostFetches, places, programInfo, settings, sources } from '@/db/schema';
import type { DB } from '@/db/types';
import { addDays, todayNY } from '@/lib/time';
import { parseBplDetail, parseBplListing } from './adapters/bpl';
import type { SourceEvent } from './adapters/common';
import { parseTribeEvents } from './adapters/tribe';
import { parseYoungEthels } from './adapters/young-ethels';
import { parseAgeText } from './ages';
import { crawlDelaySeconds, robotsAllows } from './robots';

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

export const USER_AGENT = 'EzraFamilyCalendar/1.0 (private family app)';
const HOUR = 60 * 60 * 1000;
const REFRESH_AFTER = 20 * HOUR;
const RETRY_FAILED_AFTER = 1 * HOUR;
const LOCK_FOR = 10 * 60 * 1000;
const WINDOW_DAYS = 14;

const FAILED = (status: number) => `Couldn't read the schedule (HTTP ${status}). Showing what we had.`;
const UNREADABLE = "Couldn't read the schedule. Showing what we had.";
const UNREACHABLE = "Couldn't reach the website. Showing what we had.";
const NOT_ALLOWED = 'This site asks apps not to read this page.';

/** The real internet, with an honest name and a time limit. Never retries. */
export const webFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  return { status: res.status, text: await res.text() };
};

type Task =
  | { kind: 'listing'; host: string; url: string; sourceId: number; placeId: number; adapter: string }
  | { kind: 'detail'; host: string; url: string; sourceId: number; title: string }
  | { kind: 'watch'; host: string; url: string; placeId: number; previousHash: string | null };

const hostOf = (url: string) => new URL(url).host;
const older = (at: Date | null, than: number, now: Date) => !at || now.getTime() - at.getTime() > than;

function listingUrl(adapter: string, url: string, today: string): string {
  if (adapter !== 'tribe-events') return url;
  return `${url}?per_page=50&start_date=${today}&end_date=${addDays(today, WINDOW_DAYS - 1)}`;
}

/** Everything that could be fetched now, most important first (schedules, then page checks, then program pages). */
async function dueTasks(db: DB, now: Date, force: boolean): Promise<Task[]> {
  const today = todayNY(now);
  const tasks: Task[] = [];

  for (const s of await db.select().from(sources).orderBy(asc(sources.id))) {
    const stale = force || older(s.lastSuccessAt, REFRESH_AFTER, now);
    const canRetry = force || !s.lastError || older(s.lastAttemptAt, RETRY_FAILED_AFTER, now);
    if (stale && canRetry) {
      const url = listingUrl(s.adapter, s.url, today);
      tasks.push({ kind: 'listing', host: hostOf(url), url, sourceId: s.id, placeId: s.placeId, adapter: s.adapter });
    }
  }

  for (const p of await db.select().from(places).where(isNotNull(places.watchUrl)).orderBy(asc(places.id))) {
    if (force || older(p.watchCheckedAt, REFRESH_AFTER, now)) {
      tasks.push({ kind: 'watch', host: hostOf(p.watchUrl!), url: p.watchUrl!, placeId: p.id, previousHash: p.watchHash });
    }
  }

  const pending = await db
    .select()
    .from(programInfo)
    .where(and(isNull(programInfo.fetchedAt), isNotNull(programInfo.detailUrl)))
    .orderBy(asc(programInfo.sourceId), asc(programInfo.title));
  for (const p of pending) {
    tasks.push({ kind: 'detail', host: hostOf(p.detailUrl!), url: p.detailUrl!, sourceId: p.sourceId, title: p.title });
  }
  return tasks;
}

export async function isSyncDue(db: DB, now: Date = new Date()): Promise<boolean> {
  return (await dueTasks(db, now, false)).length > 0;
}

async function takeLock(db: DB, now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - LOCK_FOR);
  const got = await db
    .update(settings)
    .set({ syncStartedAt: now })
    .where(and(eq(settings.id, 1), or(isNull(settings.syncStartedAt), lt(settings.syncStartedAt, cutoff))))
    .returning({ id: settings.id });
  return got.length > 0;
}

/**
 * Reads what's due from the places' websites, politely: at most one page per website per run,
 * never sooner than the site's crawl delay, never pages its robots.txt disallows.
 */
export async function runSync(db: DB, fetcher: Fetcher, now: Date = new Date(), opts: { force?: boolean } = {}) {
  if (!(await takeLock(db, now))) return { ran: false, fetched: [] as string[] };
  const fetched: string[] = [];
  try {
    const robotsByHost = new Map<string, string>();
    const robotsFor = async (host: string) => {
      if (!robotsByHost.has(host)) {
        let text = '';
        try {
          const res = await fetcher(`https://${host}/robots.txt`);
          text = res.status === 200 ? res.text : '';
        } catch {
          text = '';
        }
        robotsByHost.set(host, text);
      }
      return robotsByHost.get(host)!;
    };

    const chosen = new Map<string, Task>();
    for (const t of await dueTasks(db, now, Boolean(opts.force))) if (!chosen.has(t.host)) chosen.set(t.host, t);

    for (const task of chosen.values()) {
      const robots = await robotsFor(task.host);
      const [last] = await db.select().from(hostFetches).where(eq(hostFetches.host, task.host));
      const waitMs = crawlDelaySeconds(robots) * 1000;
      if (last && now.getTime() - last.lastFetchAt.getTime() < waitMs) continue;

      if (!robotsAllows(robots, new URL(task.url).pathname)) {
        if (task.kind === 'listing') await failSource(db, task.sourceId, now, NOT_ALLOWED);
        if (task.kind === 'detail') await markDetailDone(db, task.sourceId, task.title, now);
        if (task.kind === 'watch') await db.update(places).set({ watchCheckedAt: now }).where(eq(places.id, task.placeId));
        continue;
      }

      await db
        .insert(hostFetches)
        .values({ host: task.host, lastFetchAt: now })
        .onConflictDoUpdate({ target: hostFetches.host, set: { lastFetchAt: now } });
      fetched.push(task.url);

      let res: { status: number; text: string } | null = null;
      try {
        res = await fetcher(task.url);
      } catch {
        res = null;
      }

      if (task.kind === 'listing') await handleListing(db, task, res, now);
      else if (task.kind === 'detail') await handleDetail(db, task, res, now);
      else await handleWatch(db, task, res, now);
    }
    return { ran: true, fetched };
  } finally {
    await db.update(settings).set({ syncStartedAt: null }).where(eq(settings.id, 1));
  }
}

async function failSource(db: DB, sourceId: number, now: Date, message: string) {
  await db.update(sources).set({ lastAttemptAt: now, lastError: message }).where(eq(sources.id, sourceId));
}

function parseListing(adapter: string, text: string, url: string): SourceEvent[] {
  if (adapter === 'bpl-branch') return parseBplListing(text, new URL(url).origin);
  if (adapter === 'young-ethels') return parseYoungEthels(text);
  return parseTribeEvents(text);
}

async function handleListing(db: DB, task: Extract<Task, { kind: 'listing' }>, res: { status: number; text: string } | null, now: Date) {
  if (!res) return failSource(db, task.sourceId, now, UNREACHABLE);
  if (res.status !== 200) return failSource(db, task.sourceId, now, FAILED(res.status));

  const today = todayNY(now);
  const last = addDays(today, WINDOW_DAYS - 1);
  const inWindow = and(eq(classSessions.sourceId, task.sourceId), between(classSessions.date, today, last));
  const events = parseListing(task.adapter, res.text, task.url).filter((e) => e.date >= today && e.date <= last);

  if (!events.length) {
    const [{ n }] = await db.select({ n: count() }).from(classSessions).where(inWindow);
    if (n > 0) return failSource(db, task.sourceId, now, UNREADABLE);
  }

  const known = new Map((await db.select().from(programInfo).where(eq(programInfo.sourceId, task.sourceId))).map((p) => [p.title, p]));
  await db.transaction(async (tx) => {
    for (const e of events) {
      const info = known.get(e.title);
      const ages = parseAgeText(e.ageText ?? info?.ageText ?? '');
      const values = {
        placeId: task.placeId,
        sourceId: task.sourceId,
        externalId: e.externalId,
        title: e.title,
        date: e.date,
        startTime: e.start,
        durationMin: e.durationMin ?? info?.durationMin ?? null,
        ageMin: ages?.min ?? null,
        ageMax: ages?.max ?? null,
        priceText: e.priceText,
        statusText: e.statusText ?? info?.statusText ?? null,
        bookingUrl: e.url,
      };
      const { placeId, sourceId, externalId, ...changes } = values;
      void placeId;
      void sourceId;
      void externalId;
      await tx.insert(classSessions).values(values).onConflictDoUpdate({
        target: [classSessions.sourceId, classSessions.externalId],
        set: changes,
      });
      if (task.adapter === 'bpl-branch' && !info) {
        await tx.insert(programInfo).values({ sourceId: task.sourceId, title: e.title, detailUrl: e.url }).onConflictDoNothing();
        known.set(e.title, { sourceId: task.sourceId, title: e.title, detailUrl: e.url, ageText: null, ageMin: null, ageMax: null, durationMin: null, statusText: null, fetchedAt: null });
      }
    }
    const seen = events.map((e) => e.externalId);
    const stale = await tx.select({ id: classSessions.id, externalId: classSessions.externalId }).from(classSessions).where(inWindow);
    for (const s of stale) if (!seen.includes(s.externalId)) await tx.delete(classSessions).where(eq(classSessions.id, s.id));
    await tx.update(sources).set({ lastSuccessAt: now, lastAttemptAt: now, lastError: null }).where(eq(sources.id, task.sourceId));
  });
}

async function markDetailDone(db: DB, sourceId: number, title: string, now: Date) {
  await db.update(programInfo).set({ fetchedAt: now }).where(and(eq(programInfo.sourceId, sourceId), eq(programInfo.title, title)));
}

async function handleDetail(db: DB, task: Extract<Task, { kind: 'detail' }>, res: { status: number; text: string } | null, now: Date) {
  // A page that can't be read is not retried; the program simply shows "Age not listed".
  if (!res || res.status !== 200) return markDetailDone(db, task.sourceId, task.title, now);
  const d = parseBplDetail(res.text);
  const ages = parseAgeText(d.ageText ?? '');
  const where = and(eq(programInfo.sourceId, task.sourceId), eq(programInfo.title, task.title));
  await db
    .update(programInfo)
    .set({ ageText: d.ageText, ageMin: ages?.min ?? null, ageMax: ages?.max ?? null, durationMin: d.durationMin, statusText: d.statusText, fetchedAt: now })
    .where(where);
  await db
    .update(classSessions)
    .set({
      ageMin: ages?.min ?? null,
      ageMax: ages?.max ?? null,
      durationMin: sql`coalesce(${classSessions.durationMin}, ${d.durationMin})`,
      statusText: d.statusText,
    })
    .where(and(eq(classSessions.sourceId, task.sourceId), eq(classSessions.title, task.title)));
}

/** What a page says, without its code, so only real content changes count. */
export function pageFingerprint(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(text).digest('hex');
}

async function handleWatch(db: DB, task: Extract<Task, { kind: 'watch' }>, res: { status: number; text: string } | null, now: Date) {
  if (!res || res.status !== 200) {
    await db.update(places).set({ watchCheckedAt: now }).where(eq(places.id, task.placeId));
    return;
  }
  const hash = pageFingerprint(res.text);
  const changed = task.previousHash !== null && task.previousHash !== hash;
  await db
    .update(places)
    .set({ watchHash: hash, watchCheckedAt: now, ...(changed ? { watchChangedAt: now } : {}) })
    .where(eq(places.id, task.placeId));
}

/** "Done": the family has looked at the changed page. */
export async function markWatchSeen(db: DB, placeId: number): Promise<void> {
  await db.update(places).set({ watchChangedAt: null }).where(eq(places.id, placeId));
}
