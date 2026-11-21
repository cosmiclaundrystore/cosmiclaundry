import type { Metadata } from 'next';
import Link from 'next/link';
import { listLaundries, productImage } from '@/lib/admin/data';

export const metadata: Metadata = { title: 'Laundries' };

export default async function LaundriesPage() {
  const laundries = await listLaundries();
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Laundries</h1>
          <p>{laundries.length} Laundries, in menu order. Open one to rename it, pick its featured tee or hide it.</p>
        </div>
        <Link className="a-btn" href="/admin/laundries/new">New Laundry</Link>
      </div>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr><th></th><th>Laundry</th><th className="num">Position</th><th className="num">Tees</th><th className="a-hide-sm">Home strip</th><th>On the shop</th><th></th></tr>
          </thead>
          <tbody>
            {laundries.map((l) => {
              const live = l.products.filter((p) => p.is_active);
              const featured = live.find((p) => p.id === l.featured_product_id) ?? live[0];
              return (
                <tr key={l.id}>
                  <td style={{ width: 60 }}>{featured ? <img className="a-thumb" src={productImage(featured)} alt="" loading="lazy" /> : <div className="a-thumb" />}</td>
                  <td><Link className="row-link" href={`/admin/laundries/${l.id}`}>{l.name}</Link><div className="a-small a-muted">{l.tagline || l.short_name}</div></td>
                  <td className="num">{l.sort_order}</td>
                  <td className="num">{live.length}{l.products.length > live.length && <span className="a-muted"> +{l.products.length - live.length} hidden</span>}</td>
                  <td className="a-hide-sm">{l.show_on_home ? 'Yes' : <span className="a-muted">No</span>}</td>
                  <td><span className={`a-badge ${l.is_active ? 'live' : ''}`}>{l.is_active ? 'Live' : 'Hidden'}</span></td>
                  <td className="num"><Link className="a-btn ghost small" href={`/admin/products/new?collection=${l.id}`}>Add a tee</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
