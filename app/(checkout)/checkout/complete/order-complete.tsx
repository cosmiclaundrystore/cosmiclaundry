'use client';

import { useEffect, useRef, useState } from 'react';
import { BASKET_STORAGE_KEY, COLORS } from '@/lib/checkout/shared';
import type { OrderView } from '@/lib/orders/store';
import { OrderSummary } from '../order-summary';

const POLL_MS = 2000;
const POLL_LIMIT = 30; // about a minute, then we stop and say we'll email
const arrowIcon = <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg>;

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'order'; order: OrderView; slow: boolean };

export function OrderComplete({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const polls = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!orderNumber || !token) { setState({ kind: 'not_found' }); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (response.status === 404) { setState({ kind: 'not_found' }); return; }
        const data = await response.json();
        if (!response.ok) throw new Error();
        const order = data.order as OrderView;
        polls.current += 1;
        const slow = order.status === 'pending' && polls.current >= POLL_LIMIT;
        setState({ kind: 'order', order, slow });
        if (order.status === 'paid') {
          try { localStorage.removeItem(BASKET_STORAGE_KEY); } catch { /* storage unavailable */ }
        }
        if (order.status === 'pending' && !slow && !stopped) timer = setTimeout(poll, POLL_MS);
      } catch {
        polls.current += 1;
        if (!stopped && polls.current < POLL_LIMIT) timer = setTimeout(poll, POLL_MS);
      }
    }
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderNumber, token]);

  const status = state.kind === 'order' ? state.order.status : null;
  useEffect(() => { if (status && status !== 'pending') headingRef.current?.focus(); }, [status]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/pay`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token }) });
      const data = await response.json();
      if (response.ok && typeof data.redirectUrl === 'string') { window.location.assign(data.redirectUrl); return; }
      setRetryError(data.message || 'We could not start a new payment. Please try again.');
    } catch {
      setRetryError('We could not reach the server. Check your connection and try again.');
    }
    setRetrying(false);
  }

  if (state.kind === 'loading') {
    return <div className="co-state" role="status"><span className="co-spinner" aria-hidden="true" /><h1>Confirming your payment…</h1><p>This usually takes a few seconds. Please keep this page open.</p></div>;
  }
  if (state.kind === 'not_found') {
    return (
      <div className="co-state">
        <h1>We couldn’t find that order.</h1>
        <p>Check the link in your confirmation email, or message us on WhatsApp and we’ll help.</p>
        <a className="cl-button cl-button-primary" href="/">Back to the shop {arrowIcon}</a>
      </div>
    );
  }

  const { order, slow } = state;
  const summary = (
    <OrderSummary
      heading={`Order ${order.number}`}
      currency={order.currency}
      subtotalMinor={order.subtotalMinor}
      shippingMinor={order.shippingMinor}
      shippingLabel="Delivery"
      totalMinor={order.totalMinor}
      lines={order.items.map((item, index) => ({
        key: `${index}`,
        name: item.name,
        detail: `${COLORS[item.color as keyof typeof COLORS] ?? item.color} / Size ${item.size}`,
        quantity: item.quantity,
        lineMinor: item.lineMinor,
        image: item.productId ? `/assets/products/${item.productId}-${item.color}-480.webp?v=final16-2` : undefined,
      }))}
    />
  );

  if (order.status === 'paid' || order.status === 'fulfilled') {
    return (
      <div className="co-layout co-result">
        <div className="co-main">
          <p className="co-kicker">Order {order.number}</p>
          <h1 className="co-title" tabIndex={-1} ref={headingRef}>Thank you, {order.firstName}. Your laundry is on its way.</h1>
          <p className="co-lead">Payment received. A confirmation will be sent to <strong>{order.email}</strong>, and we’ll be in touch when your tees are dispatched.</p>
          <a className="cl-button cl-button-primary" href="/laundries">Keep exploring {arrowIcon}</a>
        </div>
        <aside className="co-aside">{summary}</aside>
      </div>
    );
  }

  if (order.status === 'failed') {
    return (
      <div className="co-layout co-result">
        <div className="co-main">
          <p className="co-kicker">Order {order.number}</p>
          <h1 className="co-title" tabIndex={-1} ref={headingRef}>Your payment didn’t go through.</h1>
          <p className="co-lead">No money was taken. You can try again with the same or a different card. Your order is saved.</p>
          {retryError ? <p className="co-submit-error" role="alert">{retryError}</p> : null}
          <div className="co-actions">
            <button type="button" className="cl-button cl-button-primary" onClick={retry} disabled={retrying} aria-busy={retrying}>
              <span>{retrying ? 'Taking you to payment…' : 'Try again'}</span>{arrowIcon}
            </button>
            <a className="cl-button cl-button-secondary" href="/checkout">Change details</a>
          </div>
        </div>
        <aside className="co-aside">{summary}</aside>
      </div>
    );
  }

  if (order.status === 'pending') {
    return (
      <div className="co-layout co-result">
        <div className="co-main" role="status">
          <p className="co-kicker">Order {order.number}</p>
          {slow ? (
            <>
              <h1 className="co-title">We’re still confirming your payment.</h1>
              <p className="co-lead">This is taking longer than usual. If your payment went through, we’ll email <strong>{order.email}</strong> as soon as it’s confirmed. Please don’t pay again.</p>
              <button type="button" className="cl-button cl-button-secondary" onClick={() => location.reload()}>Check again</button>
            </>
          ) : (
            <>
              <span className="co-spinner" aria-hidden="true" />
              <h1 className="co-title">Confirming your payment…</h1>
              <p className="co-lead">This usually takes a few seconds. Please keep this page open.</p>
            </>
          )}
        </div>
        <aside className="co-aside">{summary}</aside>
      </div>
    );
  }

  return (
    <div className="co-state">
      <h1>Order {order.number} is {order.status}.</h1>
      <p>Questions? Message us on WhatsApp and we’ll help.</p>
      <a className="cl-button cl-button-primary" href="/">Back to the shop {arrowIcon}</a>
    </div>
  );
}
