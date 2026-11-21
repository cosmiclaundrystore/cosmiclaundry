import 'server-only';
import sharp from 'sharp';
import { storagePublicUrl, storageUpload } from '@/lib/supabase/rest';
import { db } from './data';

// Product photos uploaded in the admin, prepared like scripts/batch/prepare_tee_images.py:
// light backgrounds cut out (floor shadows and specks dropped), the white tee reuses the black tee's outline
// when the two mockups line up, the tee is fitted into the same box on the same canvas, WebP + 480px thumbnail.

const CANVAS = { width: 1122, height: 1402 };
const TEE_BOX = { left: 22, top: 106, right: 1083, bottom: 1279 };
const THUMB = { width: 480, height: 600 };
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 2400;
export const BUCKET = 'product-images';

export class ImageError extends Error {}

type Raw = { data: Buffer; width: number; height: number };

async function decode(file: File, color: string): Promise<Raw> {
  if (file.size === 0) throw new ImageError(`The ${color} photo is empty.`);
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('Photos must be under 15 MB.');
  try {
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ImageError(`The ${color} file is not a photo we can read. Use PNG, JPG or WebP.`);
  }
}

function hasTransparency({ data, width, height }: Raw): boolean {
  return [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].every(([x, y]) => data[(y * width + x) * 4 + 3] === 0);
}

/** Marks every passable pixel reachable from the seeds (4-connected). */
function flood(passable: Uint8Array, width: number, height: number, seeds: number[]): Uint8Array {
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (const i of seeds) if (passable[i] && !seen[i]) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const next = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i + width < width * height ? i + width : -1];
    for (const n of next) if (n >= 0 && passable[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
  }
  return seen;
}

/** 255 = tee, 0 = background. Light, low-colour pixels reachable from the border are background; then only the shape nearest the centre is kept. */
async function backgroundMask({ data, width, height }: Raw, lightThreshold: number): Promise<Uint8Array> {
  const n = width * height;
  const bgLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    bgLike[i] = luma >= lightThreshold && Math.max(r, g, b) - Math.min(r, g, b) <= 40 ? 1 : 0;
  }
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) border.push(y * width, y * width + width - 1);
  const background = flood(bgLike, width, height, border);

  const notBackground = new Uint8Array(n);
  let nearest = -1, best = Infinity;
  const cx = width >> 1, cy = height >> 1;
  for (let i = 0; i < n; i++) {
    if (background[i]) continue;
    notBackground[i] = 1;
    const dx = (i % width) - cx, dy = ((i / width) | 0) - cy;
    const d = dx * dx + dy * dy;
    if (d < best) { best = d; nearest = i; }
  }
  if (nearest < 0) throw new ImageError('No tee found in the photo.');
  const tee = flood(notBackground, width, height, [nearest]);
  for (let i = 0; i < n; i++) tee[i] = tee[i] ? 255 : 0;
  // Fill pin-holes, then soften the edge.
  const softened = await sharp(tee, { raw: { width, height, channels: 1 } }).dilate(1).erode(2).blur(0.8).extractChannel(0).raw().toBuffer();
  if (softened.length !== n) throw new Error(`mask size ${softened.length} != ${n}`);
  return new Uint8Array(softened.buffer, softened.byteOffset, softened.length);
}

function overlap(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] > 127, y = b[i] > 127;
    if (x && y) inter++;
    if (x || y) union++;
  }
  return union ? inter / union : 0;
}

function applyMask(raw: Raw, mask: Uint8Array): Raw {
  for (let i = 0; i < mask.length; i++) raw.data[i * 4 + 3] = mask[i];
  return raw;
}

function opaqueBounds({ data, width, height }: Raw) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function fitToCanvas(raw: Raw, color: string): Promise<{ full: Buffer; thumb: Buffer }> {
  const bounds = opaqueBounds(raw);
  if (!bounds) throw new ImageError(`The ${color} photo is blank after removing the background.`);
  const boxW = TEE_BOX.right - TEE_BOX.left;
  const boxH = TEE_BOX.bottom - TEE_BOX.top;
  const scale = Math.min(boxW / bounds.width, boxH / bounds.height);
  const teeW = Math.round(bounds.width * scale);
  const teeH = Math.round(bounds.height * scale);
  const tee = await sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 4 } })
    .extract(bounds)
    .resize(teeW, teeH, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const fullPng = await sharp({ create: { ...CANVAS, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: tee, left: TEE_BOX.left + Math.floor((boxW - teeW) / 2), top: TEE_BOX.top + Math.floor((boxH - teeH) / 2) }])
    .png()
    .toBuffer();
  const full = await sharp(fullPng).webp({ quality: 82, effort: 6 }).toBuffer();
  const thumb = await sharp(fullPng).resize(THUMB.width, THUMB.height, { kernel: 'lanczos3' }).webp({ quality: 80, effort: 6 }).toBuffer();
  return { full, thumb };
}

/** Prepares the black and white tee photos together (the white one borrows the black one's outline). */
export async function prepareTeePhotos(files: { black: File; white: File }) {
  const [black, white] = await Promise.all([decode(files.black, 'black'), decode(files.white, 'white')]);
  let blackMask: Uint8Array | null = null;
  if (!hasTransparency(black)) {
    blackMask = await backgroundMask(black, 150);
    applyMask(black, blackMask);
  }
  if (!hasTransparency(white)) {
    const own = await backgroundMask(white, 246);
    const sameShot = blackMask && white.width === black.width && white.height === black.height && overlap(own, blackMask) > 0.95;
    applyMask(white, sameShot ? blackMask! : own);
  }
  const [b, w] = await Promise.all([fitToCanvas(black, 'black'), fitToCanvas(white, 'white')]);
  return { black: b, white: w };
}

/**
 * Uploads both colours into a new folder (so browsers and the CDN never show an old photo) and
 * returns the image_base to save on the product.
 */
export async function uploadTeePhotos(productId: string, files: { black: File; white: File }): Promise<string> {
  const { black, white } = await prepareTeePhotos(files);
  const folder = `${productId}/v${Date.now().toString(36)}`;
  const target = await db();
  await Promise.all([
    storageUpload(target, BUCKET, `${folder}-black.webp`, black.full, 'image/webp'),
    storageUpload(target, BUCKET, `${folder}-black-480.webp`, black.thumb, 'image/webp'),
    storageUpload(target, BUCKET, `${folder}-white.webp`, white.full, 'image/webp'),
    storageUpload(target, BUCKET, `${folder}-white-480.webp`, white.thumb, 'image/webp'),
  ]);
  return storagePublicUrl(target, BUCKET, folder);
}
