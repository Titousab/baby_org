'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { clearAgeOverrideAction, deleteManualClassAction, setAgeOverrideAction } from '@/app/actions/classes';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import { ageLabel } from '@/lib/classes/ages';
import type { ClassItem } from '@/lib/classes/list';
import { fmtDayShort, fmtTime } from '@/lib/time';

type Props = { item: ClassItem; canEdit: boolean; onClose: () => void; onEdit: () => void };

/** One class: when, where, ages, price, and the Book link. Family can correct its ages. */
export function ClassSheet({ item, canEdit, onClose, onEdit }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function saveAges(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => setAgeOverrideAction(form));
      if (r.ok) {
        onClose();
        toast('Ages saved');
      } else setError(r);
    });
  }

  function useSourceAges() {
    startTransition(async () => {
      const r = await callAction(() => clearAgeOverrideAction(item.placeId, item.title));
      if (r.ok) {
        onClose();
        toast("Back to the place's ages");
      } else setError(r);
    });
  }

  function remove() {
    if (!item.manualId) return;
    const id = item.manualId;
    startTransition(async () => {
      const r = await callAction(() => deleteManualClassAction(id));
      if (r.ok) {
        onClose();
        toast('Class deleted');
      } else setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title={item.title} icon="cal" color={item.color}>
      <p className="sheet-sub">
        {fmtDayShort(item.date)} · {fmtTime(item.start)}
        {item.durationMin ? ` · ${item.durationMin} min` : ''}
        <br />
        {item.placeName} · {ageLabel(item.ageMin, item.ageMax)}
        {item.ageOverridden ? ' (set by family)' : ''}
        {item.priceText ? ` · ${item.priceText}` : ''}
        {item.statusText ? ` · ${item.statusText}` : ''}
      </p>
      {item.note && <p className="sub">{item.note}</p>}
      {item.bookingUrl && (
        <a className="btn-primary wide" href={item.bookingUrl} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 18 }}>
          Book on their website <Icon name="ext" />
        </a>
      )}

      {canEdit && (
        <form onSubmit={saveAges} noValidate className="section" style={{ marginBottom: 12 }}>
          <h3 className="h3">Edit ages</h3>
          <input type="hidden" name="placeId" value={item.placeId} />
          <input type="hidden" name="title" value={item.title} />
          <div className="row2">
            <div className="field">
              <label htmlFor="f-agemin">Youngest (months)</label>
              <input type="text" inputMode="numeric" id="f-agemin" name="ageMin" defaultValue={item.ageMin ?? ''} />
              <FieldError error={error} field="ageMin" />
            </div>
            <div className="field">
              <label htmlFor="f-agemax">Oldest (months)</label>
              <input type="text" inputMode="numeric" id="f-agemax" name="ageMax" defaultValue={item.ageMax ?? ''} />
              <FieldError error={error} field="ageMax" />
            </div>
          </div>
          <FormMessage error={error} fields={['ageMin', 'ageMax']} />
          <div className="sheet-actions">
            {item.ageOverridden && (
              <button type="button" className="btn-text" onClick={useSourceAges} disabled={pending}>
                Use the place&apos;s ages
              </button>
            )}
            <button type="submit" className="btn-soft" disabled={pending}>
              Save ages
            </button>
          </div>
        </form>
      )}

      {canEdit && item.manualId && (
        <div className="sheet-actions">
          <button type="button" className="btn-text danger" onClick={remove} disabled={pending}>
            Delete class
          </button>
          <button type="button" className="btn-soft" onClick={onEdit}>
            Edit class
          </button>
        </div>
      )}
    </Sheet>
  );
}
