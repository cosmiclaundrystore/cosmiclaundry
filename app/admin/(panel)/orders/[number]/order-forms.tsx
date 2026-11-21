'use client';

import { useActionState } from 'react';
import { changePaymentStatus, saveFulfillment } from '@/lib/admin/actions';

const STEPS = [
  { value: 'unfulfilled', label: 'Not packed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

export function FulfillmentForm(props: {
  number: string; status: string; courier: string | null; tracking: string | null; note: string | null; shippedAt: string | null;
}) {
  const [state, action, pending] = useActionState(saveFulfillment, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="a-form">
      <input type="hidden" name="number" value={props.number} />
      <div className="a-row">
        <label className="a-field">
          <span>Status</span>
          <select name="fulfillment_status" defaultValue={props.status}>
            {STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="a-field">
          <span>Courier</span>
          <input name="courier" defaultValue={props.courier ?? ''} placeholder="e.g. Pronto, Koombiyo" />
        </label>
        <label className={`a-field${fe.tracking_number ? ' invalid' : ''}`}>
          <span>Tracking number</span>
          <input name="tracking_number" defaultValue={props.tracking ?? ''} aria-invalid={!!fe.tracking_number} />
          {fe.tracking_number && <span className="a-error-text">{fe.tracking_number}</span>}
        </label>
      </div>
      <label className="a-field">
        <span>Private note (only admins see this)</span>
        <textarea name="admin_note" defaultValue={props.note ?? ''} rows={2} />
      </label>
      {props.shippedAt && <p className="a-hint" style={{ margin: 0 }}>Shipped {props.shippedAt}</p>}
      {state?.error && <p className="a-notice error" role="alert">{state.error}</p>}
      {state?.ok && <p className="a-notice ok" role="status">{state.ok}</p>}
      <div className="a-actions">
        <button className="a-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save delivery'}</button>
        <span className="a-hint">The customer isn’t emailed yet. Send them the tracking number yourself for now.</span>
      </div>
    </form>
  );
}

const CHANGES: Record<string, { change: string; label: string; confirm: string; danger?: boolean }[]> = {
  pending: [
    { change: 'mark-paid', label: 'Mark as paid', confirm: 'Mark this order as paid? Only do this if you received the money another way (e.g. bank transfer).' },
    { change: 'cancel', label: 'Cancel order', confirm: 'Cancel this order?', danger: true },
  ],
  failed: [
    { change: 'mark-paid', label: 'Mark as paid', confirm: 'Mark this order as paid? Only do this if you received the money another way (e.g. bank transfer).' },
    { change: 'cancel', label: 'Cancel order', confirm: 'Cancel this order?', danger: true },
  ],
  paid: [{ change: 'refund', label: 'Mark as refunded', confirm: 'Mark this order as refunded? This only records it here: do the actual refund in the PAYable portal.', danger: true }],
  fulfilled: [{ change: 'refund', label: 'Mark as refunded', confirm: 'Mark this order as refunded? This only records it here: do the actual refund in the PAYable portal.', danger: true }],
};

export function PaymentActions({ number, status }: { number: string; status: string }) {
  const [state, action, pending] = useActionState(changePaymentStatus, null);
  const options = CHANGES[status] ?? [];
  if (options.length === 0 && !state) return null;
  return (
    <form action={action} className="a-form" style={{ gap: 12 }}>
      <input type="hidden" name="number" value={number} />
      {state?.error && <p className="a-notice error" role="alert">{state.error}</p>}
      {state?.ok && <p className="a-notice ok" role="status">{state.ok}</p>}
      <div className="a-actions">
        {options.map((o) => (
          <button
            key={o.change}
            className={`a-btn ${o.danger ? 'danger' : 'ghost'}`}
            type="submit"
            name="change"
            value={o.change}
            disabled={pending}
            onClick={(e) => { if (!window.confirm(o.confirm)) e.preventDefault(); }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </form>
  );
}
