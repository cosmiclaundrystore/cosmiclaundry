import { loadCatalog } from '@/lib/catalog/load-catalog';
import { laundryPage } from '@/lib/storefront/page';

export const revalidate = 60;

// Built ahead of time for every current id; ids added later in the admin are built on first visit, then cached.
export async function generateStaticParams() {
  const catalog = await loadCatalog();
  return catalog.collections.map((x) => ({ id: x.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return laundryPage((await params).id);
}
