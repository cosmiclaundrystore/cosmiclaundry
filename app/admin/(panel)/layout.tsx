import { requireAdmin } from '@/lib/admin/auth';
import { signOut } from '@/lib/admin/actions';
import { AdminNav } from './nav';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="a-shell">
      <aside className="a-side">
        <a className="a-brand" href="/admin">
          <img src="/assets/products/logo-black-480.webp" alt="" width={40} height={42} />
          <div>Cosmic Laundry<span>Admin</span></div>
        </a>
        <AdminNav />
        <div className="a-side-foot">
          <a href="/" target="_blank" rel="noreferrer">View shop ↗</a>
          <span className="a-who">{admin.email}</span>
          <form action={signOut}><button className="a-btn ghost small" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="a-main">{children}</main>
    </div>
  );
}
