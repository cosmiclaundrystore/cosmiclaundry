import type { Metadata } from 'next';
import Link from 'next/link';
import { LOW_STOCK, overview, type SalesTotals, regionMismatch } from '@/lib/admin/data';
import type { Currency } from '@/lib/checkout/shared';
import { money, StatusBadge, when } from './ui';

export const metadata: Metadata = { title: 'Overview' };

function Sales({ label, totals }: { label: string; totals: SalesTotals }) {
  const entries = Object.entries(totals) as [Currency, { minor: number; orders: number }][];
  return (
    <div className="a-stat">
      <div className="a-stat-label">{label}</div>
      {entries.length === 0 ? (
        <div className="a-stat-value">Rs 0<small>No paid orders yet</small></div>
      ) : (
        entries.map(([currency, t]) => (
          <div className="a-stat-value" key={currency}>
            {money(t.minor, currency)}
            <small>{t.orders} paid order{t.orders === 1 ? '' : 's'}</small>
          </div>
        ))
      )}
    </div>
  );
}

export default async function OverviewPage() {
  const data = await overview();
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Overview</h1>
          <p>Sales are counted when an order is paid. Times are Sri Lanka time.</p>
        </div>
      </div>

      <div className="a-stats">
        <Sales label="Sales today" totals={data.today} />
        <Sales label="Sales this month" totals={data.month} />
        <Link className="a-stat" href="/admin/orders?status=to-ship">
          <div className="a-stat-label">Paid, waiting to ship</div>
          <div className="a-stat-value">{data.toShip}<small>Open the list →</small></div>
        </Link>
        <Link className="a-stat" href="/admin/orders?status=pending">
          <div className="a-stat-label">Awaiting payment (last 2 days)</div>
          <div className="a-stat-value">{data.awaiting}<small>Started checkout, not paid</small></div>
        </Link>
      </div>

      <div className="a-two">
        <section>
          <div className="a-head" style={{ marginBottom: 12 }}>
            <h2 className="a-h2" style={{ margin: 0 }}>Latest orders</h2>
            <Link className="a-btn ghost small" href="/admin/orders">All orders</Link>
          </div>
          <div className="a-table-wrap">
            {data.recent.length === 0 ? (
              <p className="a-empty">No orders yet.</p>
            ) : (
              <table className="a-table">
                <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.number}>
                      <td><Link className="row-link" href={`/admin/orders/${o.number}`}>{o.number}</Link><div className="a-small a-muted">{when(o.created_at)}</div></td>
                      <td>{o.first_name} {o.last_name}</td>
                      <td><StatusBadge status={o.status} />{regionMismatch(o) && <span className="a-badge check" title={regionMismatch(o) ?? ''} style={{ marginLeft: 6 }}>Check</span>}</td>
                      <td className="num">{money(o.total_minor, o.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 className="a-h2">Low stock <span className="a-muted a-small">({LOW_STOCK} or fewer left)</span></h2>
          <div className="a-table-wrap">
            {data.lowStock.length === 0 ? (
              <p className="a-empty">Nothing is running low. Stock is only tracked for sizes where you’ve entered a number.</p>
            ) : (
              <table className="a-table">
                <thead><tr><th>Tee</th><th>Variant</th><th className="num">Left</th></tr></thead>
                <tbody>
                  {data.lowStock.map((v) => (
                    <tr key={`${v.product_id}-${v.color}-${v.size}`}>
                      <td><Link className="row-link" href={`/admin/products/${v.product_id}`}>{v.product_colors.products.name}</Link></td>
                      <td className="a-muted" style={{ textTransform: 'capitalize' }}>{v.color} · {v.size}</td>
                      <td className="num"><span className={`a-badge ${v.stock === 0 ? 'out' : 'low'}`}>{v.stock === 0 ? 'Sold out' : v.stock}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
