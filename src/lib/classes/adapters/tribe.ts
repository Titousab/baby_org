import { type SourceEvent, textOf } from './common';

const SKIP_CATEGORIES = /^(food|volunteer|wellness)$/i;
const FAMILY = /all ages|famil|toddler|\bkids?\b|children|storytime/i;

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

/** Prospect Park Alliance's event feed (The Events Calendar). Keeps family-friendly events. */
export function parseTribeEvents(json: string): SourceEvent[] {
  let data: { events?: TribeEvent[] };
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const out: SourceEvent[] = [];
  for (const e of data.events ?? []) {
    if ((e.categories ?? []).some((c) => SKIP_CATEGORIES.test(c.name))) continue;
    const title = textOf(e.title ?? '');
    if (!FAMILY.test(`${title} ${textOf(e.description ?? '')}`)) continue;
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
  return out;
}
