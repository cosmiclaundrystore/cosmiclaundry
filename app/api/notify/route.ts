import { adminSupabase } from '@/lib/supabase/rest';

// Coming-soon signup: saves the visitor's email to public.launch_signups (server only, secret key).
// Signing up twice with the same email is fine: the second one is ignored and still reports success.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  // Only from this site's own pages.
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if ((site && site !== 'same-origin') || (origin && new URL(origin).host !== new URL(request.url).host)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { email?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid', message: 'Enter a valid email address.' }, { status: 400 });
  }
  // Honeypot: a hidden field people never fill in. Pretend it worked so bots move on.
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) {
    return Response.json({ error: 'invalid', message: 'Enter a valid email address.' }, { status: 400 });
  }

  const target = adminSupabase();
  if (!target) {
    console.error('[notify] SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL not set');
    return Response.json({ error: 'server', message: 'Signups are down for a moment. Please try again soon.' }, { status: 500 });
  }

  const country = request.headers.get('x-vercel-ip-country');
  const headers: Record<string, string> = {
    apikey: target.key,
    'content-type': 'application/json',
    prefer: 'resolution=ignore-duplicates,return=minimal',
  };
  if (target.key.startsWith('eyJ')) headers.authorization = `Bearer ${target.key}`;

  const response = await fetch(`${target.url}/rest/v1/launch_signups?on_conflict=email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, country_code: country && /^[A-Z]{2}$/.test(country) ? country : null }),
    cache: 'no-store',
  });
  if (!response.ok) {
    console.error('[notify] insert failed', response.status, await response.text());
    return Response.json({ error: 'server', message: 'That didn’t go through. Please try again.' }, { status: 500 });
  }
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
