import { json, paymentErrorResponse, readJsonBody } from '@/lib/checkout/http';
import { priceBasket } from '@/lib/checkout/pricing';
import { REGION_COUNTRY, parseBasket, validateCustomer } from '@/lib/checkout/shared';
import { requestRegion } from '@/lib/region';
import { designExists } from '@/lib/custom/designs';
import { startPayment } from '@/lib/checkout/start-payment';
import { orderStore } from '@/lib/orders/store';
import { siteUrl } from '@/lib/payable/config';

// Places an order: re-prices the basket on the server, saves a pending order, and opens a PAYable payment session.
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const items = parseBasket(body?.items);
  if (!items) return json({ error: 'invalid_basket', message: 'Your laundry basket could not be read.' }, 400);
  // The shopper's region (LK / UK / US) sets the currency, prices, delivery country and phone format.
  const region = await requestRegion();
  // Checkout is locked to the region it opened with: a region switch mid-checkout means starting again.
  if (body?.region !== region) {
    return json({ error: 'region_changed', message: 'Your shopping region changed while you were checking out, so your basket has been re-priced. Please check the new total and pay again.' }, 409);
  }
  const { errors, value: customer } = validateCustomer((body?.customer ?? {}) as Record<string, unknown>, region);
  if (!customer) return json({ error: 'invalid_details', fieldErrors: errors }, 422);

  const country = REGION_COUNTRY[region];
  try {
    const quote = await priceBasket(items, region);
    // Never charge a different total from the one shown on the checkout page.
    if (quote.totalMinor !== body?.expectedTotalMinor || quote.currency !== body?.expectedCurrency) {
      return json({ error: 'basket_changed', message: 'Prices in your basket have changed. Please check the new total and pay again.', quote }, 409);
    }
    if (quote.problems.length || !quote.lines.length) {
      return json({ error: 'basket_changed', message: 'Some tees in your basket are no longer available. Please check your order.', quote }, 409);
    }
    // Custom tees: the uploaded design must really be there before we take payment.
    for (const line of quote.lines) {
      if (line.design && !(await designExists(line.design.id))) {
        return json({ error: 'design_missing', message: 'We couldn’t find the design for your custom tee. Please open it from your basket and upload it again.' }, 409);
      }
    }
    const store = orderStore();
    const visitorCountry = /^[A-Z]{2}$/.test(request.headers.get('x-vercel-ip-country') ?? '') ? request.headers.get('x-vercel-ip-country') : null;
    const order = await store.createOrder(quote, customer, country.code, visitorCountry);
    const redirectUrl = await startPayment({
      siteUrl: siteUrl(request),
      orderNumber: order.number,
      token: order.token,
      customer,
      countryCode: country.code,
      itemCount: quote.lines.reduce((sum, line) => sum + line.quantity, 0),
    });
    return json({ redirectUrl, order: order.number });
  } catch (error) {
    return paymentErrorResponse(error, 'place order');
  }
}
