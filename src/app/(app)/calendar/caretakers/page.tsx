import { getDb } from '@/db/client';
import { AvatarButton } from '@/components/AvatarButton';
import { CalendarTabs } from '@/components/CalendarTabs';
import { CaretakersView } from '@/components/caretakers/CaretakersView';
import { isWeekend } from '@/components/caretakers/scale';
import type { DayData } from '@/components/caretakers/types';
import { requireUser } from '@/lib/auth/current-user';
import { isFamily } from '@/lib/auth/permissions';
import { gapsFor, needsCoverage, weeklyHours } from '@/lib/schedule/coverage';
import { getWeek, listSchedulePeople } from '@/lib/schedule/repo';
import { getSettings } from '@/lib/settings';
import { addDays, dayNum, dowShort, fmtWeekRange, monthDay, todayNY, weekStartOf } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CaretakersPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireUser();
  const today = todayNY();
  const thisWeek = weekStartOf(today);
  const first = addDays(thisWeek, -7);
  const last = addDays(thisWeek, 56);

  const { week: asked } = await searchParams;
  let weekStart = asked && DATE.test(asked) ? weekStartOf(asked) : thisWeek;
  if (weekStart < first) weekStart = first;
  if (weekStart > last) weekStart = last;

  const db = await getDb();
  const [week, people, { rules }] = await Promise.all([getWeek(db, weekStart), listSchedulePeople(db), getSettings(db)]);
  const daysOff = new Map(week.days.filter((d) => d.dayOff).map((d) => [d.date, d.dayOff as string]));

  const days: DayData[] = week.days.map((d) => {
    const need = needsCoverage(d.date, rules, daysOff);
    return {
      date: d.date,
      dow: dowShort(d.date),
      monthDay: monthDay(d.date),
      dayNum: dayNum(d.date),
      isToday: d.date === today,
      weekend: isWeekend(d.date),
      dayOff: d.dayOff,
      need,
      shifts: d.shifts,
      gaps: gapsFor(d.shifts, rules, need),
    };
  });

  const offset = Math.round((Date.parse(weekStart) - Date.parse(thisWeek)) / (7 * 864e5));
  const weekLabel =
    offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `Week of ${monthDay(weekStart)}`;

  return (
    <>
      <header className="top gut">
        <div className="top-row">
          <h1 className="title">Calendar</h1>
          <AvatarButton user={user} />
        </div>
        <CalendarTabs current="caretakers" />
      </header>
      <div className="content gut">
        <CaretakersView
          weekStart={weekStart}
          weekLabel={weekLabel}
          range={fmtWeekRange(weekStart)}
          prevWeek={weekStart > first ? addDays(weekStart, -7) : null}
          nextWeek={weekStart < last ? addDays(weekStart, 7) : null}
          days={days}
          people={people}
          rules={rules}
          hours={weeklyHours(days.flatMap((d) => d.shifts))}
          laterWeeks={[1, 2, 3, 4, 5, 6].map((n) => addDays(weekStart, 7 * n))}
          canEdit={isFamily(user)}
          today={today}
        />
      </div>
    </>
  );
}
