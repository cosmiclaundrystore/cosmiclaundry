import { laundriesPage } from '@/lib/storefront/page';

export const revalidate = 60;

export function GET() {
  return laundriesPage();
}
