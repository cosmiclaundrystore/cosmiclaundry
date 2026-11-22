import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { adminSupabase, restGet } from '@/lib/supabase/rest';

// Admin sign-in: Supabase Auth (email + password) keeps the session in cookies.
// Being signed in is not enough: the email must also be in public.admin_users, checked on the server
// for every admin page, action and download. Data is then read and written with the secret key.

function supabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export async function authClient() {
  // Read cookies first: it marks admin pages as per-request, so the build never prerenders them.
  const store = await cookies();
  const config = supabaseAuthConfig();
  if (!config) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are needed for the admin.');
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export async function isAdminEmail(email: string | undefined | null): Promise<boolean> {
  const target = adminSupabase();
  if (!email || !target) return false;
  const rows = await restGet<{ email: string }>(target, `admin_users?select=email&email=eq.${encodeURIComponent(email.toLowerCase())}`);
  return rows.length === 1;
}

export type Admin = { email: string };

/** The signed-in admin, or null. getUser() asks Supabase Auth to verify the session each time. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  await cookies();
  // Without Supabase nobody can be signed in, so show the sign-in page instead of crashing.
  if (!supabaseAuthConfig()) return null;
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return (await isAdminEmail(data.user.email)) ? { email: data.user.email.toLowerCase() } : null;
});

/** For admin pages and server actions: sends anyone who isn't an admin to the sign-in page. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
