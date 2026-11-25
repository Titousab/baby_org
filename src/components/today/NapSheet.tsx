'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { deleteNapAction, saveNapAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import { type NapEntry, napMinutes } from '@/lib/log-types';
import { fmtDuration, fmtRange, toMin } from '@/lib/time';
import { DEFAULT_NAP } from './tiles';

type Props = { date: string; naps: NapEntry[]; onClose: () => void };

/** The day's naps: a list to pick from, or straight to the form when there are none yet. */
export function NapSheet({ date, naps, onClose }: Props) {
  const [editing, setEditing] = useState<NapEntry | 'new' | null>(naps.length ? null : 'new');

  if (editing) {
    return (
      <NapForm
        key={editing === 'new' ? 'new' : editing.id}
        date={date}
        nap={editing === 'new' ? null : editing}
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
              <span className="n-time">{fmtDuration(toMin(n.end) - toMin(n.start))}</span>
              <span className="n-body">
                <p>{fmtRange(n.start, n.end)}</p>
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

type FormProps = { date: string; nap: NapEntry | null; canGoBack: boolean; onBack: () => void; onClose: () => void };

function NapForm({ date, nap, canGoBack, onBack, onClose }: FormProps) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(nap?.start ?? DEFAULT_NAP.start);
  const [end, setEnd] = useState(nap?.end ?? DEFAULT_NAP.end);
  const valid = start && end && toMin(end) > toMin(start);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => saveNapAction(form));
      if (r.ok) {
        onClose();
        toast('Nap saved. Everyone can see it now.');
      } else setError(r);
    });
  }

  function remove() {
    if (!nap) return;
    const id = nap.id;
    startTransition(async () => {
      const r = await callAction(() => deleteNapAction(id));
      if (r.ok) {
        onClose();
        toast('Nap removed');
      } else setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title={nap ? 'Edit nap' : canGoBack ? 'Another nap' : 'Nap'} icon="moon" color="sky">
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        {nap && <input type="hidden" name="id" value={nap.id} />}
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
          {valid ? `Slept ${fmtDuration(toMin(end) - toMin(start))}` : 'Woke up needs to be after fell asleep'}
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
