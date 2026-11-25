'use client';

import { callAction } from '@/lib/call-action';
import { type FormEvent, useState, useTransition } from 'react';
import { copyDayAction } from '@/app/actions/schedule';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { useToast } from '@/components/Toast';
import type { DayData } from './types';

type Props = { day: DayData; days: DayData[]; onDone: () => void };

/** "Mon", "Mon and Tue", "Mon, Tue and Wed" */
function joinNames(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const shiftCount = (n: number) => `${n} ${n === 1 ? 'shift' : 'shifts'}`;

/** Copies one day's shifts onto other days of the same week. */
export function CopyDayForm({ day, days, onDone }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const others = days.filter((d) => d.date !== day.date);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const picked = new Set(form.getAll('to').map(String));
    startTransition(async () => {
      const r = await callAction(() => copyDayAction(form));
      if (!r.ok) return setError(r);
      onDone();
      toast(`Copied ${day.dow} to ${joinNames(others.filter((d) => picked.has(d.date)).map((d) => d.dow))}`);
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="sheet-sub">Copies {shiftCount(day.shifts.length)} from {day.dow} to the days you pick.</p>
      <input type="hidden" name="src" value={day.date} />
      <fieldset className="field">
        <legend>Copy this day to</legend>
        <div className="picklist" style={{ paddingLeft: 0 }}>
          {others.map((d) => (
            <label key={d.date} className="check">
              <input type="checkbox" name="to" value={d.date} disabled={!!d.dayOff} />
              <span>
                {d.dow} {d.monthDay}
                {d.dayOff ? (
                  <small className="muted-sm"> · {d.dayOff} · day off</small>
                ) : d.shifts.length ? (
                  <small className="muted-sm"> · has {shiftCount(d.shifts.length)} · will be replaced</small>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        <FieldError error={error} field="to" />
      </fieldset>
      <FormMessage error={error} fields={['to']} />
      <div className="sheet-actions">
        <button type="submit" className="btn-primary" disabled={pending}>
          Copy day
        </button>
      </div>
    </form>
  );
}
