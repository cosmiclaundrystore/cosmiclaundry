import 'server-only';
import { randomUUID } from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import { adminSupabase, storageSignedUrl, storageUpload } from '@/lib/supabase/rest';

// Customer designs for the Custom tee. Stored privately in Supabase Storage (bucket "custom-designs"), never in the
// database; order lines keep only the file path. See supabase/migrations/*_custom_designs.sql.

export const DESIGN_BUCKET = 'custom-designs';
export const DESIGN_MAX_BYTES = 5 * 1024 * 1024;
export const DESIGN_NOTE_MAX = 500;
/** Products that need a design: the made-to-order tees in the Custom Laundry. */
export const CUSTOM_COLLECTION = 'custom';
/** A design id is the stored file name: <uuid>.png or <uuid>.webp */
export const DESIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$/;
export const designPath = (id: string) => `pending/${id}`;

export class DesignError extends Error {}

/**
 * Checks the upload really is an image, keeps it print-ready (up to 4000px, transparency kept) and stores it.
 * PNG when that fits in 5 MB, otherwise high-quality WebP. Returns the design id.
 */
export async function storeDesign(file: File): Promise<string> {
  const target = adminSupabase();
  if (!target) throw new DesignError('Design uploads are not set up yet.');
  if (file.size === 0) throw new DesignError('That file is empty.');
  if (file.size > DESIGN_MAX_BYTES) throw new DesignError('Designs must be under 5 MB.');

  let image: Sharp;
  try {
    image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000 }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height || !['png', 'jpeg', 'webp'].includes(meta.format ?? '')) throw new Error('format');
    if (meta.width < 300 || meta.height < 300) throw new DesignError('That image is too small to print well. Use one at least 1000 pixels wide.');
  } catch (error) {
    if (error instanceof DesignError) throw error;
    throw new DesignError('That file isn’t an image we can use. Upload a PNG, JPG or WebP.');
  }

  const resized = image.resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true });
  let body = await resized.clone().png({ compressionLevel: 9 }).toBuffer();
  let ext: 'png' | 'webp' = 'png';
  if (body.length > DESIGN_MAX_BYTES) {
    body = await resized.clone().webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    ext = 'webp';
  }
  if (body.length > DESIGN_MAX_BYTES) throw new DesignError('That design is too detailed to store. Try a smaller image.');

  const id = `${randomUUID()}.${ext}`;
  await storageUpload(target, DESIGN_BUCKET, designPath(id), body, ext === 'png' ? 'image/png' : 'image/webp');
  return id;
}

/** True when the design was uploaded (used at checkout so an order can't point at a missing file). */
export async function designExists(id: string): Promise<boolean> {
  const target = adminSupabase();
  if (!target || !DESIGN_ID.test(id)) return false;
  return (await storageSignedUrl(target, DESIGN_BUCKET, designPath(id), 60)) !== null;
}
