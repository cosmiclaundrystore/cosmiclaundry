import 'server-only';

// Minimal Supabase REST (PostgREST) client, matching how lib/catalog/load-catalog.ts talks to Supabase.

function headersFor(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, accept: 'application/json', 'content-type': 'application/json' };
  // Legacy JWT keys (service_role / anon) also need a bearer token; new sb_secret_/sb_publishable_ keys do not.
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  return headers;
}

export type SupabaseTarget = { url: string; key: string };

/** Read-only access with the publishable key (respects RLS). */
export function publicSupabase(): SupabaseTarget | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Full access with the secret key. Server only: never expose SUPABASE_SECRET_KEY to the browser. */
export function adminSupabase(): SupabaseTarget | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export async function restGet<T>(target: SupabaseTarget, path: string): Promise<T[]> {
  const response = await fetch(`${target.url}/rest/v1/${path}`, { headers: headersFor(target.key), cache: 'no-store' });
  if (!response.ok) throw new Error(`Supabase GET ${path.split('?')[0]} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

export class SupabaseRpcError extends Error {
  constructor(public fn: string, public status: number, public body: string) {
    super(`Supabase RPC ${fn} failed (${status}): ${body}`);
  }
  /** The message passed to `raise exception` in the SQL function, if any. */
  get dbMessage(): string | null {
    try { return (JSON.parse(this.body) as { message?: string }).message ?? null; } catch { return null; }
  }
}

export async function rpc<T>(target: SupabaseTarget, fn: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${target.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headersFor(target.key),
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!response.ok) throw new SupabaseRpcError(fn, response.status, await response.text());
  return response.json() as Promise<T>;
}

/** PATCH rows matching `path`'s filters and return the updated rows (empty when nothing matched). */
export async function restPatch<T>(target: SupabaseTarget, path: string, values: Record<string, unknown>): Promise<T[]> {
  const response = await fetch(`${target.url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...headersFor(target.key), prefer: 'return=representation' },
    body: JSON.stringify(values),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase PATCH ${path.split('?')[0]} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T[]>;
}

/** Uploads a file to a Storage bucket (server only; the secret key bypasses Storage policies). */
export async function storageUpload(target: SupabaseTarget, bucket: string, objectPath: string, body: Uint8Array, contentType: string): Promise<void> {
  const headers = headersFor(target.key);
  delete headers['content-type'];
  const response = await fetch(`${target.url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': contentType, 'cache-control': '31536000', 'x-upsert': 'true' },
    body: Buffer.from(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Storage upload ${objectPath} failed (${response.status}): ${await response.text()}`);
}

export function storagePublicUrl(target: SupabaseTarget, bucket: string, objectPath: string): string {
  return `${target.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/** INSERT one row and return it. */
export async function restInsert<T>(target: SupabaseTarget, table: string, values: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${target.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headersFor(target.key), prefer: 'return=representation' },
    body: JSON.stringify(values),
    cache: 'no-store',
  });
  if (!response.ok) throw new SupabaseRpcError(`insert ${table}`, response.status, await response.text());
  return ((await response.json()) as T[])[0];
}

/** A temporary download link for a private Storage file, or null if the file doesn't exist. */
export async function storageSignedUrl(target: SupabaseTarget, bucket: string, objectPath: string, expiresIn = 3600): Promise<string | null> {
  const response = await fetch(`${target.url}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: headersFor(target.key),
    body: JSON.stringify({ expiresIn }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const { signedURL } = (await response.json()) as { signedURL?: string };
  return signedURL ? `${target.url}/storage/v1${signedURL}` : null;
}

/** Lists files under a folder (up to 1000), oldest first. */
export async function storageList(target: SupabaseTarget, bucket: string, prefix: string): Promise<{ name: string; created_at: string }[]> {
  const response = await fetch(`${target.url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: headersFor(target.key),
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'created_at', order: 'asc' } }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Storage list ${bucket}/${prefix} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ name: string; created_at: string }[]>;
}

/** Deletes files (paths inside the bucket). */
export async function storageDelete(target: SupabaseTarget, bucket: string, paths: string[]): Promise<void> {
  if (!paths.length) return;
  const response = await fetch(`${target.url}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: headersFor(target.key),
    body: JSON.stringify({ prefixes: paths }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Storage delete in ${bucket} failed (${response.status}): ${await response.text()}`);
}
