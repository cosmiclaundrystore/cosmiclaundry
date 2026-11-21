import type { Metadata, Viewport } from 'next';
import './checkout.css';

// Checkout pages are React, but wear the storefront's own stylesheets, header and footer so they look like the same site.
export const metadata: Metadata = {
  title: 'Checkout · Cosmic Laundry',
  robots: { index: false, follow: false },
  icons: { icon: '/assets/products/logo-main-480.webp' },
};
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts.css" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/commerce.css" />
        <link rel="stylesheet" href="/midnight.css?v=garment3d" />
        <link rel="stylesheet" href="/responsive.css" />
      </head>
      <body className="checkout-body">
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Cosmic Laundry home">
            <img src="/assets/products/logo-black-480.webp" alt="" width={65} height={68} />
          </a>
          <nav aria-label="Main navigation"><a href="/laundries">Laundries</a></nav>
          <span className="co-secure" aria-label="Secure checkout">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" /></svg>
            Secure checkout
          </span>
        </header>
        <main id="main" tabIndex={-1} className="checkout-page">{children}</main>
        <footer className="site-footer co-footer">
          <div className="footer-bottom">
            <span>&copy; 2026 Cosmic Laundry</span>
            <span>Payments are processed securely by PAYable.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
