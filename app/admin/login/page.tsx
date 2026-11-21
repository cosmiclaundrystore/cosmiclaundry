import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/admin/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="a-login">
      <div className="a-login-card">
        <img src="/assets/products/logo-black-480.webp" alt="Cosmic Laundry" width={58} height={61} />
        <div>
          <h1>Admin sign in</h1>
          <p className="a-muted" style={{ margin: '6px 0 0' }}>For the Cosmic Laundry team only.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
