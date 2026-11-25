import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { designLinks, getOrder, productImage, regionMismatch } from '@/lib/admin/data';
import { money, StatusBadge, when } from '../../ui';
import { FulfillmentForm, PaymentActions } from './order-forms';

type Params = { number: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: (await params).number };
}

export default async function OrderPage({ params }: { params: Promise<Params> }) {
  const { number } = await params;
  const order = await getOrder(decodeURIComponent(number));
  if (!order) notFound();
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  const mismatch = regionMismatch(order);
  const designs = await designLinks(order.order_items.map((i) => i.design_path));
  const pieces = order.order_items.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <Link className="a-back" href="/admin/orders">← Orders</Link>
      <div className="a-head">
        <div>
          <h1>{order.number}</h1>
          <p>Placed {when(order.created_at, true)}{order.paid_at ? ` · paid ${when(order.paid_at, true)}` : ''}</p>
        </div>
        <div className="a-actions">
          <StatusBadge status={order.status} />
          {paid && <StatusBadge status={order.fulfillment_status} />}
        </div>
      </div>

      {mismatch && (
        <p className="a-notice warn" style={{ marginBottom: 18 }}>
          <strong>Check before shipping.</strong> {mismatch} The delivery address must be in {order.country_code}. If it isn’t, refund the
          order in PAYable and mark it refunded here.
        </p>
      )}
      <div className="a-two">
        <div className="a-grid">
          <section className="a-card">
            <h2 className="a-h2">{pieces} piece{pieces === 1 ? '' : 's'}</h2>
            <div className="a-lines">
              {order.order_items.map((item, i) => (
                <div className="a-line" key={i}>
                  {item.products ? <img src={productImage(item.products, item.color)} alt="" loading="lazy" /> : <span />}
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {item.product_id ? <Link href={`/admin/products/${item.product_id}`}>{item.product_name}</Link> : item.product_name}
                    </div>
                    <div className="a-small a-muted" style={{ textTransform: 'capitalize' }}>
                      {item.color} · Size {item.size} · {item.quantity} × {money(item.unit_price_minor, order.currency)}
                    </div>
                    {item.design_path && (
                      <div className="a-design">
                        {designs[item.design_path] ? (
                          <>
                            <a href={designs[item.design_path]} target="_blank" rel="noreferrer"><img src={designs[item.design_path]} alt="Customer design" /></a>
                            <div>
                              <a className="a-btn ghost small" href={`${designs[item.design_path]}&download=${encodeURIComponent(`${order.number}-design.${item.design_path.split('.').pop()}`)}`}>Download design</a>
                              {item.design_note && <p className="a-design-note">“{item.design_note}”</p>}
                            </div>
                          </>
                        ) : (
                          <p className="a-small a-muted">Design file removed (designs are cleaned up 30 days after delivery).{item.design_note ? ` Note: “${item.design_note}”` : ''}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>{money(item.line_total_minor, order.currency)}</div>
                </div>
              ))}
            </div>
            <div className="a-totals">
              <div><span className="a-muted">Subtotal</span><span>{money(order.subtotal_minor, order.currency)}</span></div>
              <div><span className="a-muted">Delivery</span><span>{money(order.shipping_minor, order.currency)}</span></div>
              {order.discount_minor > 0 && <div><span className="a-muted">Reward (20% off + free delivery)</span><span>−{money(order.discount_minor, order.currency)}</span></div>}
              <div className="grand"><span>Total</span><span>{money(order.total_minor, order.currency)}</span></div>
            </div>
          </section>

          <section className="a-card">
            <h2 className="a-h2">Delivery</h2>
            {paid ? (
              <FulfillmentForm
                number={order.number}
                status={order.fulfillment_status}
                courier={order.courier}
                tracking={order.tracking_number}
                note={order.admin_note}
                shippedAt={order.shipped_at ? when(order.shipped_at, true) : null}
              />
            ) : (
              <p className="a-notice info">Packing and shipping open once the order is paid.</p>
            )}
          </section>

          <section className="a-card">
            <h2 className="a-h2">Payment</h2>
            {order.payment_attempts.length === 0 ? (
              <p className="a-muted">No payment attempts yet.</p>
            ) : (
              <div className="a-table-wrap" style={{ marginBottom: 16 }}>
                <table className="a-table">
                  <thead><tr><th>PAYable invoice</th><th>Result</th><th>Method</th><th>Transaction</th><th>Started</th></tr></thead>
                  <tbody>
                    {order.payment_attempts.map((a) => (
                      <tr key={a.invoice_id}>
                        <td>{a.invoice_id}</td>
                        <td><StatusBadge status={a.status} /></td>
                        <td>{[a.payment_method, a.card_number_masked].filter(Boolean).join(' ') || '—'}</td>
                        <td className="a-small">{a.payable_transaction_id ?? '—'}</td>
                        <td className="a-muted">{when(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PaymentActions number={order.number} status={order.status} />
          </section>
        </div>

        <aside className="a-grid">
          <section className="a-card">
            <h2 className="a-h2">Customer</h2>
            <dl className="a-dl">
              <dt>Name</dt><dd>{order.first_name} {order.last_name}</dd>
              <dt>Email</dt><dd><a href={`mailto:${order.email}`}>{order.email}</a></dd>
              <dt>Phone</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a></dd>
              <dt>Connecting from</dt><dd>{order.visitor_country ?? 'Unknown'}</dd>
              <dt>Account</dt><dd>{order.user_id ? 'Signed-in customer (earns credits when delivered)' : 'Guest'}</dd>
            </dl>
          </section>
          <section className="a-card">
            <h2 className="a-h2">Ship to</h2>
            <address style={{ fontStyle: 'normal', lineHeight: 1.7 }}>
              {order.first_name} {order.last_name}<br />
              {order.address_line1}<br />
              {order.address_line2 && <>{order.address_line2}<br /></>}
              {order.city} {order.postcode}<br />
              {order.country_code}
            </address>
            {order.notes && (
              <>
                <h3 className="a-label" style={{ margin: '14px 0 4px', fontWeight: 400 }}>Customer note</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{order.notes}</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
