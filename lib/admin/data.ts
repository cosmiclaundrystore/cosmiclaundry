import 'server-only';
import { requireAdmin } from './auth';
import { adminSupabase, restGet, restInsert, restPatch, rpc, storageSignedUrl, SupabaseRpcError, type SupabaseTarget } from '@/lib/supabase/rest';
import { regionForCountry, type Currency } from '@/lib/checkout/shared';

// Everything the admin reads and writes. Callers must have passed requireAdmin() first:
// these use the secret key, which ignores row-level security.

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'fulfilled', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const FULFILLMENT_STATUSES = ['unfulfilled', 'packed', 'shipped', 'delivered'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
export const REGIONS = [
  { code: 'LK', currency: 'LKR' },
  { code: 'UK', currency: 'GBP' },
  { code: 'US', currency: 'USD' },
] as const;
export type RegionCode = (typeof REGIONS)[number]['code'];
export const STOCK_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
export const STOCK_COLORS = ['black', 'white'] as const;
export const LOW_STOCK = 3;
/** Sales count once an order is paid. "fulfilled" is the older word for a paid order that went out. */
export const SALE_STATUSES: PaymentStatus[] = ['paid', 'fulfilled'];

/**
 * The secret-key connection, handed out only after confirming the visitor is a signed-in admin.
 * Checked here (not just in the layout) because Next.js renders a page and its layout in parallel.
 */
export async function db(): Promise<SupabaseTarget> {
  await requireAdmin();
  const target = adminSupabase();
  if (!target) throw new Error('SUPABASE_SECRET_KEY is not set, so the admin cannot read or save anything.');
  return target;
}

const enc = encodeURIComponent;

// ---------- Orders ----------

/**
 * Regional-price check: the shopper's connection country doesn't belong to the region they paid in
 * (e.g. a UK connection paying the Sri Lanka price). Returns a short explanation, or null when it looks fine or is unknown.
 * Someone abroad buying for delivery in Sri Lanka is legitimate, so this asks for a look; it doesn't block anything.
 */
export function regionMismatch(o: { region_code: string; visitor_country: string | null }): string | null {
  if (!o.visitor_country) return null;
  if (regionForCountry(o.visitor_country) === o.region_code) return null;
  return `Paid the ${REGION_NAME[o.region_code] ?? o.region_code} price while connecting from ${o.visitor_country}.`;
}
const REGION_NAME: Record<string, string> = { LK: 'Sri Lanka (LKR)', UK: 'UK (GBP)', US: 'US (USD)' };

export type OrderListRow = {
  number: string;
  status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  currency: Currency;
  total_minor: number;
  first_name: string;
  last_name: string;
  email: string;
  city: string;
  created_at: string;
  paid_at: string | null;
  order_items: { quantity: number }[];
  region_code: string;
  visitor_country: string | null;
};

export type OrderFilters = { status?: string; fulfillment?: string; q?: string; page?: number };
export const ORDERS_PER_PAGE = 50;

/** PostgREST filter string for the orders list (shared with the CSV download). */
export function orderFilterQuery(f: OrderFilters): string {
  const parts: string[] = [];
  if (f.status && (PAYMENT_STATUSES as readonly string[]).includes(f.status)) parts.push(`status=eq.${f.status}`);
  else if (f.status === 'to-ship') parts.push('status=in.(paid,fulfilled)', 'fulfillment_status=in.(unfulfilled,packed)');
  if (f.fulfillment && (FULFILLMENT_STATUSES as readonly string[]).includes(f.fulfillment)) parts.push(`fulfillment_status=eq.${f.fulfillment}`);
  // Keep only characters that can't change PostgREST's or=(...) syntax.
  const q = (f.q ?? '').replace(/[^\p{L}\p{N}@.+\- ]/gu, '').trim().slice(0, 60);
  if (q) {
    const like = enc(`*${q}*`);
    parts.push(`or=(number.ilike.${like},email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like})`);
  }
  return parts.join('&');
}

export async function listOrders(f: OrderFilters): Promise<{ rows: OrderListRow[]; hasMore: boolean }> {
  const page = Math.max(1, f.page ?? 1);
  const filters = orderFilterQuery(f);
  const rows = await restGet<OrderListRow>(
    await db(),
    `orders?select=number,status,fulfillment_status,currency,total_minor,first_name,last_name,email,city,created_at,paid_at,region_code,visitor_country,order_items(quantity)` +
      `${filters ? `&${filters}` : ''}&order=created_at.desc&limit=${ORDERS_PER_PAGE + 1}&offset=${(page - 1) * ORDERS_PER_PAGE}`,
  );
  return { rows: rows.slice(0, ORDERS_PER_PAGE), hasMore: rows.length > ORDERS_PER_PAGE };
}

export type OrderExportRow = Omit<OrderListRow, 'order_items'> & {
  phone: string; address_line1: string; address_line2: string | null; postcode: string; country_code: string; notes: string | null;
  subtotal_minor: number; shipping_minor: number; courier: string | null; tracking_number: string | null;
  order_items: { product_name: string; color: string; size: string; quantity: number }[];
};

export async function exportOrders(f: OrderFilters): Promise<OrderExportRow[]> {
  const filters = orderFilterQuery(f);
  return restGet<OrderExportRow>(
    await db(),
    `orders?select=number,status,fulfillment_status,currency,subtotal_minor,shipping_minor,total_minor,first_name,last_name,email,phone,` +
      `address_line1,address_line2,city,postcode,country_code,notes,courier,tracking_number,created_at,paid_at,` +
      `order_items(product_name,color,size,quantity)${filters ? `&${filters}` : ''}&order=created_at.desc&limit=5000`,
  );
}

export type OrderDetail = Omit<OrderExportRow, 'order_items'> & {
  id: string;
  region_code: string;
  admin_note: string | null;
  user_id: string | null;
  discount_minor: number;
  reward_id: string | null;
  shipped_at: string | null;
  updated_at: string;
  order_items: { product_id: string | null; product_name: string; color: string; size: string; quantity: number; unit_price_minor: number; line_total_minor: number; products: { id: string; image_base: string | null; default_color: string } | null; design_path: string | null; design_note: string | null }[];
  payment_attempts: { invoice_id: string; status: string; payment_method: string | null; card_number_masked: string | null; payable_transaction_id: string | null; created_at: string; webhook_received_at: string | null }[];
};

export async function getOrder(number: string): Promise<OrderDetail | null> {
  const rows = await restGet<OrderDetail>(
    await db(),
    `orders?select=*,order_items(product_id,product_name,color,size,quantity,unit_price_minor,line_total_minor,design_path,design_note,products(id,image_base,default_color)),` +
      `payment_attempts(invoice_id,status,payment_method,card_number_masked,payable_transaction_id,created_at,webhook_received_at)` +
      `&number=eq.${enc(number)}&payment_attempts.order=attempt.asc`,
  );
  return rows[0] ?? null;
}

/** Changes the payment status, but only from the statuses listed in `from` (so two admins can't clash). */
export async function setPaymentStatus(number: string, to: PaymentStatus, from: PaymentStatus[]): Promise<boolean> {
  const values: Record<string, unknown> = { status: to };
  if (to === 'paid') values.paid_at = new Date().toISOString();
  const rows = await restPatch(await db(), `orders?number=eq.${enc(number)}&status=in.(${from.join(',')})`, values);
  return rows.length === 1;
}

export async function updateFulfillment(
  number: string,
  values: { fulfillment_status: FulfillmentStatus; courier: string | null; tracking_number: string | null; admin_note: string | null },
  wasShipped: boolean,
): Promise<boolean> {
  const shipped = values.fulfillment_status === 'shipped' || values.fulfillment_status === 'delivered';
  const patch: Record<string, unknown> = { ...values };
  if (shipped && !wasShipped) patch.shipped_at = new Date().toISOString();
  if (!shipped) patch.shipped_at = null;
  const rows = await restPatch(await db(), `orders?number=eq.${enc(number)}`, patch);
  return rows.length === 1;
}

/** Temporary (1 hour) links to the customer designs on an order, by file path. Missing files (already cleaned up) are left out. */
export async function designLinks(paths: (string | null)[]): Promise<Record<string, string>> {
  const target = await db();
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const entries = await Promise.all(unique.map(async (path) => [path, await storageSignedUrl(target, 'custom-designs', path, 3600)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e[1] !== null));
}

// ---------- Overview ----------

const COLOMBO_OFFSET_MS = 330 * 60 * 1000; // Sri Lanka is UTC+5:30 all year.

/** Midnight in Sri Lanka today, and on the 1st of this month, as UTC instants. */
export function colomboPeriodStarts(now = new Date()): { today: Date; month: Date } {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - COLOMBO_OFFSET_MS;
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - COLOMBO_OFFSET_MS;
  return { today: new Date(today), month: new Date(month) };
}

export type SalesTotals = Partial<Record<Currency, { minor: number; orders: number }>>;

export async function overview() {
  const { today, month } = colomboPeriodStarts();
  const [paidThisMonth, toShip, awaiting, lowStock, recent] = await Promise.all([
    restGet<{ currency: Currency; total_minor: number; paid_at: string }>(
      await db(), `orders?select=currency,total_minor,paid_at&status=in.(${SALE_STATUSES.join(',')})&paid_at=gte.${enc(month.toISOString())}&limit=10000`,
    ),
    restGet<{ number: string }>(await db(), 'orders?select=number&status=in.(paid,fulfilled)&fulfillment_status=in.(unfulfilled,packed)&limit=1000'),
    restGet<{ number: string }>(await db(), `orders?select=number&status=eq.pending&created_at=gte.${enc(new Date(Date.now() - 2 * 864e5).toISOString())}&limit=1000`),
    restGet<{ product_id: string; color: string; size: string; stock: number; product_colors: { products: { name: string; is_active: boolean } } }>(
      await await db(), `product_variants?select=product_id,color,size,stock,product_colors(products(name,is_active))&stock=lte.${LOW_STOCK}&is_active=eq.true&order=stock.asc,product_id.asc&limit=100`,
    ),
    listOrders({ page: 1 }).then((r) => r.rows.slice(0, 8)),
  ]);

  const sum = (since: Date): SalesTotals => {
    const totals: SalesTotals = {};
    for (const o of paidThisMonth) {
      if (new Date(o.paid_at) < since) continue;
      const t = (totals[o.currency] ??= { minor: 0, orders: 0 });
      t.minor += o.total_minor;
      t.orders += 1;
    }
    return totals;
  };
  return { today: sum(today), month: sum(month), toShip: toShip.length, awaiting: awaiting.length, lowStock, recent };
}

// ---------- Products ----------

export type CollectionOption = { id: string; name: string; is_active: boolean };

export async function listCollections(): Promise<CollectionOption[]> {
  return restGet<CollectionOption>(await db(), 'collections?select=id,name,is_active&order=sort_order.asc,id.asc');
}

export type ProductListRow = {
  id: string;
  name: string;
  collection_id: string;
  default_color: 'black' | 'white';
  is_active: boolean;
  sort_order: number;
  image_base: string | null;
  product_prices: { region_code: string; amount_minor: number }[];
  // Variants hang off colours (product_variants -> product_colors -> products).
  product_colors: { product_variants: { stock: number | null }[] }[];
};

export async function listProducts(f: { collection?: string; q?: string; show?: string }): Promise<ProductListRow[]> {
  const parts = [
    'select=id,name,collection_id,default_color,is_active,sort_order,image_base,product_prices(region_code,amount_minor),product_colors(product_variants(stock))',
    'order=collection_id.asc,sort_order.asc,id.asc',
    'limit=2000',
  ];
  if (f.collection && /^[a-z0-9-]+$/.test(f.collection)) parts.push(`collection_id=eq.${f.collection}`);
  if (f.show === 'hidden') parts.push('is_active=eq.false');
  if (f.show === 'live') parts.push('is_active=eq.true');
  const q = (f.q ?? '').replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60);
  if (q) parts.push(`or=(name.ilike.${enc(`*${q}*`)},id.ilike.${enc(`*${q}*`)})`);
  return restGet<ProductListRow>(await db(), `products?${parts.join('&')}`);
}

export type ProductDetail = Omit<ProductListRow, 'product_colors'> & {
  description: string;
  product_colors: { color: string; product_variants: { size: string; stock: number | null }[] }[];
};

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const rows = await restGet<ProductDetail>(
    await db(),
    `products?select=id,name,collection_id,default_color,is_active,sort_order,image_base,description,` +
      `product_prices(region_code,amount_minor),product_colors(color,product_variants(size,stock))&id=eq.${enc(id)}`,
  );
  return rows[0] ?? null;
}

