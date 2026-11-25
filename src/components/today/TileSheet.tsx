'use client';

import { type FormEvent, useRef, useState, useTransition } from 'react';
import { clearSlotAction, saveSlotAction } from '@/app/actions/log';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { AMOUNTS, type SlotEntry } from '@/lib/log';
import { fmtDuration, toMin } from '@/lib/time';
import { DEFAULT_NAP_END, DEFAULT_TIME, type TileDef } from './tiles';

type Props = { def: TileDef; date: string; entry: SlotEntry | null; foods: string[]; onClose: () => void };

export function TileSheet({ def, date, entry, foods, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const foodRef = useRef<HTMLTextAreaElement>(null);
  const [napStart, setNapStart] = useState(entry?.time ?? DEFAULT_TIME.nap);
  const [napEnd, setNapEnd] = useState(entry?.endTime ?? DEFAULT_NAP_END);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveSlotAction(form);
      if (result.ok) {
        onClose();
        toast(`${def.label} saved. Everyone can see it now.`);
      } else setError(result);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await clearSlotAction(date, def.key);
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

  const napOk = napStart && napEnd && toMin(napEnd) > toMin(napStart);

  return (
    <Sheet open onClose={onClose} title={def.label} icon={def.icon} color={def.color}>
      <form onSubmit={submit} noValidate>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="slot" value={def.key} />

        {def.kind === 'time' && (
          <div className="field">
            <label htmlFor="f-time">What time?</label>
            <input type="time" id="f-time" name="time" defaultValue={entry?.time ?? DEFAULT_TIME[def.key]} />
            <FieldError error={error} field="time" />
          </div>
        )}

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
            <div className="field">
              <label htmlFor="f-time">What time?</label>
              <input type="time" id="f-time" name="time" defaultValue={entry?.time ?? DEFAULT_TIME[def.key]} />
              <FieldError error={error} field="time" />
            </div>
          </>
        )}

        {def.kind === 'nap' && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-start">Fell asleep</label>
                <input type="time" id="f-start" name="time" value={napStart} onChange={(e) => setNapStart(e.target.value)} />
                <FieldError error={error} field="time" />
              </div>
              <div className="field">
                <label htmlFor="f-end">Woke up</label>
                <input type="time" id="f-end" name="endTime" value={napEnd} onChange={(e) => setNapEnd(e.target.value)} />
                <FieldError error={error} field="endTime" />
              </div>
            </div>
            <p className="calc" style={{ marginTop: 16 }}>
              {napOk ? `Slept ${fmtDuration(toMin(napEnd) - toMin(napStart))}` : 'Woke up needs to be after fell asleep'}
            </p>
          </>
        )}

        <FormMessage error={error} fields={['time', 'food', 'endTime']} />
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
