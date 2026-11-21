import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, listCollections, productImage } from '@/lib/admin/data';
import { ProductForm, type ProductFormValues } from '../product-form';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const product = await getProduct((await params).id);
  return { title: product?.name ?? 'Tee' };
}

const major = (minor: number) => String(minor / 100);

export default async function EditProductPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, collections] = await Promise.all([getProduct(id), listCollections()]);
  if (!product) notFound();

  const values: ProductFormValues = {
    id: product.id,
    name: product.name,
    description: product.description,
    collection_id: product.collection_id,
    default_color: product.default_color,
    sort_order: product.sort_order,
    is_active: product.is_active,
    prices: Object.fromEntries(product.product_prices.map((p) => [p.region_code, major(p.amount_minor)])),
    stock: Object.fromEntries(product.product_colors.map((c) => [
      c.color,
      Object.fromEntries(c.product_variants.map((v) => [v.size, v.stock === null ? '' : String(v.stock)])),
    ])),
    photos: { black: productImage(product, 'black', false), white: productImage(product, 'white', false) },
  };

  return (
    <>
      <Link className="a-back" href="/admin/products">← Products</Link>
      <div className="a-head">
        <div>
          <h1>{product.name}</h1>
          <p>{product.id} · {product.is_active ? 'Live on the shop' : 'Hidden from the shop'}</p>
        </div>
        <a className="a-btn ghost" href={`/tees/${product.id}`} target="_blank" rel="noreferrer">View on shop ↗</a>
      </div>
      {sp.saved && <p className="a-notice ok" style={{ marginBottom: 18 }}>Tee added. It’s live on the shop now.</p>}
      <ProductForm key={product.image_base ?? 'local'} isNew={false} values={values} collections={collections} />
    </>
  );
}
