'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

export function TabBar() {
  const path = usePathname();
  const onCalendar = path.startsWith('/calendar');
  return (
    <nav className="tabbar gut" aria-label="Main">
      <Link href="/" aria-current={onCalendar ? undefined : 'page'}>
        <span className="tab-ico">
          <Icon name="journal" />
        </span>
        Today
      </Link>
      <Link href="/calendar" aria-current={onCalendar ? 'page' : undefined}>
        <span className="tab-ico">
          <Icon name="cal" />
        </span>
        Calendar
      </Link>
    </nav>
  );
}
