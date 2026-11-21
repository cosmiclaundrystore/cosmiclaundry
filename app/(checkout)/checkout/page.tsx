import { requestRegion } from '@/lib/region';
import { CheckoutForm } from './checkout-form';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [{ cancelled }, region] = await Promise.all([searchParams, requestRegion()]);
  return <CheckoutForm region={region} cancelledOrder={typeof cancelled === 'string' && /^CL-\d+$/.test(cancelled) ? cancelled : null} />;
}
