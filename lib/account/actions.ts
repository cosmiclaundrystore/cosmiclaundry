'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authClient } from '@/lib/admin/auth';
import { adminSupabase, restPatch } from '@/lib/supabase/rest';
import { ensureCustomer, getCustomer, requestOrigin, safeNext } from './session';

export type AuthState = { error?: string; ok?: string; fieldErrors?: Record<string, string> } | null;

const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Supabase's error messages, in the shop's words. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match an account.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. We sent you a link when you signed up.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'There’s already an account with that email. Sign in instead, or reset your password.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a minute and try again.';
  if (m.includes('password')) return message;
  return 'Something went wrong. Please try again.';
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = text(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!EMAIL.test(email) || !password) return { error: 'Enter your email and password.' };
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: friendly(error?.message ?? '') };
  const customer = await getCustomer();
  if (customer) await ensureCustomer(customer);
  redirect(safeNext(fd.get('next')));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const name = text(fd, 'name', 100);
  const email = text(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Enter your name.';
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (Object.keys(errors).length) return { fieldErrors: errors };

  const next = safeNext(fd.get('next'));
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: friendly(error.message) };
  // Supabase hides whether an email is already registered: an existing address comes back with no identities.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: 'There’s already an account with that email. Sign in instead, or reset your password.' };
  }
  if (data.session) {
    const customer = await getCustomer();
    if (customer) await ensureCustomer(customer);
    redirect(next);
  }
  return { ok: `Almost there! We sent a confirmation link to ${email}. Open it to finish creating your account.` };
}

/** Whether Google sign-in is switched on in Supabase (Authentication → Providers). */
async function providerEnabled(provider: 'google'): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.[provider] === true;
  } catch {
    return false;
  }
}

export async function signInWith(provider: 'google', next: string): Promise<AuthState> {
  const label = 'Google';
  if (!(await providerEnabled(provider))) {
    return { error: `${label} sign-in is coming soon. For now, sign in or create an account with your email.` };
  }
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error || !data.url) {
    return { error: `${label} sign-in isn’t available right now. Use your email and password instead.` };
  }
  redirect(data.url);
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = text(fd, 'email').toLowerCase();
  if (!EMAIL.test(email)) return { fieldErrors: { email: 'Enter a valid email address.' } };
  const supabase = await authClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await requestOrigin()}/auth/callback?next=/account/reset` });
  // Same answer whether or not the account exists, so this can't be used to find out who has an account.
  return { ok: `If there’s an account for ${email}, we’ve sent a link to choose a new password.` };
}

export async function updatePassword(_: AuthState, fd: FormData): Promise<AuthState> {
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { fieldErrors: { password: 'Use at least 8 characters.' } };
  if (password !== String(fd.get('confirm') ?? '')) return { fieldErrors: { confirm: 'The passwords don’t match.' } };
  const supabase = await authClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message.toLowerCase().includes('session') ? 'This reset link has expired. Please ask for a new one.' : friendly(error.message) };
  redirect('/account?password=updated');
}

export async function updateName(_: AuthState, fd: FormData): Promise<AuthState> {
  const customer = await getCustomer();
  if (!customer) redirect('/account/login');
  const name = text(fd, 'name', 100);
  if (!name) return { fieldErrors: { name: 'Enter your name.' } };
  const target = adminSupabase();
  if (!target) return { error: 'Accounts aren’t set up yet.' };
  await ensureCustomer(customer);
  await restPatch(target, `customer_profiles?user_id=eq.${customer.id}`, { full_name: name });
  revalidatePath('/account');
  return { ok: 'Saved.' };
}

export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect('/');
}
