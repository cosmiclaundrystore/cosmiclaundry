import type { Metadata } from 'next';
import Link from 'next/link';
import { listCollections } from '@/lib/admin/data';
import { ProductForm } from '../product-form';

export const metadata: Metadata = { title: 'Add a tee' };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ collection?: string }> }) {
  const [collections, sp] = await Promise.all([listCollections(), searchParams]);
  return (
    <>
      <Link className="a-back" href="/admin/products">← Products</Link>
      <div className="a-head">
        <div>
          <h1>Add a tee</h1>
          <p>It comes in black and white, sizes S–XXL. For a whole batch at once, send Claude a zip instead.</p>
        </div>
      </div>
      <ProductForm
        isNew
        collections={collections}
        values={{
          id: '', name: '', description: '', collection_id: sp.collection ?? '', default_color: 'black', sort_order: 0, is_active: true,
          prices: { LK: '3499', UK: '19.99', US: '24.99' }, stock: {}, photos: { black: null, white: null },
        }}
      />
    </>
  );
}
