import { type ReadResult, type SourceEvent, textOf } from './common';

const SKIP_CATEGORIES = /^(food|volunteer|wellness)$/i;
const FAMILY = /all ages|famil|toddler|\bkids?\b|children|storytime/i;
const ADULTS_ONLY = /adults? only|\b(18|21)\s*\+|ages? (18|21) and (up|over|older)/i;

type TribeEvent = {
  id: number;
  title: string;
  description?: string;
  url?: string;
  cost?: string;
  start_date: string; // "2026-11-28 10:00:00", New York time
  end_date?: string;
  categories?: { name: string }[];
};

/** Prospect Park Alliance's event feed (The Events Calendar). Keeps family-friendly events, never adults-only ones. */
export function parseTribeEvents(json: string): ReadResult {
  let data: { events?: TribeEvent[] | null } | null;
  try {
    data = JSON.parse(json);
  } catch {
    return { events: [], entries: 0 };
  }
  const list = Array.isArray(data?.events) ? data.events : [];
  const out: SourceEvent[] = [];
  for (const e of list) {
    if (!e || typeof e.start_date !== 'string') continue;
    if ((e.categories ?? []).some((c) => SKIP_CATEGORIES.test(c.name))) continue;
    const title = textOf(e.title ?? '');
    const words = `${title} ${textOf(e.description ?? '')}`;
    if (!FAMILY.test(words) || ADULTS_ONLY.test(words)) continue;
    const [date, time] = e.start_date.split(' ');
    const start = time?.slice(0, 5);
    if (!date || !start) continue;
    let durationMin: number | null = null;
    if (e.end_date?.startsWith(date)) {
      const end = e.end_date.slice(11, 16);
      const mins = Number(end.slice(0, 2)) * 60 + Number(end.slice(3)) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3)));
      durationMin = mins > 0 ? mins : null;
    }
    out.push({
      externalId: String(e.id),
      title,
      date,
      start,
      durationMin,
      url: e.url ?? null,
      priceText: e.cost?.trim() || null,
      statusText: null,
      ageText: null,
    });
  }
  return { events: out, entries: list.length };
}
