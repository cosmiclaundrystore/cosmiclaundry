/* Cosmic Laundry commerce: local selection bag; no payments or invented stock. */
(function () {
  'use strict';

  const STORAGE_KEY = 'cosmic-laundry:bag:v1';
  const escape = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.5"/></svg>';
  const arrowIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>';
  const whatsappIcon = '<svg class="cl-whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.1Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z"/></svg>';
  const bagIcon = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M15 22h34l4 33H11l4-33Z" stroke="currentColor" stroke-width="1.5"/><path d="M23 25V17a9 9 0 0 1 18 0v8" stroke="currentColor" stroke-width="1.5"/></svg>';
  const state = { products: new Map(), bag: [], config: {}, current: null, color: null, view: 'front', returnFocus: null, ready: false, persist: true, announceTimer: null, removed: null };
  let productDialog, bagDialog, announcer;

  function normalizeProduct(product) {
    const colors = (Array.isArray(product.colors) && product.colors.length ? product.colors : [{ id: 'pictured', label: 'As pictured', image: product.detailImage || product.image }]).map((color) => typeof color === 'string' ? { id: color, label: color } : { ...color, id: String(color.id || color.label), label: String(color.label || color.name || color.id) });
    const sizes = (Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['S', 'M', 'L', 'XL', 'XXL']).map((size) => typeof size === 'object' ? String(size.label || size.id) : String(size));
    return { ...product, id: String(product.id), colors, sizes, sizesConfirmed: Array.isArray(product.sizes) && product.sizes.length > 0 && product.sizesConfirmed === true };
  }

  function itemKey(item) { return JSON.stringify([item.id, item.color, item.size]); }
  function count() { return state.bag.reduce((sum, item) => sum + item.quantity, 0); }
  function imageFor(product, colorId) { return product.colors.find((color) => color.id === colorId)?.image || product.detailImage || product.image; }
  function backFor(product, colorId) { return product.colors.find((color) => color.id === colorId)?.backImage || product.backImage; }
  function colorFor(product, colorId) { return product.colors.find((color) => color.id === colorId)?.label || 'As pictured'; }
  function collectionName(product) {
    const collections = state.config.collections;
    if (Array.isArray(collections)) {
      const collection = collections.find((entry) => entry.id === product.collection || entry.slug === product.collection);
      if (collection) return collection.name || collection.title || product.collection;
    }
    return product.collectionLabel || product.collection || 'Cosmic Laundry';
  }
  function formatLKR(amount) { return `${Math.round(amount).toLocaleString('en-US')} LKR`; }
  function priceText(product) {
    if (typeof product.price !== 'number' || !Number.isFinite(product.price)) return 'Pricing to be confirmed';
    return formatLKR(product.price);
  }
  function basketTotal() {
    let total = 0;
    for (const item of state.bag) {
      const product = state.products.get(item.id);
      if (typeof product?.price !== 'number' || !Number.isFinite(product.price)) return null;
      total += product.price * item.quantity;
    }
    return total;
  }

  function cleanBag(value) {
    if (!Array.isArray(value)) return [];
    const merged = new Map();
    value.slice(0, 200).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const product = state.products.get(String(item.id));
      // Baskets saved before tees came in two colours used 'pictured'; treat that as the tee's first colour.
      if (product && item.color === 'pictured') item = { ...item, color: product.colors[0].id };
      if (!product || !product.colors.some((color) => color.id === item.color) || !product.sizes.includes(item.size)) return;
      const quantity = Math.min(99, Math.floor(Number(item.quantity)));
      if (!Number.isFinite(quantity) || quantity < 1) return;
      const clean = { id: product.id, color: item.color, size: item.size, quantity };
      const key = itemKey(clean);
      if (merged.has(key)) merged.get(key).quantity = Math.min(99, merged.get(key).quantity + quantity);
      else merged.set(key, clean);
    });
    return [...merged.values()];
  }
  function loadBag() {
    let saved;
    try { saved = localStorage.getItem(STORAGE_KEY); state.persist = true; }
    catch (_) { state.bag = []; state.persist = false; return; }
    try { state.bag = cleanBag(JSON.parse(saved || '[]')); }
    catch (_) { state.bag = []; }
  }
  function announce(message) {
    clearTimeout(state.announceTimer);
    [announcer, ...document.querySelectorAll('[data-cl-live]')].forEach((element) => { element.textContent = ''; });
    state.announceTimer = setTimeout(() => {
      const target = (bagDialog.open ? bagDialog : productDialog.open ? productDialog : null)?.querySelector('[data-cl-live]') || announcer;
      target.textContent = message;
    }, 40);
  }
  function syncBag() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bag)); state.persist = true; }
    catch (_) { state.persist = false; }
    updateCounts();
    window.dispatchEvent(new CustomEvent('cosmic:bag-change', { detail: { count: count(), items: getBag() } }));
  }
  function updateCounts() {
    document.querySelectorAll('[data-bag-count]').forEach((element) => { element.textContent = String(count()); });
    document.querySelectorAll('[data-open-bag]').forEach((element) => { element.setAttribute('aria-label', `Open laundry basket, ${count()} ${count() === 1 ? 'item' : 'items'}`); });
  }
  function getBag() { return state.bag.map((item) => ({ ...item })); }

  function createDialogs() {
    const fragment = document.createElement('div');
    fragment.innerHTML = `<dialog class="cl-dialog cl-product-dialog" aria-labelledby="cl-product-title"><div class="cl-product-shell"></div></dialog><dialog class="cl-dialog cl-bag-dialog" aria-labelledby="cl-bag-title"><div class="cl-bag-shell"></div></dialog><div class="cl-sr-only" aria-live="polite" aria-atomic="true" id="cl-announcer"></div>`;
    productDialog = fragment.children[0];
    bagDialog = fragment.children[1];
    announcer = fragment.children[2];
    document.body.append(productDialog, bagDialog, announcer);
    [productDialog, bagDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target.closest('[data-cl-close]')) { dialog.close(); return; }
        if (event.target === dialog) {
          const bounds = dialog.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
        }
      });
      dialog.addEventListener('close', () => {
        if (!productDialog.open && !bagDialog.open) {
          document.documentElement.classList.remove('cl-dialog-open');
          if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
        }
      });
    });
    productDialog.addEventListener('submit', addSelection);
    productDialog.addEventListener('change', (event) => {
      if (event.target.name === 'cl-color') {
        state.color = event.target.value;
        const product = state.products.get(state.current);
        setProductView(state.view);
        productDialog.querySelector('[data-cl-current-color]').textContent = colorFor(product, state.color);
      }
      if (event.target.name === 'cl-size') productDialog.querySelector('[data-cl-size-error]').hidden = true;
      if (event.target.name === 'cl-quantity') setQuantity(event.target, Number(event.target.value) || 1);
    });
    productDialog.addEventListener('click', (event) => {
      const qtyButton = event.target.closest('[data-cl-qty]');
      if (qtyButton) { const input = productDialog.querySelector('input[name="cl-quantity"]'); setQuantity(input, (Number(input.value) || 1) + Number(qtyButton.dataset.clQty)); return; }
      if (event.target.closest('[data-cl-retry-image]')) {
        const picture = productDialog.querySelector('.cl-product-picture');
        const source = picture.getAttribute('src');
        setImageStatus('loading');
        picture.removeAttribute('src');
        picture.src = source;
        return;
      }
      const view = event.target.closest('[data-cl-view]');
      if (view) { setProductView(view.dataset.clView); return; }
      const zoom = event.target.closest('[data-cl-zoom]');
      if (zoom) {
        if (state.hoverZoom) return;
        const expanded = zoom.getAttribute('aria-pressed') !== 'true';
        if (expanded && event.detail > 0) setZoomOrigin(zoom, event.clientX, event.clientY);
        else if (expanded) zoom.style.setProperty('--zoom-x', '50%'), zoom.style.setProperty('--zoom-y', '42%');
        setZoom(zoom, expanded);
      }
      const collectionButton = event.target.closest('[data-cl-collection]');
      if (collectionButton && typeof state.config.onCollectionChange === 'function') {
        productDialog.close();
        state.config.onCollectionChange(state.products.get(state.current).collection);
      }
    });
    bagDialog.addEventListener('click', handleBagClick);
    document.addEventListener('click', (event) => {
      const bagTrigger = event.target.closest('[data-open-bag]');
      if (bagTrigger) { event.preventDefault(); openBag(bagTrigger); return; }
      const trigger = event.target.closest('[data-product-id]');
      if (trigger && !trigger.closest('.cl-dialog') && state.products.has(trigger.dataset.productId)) {
        event.preventDefault();
        openProduct(trigger.dataset.productId, trigger);
      }
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      loadBag(); updateCounts();
      if (bagDialog.open) renderBag();
    });
  }

  // Product window quantity: − n + stepper, kept between 1 and 99.
  function setQuantity(input, value) {
    const next = Math.min(99, Math.max(1, Math.round(value)));
    input.value = String(next);
    const group = input.closest('.cl-qty');
    group.querySelector('[data-cl-qty="-1"]').disabled = next <= 1;
    group.querySelector('[data-cl-qty="1"]').disabled = next >= 99;
  }

  function showDialog(dialog, trigger) {
    if (!productDialog.open && !bagDialog.open) state.returnFocus = trigger || document.activeElement;
    if (productDialog.open && dialog !== productDialog) productDialog.close();
    if (bagDialog.open && dialog !== bagDialog) bagDialog.close();
    document.documentElement.classList.add('cl-dialog-open');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-cl-heading]')?.focus({ preventScroll: true });
  }

  function openProduct(id, trigger, selectedItem) {
    const product = state.products.get(String(id));
    if (!state.ready || !product) return false;
    state.current = product.id;
    state.view = 'front';
    state.color = product.colors.some((color) => color.id === selectedItem?.color) ? selectedItem.color : product.colors[0].id;
    const colors = product.colors.map((color) => `<label class="cl-color-option"><input type="radio" name="cl-color" value="${escape(color.id)}" ${color.id === state.color ? 'checked' : ''}><span>${escape(color.label)}</span></label>`).join('');
    const sizes = product.sizes.map((size) => `<label class="cl-size-option"><input type="radio" name="cl-size" value="${escape(size)}" ${selectedItem?.size === size ? 'checked' : ''}><span>${escape(size)}</span></label>`).join('');
    productDialog.querySelector('.cl-product-shell').innerHTML = `
      <button type="button" class="cl-icon-button cl-product-close" data-cl-close aria-label="Close product">${closeIcon}</button>
      <div class="cl-product-stage">
        <div class="cl-photo-panel">
          <div class="cl-image-status" role="status" data-cl-image-status hidden><span data-cl-image-message>Loading garment…</span><button type="button" data-cl-retry-image hidden>Retry image</button></div>
          <button type="button" class="cl-product-zoom" data-cl-zoom aria-label="Zoom into the front of the tee" aria-pressed="false"><img class="cl-product-picture" src="${escape(imageFor(product, state.color))}" alt="${escape(product.name)}, ${escape(colorFor(product, state.color))}, front" width="1122" height="1402" decoding="async" draggable="false"><span class="cl-zoom-label" data-cl-zoom-label aria-hidden="true"><span class="cl-zoom-hint-hover">Hover to zoom</span><span class="cl-zoom-hint-touch">Tap to zoom</span></span></button>
        </div>
        ${product.backImage ? '<div class="cl-view-controls cl-photo-views" role="group" aria-label="Tee side"><button type="button" data-cl-view="front" aria-pressed="true">Front</button><button type="button" data-cl-view="back" aria-pressed="false">Back</button></div>' : ''}
      </div>
      <div class="cl-product-content">
        ${typeof state.config.onCollectionChange === 'function' ? `<button class="cl-collection-link" type="button" data-cl-collection>${escape(collectionName(product))}</button>` : `<p class="cl-collection-label">${escape(collectionName(product))}</p>`}
        <h2 id="cl-product-title" tabindex="-1" data-cl-heading>${escape(product.name)}</h2>
        <p class="cl-price">${escape(priceText(product))}</p>
        <p class="cl-description">${escape(product.description || 'A familiar character. A completely different attitude. Make this oversized tee part of your rotation.')}</p>
        <form class="cl-product-form" novalidate>
          <fieldset class="cl-fieldset"><legend>Pictured color <span class="cl-selected-color" data-cl-current-color>${escape(colorFor(product, state.color))}</span></legend><div class="cl-color-options">${colors}</div></fieldset>
          <fieldset class="cl-fieldset" aria-describedby="cl-size-note cl-size-error"><legend>${product.sizesConfirmed ? 'Size' : 'Preferred size'}</legend><div class="cl-size-options">${sizes}</div><p id="cl-size-error" class="cl-form-error" data-cl-size-error hidden>Please choose your preferred size.</p><p id="cl-size-note" class="cl-field-note">${product.sizesConfirmed ? 'Choose a size for your selection.' : 'Preference only. Available sizes and garment measurements are not confirmed.'}</p><details class="cl-size-guidance"><summary>Fit &amp; Size Guidance</summary><img class="cl-size-chart" src="assets/Size%20chart.png" alt="Oversized T-shirt size chart in inches. S: chest width 23.5, length 26. M: chest width 25, length 27. L: chest width 26.5, length 28. XL: chest width 28, length 29. Chest width is measured flat, armpit to armpit." width="1122" height="1402" loading="lazy" decoding="async"></details></fieldset>
          <div class="cl-add-row"><div class="cl-qty-field"><span class="cl-qty-label" id="cl-qty-label">Quantity</span><div class="cl-qty" role="group" aria-labelledby="cl-qty-label"><button type="button" data-cl-qty="-1" aria-label="Decrease quantity" disabled>−</button><input type="number" name="cl-quantity" min="1" max="99" step="1" inputmode="numeric" value="1" required aria-label="Quantity"><button type="button" data-cl-qty="1" aria-label="Increase quantity">+</button></div></div><button class="cl-button cl-button-primary" type="submit">Add to laundry basket ${arrowIcon}</button></div>
        </form>
        <div class="cl-sr-only" data-cl-live aria-live="polite" aria-atomic="true"></div>
      </div>`;
    bindProductImage();
    showDialog(productDialog, trigger);
    return true;
  }

  const ZOOM_SCALE = 2.4;
  function zoomLabelFor(expanded) {
    const side = state.view === 'back' ? 'back' : 'front';
    return expanded ? 'Zoom out' : `Zoom into the ${side} of the tee`;
  }
  function setZoom(zoom, expanded) {
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.setAttribute('aria-label', zoomLabelFor(expanded));
    zoom.classList.toggle('is-zoomed', expanded);
  }
  function setZoomOrigin(zoom, clientX, clientY) {
    const picture = zoom.querySelector('.cl-product-picture');
    const box = picture.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - box.top) / box.height) * 100));
    zoom.style.setProperty('--zoom-x', `${x}%`);
    zoom.style.setProperty('--zoom-y', `${y}%`);
  }
  function bindZoom() {
    const zoom = productDialog.querySelector('[data-cl-zoom]');
    if (!zoom) return;
    zoom.style.setProperty('--zoom-scale', String(ZOOM_SCALE));
    // Mouse and pen: zoom while the cursor is over the tee, following the cursor.
    zoom.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch' || zoom.disabled) return;
      state.hoverZoom = true;
      setZoomOrigin(zoom, event.clientX, event.clientY);
      setZoom(zoom, true);
    });
    zoom.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') {
        if (zoom.classList.contains('is-zoomed')) setZoomOrigin(zoom, event.clientX, event.clientY);
        return;
      }
      if (!state.hoverZoom) { state.hoverZoom = true; setZoom(zoom, true); }
      setZoomOrigin(zoom, event.clientX, event.clientY);
    });
    zoom.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      state.hoverZoom = false;
      setZoom(zoom, false);
    });
    // Touch: a tap toggles zoom at that point (handled by click); while zoomed, dragging pans instead of scrolling.
    zoom.addEventListener('touchmove', (event) => { if (zoom.classList.contains('is-zoomed')) event.preventDefault(); }, { passive: false });
    zoom.addEventListener('keydown', (event) => { if (event.key === 'Escape' && zoom.classList.contains('is-zoomed')) { event.preventDefault(); event.stopPropagation(); setZoom(zoom, false); } });
  }

  function setImageStatus(status) {
    const container = productDialog.querySelector('[data-cl-image-status]');
    const picture = productDialog.querySelector('.cl-product-picture');
    const zoom = productDialog.querySelector('[data-cl-zoom]');
    if (!container || !picture || !zoom) return;
    container.hidden = status === 'ready';
    container.querySelector('[data-cl-image-message]').textContent = status === 'error' ? 'This garment image could not load.' : 'Loading garment…';
    container.querySelector('[data-cl-retry-image]').hidden = status !== 'error';
    picture.style.visibility = status === 'error' ? 'hidden' : '';
    zoom.disabled = status === 'error';
    zoom.setAttribute('aria-busy', String(status === 'loading'));
  }

  function bindProductImage() {
    state.hoverZoom = false;
    bindZoom();
    const picture = productDialog.querySelector('.cl-product-picture');
    picture.addEventListener('load', () => setImageStatus('ready'));
    picture.addEventListener('error', () => setImageStatus('error'));
    setImageStatus(picture.complete ? (picture.naturalWidth ? 'ready' : 'error') : 'loading');
  }

  function setProductView(view) {
    const product = state.products.get(state.current);
    if (!product) return;
    state.view = view === 'back' && product.backImage ? 'back' : 'front';
    const isBack = state.view === 'back';
    const picture = productDialog.querySelector('.cl-product-picture');
    setImageStatus('loading');
    picture.src = isBack ? backFor(product, state.color) : imageFor(product, state.color);
    picture.alt = isBack ? `${colorFor(product, state.color)} tee back reference, shared across this color` : `${product.name}, ${colorFor(product, state.color)}, front`;
    productDialog.querySelectorAll('[data-cl-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.clView === state.view)));
    const zoom = productDialog.querySelector('[data-cl-zoom]');
    state.hoverZoom = false;
    setZoom(zoom, false);
    picture.getAnimations?.().forEach((animation) => animation.cancel());
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !window.CosmicMotion?.paused) {
      picture.animate?.([{ opacity: .3 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    }
  }

  function addSelection(event) {
    event.preventDefault();
    const product = state.products.get(state.current);
    if (!product) return;
    const data = new FormData(event.target);
    const size = data.get('cl-size');
    if (!product.sizes.includes(size)) {
      const error = productDialog.querySelector('[data-cl-size-error]');
      error.hidden = false;
      productDialog.querySelector('[name="cl-size"]')?.focus();
      announce('Please choose your preferred size.');
      return;
    }
    const quantityInput = productDialog.querySelector('[name="cl-quantity"]');
    if (!quantityInput.reportValidity()) return;
    const item = { id: product.id, size, color: state.color, quantity: Math.min(99, Math.max(1, Math.floor(Number(data.get('cl-quantity')) || 1))) };
    const existing = state.bag.find((entry) => itemKey(entry) === itemKey(item));
    if (existing) existing.quantity = Math.min(99, existing.quantity + item.quantity);
    else state.bag.push(item);
    state.removed = null;
    syncBag();
    openBag();
    const note = bagDialog.querySelector('[data-cl-bag-status]');
    note.textContent = `${product.name} added to your laundry basket.`;
    announce(`${product.name} added to your laundry basket. ${count()} ${count() === 1 ? 'item' : 'items'} in your laundry basket.`);
  }

  function renderBag() {
    const items = state.bag.map((item) => {
      const product = state.products.get(item.id);
      const key = escape(itemKey(item));
      return `<li class="cl-bag-item">
        <button class="cl-bag-picture" type="button" data-cl-edit="${escape(item.id)}" data-cl-key="${key}" aria-label="View ${escape(product.name)}"><img src="${escape(imageFor(product, item.color))}" alt="" width="208" height="260" decoding="async" loading="lazy"></button>
        <div class="cl-bag-item-content"><div class="cl-bag-item-heading"><h3>${escape(product.name)}</h3><button type="button" class="cl-remove" data-cl-action="remove" data-cl-key="${key}" aria-label="Remove ${escape(product.name)}, ${escape(item.size)}, ${escape(colorFor(product, item.color))}">Remove</button></div>
          <p class="cl-bag-variant">${escape(colorFor(product, item.color))} <span aria-hidden="true">/</span> Preferred size ${escape(item.size)}</p>
          <p class="cl-bag-item-price">${escape(priceText(product))}</p>
          <div class="cl-stepper" aria-label="Quantity for ${escape(product.name)}"><button type="button" data-cl-action="decrease" data-cl-key="${key}" aria-label="Decrease ${escape(product.name)} quantity" ${item.quantity === 1 ? 'disabled' : ''}>−</button><span aria-label="Quantity ${item.quantity}">${item.quantity}</span><button type="button" data-cl-action="increase" data-cl-key="${key}" aria-label="Increase ${escape(product.name)} quantity" ${item.quantity >= 99 ? 'disabled' : ''}>+</button></div>
        </div></li>`;
    }).join('');
    bagDialog.querySelector('.cl-bag-shell').innerHTML = `
      <header class="cl-bag-header"><h2 id="cl-bag-title" tabindex="-1" data-cl-heading>Laundry Basket <span>${count()}</span></h2><button type="button" class="cl-icon-button" data-cl-close aria-label="Close laundry basket">${closeIcon}</button></header>
      <p class="cl-bag-status" data-cl-bag-status role="status"></p>
      ${state.removed ? `<div class="cl-undo-row"><span>${escape(state.products.get(state.removed.id).name)} removed</span><button type="button" data-cl-undo>Undo</button></div>` : ''}
      ${state.bag.length ? `<ul class="cl-bag-items">${items}</ul><footer class="cl-bag-footer"><div class="cl-bag-summary"><span>${count()} ${count() === 1 ? 'piece' : 'pieces'} selected</span><span>${basketTotal() === null ? 'Pricing to be confirmed' : `Total ${formatLKR(basketTotal())}`}</span></div><p class="cl-checkout-note" id="cl-checkout-reason">Send your laundry basket to us on WhatsApp. We’ll confirm price, size and delivery with you there.</p><a class="cl-button cl-button-primary cl-button-whatsapp cl-full-width" href="${escape(whatsappUrl())}" target="_blank" rel="noopener" aria-describedby="cl-checkout-reason" data-cl-whatsapp>${whatsappIcon}<span>Get Your Laundry</span>${arrowIcon}</a><button type="button" class="cl-button cl-button-secondary cl-full-width" data-cl-close>Keep exploring</button><p class="cl-storage-note">${state.persist ? 'Your laundry basket is saved on this device.' : 'Your browser could not save this laundry basket. Keep this tab open.'}</p></footer>` : `<div class="cl-empty-bag">${bagIcon}<h3>Room for a new favorite.</h3><p>Explore the Laundries and save your favourite designs here.</p><button type="button" class="cl-button cl-button-primary" data-cl-close>Explore the Laundries ${arrowIcon}</button></div>`}
      <div class="cl-sr-only" data-cl-live aria-live="polite" aria-atomic="true"></div>`;
  }

  function openBag(trigger) {
    if (!state.ready) return;
    renderBag();
    showDialog(bagDialog, trigger);
  }

  const WHATSAPP_NUMBER = '94761318353'; // +94 76 131 8353
  function selectionText() {
    const lines = ['Hi Cosmic Laundry! I’d like to get my laundry:', ''];
    state.bag.forEach((item, index) => {
      const product = state.products.get(item.id);
      lines.push(`${index + 1}. ${product.name} (${collectionName(product)})`, `   ${colorFor(product, item.color)} · Size ${item.size} · Qty ${item.quantity} · ${priceText(product)}`);
    });
    const total = basketTotal();
    lines.push('', `Total: ${count()} ${count() === 1 ? 'piece' : 'pieces'}${total === null ? '' : ` · ${formatLKR(total)}`}`);
    return lines.join('\n');
  }
  function whatsappUrl() {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(selectionText())}`;
  }

  async function handleBagClick(event) {
    if (event.target.closest('[data-cl-undo]') && state.removed) {
      const restored = { ...state.removed };
      state.removed = null;
      const existing = state.bag.find((item) => itemKey(item) === itemKey(restored));
      if (existing) existing.quantity = Math.min(99, existing.quantity + restored.quantity);
      else state.bag.push(restored);
      syncBag(); renderBag();
      bagDialog.querySelector('[data-cl-heading]')?.focus({ preventScroll: true });
      announce(`${state.products.get(restored.id).name} restored to your laundry basket.`);
      return;
    }
    const editButton = event.target.closest('[data-cl-edit]');
    if (editButton) { openProduct(editButton.dataset.clEdit, null, state.bag.find((item) => itemKey(item) === editButton.dataset.clKey)); return; }
    const actionButton = event.target.closest('[data-cl-action]');
    if (actionButton) {
      const key = actionButton.dataset.clKey;
      const action = actionButton.dataset.clAction;
      const index = state.bag.findIndex((entry) => itemKey(entry) === key);
      if (index === -1) return;
      const item = state.bag[index];
      const name = state.products.get(item.id).name;
      if (action === 'remove') { state.removed = { ...item }; state.bag.splice(index, 1); announce(`${name} removed from your laundry basket. Undo is available.`); }
      else if (action === 'increase') { item.quantity = Math.min(99, item.quantity + 1); announce(`${name}, quantity ${item.quantity}.`); }
      else if (action === 'decrease') { item.quantity = Math.max(1, item.quantity - 1); announce(`${name}, quantity ${item.quantity}.`); }
      syncBag(); renderBag();
      const replacement = [...bagDialog.querySelectorAll('[data-cl-action]')].find((button) => button.dataset.clKey === key && button.dataset.clAction === action && !button.disabled);
      const fallback = bagDialog.querySelectorAll('[data-cl-action="remove"]')[Math.min(index, state.bag.length - 1)] || bagDialog.querySelector('[data-cl-close]');
      (replacement || fallback)?.focus({ preventScroll: true });
      return;
    }

  }

  function init(config) {
    state.config = config || {};
    state.products = new Map((state.config.products || []).filter((product) => product?.id && product?.name && product?.image).map((product) => { const normalized = normalizeProduct(product); return [normalized.id, normalized]; }));
    if (!state.ready) { createDialogs(); state.ready = true; }
    loadBag(); updateCounts();
    return api;
  }

  const api = { init, openProduct, openBag, getBag, close: () => { productDialog?.close(); bagDialog?.close(); } };
  window.CosmicCommerce = api;
})();
