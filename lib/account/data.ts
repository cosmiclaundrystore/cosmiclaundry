import 'server-only';
import { adminSupabase, restGet } from '@/lib/supabase/rest';
import type { Currency } from '@/lib/checkout/shared';
import type { Customer } from './session';

// What the account page shows. Read with the secret key, always filtered to this customer's id.

export type AccountOrder = {
  number: string;
  status: string;
  fulfillment_status: string;
  currency: Currency;
  subtotal_minor: number;
  shipping_minor: number;
  discount_minor: number;
  total_minor: number;
  created_at: string;
  courier: string | null;
  tracking_number: string | null;
  reward_id: string | null;
  order_items: { product_id: string | null; product_name: string; color: string; size: string; quantity: number; design_path: string | null; products: { collection_id: string; image_base: string | null } | null }[];
  credit_ledger: { delta: number; reason: string }[];
};

export type AccountSummary = {
  name: string;
  balance: number;
  rewardsAvailable: number;
  rewardsHeld: number;
  orders: AccountOrder[];
};

export async function accountSummary(customer: Customer): Promise<AccountSummary> {
  const target = adminSupabase();
  if (!target) return { name: customer.name, balance: 0, rewardsAvailable: 0, rewardsHeld: 0, orders: [] };
  const id = customer.id;
  const [profiles, ledger, rewards, orders] = await Promise.all([
    restGet<{ full_name: string }>(target, `customer_profiles?select=full_name&user_id=eq.${id}`),
    restGet<{ delta: number }>(target, `credit_ledger?select=delta&user_id=eq.${id}&limit=10000`),
    restGet<{ status: string }>(target, `rewards?select=status&user_id=eq.${id}&status=in.(available,held)`),
    restGet<AccountOrder>(
      target,
      `orders?select=number,status,fulfillment_status,currency,subtotal_minor,shipping_minor,discount_minor,total_minor,created_at,courier,tracking_number,reward_id,` +
        `order_items(product_id,product_name,color,size,quantity,design_path,products(collection_id,image_base)),credit_ledger(delta,reason)` +
        `&user_id=eq.${id}&order=created_at.desc&limit=20`,
    ),
  ]);
  return {
    name: profiles[0]?.full_name || customer.name,
    balance: ledger.reduce((sum, row) => sum + row.delta, 0),
    rewardsAvailable: rewards.filter((r) => r.status === 'available').length,
    rewardsHeld: rewards.filter((r) => r.status === 'held').length,
    orders,
  };
}

/** For checkout: does this customer have a reward ready, and which one. */
export async function availableReward(customerId: string): Promise<string | null> {
  const target = adminSupabase();
  if (!target) return null;
  const rows = await restGet<{ id: string }>(target, `rewards?select=id&user_id=eq.${customerId}&status=eq.available&order=created_at.asc&limit=1`);
  return rows[0]?.id ?? null;
}

export async function creditBalance(customerId: string): Promise<number> {
  const target = adminSupabase();
  if (!target) return 0;
  const rows = await restGet<{ delta: number }>(target, `credit_ledger?select=delta&user_id=eq.${customerId}&limit=10000`);
  return rows.reduce((sum, row) => sum + row.delta, 0);
}