export type SaveProductInput = {
  id: string;
  is_new: boolean;
  collection_id: string;
  name: string;
  description: string;
  default_color: 'black' | 'white';
  sort_order: number;
  is_active: boolean;
  image_base?: string;
  prices: Partial<Record<RegionCode, number | null>>;
  stock: Record<string, Record<string, number | null>>;
};

export class ProductSaveError extends Error {
  constructor(public reason: 'product_exists' | 'product_not_found') { super(reason); }
}

export async function saveProduct(input: SaveProductInput): Promise<void> {
  try {
    await rpc(await db(), 'admin_save_product', { p: input });
  } catch (error) {
    const reason = error instanceof SupabaseRpcError ? error.dbMessage : null;
    if (reason === 'product_exists' || reason === 'product_not_found') throw new ProductSaveError(reason);
    throw error;
  }
}

/** Where a product's photos are served from (mirrors lib/catalog/catalog-script.ts). */
export function productImage(p: { id: string; image_base: string | null; default_color: string }, color = p.default_color, small = true): string {
  const suffix = `-${color}${small ? '-480' : ''}.webp`;
  return p.image_base ? `${p.image_base}${suffix}` : `/assets/products/${p.id}${suffix}`;
}

// ---------- Laundries (collections) ----------

export type LaundryRow = {
  id: string;
  name: string;
  short_name: string;
  tagline: string;
  description: string;
  featured_product_id: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_home: boolean;
  products: { id: string; name: string; is_active: boolean; image_base: string | null; default_color: string; sort_order: number }[];
};

