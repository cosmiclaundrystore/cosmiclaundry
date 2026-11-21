import 'server-only';
import { orderStore } from '@/lib/orders/store';
import { createPaymentSession } from '@/lib/payable/client';
import { payableConfig } from '@/lib/payable/config';
import type { CustomerInput } from './shared';

/** Opens a new payment attempt for an order and returns the PAYable page to redirect the customer to. */
export async function startPayment(opts: {
  siteUrl: string;
  orderNumber: string;
  token: string;
  customer: CustomerInput;
  countryCode: string;
  itemCount: number;
}): Promise<string> {
  const config = payableConfig(opts.siteUrl);
  const attempt = await orderStore().startAttempt(opts.orderNumber);
  const orderLink = `order=${encodeURIComponent(opts.orderNumber)}&t=${encodeURIComponent(opts.token)}`;
  const { paymentPage } = await createPaymentSession(config, {
    invoiceId: attempt.invoiceId,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
    orderDescription: `Cosmic Laundry order ${opts.orderNumber} (${opts.itemCount} ${opts.itemCount === 1 ? 'tee' : 'tees'})`,
    customer: opts.customer,
    countryCode: opts.countryCode,
    siteUrl: opts.siteUrl,
    returnUrl: `${opts.siteUrl}/checkout/complete?${orderLink}`,
    cancelUrl: `${opts.siteUrl}/checkout?cancelled=${encodeURIComponent(opts.orderNumber)}`,
    webhookUrl: `${opts.siteUrl}/api/payable/webhook`,
  });
  return paymentPage;
}
