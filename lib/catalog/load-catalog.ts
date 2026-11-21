import 'server-only';
import { catalogSnapshot } from './seed-data';
import type { CatalogCollection, CatalogData, CatalogProduct } from './types';

import { DEFAULT_REGION, REGION_CURRENCY, type RegionCode } from '@/lib/checkout/shared';

// One catalog per shopping region (LK / UK / US): same tees, prices in that region's currency.
// proxy.ts sends each visitor's /catalog.js to /catalog/<region>.js.
const MINOR_UNITS_PER_MAJOR = 100;
export const CATALOG_REVALIDATE_SECONDS = 60;

/** Shows the basket's Checkout button when CHECKOUT_ENABLED=true. Otherwise the basket keeps WhatsApp ordering only. */
function commerceSettings(region: RegionCode): CatalogData['commerce'] {
  const enabled = process.env.CHECKOUT_ENABLED === 'true';
  return {
    ...catalogSnapshot.commerce,
    mode: enabled ? 'checkout' : catalogSnapshot.commerce.mode,
    currency: REGION_CURRENCY[region],
    region,
    checkoutUrl: enabled ? '/checkout' : null,
  };
}

type CollectionRow = {
  id: string;
  name: string;
  short_name: string;
  tagline: string;
  description: string;
  featured_product_id: string | null;
  tint: string;
  accent: string;
  theme: string;
  show_on_home: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  collection_id: string;
  default_color: 'black' | 'white';
  description: string;
  image_base?: string | null;
  product_prices: { amount_minor: number }[];
};

async function fetchRows<T>(url: string, key: string, path: string): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, accept: 'application/json' },
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ['catalog'] },
  });
  if (!response.ok) {
    throw new Error(`Supabase catalog request failed (${response.status}) for ${path.split('?')[0]}: ${await response.text()}`);
  }
  return response.json() as Promise<T[]>;
}

const PRODUCT_FIELDS = 'id,name,collection_id,default_color,description';
const productsPath = (fields: string, region: RegionCode) =>
  `products?select=${fields},product_prices(amount_minor)&product_prices.region_code=eq.${region}&order=sort_order.asc,id.asc`;

/** Products with their photo location. Until the admin migration (products.image_base) is applied, reads without it. */
async function fetchProductRows(url: string, key: string, region: RegionCode): Promise<ProductRow[]> {
  try {
    return await fetchRows<ProductRow>(url, key, productsPath(`${PRODUCT_FIELDS},image_base`, region));
  } catch (error) {
    if (!String(error).includes('image_base')) throw error;
    return fetchRows<ProductRow>(url, key, productsPath(PRODUCT_FIELDS, region));
  }
}

/** Loads the catalog from Supabase, or the bundled snapshot when Supabase is not configured (local development). */
export async function loadCatalog(region: RegionCode = DEFAULT_REGION): Promise<CatalogData> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn('[catalog] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set; using the bundled catalog snapshot.');
    // The bundled snapshot only has LKR prices.
    const products = region === 'LK' ? catalogSnapshot.products : catalogSnapshot.products.map((p) => ({ ...p, price: null }));
    return { ...catalogSnapshot, products, commerce: commerceSettings(region) };
  }

  const [collectionRows, productRows] = await Promise.all([
    fetchRows<CollectionRow>(
      url,
      key,
      'collections?select=id,name,short_name,tagline,description,featured_product_id,tint,accent,theme,show_on_home&order=sort_order.asc,id.asc',
    ),
    fetchProductRows(url, key, region),
  ]);

  const collectionIds = new Set(collectionRows.map((c) => c.id));
  const products: CatalogProduct[] = productRows
    .filter((p) => collectionIds.has(p.collection_id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      collection: p.collection_id,
      defaultColor: p.default_color,
      description: p.description,
      price: p.product_prices[0] ? p.product_prices[0].amount_minor / MINOR_UNITS_PER_MAJOR : null,
      ...(p.image_base ? { imageBase: p.image_base } : {}),
    }));

  const collections: CatalogCollection[] = collectionRows.map((c) => ({
    id: c.id,
    name: c.name,
    short: c.short_name,
    tagline: c.tagline,
    description: c.description,
    // The chosen featured tee if it's on the shop, otherwise the Laundry's first tee ('' = no tees yet: "Artwork coming soon").
    featured:
      products.find((p) => p.id === c.featured_product_id && p.collection === c.id)?.id ??
      products.find((p) => p.collection === c.id)?.id ??
      '',
    tint: c.tint,
    accent: c.accent,
    theme: c.theme,
    ...(c.show_on_home ? {} : { onHome: false as const }),
  }));

  return {
    collections,
    products,
    commerce: commerceSettings(region),
    featuredLabel: catalogSnapshot.featuredLabel,
  };
}
