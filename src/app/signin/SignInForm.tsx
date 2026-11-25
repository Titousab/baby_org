'use client';

import { useActionState } from 'react';
import { signInAction } from '@/app/actions/auth';

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form className="auth-card" action={action}>
      <h2>Sign in</h2>
      <div className="field">
        <label htmlFor="f-email">Your email</label>
        <input id="f-email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="f-password">Password</label>
        <input id="f-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok && (
        <p className="err" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="btn-primary wide" disabled={pending}>
        Sign in
      </button>
      <p className="fine">Forgot your password? Ask Dad, Mom or Lauren to reset it.</p>
    </form>
  );
}
