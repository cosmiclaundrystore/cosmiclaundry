// Checkout rules shared by the browser (form hints) and the server (the real check).

export const REGION_CURRENCY = { LK: 'LKR', UK: 'GBP', US: 'USD' } as const;
export type RegionCode = keyof typeof REGION_CURRENCY;
export type Currency = (typeof REGION_CURRENCY)[RegionCode];

/** Regions customers can check out from: each pays in its own currency through PAYable. */
export const CHECKOUT_REGIONS: readonly RegionCode[] = ['LK', 'UK', 'US'];
export const DEFAULT_REGION: RegionCode = 'LK';

/** The visitor's shopping region: set from their country on the first visit, changed with the LK / UK / US switcher. */
export const REGION_COOKIE = 'cl_region';

export function parseRegion(value: unknown): RegionCode | null {
  return value === 'LK' || value === 'UK' || value === 'US' ? value : null;
}

/** Sri Lanka shops in LKR, the UK (and Crown Dependencies) in GBP, everyone else in USD. */
export function regionForCountry(countryCode: string | null | undefined): RegionCode {
  const code = (countryCode || '').toUpperCase();
  if (code === 'LK') return 'LK';
  if (code === 'GB' || code === 'UK' || code === 'IM' || code === 'JE' || code === 'GG') return 'UK';
  return code ? 'US' : DEFAULT_REGION;
}
export const REGION_COUNTRY: Record<RegionCode, { code: string; name: string }> = {
  LK: { code: 'LK', name: 'Sri Lanka' },
  UK: { code: 'GB', name: 'United Kingdom' },
  US: { code: 'US', name: 'United States' },
};

export const BASKET_STORAGE_KEY = 'cosmic-laundry:bag:v1';
export const COLORS = { black: 'Black', white: 'White' } as const;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;
const PRODUCT_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** design: the customer's uploaded artwork for a Custom tee (id from /api/custom-design, optional instructions). */
export type BasketDesign = { id: string; note: string; thumb?: string };
export type BasketItem = { id: string; color: string; size: string; quantity: number; design?: BasketDesign };
const DESIGN_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$/;

function parseDesign(value: unknown): BasketDesign | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') return null;
  const { id, note, thumb } = value as Record<string, unknown>;
  if (typeof id !== 'string' || !DESIGN_FILE.test(id)) return null;
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) return null;
  const design: BasketDesign = { id, note: typeof note === 'string' ? note.trim() : '' };
  // The small preview only matters in the browser; it's kept so re-saving the basket doesn't lose it.
  if (typeof thumb === 'string' && thumb.startsWith('data:image/') && thumb.length < 150000) design.thumb = thumb;
  return design;
}

/** Cleans a basket from the browser: drops malformed lines and merges duplicates. Returns null if unusable. */
export function parseBasket(value: unknown): BasketItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LINES * 2) return null;
  const merged = new Map<string, BasketItem>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const { id, color, size, quantity, design: rawDesign } = raw as Record<string, unknown>;
    const design = parseDesign(rawDesign);
    if (design === null) return null;
    if (typeof id !== 'string' || !PRODUCT_ID.test(id) || id.length > 80) return null;
    if (typeof color !== 'string' || !(color in COLORS)) return null;
    if (typeof size !== 'string' || !(SIZES as readonly string[]).includes(size)) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
    const key = `${id}|${color}|${size}|${design?.id ?? ''}`;
    const existing = merged.get(key);
    if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    else merged.set(key, design ? { id, color, size, quantity, design } : { id, color, size, quantity });
  }
  if (merged.size > MAX_LINES) return null;
  return [...merged.values()];
}

const FRACTION_DIGITS: Record<Currency, number> = { LKR: 2, GBP: 2, USD: 2 };

