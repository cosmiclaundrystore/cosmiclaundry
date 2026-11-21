import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront/page';
import { loadCatalog } from '@/lib/catalog/load-catalog';

// /sitemap.xml: every shop page, so search engines find each Laundry and tee.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteOrigin();
  const { collections, products } = await loadCatalog();
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/laundries`, changeFrequency: 'weekly', priority: 0.9 },
    ...collections.map((c) => ({ url: `${base}/laundries/${c.id}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/tees/${p.id}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
