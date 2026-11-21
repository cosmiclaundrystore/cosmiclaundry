'use client';

import { useEffect, useRef, useState } from 'react';
import type { Quote } from '@/lib/checkout/pricing';
import {
  BASKET_STORAGE_KEY,
  PHONE_HINT,
  COLORS,
  REGION_COUNTRY,
  SIZES,
  formatMoney,
  parseBasket,
  validateCustomer,
  type BasketItem,
  type CustomerField,
  type FieldErrors,
  type RegionCode,
} from '@/lib/checkout/shared';
import { OrderSummary } from './order-summary';

type Form = Record<Exclude<CustomerField, 'acceptTerms'>, string> & { acceptTerms: boolean };
const EMPTY_FORM: Form = { email: '', phone: '', firstName: '', lastName: '', addressLine1: '', addressLine2: '', city: '', postcode: '', notes: '', acceptTerms: false };
const FIELD_ORDER: CustomerField[] = ['email', 'phone', 'firstName', 'lastName', 'addressLine1', 'addressLine2', 'city', 'postcode', 'notes', 'acceptTerms'];
const DRAFT_KEY = 'cosmic-laundry:checkout-draft:v1';
const NOTICE_KEY = 'cosmic-laundry:checkout-notice';

/** The shopping region changed after this page opened (another tab, the switcher): start again in the new region. */
function restartForNewRegion(message: string) {
  try { sessionStorage.setItem(NOTICE_KEY, message); } catch { /* ignore */ }
  window.location.reload();
}

type Status =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; quote: Quote };

function readBasket(): BasketItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BASKET_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    // Keep only lines the server can read (old 'pictured' colours etc. are dropped), then merge duplicates.
    const usable = raw.filter((i) => i && typeof i === 'object' && i.color in COLORS && (SIZES as readonly string[]).includes(i.size));
    return parseBasket(usable) ?? [];
  } catch {
    return [];
  }
}

