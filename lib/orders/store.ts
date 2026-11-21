import 'server-only';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { CustomerInput, Currency, RegionCode } from '@/lib/checkout/shared';
import type { Quote } from '@/lib/checkout/pricing';
import { adminSupabase, restGet, rpc, SupabaseRpcError, type SupabaseTarget } from '@/lib/supabase/rest';
import { designPath } from '@/lib/custom/designs';

// Orders live in Supabase (supabase/migrations/20261121120000_orders.sql).
// Without SUPABASE_SECRET_KEY, local development falls back to an in-memory store with the same rules.

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'fulfilled' | 'refunded';

export type OrderView = {
  number: string;
  status: OrderStatus;
  currency: Currency;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  firstName: string;
  email: string;
  items: { productId: string | null; name: string; color: string; size: string; quantity: number; unitMinor: number; lineMinor: number }[];
};

/** The full order, server side only. Only `view` is ever sent to the browser. */
export type OrderRecord = { view: OrderView; customer: CustomerInput; countryCode: string };

export type PaymentAttempt = { invoiceId: string; attempt: number; amountMinor: number; currency: Currency };
export type AttemptLookup = PaymentAttempt & { status: 'pending' | 'paid' | 'failed'; orderNumber: string };
export type PaymentResult = {
  invoiceId: string;
  success: boolean;
  payload: Record<string, unknown>;
  payableOrderId: string | null;
  payableTransactionId: string | null;
  paymentMethod: string | null;
  cardNumberMasked: string | null;
  statusCode: string;
};
export type RecordOutcome = 'applied' | 'duplicate' | 'paid_again' | 'unknown_invoice';

