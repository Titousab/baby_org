import { between } from 'drizzle-orm';
import { after } from 'next/server';
import { getDb } from '@/db/client';
import { daysOff, manualClasses, sources } from '@/db/schema';
import { AvatarButton } from '@/components/AvatarButton';
import { CalendarTabs } from '@/components/CalendarTabs';
import { ClassesView } from '@/components/classes/ClassesView';
import type { PlaceView } from '@/components/classes/types';
import { requireUser } from '@/lib/auth/current-user';
import { isFamily } from '@/lib/auth/permissions';
import { listClasses, listPlaces } from '@/lib/classes/list';
import { isSyncDue, runSync, webFetcher } from '@/lib/classes/sync';
import { placeStatusLine, whenLabel } from '@/lib/classes/view';
import { getSettings } from '@/lib/settings';
import { addDays, minutesNowNY, todayNY } from '@/lib/time';

export default async function ClassesPage() {
  const user = await requireUser();
  const now = new Date();
  const today = todayNY(now);
  const db = await getDb();

  // Refresh the synced schedules in the background, after this page is sent.
  if (!process.env.SYNC_DISABLED && (await isSyncDue(db, now))) {
    after(async () => {
      try {
        await runSync(await getDb(), webFetcher, new Date());
      } catch (err) {
        console.error('Class sync failed', err);
      }
    });
  }

  const [items, placeRows, sourceRows, manual, settings, offRows] = await Promise.all([
    listClasses(db, today, minutesNowNY(now)),
    listPlaces(db),
    db.select().from(sources),
    db.select().from(manualClasses),
    getSettings(db),
    db.select().from(daysOff).where(between(daysOff.date, today, addDays(today, 6))),
  ]);

  const places: PlaceView[] = placeRows.map((p) => {
    const source = sourceRows.find((s) => s.placeId === p.id) ?? null;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      kind: p.kind,
      auto: Boolean(source),
      statusLine: placeStatusLine(source, today),
      hasError: Boolean(source?.lastError),
      watchUrl: p.watchUrl,
      changed: Boolean(p.watchChangedAt),
    };
  });

  const lastSuccess = sourceRows.map((s) => s.lastSuccessAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
      <header className="top gut">
        <div className="top-row">
          <h1 className="title">Calendar</h1>
          <AvatarButton user={user} />
        </div>
        <CalendarTabs current="classes" />
      </header>
      <div className="content gut">
        <ClassesView
          items={items}
          places={places}
          manual={manual}
          birthdate={settings.ezraBirthdate}
          today={today}
          daysOff={Object.fromEntries(offRows.map((d) => [d.date, d.label]))}
          updatedLabel={lastSuccess ? `Updated ${whenLabel(lastSuccess, today)}` : 'Schedules are being checked'}
          canEdit={isFamily(user)}
        />
      </div>
    </>
  );
}
