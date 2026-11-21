'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { saveProductForm } from '@/lib/admin/actions';

export type ProductFormValues = {
  id: string;
  name: string;
  description: string;
  collection_id: string;
  default_color: 'black' | 'white';
  sort_order: number;
  is_active: boolean;
  prices: Record<string, string>;
  stock: Record<string, Record<string, string>>;
  photos: { black: string | null; white: string | null };
};

const REGIONS = [
  { code: 'LK', label: 'Sri Lanka (LKR)', hint: 'e.g. 3499' },
  { code: 'UK', label: 'UK (GBP)', hint: 'e.g. 19.99' },
  { code: 'US', label: 'US (USD)', hint: 'e.g. 24.99' },
];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['black', 'white'] as const;

/** Shrinks a photo in the browser (max 2000px, WebP) so uploads stay small. Keeps transparency. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.95));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }) : file;
  } catch {
    return file;
  }
}

export function ProductForm({ isNew, values, collections }: {
  isNew: boolean;
  values: ProductFormValues;
  collections: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveProductForm, null);
  const [name, setName] = useState(values.name);
  const [photos, setPhotos] = useState<Record<string, File | null>>({ black: null, white: null });
  const [previews, setPreviews] = useState<Record<string, string | null>>(values.photos);
  const fe = state?.fieldErrors ?? {};
  const invalid = (key: string) => (fe[key] ? ' invalid' : '');

  async function pick(color: string, file: File | undefined) {
    if (!file) return;
    const small = await shrink(file);
    setPhotos((p) => ({ ...p, [color]: small }));
    setPreviews((p) => ({ ...p, [color]: URL.createObjectURL(small) }));
  }

  // Submitted by hand (not <form action>) so React doesn't clear what was typed when the server reports a mistake.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    // Send the shrunk photos instead of the originals.
    for (const color of COLORS) {
      fd.delete(`pick_${color}`);
      const file = photos[color];
      if (file) fd.set(`photo_${color}`, file);
    }
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={submit} className="a-form" noValidate>
      <input type="hidden" name="is_new" value={isNew ? '1' : '0'} />
      {!isNew && <input type="hidden" name="id" value={values.id} />}

      <div className="a-two">
        <div className="a-grid">
          <section className="a-card a-form">
            <h2 className="a-h2" style={{ margin: 0 }}>Details</h2>
            <label className={`a-field${invalid('name')}`}>
              <span>Name</span>
              <input name="name" value={name} required maxLength={120} onChange={(e) => setName(e.target.value)} />
              {fe.name && <span className="a-error-text">{fe.name}</span>}
            </label>

            <label className="a-field">
              <span>Description</span>
              <textarea name="description" defaultValue={values.description} maxLength={1000} rows={3} />
            </label>
            <div className="a-row">
              <label className={`a-field${invalid('collection_id')}`}>
                <span>Laundry</span>
                <select name="collection_id" defaultValue={values.collection_id} required>
                  <option value="" disabled>Pick a Laundry</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <a className="a-hint" href="/admin/laundries/new">+ New Laundry</a>
                {fe.collection_id && <span className="a-error-text">{fe.collection_id}</span>}
              </label>
              <label className="a-field">
                <span>Shown first</span>
                <select name="default_color" defaultValue={values.default_color}>
                  <option value="black">Black tee</option>
                  <option value="white">White tee</option>
                </select>
              </label>
              <label className={`a-field${invalid('sort_order')}`}>
                <span>Order in Laundry</span>
                <input name="sort_order" type="number" min={0} step={1} defaultValue={values.sort_order} />
                {fe.sort_order && <span className="a-error-text">{fe.sort_order}</span>}
              </label>
            </div>
            <label className="a-check">
              <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
              Show on the shop
            </label>
          </section>

          <section className="a-card a-form">
            <h2 className="a-h2" style={{ margin: 0 }}>Prices</h2>
            <div className="a-row">
              {REGIONS.map((r) => (
                <label key={r.code} className={`a-field${invalid(`price_${r.code}`)}`}>
                  <span>{r.label}</span>
                  <input name={`price_${r.code}`} inputMode="decimal" defaultValue={values.prices[r.code] ?? ''} placeholder={r.hint} />
                  {fe[`price_${r.code}`] && <span className="a-error-text">{fe[`price_${r.code}`]}</span>}
                </label>
              ))}
            </div>
            <p className="a-hint" style={{ margin: 0 }}>Visitors see the price for their region. Leave UK or US empty and the tee shows “Price to be confirmed” there and can’t be bought in that region.</p>
          </section>

          <section className="a-card a-form">
            <h2 className="a-h2" style={{ margin: 0 }}>Stock</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="a-stock">
                <thead><tr><th>Colour</th>{SIZES.map((s) => <th key={s}>{s}</th>)}</tr></thead>
                <tbody>
                  {COLORS.map((c) => (
                    <tr key={c}>
                      <td>{c}</td>
                      {SIZES.map((s) => (
                        <td key={s}>
                          <input name={`stock_${c}_${s}`} inputMode="numeric" defaultValue={values.stock[c]?.[s] ?? ''}
                            aria-label={`${c} ${s} stock`} className={fe[`stock_${c}_${s}`] ? 'invalid' : ''} placeholder="—" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="a-hint" style={{ margin: 0 }}>
              Leave a box empty to not track that size. Numbers go down automatically when an order is paid.
            </p>
          </section>
        </div>

        <section className="a-card a-form">
          <h2 className="a-h2" style={{ margin: 0 }}>Photos</h2>
          <div className="a-photos">
            {COLORS.map((c) => (
              <div className="a-photo" key={c}>
                {previews[c] ? <img src={previews[c]!} alt={`${c} tee`} /> : <div className="a-muted a-small" style={{ padding: '40px 0' }}>No photo yet</div>}
                <label className="a-btn ghost small" style={{ textTransform: 'capitalize' }}>
                  {previews[c] ? `Replace ${c}` : `Add ${c} tee`}
                  <input type="file" name={`pick_${c}`} accept="image/png,image/jpeg,image/webp" hidden
                    onChange={(e) => pick(c, e.target.files?.[0])} />
                </label>
              </div>
            ))}
          </div>
          {fe.photos && <p className="a-error-text" style={{ margin: 0 }}>{fe.photos}</p>}
          <p className="a-hint" style={{ margin: 0 }}>
            Upload the black and white tee together. Transparent PNGs work best; plain white backgrounds are removed
            automatically. Tees are resized to match the rest of the shop. For mockups with shadows or busy backgrounds, send them to Claude as a batch.
          </p>
        </section>
      </div>

      {state?.error && <p className="a-notice error" role="alert">{state.error}</p>}
      {state?.ok && <p className="a-notice ok" role="status">{state.ok}</p>}
      <div className="a-actions">
        <button className="a-btn" type="submit" disabled={pending}>{pending ? 'Saving…' : isNew ? 'Add tee' : 'Save changes'}</button>
      </div>
    </form>
  );
}
