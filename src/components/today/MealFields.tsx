'use client';

import { useRef } from 'react';
import { FieldError, type FormError } from '@/components/FieldError';
import { AMOUNTS } from '@/lib/log-types';

type Props = { foods: string[]; entry: { food: string | null; amount: string | null } | null; error: FormError };

/** What he ate (with recent-food chips) and how much: shared by meals and snacks. */
export function MealFields({ foods, entry, error }: Props) {
  const foodRef = useRef<HTMLTextAreaElement>(null);

  function addFood(food: string) {
    const box = foodRef.current;
    if (!box) return;
    const current = box.value.trim().replace(/[,\s]+$/, '');
    box.value = current ? `${current}, ${food.toLowerCase()}` : food;
  }

  return (
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
  );
}
