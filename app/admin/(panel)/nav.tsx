'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/laundries', label: 'Laundries' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="a-nav" aria-label="Admin">
      {LINKS.map((l) => {
        const current = l.href === '/admin' ? path === '/admin' : path.startsWith(l.href);
        return <Link key={l.href} href={l.href} aria-current={current ? 'page' : undefined}>{l.label}</Link>;
      })}
    </nav>
  );
}
