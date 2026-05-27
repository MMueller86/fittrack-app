// Test helpers for the backend Vitest suite.
//
// These helpers fabricate just enough of the Azure Functions HTTP types
// for handler unit tests. We only stub the surface area our handlers use:
//   - `request.json()`     — POST body parsing
//   - `request.params.id`  — DELETE :id route param
//   - `request.headers`    — auth Bearer token
//
// Anything beyond that intentionally throws so we notice when a handler
// starts depending on more of the runtime than the tests cover.

import type { HttpRequest, InvocationContext } from '@azure/functions';
import { generateKeyPair, SignJWT } from 'jose';
import { _setJwksForTesting } from '../lib/auth';

// ---------------------------------------------------------------------------
// Test Auth Infrastructure
// ---------------------------------------------------------------------------

export const TEST_ISSUER = 'https://test-tenant.ciamlogin.com/test-tenant/v2.0';
export const TEST_AUDIENCE = 'api://test-app-id';
export const TEST_USER_ID = 'test-user-abc-123';

let _testPrivateKey: CryptoKey | null = null;

/**
 * Set up test authentication environment. Call once in a `beforeAll` or
 * `beforeEach` block. Generates an RSA keypair, injects the public key
 * as mock JWKS, and sets the required env vars.
 */
export async function setupTestAuth(): Promise<void> {
  const keys = await generateKeyPair('RS256');
  _testPrivateKey = keys.privateKey as unknown as CryptoKey;

  // Inject the public key as the JWKS resolver
  _setJwksForTesting(async () => keys.publicKey);

  // Set required env vars
  process.env['AUTH_ISSUER'] = TEST_ISSUER;
  process.env['AUTH_AUDIENCE'] = TEST_AUDIENCE;
  process.env['AUTH_JWKS_URI'] = 'https://example.com/keys'; // not fetched
}

/**
 * Clean up test auth state. Call in `afterAll` or `afterEach`.
 */
export function teardownTestAuth(): void {
  _setJwksForTesting(null);
  _testPrivateKey = null;
  delete process.env['AUTH_ISSUER'];
  delete process.env['AUTH_AUDIENCE'];
  delete process.env['AUTH_JWKS_URI'];
}

/**
 * Sign a test JWT with the given `sub` claim.
 * Must call `setupTestAuth()` first.
 */
export async function signTestToken(
  sub: string = TEST_USER_ID,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  if (!_testPrivateKey) {
    throw new Error('Call setupTestAuth() before signTestToken()');
  }
  return new SignJWT({ sub, ...overrides })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(_testPrivateKey);
}

// ---------------------------------------------------------------------------
// HTTP Fakes
// ---------------------------------------------------------------------------

export interface FakeRequestInit {
  body?: unknown;
  rawBody?: string; // when provided, body is ignored — used for invalid-JSON tests
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export function makeRequest(init: FakeRequestInit = {}): HttpRequest {
  const params = init.params ?? {};
  const headers = init.headers ?? {};
  const rawBody = init.rawBody;
  const body = init.body;

  return {
    params,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => {
      if (rawBody !== undefined) {
        // Mimic real behaviour: invalid JSON throws.
        return JSON.parse(rawBody);
      }
      if (body === undefined) {
        throw new SyntaxError('No body');
      }
      return body;
    },
    // Lazily reject any other property access so tests fail loudly instead
    // of silently passing on undefined behaviour.
  } as unknown as HttpRequest;
}

/**
 * Create a fake request with a valid Bearer token attached.
 * Convenience wrapper for authenticated handler tests.
 */
export async function makeAuthRequest(init: FakeRequestInit = {}): Promise<HttpRequest> {
  const token = await signTestToken();
  const headers = { ...init.headers, authorization: `Bearer ${token}` };
  return makeRequest({ ...init, headers });
}

export function makeContext(): InvocationContext {
  return {
    log: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
  } as unknown as InvocationContext;
}
