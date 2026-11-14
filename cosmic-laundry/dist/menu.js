/* Mobile full-screen menu: opened by the hamburger, closed by the X, Escape, or choosing a link. */
(() => {
  'use strict';
  const menu = document.querySelector('#mobile-menu');
  const openButton = document.querySelector('[data-menu-open]');
  if (!menu || !openButton) return;

  // Collection links under "Laundries", built from the catalog so they stay in sync with catalog.js.
  const list = menu.querySelector('[data-menu-laundries]');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (list) list.innerHTML = (window.CosmicCatalog?.collections || []).map((c, i) =>
    `<li style="--i:${i}"><a href="#/laundry/${esc(c.id)}" data-menu-link>${esc(c.name)}</a></li>`).join('');


  function open() {
    if (menu.open) return;
    menu.showModal();
    document.documentElement.classList.add('menu-open');
    openButton.setAttribute('aria-expanded', 'true');
    menu.querySelector('[data-menu-close]').focus();
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let closing = false;
  // Plays the closing animation first, then actually closes the dialog.
  function close() {
    if (!menu.open || closing) return;
    if (reduceMotion.matches || document.documentElement.hasAttribute('data-motion-paused')) { menu.close(); return; }
    closing = true;
    menu.classList.add('is-closing');
    let done = false;
    const finish = () => {
      if (done) return; done = true; closing = false;
      menu.classList.remove('is-closing');
      menu.close();
    };
    menu.addEventListener('animationend', e => { if (e.target === menu) finish(); }, { once: true });
    setTimeout(finish, 600);
  }

  menu.addEventListener('close', () => {
    document.documentElement.classList.remove('menu-open');
    openButton.setAttribute('aria-expanded', 'false');
    openButton.focus({ preventScroll: true });
  });
  openButton.addEventListener('click', open);
  menu.addEventListener('cancel', event => { event.preventDefault(); close(); });
  menu.addEventListener('click', event => {
    if (event.target.closest('[data-menu-close]')) { close(); return; }
    if (event.target.closest('[data-menu-link]')) close();
  });
  // Mark the current page and close the menu if the screen grows past phone size.
  const markCurrent = () => menu.querySelectorAll('a[data-menu-link]:not(.brand)').forEach(a => {
    if (a.getAttribute('href') === location.hash) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.addEventListener('hashchange', markCurrent);
  markCurrent();
  const desktop = window.matchMedia('(min-width: 651px)');
  desktop.addEventListener?.('change', e => { if (e.matches) close(); });
})();
