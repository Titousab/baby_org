import { eq } from 'drizzle-orm';
import { manualClasses, places, settings, sources } from '@/db/schema';
import type { DB } from '@/db/types';
import { ensureSettings } from '@/lib/bootstrap';
import seed from '../../../seed/manual-classes.json';

type Adapter = 'bpl-branch' | 'young-ethels' | 'tribe-events';
type PlaceSeed = {
  slug: string;
  name: string;
  color: string;
  kind: 'class' | 'idea';
  websiteUrl: string;
  bookingUrl: string | null;
  watchUrl: string | null;
  source: { adapter: Adapter; url: string } | null;
  /** The name used for it in seed/manual-classes.json. */
  seedName?: string;
};

/** Ezra's places, researched 2026-11-25 (spec §7.2a, §7.3). */
export const PLACES_SEED: PlaceSeed[] = [
  {
    slug: 'bpl-park-slope',
    name: 'Park Slope Library',
    color: 'sage',
    kind: 'class',
    websiteUrl: 'https://www.bklynlibrary.org/locations/park-slope',
    bookingUrl: null,
    watchUrl: null,
    source: { adapter: 'bpl-branch', url: 'https://www.bklynlibrary.org/locations/park-slope' },
  },
  {
    slug: 'young-ethels',
    name: "Young Ethel's",
    color: 'lav',
    kind: 'class',
    websiteUrl: 'https://youngethels.com/events',
    bookingUrl: 'https://youngethels.com/events',
    watchUrl: null,
    source: { adapter: 'young-ethels', url: 'https://youngethels.com/events' },
  },
  {
    slug: 'bramble',
    name: 'The Bramble',
    color: 'sky',
    kind: 'class',
    websiteUrl: 'https://www.thebramble.space/',
    bookingUrl: 'https://www.thebramble.space/classschedule',
    watchUrl: 'https://www.thebramble.space/classes',
    source: null,
    seedName: 'The Bramble',
  },
  {
    slug: 'good-day',
    name: 'Good Day Play Cafe',
    color: 'peach',
    kind: 'class',
    websiteUrl: 'https://www.gooddayplaycafe.com/',
    bookingUrl: 'https://www.gooddayplaycafe.com/classes',
    watchUrl: 'https://www.gooddayplaycafe.com/classes',
    source: null,
    seedName: 'Good Day Play Cafe',
  },
  {
    slug: 'treasure-trunk',
    name: 'Treasure Trunk Theatre',
    color: 'butter',
    kind: 'class',
    websiteUrl: 'https://www.treasuretrunktheatre.com/',
    bookingUrl: 'https://www.treasuretrunktheatre.com/classes-at-tt-park-slope/',
    watchUrl: 'https://www.treasuretrunktheatre.com/classes-at-tt-park-slope/',
    source: null,
    seedName: 'Treasure Trunk Theatre',
  },
  {
    slug: 'bpl-central',
    name: 'Central Library',
    color: 'sage',
    kind: 'idea',
    websiteUrl: 'https://www.bklynlibrary.org/locations/central',
    bookingUrl: null,
    watchUrl: null,
    source: { adapter: 'bpl-branch', url: 'https://www.bklynlibrary.org/locations/central' },
  },
  {
    slug: 'prospect-park',
    name: 'Prospect Park',
    color: 'sage',
    kind: 'idea',
    websiteUrl: 'https://www.prospectpark.org/events/',
    bookingUrl: null,
    watchUrl: null,
    source: { adapter: 'tribe-events', url: 'https://www.prospectpark.org/wp-json/tribe/events/v1/events' },
  },
];

type SeedClass = (typeof seed.classes)[number];

/** Adds the places, their sources and the screenshot classes, once ever, so later edits stick. */
export async function ensurePlaces(db: DB): Promise<void> {
  await ensureSettings(db);
  await db.transaction(async (tx) => {
    const [row] = await tx.select({ seeded: settings.placesSeeded }).from(settings).where(eq(settings.id, 1));
    if (row?.seeded) return;

    const idBySeedName = new Map<string, number>();
    for (const p of PLACES_SEED) {
      const [existing] = await tx.select({ id: places.id }).from(places).where(eq(places.slug, p.slug));
      let id = existing?.id;
      if (!id) {
        const { source, seedName, ...values } = p;
        void seedName;
        [{ id }] = await tx.insert(places).values(values).returning({ id: places.id });
        if (source) await tx.insert(sources).values({ placeId: id, adapter: source.adapter, url: source.url });
      }
      if (p.seedName) idBySeedName.set(p.seedName, id);
    }

    for (const c of seed.classes as SeedClass[]) {
      const placeId = idBySeedName.get(c.place);
      if (!placeId) continue;
      await tx.insert(manualClasses).values({
        placeId,
        title: c.title,
        firstDate: c.first_date,
        startTime: c.start_time,
        durationMin: c.duration_min,
        ageMin: c.age_min_months,
        ageMax: c.age_max_months,
        priceText: c.price_text,
        note: c.note,
        bookingUrl: c.booking_url,
        repeatsWeekly: c.repeats_weekly,
        untilDate: c.until_date,
      });
    }
    await tx.update(settings).set({ placesSeeded: true }).where(eq(settings.id, 1));
  });
}
