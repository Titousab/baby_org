import { decodeEntities, type SourceEvent, textOf, to24h } from './common';

/** Programs for little ones; everything else on the branch page is left out. */
const KIDS = /story|bab(y|ies)|toddler|music|sing|danc|play|kid|famil|preschool|rhyme|puppet|lap/i;

/**
 * A library branch page lists upcoming events as cards. Each event's own link ends with its date and time,
 * e.g. /calendar/toddler-storytime-park-slope-library-20261125-1115am.
 */
export function parseBplListing(html: string, baseUrl: string): SourceEvent[] {
  const out = new Map<string, SourceEvent>();
  const card = /<h5 class="card-title"[^>]*>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const [, href, rawTitle] of html.matchAll(card)) {
    const when = /-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(am|pm)$/i.exec(href);
    const title = textOf(rawTitle);
    if (!when || !title || !KIDS.test(title)) continue;
    const [, y, mo, d, h, mi, ap] = when;
    const path = decodeEntities(href);
    out.set(path, {
      externalId: path,
      title,
      date: `${y}-${mo}-${d}`,
      start: to24h(Number(h), Number(mi), ap),
      durationMin: null,
      url: new URL(href, baseUrl).toString(),
      priceText: 'Free',
      statusText: null,
      ageText: null,
    });
  }
  return [...out.values()];
}

/** An event's own page: its age range, length and sign-up rule. */
export function parseBplDetail(html: string): { ageText: string | null; durationMin: number | null; statusText: string | null } {
  const meta = /<meta name="description" content="([^"]*)"/i.exec(html);
  const description = meta ? decodeEntities(meta[1]) : '';
  const sentences = description.split(/(?<=\.)\s+/);
  const ageText = sentences.find((s) => /\d+(\.\d+)?\s*(months?|years?|yrs?|mos?)\b/i.test(s))?.trim() ?? null;

  const text = textOf(html);
  const range = /(\d{1,2}):(\d{2})\s*(am|pm)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(text);
  let durationMin: number | null = null;
  if (range) {
    const [, h1, m1, a1, h2, m2, a2] = range;
    const start = to24h(Number(h1), Number(m1), a1).split(':').map(Number);
    const end = to24h(Number(h2), Number(m2), a2).split(':').map(Number);
    const mins = end[0] * 60 + end[1] - (start[0] * 60 + start[1]);
    durationMin = mins > 0 ? mins : null;
  }

  const all = `${description} ${text}`;
  let statusText: string | null = null;
  if (/reached capacity|registration is full/i.test(all)) statusText = 'Full';
  else if (/registration opens 24 hours before/i.test(all)) statusText = 'Sign-up opens 24h before';
  else if (/registration is required/i.test(all)) statusText = 'Sign-up required';

  return { ageText, durationMin, statusText };
}