const LAUNDRY_FIELDS =
  'id,name,short_name,tagline,description,featured_product_id,sort_order,is_active,show_on_home,' +
  'products!products_collection_id_fkey(id,name,is_active,image_base,default_color,sort_order)';

export async function listLaundries(): Promise<LaundryRow[]> {
  return restGet<LaundryRow>(await db(), `collections?select=${LAUNDRY_FIELDS}&order=sort_order.asc,id.asc&products.order=sort_order.asc,id.asc`);
}

export async function getLaundry(id: string): Promise<LaundryRow | null> {
  const rows = await restGet<LaundryRow>(await db(), `collections?select=${LAUNDRY_FIELDS}&id=eq.${enc(id)}&products.order=sort_order.asc,id.asc`);
  return rows[0] ?? null;
}

export type LaundryInput = {
  name: string;
  short_name: string;
  tagline: string;
  description: string;
  featured_product_id: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_home: boolean;
};

export class LaundryExistsError extends Error {}

export async function createLaundry(id: string, input: LaundryInput): Promise<void> {
  try {
    // tint / accent / theme only styled the old navy site; the black-and-white site neutralises them.
    await restInsert(await db(), 'collections', { id, ...input, tint: '#142d49', accent: '#6b6b6b', theme: id });
  } catch (error) {
    if (error instanceof SupabaseRpcError && error.body.includes('23505')) throw new LaundryExistsError(id);
    throw error;
  }
}

export async function updateLaundry(id: string, input: LaundryInput): Promise<boolean> {
  const rows = await restPatch(await db(), `collections?id=eq.${enc(id)}`, input);
  return rows.length === 1;
}

export async function nextLaundrySortOrder(): Promise<number> {
  const rows = await restGet<{ sort_order: number }>(await db(), 'collections?select=sort_order&order=sort_order.desc&limit=1');
  return (rows[0]?.sort_order ?? 0) + 10;
}

/** A free web id based on `base`: "naruto", then "naruto-2", "naruto-3", ... */
export async function uniqueId(table: 'products' | 'collections', base: string): Promise<string> {
  const root = base || (table === 'products' ? 'tee' : 'laundry');
  const rows = await restGet<{ id: string }>(await db(), `${table}?select=id&or=(id.eq.${root},id.like.${enc(`${root}-*`)})`);
  const taken = new Set(rows.map((r) => r.id));
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}
