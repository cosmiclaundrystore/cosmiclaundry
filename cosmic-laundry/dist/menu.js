/* Mobile full-screen menu: opened by the hamburger, closed by the X, Escape, or choosing a link. */
(() => {
  'use strict';
  const menu = document.querySelector('#mobile-menu');
  const openButton = document.querySelector('[data-menu-open]');
  if (!menu || !openButton) return;


  function open() {
    if (menu.open) return;
    menu.showModal();
    document.documentElement.classList.add('menu-open');
    openButton.setAttribute('aria-expanded', 'true');
    menu.querySelector('[data-menu-close]').focus();
  }
  function close() { if (menu.open) menu.close(); }

  menu.addEventListener('close', () => {
    document.documentElement.classList.remove('menu-open');
    openButton.setAttribute('aria-expanded', 'false');
    openButton.focus({ preventScroll: true });
  });
  openButton.addEventListener('click', open);
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
