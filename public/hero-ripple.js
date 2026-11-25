/* Hero tee fabric ripple: the cloth moves like it's in a light breeze.
   An SVG displacement filter bends the tee photo with slowly changing noise. A top-to-bottom
   gradient weights it, so the shoulders and collar stay still and the hem moves most, and the
   print near the chest stays readable.
   Only the hero tee gets it. It stops with "reduce motion", the site's Pause motion button,
   a hidden tab, or the hero out of view, and then the filter comes off entirely. */
(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const STRENGTH = 22;   // displacement scale in px (most of it lands on the hem)
  const FPS = 30;        // the filter repaints the whole tee, so cap the frame rate

  // Black (no movement) down to ~35% of the height, then easing to white (full movement) at the hem.
  const weight = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="100" preserveAspectRatio="none">' +
    '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#000"/><stop offset=".35" stop-color="#000"/>' +
    '<stop offset=".7" stop-color="#777"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
    '<rect width="10" height="100" fill="url(#g)"/></svg>');

  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('focusable', 'false');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.innerHTML =
    '<filter id="hero-ripple" x="-6%" y="-4%" width="112%" height="110%" color-interpolation-filters="sRGB">' +
      // Noise stretched sideways, so it reads as vertical folds rippling across.
      '<feTurbulence type="fractalNoise" baseFrequency="0.011 0.005" numOctaves="1" seed="7" result="noise"/>' +
      '<feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="solidNoise"/>' +
      '<feImage href="' + weight + '" x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="weight"/>' +
      // map = 0.5 + (noise - 0.5) * weight  → neutral (no shift) at the top, full noise at the hem.
      '<feComposite in="solidNoise" in2="weight" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + STRENGTH + '" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>';
  const turbulence = defs.querySelector('feTurbulence');

  let image = null, observer = null, inView = true, raf = 0, last = 0, time = 0;

  const paused = () => reduced.matches || document.hidden || document.documentElement.hasAttribute('data-motion-paused');

  function setRippling(on) {
    document.querySelector('#main .hero')?.classList.toggle('is-rippling', on);
  }

  function frame(now) {
    raf = 0;
    const hero = document.querySelector('#main .hero');
    if (!hero || paused() || !inView) { setRippling(false); last = 0; return; }
    raf = requestAnimationFrame(frame);
    if (last && now - last < 1000 / FPS) return;
    time += last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    // Two slow, out-of-step waves morph the folds so the motion never visibly loops.
    const fx = 0.011 + 0.0022 * Math.sin(time * 0.75) + 0.0008 * Math.sin(time * 1.9 + 2);
    const fy = 0.005 + 0.0012 * Math.sin(time * 0.48 + 1.1);
    turbulence.setAttribute('baseFrequency', fx.toFixed(5) + ' ' + fy.toFixed(5));
    setRippling(true);
  }

  function start() {
    if (!raf && !paused() && inView && document.querySelector('#main .hero')) raf = requestAnimationFrame(frame);
    if (paused()) setRippling(false);
  }

  function attach() {
    const hero = document.querySelector('#main .hero .hero-studio');
    if (hero === image) { start(); return; }
    observer?.disconnect();
    image = hero;
    if (!hero) return;
    observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; start(); });
    observer.observe(hero);
    start();
  }

  const boot = () => {
    document.body.appendChild(defs);
    const main = document.querySelector('#main');
    if (!main) return;
    // The storefront re-renders <main> on navigation; re-find the hero when that happens.
    // (subtree: the hero's own contents can be swapped without <main>'s children changing.)
    new MutationObserver(attach).observe(main, { childList: true, subtree: true });
    attach();
  };

  document.addEventListener('visibilitychange', start);
  reduced.addEventListener('change', start);
  new MutationObserver(start).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion-paused'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