export class OrderNotPayableError extends Error {
  constructor(public reason: 'order_not_found' | 'order_not_payable' | 'too_many_attempts') { super(reason); }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface OrderStore {
  /** visitorCountry: where the shopper was connecting from (Vercel geo header), or null when unknown. */
  createOrder(quote: Quote, customer: CustomerInput, countryCode: string, visitorCountry: string | null): Promise<{ number: string; token: string }>;
  startAttempt(orderNumber: string): Promise<PaymentAttempt>;
  findAttempt(invoiceId: string): Promise<AttemptLookup | null>;
  recordPaymentResult(result: PaymentResult): Promise<RecordOutcome>;
  /** Returns the order only if `token` is the secret from its order link. */
  getOrder(orderNumber: string, token: string): Promise<OrderRecord | null>;
}

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function orderPayload(quote: Quote, customer: CustomerInput, countryCode: string, tokenHash: string, visitorCountry: string | null) {
  return {
    region_code: quote.region,
    currency: quote.currency,
    subtotal_minor: quote.subtotalMinor,
    shipping_minor: quote.shippingMinor,
    total_minor: quote.totalMinor,
    email: customer.email,
    phone: customer.phone,
    first_name: customer.firstName,
    last_name: customer.lastName,
    address_line1: customer.addressLine1,
    address_line2: customer.addressLine2,
    city: customer.city,
    postcode: customer.postcode,
    country_code: countryCode,
    notes: customer.notes,
    access_token_hash: tokenHash,
    visitor_country: visitorCountry,
    items: quote.lines.map((line) => ({
      product_id: line.id,
      product_name: line.name,
      color: line.color,
      size: line.size,
      quantity: line.quantity,
      unit_price_minor: line.unitMinor,
      line_total_minor: line.lineMinor,
      design_path: line.design ? designPath(line.design.id) : null,
      design_note: line.design?.note || null,
    })),
  };
}

// ---------- Supabase ----------

type OrderRow = {
  number: string;
  status: OrderStatus;
  currency: Currency;
  subtotal_minor: number;
  shipping_minor: number;
  total_minor: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  country_code: string;
  notes: string | null;
  access_token_hash: string;
  order_items: { product_id: string | null; product_name: string; color: string; size: string; quantity: number; unit_price_minor: number; line_total_minor: number }[];
};

function supabaseStore(target: SupabaseTarget): OrderStore {
  return {
    async createOrder(quote, customer, countryCode, visitorCountry) {
      const token = newToken();
      const rows = await rpc<{ order_id: string; order_number: string }[]>(target, 'create_order', {
        p: orderPayload(quote, customer, countryCode, hashToken(token), visitorCountry),
      });
      return { number: rows[0].order_number, token };
    },
    async startAttempt(orderNumber) {
      try {
        const rows = await rpc<{ invoice_id: string; attempt: number; amount_minor: number; currency: Currency }[]>(
          target, 'start_payment_attempt', { p_order_number: orderNumber },
        );
        const row = rows[0];
        return { invoiceId: row.invoice_id, attempt: row.attempt, amountMinor: row.amount_minor, currency: row.currency };
      } catch (error) {
        const reason = error instanceof SupabaseRpcError ? error.dbMessage : null;
        if (reason === 'order_not_found' || reason === 'order_not_payable' || reason === 'too_many_attempts') throw new OrderNotPayableError(reason);
        throw error;
      }
    },
    async findAttempt(invoiceId) {
      const rows = await restGet<{ invoice_id: string; attempt: number; amount_minor: number; currency: Currency; status: AttemptLookup['status']; orders: { number: string } }>(
        target,
        `payment_attempts?select=invoice_id,attempt,amount_minor,currency,status,orders(number)&invoice_id=eq.${encodeURIComponent(invoiceId)}`,
      );
      const row = rows[0];
      return row ? { invoiceId: row.invoice_id, attempt: row.attempt, amountMinor: row.amount_minor, currency: row.currency, status: row.status, orderNumber: row.orders.number } : null;
    },
    async recordPaymentResult(r) {
      return rpc<RecordOutcome>(target, 'record_payment_result', {
        p_invoice_id: r.invoiceId,
        p_success: r.success,
        p_payload: r.payload,
        p_payable_order_id: r.payableOrderId,
        p_payable_transaction_id: r.payableTransactionId,
        p_payment_method: r.paymentMethod,
        p_card_number_masked: r.cardNumberMasked,
        p_status_code: r.statusCode,
      });
    },
    async getOrder(orderNumber, token) {
      const rows = await restGet<OrderRow>(
        target,
        `orders?select=number,status,currency,subtotal_minor,shipping_minor,total_minor,first_name,last_name,email,phone,address_line1,address_line2,city,postcode,country_code,notes,access_token_hash,order_items(product_id,product_name,color,size,quantity,unit_price_minor,line_total_minor)&number=eq.${encodeURIComponent(orderNumber)}`,
      );
      const row = rows[0];
      if (!row || !tokenMatches(token, row.access_token_hash)) return null;
      const customer: CustomerInput = {
        email: row.email, phone: row.phone, firstName: row.first_name, lastName: row.last_name,
        addressLine1: row.address_line1, addressLine2: row.address_line2 ?? '', city: row.city, postcode: row.postcode,
        notes: row.notes ?? '', acceptTerms: true,
      };
      const view: OrderView = {
        number: row.number,
        status: row.status,
        currency: row.currency,
        subtotalMinor: row.subtotal_minor,
        shippingMinor: row.shipping_minor,
        totalMinor: row.total_minor,
        firstName: row.first_name,
        email: row.email,
        items: row.order_items.map((i) => ({ productId: i.product_id, name: i.product_name, color: i.color, size: i.size, quantity: i.quantity, unitMinor: i.unit_price_minor, lineMinor: i.line_total_minor })),
      };
      return { view, customer, countryCode: row.country_code };
    },
  };
}

// ---------- In-memory (local development only) ----------

type MemoryOrder = { id: string; view: OrderView; customer: CustomerInput; countryCode: string; region: RegionCode; tokenHash: string; paidAt: Date | null };
type MemoryAttempt = AttemptLookup & { orderId: string };
type MemoryDb = { seq: number; orders: Map<string, MemoryOrder>; attempts: Map<string, MemoryAttempt> };

function memoryDb(): MemoryDb {
  const g = globalThis as typeof globalThis & { __cosmicOrders?: MemoryDb };
  g.__cosmicOrders ??= { seq: 1000, orders: new Map(), attempts: new Map() };
  return g.__cosmicOrders;
}

function memoryStore(): OrderStore {
  const db = memoryDb();
  return {
    async createOrder(quote, customer, countryCode, visitorCountry) {
      const token = newToken();
      const number = `CL-${++db.seq}`;
      db.orders.set(number, {
        id: randomUUID(),
        customer: { ...customer },
        countryCode,
        region: quote.region,
        tokenHash: hashToken(token),
        paidAt: null,
        view: {
          number,
          status: 'pending',
          currency: quote.currency,
          subtotalMinor: quote.subtotalMinor,
          shippingMinor: quote.shippingMinor,
          totalMinor: quote.totalMinor,
          firstName: customer.firstName,
          email: customer.email,
          items: quote.lines.map((l) => ({ productId: l.id, name: l.name, color: l.color, size: l.size, quantity: l.quantity, unitMinor: l.unitMinor, lineMinor: l.lineMinor })),
        },
      });
      return { number, token };
    },
    async startAttempt(orderNumber) {
      const order = db.orders.get(orderNumber);
      if (!order) throw new OrderNotPayableError('order_not_found');
      if (order.view.status !== 'pending' && order.view.status !== 'failed') throw new OrderNotPayableError('order_not_payable');
      const attempt = [...db.attempts.values()].filter((a) => a.orderId === order.id).length + 1;
      if (attempt > 20) throw new OrderNotPayableError('too_many_attempts');
      const invoiceId = `${orderNumber}-${attempt}`;
      db.attempts.set(invoiceId, { invoiceId, attempt, amountMinor: order.view.totalMinor, currency: order.view.currency, status: 'pending', orderNumber, orderId: order.id });
      order.view.status = 'pending';
      return { invoiceId, attempt, amountMinor: order.view.totalMinor, currency: order.view.currency };
    },
    async findAttempt(invoiceId) {
      const a = db.attempts.get(invoiceId);
      return a ? { invoiceId: a.invoiceId, attempt: a.attempt, amountMinor: a.amountMinor, currency: a.currency, status: a.status, orderNumber: a.orderNumber } : null;
    },
    async recordPaymentResult(r) {
      const attempt = db.attempts.get(r.invoiceId);
      if (!attempt) return 'unknown_invoice';
      if (attempt.status !== 'pending') return 'duplicate';
      const order = db.orders.get(attempt.orderNumber)!;
      attempt.status = r.success ? 'paid' : 'failed';
      if (r.success) {
        if (order.view.status === 'paid') return 'paid_again';
        order.view.status = 'paid';
        order.paidAt = new Date();
      } else if (order.view.status === 'pending') {
        const open = [...db.attempts.values()].some((a) => a.orderId === order.id && a.status === 'pending');
        if (!open) order.view.status = 'failed';
      }
      return 'applied';
    },
    async getOrder(orderNumber, token) {
      const order = db.orders.get(orderNumber);
      if (!order || !tokenMatches(token, order.tokenHash)) return null;
      return structuredClone({ view: order.view, customer: order.customer, countryCode: order.countryCode });
    },
  };
}

let warned = false;
export function orderStore(): OrderStore {
  const target = adminSupabase();
  if (target) return supabaseStore(target);
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error('SUPABASE_SECRET_KEY is not set. Orders cannot be saved in production without it.');
  }
  if (!warned) {
    warned = true;
    console.warn('[orders] SUPABASE_SECRET_KEY is not set; orders are kept in memory and vanish when the server restarts.');
  }
  return memoryStore();
}