function writeBasket(items: BasketItem[]) {
  try { localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
}

const arrowIcon = <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg>;

export function CheckoutForm({ cancelledOrder, region }: { cancelledOrder: string | null; region: RegionCode }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(cancelledOrder ? 'Payment cancelled. Your laundry basket is still here whenever you are ready.' : null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const country = REGION_COUNTRY[region];

  async function loadQuote(items: BasketItem[]) {
    if (!items.length) { setStatus({ kind: 'empty' }); return; }
    try {
      const response = await fetch('/api/checkout/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items, region }) });
      const data = await response.json();
      if (data.error === 'region_changed') { restartForNewRegion(data.message); return; }
      if (!response.ok) throw new Error(data.message || 'We could not load your laundry basket.');
      applyQuote(data.quote as Quote, items);
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'We could not load your laundry basket.' });
    }
  }

  /** Shows the quote; tees that can no longer be sold are removed from the saved basket too. */
  function applyQuote(quote: Quote, items: BasketItem[]) {
    if (quote.problems.length) {
      const gone = new Set(quote.problems.map((p) => `${p.id}|${p.color}|${p.size}`));
      const kept = items.filter((i) => !gone.has(`${i.id}|${i.color}|${i.size}`));
      writeBasket(kept);
      setBasket(kept);
      setNotice(`${quote.problems.length === 1 ? 'One tee is' : `${quote.problems.length} tees are`} no longer available and ${quote.problems.length === 1 ? 'was' : 'were'} removed from your basket.`);
      if (!kept.length) { setStatus({ kind: 'empty' }); return; }
    }
    setStatus({ kind: 'ready', quote });
  }

  useEffect(() => {
    const items = readBasket();
    setBasket(items);
    try {
      const saved = sessionStorage.getItem(NOTICE_KEY);
      if (saved) { sessionStorage.removeItem(NOTICE_KEY); setNotice(saved); }
    } catch { /* ignore */ }
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (draft && typeof draft === 'object') setForm({ ...EMPTY_FORM, ...draft, acceptTerms: false });
    } catch { /* no draft */ }
    loadQuote(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      try { const { acceptTerms: _ignored, ...draft } = next; sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
      return next;
    });
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || status.kind !== 'ready') return;
    setSubmitError(null);
    const { errors: fieldErrors, value } = validateCustomer(form, region);
    if (!value) { setErrors(fieldErrors); focusFirstError(fieldErrors); return; }

    setSubmitting(true);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: basket, customer: value, region, expectedTotalMinor: status.quote.totalMinor, expectedCurrency: status.quote.currency }) });
      const data = await response.json();
      if (response.ok && typeof data.redirectUrl === 'string') {
        window.location.assign(data.redirectUrl);
        return; // keep the button busy while the browser leaves
      }
      if (data.error === 'region_changed') { restartForNewRegion(data.message); return; }
      if (data.error === 'invalid_details') { setErrors(data.fieldErrors ?? {}); focusFirstError(data.fieldErrors ?? {}); }
      else if (data.error === 'basket_changed' && data.quote) { applyQuote(data.quote as Quote, basket); setSubmitError(data.message); }
      else setSubmitError(data.message || 'We could not start your payment. Please try again.');
    } catch {
      setSubmitError('We could not reach the server. Check your connection and try again.');
    }
    setSubmitting(false);
  }

  if (status.kind === 'loading') {
    return <div className="co-state" role="status"><p>Loading your laundry basket…</p></div>;
  }
  if (status.kind === 'empty') {
    return (
      <div className="co-state">
        {notice ? <p className="co-notice" role="status">{notice}</p> : null}
        <h1>Your laundry basket is empty.</h1>
        <p>Explore the Laundries and save your favourite designs.</p>
        <a className="cl-button cl-button-primary" href="/laundries">Explore the Laundries {arrowIcon}</a>
      </div>
    );
  }
  if (status.kind === 'error') {
    return (
      <div className="co-state" role="alert">
        <h1>Checkout is unavailable right now.</h1>
        <p>{status.message}</p>
        <button type="button" className="cl-button cl-button-primary" onClick={() => { setStatus({ kind: 'loading' }); loadQuote(basket); }}>Try again {arrowIcon}</button>
      </div>
    );
  }

  const { quote } = status;
  const field = (name: Exclude<CustomerField, 'acceptTerms' | 'notes'>, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={`co-field${errors[name] ? ' has-error' : ''}`}>
      <label htmlFor={`co-${name}`}>{label}{props.required === false ? <span> (optional)</span> : null}</label>
      <input
        id={`co-${name}`}
        name={name}
        value={form[name]}
        onChange={(e) => update(name, e.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `co-${name}-error` : undefined}
        {...props}
        required={props.required !== false}
      />
      {errors[name] ? <p id={`co-${name}-error`} className="cl-form-error">{errors[name]}</p> : null}
    </div>
  );

  return (
    <div className="co-layout">
      <div className="co-main">
        <a className="breadcrumb co-back" href="/" onClick={(e) => { e.preventDefault(); history.length > 1 ? history.back() : location.assign('/'); }}>
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5" /></svg> Back to the shop
        </a>
        <h1 className="co-title">Checkout</h1>
        {notice ? <p className="co-notice" role="status">{notice}</p> : null}

        <details className="co-mobile-summary">
          <summary><span>Order summary</span><strong>{formatMoney(quote.totalMinor, quote.currency)}</strong></summary>
          <Summary quote={quote} />
        </details>

        <form ref={formRef} className="co-form" onSubmit={submit} noValidate>
          <fieldset className="co-section">
            <legend>Contact</legend>
            <div className="co-grid">
              {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email', placeholder: 'you@example.com' })}
              {field('phone', 'Mobile number', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: PHONE_HINT[region].placeholder })}
            </div>
            <p className="co-hint">We’ll send your order confirmation here, and the courier may call before delivery.</p>
          </fieldset>

          <fieldset className="co-section">
            <legend>Delivery</legend>
            <div className="co-grid">
              {field('firstName', 'First name', { autoComplete: 'given-name' })}
              {field('lastName', 'Last name', { autoComplete: 'family-name' })}
              <div className="co-span">{field('addressLine1', 'Street address', { autoComplete: 'address-line1' })}</div>
              <div className="co-span">{field('addressLine2', 'Apartment, suite or landmark', { autoComplete: 'address-line2', required: false })}</div>
              {field('city', 'City or town', { autoComplete: 'address-level2' })}
              {field('postcode', region === 'US' ? 'ZIP code' : region === 'UK' ? 'Postcode' : 'Postal code', { autoComplete: 'postal-code', inputMode: region === 'UK' ? 'text' : 'numeric' })}
              <div className="co-field co-span">
                <span className="co-label">Country</span>
                <p className="co-static">{country.name}<span>We deliver within {region === 'LK' ? '' : 'the '}{country.name} for now. To shop from another country, change the region on the shop.</span></p>
              </div>
              <div className="co-field co-span">
                <label htmlFor="co-notes">Delivery notes <span>(optional)</span></label>
                <textarea id="co-notes" name="notes" rows={3} maxLength={300} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="co-section">
            <legend>Payment</legend>
            <p className="co-pay-note">
              After you continue, you’ll pay securely with your Visa or Mastercard on PAYable’s payment page.
              Your bank may ask you to confirm with a one-time code. Card details never touch our site.
            </p>
            <div className={`co-check${errors.acceptTerms ? ' has-error' : ''}`}>
              <input id="co-acceptTerms" name="acceptTerms" type="checkbox" checked={form.acceptTerms} onChange={(e) => update('acceptTerms', e.target.checked)} aria-invalid={errors.acceptTerms ? true : undefined} aria-describedby={errors.acceptTerms ? 'co-acceptTerms-error' : undefined} />
              <label htmlFor="co-acceptTerms">I agree to the terms of sale and the refund &amp; exchange policy.</label>
            </div>
            {errors.acceptTerms ? <p id="co-acceptTerms-error" className="cl-form-error">{errors.acceptTerms}</p> : null}
          </fieldset>

          {submitError ? <p className="co-submit-error" role="alert">{submitError}</p> : null}
          <button type="submit" className="cl-button cl-button-primary co-pay" disabled={submitting} aria-busy={submitting}>
            <span>{submitting ? 'Taking you to payment…' : `Pay ${formatMoney(quote.totalMinor, quote.currency)}`}</span>
            {arrowIcon}
          </button>
          <p className="co-hint co-after-pay">Order on WhatsApp instead? <a href="/">Open your laundry basket</a> and choose WhatsApp.</p>
        </form>
      </div>

      <aside className="co-aside">
        <Summary quote={quote} />
      </aside>
    </div>
  );
}

function Summary({ quote }: { quote: Quote }) {
  return (
    <OrderSummary
      currency={quote.currency}
      subtotalMinor={quote.subtotalMinor}
      shippingMinor={quote.shippingMinor}
      shippingLabel={quote.shippingLabel}
      totalMinor={quote.totalMinor}
      lines={quote.lines.map((line) => ({
        key: `${line.id}|${line.color}|${line.size}|${line.design?.id ?? ''}`,
        name: line.name,
        detail: `${line.colorLabel} / Size ${line.size}${line.design ? ' · Your design' : ''}`,
        quantity: line.quantity,
        lineMinor: line.lineMinor,
        image: line.image,
      }))}
    />
  );
}
