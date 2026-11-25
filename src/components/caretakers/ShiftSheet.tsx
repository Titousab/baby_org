'use client';

import { callAction } from '@/lib/call-action';
import { type FormEvent, useState, useTransition } from 'react';
import { deleteShiftAction, saveShiftAction } from '@/app/actions/schedule';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { fmtDuration, toMin } from '@/lib/time';
import type { DayData, Person } from './types';

export type ShiftDraft = { id?: number; date: string; personId: number | null; start: string; end: string };

type Props = { draft: ShiftDraft; days: DayData[]; people: Person[]; onClose: () => void };

export function ShiftSheet({ draft, days, people, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const editing = Boolean(draft.id);
  const [addingNew, setAddingNew] = useState(false);
  // A new shift can go on several days at once; an existing one belongs to one day.
  const [picked, setPicked] = useState(() => new Set([draft.date]));
  const n = editing ? 1 : picked.size;

  function toggle(date: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(date)) next.add(date);
      return next;
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!form.get('personId') && !String(form.get('newName') ?? '').trim()) {
      setError({ message: 'Pick who is covering this shift.', field: 'who' });
      return;
    }
    if (!editing && !picked.size) {
      setError({ message: 'Pick at least one day.', field: 'date' });
      return;
    }
    startTransition(async () => {
      const r = await callAction(() => saveShiftAction(form));
      if (r.ok) {
        onClose();
        toast(editing ? 'Shift updated' : n === 1 ? 'Shift added' : `${n} shifts added`);
      } else setError(r);
    });
  }

  function remove() {
    if (!draft.id) return;
    const id = draft.id;
    startTransition(async () => {
      const r = await callAction(() => deleteShiftAction(id));
      if (r.ok) {
        onClose();
        toast('Shift deleted');
      } else setError(r);
    });
  }

  const valid = start && end && toMin(end) > toMin(start);

  return (
    <Sheet open onClose={onClose} title={editing ? 'Edit shift' : 'Add a shift'} icon="cal" color="sage">
      <form onSubmit={submit} noValidate>
        {draft.id && <input type="hidden" name="id" value={draft.id} />}
        <fieldset className="field">
          <legend>Who?</legend>
          <div className="opts">
            {people.map((person) => (
              <label key={person.id} className="opt">
                <input type="radio" name="personId" id={`who-${person.id}`} value={person.id} defaultChecked={person.id === draft.personId} />
                <span>
                  <i className="dot" style={{ background: `var(--${person.color})` }} />
                  {person.name}
                </span>
              </label>
            ))}
            {!editing && !addingNew && (
              <button type="button" className="food-chip" onClick={() => setAddingNew(true)}>
                + Someone new
              </button>
            )}
          </div>
          {addingNew && (
            <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
              <label htmlFor="f-newname">Their name</label>
              <input type="text" id="f-newname" name="newName" autoComplete="off" placeholder="A sitter, a daycare…" />
            </div>
          )}
          <FieldError error={error} field="who" />
          <FieldError error={error} field="name" />
        </fieldset>
        <fieldset className="field">
          <legend>{editing ? 'Which day?' : 'Which days?'}</legend>
          <div className="opts">
            {days.map((d) => (
              <label key={d.date} className="opt">
                {editing ? (
                  <input type="radio" name="date" id={`day-${d.date}`} value={d.date} defaultChecked={d.date === draft.date} />
                ) : (
                  <input
                    type="checkbox"
                    name="date"
                    id={`day-${d.date}`}
                    value={d.date}
                    checked={picked.has(d.date)}
                    onChange={() => toggle(d.date)}
                  />
                )}
                <span>
                  {d.dow} {d.dayNum}
                </span>
              </label>
            ))}
            {!editing && (
              <button
                type="button"
                className="food-chip"
                onClick={() => setPicked(new Set(days.filter((d) => !d.weekend && !d.dayOff).map((d) => d.date)))}
              >
                Weekdays
              </button>
            )}
          </div>
          <FieldError error={error} field="date" />
        </fieldset>
        <div className="row2">
          <div className="field">
            <label htmlFor="f-s">Starts</label>
            <input type="time" id="f-s" name="start" value={start} onChange={(e) => setStart(e.target.value)} />
            <FieldError error={error} field="start" />
          </div>
          <div className="field">
            <label htmlFor="f-e">Ends</label>
            <input type="time" id="f-e" name="end" value={end} onChange={(e) => setEnd(e.target.value)} />
            <FieldError error={error} field="end" />
          </div>
        </div>
        <p className="calc" style={{ marginTop: 16 }}>
          {valid ? `${fmtDuration(toMin(end) - toMin(start))} shift${n > 1 ? ` × ${n} days` : ''}` : 'End time is before start time'}
        </p>
        <FormMessage error={error} fields={['who', 'name', 'date', 'start', 'end']} />
        <div className="sheet-actions">
          {editing && (
            <button type="button" className="btn-text danger" onClick={remove} disabled={pending}>
              Delete
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={pending}>
            Save shift
          </button>
        </div>
      </form>
    </Sheet>
  );
}
