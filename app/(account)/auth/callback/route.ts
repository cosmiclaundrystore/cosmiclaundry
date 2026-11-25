import { NextResponse } from 'next/server';
import { authClient } from '@/lib/admin/auth';
import { ensureCustomer, getCustomer, safeNext } from '@/lib/account/session';

// Where Google sign-in, the sign-up confirmation email and the password-reset email come back to.
// Swaps the one-time code for a session, sets up the customer's account, then continues to `next`.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const failed = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (failed || !code) {
    return NextResponse.redirect(new URL(`/account/login?error=${encodeURIComponent(failed ? 'link' : 'missing')}&next=${encodeURIComponent(next)}`, url));
  }
  const supabase = await authClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/account/login?error=link&next=${encodeURIComponent(next)}`, url));
  const customer = await getCustomer();
  if (customer) await ensureCustomer(customer);
  return NextResponse.redirect(new URL(next, url));
}
