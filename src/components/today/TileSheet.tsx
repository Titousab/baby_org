'use client';

import { type FormEvent, useRef, useState, useTransition } from 'react';
import { clearSlotAction, saveSlotAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import { AMOUNTS, type SlotEntry } from '@/lib/log-types';
import { DEFAULT_TIME, type SlotTileDef } from './tiles';

type Props = { def: SlotTileDef; date: string; entry: SlotEntry | null; foods: string[]; onClose: () => void };

/** Add or edit one of the once-a-day entries: woke up or a meal. */
export function TileSheet({ def, date, entry, foods, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const foodRef = useRef<HTMLTextAreaElement>(null);

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

  function addFood(food: string) {
    const box = foodRef.current;
    if (!box) return;
    const current = box.value.trim().replace(/[,\s]+$/, '');
    box.value = current ? `${current}, ${food.toLowerCase()}` : food;
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

        {def.kind === 'meal' && (
          <>
            <div className="field">
              <label htmlFor="f-food">What did he eat?</label>
              <textarea id="f-food" name="food" rows={2} ref={foodRef} placeholder="For example: banana and yogurt" defaultValue={entry?.food ?? ''} />
              <div className="opts" aria-label="Recent foods">
                {foods.map((f) => (
                  <button key={f} type="button" className="food-chip" onClick={() => addFood(f)}>
                    + {f}
                  </button>
                ))}
              </div>
              <FieldError error={error} field="food" />
            </div>
            <fieldset className="field">
              <legend>How much did he eat?</legend>
              <div className="opts">
                {AMOUNTS.map((a, i) => (
                  <label key={a} className="opt">
                    <input type="radio" name="amount" id={`amt-${i}`} value={a} defaultChecked={entry ? entry.amount === a : a === 'Most'} />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
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
