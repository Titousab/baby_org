'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { addPlaceAction, markWatchSeenAction, syncNowAction } from '@/app/actions/classes';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { callAction } from '@/lib/call-action';
import { PERSON_COLORS } from '@/lib/colors';
import type { PlaceView } from './types';

type Props = { places: PlaceView[]; canEdit: boolean; onClose: () => void; onAddClass: () => void };

/** Where classes come from, whether each is up to date, and (family) the tools to add more. */
export function PlacesSheet({ places, canEdit, onClose, onAddClass }: Props) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const classPlaces = places.filter((p) => p.kind === 'class');
  const ideaPlaces = places.filter((p) => p.kind === 'idea');

  function syncNow() {
    startTransition(async () => {
      const r = await callAction(() => syncNowAction());
      toast(r.ok ? "Checked the places' websites" : r.message);
    });
  }

  function seen(placeId: number) {
    startTransition(async () => {
      const r = await callAction(() => markWatchSeenAction(placeId));
      if (!r.ok) toast(r.message);
    });
  }

  function addPlace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => addPlaceAction(form));
      if (r.ok) {
        setAdding(false);
        setError(null);
        toast('Place added. Add its classes with "Add a class".');
      } else setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title="Class places" icon="pin" color="sage">
      <p className="sheet-sub">Classes from these places show up in your calendar, filtered to Ezra&apos;s age.</p>
      <ul className="plist">
        {classPlaces.map((p) => (
          <li key={p.id}>
            <i className="dot" style={{ background: `var(--${p.color})`, width: 12, height: 12 }} />
            <div>
              <b>{p.name}</b>
              <small className={p.hasError ? 'err-text' : undefined}>{p.statusLine}</small>
              {p.changed && (
                <span className="watch-alert">
                  {p.name} updated its classes page.{' '}
                  {p.watchUrl && (
                    <a href={p.watchUrl} target="_blank" rel="noopener noreferrer">
                      Take a look
                    </a>
                  )}
                  {canEdit && (
                    <button type="button" className="btn-text" onClick={() => seen(p.id)} disabled={pending}>
                      Done
                    </button>
                  )}
                </span>
              )}
            </div>
            {p.auto && !p.hasError && (
              <span className="ok-ico">
                <Icon name="check" />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="muted-sm" style={{ margin: '0 0 16px' }}>
        Nearby ideas come from {ideaPlaces.map((p) => p.name).join(' and ')}.
      </p>

      {canEdit && (
        <>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button type="button" className="btn-soft" onClick={syncNow} disabled={pending}>
              Sync now
            </button>
            <button type="button" className="btn-primary" onClick={onAddClass}>
              <Icon name="plus" /> Add a class
            </button>
          </div>
          {adding ? (
            <form onSubmit={addPlace} noValidate className="section">
              <h3 className="h3">Add a place</h3>
              <div className="field">
                <label htmlFor="f-pname2">Place name</label>
                <input type="text" id="f-pname2" name="name" autoComplete="off" />
                <FieldError error={error} field="name" />
              </div>
              <div className="field">
                <label htmlFor="f-pweb">Website (we&apos;ll tell you when its page changes)</label>
                <input type="text" id="f-pweb" name="websiteUrl" placeholder="https://…" autoComplete="off" />
                <FieldError error={error} field="websiteUrl" />
              </div>
              <fieldset className="field">
                <legend>Color</legend>
                <div className="opts">
                  {PERSON_COLORS.map((c, i) => (
                    <label key={c} className="opt">
                      <input type="radio" name="color" value={c} defaultChecked={i === 0} />
                      <span aria-label={c}>
                        <i className="dot" style={{ background: `var(--${c})`, width: 16, height: 16 }} />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormMessage error={error} fields={['name', 'websiteUrl']} />
              <button type="submit" className="btn-soft wide" disabled={pending}>
                Add place
              </button>
            </form>
          ) : (
            <button type="button" className="btn-text center" onClick={() => setAdding(true)}>
              Add a place
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