export function formatMoney(minor: number, currency: Currency): string {
  const major = minor / 10 ** FRACTION_DIGITS[currency];
  if (currency === 'LKR') return `Rs ${major.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat(currency === 'GBP' ? 'en-GB' : 'en-US', { style: 'currency', currency }).format(major);
}

export type CustomerInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  notes: string;
  acceptTerms: boolean;
};
export type CustomerField = keyof CustomerInput;
export type FieldErrors = Partial<Record<CustomerField, string>>;

const LIMITS: Record<Exclude<CustomerField, 'acceptTerms'>, number> = {
  email: 100, phone: 20, firstName: 50, lastName: 50, addressLine1: 100, addressLine2: 100, city: 60, postcode: 10, notes: 300,
};

/** Sri Lankan mobile numbers in any common format become 07XXXXXXXX (the format PAYable shows). */
export function normalizeLkMobile(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, '');
  const match = /^(?:\+?94|0)?(7\d{8})$/.exec(digits);
  return match ? `0${match[1]}` : null;
}

// Each region's checkout only accepts that country's phone numbers and postcodes, so a price can only be paid
// for delivery in the country it belongs to (a UK address can't go through the LKR checkout).

/** UK numbers: 07xxx xxxxxx / 01… / 02… or +44, 10–11 digits after the prefix. Returned as +44… */
function normalizeUkPhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, '');
  const match = /^(?:\+44|0044|0)([1-9]\d{8,9})$/.exec(digits);
  return match ? `+44${match[1]}` : null;
}

/** US numbers: (201) 555-0123, 201-555-0123 or +1 201 555 0123. Returned as +1… */
function normalizeUsPhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, '');
  const match = /^(?:\+?1)?([2-9]\d{2}[2-9]\d{6})$/.exec(digits);
  return match ? `+1${match[1]}` : null;
}

/** Tidies and checks a postcode for the region's country. Returns null when it isn't valid there. */
function normalizePostcode(value: string, region: RegionCode): string | null {
  const v = value.toUpperCase().replace(/\s+/g, ' ').trim();
  if (region === 'LK') return /^\d{5}$/.test(v) ? v : null;
  if (region === 'US') return /^\d{5}(?:-\d{4})?$/.test(v) ? v : null;
  // UK: outward code + inward code, e.g. SW1A 1AA, M1 1AE, B33 8TH (space optional when typed).
  const compact = v.replace(/ /g, '');
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(compact);
  return m ? `${m[1]} ${m[2]}` : null;
}

export const POSTCODE_HINT: Record<RegionCode, string> = {
  LK: 'Enter your 5-digit Sri Lankan postal code, like 10350.',
  UK: 'Enter a UK postcode, like SW1A 1AA.',
  US: 'Enter a US ZIP code, like 10001.',
};

export const PHONE_HINT: Record<RegionCode, { placeholder: string; error: string }> = {
  LK: { placeholder: '077 123 4567', error: 'Enter a Sri Lankan mobile number, like 077 123 4567.' },
  UK: { placeholder: '07700 900123', error: 'Enter a UK phone number, like 07700 900123.' },
  US: { placeholder: '(201) 555-0123', error: 'Enter a US phone number, like (201) 555-0123.' },
};

/** Validates and tidies the checkout form. `value` is only set when there are no errors. */
export function validateCustomer(input: Partial<Record<CustomerField, unknown>>, region: RegionCode = DEFAULT_REGION): { errors: FieldErrors; value?: CustomerInput } {
  const text = (key: Exclude<CustomerField, 'acceptTerms'>) => {
    const raw = input[key];
    return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, LIMITS[key]) : '';
  };
  const value: CustomerInput = {
    email: text('email').toLowerCase(),
    phone: text('phone'),
    firstName: text('firstName'),
    lastName: text('lastName'),
    addressLine1: text('addressLine1'),
    addressLine2: text('addressLine2'),
    city: text('city'),
    postcode: text('postcode').toUpperCase(),
    notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, LIMITS.notes) : '',
    acceptTerms: input.acceptTerms === true,
  };
  const errors: FieldErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.email)) errors.email = 'Enter a valid email address.';
  const phone = region === 'LK' ? normalizeLkMobile(value.phone) : region === 'UK' ? normalizeUkPhone(value.phone) : normalizeUsPhone(value.phone);
  if (!phone) errors.phone = PHONE_HINT[region].error;
  else value.phone = phone;
  if (!value.firstName) errors.firstName = 'Enter your first name.';
  if (!value.lastName) errors.lastName = 'Enter your last name.';
  if (value.addressLine1.length < 3) errors.addressLine1 = 'Enter your street address.';
  if (value.city.length < 2) errors.city = 'Enter your city or town.';
  const postcode = normalizePostcode(value.postcode, region);
  if (!postcode) errors.postcode = POSTCODE_HINT[region];
  else value.postcode = postcode;
  if (!value.acceptTerms) errors.acceptTerms = 'Please accept the terms and refund policy to continue.';
  return Object.keys(errors).length ? { errors } : { errors, value };
}
