import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parseRegion, regionForCountry, REGION_COOKIE } from '@/lib/checkout/shared';

// Runs before every page request (static files and /_next are skipped by the matcher).
// - Launch lock: until STORE_OPEN=true, / shows the coming-soon page and every other public page redirects to /.
//   Admin, the signup API, the payment webhook and the cron job keep working.
// - Shopping region: the visitor's LK / UK / US choice (cookie), or on the first visit their country from Vercel's
//   geo header. /catalog.js is served from /catalog/<region> so each region's prices are cached separately.
// - Sign-in: keeps the Supabase session fresh for the admin, customer accounts and checkout. This is not the access
//   check; every admin page checks admin_users and every account page checks the signed-in customer on the server.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin')) return refreshSession(request);
  if (process.env.STORE_OPEN !== 'true') return launchLock(request);
  if (pathname === '/comingsoon') return NextResponse.redirect(new URL('/', request.url));
  if (/^\/(account|auth)(\/|$)/.test(pathname)) return refreshSession(request);
  if (!REGION_PATHS.test(pathname)) return NextResponse.next();

  const chosen = parseRegion(request.cookies.get(REGION_COOKIE)?.value);
  const region = chosen ?? regionForCountry(request.headers.get('x-vercel-ip-country'));

  // Checkout also needs the customer's sign-in (to link the order and offer their reward).
  const signedIn = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  const response =
    pathname === '/catalog.js'
      ? NextResponse.rewrite(new URL(`/catalog/${region}`, request.url))
      : signedIn && /^\/(checkout|api\/checkout)(\/|$)/.test(pathname)
        ? await refreshSession(request)
        : NextResponse.next();
  // Remember the region so the shop, basket and checkout agree. Readable by the page's switcher (not secret).
  if (!chosen) response.cookies.set(REGION_COOKIE, region, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
}

// Pages that need the shopping region (the shop, catalog and checkout).
const REGION_PATHS = /^\/($|laundries(\/|$)|tees\/|catalog\.js$|checkout(\/|$)|api\/checkout(\/|$))/;

// Paths that stay reachable while the store is locked.
const OPEN_WHILE_LOCKED = ['/api/notify', '/api/payable/webhook', '/api/cron/', '/robots.txt', '/favicon.ico'];

function launchLock(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/') return NextResponse.rewrite(new URL('/comingsoon', request.url));
  if (OPEN_WHILE_LOCKED.some((p) => pathname === p || (p.endsWith('/') && pathname.startsWith(p)))) return NextResponse.next();
  if (pathname.startsWith('/api/') || pathname === '/catalog.js' || pathname === '/sitemap.xml') {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.redirect(new URL('/', request.url), 307);
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Everything except Next internals and files in /public (anything with an extension), plus the few
  // extension-named routes the app serves itself.
  matcher: ['/((?!_next/|.*\\.[A-Za-z0-9]+$).*)', '/catalog.js', '/sitemap.xml', '/robots.txt'],
};
