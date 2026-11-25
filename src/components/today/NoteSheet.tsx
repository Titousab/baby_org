'use client';

import { callAction } from '@/lib/call-action';
import { type FormEvent, useState, useTransition } from 'react';
import { deleteNoteAction, saveNoteAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { NOTE_KINDS, type NoteEntry } from '@/lib/log-types';

type Props = { date: string; note: NoteEntry | null; defaultTime: string; onClose: () => void };

export function NoteSheet({ date, note, defaultTime, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await callAction(() => saveNoteAction(form));
      if (result.ok) {
        onClose();
        toast('Saved. Everyone can see it now.');
      } else setError(result);
    });
  }

  function remove() {
    if (!note) return;
    startTransition(async () => {
      const result = await callAction(() => deleteNoteAction(note.id));
      if (result.ok) {
        onClose();
        toast('Note deleted');
      } else setError(result);
    });
  }

  return (
    <Sheet open onClose={onClose} title={note ? 'Edit note' : 'Add something else'} icon="star" color="lav">
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        {note && <input type="hidden" name="id" value={note.id} />}
        <fieldset className="field">
          <legend>What kind?</legend>
          <div className="opts">
            {NOTE_KINDS.map((k, i) => (
              <label key={k} className="opt">
                <input type="radio" name="kind" id={`kind-${i}`} value={k} defaultChecked={note ? note.kind === k : k === 'Note'} />
                <span>{k}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="f-text">Details</label>
          <textarea id="f-text" name="text" rows={3} placeholder="For example: gave 5 ml of fever medicine" defaultValue={note?.text ?? ''} />
          <FieldError error={error} field="text" />
        </div>
        <div className="field">
          <label htmlFor="f-ntime">What time?</label>
          <input type="time" id="f-ntime" name="time" defaultValue={note?.time ?? defaultTime} />
          <FieldError error={error} field="time" />
        </div>
        <FormMessage error={error} fields={['text', 'time']} />
        <div className="sheet-actions">
          {note && (
            <button type="button" className="btn-text danger" onClick={remove} disabled={pending}>
              Delete
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
