'use client';

import { useState } from 'react';
import { signOutAction } from '@/app/actions/auth';
import type { SessionUser } from '@/lib/auth/session';
import { Sheet } from './Sheet';

/** The round initial in each header. Opens the family and account sheet. */
export function AvatarButton({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="avatar-btn" aria-label="Family and account" onClick={() => setOpen(true)}>
        {user.name.slice(0, 1).toUpperCase()}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Family">
        <p className="sheet-sub">Signed in as {user.name}</p>
        <form action={signOutAction} className="sheet-actions">
          <button type="submit" className="btn-text danger">
            Sign out
          </button>
        </form>
      </Sheet>
    </>
  );
}
