'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { saveLaundryForm } from '@/lib/admin/actions';
import { slugify } from '@/lib/admin/slug';

export type LaundryFormValues = {
  id: string;
  name: string;
  short_name: string;
  tagline: string;
  description: string;
  featured_product_id: string;
  sort_order: string;
  is_active: boolean;
  show_on_home: boolean;
};


export function LaundryForm({ isNew, values, tees }: {
  isNew: boolean;
  values: LaundryFormValues;
  tees: { id: string; name: string; is_active: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(saveLaundryForm, null);
  const [name, setName] = useState(values.name);
  const [shortName, setShortName] = useState(values.short_name);
  const [shortTouched, setShortTouched] = useState(!isNew);
  const fe = state?.fieldErrors ?? {};
  const invalid = (key: string) => (fe[key] ? ' invalid' : '');

  function onName(value: string) {
    setName(value);
    const short = value.replace(/[’']s\s+laundry$/i, '').replace(/\s+laundry$/i, '').trim();
    if (!shortTouched) setShortName(short);
  }

  // Submitted by hand so React doesn't clear what was typed when the server reports a mistake.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="a-form" noValidate>
      <input type="hidden" name="is_new" value={isNew ? '1' : '0'} />
      {!isNew && <input type="hidden" name="id" value={values.id} />}
      <div className="a-two">
        <section className="a-card a-form">
          <h2 className="a-h2" style={{ margin: 0 }}>Details</h2>
          <div className="a-row">
            <label className={`a-field${invalid('name')}`}>
              <span>Name</span>
              <input name="name" value={name} onChange={(e) => onName(e.target.value)} placeholder="One Piece Laundry" maxLength={80} required />
              {fe.name && <span className="a-error-text">{fe.name}</span>}
            </label>
            <label className={`a-field${invalid('short_name')}`}>
              <span>Short name (menus and filters)</span>
              <input name="short_name" value={shortName} placeholder="One Piece" maxLength={40} required
                onChange={(e) => { setShortTouched(true); setShortName(e.target.value); }} />
              {fe.short_name && <span className="a-error-text">{fe.short_name}</span>}
            </label>
          </div>
          {isNew && name.trim() && (
            <p className="a-hint" style={{ margin: 0 }}>Its link will be /laundries/{slugify(name, { dropLaundry: true }) || 'laundry'}</p>
          )}
          <label className="a-field">
            <span>Tagline</span>
            <input name="tagline" defaultValue={values.tagline} maxLength={120} placeholder="A short line under the name" />
          </label>
          <label className="a-field">
            <span>Description</span>
            <textarea name="description" defaultValue={values.description} maxLength={1000} rows={3} />
          </label>
        </section>

        <section className="a-card a-form">
          <h2 className="a-h2" style={{ margin: 0 }}>On the shop</h2>
          <label className="a-check">
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
            Show this Laundry on the shop
          </label>
          <label className="a-check">
            <input type="checkbox" name="show_on_home" defaultChecked={values.show_on_home} />
            Include its tees in the home page strip
          </label>
          <label className={`a-field${invalid('featured_product_id')}`}>
            <span>Featured tee</span>
            <select name="featured_product_id" defaultValue={values.featured_product_id} disabled={isNew || tees.length === 0}>
              <option value="">{tees.length ? 'First tee in the Laundry' : 'Add tees first'}</option>
              {tees.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_active ? '' : ' (hidden)'}</option>)}
            </select>
            <span className="a-hint">Shown on the Laundry’s card and at the top of its page.</span>
            {fe.featured_product_id && <span className="a-error-text">{fe.featured_product_id}</span>}
          </label>
          <label className={`a-field${invalid('sort_order')}`}>
            <span>Position in the menu</span>
            <input name="sort_order" type="number" min={0} step={1} defaultValue={values.sort_order} placeholder={isNew ? 'Last' : ''} />
            <span className="a-hint">Lower numbers come first. The Laundries list shows the current numbers.</span>
            {fe.sort_order && <span className="a-error-text">{fe.sort_order}</span>}
          </label>
        </section>
      </div>

      {state?.error && <p className="a-notice error" role="alert">{state.error}</p>}
      {state?.ok && <p className="a-notice ok" role="status">{state.ok}</p>}
      <div className="a-actions">
        <button className="a-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : isNew ? 'Create Laundry' : 'Save changes'}</button>
      </div>
    </form>
  );
}
