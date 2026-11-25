import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { addDays, dowLong, fmtDayLong } from '@/lib/time';

export function DayNav({ date, today }: { date: string; today: string }) {
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const label = date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : dowLong(date);
  return (
    <div className="pillnav">
      <Link className="icon-btn" href={`/?date=${prev}`} aria-label="Previous day">
        <Icon name="chevL" />
      </Link>
      <div className="pillnav-label">
        <b>{label}</b>
        <span>{fmtDayLong(date)}</span>
      </div>
      {date >= today ? (
        <span className="icon-btn" aria-label="Next day" aria-disabled="true">
          <Icon name="chevR" />
        </span>
      ) : (
        <Link className="icon-btn" href={next === today ? '/' : `/?date=${next}`} aria-label="Next day">
          <Icon name="chevR" />
        </Link>
      )}
    </div>
  );
}
