// Web ids (used in links and photo names) are made from the name, so admins never type them.

/** "Tren Lisa" -> "tren-lisa". For Laundries, a trailing "Laundry" is dropped: "One Piece Laundry" -> "one-piece". */
export function slugify(name: string, opts: { dropLaundry?: boolean } = {}): string {
  let s = name.toLowerCase().replace(/[’']/g, '');
  if (opts.dropLaundry) s = s.replace(/\blaundry\b/g, ' ');
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
