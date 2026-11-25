import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomer, safeNext } from '@/lib/account/session';
import { AuthPanel } from './auth-panel';

export const metadata: Metadata = { title: 'Sign in' };

const LINK_ERRORS: Record<string, string> = {
  link: 'That sign-in link didn’t work or has expired. Please try again.',
  missing: 'Sign-in didn’t finish. Please try again.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  return (
    <section className="ac-auth">
      <AuthPanel next={next} initialMode={sp.mode === 'signup' ? 'signup' : 'signin'} linkError={sp.error ? LINK_ERRORS[sp.error] ?? LINK_ERRORS.missing : null} />
    </section>
  );
}
