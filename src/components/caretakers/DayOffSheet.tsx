'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { clearDayOffAction, setDayOffAction } from '@/app/actions/schedule';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { DayData } from './types';

export function DayOffSheet({ day, onClose }: { day: DayData; onClose: () => void }) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const title = `${day.dow}, ${day.monthDay}`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await setDayOffAction(form);
      if (r.ok) {
        onClose();
        toast(`${title} is a day off`);
      } else setError(r);
    });
  }

  function clear() {
    startTransition(async () => {
      const r = await clearDayOffAction(day.date);
      if (r.ok) {
        onClose();
        toast(`${title} is a normal day again`);
      } else setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title={title} icon="leaf" color="peach">
      {day.dayOff ? (
        <>
          <p className="sheet-sub">Marked as a day off: {day.dayOff}. Nobody needs to cover it.</p>
          <FormMessage error={error} fields={[]} />
          <div className="sheet-actions">
            <button type="button" className="btn-primary" onClick={clear} disabled={pending}>
              Not a day off anymore
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="sheet-sub">On a day off, nobody needs to cover Ezra and copying weeks leaves it alone.</p>
          <input type="hidden" name="date" value={day.date} />
          <div className="field">
            <label htmlFor="f-label">Mark as a day off</label>
            <input type="text" id="f-label" name="label" placeholder="For example: Thanksgiving" autoComplete="off" />
            <FieldError error={error} field="label" />
          </div>
          <FormMessage error={error} fields={['label']} />
          <div className="sheet-actions">
            <button type="submit" className="btn-primary" disabled={pending}>
              Save
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
