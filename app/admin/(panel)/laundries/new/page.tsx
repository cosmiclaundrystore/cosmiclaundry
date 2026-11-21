import type { Metadata } from 'next';
import Link from 'next/link';
import { LaundryForm } from '../laundry-form';

export const metadata: Metadata = { title: 'New Laundry' };

export default function NewLaundryPage() {
  return (
    <>
      <Link className="a-back" href="/admin/laundries">← Laundries</Link>
      <div className="a-head">
        <div>
          <h1>New Laundry</h1>
          <p>Create it here, then add its tees. Until it has tees, the shop shows it as “Artwork coming soon”.</p>
        </div>
      </div>
      <LaundryForm
        isNew
        tees={[]}
        values={{ id: '', name: '', short_name: '', tagline: '', description: '', featured_product_id: '', sort_order: '', is_active: true, show_on_home: true }}
      />
    </>
  );
}
