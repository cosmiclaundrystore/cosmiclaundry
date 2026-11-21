import type { Currency } from '@/lib/checkout/shared';
import { formatMoney } from '@/lib/checkout/shared';

const LABELS: Record<string, string> = {
  pending: 'Awaiting payment', paid: 'Paid', failed: 'Payment failed', cancelled: 'Cancelled', fulfilled: 'Paid', refunded: 'Refunded',
  unfulfilled: 'Not packed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`a-badge ${status}`}>{LABELS[status] ?? status}</span>;
}

export function money(minor: number, currency: Currency) {
  return formatMoney(minor, currency);
}

const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const DATE_LONG = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' });

export function when(iso: string | null, long = false) {
  return iso ? (long ? DATE_LONG : DATE).format(new Date(iso)) : '—';
}
