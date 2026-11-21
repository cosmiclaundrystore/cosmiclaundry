import type { Metadata } from 'next';
import Link from 'next/link';
import { listCollections, listProducts, LOW_STOCK, productImage } from '@/lib/admin/data';
import { money } from '../ui';

export const metadata: Metadata = { title: 'Products' };

type Search = { collection?: string; q?: string; show?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [collections, products] = await Promise.all([listCollections(), listProducts(sp)]);
  const laundry = new Map(collections.map((c) => [c.id, c.name]));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Products</h1>
          <p>{products.length} tee{products.length === 1 ? '' : 's'}. Changes go live on the shop as soon as you save.</p>
        </div>
        <Link className="a-btn" href="/admin/products/new">Add a tee</Link>
      </div>

      <form className="a-filters" action="/admin/products">
        <input className="a-input" style={{ maxWidth: 260 }} name="q" defaultValue={sp.q} placeholder="Search by name" aria-label="Search tees" />
        <select className="a-input" style={{ maxWidth: 220 }} name="collection" defaultValue={sp.collection ?? ''} aria-label="Laundry">
          <option value="">All Laundries</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="a-input" style={{ maxWidth: 160 }} name="show" defaultValue={sp.show ?? ''} aria-label="Visibility">
          <option value="">Live and hidden</option>
          <option value="live">Live only</option>
          <option value="hidden">Hidden only</option>
        </select>
        <button className="a-btn ghost" type="submit">Filter</button>
        {(sp.q || sp.collection || sp.show) && <Link className="a-muted" href="/admin/products">Clear</Link>}
      </form>

      <div className="a-table-wrap">
        {products.length === 0 ? (
          <p className="a-empty">No tees match.</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr><th></th><th>Tee</th><th className="a-hide-sm">Laundry</th><th className="num">Price (LK)</th><th>Stock</th><th>On the shop</th></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const lk = p.product_prices.find((x) => x.region_code === 'LK');
                const tracked = p.product_colors.flatMap((c) => c.product_variants).filter((v) => v.stock !== null) as { stock: number }[];
                const total = tracked.reduce((n, v) => n + v.stock, 0);
                const low = tracked.filter((v) => v.stock <= LOW_STOCK).length;
                return (
                  <tr key={p.id}>
                    <td style={{ width: 60 }}><img className="a-thumb" src={productImage(p)} alt="" loading="lazy" /></td>
                    <td><Link className="row-link" href={`/admin/products/${p.id}`}>{p.name}</Link><div className="a-small a-muted">{p.id}</div></td>
                    <td className="a-hide-sm">{laundry.get(p.collection_id) ?? p.collection_id}</td>
                    <td className="num">{lk ? money(lk.amount_minor, 'LKR') : <span className="a-muted">Not set</span>}</td>
                    <td>
                      {tracked.length === 0 ? <span className="a-muted">Not tracked</span> : (
                        <>
                          {total} in stock
                          {low > 0 && <> <span className="a-badge low">{low} low</span></>}
                        </>
                      )}
                    </td>
                    <td><span className={`a-badge ${p.is_active ? 'live' : ''}`}>{p.is_active ? 'Live' : 'Hidden'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
