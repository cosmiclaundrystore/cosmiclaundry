import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLaundry, productImage } from '@/lib/admin/data';
import { LaundryForm } from '../laundry-form';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: (await getLaundry((await params).id))?.name ?? 'Laundry' };
}

export default async function EditLaundryPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const laundry = await getLaundry(id);
  if (!laundry) notFound();

  return (
    <>
      <Link className="a-back" href="/admin/laundries">← Laundries</Link>
      <div className="a-head">
        <div>
          <h1>{laundry.name}</h1>
          <p>{laundry.id} · {laundry.is_active ? 'Live on the shop' : 'Hidden from the shop'}</p>
        </div>
        <div className="a-actions">
          <a className="a-btn ghost" href={`/laundries/${laundry.id}`} target="_blank" rel="noreferrer">View on shop ↗</a>
          <Link className="a-btn" href={`/admin/products/new?collection=${laundry.id}`}>Add a tee</Link>
        </div>
      </div>
      {sp.saved && <p className="a-notice ok" style={{ marginBottom: 18 }}>Laundry created. Now add its tees.</p>}
      <LaundryForm
        isNew={false}
        tees={laundry.products}
        values={{
          id: laundry.id, name: laundry.name, short_name: laundry.short_name, tagline: laundry.tagline, description: laundry.description,
          featured_product_id: laundry.featured_product_id ?? '', sort_order: String(laundry.sort_order),
          is_active: laundry.is_active, show_on_home: laundry.show_on_home,
        }}
      />

      <h2 className="a-h2" style={{ marginTop: 32 }}>Tees in this Laundry ({laundry.products.length})</h2>
      <div className="a-table-wrap">
        {laundry.products.length === 0 ? (
          <p className="a-empty">No tees yet. <Link href={`/admin/products/new?collection=${laundry.id}`}>Add the first one</Link>.</p>
        ) : (
          <table className="a-table">
            <tbody>
              {laundry.products.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: 60 }}><img className="a-thumb" src={productImage(p)} alt="" loading="lazy" /></td>
                  <td><Link className="row-link" href={`/admin/products/${p.id}`}>{p.name}</Link>{p.id === laundry.featured_product_id && <span className="a-badge" style={{ marginLeft: 8 }}>Featured</span>}</td>
                  <td className="num a-muted">#{p.sort_order}</td>
                  <td><span className={`a-badge ${p.is_active ? 'live' : ''}`}>{p.is_active ? 'Live' : 'Hidden'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
