'use client';

import { useState } from 'react';
import type { SessionUser } from '@/lib/auth/session';
import type { PersonView } from '@/lib/people';
import type { Settings } from '@/lib/settings';
import { AccountSheet } from './AccountSheet';

type Props = { user: SessionUser; people: PersonView[] | null; settings: Settings | null };

export function AccountButton({ user, people, settings }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="avatar-btn" aria-label="Family and account" onClick={() => setOpen(true)}>
        {user.name.slice(0, 1).toUpperCase()}
      </button>
      {open && <AccountSheet user={user} people={people} settings={settings} onClose={() => setOpen(false)} />}
    </>
  );
}
