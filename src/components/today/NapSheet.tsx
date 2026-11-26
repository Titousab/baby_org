'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { deleteNapAction, endNapNowAction, saveNapAction, startNapNowAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { type ActionResult } from '@/lib/errors';
import { callAction } from '@/lib/call-action';
import { type NapEntry, napMinutes, runningNap } from '@/lib/log-types';
import { fmtDuration, fmtRange, fmtTime, fromMin, minutesNowNY, toMin } from '@/lib/time';
import { DEFAULT_NAP } from './tiles';
import { useNowMin } from './useNowMin';

type Props = { date: string; naps: NapEntry[]; isToday: boolean; onClose: () => void };

const STARTED = "Nap started. Everyone can see he's asleep.";
const SAVED = 'Nap saved. Everyone can see it now.';

/** The day's naps: the running one on today, else a list to pick from, or straight to the form when there are none yet. */
export function NapSheet({ date, naps, isToday, onClose }: Props) {
  const running = runningNap(naps);
  const [editing, setEditing] = useState<NapEntry | 'new' | null>(isToday && running ? running : naps.length ? null : 'new');
  // The sheet only opens after a tap, so read the clock now rather than trusting the page's last load.
  const now = useNowMin(minutesNowNY());

  if (editing) {
    return (
      <NapForm
        key={editing === 'new' ? 'new' : editing.id}
        date={date}
        nap={editing === 'new' ? null : editing}
        isToday={isToday}
        nowMin={now}
        someoneAsleep={Boolean(running && running !== editing)}
        canGoBack={naps.length > 0}
        onBack={() => setEditing(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet open onClose={onClose} title="Naps" icon="moon" color="sky">
      <p className="sheet-sub">
        {naps.length} {naps.length === 1 ? 'nap' : 'naps'} · {fmtDuration(napMinutes(naps))} in all
      </p>
      <ul className="list" aria-label="Naps today">
        {naps.map((n) => (
          <li key={n.id}>
            <button type="button" className="note" onClick={() => setEditing(n)}>
              <span className="n-time">{n.end ? fmtDuration(toMin(n.end) - toMin(n.start)) : isToday ? 'Asleep' : '—'}</span>
              <span className="n-body">
                <p>{n.end ? fmtRange(n.start, n.end) : isToday ? `Since ${fmtTime(n.start)}` : `${fmtTime(n.start)}, no wake-up time yet`}</p>
                <span className="t-by">{n.byName}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-dashed wide" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
        <Icon name="plus" /> Add another nap
      </button>
    </Sheet>
  );
}

type FormProps = {
  date: string;
  nap: NapEntry | null;
  isToday: boolean;
  nowMin: number;
  someoneAsleep: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
};

function NapForm({ date, nap, isToday, nowMin, someoneAsleep, canGoBack, onBack, onClose }: FormProps) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(nap?.start ?? (isToday ? fromMin(nowMin) : DEFAULT_NAP.start));
  const [end, setEnd] = useState(nap ? (nap.end ?? '') : isToday ? '' : DEFAULT_NAP.end);
  const asleepNow = Boolean(nap && nap.end === null && isToday);
  const valid = start && (!end || toMin(end) > toMin(start));

  function run(action: () => Promise<ActionResult>, message: string) {
    startTransition(async () => {
      const r = await callAction(action);
      if (r.ok) {
        onClose();
        toast(message);
      } else setError(r);
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveNapAction(form), end ? SAVED : STARTED);
  }

  function remove() {
    if (!nap) return;
    const id = nap.id;
    run(() => deleteNapAction(id), 'Nap removed');
  }

  const title = asleepNow ? 'Asleep' : nap ? 'Edit nap' : canGoBack ? 'Another nap' : 'Nap';
  return (
    <Sheet open onClose={onClose} title={title} icon="moon" color="sky">
      {!nap && isToday && !someoneAsleep && (
        <button type="button" className="btn-primary wide nap-now" onClick={() => run(() => startNapNowAction(), STARTED)} disabled={pending}>
          He&apos;s asleep now
        </button>
      )}
      {asleepNow && nap && (
        <>
          <p className="sheet-sub">
            Asleep since {fmtTime(nap.start)} · {fmtDuration(Math.max(0, nowMin - toMin(nap.start)))} so far
          </p>
          <button type="button" className="btn-primary wide nap-now" onClick={() => run(() => endNapNowAction(nap.id), SAVED)} disabled={pending}>
            He just woke up
          </button>
        </>
      )}
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        {nap && <input type="hidden" name="id" value={nap.id} />}
        {nap && <input type="hidden" name="loadedEnd" value={nap.end ?? ''} />}
        <div className="row2">
          <div className="field">
            <label htmlFor="f-start">Fell asleep</label>
            <input type="time" id="f-start" name="start" value={start} onChange={(e) => setStart(e.target.value)} />
            <FieldError error={error} field="start" />
          </div>
          <div className="field">
            <label htmlFor="f-end">Woke up</label>
            <input type="time" id="f-end" name="end" value={end} onChange={(e) => setEnd(e.target.value)} />
            <FieldError error={error} field="end" />
          </div>
        </div>
        <p className="calc" style={{ marginTop: 16 }}>
          {!end
            ? 'Still asleep. Add when he woke up later.'
            : valid
              ? `Slept ${fmtDuration(toMin(end) - toMin(start))}`
              : 'Woke up needs to be after fell asleep'}
        </p>
        <FormMessage error={error} fields={['start', 'end']} />
        <div className="sheet-actions">
          {canGoBack && (
            <button type="button" className="btn-text" onClick={onBack}>
              ‹ All naps
            </button>
          )}
          {nap && (
            <button type="button" className="btn-text danger" onClick={remove} disabled={pending}>
              Remove
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={pending}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  );
}
