import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/storefront/page';

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/checkout', '/api/', '/mock-payable'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
