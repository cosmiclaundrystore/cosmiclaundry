import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

// PAYable "checkValue" signatures: https://developers.payable.lk/docs/ipg-direct-api/check-value
// UPPERCASE(SHA512[ field1|field2|...|UPPERCASE(SHA512[merchantToken]) ])

export function sha512Upper(value: string): string {
  return createHash('sha512').update(value, 'utf8').digest('hex').toUpperCase();
}

function sign(fields: string[], merchantToken: string): string {
  return sha512Upper([...fields, sha512Upper(merchantToken)].join('|'));
}

/** checkValue sent with a payment session: merchantKey|invoiceId|amount|currencyCode|hash(token). */
export function requestCheckValue(p: { merchantKey: string; invoiceId: string; amount: string; currencyCode: string }, merchantToken: string): string {
  return sign([p.merchantKey, p.invoiceId, p.amount, p.currencyCode], merchantToken);
}

export type WebhookSignedFields = {
  merchantKey: string;
  payableOrderId: string;
  payableTransactionId: string;
  payableAmount: string;
  payableCurrency: string;
  invoiceNo: string;
  statusCode: string;
};

/**
 * checkValue PAYable sends with a webhook:
 * merchantKey|payableOrderId|payableTransactionId|payableAmount|payableCurrency|invoiceNo|statusCode|hash(token).
 * The docs name the invoice field both invoiceNo and invoiceId; either way it is our invoice id.
 * Fields are hashed exactly as received (e.g. "3900.00", not re-formatted).
 */
export function webhookCheckValue(p: WebhookSignedFields, merchantToken: string): string {
  return sign([p.merchantKey, p.payableOrderId, p.payableTransactionId, p.payableAmount, p.payableCurrency, p.invoiceNo, p.statusCode], merchantToken);
}

export function checkValuesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected.toUpperCase(), 'utf8');
  const b = Buffer.from(received.trim().toUpperCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Minor units (390000) to PAYable's amount string ("3900.00"). */
export function toPayableAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** PAYable's amount string back to minor units, or null if it isn't a plain decimal. */
export function fromPayableAmount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}
