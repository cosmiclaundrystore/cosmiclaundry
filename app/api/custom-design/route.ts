import { DesignError, storeDesign } from '@/lib/custom/designs';

// Upload for the Custom tee: the tee window sends the customer's design here (already shrunk in the browser),
// and gets back an id that goes into the basket and, at checkout, onto the order.
export async function POST(request: Request) {
  // Only from this site's own pages.
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if ((site && site !== 'same-origin') || (origin && new URL(origin).host !== new URL(request.url).host)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get('design');
  } catch {
    return Response.json({ error: 'invalid', message: 'We couldn’t read that upload. Please try again.' }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: 'invalid', message: 'Choose an image to upload.' }, { status: 400 });
  try {
    return Response.json({ id: await storeDesign(file) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof DesignError) return Response.json({ error: 'invalid', message: error.message }, { status: 422 });
    console.error('[custom-design] upload failed', error);
    return Response.json({ error: 'server', message: 'The upload didn’t go through. Please try again.' }, { status: 500 });
  }
}
