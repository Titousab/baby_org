'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { saveManualClassAction } from '@/app/actions/classes';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import type { ManualRow, PlaceView } from './types';

type Props = { row: ManualRow | null; places: PlaceView[]; today: string; onClose: () => void };

const FIELDS = ['placeId', 'title', 'firstDate', 'startTime', 'durationMin', 'ageMin', 'ageMax', 'untilDate'];

/** Add or edit a class typed in by hand. */
export function ManualClassSheet({ row, places, today, onClose }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [weekly, setWeekly] = useState(row?.repeatsWeekly ?? true);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => saveManualClassAction(form));
      if (r.ok) {
        onClose();
        toast('Class saved');
      } else setError(r);
    });
  }

  const field = (id: string, label: string, input: React.ReactNode, name: string) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {input}
      <FieldError error={error} field={name} />
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={row ? 'Edit class' : 'Add a class'} icon="cal" color="sage">
      <form onSubmit={submit} noValidate>
        {row && <input type="hidden" name="id" value={row.id} />}
        {field(
          'f-cplace',
          'Place',
          <select id="f-cplace" name="placeId" defaultValue={row?.placeId ?? places.find((p) => !p.auto)?.id} className="select">
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>,
          'placeId',
        )}
        {field('f-ctitle', 'Class name', <input type="text" id="f-ctitle" name="title" defaultValue={row?.title ?? ''} autoComplete="off" />, 'title')}
        <div className="row2">
          {field('f-cfirst', 'First day', <input type="date" id="f-cfirst" name="firstDate" defaultValue={row?.firstDate ?? today} />, 'firstDate')}
          {field('f-cstart', 'Starts', <input type="time" id="f-cstart" name="startTime" defaultValue={row?.startTime ?? '10:00'} />, 'startTime')}
        </div>
        <div className="row2">
          {field(
            'f-clen',
            'Length (minutes)',
            <input type="text" inputMode="numeric" id="f-clen" name="durationMin" defaultValue={row?.durationMin ?? 45} />,
            'durationMin',
          )}
          {field('f-cprice', 'Price', <input type="text" id="f-cprice" name="priceText" defaultValue={row?.priceText ?? ''} placeholder="$25" />, 'priceText')}
        </div>
        <div className="row2">
          {field(
            'f-cmin',
            'Youngest (months)',
            <input type="text" inputMode="numeric" id="f-cmin" name="ageMin" defaultValue={row?.ageMin ?? ''} />,
            'ageMin',
          )}
          {field(
            'f-cmax',
            'Oldest (months)',
            <input type="text" inputMode="numeric" id="f-cmax" name="ageMax" defaultValue={row?.ageMax ?? ''} />,
            'ageMax',
          )}
        </div>
        {field(
          'f-cbook',
          'Booking link',
          <input type="text" id="f-cbook" name="bookingUrl" defaultValue={row?.bookingUrl ?? ''} placeholder="Leave empty to use the place's website" />,
          'bookingUrl',
        )}
        {field('f-cnote', 'Note', <input type="text" id="f-cnote" name="note" defaultValue={row?.note ?? ''} placeholder="For example: grown-ups join in" />, 'note')}
        <label className="check">
          <input type="checkbox" name="repeatsWeekly" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
          Repeats every week
        </label>
        {weekly &&
          field(
            'f-cuntil',
            'Last day (optional)',
            <input type="date" id="f-cuntil" name="untilDate" defaultValue={row?.untilDate ?? ''} />,
            'untilDate',
          )}
        <FormMessage error={error} fields={FIELDS} />
        <div className="sheet-actions">
          <button type="submit" className="btn-primary" disabled={pending}>
            Save class
          </button>
        </div>
      </form>
    </Sheet>
  );
}
