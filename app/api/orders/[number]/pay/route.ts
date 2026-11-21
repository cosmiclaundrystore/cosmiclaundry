import { json, paymentErrorResponse, readJsonBody } from '@/lib/checkout/http';
import { startPayment } from '@/lib/checkout/start-payment';
import { OrderNotPayableError, orderStore } from '@/lib/orders/store';
import { siteUrl } from '@/lib/payable/config';

// "Try again" after a failed payment: a new attempt (CL-1001-2, ...) for the same order.
export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const body = await readJsonBody(request);
  const token = typeof body?.t === 'string' ? body.t : '';
  if (!token || !/^CL-\d+$/.test(number)) return json({ error: 'not_found' }, 404);
  try {
    const order = await orderStore().getOrder(number, token);
    if (!order) return json({ error: 'not_found' }, 404);
    const redirectUrl = await startPayment({
      siteUrl: siteUrl(request),
      orderNumber: number,
      token,
      customer: order.customer,
      countryCode: order.countryCode,
      itemCount: order.view.items.reduce((sum, item) => sum + item.quantity, 0),
    });
    return json({ redirectUrl });
  } catch (error) {
    if (error instanceof OrderNotPayableError) {
      return json({ error: error.reason, message: error.reason === 'order_not_payable' ? 'This order is already paid or closed.' : 'This order can no longer be paid. Please place a new order.' }, 409);
    }
    return paymentErrorResponse(error, 'retry payment');
  }
}
