'use client';

import { callAction } from '@/lib/call-action';
import { type FormEvent, useState, useTransition } from 'react';
import { copyWeekAction } from '@/app/actions/schedule';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { addDays, fmtWeekRange, monthDay } from '@/lib/time';
import type { DayData } from './types';

type Props = { weekStart: string; laterWeeks: string[]; days: DayData[]; onClose: () => void };

export function CopyWeekSheet({ weekStart, laterWeeks, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<'next' | 'next4' | 'pick'>('next');
  const next = addDays(weekStart, 7);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const picked = form.getAll('pick').map(String);
    startTransition(async () => {
      const r = await callAction(() => copyWeekAction(form));
      if (!r.ok) return setError(r);
      onClose();
      if (target === 'next') toast(`Copied to ${fmtWeekRange(next)}`);
      else if (target === 'next4') toast('Copied to 4 weeks');
      else toast(picked.length === 1 ? `Copied to ${fmtWeekRange(picked[0])}` : `Copied to ${picked.length} weeks`);
    });
  }

  return (
    <Sheet open onClose={onClose} title="Copy this week" icon="copy" color="sky">
      <p className="sheet-sub">Copies every shift from {fmtWeekRange(weekStart)} to the weeks you pick.</p>
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="src" value={weekStart} />
        <fieldset className="field">
          <legend>Copy to</legend>
          <div className="stack">
            <label className="choice">
              <input type="radio" name="target" value="next" checked={target === 'next'} onChange={() => setTarget('next')} />
              <span>
                <b>Next week</b>
                <small>{fmtWeekRange(next)}</small>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="target" value="next4" checked={target === 'next4'} onChange={() => setTarget('next4')} />
              <span>
                <b>The next 4 weeks</b>
                <small>Through {monthDay(addDays(weekStart, 34))}</small>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="target" value="pick" checked={target === 'pick'} onChange={() => setTarget('pick')} />
              <span>
                <b>Pick weeks</b>
                <small>Choose any of the next 6 weeks</small>
              </span>
            </label>
            {target === 'pick' && (
              <div className="picklist">
                {laterWeeks.map((w) => (
                  <label key={w} className="check">
                    <input type="checkbox" name="pick" value={w} />
                    {fmtWeekRange(w)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <FieldError error={error} field="pick" />
        </fieldset>
        <fieldset className="field">
          <legend>If a week already has shifts</legend>
          <div className="opts">
            <label className="opt">
              <input type="radio" name="mode" value="replace" defaultChecked />
              <span>Replace them</span>
            </label>
            <label className="opt">
              <input type="radio" name="mode" value="fill" />
              <span>Only fill empty days</span>
            </label>
          </div>
        </fieldset>
        <p className="muted-sm" style={{ margin: '-4px 0 14px' }}>
          Days off are skipped.
        </p>
        <FormMessage error={error} fields={['pick']} />
        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            Copy schedule
          </button>
        </div>
      </form>
    </Sheet>
  );
}
