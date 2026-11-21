import 'server-only';
import { PayableNotConfiguredError } from '@/lib/payable/config';
import { PayableRequestError } from '@/lib/payable/client';
import { CheckoutUnavailableError } from './pricing';

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Logs the real cause and gives the browser a safe, generic error. */
export function paymentErrorResponse(error: unknown, context: string): Response {
  if (error instanceof PayableRequestError) {
    console.error(`[checkout] ${context}: ${error.message}`, error.body);
  } else {
    console.error(`[checkout] ${context}:`, error);
  }
  if (error instanceof PayableNotConfiguredError || error instanceof PayableRequestError || error instanceof CheckoutUnavailableError) {
    return json({ error: 'payment_unavailable', message: 'Payments are unavailable right now. Please try again in a few minutes.' }, 503);
  }
  return json({ error: 'server_error', message: 'Something went wrong on our side. Please try again.' }, 500);
}
