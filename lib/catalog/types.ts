// The catalog shape the storefront scripts (public/app.js, commerce.js, menu.js) read from window.CosmicCatalog.
// Field names and order match the original public/catalog.js so the storefront renders exactly the same.

export type CatalogCollection = {
  id: string;
  name: string;
  short: string;
  tagline: string;
  description: string;
  featured: string;
  tint: string;
  accent: string;
  theme: string;
  /** Present (false) only for Laundries kept off the home page hero and tee strip. */
  onHome?: false;
};

export type CatalogProduct = {
  id: string;
  name: string;
  collection: string;
  defaultColor: 'black' | 'white';
  description: string;
  /** Price in major units of the storefront currency (e.g. 3500 LKR), or null for "Price to be confirmed". */
  price: number | null;
  /** Present only for tees whose photos were uploaded in the admin: Storage URL prefix, e.g. ".../product-images/<id>/<version>". */
  imageBase?: string;
};

export type CatalogData = {
  collections: CatalogCollection[];
  products: CatalogProduct[];
  /** currency and region are the visitor's shopping region (region is absent only in the old static snapshot). */
  commerce: { mode: string; currency: string; checkoutUrl: string | null; region?: 'LK' | 'UK' | 'US' };
  featuredLabel: string;
};
