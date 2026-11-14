/* Full-volume 360-degree garment presentation with baked cloth animation.
 * This controller exclusively owns rotation. HTML retains the original photo
 * until geometry, source artwork and the first WebGL render all succeed.
 */
import * as THREE from './vendor/three.module.js';
import { createGarment } from './3d/garment-runtime.js';

const views = new Set();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const radians = value => value * Math.PI / 180;
const productSelector = '.hero-product, .category-garment, [data-showroom-product]';
const arrow = direction => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction < 0 ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'}"/></svg>`;
export function diagnostics() { return [...views].map(view => view.stats()); }

export function createShowroom(stage, preferences = {}) {
  const product = stage.querySelector(productSelector);
  const layer = product?.querySelector('[data-depth-layer]');
  if (!product || !layer) return null;
  const listeners = new AbortController(), options = { signal: listeners.signal };
  const originalTouchAction = product.style.touchAction;
  const originalDescription = product.getAttribute('aria-describedby');
  const uniqueId = `showroom-help-${Math.random().toString(36).slice(2, 9)}`;
  let disposed = false, reduced = Boolean(preferences.reducedMotion), paused = Boolean(preferences.paused);
  let auto = true, localPaused = false, inView = true;
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
  let phase = 0, raf = 0, previousTime = 0, lastRender = -Infinity, frames = 0;
  let gesture = null, blockClickUntil = 0, bounds = null;
  let renderer, scene, camera, garment, loadController, loadGeneration = 0, productId = null;
  let contextLost = false, ready = false, stageState = 'loading', failure = '';
  let renderMS = 0, renderSamples = 0, maxRenderMS = 0, frameTimeMS = 0, frameSamples = 0;
  let steadyRenderMS = 0, steadySamples = 0, maximumSteadyMS = 0;

  stage.classList.add('has-showroom');
  stage.dataset.showroomState = stageState;
  stage.dataset.showroomReady = 'false';
  product.style.touchAction = 'pan-y';
  product.setAttribute('aria-describedby', [originalDescription, uniqueId].filter(Boolean).join(' '));
  const canvas = document.createElement('canvas');
  canvas.className = 'showroom-canvas'; canvas.setAttribute('aria-hidden', 'true'); stage.prepend(canvas);
  const controls = document.createElement('div');
  controls.className = 'showroom-controls';
  controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', '360-degree garment view');
  controls.innerHTML = `
    <span class="showroom-help" id="${uniqueId}">Drag left or right to turn the whole tee. Arrow keys turn 90 degrees. Home shows the front; End shows the back.</span>
    <button type="button" data-showroom-turn="-1" aria-label="Rotate tee left 90 degrees">${arrow(-1)}</button>
    <button type="button" data-showroom-reset aria-label="Show front of tee">Front</button>
    <button type="button" data-showroom-back aria-label="Show back of tee">Back</button>
    <button type="button" data-showroom-turn="1" aria-label="Rotate tee right 90 degrees">${arrow(1)}</button>
    <span class="showroom-control-divider" aria-hidden="true"></span>
    <button type="button" data-showroom-auto aria-pressed="true"><span class="showroom-orbit-icon" aria-hidden="true"></span><span data-showroom-auto-label>Auto</span></button>
    <button type="button" data-showroom-pause aria-label="Pause garment motion" aria-pressed="false"><span data-showroom-pause-label>Pause</span></button>
    <span class="showroom-announcement" role="status" aria-live="polite"></span>`;
  stage.append(controls);
  const autoButton = controls.querySelector('[data-showroom-auto]');
  const pauseButton = controls.querySelector('[data-showroom-pause]');
  const announcement = controls.querySelector('.showroom-announcement');
  const status = document.createElement('span');
  status.className = 'showroom-load-status'; status.setAttribute('role', 'status');
  status.textContent = 'Preparing your 3D tee…'; stage.append(status);
  const viewLabel = document.createElement('span');
  viewLabel.className = 'showroom-view-label'; viewLabel.setAttribute('aria-hidden', 'true');
  viewLabel.textContent = '360° VIEW · DRAG TO TURN'; stage.append(viewLabel);

  function setState(state) { stageState = state; stage.dataset.showroomState = state; }
  function syncControls() {
    const stopped = reduced || paused || localPaused;
    controls.querySelectorAll('button').forEach(button => { button.disabled = !ready; });
    autoButton.disabled = !ready || reduced || paused;
    pauseButton.disabled = !ready || reduced || paused;
    pauseButton.setAttribute('aria-pressed', String(stopped));
    pauseButton.setAttribute('aria-label', stopped ? 'Resume garment motion' : 'Pause garment motion');
    controls.querySelector('[data-showroom-pause-label]').textContent = reduced || paused ? 'Still' : localPaused ? 'Play' : 'Pause';
    autoButton.setAttribute('aria-pressed', String(auto && !stopped && ready));
    controls.querySelector('[data-showroom-auto-label]').textContent = 'Auto';
    autoButton.title = 'Toggle automatic 360-degree rotation';
    stage.classList.toggle('showroom-automatic', auto && !stopped && ready);
  }
  function setReady(value) {
    ready = value; stage.dataset.showroomReady = String(value); status.hidden = value; syncControls();
  }
  function fail(error) {
    failure = error?.message || 'The 3D view is unavailable.';
    setReady(false); setState('failure'); stage.dataset.showroomRenderer = 'photo';
    status.textContent = 'Photo view · 3D is unavailable';
    if (garment) garment.object.visible = false;
  }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 651 ? 1.25 : 1.5));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, .1, 40);
    camera.position.set(0, .06, 7); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xe7efff, 0x8494aa, 2.1));
    const key = new THREE.DirectionalLight(0xfff5e8, 3.2); key.position.set(-3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xc8ddff, 1.1); fill.position.set(4, 1, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xa1c4ff, 2.4); rim.position.set(2, 3, -4); scene.add(rim);
    const rear = new THREE.DirectionalLight(0xf5f0e8, 1.5); rear.position.set(-3, 1, -5); scene.add(rear);
    stage.dataset.showroomRenderer = 'webgl';
  } catch (error) { renderer?.dispose(); renderer = null; fail(error); }
  function isActive() {
    const dialog = stage.closest('dialog'), openDialog = document.querySelector('dialog[open]');
    return !disposed && inView && !document.hidden && !contextLost
      && !stage.closest('[hidden], [inert]') && (!dialog || dialog.open)
      && (!openDialog || openDialog === dialog);
  }
  function schedule() { if (!raf && renderer && isActive()) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
  function resize() {
    if (disposed) return;
    bounds = null;
    const width = stage.clientWidth, height = stage.clientHeight;
    if (renderer && width && height) {
      renderer.setSize(width, height, false); camera.aspect = width / height;
      const tangent = Math.tan(radians(camera.fov / 2));
      const fitHeight = (garment?.height || 3.05) / (2 * tangent * .83);
      const fitWidth = (garment?.width || 4.3) / (2 * tangent * camera.aspect * .9);
      camera.position.z = Math.max(fitHeight, fitWidth) + .25; camera.updateProjectionMatrix();
    }
    lastRender = -Infinity; schedule();
  }
  function render() {
    if (!renderer || contextLost) return;
    const start = performance.now(); renderer.render(scene, camera);
    const duration = performance.now() - start;
    renderMS += duration; renderSamples += 1; maxRenderMS = Math.max(maxRenderMS, duration); frames += 1;
    if (ready && frames > 5) {
      steadyRenderMS += duration; steadySamples += 1; maximumSteadyMS = Math.max(maximumSteadyMS, duration);
    }
  }
  function frame(now) {
    raf = 0;
    if (!isActive()) { previousTime = 0; return; }
    const delta = Math.min(previousTime ? (now - previousTime) / 1000 : 1 / 60, .05);
    previousTime = now;
    const animated = !paused && !reduced && !localPaused && ready;
    if (animated) {
      phase += delta; garment.update(delta);
      if (auto && !gesture && phase > 1.8) targetYaw += delta * 10;
    }
    const damping = animated ? 1 - Math.exp(-delta * (gesture ? 18 : 9)) : 1;
    yaw += (targetYaw - yaw) * damping; pitch += (targetPitch - pitch) * damping;
    const settling = Math.abs(targetYaw - yaw) > .02 || Math.abs(targetPitch - pitch) > .02;
    if (garment && ready) {
      garment.object.rotation.set(radians(pitch), radians(yaw), 0);
      garment.object.position.y = animated ? Math.sin(phase * .7) * .018 : 0;
      setState(gesture ? 'presenting' : settling && !auto ? 'returning' : 'resting');
    }
    const moving = animated || settling || Boolean(gesture);
    const interval = window.innerWidth < 651 ? 1000 / 30 : 1000 / 60;
    if (now - lastRender >= interval - .8 || !moving) {
      if (lastRender !== -Infinity && now - lastRender < 250) { frameTimeMS += now - lastRender; frameSamples += 1; }
      render(); lastRender = now;
    }
    if (moving) schedule();
  }
  function endGesture({ cancel = false } = {}) {
    if (!gesture) return;
    const previous = gesture; gesture = null;
    if (previous.moved) blockClickUntil = performance.now() + 450;
    if (product.hasPointerCapture?.(previous.id)) product.releasePointerCapture(previous.id);
    stage.classList.remove('showroom-dragging');
    if (cancel) targetPitch = 0;
    if (ready) setState('returning');
    schedule();
  }
  function nearestView(degrees) { return targetYaw + ((((degrees - targetYaw) % 360) + 540) % 360) - 180; }
  function setView(nextYaw, nextPitch = 0) {
    if (!ready) return;
    endGesture(); auto = false; targetYaw = nextYaw; targetPitch = clamp(nextPitch, -22, 22);
    syncControls(); setState('returning'); schedule();
    const normalized = ((Math.round(nextYaw) % 360) + 360) % 360;
    announcement.textContent = normalized === 0 ? 'Front view.' : normalized === 180 ? 'Back view.' : `Tee rotated to ${normalized} degrees.`;
  }
  function pointerDown(event) {
    if (event.button !== 0 || gesture || !ready) return;
    bounds = product.getBoundingClientRect();
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, yaw, pitch, moved: false };
  }
  function pointerMove(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (!gesture.moved) {
      if (Math.abs(dx) < 6 || (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx))) return;
      gesture.moved = true; auto = false; product.setPointerCapture(event.pointerId);
      stage.classList.add('showroom-dragging'); syncControls();
    }
    targetYaw = gesture.yaw + dx / Math.max(bounds.width, 1) * 360;
    targetPitch = clamp(gesture.pitch - dy / Math.max(bounds.height, 1) * 32, -22, 22);
    schedule();
  }
  async function setProduct(nextId = product.dataset.productId || preferences.productId) {
    if (!nextId || (nextId === productId && !failure) || disposed) return;
    const selected = window.CosmicCatalog?.products.find(item => item.id === nextId);
    productId = nextId;
    const generation = ++loadGeneration;
    loadController?.abort(); loadController = new AbortController(); endGesture({ cancel: true });
    garment?.dispose(); garment = null;
    yaw = pitch = targetYaw = targetPitch = phase = 0; failure = '';
    setReady(false); setState('loading'); status.textContent = 'Preparing your 3D tee…';
    if (!renderer) { fail(new Error('WebGL is unavailable.')); return; }
    render();
    const start = performance.now();
    try {
      const next = await createGarment(selected, renderer, { signal: loadController.signal });
      if (disposed || generation !== loadGeneration) { next.dispose(); return; }
      garment = next; scene.add(garment.object);
      if (contextLost) {
        setState('failure'); status.textContent = 'Photo view · restoring 3D…';
        return;
      }
      resize(); render();
      stage.dataset.showroomLoadMs = String(Math.round(performance.now() - start));
      stage.dataset.showroomRenderer = 'webgl'; setReady(true); setState('presenting'); schedule();
    } catch (error) {
      if (disposed || generation !== loadGeneration || error.name === 'AbortError') return;
      fail(error);
    }
  }
  product.addEventListener('pointerdown', pointerDown, options);
  product.addEventListener('dragstart', event => event.preventDefault(), options);
  product.addEventListener('pointermove', pointerMove, options);
  product.addEventListener('pointerup', event => { if (gesture?.id === event.pointerId) endGesture(); }, options);
  product.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) endGesture({ cancel: true }); }, options);
  product.addEventListener('lostpointercapture', event => {
    if (event.target === product && gesture?.id === event.pointerId && !product.hasPointerCapture(event.pointerId)) endGesture({ cancel: true });
  }, options);
  product.addEventListener('pointerleave', () => { if (gesture && !gesture.moved) endGesture({ cancel: true }); }, options);
  product.addEventListener('click', event => {
    if (performance.now() < blockClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true, signal: listeners.signal });
  stage.addEventListener('keydown', event => {
    if (!event.target.closest(`${productSelector}, .showroom-controls`)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); setView(targetYaw + (event.key === 'ArrowLeft' ? -90 : 90));
    } else if (event.key === 'Home') { event.preventDefault(); setView(nearestView(0)); }
    else if (event.key === 'End') { event.preventDefault(); setView(nearestView(180)); }
    else if (event.key === 'Escape') endGesture({ cancel: true });
  }, options);
  controls.addEventListener('click', event => {
    const turn = event.target.closest('[data-showroom-turn]');
    if (turn) setView(targetYaw + Number(turn.dataset.showroomTurn) * 90);
    else if (event.target.closest('[data-showroom-reset]')) setView(nearestView(0));
    else if (event.target.closest('[data-showroom-back]')) setView(nearestView(180));
    else if (event.target.closest('[data-showroom-auto]') && !autoButton.disabled) {
      endGesture(); auto = localPaused ? true : !auto; localPaused = false; targetPitch = 0; syncControls(); schedule();
      announcement.textContent = auto ? 'Automatic rotation on.' : 'Automatic rotation off.';
    } else if (event.target.closest('[data-showroom-pause]') && !pauseButton.disabled) {
      endGesture(); localPaused = !localPaused; syncControls(); schedule();
      announcement.textContent = localPaused ? 'Garment motion paused. You can still rotate the tee.' : 'Garment motion playing.';
    }
  }, options);
  window.addEventListener('blur', () => endGesture({ cancel: true }), options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { endGesture({ cancel: true }); stop(); } else schedule();
  }, options);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; endGesture({ cancel: true }); stop();
    setReady(false); setState('failure'); stage.dataset.showroomRenderer = 'photo';
    status.textContent = 'Photo view · restoring 3D…';
  }, options);
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    if (garment) { stage.dataset.showroomRenderer = 'webgl'; setReady(true); setState('resting'); resize(); schedule(); }
  }, options);
  const intersection = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) schedule(); else { endGesture({ cancel: true }); stop(); }
  }, { threshold: .01 }); intersection.observe(stage);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
  const productObserver = new MutationObserver(() => setProduct());
  productObserver.observe(product, { attributes: true, attributeFilter: ['data-product-id'] });
  const modalObserver = new MutationObserver(() => {
    if (isActive()) schedule(); else { endGesture({ cancel: true }); stop(); }
  });
  modalObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['open', 'hidden'], childList: true });
  resize(); syncControls(); setProduct();
  const view = {
    setProduct, setView,
    setMotion(next) {
      paused = Boolean(next.paused); reduced = Boolean(next.reducedMotion);
      endGesture({ cancel: true }); syncControls(); schedule();
    },
    stats() {
      return {
        productId, renderer: stage.dataset.showroomRenderer, state: stageState, ready, failure,
        frames, active: Boolean(raf), gesture: Boolean(gesture), auto, reduced, paused, localPaused,
        yaw: Number(yaw.toFixed(2)), targetYaw: Number(targetYaw.toFixed(2)), pitch: Number(pitch.toFixed(2)),
        calls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0,
        geometries: renderer?.info.memory.geometries || 0, textures: renderer?.info.memory.textures || 0,
        width: canvas.width, height: canvas.height,
        averageRenderMS: Number((renderMS / Math.max(1, renderSamples)).toFixed(2)),
        maximumRenderMS: Number(maxRenderMS.toFixed(2)),
        steadyRenderMS: Number((steadyRenderMS / Math.max(1, steadySamples)).toFixed(2)),
        maximumSteadyRenderMS: Number(maximumSteadyMS.toFixed(2)),
        averageFrameMS: Number((frameTimeMS / Math.max(1, frameSamples)).toFixed(2)),
        ...garment?.stats(),
      };
    },
    destroy() {
      if (disposed) return;
      disposed = true; ++loadGeneration; loadController?.abort(); endGesture({ cancel: true });
      stop(); listeners.abort();
      intersection.disconnect(); resizeObserver.disconnect(); productObserver.disconnect(); modalObserver.disconnect();
      garment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
      controls.remove(); canvas.remove(); status.remove(); viewLabel.remove();
      product.style.touchAction = originalTouchAction;
      if (originalDescription) product.setAttribute('aria-describedby', originalDescription);
      else product.removeAttribute('aria-describedby');
      stage.classList.remove('has-showroom', 'showroom-dragging', 'showroom-automatic');
      ['showroomState', 'showroomRenderer', 'showroomReady', 'showroomLoadMs'].forEach(key => delete stage.dataset[key]);
      views.delete(view);
    },
  };
  views.add(view); return view;
}
