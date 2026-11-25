import { requestRegion } from '@/lib/region';
import { ensureCustomer, getCustomer } from '@/lib/account/session';
import { accountSummary } from '@/lib/account/data';
import { CheckoutForm, type CheckoutAccount } from './checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [{ cancelled }, region, customer] = await Promise.all([searchParams, requestRegion(), getCustomer()]);
  let account: CheckoutAccount | null = null;
  if (customer) {
    await ensureCustomer(customer);
    const summary = await accountSummary(customer);
    const [firstName, ...rest] = summary.name.split(' ');
    account = { email: customer.email, firstName: firstName ?? '', lastName: rest.join(' '), balance: summary.balance, hasReward: summary.rewardsAvailable > 0 };
  }
  return <CheckoutForm region={region} account={account} cancelledOrder={typeof cancelled === 'string' && /^CL-\d+$/.test(cancelled) ? cancelled : null} />;
}
