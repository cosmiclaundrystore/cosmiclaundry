'use client';

import { useActionState, useState } from 'react';
import { signIn, signInWith, signUp, type AuthState } from '@/lib/account/actions';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
);

function Field({ label, name, type = 'text', autoComplete, error, hint }: { label: string; name: string; type?: string; autoComplete?: string; error?: string; hint?: string }) {
  return (
    <div className={`co-field${error ? ' has-error' : ''}`}>
      <label htmlFor={`ac-${name}`}>{label}</label>
      <input id={`ac-${name}`} name={name} type={type} autoComplete={autoComplete} required aria-invalid={!!error} aria-describedby={error ? `ac-${name}-error` : undefined} />
      {hint && !error && <p className="co-hint">{hint}</p>}
      {error && <p id={`ac-${name}-error`} className="cl-form-error">{error}</p>}
    </div>
  );
}

export function AuthPanel({ next, initialMode, linkError }: { next: string; initialMode: 'signin' | 'signup'; linkError: string | null }) {
  const [mode, setMode] = useState(initialMode);
  const [signInState, signInAction, signingIn] = useActionState(signIn, null);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, null);
  const [providerState, providerAction, redirecting] = useActionState(
    async (_: AuthState, fd: FormData) => signInWith('google', next),
    null,
  );
  const state = mode === 'signin' ? signInState : signUpState;
  const fe = state?.fieldErrors ?? {};

  const providers = (verb: string) => (
    <>
      <div className="ac-divider"><span>or</span></div>
      <form action={providerAction} className="ac-providers">
        <button type="submit" name="provider" value="google" className="ac-provider" disabled={redirecting}><GoogleIcon /> {verb} with Google</button>
      </form>
      {providerState?.error && <p className="co-notice" role="alert">{providerState.error}</p>}
    </>
  );

  return (
    <div className="ac-panel">
      {mode === 'signin' ? (
        <>
          <div className="ac-auth-head">
            <h1>Back For A Load?</h1>
            <p className="ac-lead">Sign in to see your orders and credits.</p>
          </div>
          {linkError && !state && <p className="co-notice" role="alert">{linkError}</p>}
          {state?.error && <p className="co-notice" role="alert">{state.error}</p>}
          <form action={signInAction} className="ac-form" noValidate key="signin">
            <input type="hidden" name="next" value={next} />
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field label="Password" name="password" type="password" autoComplete="current-password" />
            <a className="ac-small-link" href="/account/forgot">Forgot your password?</a>
            <button className="cl-button cl-button-primary ac-submit" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {providers('Sign in')}
          <p className="ac-switch">New here? <button type="button" onClick={() => setMode('signup')}>Create an account</button></p>
        </>
      ) : (
        <>
          <div className="ac-auth-head">
            <h1>Join Cosmic Fam</h1>
            <p className="ac-lead">Earn 100 credits per tee. 1,000 credits = 20% off + free delivery.</p>
          </div>
          {state?.error && <p className="co-notice" role="alert">{state.error}</p>}
          {state?.ok && <p className="co-notice ac-ok" role="status">{state.ok}</p>}
          <form action={signUpAction} className="ac-form" noValidate key="signup">
            <input type="hidden" name="next" value={next} />
            <Field label="Name" name="name" autoComplete="name" error={fe.name} />
            <Field label="Email" name="email" type="email" autoComplete="email" error={fe.email} />
            <Field label="Password" name="password" type="password" autoComplete="new-password" error={fe.password} hint="At least 8 characters." />
            <button className="cl-button cl-button-primary ac-submit" type="submit" disabled={signingUp}>{signingUp ? 'Creating your account…' : 'Create account'}</button>
          </form>
          {providers('Sign up')}
          <p className="ac-switch">Already have an account? <button type="button" onClick={() => setMode('signin')}>Sign in</button></p>
        </>
      )}
    </div>
  );
}
