import type { Metadata, Viewport } from 'next';
import '../(checkout)/checkout.css';
import './account.css';

// Account pages: React, wearing the storefront's stylesheets, header and footer like checkout does.
export const metadata: Metadata = {
  title: { default: 'Your account · Cosmic Laundry', template: '%s · Cosmic Laundry' },
  robots: { index: false, follow: false },
  icons: { icon: '/assets/products/logo-main-480.webp' },
};
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts.css" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/commerce.css" />
        <link rel="stylesheet" href="/midnight.css?v=garment3d" />
        <link rel="stylesheet" href="/responsive.css" />
      </head>
      <body className="checkout-body account-body">
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <a className="brand" href="/" aria-label="Cosmic Laundry home">
            <img src="/assets/products/logo-black-480.webp" alt="" width={65} height={68} />
          </a>
          <nav aria-label="Main navigation"><a href="/laundries">Laundries</a></nav>
          <a className="ac-header-link" href="/account">Account</a>
        </header>
        <main id="main" tabIndex={-1} className="checkout-page account-page">{children}</main>
        <footer className="site-footer co-footer">
          <div className="footer-bottom">
            <span>&copy; 2026 Cosmic Laundry</span>
            <span>Earn credits on every order. 1,000 credits = 20% off + free delivery.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
