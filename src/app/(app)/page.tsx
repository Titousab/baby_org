import { getDb } from '@/db/client';
import { AvatarButton } from '@/components/AvatarButton';
import { DayNav } from '@/components/today/DayNav';
import { NotesSection } from '@/components/today/NotesSection';
import { TodayTiles } from '@/components/today/TodayTiles';
import { requireUser } from '@/lib/auth/current-user';
import { getDayLog, recentFoods, SLOTS } from '@/lib/log';
import { colorsByName } from '@/lib/people';
import { fmtDuration, fromMin, minutesNowNY, todayNY, toMin } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const today = todayNY();
  const { date: asked } = await searchParams;
  const date = asked && DATE.test(asked) && asked <= today ? asked : today;

  const db = await getDb();
  const [day, foods, colors] = await Promise.all([getDayLog(db, date), recentFoods(db), colorsByName(db)]);
  const logged = SLOTS.filter((s) => day.slots[s]).length;
  const nap = day.slots.nap;

  return (
    <>
      <header className="top gut">
        <div className="top-row">
          <h1 className="title">Ezra&apos;s day</h1>
          <AvatarButton user={user} />
        </div>
        <DayNav date={date} today={today} />
      </header>
      <div className="content gut">
        <p className="progress">
          <span className="pips" aria-hidden="true">
            {SLOTS.map((s) => (
              <i key={s} className={day.slots[s] ? 'on' : ''} />
            ))}
          </span>
          <span>
            <b>{logged} of 6</b> logged
          </span>
          {nap?.endTime && (
            <>
              <span aria-hidden="true">·</span>
              <span>Napped {fmtDuration(toMin(nap.endTime) - toMin(nap.time))}</span>
            </>
          )}
        </p>
        <TodayTiles date={date} slots={day.slots} foods={foods} colors={colors} />
        <NotesSection date={date} notes={day.notes} colors={colors} defaultTime={date === today ? fromMin(minutesNowNY()) : '12:00'} />
      </div>
    </>
  );
}
