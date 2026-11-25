import Link from 'next/link';

/** The Classes / Caretakers switch at the top of the Calendar tab. */
export function CalendarTabs({ current }: { current: 'classes' | 'caretakers' }) {
  return (
    <nav className="seg" aria-label="Calendar views">
      <Link href="/calendar/classes" aria-current={current === 'classes' ? 'page' : undefined}>
        Classes
      </Link>
      <Link href="/calendar/caretakers" aria-current={current === 'caretakers' ? 'page' : undefined}>
        Caretakers
      </Link>
    </nav>
  );
}
