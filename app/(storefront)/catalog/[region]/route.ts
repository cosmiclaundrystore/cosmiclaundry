import { notFound } from 'next/navigation';
import { renderCatalogScript } from '@/lib/catalog/catalog-script';
import { loadCatalog } from '@/lib/catalog/load-catalog';
import { CHECKOUT_REGIONS, parseRegion } from '@/lib/checkout/shared';

// The catalog for one shopping region: /catalog/LK, /catalog/UK, /catalog/US.
// Pages ask for /catalog.js; proxy.ts rewrites that to the visitor's region, so each version is cached on its own.
export const revalidate = 60;

export function generateStaticParams() {
  return CHECKOUT_REGIONS.map((region) => ({ region }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ region: string }> }) {
  const region = parseRegion((await params).region);
  if (!region) notFound();
  return new Response(renderCatalogScript(await loadCatalog(region)), {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });
}
