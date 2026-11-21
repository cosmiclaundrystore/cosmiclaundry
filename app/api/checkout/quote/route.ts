import { json, paymentErrorResponse, readJsonBody } from '@/lib/checkout/http';
import { priceBasket } from '@/lib/checkout/pricing';
import { parseBasket } from '@/lib/checkout/shared';
import { requestRegion } from '@/lib/region';

// Prices the basket for the checkout page (the browser only knows ids, colours, sizes and quantities).
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const items = parseBasket(body?.items);
  if (!items) return json({ error: 'invalid_basket', message: 'Your laundry basket could not be read.' }, 400);
  const region = await requestRegion();
  if (body?.region && body.region !== region) {
    return json({ error: 'region_changed', message: 'Your shopping region changed while you were checking out, so your basket has been re-priced. Please check the new total and pay again.' }, 409);
  }
  try {
    return json({ quote: await priceBasket(items, region) });
  } catch (error) {
    return paymentErrorResponse(error, 'quote');
  }
}
