import 'server-only';

// PAYable IPG Direct API settings. Docs: https://developers.payable.lk/docs/ipg-direct-api
//
// PAYABLE_MODE:
//   mock    - a fake PAYable inside this app (/api/mock-payable, /mock-payable). No keys needed. Never in production.
//   sandbox - PAYable's sandbox, with the sandbox keys from PAYable.
//   live    - real payments, with the live keys.

export type PayableMode = 'mock' | 'sandbox' | 'live';

export type PayableConfig = {
  mode: PayableMode;
  merchantKey: string;
  merchantToken: string;
  businessKey: string;
  businessToken: string;
  authUrl: string;
  paymentUrl: string;
};

/** Fixed credentials the mock gateway and the app agree on. They are not secrets. */
export const MOCK_CREDENTIALS = {
  merchantKey: 'MOCKMERCHANT01',
  merchantToken: 'mock-merchant-token',
  businessKey: 'mock-business-key',
  businessToken: 'mock-business-token',
} as const;

const ENDPOINTS = {
  sandbox: {
    authUrl: 'https://sandboxipgpayment.payable.lk/ipg/auth/direct-api',
    paymentUrl: 'https://sandboxipgpayment.payable.lk/ipg/sandbox/direct-api',
  },
  live: {
    authUrl: 'https://ipgpayment.payable.lk/ipg/auth/direct-api',
    paymentUrl: 'https://ipgpayment.payable.lk/ipg/pro/direct-api',
  },
} as const;

export class PayableNotConfiguredError extends Error {}

export function payableMode(): PayableMode {
  const mode = (process.env.PAYABLE_MODE || (process.env.VERCEL_ENV === 'production' ? '' : 'mock')).toLowerCase();
  if (mode !== 'mock' && mode !== 'sandbox' && mode !== 'live') {
    throw new PayableNotConfiguredError('Set PAYABLE_MODE to mock, sandbox or live.');
  }
  if (mode === 'mock' && process.env.VERCEL_ENV === 'production') {
    throw new PayableNotConfiguredError('PAYABLE_MODE=mock is not allowed in production.');
  }
  return mode;
}

/** `siteUrl` is this site's public origin; the mock gateway runs on it. */
export function payableConfig(siteUrl: string): PayableConfig {
  const mode = payableMode();
  if (mode === 'mock') {
    return {
      mode,
      ...MOCK_CREDENTIALS,
      authUrl: `${siteUrl}/api/mock-payable/ipg/auth/direct-api`,
      paymentUrl: `${siteUrl}/api/mock-payable/ipg/sandbox/direct-api`,
    };
  }
  const env = (name: string) => {
    const value = process.env[name];
    if (!value) throw new PayableNotConfiguredError(`${name} is not set (needed for PAYABLE_MODE=${mode}).`);
    return value;
  };
  return {
    mode,
    merchantKey: env('PAYABLE_MERCHANT_KEY'),
    merchantToken: env('PAYABLE_MERCHANT_TOKEN'),
    businessKey: env('PAYABLE_BUSINESS_KEY'),
    businessToken: env('PAYABLE_BUSINESS_TOKEN'),
    ...ENDPOINTS[mode],
  };
}

/**
 * The site's public origin, used for PAYable's originDomain, returnUrl, cancelUrl, webhookUrl and logoUrl.
 * PAYable needs a public HTTPS domain registered with them; it rejects localhost (except in mock mode).
 */
export function siteUrl(request: Request): string {
  const configured = process.env.SITE_URL?.replace(/\/+$/, '');
  return configured || new URL(request.url).origin;
}
