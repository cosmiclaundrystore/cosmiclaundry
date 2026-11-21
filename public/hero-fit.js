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

/* Shrinks the hero tee name just enough that a single long word fits on one line. */
(() => {
  'use strict';
  const MIN = 18;
  function fitTitles() {
    document.querySelectorAll('.hero .feature-info h2').forEach(title => {
      title.style.fontSize = '';
      let size = parseFloat(getComputedStyle(title).fontSize);
      while (title.scrollWidth > title.clientWidth + 1 && size > MIN) {
        size -= 1;
        title.style.fontSize = size + 'px';
      }
    });
  }
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fitTitles); };
  const start = () => {
    const main = document.querySelector('#main');
    if (main) new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.fonts?.ready.then(schedule);
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
