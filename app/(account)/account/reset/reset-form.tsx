'use client';

import { useActionState } from 'react';
import { updatePassword } from '@/lib/account/actions';

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="ac-form ac-panel" noValidate>
      <div className={`co-field${fe.password ? ' has-error' : ''}`}>
        <label htmlFor="ac-password">New password</label>
        <input id="ac-password" name="password" type="password" autoComplete="new-password" required />
        {fe.password ? <p className="cl-form-error">{fe.password}</p> : <p className="co-hint">At least 8 characters.</p>}
      </div>
      <div className={`co-field${fe.confirm ? ' has-error' : ''}`}>
        <label htmlFor="ac-confirm">Type it again</label>
        <input id="ac-confirm" name="confirm" type="password" autoComplete="new-password" required />
        {fe.confirm && <p className="cl-form-error">{fe.confirm}</p>}
      </div>
      {state?.error && <p className="co-notice" role="alert">{state.error}</p>}
      <button className="cl-button cl-button-primary ac-submit" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save new password'}</button>
    </form>
  );
}
