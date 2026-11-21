import 'server-only';
import { storefrontHtml } from '@/app/(storefront)/storefront-html';
import { loadCatalog } from '@/lib/catalog/load-catalog';
import type { CatalogData } from '@/lib/catalog/types';

// Pages are the same in every region (prices arrive with /catalog.js), so share previews leave the price out.
// Every shop URL serves the same storefront page (public/app.js draws it). The server only fills in the
// title, description, canonical link and share preview, so search engines and link previews see the right page.

export const STOREFRONT_REVALIDATE_SECONDS = 60;

type Meta = { title: string; description: string; path: string; image?: string };

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (v: string, n = 160) => (v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v);

/** The shop's public address for canonical and share links. Not read from the request, so pages can be cached. */
export function siteOrigin(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.SITE_URL || (vercel ? `https://${vercel}` : 'http://localhost:3000')).replace(/\/+$/, '');
}

const imageFor = (catalog: CatalogData, productId: string | undefined) => {
  const p = catalog.products.find((x) => x.id === productId);
  if (!p) return undefined;
  return p.imageBase ? `${p.imageBase}-${p.defaultColor}.webp` : `/assets/products/${p.id}-${p.defaultColor}.webp`;
};

export function storefrontResponse(meta: Meta, status = 200): Response {
  const origin = siteOrigin();
  const url = origin + meta.path;
  const image = meta.image ? (meta.image.startsWith('http') ? meta.image : origin + meta.image) : `${origin}/assets/products/logo-main-480.webp`;
  const head = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(clip(meta.description))}">`,
    status === 200 ? `<link rel="canonical" href="${esc(url)}">` : '<meta name="robots" content="noindex">',
    '<meta property="og:site_name" content="Cosmic Laundry">',
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(clip(meta.description, 200))}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n  ');
  const html = storefrontHtml
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace(/<title>[^<]*<\/title>/, head);
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function shopDescription(catalog: CatalogData) {
  return `Cosmic Laundry. ${catalog.products.length} oversized graphic tees in black and white, across ${catalog.collections.length} Laundries.`;
}

export async function homePage() {
  const catalog = await loadCatalog();
  return storefrontResponse({ title: 'Cosmic Laundry', description: shopDescription(catalog), path: '/', image: imageFor(catalog, catalog.collections[0]?.featured) });
}

export async function laundriesPage() {
  const catalog = await loadCatalog();
  return storefrontResponse({ title: 'All Laundries | Cosmic Laundry', description: shopDescription(catalog), path: '/laundries' });
}

export async function laundryPage(id: string) {
  const catalog = await loadCatalog();
  const c = catalog.collections.find((x) => x.id === id);
  if (!c) return notFoundPage(`/laundries/${id}`);
  const count = catalog.products.filter((p) => p.collection === c.id).length;
  return storefrontResponse({
    title: `${c.name} | Cosmic Laundry`,
    description: c.description || `${c.name}: ${count} oversized graphic tees in black and white.`,
    path: `/laundries/${c.id}`,
    image: imageFor(catalog, c.featured),
  });
}

export async function teePage(id: string) {
  const catalog = await loadCatalog();
  const p = catalog.products.find((x) => x.id === id);
  if (!p) return notFoundPage(`/tees/${id}`);
  const c = catalog.collections.find((x) => x.id === p.collection);
  return storefrontResponse({
    title: `${p.name} | ${c?.short ?? 'Cosmic Laundry'} tee | Cosmic Laundry`,
    description: `${p.description || `${p.name} oversized graphic tee.`} Black or white, sizes S–XXL.`,
    path: `/tees/${p.id}`,
    image: imageFor(catalog, p.id),
  });
}

export function notFoundPage(path: string) {
  return storefrontResponse({ title: 'Not found | Cosmic Laundry', description: 'This page could not be found.', path }, 404);
}
