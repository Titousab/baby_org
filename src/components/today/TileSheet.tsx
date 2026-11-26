'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { clearSlotAction, saveSlotAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import type { SlotEntry } from '@/lib/log-types';
import { MealFields } from './MealFields';
import { DEFAULT_TIME, type SlotTileDef } from './tiles';

type Props = { def: SlotTileDef; date: string; entry: SlotEntry | null; foods: string[]; onClose: () => void };

/** Add or edit one of the once-a-day entries: woke up or a meal. */
export function TileSheet({ def, date, entry, foods, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await callAction(() => saveSlotAction(form));
      if (result.ok) {
        onClose();
        toast(`${def.label} saved. Everyone can see it now.`);
      } else setError(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await callAction(() => clearSlotAction(date, def.key));
      if (result.ok) {
        onClose();
        toast('Removed');
      } else setError(result);
    });
  }

  const timeField = (
    <div className="field">
      <label htmlFor="f-time">What time?</label>
      <input type="time" id="f-time" name="time" defaultValue={entry?.time ?? DEFAULT_TIME[def.key]} />
      <FieldError error={error} field="time" />
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={def.label} icon={def.icon} color={def.color}>
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="slot" value={def.key} />

        {def.kind === 'meal' && <MealFields foods={foods} entry={entry} error={error} />}
        {timeField}

        <FormMessage error={error} fields={['time', 'food']} />
        <div className="sheet-actions">
          {entry && (
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
