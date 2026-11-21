import { OrderComplete } from './order-complete';

export const metadata = { title: 'Your order · Cosmic Laundry' };

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ order?: string; t?: string }> }) {
  const { order, t } = await searchParams;
  return <OrderComplete orderNumber={typeof order === 'string' ? order : ''} token={typeof t === 'string' ? t : ''} />;
}
