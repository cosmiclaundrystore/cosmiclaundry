/* Measures the preview note + site header so the hero can fill exactly the rest of the viewport. */
(() => {
  'use strict';
  const root = document.documentElement;
  function measure() {
    const note = document.querySelector('.preview-note');
    const header = document.querySelector('.site-header');
    const height = (note ? note.offsetHeight : 0) + (header ? header.offsetHeight : 0);
    root.style.setProperty('--chrome-h', height + 'px');
  }
  measure();
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    document.querySelectorAll('.preview-note, .site-header').forEach(el => observer.observe(el));
  } else {
    window.addEventListener('resize', measure, { passive: true });
  }
})();
