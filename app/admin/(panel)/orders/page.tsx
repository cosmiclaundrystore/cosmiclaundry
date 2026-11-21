import type { Metadata } from 'next';
import Link from 'next/link';
import { listOrders, ORDERS_PER_PAGE, regionMismatch } from '@/lib/admin/data';
import { money, StatusBadge, when } from '../ui';

export const metadata: Metadata = { title: 'Orders' };

const TABS = [
  { value: '', label: 'All' },
  { value: 'to-ship', label: 'To ship' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

type Search = { status?: string; q?: string; page?: string };

function href(params: Search) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return `/admin/orders${qs ? `?${qs}` : ''}`;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, hasMore } = await listOrders({ status: sp.status, q: sp.q, page });
  const exportHref = `/admin/orders/export${href({ status: sp.status, q: sp.q }).replace('/admin/orders', '')}`;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Orders</h1>
          <p>Newest first. Open an order to pack, ship, add tracking or refund it.</p>
        </div>
        <a className="a-btn ghost" href={exportHref}>Download CSV</a>
      </div>

      <nav className="a-tabs" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link key={t.value} href={href({ status: t.value, q: sp.q })} aria-current={(sp.status ?? '') === t.value ? 'true' : undefined}>{t.label}</Link>
        ))}
      </nav>

      <form className="a-filters" action="/admin/orders">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <input className="a-input" style={{ maxWidth: 340 }} name="q" defaultValue={sp.q} placeholder="Order number, name, email or phone" aria-label="Search orders" />
        <button className="a-btn ghost" type="submit">Search</button>
        {sp.q && <Link className="a-muted" href={href({ status: sp.status })}>Clear</Link>}
      </form>

      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">No orders match.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr><th>Order</th><th>Placed</th><th>Customer</th><th className="a-hide-sm">City</th><th className="num">Items</th><th>Payment</th><th>Delivery</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.number}>
                  <td><Link className="row-link" href={`/admin/orders/${o.number}`}>{o.number}</Link></td>
                  <td className="a-muted" style={{ whiteSpace: 'nowrap' }}>{when(o.created_at)}</td>
                  <td>{o.first_name} {o.last_name}<div className="a-small a-muted">{o.email}</div></td>
                  <td className="a-hide-sm">{o.city}</td>
                  <td className="num">{o.order_items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td><StatusBadge status={o.status} />{regionMismatch(o) && <span className="a-badge check" title={regionMismatch(o) ?? ''} style={{ marginLeft: 6 }}>Check</span>}</td>
                  <td>{o.status === 'paid' || o.status === 'fulfilled' ? <StatusBadge status={o.fulfillment_status} /> : <span className="a-muted">—</span>}</td>
                  <td className="num">{money(o.total_minor, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="a-pager">
        <span>Page {page}{rows.length ? ` · ${(page - 1) * ORDERS_PER_PAGE + 1}–${(page - 1) * ORDERS_PER_PAGE + rows.length}` : ''}</span>
        <div className="a-actions">
          {page > 1 && <Link className="a-btn ghost small" href={href({ ...sp, page: String(page - 1) })}>← Newer</Link>}
          {hasMore && <Link className="a-btn ghost small" href={href({ ...sp, page: String(page + 1) })}>Older →</Link>}
        </div>
      </div>
    </>
  );
}
