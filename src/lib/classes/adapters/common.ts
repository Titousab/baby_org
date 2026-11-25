/** One event read from a place's website. Times are New York local. */
export type SourceEvent = {
  externalId: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  durationMin: number | null;
  url: string | null;
  priceText: string | null;
  statusText: string | null;
  ageText: string | null;
};

/** Kept events, plus how many entries the page listed before filtering (0 means the page could not be read). */
export type ReadResult = { events: SourceEvent[]; entries: number };

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  hellip: '…',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Visible text of an HTML fragment. */
export function textOf(html: string): string {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "11:15", "am" → "11:15"; "4", "pm" → "16:00". */
export function to24h(hour: number, minute: number, ampm: string): string {
  const pm = ampm.toLowerCase() === 'pm';
  const h = (hour % 12) + (pm ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
