import type { Metadata, Viewport } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Admin · Cosmic Laundry', template: '%s · Admin · Cosmic Laundry' },
  robots: { index: false, follow: false },
  icons: { icon: '/assets/products/logo-main-480.webp' },
};
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts.css" />
      </head>
      <body className="admin">{children}</body>
    </html>
  );
}
