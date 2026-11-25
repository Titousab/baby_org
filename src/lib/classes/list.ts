import { between } from 'drizzle-orm';
import { ageOverrides, classSessions, manualClasses, places } from '@/db/schema';
import type { DB } from '@/db/types';
import { addDays, toMin } from '@/lib/time';
import { expandManual, titleKey } from './manual';

export type ClassItem = {
  key: string;
  placeId: number;
  placeName: string;
  color: string;
  kind: 'class' | 'idea';
  title: string;
  date: string;
  start: string;
  durationMin: number | null;
  ageMin: number | null;
  ageMax: number | null;
  ageOverridden: boolean;
  priceText: string | null;
  statusText: string | null;
  bookingUrl: string | null;
  note: string | null;
  manualId: number | null;
};

/** Classes and nearby ideas for today and the next 6 days, without ones that already started today. */
export async function listClasses(db: DB, today: string, nowMin: number): Promise<ClassItem[]> {
  const last = addDays(today, 6);
  const placeRows = await db.select().from(places);
  const placeById = new Map(placeRows.map((p) => [p.id, p]));
  const overrides = await db.select().from(ageOverrides);
  const overrideFor = (placeId: number, title: string) =>
    overrides.find((o) => o.placeId === placeId && o.titleKey === titleKey(title));

  const items: ClassItem[] = [];
  const push = (base: Omit<ClassItem, 'placeName' | 'color' | 'kind' | 'ageOverridden'>) => {
    const place = placeById.get(base.placeId);
    if (!place) return;
    const o = overrideFor(base.placeId, base.title);
    items.push({
      ...base,
      placeName: place.name,
      color: place.color,
      kind: place.kind,
      ageMin: o ? o.ageMin : base.ageMin,
      ageMax: o ? o.ageMax : base.ageMax,
      ageOverridden: Boolean(o),
      bookingUrl: base.bookingUrl ?? place.bookingUrl ?? place.websiteUrl,
    });
  };

  const sessions = await db.select().from(classSessions).where(between(classSessions.date, today, last));
  for (const s of sessions) {
    push({
      key: `s-${s.id}`,
      placeId: s.placeId,
      title: s.title,
      date: s.date,
      start: s.startTime,
      durationMin: s.durationMin,
      ageMin: s.ageMin,
      ageMax: s.ageMax,
      priceText: s.priceText,
      statusText: s.statusText,
      bookingUrl: s.bookingUrl,
      note: null,
      manualId: null,
    });
  }

  for (const m of await db.select().from(manualClasses)) {
    for (const date of expandManual(m, today, last)) {
      push({
        key: `m-${m.id}-${date}`,
        placeId: m.placeId,
        title: m.title,
        date,
        start: m.startTime,
        durationMin: m.durationMin,
        ageMin: m.ageMin,
        ageMax: m.ageMax,
        priceText: m.priceText,
        statusText: null,
        bookingUrl: m.bookingUrl,
        note: m.note,
        manualId: m.id,
      });
    }
  }

  return items
    .filter((i) => i.date > today || toMin(i.start) >= nowMin)
    .sort((a, b) => a.date.localeCompare(b.date) || toMin(a.start) - toMin(b.start) || a.title.localeCompare(b.title));
}

/** The places for the chips and the places sheet. */
export async function listPlaces(db: DB) {
  return db.select().from(places).orderBy(places.id);
}

