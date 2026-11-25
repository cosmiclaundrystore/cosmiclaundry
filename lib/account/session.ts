import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { authClient } from '@/lib/admin/auth';
import { adminSupabase, restGet, restInsert, rpc, SupabaseRpcError } from '@/lib/supabase/rest';

// Customer accounts. Sign-in is Supabase Auth (password or Google); the session lives in cookies and is
// verified with Supabase on every request (getUser). Account data is read with the secret key, always filtered
// to the signed-in customer's own id.

export type Customer = { id: string; email: string; name: string; emailConfirmed: boolean };

function toCustomer(user: User): Customer {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? meta.name ?? '').trim();
  return { id: user.id, email: (user.email ?? '').toLowerCase(), name, emailConfirmed: !!user.email_confirmed_at };
}

/** The signed-in customer, or null. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return toCustomer(data.user);
});

/** For account pages: sends anyone not signed in to the sign-in page, then back here. */
export async function requireCustomer(next = '/account'): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return customer;
}

/** Only same-site paths are allowed as a place to go back to after signing in. */
export function safeNext(value: unknown, fallback = '/account'): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : fallback;
}

/** This site's address, for the links in sign-up / reset emails and the Google return trip. */
export async function requestOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Makes sure the customer has a profile, and links earlier guest orders placed with their email (and credits the
 * delivered ones). Linking only happens once the email address is confirmed, so nobody can claim someone else's orders.
 */
export async function ensureCustomer(customer: Customer): Promise<void> {
  const target = adminSupabase();
  if (!target) return;
  const rows = await restGet<{ user_id: string }>(target, `customer_profiles?select=user_id&user_id=eq.${customer.id}`);
  if (!rows.length) {
    try {
      await restInsert(target, 'customer_profiles', { user_id: customer.id, full_name: customer.name.slice(0, 100) });
    } catch (error) {
      if (!(error instanceof SupabaseRpcError && error.body.includes('23505'))) throw error; // already created
    }
  }
  if (customer.emailConfirmed && customer.email) {
    await rpc(target, 'link_guest_orders', { p_user_id: customer.id, p_email: customer.email });
  }
}
