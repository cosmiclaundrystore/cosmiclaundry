/* Cosmic Laundry — motion enhances an already usable, visible interface.
 * GSAP 3.15.0 and ScrollTrigger are optional, locally vendored dependencies.
 * The showroom owns real garment geometry and baked cloth playback.
 * Other page motion remains independently optional.
 */
(() => {
  'use strict';

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const features = new Map();
  const actors = new Set();
  const pendingTransitions = new Map();
  const enteredHeroes = new WeakSet();
  const revealedElements = new WeakSet();
  let gsap;
  let scrollTrigger;
  let media;
  let context;
  let started = false;
  let refreshFrame = 0;
  let pausedByUser = false;
  let showroomModule;
  let showroomPromise;
  try { pausedByUser = localStorage.getItem('cosmic-motion-paused-v1') === 'true'; } catch {}

  const all = (root, selector) => [
    ...(root instanceof Element && root.matches(selector) ? [root] : []),
    ...root.querySelectorAll(selector),
  ];
  const resolve = value => typeof value === 'string' ? document.querySelector(value) : value;
  const amount = (value, fallback) => Number.isFinite(Number(value)) && value !== '' ? Number(value) : fallback;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const hidden = element => !element.isConnected || element.closest('[hidden], [inert]') || element.getClientRects().length === 0;

  function saveStyle(element, properties) {
    const original = properties.map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    return () => original.forEach(([property, value, priority]) => value
      ? element.style.setProperty(property, value, priority)
      : element.style.removeProperty(property));
  }

  function register(element, name, setup) {
    let registry = features.get(element);
    if (!registry) features.set(element, registry = new Map());
    if (!registry.has(name)) registry.set(name, setup() || (() => {}));
  }

  function disposeFeatures() {
    features.forEach(registry => registry.forEach(cleanup => cleanup()));
    features.clear();
    actors.clear();
  }

  function finishTransitions() {
    // A preference change must never swallow a requested collection change.
    // Finish its content update synchronously, then stop decorative motion.
    [...pendingTransitions.values()].forEach(state => state.finish());
  }

  function prune() {
    features.forEach((registry, element) => {
      if (element.isConnected) return;
      registry.forEach(cleanup => cleanup());
      features.delete(element);
    });
    // A route can replace the product while its selection animation is running.
    // Do not retain the old DOM or commit its delayed update on the new route.
    [...pendingTransitions.values()].forEach(state => {
      const target = state.target();
      if (target instanceof Element && !target.isConnected) state.cancel();
    });
  }

  function updateActivity() {
    actors.forEach(actor => {
      const active = actor.inView && !pausedByUser && !document.hidden && !hidden(actor.element);
      active ? actor.animation.play() : actor.animation.pause();
    });
  }

  function visibilityChanged() {
    // Commit the chosen product before a background tab suspends animation
    // frames. Returning to the tab must show the latest requested selection.
    if (document.hidden) finishTransitions();
    updateActivity();
  }

  function watchAnimation(element, animation) {
    const actor = { element, animation, inView: false };
    actors.add(actor);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      actor.inView = entries[0].isIntersecting;
      updateActivity();
    }, { rootMargin: '40px' }) : null;
    if (observer) observer.observe(element);
    else { actor.inView = true; updateActivity(); }
    return () => { observer?.disconnect(); animation.revert(); actors.delete(actor); };
  }

  function reveal(element, index = 0) {
    if (revealedElements.has(element)) return;
    const restore = saveStyle(element, ['transform', 'opacity', 'visibility', 'will-change']);
    let played = false;
    let animation;
    let observer;
    const play = () => {
      if (played || hidden(element)) return;
      played = true;
      revealedElements.add(element);
      observer?.disconnect();
      if (gsap) {
        animation = gsap.from(element, {
          y: 24, autoAlpha: 0, duration: .76, delay: Math.min(index % 3, 2) * .07,
          ease: 'power3.out', onComplete: () => { animation.revert(); restore(); },
        });
      } else if (element.animate) {
        animation = element.animate([
          { opacity: 0, transform: 'translateY(20px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    };
    // Content remains visible until it actually enters the viewport.
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) play();
      }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
      observer.observe(element);
    } else play();
    return () => { observer?.disconnect(); animation?.revert?.(); animation?.cancel?.(); restore(); };
  }

  function heroArrival(stage) {
    if (enteredHeroes.has(stage)) return;
    const items = all(stage, '[data-hero-item]').filter(element => !element.matches('[data-hero-copy]'));
    const copy = all(stage, '[data-hero-copy]');
    if (!items.length && !copy.length) return;
    enteredHeroes.add(stage);
    const targets = [...new Set([...items, ...copy])];
    const restores = targets.map(element => saveStyle(element, ['transform', 'opacity', 'visibility']));
    let animation;
    if (gsap) {
      animation = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (items.length) animation.from(items, { autoAlpha: 0, y: 42, scale: .94, duration: 1.15, stagger: .1 }, 0);
      if (copy.length) animation.from(copy, { autoAlpha: 0, y: 18, duration: .8, stagger: .07 }, .15);
      animation.eventCallback('onComplete', () => { animation.revert(); restores.forEach(restore => restore()); });
    } else if (items[0]?.animate) {
      const list = targets.map((element, index) => element.animate([
        { opacity: 0, transform: 'translateY(25px) scale(.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], { duration: 850, delay: index * 70, easing: 'cubic-bezier(.22,1,.36,1)' }));
      return () => list.forEach(item => item.cancel());
    }
    return () => { animation?.revert(); restores.forEach(restore => restore()); };
  }

  function float(element) {
    // Float hooks belong to the hero only. Collection cards stay still at rest.
    if (element.closest('.hero-product, .category-garment, [data-showroom-product]')) return;
    if (!gsap || !element.closest('[data-hero], [data-scroll-hero], .hero')) return;
    const restore = saveStyle(element, ['transform', 'will-change']);
    const amplitude = clamp(amount(element.dataset.float, 10), 0, 14);
    const baseY = Number(gsap.getProperty(element, 'y')) || 0;
    const baseRotation = Number(gsap.getProperty(element, 'rotation')) || 0;
    const tween = gsap.to(element, {
      y: baseY - amplitude, rotation: baseRotation + 1.2,
      duration: 3.7 + amount(element.dataset.floatPhase, 0),
      ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true,
    });
    const stopWatching = watchAnimation(element, tween);
    return () => { stopWatching(); restore(); };
  }

  function depth(stage) {
    // The showroom owns these layers; no competing pointer transform writer.
    if (stage.matches('.hero-studio, .laundry-stage, .product-showroom-stage') && stage.querySelector('.hero-product, .category-garment, [data-showroom-product]')) return;
    if (!pointerQuery.matches) return;
    const layers = all(stage, '[data-depth-layer]');
    if (!layers.length) return;
    const listeners = new AbortController();
    const restores = layers.map(element => saveStyle(element, ['transform', 'will-change']));
    let bounds;
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    const controllers = layers.map((element, index) => {
      const strength = clamp(amount(element.dataset.depthLayer, 1), -.8, 1.5);
      if (!gsap) return { element, strength, base: getComputedStyle(element).transform };
      const base = {
        x: Number(gsap.getProperty(element, 'x')) || 0,
        y: Number(gsap.getProperty(element, 'y')) || 0,
        rotationX: Number(gsap.getProperty(element, 'rotationX')) || 0,
        rotationY: Number(gsap.getProperty(element, 'rotationY')) || 0,
      };
      const options = { duration: .85 + index * .05, ease: 'power3.out' };
      return { element, strength, base,
        x: gsap.quickTo(element, 'x', options), y: gsap.quickTo(element, 'y', options),
        rx: gsap.quickTo(element, 'rotationX', options), ry: gsap.quickTo(element, 'rotationY', options),
      };
    });
    const draw = () => {
      raf = 0;
      controllers.forEach(controller => {
        const { element, strength, base } = controller;
        if (gsap) {
          controller.x(base.x + targetX * 9 * strength);
          controller.y(base.y + targetY * 6 * strength);
          controller.rx(base.rotationX - targetY * 2.5 * strength);
          controller.ry(base.rotationY + targetX * 4 * strength);
        } else {
          element.style.transform = `${base === 'none' ? '' : base} translate3d(${targetX * 7 * strength}px,${targetY * 5 * strength}px,0) rotateY(${targetX * 3 * strength}deg)`;
        }
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const enter = () => { bounds = stage.getBoundingClientRect(); };
    const move = event => {
      if (event.pointerType === 'touch') return;
      if (!bounds) enter();
      targetX = clamp(((event.clientX - bounds.left) / bounds.width - .5) * 2, -1, 1);
      targetY = clamp(((event.clientY - bounds.top) / bounds.height - .5) * 2, -1, 1);
      schedule();
    };
    const leave = () => { targetX = targetY = 0; bounds = null; schedule(); };
    const options = { passive: true, signal: listeners.signal };
    stage.addEventListener('pointerenter', enter, options);
    stage.addEventListener('pointermove', move, options);
    stage.addEventListener('pointerleave', leave, options);
    stage.addEventListener('pointercancel', leave, options);
    window.addEventListener('scroll', () => { bounds = null; }, options);
    window.addEventListener('resize', leave, options);
    window.addEventListener('blur', leave, options);
    return () => {
      listeners.abort(); cancelAnimationFrame(raf);
      controllers.forEach(controller => ['x', 'y', 'rx', 'ry'].forEach(key => controller[key]?.tween?.revert()));
      restores.forEach(restore => restore());
    };
  }

  function scrollStory(section) {
    if (!gsap || !scrollTrigger || window.innerWidth < 768) return;
    const art = all(section, '[data-scroll-art]');
    if (!art.length) return;
    const restores = art.map(element => saveStyle(element, ['transform']));
    const tween = gsap.to(art, {
      y: (index, element) => amount(element.dataset.scrollArt, -38),
      ease: 'none',
      scrollTrigger: {
        trigger: section, start: 'top bottom', end: 'bottom top', scrub: .65,
        invalidateOnRefresh: true,
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.revert(); restores.forEach(restore => restore()); };
  }

  // The 3D garment viewer is switched off: the hero and Laundry pages show the original tee photo,
  // which always matches the mockup exactly. Set to true to bring the 3D viewer back.
  const USE_3D_SHOWROOM = false;

  function setup(root) {
    prune();
    syncControls();
    if (USE_3D_SHOWROOM) all(root, '.hero-studio, .laundry-stage, .product-showroom-stage').forEach(stage => {
      if (stage.closest('[hidden]') || (stage.closest('dialog') && !stage.closest('dialog').open)) return;
      register(stage, 'showroom', () => {
      if (!stage.querySelector('.hero-product, .category-garment, [data-showroom-product]')) return;
      let alive = true;
      let view;
      showroomPromise ||= import('./showroom.js?v=garment3d').then(module => { showroomModule = module; return module; });
      showroomPromise.then(module => {
        if (!alive || !stage.isConnected || !started) return;
        if (stage.closest('[hidden]') || (stage.closest('dialog') && !stage.closest('dialog').open)) {
          features.get(stage)?.delete('showroom');
          return;
        }
        view = module.createShowroom(stage, { paused: pausedByUser, reducedMotion: reducedQuery.matches });
      }).catch(() => { /* The product remains visible if optional stage enhancement is unavailable. */ });
      return () => { alive = false; view?.destroy(); };
      });
    });
    if (reducedQuery.matches || pausedByUser) return;
    all(root, '[data-hero], [data-scroll-hero]').forEach(element => register(element, 'arrival', () => heroArrival(element)));
    all(root, '[data-reveal]').forEach((element, index) => register(element, 'reveal', () => reveal(element, index)));
    all(root, '[data-depth]').forEach(element => register(element, 'depth', () => depth(element)));
    all(root, '[data-float]').forEach(element => register(element, 'float', () => float(element)));
    all(root, '[data-scroll-section], [data-scroll-hero]').forEach(element => register(element, 'scroll', () => scrollStory(element)));
    updateActivity();
  }

  function refresh(root = document) {
    if (!started) return init(root);
    root = resolve(root) || document;
    if (context) context.add(() => setup(root));
    else setup(root);
    if (scrollTrigger) {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => scrollTrigger.refresh());
    }
  }

  function rebuild() {
    if (reducedQuery.matches || pausedByUser) finishTransitions();
    disposeFeatures();
    setup(document);
  }

  function syncControls() {
    all(document, '[data-motion-toggle]').forEach(button => {
      const label = button.querySelector('[data-motion-label]') || button;
      const text = reducedQuery.matches ? 'Motion reduced' : pausedByUser ? 'Resume motion' : 'Pause motion';
      label.textContent = text;
      button.setAttribute('aria-label', text);
      button.setAttribute('aria-pressed', String(reducedQuery.matches || pausedByUser));
      button.disabled = reducedQuery.matches;
    });
  }

  function setPaused(value) {
    pausedByUser = Boolean(value);
    try { localStorage.setItem('cosmic-motion-paused-v1', String(pausedByUser)); } catch {}
    document.documentElement.toggleAttribute('data-motion-paused', pausedByUser);
    if (pausedByUser) finishTransitions();
    disposeFeatures();
    if (context) context.add(() => setup(document));
    else setup(document);
    scrollTrigger?.refresh();
    return pausedByUser;
  }

  function handleToggle(event) {
    if (event.target instanceof Element && event.target.closest('[data-motion-toggle]')) setPaused(!pausedByUser);
  }

  function init(root = document) {
    if (started) { refresh(root); return window.CosmicMotion; }
    started = true;
    gsap = window.gsap;
    scrollTrigger = window.ScrollTrigger;
    if (gsap && scrollTrigger) gsap.registerPlugin(scrollTrigger);
    document.documentElement.toggleAttribute('data-motion-paused', pausedByUser);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('click', handleToggle);
    if (gsap?.matchMedia) {
      media = gsap.matchMedia();
      media.add({
        all: '(min-width: 0px)',
        reduced: '(prefers-reduced-motion: reduce)',
        fine: '(hover: hover) and (pointer: fine)',
        desktop: '(min-width: 768px)',
      }, mediaContext => {
        context = mediaContext;
        if (reducedQuery.matches || pausedByUser) finishTransitions();
        setup(resolve(root) || document);
        return () => { disposeFeatures(); context = null; };
      });
    } else {
      setup(resolve(root) || document);
      reducedQuery.addEventListener('change', rebuild);
      pointerQuery.addEventListener('change', rebuild);
    }
    document.fonts?.ready.then(() => { if (started) scrollTrigger?.refresh(); });
    return window.CosmicMotion;
  }

  // Promise resolves false when a newer transition supersedes it. The final
  // requested update commits exactly once, even if motion is paused mid-flight.
  function transition(options = {}) {
    const oldElement = resolve(options.out);
    let newElement = resolve(options.in) || oldElement;
    const key = oldElement || newElement || document.body;
    pendingTransitions.get(key)?.cancel();
    if (reducedQuery.matches || pausedByUser || (!oldElement && !newElement)) {
      options.update?.();
      refresh(newElement || document);
      return Promise.resolve(true);
    }
    return new Promise((resolvePromise, rejectPromise) => {
      let animation;
      let settled = false;
      let updated = false;
      const restores = new Map();
      const preserve = element => {
        if (element && !restores.has(element)) restores.set(element, saveStyle(element, ['transform', 'opacity', 'visibility']));
      };
      preserve(oldElement); preserve(newElement);
      const stop = () => {
        const current = animation;
        animation = null;
        current?.revert?.(); current?.cancel?.();
      };
      const complete = (value, error) => {
        if (settled) return;
        settled = true;
        stop();
        restores.forEach(restore => restore());
        pendingTransitions.delete(key);
        if (value) refresh(newElement || document);
        if (error) rejectPromise(error);
        else resolvePromise(value);
      };
      const cancel = () => complete(false);
      const update = () => {
        if (updated) return true;
        updated = true;
        try { options.update?.(); }
        catch (error) { complete(false, error); return false; }
        newElement = resolve(options.in) || newElement;
        preserve(newElement);
        return true;
      };
      const finish = () => {
        if (settled) return;
        stop();
        if (update()) complete(true);
      };
      pendingTransitions.set(key, { cancel, finish, target: () => updated ? newElement : oldElement });
      const enter = () => {
        if (settled) return;
        stop();
        if (!update()) return;
        if (!newElement) return complete(true);
        if (reducedQuery.matches || pausedByUser) return complete(true);
        if (gsap) {
          // Keep deliberate garment framing instead of forcing CSS scale/offset
          // back to 1/0 for the duration of every product change.
          const baseY = Number(gsap.getProperty(newElement, 'y')) || 0;
          const baseScaleX = Number(gsap.getProperty(newElement, 'scaleX')) || 1;
          const baseScaleY = Number(gsap.getProperty(newElement, 'scaleY')) || 1;
          animation = gsap.fromTo(newElement,
            { autoAlpha: 0, y: baseY + 15, rotationY: 16, scaleX: baseScaleX * .985, scaleY: baseScaleY * .985 },
            { autoAlpha: 1, y: baseY, rotationY: 0, scaleX: baseScaleX, scaleY: baseScaleY, duration: .58, ease: 'power3.out', onComplete: () => complete(true) });
        }
        else if (newElement.animate) {
          animation = newElement.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
          animation.onfinish = () => complete(true);
        } else complete(true);
      };
      if (!oldElement || hidden(oldElement)) return enter();
      if (gsap) animation = gsap.to(oldElement, { autoAlpha: 0, rotationY: -14, y: (Number(gsap.getProperty(oldElement, 'y')) || 0) - 9, duration: .18, ease: 'power2.in', onComplete: enter });
      else if (oldElement.animate) {
        animation = oldElement.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
        animation.onfinish = enter;
      } else enter();
    });
  }

  function destroy() {
    pendingTransitions.forEach(transitionState => transitionState.cancel());
    pendingTransitions.clear();
    media?.revert(); media = null; context = null;
    disposeFeatures(); cancelAnimationFrame(refreshFrame);
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('click', handleToggle);
    reducedQuery.removeEventListener('change', rebuild);
    pointerQuery.removeEventListener('change', rebuild);
    started = false;
  }

  function release(root) {
    root = resolve(root);
    if (!root) return;
    features.forEach((registry, element) => {
      if (element === root || root.contains(element)) {
        registry.forEach(cleanup => cleanup());
        features.delete(element);
      }
    });
  }

  window.CosmicMotion = { init, refresh, transition, destroy, release, setPaused,
    get showroomStats() { return showroomModule?.diagnostics() || []; },
    get paused() { return pausedByUser; }, get reducedMotion() { return reducedQuery.matches; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  else init();
})();
