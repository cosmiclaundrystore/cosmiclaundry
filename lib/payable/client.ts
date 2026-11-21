import 'server-only';
import type { CustomerInput } from '@/lib/checkout/shared';
import { requestCheckValue, toPayableAmount } from './check-value';
import type { PayableConfig } from './config';

// PAYable IPG Direct API: get a short-lived access token, create a payment session, send the customer to paymentPage.
// https://developers.payable.lk/docs/ipg-direct-api/authentication
// https://developers.payable.lk/docs/ipg-direct-api/create-session

export class PayableRequestError extends Error {
  constructor(message: string, public status: number, public body: string) { super(message); }
}

async function readJson(response: Response): Promise<{ json: Record<string, unknown> | null; text: string }> {
  const text = await response.text();
  try { return { json: JSON.parse(text) as Record<string, unknown>, text }; } catch { return { json: null, text }; }
}

async function getAccessToken(config: PayableConfig, originDomain: string): Promise<string> {
  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // The docs show the header as base64(businessKey:businessToken), without a "Basic " prefix. Verify in sandbox.
      authorization: Buffer.from(`${config.businessKey}:${config.businessToken}`, 'utf8').toString('base64'),
    },
    body: JSON.stringify({ grant_type: 'client_credentials', originDomain }),
    cache: 'no-store',
  });
  const { json, text } = await readJson(response);
  const token = json?.accessToken;
  if (!response.ok || typeof token !== 'string') {
    throw new PayableRequestError(`PAYable auth failed (${response.status})`, response.status, text.slice(0, 2000));
  }
  return token;
}

/** PAYable's older docs only allow letters, numbers, spaces and dots in names. */
export function payableName(value: string, fallback: string): string {
  const cleaned = value.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
  return cleaned || fallback;
}

export type SessionRequest = {
  invoiceId: string;
  amountMinor: number;
  currency: string;
  orderDescription: string;
  customer: CustomerInput;
  countryCode: string;
  siteUrl: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
};

/** Creates a payment session and returns the PAYable page to send the customer to. */
export async function createPaymentSession(config: PayableConfig, req: SessionRequest): Promise<{ paymentPage: string }> {
  const accessToken = await getAccessToken(config, req.siteUrl);
  const amount = toPayableAmount(req.amountMinor);
  const firstName = payableName(req.customer.firstName, 'Customer');
  const lastName = payableName(req.customer.lastName, 'Customer');
  const body = {
    merchantKey: config.merchantKey,
    invoiceId: req.invoiceId,
    amount,
    currencyCode: req.currency,
    checkValue: requestCheckValue({ merchantKey: config.merchantKey, invoiceId: req.invoiceId, amount, currencyCode: req.currency }, config.merchantToken),
    paymentType: 1, // one-time payment
    orderDescription: req.orderDescription.slice(0, 125),
    logoUrl: `${req.siteUrl}/assets/products/logo-main-480.webp`,
    returnUrl: req.returnUrl,
    cancelUrl: req.cancelUrl,
    originDomain: req.siteUrl,
    webhookUrl: req.webhookUrl,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerEmail: req.customer.email,
    customerMobilePhone: req.customer.phone,
    billingAddressStreet: req.customer.addressLine1.slice(0, 100),
    billingAddressStreet2: req.customer.addressLine2.slice(0, 100),
    billingAddressCity: req.customer.city.slice(0, 100),
    billingAddressPostcodeZip: req.customer.postcode.slice(0, 10),
    billingAddressCountry: req.countryCode,
    shippingContactFirstName: firstName,
    shippingContactLastName: lastName,
    shippingContactMobilePhone: req.customer.phone,
    shippingContactEmail: req.customer.email,
    shippingAddressStreet: req.customer.addressLine1.slice(0, 100),
    shippingAddressStreet2: req.customer.addressLine2.slice(0, 100),
    shippingAddressCity: req.customer.city.slice(0, 100),
    shippingAddressPostcodeZip: req.customer.postcode.slice(0, 10),
    shippingAddressCountry: req.countryCode,
  };

  const response = await fetch(config.paymentUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const { json, text } = await readJson(response);
  // The docs name the redirect URL "paymentPage"; also look one level down in case it is wrapped.
  const paymentPage = json?.paymentPage ?? (json?.data as Record<string, unknown> | undefined)?.paymentPage;
  if (!response.ok || typeof paymentPage !== 'string' || !/^https?:\/\//.test(paymentPage)) {
    throw new PayableRequestError(`PAYable create-session failed (${response.status})`, response.status, text.slice(0, 2000));
  }
  return { paymentPage };
}
