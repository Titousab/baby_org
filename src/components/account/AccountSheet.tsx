'use client';

import { callAction } from '@/lib/call-action';
import { type FormEvent, useState, useTransition } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { changeOwnPasswordAction, updateSettingsAction } from '@/app/actions/people';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { Sheet, tint } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import type { SessionUser } from '@/lib/auth/session';
import type { PersonView } from '@/lib/people';
import type { Settings } from '@/lib/settings';
import { AddNameView, AddSomeoneView, PersonView as PersonEditor } from './PeopleViews';

type View = { kind: 'main' } | { kind: 'add' } | { kind: 'name' } | { kind: 'person'; person: PersonView };
type Props = { user: SessionUser; people: PersonView[] | null; settings: Settings | null; onClose: () => void };

const ROLE_TEXT = { family: 'Family', caretaker: 'Caretaker' } as const;

export function AccountSheet({ user, people, settings, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: 'main' });
  const back = () => setView({ kind: 'main' });

  if (view.kind === 'add') return <AddSomeoneView onBack={back} onClose={onClose} />;
  if (view.kind === 'name') return <AddNameView onBack={back} onClose={onClose} />;
  if (view.kind === 'person') {
    const fresh = people?.find((p) => p.personId === view.person.personId) ?? view.person;
    return <PersonEditor person={fresh} isSelf={fresh.userId === user.id} onBack={back} onClose={onClose} />;
  }

  return (
    <Sheet open onClose={onClose} title="Family">
      <p className="sheet-sub">
        Signed in as {user.name} · {user.email}
      </p>

      {people && (
        <section className="section" style={{ marginBottom: 18 }}>
          <ul className="people">
            {people.map((p) => (
              <li key={p.personId}>
                <button type="button" className="person-row" onClick={() => setView({ kind: 'person', person: p })}>
                  <span className="av" style={tint(p.color)}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="person-text">
                    <b>{p.name}</b>
                    <small>
                      {p.userId === user.id ? 'You · ' : ''}
                      {p.role ? `${ROLE_TEXT[p.role]} · ${p.email}` : 'Schedule only'}
                      {p.disabled ? ' · No access' : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-soft wide" onClick={() => setView({ kind: 'add' })}>
            <Icon name="plus" /> Add someone
          </button>
          <button type="button" className="btn-text center" onClick={() => setView({ kind: 'name' })}>
            Add a name for the schedule only
          </button>
        </section>
      )}

      {settings && <SettingsForm settings={settings} />}
      <PasswordForm />

      <div className="hint">
        <b>Put Ezra on your Home Screen</b>
        <p>iPhone: tap Share, then Add to Home Screen. Android: tap the ⋮ menu, then Install app.</p>
      </div>
      <form action={signOutAction} className="sheet-actions">
        <button type="submit" className="btn-text danger">
          Sign out
        </button>
      </form>
    </Sheet>
  );
}

const DAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
] as const;

function SettingsForm({ settings }: { settings: Settings }) {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await callAction(() => updateSettingsAction(form));
      if (r.ok) {
        setError(null);
        toast('Settings saved');
      } else setError(r);
    });
  }

  return (
    <form className="section" onSubmit={submit} noValidate style={{ marginBottom: 18 }}>
      <h3 className="h3">Settings</h3>
      <div className="field">
        <label htmlFor="f-birthday">Ezra&apos;s birthday</label>
        <input type="date" id="f-birthday" name="birthdate" defaultValue={settings.ezraBirthdate ?? ''} />
        <FieldError error={error} field="birthdate" />
      </div>
      <fieldset className="field">
        <legend>Days someone needs to be with Ezra</legend>
        <div className="opts">
          {DAYS.map(([n, label]) => (
            <label key={n} className="opt">
              <input type="checkbox" name="days" value={n} defaultChecked={settings.rules.days.includes(n)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldError error={error} field="days" />
      </fieldset>
      <div className="row2">
        <div className="field">
          <label htmlFor="f-cstart">From</label>
          <input type="time" id="f-cstart" name="start" defaultValue={settings.rules.start} />
          <FieldError error={error} field="start" />
        </div>
        <div className="field">
          <label htmlFor="f-cend">Until</label>
          <input type="time" id="f-cend" name="end" defaultValue={settings.rules.end} />
          <FieldError error={error} field="end" />
        </div>
      </div>
      <FormMessage error={error} fields={['birthdate', 'days', 'start', 'end']} />
      <button type="submit" className="btn-soft wide" disabled={pending} style={{ marginTop: 12 }}>
        Save settings
      </button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    startTransition(async () => {
      const r = await callAction(() => changeOwnPasswordAction(form));
      if (r.ok) {
        setError(null);
        formEl.reset();
        toast('Password changed');
      } else setError(r);
    });
  }

  return (
    <form className="section" onSubmit={submit} noValidate>
      <h3 className="h3">Your password</h3>
      <div className="field">
        <label htmlFor="f-current">Current password</label>
        <input type="password" id="f-current" name="current" autoComplete="current-password" />
        <FieldError error={error} field="current" />
      </div>
      <div className="field">
        <label htmlFor="f-next">New password</label>
        <input type="password" id="f-next" name="next" autoComplete="new-password" />
        <FieldError error={error} field="next" />
      </div>
      <FormMessage error={error} fields={['current', 'next']} />
      <button type="submit" className="btn-soft wide" disabled={pending}>
        Change password
      </button>
    </form>
  );
}
