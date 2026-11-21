import { MOCK_AUTH_HEADER, issueMockToken, mockEnabled, mockNotFound } from '@/lib/payable/mock';

// Fake PAYable: POST /ipg/auth/direct-api (PAYABLE_MODE=mock only).
export async function POST(request: Request) {
  if (!mockEnabled()) return mockNotFound();
  const auth = (request.headers.get('authorization') ?? '').replace(/^Basic\s+/i, '');
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (auth !== MOCK_AUTH_HEADER) return Response.json({ status: 401, error: 'Invalid business key or token' }, { status: 401 });
  if (body?.grant_type !== 'client_credentials' || typeof body.originDomain !== 'string') {
    return Response.json({ status: 400, error: 'grant_type and originDomain are required' }, { status: 400 });
  }
  return Response.json({ accessToken: issueMockToken(), tokenType: 'Bearer', expiresIn: '300', environment: 'mock' });
}
