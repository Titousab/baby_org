import { type ReadResult, type SourceEvent, textOf, to24h } from './common';

const KIDS = /toddler|kid|famil|bab(y|ies)|children/i;
const PAGE = 'https://youngethels.com/events';

/**
 * Young Ethel's events page: each day is a <time class="font-black"> followed by a list of
 * <time class="font-bold">4:30pm</time> … <span class="block">TITLE (Category)</span>.
 * Only events that mention kids or families are kept.
 */
export function parseYoungEthels(html: string): ReadResult {
  const out = new Map<string, SourceEvent>();
  let entries = 0;
  const day = /<time dateTime="(\d{4}-\d{2}-\d{2})T[^"]*"[^>]*class="font-black"[^>]*>[\s\S]*?<\/time>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g;
  const item = /<time[^>]*aria-label="([^"]+)"[^>]*class="font-bold"[^>]*>[\s\S]*?<\/time>\s*<div[^>]*>\s*<span class="block">([\s\S]*?)<\/span>/g;

  for (const [, date, list] of html.matchAll(day)) {
    for (const [, label, rawTitle] of list.matchAll(item)) {
      const title = textOf(rawTitle).replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (title) entries++;
      if (!title || !KIDS.test(title)) continue;
      const t = /^(\d{1,2})(?::(\d{2}))?(?:\s*-\s*\d{1,2}(?::\d{2})?)?\s*(am|pm)/i.exec(label.trim());
      if (!t) continue;
      const start = to24h(Number(t[1]), Number(t[2] ?? 0), t[3]);
      const externalId = `${date} ${start} ${title}`;
      out.set(externalId, { externalId, title, date, start, durationMin: 60, url: PAGE, priceText: null, statusText: null, ageText: null });
    }
  }
  return { events: [...out.values()], entries };
}
