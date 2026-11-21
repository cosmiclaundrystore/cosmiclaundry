import 'server-only';
import { randomBytes } from 'node:crypto';
import { MOCK_CREDENTIALS, payableMode } from './config';

// State for the fake PAYable gateway (PAYABLE_MODE=mock). Local development only.

export type MockSession = {
  id: string;
  body: Record<string, string>;
  payableOrderId: string;
  createdAt: number;
};

type MockState = { tokens: Map<string, number>; sessions: Map<string, MockSession>; seq: number };

export function mockState(): MockState {
  const g = globalThis as typeof globalThis & { __cosmicMockPayable?: MockState };
  g.__cosmicMockPayable ??= { tokens: new Map(), sessions: new Map(), seq: 500000 };
  return g.__cosmicMockPayable;
}

/** True only when the mock gateway may answer. Everything else gets a 404. */
export function mockEnabled(): boolean {
  try { return payableMode() === 'mock'; } catch { return false; }
}

export function mockNotFound(): Response {
  return new Response('Not found', { status: 404 });
}

export function issueMockToken(): string {
  const token = randomBytes(18).toString('base64url');
  mockState().tokens.set(token, Date.now() + 300_000);
  return token;
}

export function mockTokenValid(header: string | null): boolean {
  const token = header?.replace(/^Bearer\s+/i, '') ?? '';
  const expires = mockState().tokens.get(token);
  return expires !== undefined && expires > Date.now();
}

export const MOCK_AUTH_HEADER = Buffer.from(`${MOCK_CREDENTIALS.businessKey}:${MOCK_CREDENTIALS.businessToken}`, 'utf8').toString('base64');
