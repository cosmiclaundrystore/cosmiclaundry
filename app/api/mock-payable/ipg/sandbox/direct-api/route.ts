import { randomBytes } from 'node:crypto';
import { checkValuesMatch, requestCheckValue } from '@/lib/payable/check-value';
import { MOCK_CREDENTIALS } from '@/lib/payable/config';
import { mockEnabled, mockNotFound, mockState, mockTokenValid } from '@/lib/payable/mock';

// Fake PAYable: POST /ipg/{env}/direct-api, creates a payment session (PAYABLE_MODE=mock only).
// Applies the same checks the real docs describe, so mistakes show up before the sandbox.
const REQUIRED = [
  'merchantKey', 'checkValue', 'invoiceId', 'currencyCode', 'paymentType', 'amount', 'orderDescription', 'logoUrl',
  'returnUrl', 'originDomain', 'webhookUrl', 'customerFirstName', 'customerLastName', 'customerEmail', 'customerMobilePhone',
  'billingAddressStreet', 'billingAddressCity', 'billingAddressPostcodeZip', 'billingAddressCountry',
];

export async function POST(request: Request) {
  if (!mockEnabled()) return mockNotFound();
  if (!mockTokenValid(request.headers.get('authorization'))) return Response.json({ status: 401, error: 'Invalid or expired access token' }, { status: 401 });
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return Response.json({ status: 400, error: 'Invalid JSON' }, { status: 400 });
  const body = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]));

  const errors: Record<string, string[]> = {};
  for (const field of REQUIRED) if (!body[field]) errors[field] = [`${field} is required.`];
  if (body.merchantKey && body.merchantKey !== MOCK_CREDENTIALS.merchantKey) errors.merchantKey = ['Unknown merchant key.'];
  if (body.amount && !/^\d+\.\d{2}$/.test(body.amount)) errors.amount = ['Amount must have two decimals, e.g. "10.00".'];
  if (body.currencyCode && !['LKR', 'USD', 'GBP', 'EUR'].includes(body.currencyCode)) errors.currencyCode = ['Unsupported currency.'];
  if (body.paymentType && body.paymentType !== '1') errors.paymentType = ['Only one-time payments (1) are mocked.'];
  for (const name of ['customerFirstName', 'customerLastName']) {
    if (body[name] && !/^[a-zA-Z0-9. ]{1,50}$/.test(body[name])) errors[name] = ['Only letters, numbers, spaces and dots (max 50).'];
  }
  if (body.customerMobilePhone && !/^[0-9+ ]{10,15}$/.test(body.customerMobilePhone)) errors.customerMobilePhone = ['10 to 15 digits.'];
  if (body.billingAddressCountry && !/^[A-Z]{2,3}$/.test(body.billingAddressCountry)) errors.billingAddressCountry = ['Country code like LK.'];
  if (Object.keys(errors).length) return Response.json({ status: 400, errors }, { status: 400 });

  const expected = requestCheckValue(
    { merchantKey: body.merchantKey, invoiceId: body.invoiceId, amount: body.amount, currencyCode: body.currencyCode },
    MOCK_CREDENTIALS.merchantToken,
  );
  if (!checkValuesMatch(expected, body.checkValue)) return Response.json({ status: 400, error: 'checkValue does not match' }, { status: 400 });

  const state = mockState();
  const id = randomBytes(12).toString('base64url');
  state.sessions.set(id, { id, body, payableOrderId: `PO${++state.seq}`, createdAt: Date.now() });
  const origin = new URL(request.url).origin;
  return Response.json({ status: 'PENDING', uid: id, paymentPage: `${origin}/mock-payable/pay/${id}` });
}
