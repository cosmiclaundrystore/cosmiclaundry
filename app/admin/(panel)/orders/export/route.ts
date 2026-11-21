import { getAdmin } from '@/lib/admin/auth';
import { exportOrders } from '@/lib/admin/data';

export const dynamic = 'force-dynamic';

function cell(value: unknown): string {
  let text = value == null ? '' : String(value);
  // Stop spreadsheet apps from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const major = (minor: number) => (minor / 100).toFixed(2);

export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response('Not signed in as an admin.', { status: 401 });
  const sp = new URL(request.url).searchParams;
  const rows = await exportOrders({ status: sp.get('status') ?? undefined, q: sp.get('q') ?? undefined });

  const header = ['Order', 'Placed', 'Paid', 'Payment', 'Delivery', 'Currency', 'Subtotal', 'Delivery fee', 'Total', 'Items',
    'First name', 'Last name', 'Email', 'Phone', 'Address 1', 'Address 2', 'City', 'Postcode', 'Country', 'Customer note', 'Courier', 'Tracking'];
  const lines = rows.map((o) => [
    o.number, o.created_at, o.paid_at, o.status, o.fulfillment_status, o.currency, major(o.subtotal_minor), major(o.shipping_minor), major(o.total_minor),
    o.order_items.map((i) => `${i.quantity}x ${i.product_name} (${i.color}, ${i.size})`).join('; '),
    o.first_name, o.last_name, o.email, o.phone, o.address_line1, o.address_line2, o.city, o.postcode, o.country_code, o.notes, o.courier, o.tracking_number,
  ].map(cell).join(','));

  const date = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + [header.join(','), ...lines].join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cosmic-laundry-orders-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
