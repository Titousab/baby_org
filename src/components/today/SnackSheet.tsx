'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { deleteSnackAction, saveSnackAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import type { SnackEntry } from '@/lib/log-types';
import { fmtTime } from '@/lib/time';
import { MealFields } from './MealFields';
import { AMOUNT_TEXT, DEFAULT_SNACK_TIME } from './tiles';

type Props = { date: string; snacks: SnackEntry[]; foods: string[]; onClose: () => void };

/** The day's snacks: a list to pick from, or straight to the form when there are none yet. */
export function SnackSheet({ date, snacks, foods, onClose }: Props) {
  const [editing, setEditing] = useState<SnackEntry | 'new' | null>(snacks.length ? null : 'new');

  if (editing) {
    return (
      <SnackForm
        key={editing === 'new' ? 'new' : editing.id}
        date={date}
        snack={editing === 'new' ? null : editing}
        foods={foods}
        canGoBack={snacks.length > 0}
        onBack={() => setEditing(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet open onClose={onClose} title="Snacks" icon="apple" color="sage">
      <p className="sheet-sub">
        {snacks.length} {snacks.length === 1 ? 'snack' : 'snacks'}
      </p>
      <ul className="list" aria-label="Snacks today">
        {snacks.map((s) => (
          <li key={s.id}>
            <button type="button" className="note" onClick={() => setEditing(s)}>
              <span className="n-time">{fmtTime(s.time)}</span>
              <span className="n-body">
                <p>{s.food}</p>
                <span className="t-by">
                  {s.amount ? `${AMOUNT_TEXT[s.amount]} · ` : ''}
                  {s.byName}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-dashed wide" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
        <Icon name="plus" /> Add another snack
      </button>
    </Sheet>
  );
}

type FormProps = {
  date: string;
  snack: SnackEntry | null;
  foods: string[];
  canGoBack: boolean;
  onBack: () => void;
  onClose: () => void;
};

function SnackForm({ date, snack, foods, canGoBack, onBack, onClose }: FormProps) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => saveSnackAction(form));
      if (r.ok) {
        onClose();
        toast('Snack saved. Everyone can see it now.');
      } else setError(r);
    });
  }

  function remove() {
    if (!snack) return;
    const id = snack.id;
    startTransition(async () => {
      const r = await callAction(() => deleteSnackAction(id));
      if (r.ok) {
        onClose();
        toast('Snack removed');
      } else setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title={snack ? 'Edit snack' : canGoBack ? 'Another snack' : 'Snack'} icon="apple" color="sage">
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        {snack && <input type="hidden" name="id" value={snack.id} />}
        <MealFields foods={foods} entry={snack} error={error} />
        <div className="field">
          <label htmlFor="f-time">What time?</label>
          <input type="time" id="f-time" name="time" defaultValue={snack?.time ?? DEFAULT_SNACK_TIME} />
          <FieldError error={error} field="time" />
        </div>
        <FormMessage error={error} fields={['time', 'food']} />
        <div className="sheet-actions">
          {canGoBack && (
            <button type="button" className="btn-text" onClick={onBack}>
              ‹ All snacks
            </button>
          )}
          {snack && (
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
