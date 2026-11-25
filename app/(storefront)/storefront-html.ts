// The storefront page: the original static index.html, with root-relative paths so it works at any URL
// (/, /laundries, /laundries/<id>, /tees/<id>). Its scripts in /public (app.js, commerce.js, menu.js, ...)
// render each page into <main>; the server only adjusts the title and meta tags (lib/storefront/page.ts).
// It is plain HTML with no React on the page (nothing to hydrate or conflict with).
export const storefrontHtml = String.raw`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <meta name="description" content="Cosmic Laundry. Sixteen oversized graphic tees in black and white, across seven Laundries.">
  <title>Cosmic Laundry</title>
  <link rel="icon" href="/assets/products/logo-main-480.webp">
  <link rel="preload" as="image" href="/assets/products/tren-lisa.webp">
  <link rel="stylesheet" href="/fonts.css">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/commerce.css">
  <link rel="stylesheet" href="/midnight.css?v=garment3d">
  <link rel="stylesheet" href="/showroom.css?v=garment3d">
  <link rel="stylesheet" href="/hero-fullscreen.css">
  <link rel="stylesheet" href="/tee-fit.css">
  <link rel="stylesheet" href="/responsive.css">
  <link rel="stylesheet" href="/hero-editorial.css">
  <link rel="stylesheet" href="/region.css">
  <script defer src="/hero-fit.js"></script>
  <script defer src="/vendor/gsap.min.js"></script>
  <script defer src="/vendor/ScrollTrigger.min.js"></script>
  <script defer src="/motion.js?v=garment3d"></script>
  <script defer src="/catalog.js"></script>
  <script defer src="/commerce.js?v=garment3d"></script>
  <script defer src="/hero-marquee.js"></script>
  <script defer src="/hero-ripple.js"></script>
  <script defer src="/app.js?v=garment3d"></script>
  <script defer src="/menu.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Cosmic Laundry home"><img src="/assets/products/logo-black-480.webp" alt="" width="65" height="68"></a>
    <nav aria-label="Main navigation"><a href="/laundries">Laundries</a></nav>
    <div class="region-menu" data-region-menu><button type="button" class="region-menu-button" aria-haspopup="menu" aria-expanded="false" aria-controls="region-menu-list" aria-label="Shopping region: Sri Lanka, prices in LKR"><span class="region-menu-flag" data-region-flag><svg class="region-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#ffbe29"/><rect x="1.2" y="1.2" width="3.6" height="13.6" fill="#00534e"/><rect x="4.8" y="1.2" width="3.6" height="13.6" fill="#eb7400"/><rect x="9.6" y="1.2" width="13.2" height="13.6" fill="#8d153a"/></svg></span><span data-region-code>LK</span><svg class="region-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button><ul class="region-menu-list" id="region-menu-list" role="menu" aria-label="Shop in" data-region-switch hidden><li><button type="button" role="menuitemradio" aria-checked="false" data-region="LK"><svg class="region-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#ffbe29"/><rect x="1.2" y="1.2" width="3.6" height="13.6" fill="#00534e"/><rect x="4.8" y="1.2" width="3.6" height="13.6" fill="#eb7400"/><rect x="9.6" y="1.2" width="13.2" height="13.6" fill="#8d153a"/></svg><span class="region-option-name">Sri Lanka</span><span class="region-option-currency">LKR</span></button></li><li><button type="button" role="menuitemradio" aria-checked="false" data-region="UK"><svg class="region-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#012169"/><path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3.2"/><path d="M0 0l24 16M24 0L0 16" stroke="#c8102e" stroke-width="1.2"/><path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="5"/><path d="M12 0v16M0 8h24" stroke="#c8102e" stroke-width="3"/></svg><span class="region-option-name">United Kingdom</span><span class="region-option-currency">GBP</span></button></li><li><button type="button" role="menuitemradio" aria-checked="false" data-region="US"><svg class="region-flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" fill="#fff"/><path d="M0 1.23h24M0 3.69h24M0 6.15h24M0 8.62h24M0 11.08h24M0 13.54h24M0 16h24" stroke="#b22234" stroke-width="1.23"/><rect width="10.4" height="8.6" fill="#3c3b6e"/></svg><span class="region-option-name">United States</span><span class="region-option-currency">USD</span></button></li></ul></div>
    <a class="account-link" href="/account" aria-label="Your account and credits"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6"/></svg></a>
    <button class="bag-button" data-open-bag aria-label="Open laundry basket"><svg class="basket-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M8.5 9c.2-1.9 1.6-3.2 3.5-3.2s3.3 1.3 3.5 3.2"/><path d="M2.75 9h18.5"/><path d="M4.2 9l1.55 10.1A2.2 2.2 0 0 0 7.93 21h8.14a2.2 2.2 0 0 0 2.18-1.9L19.8 9"/><path d="M5 13.2h14M5.6 17.1h12.8"/><path d="M9.6 9.6v10.8M14.4 9.6v10.8"/></svg></button>
    <button class="menu-toggle" type="button" data-menu-open aria-label="Open menu" aria-haspopup="dialog" aria-controls="mobile-menu" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </header>
  <dialog class="mobile-menu" id="mobile-menu" aria-label="Menu">
    <div class="mobile-menu-top">
      <button class="menu-close" type="button" data-menu-close aria-label="Close menu"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      <a class="brand" href="/" aria-label="Cosmic Laundry home" data-menu-link><img src="/assets/products/logo-black-480.webp" alt="" width="65" height="68"></a>
      <div class="region-switch region-switch--menu" role="group" aria-label="Shopping region and currency" data-region-switch><button type="button" data-region="LK" aria-pressed="false" title="Sri Lanka · prices in LKR"><span class="region-name">Sri Lanka </span>LK</button><button type="button" data-region="UK" aria-pressed="false" title="United Kingdom · prices in GBP"><span class="region-name">United Kingdom </span>UK</button><button type="button" data-region="US" aria-pressed="false" title="United States and rest of the world · prices in USD"><span class="region-name">United States </span>US</button></div>
    </div>
    <nav class="mobile-menu-nav" aria-label="Mobile navigation">
      <a class="mobile-menu-main" href="/laundries" data-menu-link>Laundries</a>
      <ul class="mobile-menu-laundries" data-menu-laundries></ul>
      <a class="mobile-menu-account" href="/account" data-menu-link>Account &amp; credits</a>
    </nav>
  </dialog>
  <main id="main" tabindex="-1"></main>
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-identity"><a class="brand footer-brand" href="/" aria-label="Cosmic Laundry home"><img src="/assets/products/logo-black-480.webp" alt="" width="78" height="78" loading="lazy"></a></div>
      <div class="footer-side">
        <p class="footer-tagline">Made to be worn. <span class="footer-tagline-line">Hard to ignore.</span></p>
        <!-- Social links: replace the Facebook and TikTok URLs with the brand's own pages. -->
        <ul class="footer-social" aria-label="Cosmic Laundry on social media">
          <li><a href="https://www.instagram.com/cosmiclaundry.co/" target="_blank" rel="noopener" aria-label="Instagram: cosmiclaundry.co"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.6" cy="6.4" r="1.3" fill="currentColor"/></svg></a></li>
          <li><a href="https://www.facebook.com/" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a></li>
          <li><a href="https://www.tiktok.com/" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2026 Cosmic Laundry</span>
      <div class="region-switch region-switch--footer" role="group" aria-label="Shopping region and currency" data-region-switch><button type="button" data-region="LK" aria-pressed="false" title="Sri Lanka · prices in LKR"><span class="region-name">Sri Lanka </span>LK</button><button type="button" data-region="UK" aria-pressed="false" title="United Kingdom · prices in GBP"><span class="region-name">United Kingdom </span>UK</button><button type="button" data-region="US" aria-pressed="false" title="United States and rest of the world · prices in USD"><span class="region-name">United States </span>US</button></div><nav aria-label="Footer"><button type="button" data-info="fit">Fit &amp; sizing</button><button type="button" data-info="orders">Ordering &amp; delivery</button></nav>
    </div>
  </footer>
  <dialog class="info-dialog" aria-labelledby="info-title"><button class="close-info" type="button" aria-label="Close information"><svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button><h2 id="info-title"></h2><div id="info-content"></div></dialog>
  <noscript><div class="noscript">Please enable JavaScript to browse the collections and save tees to your laundry basket.</div></noscript>
</body>
</html>
`;
