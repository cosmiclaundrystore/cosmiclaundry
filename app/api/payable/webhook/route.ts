import { checkValuesMatch, fromPayableAmount, webhookCheckValue } from '@/lib/payable/check-value';
import { payableConfig, siteUrl } from '@/lib/payable/config';
import { orderStore } from '@/lib/orders/store';

// PAYable's server-to-server payment notification (the webhookUrl we send with each session).
// https://developers.payable.lk/docs/ipg-direct-api/webhooks
// PAYable expects {"Status":200} back. The docs don't give the method/body format or retry policy,
// so this accepts JSON or form posts and is safe to receive more than once.

const STATUS_SUCCESS = '1';
const STATUS_FAILED = '2';

function reply(status: number) {
  return Response.json({ Status: status }, { status, headers: { 'cache-control': 'no-store' } });
}

async function readPayload(request: Request): Promise<Record<string, unknown> | null> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
      return Object.fromEntries((await request.formData()).entries());
    }
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value));

export async function POST(request: Request) {
  const payload = await readPayload(request);
  if (!payload) return reply(400);

  const config = payableConfig(siteUrl(request));
  const fields = {
    merchantKey: str(payload.merchantKey),
    payableOrderId: str(payload.payableOrderId),
    payableTransactionId: str(payload.payableTransactionId),
    payableAmount: str(payload.payableAmount),
    payableCurrency: str(payload.payableCurrency),
    invoiceNo: str(payload.invoiceNo ?? payload.invoiceId),
    statusCode: str(payload.statusCode),
  };

  if (fields.merchantKey !== config.merchantKey || !checkValuesMatch(webhookCheckValue(fields, config.merchantToken), str(payload.checkValue))) {
    console.error('[payable] Webhook rejected: merchant key or checkValue does not match.', { invoiceNo: fields.invoiceNo });
    return reply(401);
  }

  const store = orderStore();
  const attempt = await store.findAttempt(fields.invoiceNo);
  if (!attempt) {
    console.error('[payable] Webhook for an unknown invoice:', fields.invoiceNo);
    return reply(404);
  }

  if (fields.statusCode !== STATUS_SUCCESS && fields.statusCode !== STATUS_FAILED) {
    // e.g. 7 = REFUNDED. Refund handling comes with the admin dashboard; acknowledge so PAYable doesn't retry.
    console.info('[payable] Webhook with status', fields.statusCode, 'for', fields.invoiceNo, '- not handled yet.');
    return reply(200);
  }

  let success = fields.statusCode === STATUS_SUCCESS;
  const amountMinor = fromPayableAmount(fields.payableAmount);
  if (success && (amountMinor !== attempt.amountMinor || fields.payableCurrency !== attempt.currency)) {
    // Signed by PAYable but not what we asked for: never mark the order paid. Needs a manual look.
    console.error('[payable] Paid amount does not match the order. NOT marking paid.', {
      invoiceNo: fields.invoiceNo, expected: `${attempt.amountMinor} ${attempt.currency}`, received: `${fields.payableAmount} ${fields.payableCurrency}`,
    });
    success = false;
  }

  const outcome = await store.recordPaymentResult({
    invoiceId: fields.invoiceNo,
    success,
    payload: { ...payload, checkValue: undefined },
    payableOrderId: fields.payableOrderId || null,
    payableTransactionId: fields.payableTransactionId || null,
    paymentMethod: str(payload.paymentMethod) || null,
    cardNumberMasked: str(payload.cardNumber) || null,
    statusCode: fields.statusCode,
  });
  if (outcome === 'paid_again') {
    console.error('[payable] A second payment succeeded for an order that was already paid. Refund it:', fields.invoiceNo);
  }
  return reply(200);
}
