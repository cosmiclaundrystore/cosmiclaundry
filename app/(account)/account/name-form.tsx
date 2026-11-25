'use client';

import { useActionState, useEffect, useRef } from 'react';
import { updateName } from '@/lib/account/actions';

/** "Edit details" button under Sign out; opens the name / email / password details in a popup. */
export function DetailsDialog({ name, email, emailConfirmed }: { name: string; email: string; emailConfirmed: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(updateName, null);

  // Close shortly after a successful save so the "Saved." message is seen.
  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => dialog.current?.close(), 900);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <>
      <button type="button" className="ac-edit" onClick={() => dialog.current?.showModal()}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        Edit details
      </button>
      <dialog
        ref={dialog}
        className="ac-dialog"
        aria-labelledby="ac-details-title"
        onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}
      >
        <div className="ac-dialog-inner">
          <div className="ac-dialog-head">
            <h2 id="ac-details-title">Your details</h2>
            <button type="button" className="ac-dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <form action={action} className="ac-form">
            <div className={`co-field${state?.fieldErrors?.name ? ' has-error' : ''}`}>
              <label htmlFor="ac-name">Name</label>
              <input id="ac-name" name="name" defaultValue={name} autoComplete="name" required maxLength={100} />
              {state?.fieldErrors?.name && <p className="cl-form-error">{state.fieldErrors.name}</p>}
            </div>
            <div className="co-static ac-email"><span>Email</span>{email}</div>
            {!emailConfirmed && <p className="co-hint">Confirm your email (check your inbox) to link earlier guest orders.</p>}
            <a className="ac-small-link" href="/account/forgot">Change your password</a>
            {state?.error && <p className="cl-form-error">{state.error}</p>}
            {state?.ok && <p className="co-hint" role="status">{state.ok}</p>}
            <button className="cl-button cl-button-primary ac-submit" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
