import { homePage } from '@/lib/storefront/page';

export const revalidate = 60;

export function GET() {
  return homePage();
}
