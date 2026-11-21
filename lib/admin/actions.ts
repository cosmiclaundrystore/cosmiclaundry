'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, updateTag } from 'next/cache';
import { authClient, isAdminEmail, requireAdmin } from './auth';
import {
  createLaundry, getLaundry, LaundryExistsError, nextLaundrySortOrder, uniqueId, updateLaundry, type LaundryInput,
  FULFILLMENT_STATUSES, getOrder, getProduct, listCollections, ProductSaveError, REGIONS, saveProduct, setPaymentStatus,
  STOCK_COLORS, STOCK_SIZES, updateFulfillment, type FulfillmentStatus, type PaymentStatus, type SaveProductInput,
} from './data';
import { ImageError, uploadTeePhotos } from './images';
import { slugify } from './slug';

export type FormState = { ok?: string; error?: string; fieldErrors?: Record<string, string> } | null;

const text = (fd: FormData, key: string, max = 2000) => String(fd.get(key) ?? '').trim().slice(0, max);

// ---------- Sign in / out ----------

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'That email and password don’t match an account.' };
  if (!(await isAdminEmail(data.user.email))) {
    await supabase.auth.signOut();
    return { error: 'This account isn’t on the admin list.' };
  }
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ---------- Orders ----------

/** Payment status changes the admin may make, and which statuses each one may start from. */
const PAYMENT_CHANGES: Record<string, { to: PaymentStatus; from: PaymentStatus[]; done: string }> = {
  'mark-paid': { to: 'paid', from: ['pending', 'failed'], done: 'Marked as paid. Stock was updated.' },
  cancel: { to: 'cancelled', from: ['pending', 'failed'], done: 'Order cancelled.' },
  refund: { to: 'refunded', from: ['paid', 'fulfilled'], done: 'Marked as refunded. Remember to refund the payment in the PAYable portal.' },
};

export async function changePaymentStatus(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const number = text(fd, 'number', 40);
  const change = PAYMENT_CHANGES[text(fd, 'change', 20)];
  if (!change) return { error: 'Unknown change.' };
  const ok = await setPaymentStatus(number, change.to, change.from);
  revalidatePath(`/admin/orders/${number}`);
  return ok ? { ok: change.done } : { error: 'The order changed in the meantime. Reload and try again.' };
}

export async function saveFulfillment(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const number = text(fd, 'number', 40);
  const status = text(fd, 'fulfillment_status', 20) as FulfillmentStatus;
  if (!FULFILLMENT_STATUSES.includes(status)) return { error: 'Pick a delivery status.' };
  const order = await getOrder(number);
  if (!order) return { error: 'Order not found.' };
  if (status !== 'unfulfilled' && !['paid', 'fulfilled'].includes(order.status)) {
    return { error: 'Only paid orders can be packed or shipped.' };
  }
  const tracking = text(fd, 'tracking_number', 80) || null;
  if (status === 'shipped' && !tracking && !text(fd, 'courier', 60)) {
    return { fieldErrors: { tracking_number: 'Add the courier or a tracking number when marking it shipped.' } };
  }
  const ok = await updateFulfillment(
    number,
    { fulfillment_status: status, courier: text(fd, 'courier', 60) || null, tracking_number: tracking, admin_note: text(fd, 'admin_note', 1000) || null },
    order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered',
  );
  revalidatePath(`/admin/orders/${number}`);
  return ok ? { ok: 'Saved.' } : { error: 'Order not found.' };
}

// ---------- Products ----------

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function parseMoney(raw: string): number | null | 'invalid' {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return 'invalid';
  const minor = Math.round(Number(cleaned) * 100);
  return minor > 0 && minor < 100_000_000 ? minor : 'invalid';
}

