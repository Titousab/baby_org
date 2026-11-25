import { getDb } from '@/db/client';
import { AvatarButton } from '@/components/AvatarButton';
import { DayNav } from '@/components/today/DayNav';
import { NotesSection } from '@/components/today/NotesSection';
import { NowCard } from '@/components/today/NowCard';
import { TILES } from '@/components/today/tiles';
import { TodayTiles } from '@/components/today/TodayTiles';
import { requireUser } from '@/lib/auth/current-user';
import { getDayLog, napMinutes, recentFoods } from '@/lib/log';
import { colorsByName } from '@/lib/people';
import { getDayShifts } from '@/lib/schedule/repo';
import { fmtDuration, fromMin, minutesNowNY, todayNY } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const today = todayNY();
  const { date: asked } = await searchParams;
  const date = asked && DATE.test(asked) && asked <= today ? asked : today;

  const db = await getDb();
  const [day, foods, colors, todayShifts] = await Promise.all([
    getDayLog(db, date),
    recentFoods(db),
    colorsByName(db),
    date === today ? getDayShifts(db, today) : Promise.resolve([]),
  ]);
  const filled = TILES.map((t) => (t.key === 'nap' ? day.naps.length > 0 : Boolean(day.slots[t.key])));
  const logged = filled.filter(Boolean).length;
  const napped = napMinutes(day.naps);

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
        {date === today && <NowCard shifts={todayShifts} nowMin={minutesNowNY()} />}
        <p className="progress">
          <span className="pips" aria-hidden="true">
            {TILES.map((t, i) => (
              <i key={t.key} className={filled[i] ? 'on' : ''} />
            ))}
          </span>
          <span>
            <b>{logged} of 6</b> logged
          </span>
          {napped > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Napped {fmtDuration(napped)}</span>
            </>
          )}
        </p>
        <TodayTiles date={date} slots={day.slots} naps={day.naps} foods={foods} colors={colors} />
        <NotesSection date={date} notes={day.notes} colors={colors} defaultTime={date === today ? fromMin(minutesNowNY()) : '12:00'} />
      </div>
    </>
  );
}
