import 'server-only';
import { cookies, headers } from 'next/headers';
import { parseRegion, regionForCountry, REGION_COOKIE, type RegionCode } from '@/lib/checkout/shared';

/**
 * The visitor's shopping region on the server: their LK / UK / US choice (cookie, set by proxy.ts on the first visit),
 * otherwise their country from Vercel's geo header, otherwise Sri Lanka.
 */
export async function requestRegion(): Promise<RegionCode> {
  const chosen = parseRegion((await cookies()).get(REGION_COOKIE)?.value);
  if (chosen) return chosen;
  return regionForCountry((await headers()).get('x-vercel-ip-country'));
}
