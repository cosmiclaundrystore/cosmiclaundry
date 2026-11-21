import { renderCatalogScript } from '@/lib/catalog/catalog-script';
import { loadCatalog } from '@/lib/catalog/load-catalog';

// Served at /catalog.js, the URL the storefront HTML already loads.
// Prerendered and refreshed from Supabase at most every minute (keep in sync with CATALOG_REVALIDATE_SECONDS).
export const revalidate = 60;

export async function GET() {
  const catalog = await loadCatalog();
  return new Response(renderCatalogScript(catalog), {
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });
}
