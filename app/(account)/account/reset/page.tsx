import type { Metadata } from 'next';
import { requireCustomer } from '@/lib/account/session';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Choose a new password' };

// Reached from the reset email (via /auth/callback, which signs the customer in for this step).
export default async function ResetPage() {
  await requireCustomer('/account/reset');
  return (
    <section className="ac-auth">
      <h1>Choose a new password</h1>
      <ResetForm />
    </section>
  );
}
