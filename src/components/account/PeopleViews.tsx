'use client';

import { type FormEvent, useState, useTransition } from 'react';
import {
  addSchedulePersonAction,
  createAccountAction,
  disableAccountAction,
  resetPasswordAction,
  setRoleAction,
  updatePersonAction,
} from '@/app/actions/people';
import { FieldError, type FormError, FormMessage } from '@/components/FieldError';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { PERSON_COLORS } from '@/lib/colors';
import type { ActionResult } from '@/lib/errors';
import type { PersonView as Person } from '@/lib/people';

type Nav = { onBack: () => void; onClose: () => void };

/** Submits a form to a server action and reports back. */
function useSubmit(action: (form: FormData) => Promise<ActionResult>, onDone: () => void) {
  const [error, setError] = useState<FormError>(null);
  const [pending, startTransition] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await action(form);
      if (r.ok) {
        setError(null);
        onDone();
      } else setError(r);
    });
  }
  return { error, pending, submit, setError, startTransition };
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="btn-text" onClick={onBack}>
      ‹ Back to family
    </button>
  );
}

function ColorChips({ value }: { value?: string }) {
  return (
    <fieldset className="field">
      <legend>Color</legend>
      <div className="opts">
        {PERSON_COLORS.map((c) => (
          <label key={c} className="opt">
            <input type="radio" name="color" value={c} defaultChecked={c === value} />
            <span aria-label={c}>
              <i className="dot" style={{ background: `var(--${c})`, width: 16, height: 16 }} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddSomeoneView({ onBack, onClose }: Nav) {
  const toast = useToast();
  const [name, setName] = useState('');
  const { error, pending, submit } = useSubmit(createAccountAction, () => {
    toast(`${name.trim()} can sign in now.`);
    onBack();
  });
  return (
    <Sheet open onClose={onClose} title="Add someone" icon="plus" color="sage">
      <p className="sheet-sub">They sign in with their email and the starting password you give them.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-pname">Name</label>
          <input type="text" id="f-pname" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <FieldError error={error} field="name" />
        </div>
        <div className="field">
          <label htmlFor="f-pemail">Email</label>
          <input type="email" id="f-pemail" name="email" autoComplete="off" />
          <FieldError error={error} field="email" />
        </div>
        <fieldset className="field">
          <legend>What can they do?</legend>
          <div className="stack">
            <label className="choice">
              <input type="radio" name="role" value="family" defaultChecked />
              <span>
                <b>Family</b>
                <small>Everything, including the caretaker schedule and people.</small>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="role" value="caretaker" />
              <span>
                <b>Caretaker</b>
                <small>Logs Ezra&apos;s day and sees everything, but can&apos;t change the schedule.</small>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="f-ppass">Starting password</label>
          <input type="text" id="f-ppass" name="password" autoComplete="off" />
          <FieldError error={error} field="password" />
        </div>
        <FormMessage error={error} fields={['name', 'email', 'password']} />
        <div className="sheet-actions">
          <BackButton onBack={onBack} />
          <button type="submit" className="btn-primary" disabled={pending}>
            Add
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function AddNameView({ onBack, onClose }: Nav) {
  const toast = useToast();
  const [name, setName] = useState('');
  const { error, pending, submit } = useSubmit(addSchedulePersonAction, () => {
    toast(`${name.trim()} is on the schedule list now.`);
    onBack();
  });
  return (
    <Sheet open onClose={onClose} title="Add a name" icon="cal" color="sage">
      <p className="sheet-sub">For someone (or somewhere, like a daycare) who covers Ezra but doesn&apos;t use the app.</p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="f-nname">Name</label>
          <input type="text" id="f-nname" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <FieldError error={error} field="name" />
        </div>
        <ColorChips />
        <FormMessage error={error} fields={['name']} />
        <div className="sheet-actions">
          <BackButton onBack={onBack} />
          <button type="submit" className="btn-primary" disabled={pending}>
            Add
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function PersonView({ person, isSelf, onBack, onClose }: Nav & { person: Person; isSelf: boolean }) {
  const toast = useToast();
  const details = useSubmit(updatePersonAction, () => toast('Saved'));
  const role = useSubmit(setRoleAction, () => toast('Saved'));
  const reset = useSubmit(resetPasswordAction, () => toast(`Password reset. Text ${person.name} the new one.`));
  const [confirming, setConfirming] = useState(false);

  function removeAccess() {
    if (!person.userId) return;
    const id = person.userId;
    reset.startTransition(async () => {
      const r = await disableAccountAction(id);
      if (r.ok) {
        toast(`${person.name} can't sign in anymore.`);
        onBack();
      } else reset.setError(r);
    });
  }

  return (
    <Sheet open onClose={onClose} title={person.name} color={person.color}>
      <form onSubmit={details.submit} noValidate>
        <input type="hidden" name="personId" value={person.personId} />
        <div className="field">
          <label htmlFor="f-ename">Name</label>
          <input type="text" id="f-ename" name="name" defaultValue={person.name} autoComplete="off" />
          <FieldError error={details.error} field="name" />
        </div>
        <ColorChips value={person.color} />
        <FormMessage error={details.error} fields={['name']} />
        <button type="submit" className="btn-soft wide" disabled={details.pending}>
          Save name and color
        </button>
      </form>

      {person.userId && person.role && !person.disabled && (
        <>
          <form onSubmit={role.submit} noValidate style={{ marginTop: 18 }}>
            <input type="hidden" name="userId" value={person.userId} />
            <fieldset className="field">
              <legend>What can they do?</legend>
              <div className="opts">
                <label className="opt">
                  <input type="radio" name="role" value="family" defaultChecked={person.role === 'family'} />
                  <span>Family</span>
                </label>
                <label className="opt">
                  <input type="radio" name="role" value="caretaker" defaultChecked={person.role === 'caretaker'} />
                  <span>Caretaker</span>
                </label>
              </div>
            </fieldset>
            <FormMessage error={role.error} fields={[]} />
            <button type="submit" className="btn-soft wide" disabled={role.pending}>
              Save access
            </button>
          </form>

          {!isSelf && (
            <form onSubmit={reset.submit} noValidate style={{ marginTop: 18 }}>
              <input type="hidden" name="userId" value={person.userId} />
              <div className="field">
                <label htmlFor="f-reset">New password for {person.name}</label>
                <input type="text" id="f-reset" name="password" autoComplete="off" />
                <FieldError error={reset.error} field="password" />
              </div>
              <FormMessage error={reset.error} fields={['password']} />
              <button type="submit" className="btn-soft wide" disabled={reset.pending}>
                Reset password
              </button>
            </form>
          )}

          {!isSelf &&
            (confirming ? (
              <div className="confirm">
                <p>Remove {person.name}&apos;s access? They&apos;ll be signed out. What they logged stays.</p>
                <div className="sheet-actions">
                  <button type="button" className="btn-text" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary danger-bg" onClick={removeAccess} disabled={reset.pending}>
                    Yes, remove access
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-text danger center" onClick={() => setConfirming(true)}>
                Remove access
              </button>
            ))}
        </>
      )}
      <div className="sheet-actions">
        <BackButton onBack={onBack} />
      </div>
    </Sheet>
  );
}