export async function saveProductForm(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const isNew = fd.get('is_new') === '1';
  const errors: Record<string, string> = {};

  const name = text(fd, 'name', 120);
  if (!name) errors.name = 'Give the tee a name.';
  // New tees get their web id from the name; existing ones keep theirs.
  const id = isNew ? (name ? await uniqueId('products', slugify(name)) : '') : text(fd, 'id', 80);
  if (!isNew && !ID.test(id)) return { error: 'This tee no longer exists.' };
  const collectionId = text(fd, 'collection_id', 80);
  const collections = await listCollections();
  if (!collections.some((c) => c.id === collectionId)) errors.collection_id = 'Pick a Laundry.';
  const defaultColor = text(fd, 'default_color', 10);
  if (defaultColor !== 'black' && defaultColor !== 'white') errors.default_color = 'Pick black or white.';
  const sortOrder = Number(text(fd, 'sort_order', 10) || '0');
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) errors.sort_order = 'Use a whole number.';

  const prices: SaveProductInput['prices'] = {};
  for (const { code } of REGIONS) {
    const value = parseMoney(text(fd, `price_${code}`, 20));
    if (value === 'invalid') errors[`price_${code}`] = 'Use a number like 3500 or 29.99.';
    else prices[code] = value;
  }
  if (prices.LK == null) errors.price_LK = 'Sri Lanka needs a price (the shop shows LKR).';

  const stock: SaveProductInput['stock'] = {};
  for (const color of STOCK_COLORS) {
    stock[color] = {};
    for (const size of STOCK_SIZES) {
      const raw = text(fd, `stock_${color}_${size}`, 6);
      if (!raw) { stock[color][size] = null; continue; }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 99999) errors[`stock_${color}_${size}`] = 'Whole number';
      else stock[color][size] = n;
    }
  }

  const black = fd.get('photo_black');
  const white = fd.get('photo_white');
  const hasBlack = black instanceof File && black.size > 0;
  const hasWhite = white instanceof File && white.size > 0;
  if (hasBlack !== hasWhite) errors.photos = 'Upload both photos (black and white) together.';
  if (isNew && !hasBlack) errors.photos = 'A new tee needs both photos.';

  if (!isNew && !(await getProduct(id))) return { error: 'This tee no longer exists.' };
  if (Object.keys(errors).length) return { error: 'Check the highlighted fields.', fieldErrors: errors };

  let imageBase: string | undefined;
  if (hasBlack && hasWhite) {
    try {
      imageBase = await uploadTeePhotos(id, { black: black as File, white: white as File });
    } catch (error) {
      if (error instanceof ImageError) return { error: error.message, fieldErrors: { photos: error.message } };
      throw error;
    }
  }

  try {
    await saveProduct({
      id, is_new: isNew, collection_id: collectionId, name, description: text(fd, 'description', 1000),
      default_color: defaultColor as 'black' | 'white', sort_order: sortOrder, is_active: fd.get('is_active') === 'on',
      ...(imageBase ? { image_base: imageBase } : {}), prices, stock,
    });
  } catch (error) {
    if (error instanceof ProductSaveError && error.reason === 'product_exists') {
      return { error: 'Another tee was just saved with the same name. Save again.' };
    }
    throw error;
  }

  // The storefront picks this up on the next request instead of within a minute.
  updateTag('catalog');
  revalidatePath('/catalog.js');
  for (const region of ['LK', 'UK', 'US']) revalidatePath(`/catalog/${region}`);
  revalidatePath('/admin/products');
  if (isNew) redirect(`/admin/products/${id}?saved=1`);
  revalidatePath(`/admin/products/${id}`);
  return { ok: imageBase ? 'Saved, with the new photos. Live on the shop now.' : 'Saved. Live on the shop now.' };
}

// ---------- Laundries ----------

export async function saveLaundryForm(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const isNew = fd.get('is_new') === '1';
  const errors: Record<string, string> = {};

  const name = text(fd, 'name', 80);
  if (!name) errors.name = 'Give the Laundry a name, like "One Piece Laundry".';
  // New Laundries get their web id from the name; existing ones keep theirs.
  const id = isNew ? (name ? await uniqueId('collections', slugify(name, { dropLaundry: true })) : '') : text(fd, 'id', 80);
  if (!isNew && !ID.test(id)) return { error: 'This Laundry no longer exists.' };
  const shortName = text(fd, 'short_name', 40);
  if (!shortName) errors.short_name = 'A short name for menus and filters, like "One Piece".';
  const sortRaw = text(fd, 'sort_order', 10);
  const sortOrder = sortRaw ? Number(sortRaw) : isNew ? await nextLaundrySortOrder() : NaN;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) errors.sort_order = 'Use a whole number.';

  const existing = isNew ? null : await getLaundry(id);
  if (!isNew && !existing) return { error: 'This Laundry no longer exists.' };
  const featured = text(fd, 'featured_product_id', 80) || null;
  if (featured && !existing?.products.some((p) => p.id === featured)) errors.featured_product_id = 'Pick a tee from this Laundry.';

  if (Object.keys(errors).length) return { error: 'Check the highlighted fields.', fieldErrors: errors };

  const input: LaundryInput = {
    name,
    short_name: shortName,
    tagline: text(fd, 'tagline', 120),
    description: text(fd, 'description', 1000),
    featured_product_id: featured,
    sort_order: sortOrder,
    is_active: fd.get('is_active') === 'on',
    show_on_home: fd.get('show_on_home') === 'on',
  };

  if (isNew) {
    try {
      await createLaundry(id, input);
    } catch (error) {
      if (error instanceof LaundryExistsError) return { error: 'Another Laundry was just saved with the same name. Save again.' };
      throw error;
    }
  } else if (!(await updateLaundry(id, input))) {
    return { error: 'This Laundry no longer exists.' };
  }

  updateTag('catalog');
  revalidatePath('/catalog.js');
  for (const region of ['LK', 'UK', 'US']) revalidatePath(`/catalog/${region}`);
  revalidatePath('/admin/laundries');
  revalidatePath('/admin/products');
  if (isNew) redirect(`/admin/laundries/${id}?saved=1`);
  revalidatePath(`/admin/laundries/${id}`);
  return { ok: 'Saved. Live on the shop now.' };
}
