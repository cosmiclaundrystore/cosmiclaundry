'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '@/lib/account/actions';

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <section className="ac-auth">
      <a className="breadcrumb co-back" href="/account/login">← Back to sign in</a>
      <h1>Reset your password</h1>
      <p className="ac-lead">Enter your email and we’ll send you a link to choose a new password.</p>
      <form action={action} className="ac-form ac-panel" noValidate>
        <div className={`co-field${state?.fieldErrors?.email ? ' has-error' : ''}`}>
          <label htmlFor="ac-email">Email</label>
          <input id="ac-email" name="email" type="email" autoComplete="email" required />
          {state?.fieldErrors?.email && <p className="cl-form-error">{state.fieldErrors.email}</p>}
        </div>
        {state?.ok && <p className="co-notice ac-ok" role="status">{state.ok}</p>}
        <button className="cl-button cl-button-primary ac-submit" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
      </form>
    </section>
  );
}
