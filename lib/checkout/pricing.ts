import 'server-only';
import { catalogSnapshot } from '@/lib/catalog/seed-data';
import { publicSupabase, restGet } from '@/lib/supabase/rest';
import { creditsForLine, REWARD_TEE_DISCOUNT } from '@/lib/account/credits';
import { COLORS, REGION_CURRENCY, type BasketItem, type Currency, type RegionCode } from './shared';

// The server's price check. Prices always come from the catalog here, never from the browser.

const IMG_VERSION = 'final16-2'; // keep in sync with lib/catalog/catalog-script.ts
const FALLBACK_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
/** Used only when Supabase is not configured (local development). Matches the placeholder in the orders migration. */
const FALLBACK_SHIPPING_MINOR: Partial<Record<RegionCode, number>> = { LK: 50000 };

export type PricedLine = {
  id: string;
  name: string;
  color: string;
  colorLabel: string;
  size: string;
  quantity: number;
  unitMinor: number;
  lineMinor: number;
  image: string;
  /** Custom tee: the customer's design (checked and attached to the order at checkout). */
  design?: { id: string; note: string };
};

export type Quote = {
  region: RegionCode;
  currency: Currency;
  lines: PricedLine[];
  /** Basket lines that could not be priced (removed, sold out or no price), so the customer can be told. */
  problems: { id: string; color: string; size: string; reason: 'unavailable' | 'no_price' | 'out_of_stock' | 'design_missing' }[];
  subtotalMinor: number;
  shippingMinor: number;
  shippingLabel: string;
  /** Reward: 20% off the tees plus free delivery (0 when no reward is used). */
  discountMinor: number;
  rewardApplied: boolean;
  /** Credits this order earns once delivered, if the customer is signed in. */
  credits: number;
  totalMinor: number;
};

type CatalogEntry = {
  name: string;
  /** Made-to-order tees (Custom Laundry) need the customer's design. */
  needsDesign: boolean;
  priceMinor: number | null;
  variants: { color: string; size: string; stock: number | null }[];
};

type ProductRow = {
  id: string;
  name: string;
  collection_id: string;
  product_prices: { amount_minor: number }[];
  // Variants hang off product_colors (composite foreign key), so they are embedded through it.
  product_colors: { color: string; product_variants: { size: string; stock: number | null; is_active: boolean }[] }[];
};

async function loadEntries(ids: string[], region: RegionCode): Promise<{ entries: Map<string, CatalogEntry>; shipping: { minor: number; label: string } | null }> {
  const target = publicSupabase();
  if (!target) {
    const entries = new Map<string, CatalogEntry>();
    for (const p of catalogSnapshot.products) {
      if (!ids.includes(p.id)) continue;
      entries.set(p.id, {
        name: p.name,
        needsDesign: p.collection === 'custom',
        priceMinor: region === 'LK' && typeof p.price === 'number' ? Math.round(p.price * 100) : null,
        variants: Object.keys(COLORS).flatMap((color) => FALLBACK_SIZES.map((size) => ({ color, size, stock: null }))),
      });
    }
    const minor = FALLBACK_SHIPPING_MINOR[region];
    return { entries, shipping: minor === undefined ? null : { minor, label: 'Delivery' } };
  }

  const idList = ids.map((id) => `"${id}"`).join(',');
  const [rows, rates] = await Promise.all([
    restGet<ProductRow>(
      target,
      `products?select=id,name,collection_id,product_prices(amount_minor),product_colors(color,product_variants(size,stock,is_active))&id=in.(${idList})&product_prices.region_code=eq.${region}`,
    ),
    restGet<{ amount_minor: number; label: string }>(target, `shipping_rates?select=amount_minor,label&region_code=eq.${region}`).catch((error) => {
      // Until the orders migration is pushed, the shipping_rates table doesn't exist yet.
      console.warn('[checkout] Could not read shipping_rates; using the built-in fallback.', error);
      const minor = FALLBACK_SHIPPING_MINOR[region];
      return minor === undefined ? [] : [{ amount_minor: minor, label: 'Delivery' }];
    }),
  ]);
  const entries = new Map<string, CatalogEntry>();
  for (const row of rows) {
    entries.set(row.id, {
      name: row.name,
      needsDesign: row.collection_id === 'custom',
      priceMinor: row.product_prices[0]?.amount_minor ?? null,
      variants: row.product_colors.flatMap((c) =>
        c.product_variants.filter((v) => v.is_active).map(({ size, stock }) => ({ color: c.color, size, stock })),
      ),
    });
  }
  return { entries, shipping: rates[0] ? { minor: rates[0].amount_minor, label: rates[0].label } : null };
}

export class CheckoutUnavailableError extends Error {}

/** Prices a basket for a region. Lines that can't be sold are left out and listed in `problems`. */
export async function priceBasket(items: BasketItem[], region: RegionCode, options: { reward?: boolean } = {}): Promise<Quote> {
  const currency = REGION_CURRENCY[region];
  const { entries, shipping } = await loadEntries([...new Set(items.map((i) => i.id))], region);
  if (!shipping) throw new CheckoutUnavailableError(`No shipping rate is set for region ${region}.`);

  const lines: PricedLine[] = [];
  const problems: Quote['problems'] = [];
  for (const item of items) {
    const entry = entries.get(item.id);
    const variant = entry?.variants.find((v) => v.color === item.color && v.size === item.size);
    if (!entry || !variant) { problems.push({ ...pick(item), reason: 'unavailable' }); continue; }
    if (entry.priceMinor === null) { problems.push({ ...pick(item), reason: 'no_price' }); continue; }
    if (variant.stock !== null && variant.stock < item.quantity) { problems.push({ ...pick(item), reason: 'out_of_stock' }); continue; }
    if (entry.needsDesign && !item.design) { problems.push({ ...pick(item), reason: 'design_missing' }); continue; }
    lines.push({
      id: item.id,
      name: entry.name,
      color: item.color,
      colorLabel: COLORS[item.color as keyof typeof COLORS],
      size: item.size,
      quantity: item.quantity,
      unitMinor: entry.priceMinor,
      lineMinor: entry.priceMinor * item.quantity,
      image: `/assets/products/${item.id}-${item.color}-480.webp?v=${IMG_VERSION}`,
      ...(entry.needsDesign && item.design ? { design: { id: item.design.id, note: item.design.note } } : {}),
    });
  }
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineMinor, 0);
  const shippingMinor = lines.length ? shipping.minor : 0;
  // A reward takes 20% off the tees (rounded to whole rupees for LKR) and makes delivery free.
  const rewardApplied = !!options.reward && lines.length > 0;
  const unit = currency === 'LKR' ? 100 : 1;
  const discountMinor = rewardApplied ? Math.round((subtotalMinor * REWARD_TEE_DISCOUNT) / unit) * unit + shippingMinor : 0;
  const credits = lines.reduce((sum, line) => sum + creditsForLine(line), 0);
  return {
    region, currency, lines, problems, subtotalMinor, shippingMinor, shippingLabel: shipping.label,
    discountMinor, rewardApplied, credits, totalMinor: subtotalMinor + shippingMinor - discountMinor,
  };
}

function pick(item: BasketItem) {
  return { id: item.id, color: item.color, size: item.size };
}
