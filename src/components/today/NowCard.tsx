import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { nowWithEzra, type ShiftView } from '@/lib/schedule/coverage';
import { fmtTime } from '@/lib/time';

/** "With Ezra now": the current shift, when it ends and who is next (today only). */
export function NowCard({ shifts, nowMin }: { shifts: ShiftView[]; nowMin: number }) {
  const { current, next } = nowWithEzra(shifts, nowMin);
  let color = 'sage';
  let text: React.ReactNode = 'No caretaker scheduled. Family time.';
  if (current) {
    color = current.color;
    text = (
      <>
        <b>{current.personName}</b> until {fmtTime(current.end)}
        {next ? `, then ${next.personName}` : ''}
      </>
    );
  } else if (next) {
    color = next.color;
    text = (
      <>
        Nobody right now. <b>{next.personName}</b> at {fmtTime(next.start)}
      </>
    );
  }
  return (
    <Link className="now" href="/calendar/caretakers">
      <i className="dot" style={{ background: `var(--${color})` }} />
      <span className="now-txt">
        <small>With Ezra now</small>
        {text}
      </span>
      <Icon name="chevR" />
    </Link>
  );
}
