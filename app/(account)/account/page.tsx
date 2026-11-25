import type { Metadata } from 'next';
import { accountSummary, type AccountOrder } from '@/lib/account/data';
import { CREDITS_FOR_REWARD, CREDITS_PER_CUSTOM_TEE, CREDITS_PER_TEE } from '@/lib/account/credits';
import { ensureCustomer, requireCustomer } from '@/lib/account/session';
import { signOut } from '@/lib/account/actions';
import { formatMoney } from '@/lib/checkout/shared';
import { DetailsDialog } from './name-form';

export const metadata: Metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** One plain status per order, from its payment and delivery state. */
function orderStatus(o: AccountOrder): { label: string; tone: string } {
  if (o.status === 'refunded') return { label: 'Refunded', tone: 'muted' };
  if (o.status === 'cancelled') return { label: 'Cancelled', tone: 'muted' };
  if (o.status === 'failed') return { label: 'Payment failed', tone: 'bad' };
  if (o.status === 'pending') return { label: 'Awaiting payment', tone: 'warn' };
  if (o.fulfillment_status === 'delivered') return { label: 'Delivered', tone: 'good' };
  if (o.fulfillment_status === 'shipped') return { label: 'Shipped', tone: 'info' };
  if (o.fulfillment_status === 'packed') return { label: 'Packed', tone: 'info' };
  return { label: 'Paid · preparing', tone: 'info' };
}

function orderCredits(o: AccountOrder): { earned: number | null; pending: number } {
  const earned = o.credit_ledger.filter((l) => l.reason === 'order_delivered').reduce((n, l) => n + l.delta, 0);
  const reversed = o.credit_ledger.some((l) => l.reason === 'order_refunded');
  const worth = o.order_items.reduce((n, i) => n + i.quantity * (i.design_path || i.products?.collection_id === 'custom' ? CREDITS_PER_CUSTOM_TEE : CREDITS_PER_TEE), 0);
  return { earned: earned && !reversed ? earned : null, pending: worth };
}

const teeImage = (i: AccountOrder['order_items'][number]) =>
  i.product_id ? (i.products?.image_base ? `${i.products.image_base}-${i.color}-480.webp` : `/assets/products/${i.product_id}-${i.color}-480.webp`) : '';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const customer = await requireCustomer('/account');
  await ensureCustomer(customer);
  const [summary, sp] = await Promise.all([accountSummary(customer), searchParams]);
  const balance = Math.max(0, summary.balance);
  const progress = Math.min(100, Math.round((balance / CREDITS_FOR_REWARD) * 100));
  const toGo = Math.max(0, CREDITS_FOR_REWARD - balance);
  const teesToGo = Math.ceil(toGo / CREDITS_PER_TEE);

  return (
    <div className="ac-dashboard">
      <div className="ac-head">
        <div>
          <p className="co-kicker">Your account</p>
          <h1>Hi{summary.name ? `, ${summary.name.split(' ')[0]}` : ''}.</h1>
          <div className="ac-head-meta">
            <span>{customer.email}</span>
            <DetailsDialog name={summary.name} email={customer.email ?? ''} emailConfirmed={customer.emailConfirmed} />
          </div>
        </div>
        <form action={signOut}><button className="ac-signout" type="submit">Sign out</button></form>
      </div>
      {sp.password === 'updated' && <p className="co-notice ac-ok" role="status">Your password has been changed.</p>}

      <section className="ac-card ac-credits" aria-labelledby="ac-credits-title">
        <div className="ac-credits-head">
          <h2 id="ac-credits-title">Laundry credits</h2>
          <p><strong>{balance.toLocaleString('en-US')}</strong> / {CREDITS_FOR_REWARD.toLocaleString('en-US')}</p>
        </div>
        <div className="ac-bar" role="progressbar" aria-valuemin={0} aria-valuemax={CREDITS_FOR_REWARD} aria-valuenow={balance} aria-label="Credits towards your next reward">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="ac-credits-note">
          {toGo === 0 ? 'Your next reward is on its way.' : `${toGo.toLocaleString('en-US')} credits to go: about ${teesToGo} more ${teesToGo === 1 ? 'tee' : 'tees'} until 20% off plus free delivery.`}
        </p>
        {summary.rewardsAvailable > 0 && (
          <div className="ac-reward" role="status">
            <strong>{summary.rewardsAvailable === 1 ? 'You have a reward ready!' : `You have ${summary.rewardsAvailable} rewards ready!`}</strong>
            <span>20% off your tees and free delivery on your next order. Tick “Use my reward” at checkout.</span>
            <a className="cl-button cl-button-primary" href="/laundries">Shop now</a>
          </div>
        )}
        {summary.rewardsHeld > 0 && <p className="co-hint">A reward is being used on an order that hasn’t been paid yet. If that order is cancelled, it comes back.</p>}
        <details className="ac-how">
          <summary>How credits work</summary>
          <ul>
            <li>Earn {CREDITS_PER_TEE} credits for every tee and {CREDITS_PER_CUSTOM_TEE} for every custom tee, once your order is delivered.</li>
            <li>Every {CREDITS_FOR_REWARD.toLocaleString('en-US')} credits unlock a reward: 20% off the tees in one order, plus free delivery.</li>
            <li>Credits and rewards don’t expire. Refunded orders don’t earn credits.</li>
            <li>Only orders placed while you’re signed in count, plus earlier guest orders made with this email.</li>
          </ul>
        </details>
      </section>

      <section className="ac-card" aria-labelledby="ac-orders-title">
        <h2 id="ac-orders-title">Recent orders</h2>
        {summary.orders.length === 0 ? (
          <p className="ac-empty">No orders yet. <a href="/laundries">Find your first tee</a>, and it’ll show up here with its credits.</p>
        ) : (
          <ul className="ac-orders">
            {summary.orders.map((o) => {
              const status = orderStatus(o);
              const credits = orderCredits(o);
              const pieces = o.order_items.reduce((n, i) => n + i.quantity, 0);
              const live = !['cancelled', 'refunded', 'failed'].includes(o.status);
              return (
                <li key={o.number} className="ac-order">
                  <div className="ac-order-top">
                    <div>
                      <strong>{o.number}</strong>
                      <span className="ac-muted"> · {DATE.format(new Date(o.created_at))} · {pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
                    </div>
                    <span className={`ac-status ${status.tone}`}>{status.label}</span>
                  </div>
                  <div className="ac-order-items">
                    {o.order_items.slice(0, 5).map((i, n) => (
                      <span className="ac-order-item" key={n} title={`${i.product_name} · ${i.color} · ${i.size}`}>
                        {teeImage(i) ? <img src={teeImage(i)} alt="" width={48} height={60} loading="lazy" /> : null}
                        <span>{i.product_name}<small>{i.color} · {i.size}{i.quantity > 1 ? ` · ×${i.quantity}` : ''}</small></span>
                      </span>
                    ))}
                  </div>
                  <div className="ac-order-bottom">
                    <span>
                      {formatMoney(o.total_minor, o.currency)}
                      {o.discount_minor > 0 && <span className="ac-muted"> · reward used (−{formatMoney(o.discount_minor, o.currency)})</span>}
                    </span>
                    <span className="ac-order-credits">
                      {credits.earned ? `+${credits.earned} credits earned` : live && o.status !== 'pending' ? `${credits.pending} credits when delivered` : ''}
                    </span>
                  </div>
                  {o.tracking_number && (o.fulfillment_status === 'shipped' || o.fulfillment_status === 'delivered') && (
                    <p className="ac-tracking">Tracking: {o.courier ? `${o.courier} · ` : ''}<strong>{o.tracking_number}</strong></p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
