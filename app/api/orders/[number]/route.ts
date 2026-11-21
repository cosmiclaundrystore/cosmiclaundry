import { json } from '@/lib/checkout/http';
import { orderStore } from '@/lib/orders/store';

// Order status for the customer's order link (/checkout/complete?order=...&t=...).
export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!token || !/^CL-\d+$/.test(number)) return json({ error: 'not_found' }, 404);
  try {
    const order = await orderStore().getOrder(number, token);
    return order ? json({ order: order.view }) : json({ error: 'not_found' }, 404);
  } catch (error) {
    console.error('[orders] status lookup failed:', error);
    return json({ error: 'server_error' }, 500);
  }
}
