/* Hero tee strip: scrolls on its own and can also be scrolled by hand.
   - Moves left continuously (about 38px a second) and loops seamlessly (the list is rendered twice).
   - Drag with the mouse, swipe on touch, or use a trackpad/shift+wheel to scroll it yourself.
   - Auto-scroll pauses while hovered, focused or being scrolled, and resumes ~2.5s after you stop.
   - With "reduce motion" on (or motion paused) it never moves by itself but stays scrollable. */
(() => {
  'use strict';
  const SPEED = 38;          // px per second
  const RESUME_AFTER = 2500; // ms of no interaction before auto-scroll resumes

  function init(strip) {
    const track = strip?.querySelector('.hero-marquee-track');
    if (!strip || !track) return () => {};
    let pos = strip.scrollLeft, last = 0, raf = 0, hovering = false, idleUntil = 0, drag = null, suppressClick = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Width of one copy of the list (start of the second copy minus start of the first).
    const loopWidth = () => {
      const half = track.children.length / 2;
      const first = track.children[0], second = track.children[half];
      return first && second ? second.offsetLeft - first.offsetLeft : 0;
    };
    const wrap = () => {
      const w = loopWidth(); if (!w) return;
      if (strip.scrollLeft >= w) { strip.scrollLeft -= w; }
      else if (strip.scrollLeft <= 0) { strip.scrollLeft += w; }
      pos = strip.scrollLeft;
    };
    const touched = () => { idleUntil = performance.now() + RESUME_AFTER; };

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(now - last, 100) / 1000 : 0; last = now;
      const paused = hovering || drag || now < idleUntil || document.hidden || reduce.matches
        || document.documentElement.hasAttribute('data-motion-paused') || strip.matches(':focus-within');
      if (paused) { pos = strip.scrollLeft; return; }
      pos += SPEED * dt;
      strip.scrollLeft = pos;
      if (Math.abs(strip.scrollLeft - pos) > 2) pos = strip.scrollLeft; // something else moved it
      const w = loopWidth();
      if (w && pos >= w) { pos -= w; strip.scrollLeft = pos; }
    }

    // Manual scrolling: keep the loop seamless in both directions.
    const onScroll = () => { if (hovering || drag || performance.now() < idleUntil) wrap(); };
    const onWheel = () => touched();
    const onTouch = () => touched();
    const onEnter = (e) => { if (e.pointerType === 'mouse') hovering = true; };
    const onLeave = (e) => { if (e.pointerType === 'mouse') hovering = false; };

    // Mouse drag-to-scroll (touch already scrolls natively).
    const onDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, start: strip.scrollLeft, moved: false, id: e.pointerId };
    };
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; try { strip.setPointerCapture?.(e.pointerId); } catch (_) {} strip.classList.add('is-dragging'); }
      if (drag.moved) { strip.scrollLeft = drag.start - dx; wrap(); drag.start = strip.scrollLeft + dx; }
    };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      strip.classList.remove('is-dragging');
      try { if (strip.hasPointerCapture?.(e.pointerId)) strip.releasePointerCapture(e.pointerId); } catch (_) {}
      drag = null; touched();
    };
    // A drag shouldn't also count as a click on a tee.
    const onClick = (e) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } };

    strip.addEventListener('scroll', onScroll, { passive: true });
    strip.addEventListener('wheel', onWheel, { passive: true });
    strip.addEventListener('touchstart', onTouch, { passive: true });
    strip.addEventListener('touchmove', onTouch, { passive: true });
    strip.addEventListener('pointerenter', onEnter);
    strip.addEventListener('pointerleave', onLeave);
    strip.addEventListener('pointerdown', onDown);
    strip.addEventListener('pointermove', onMove);
    strip.addEventListener('pointerup', onUp);
    strip.addEventListener('pointercancel', onUp);
    strip.addEventListener('click', onClick, true);
    raf = requestAnimationFrame(frame);

    return function destroy() {
      cancelAnimationFrame(raf);
      strip.removeEventListener('scroll', onScroll);
      strip.removeEventListener('wheel', onWheel);
      strip.removeEventListener('touchstart', onTouch);
      strip.removeEventListener('touchmove', onTouch);
      strip.removeEventListener('pointerenter', onEnter);
      strip.removeEventListener('pointerleave', onLeave);
      strip.removeEventListener('pointerdown', onDown);
      strip.removeEventListener('pointermove', onMove);
      strip.removeEventListener('pointerup', onUp);
      strip.removeEventListener('pointercancel', onUp);
      strip.removeEventListener('click', onClick, true);
    };
  }

  window.CosmicMarquee = { init };
})();
