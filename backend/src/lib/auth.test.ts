import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { HttpRequest } from '@azure/functions';
import { generateKeyPair, SignJWT } from 'jose';

import {
  requireUser,
  parseBearer,
  UnauthorizedError,
  _setJwksForTesting,
} from './auth';

function makeRequest(token?: string): HttpRequest {
  const headers = new Map<string, string>();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return { headers: { get: (k: string) => headers.get(k) ?? null } } as unknown as HttpRequest;
}

describe('auth', () => {
  const TEST_ISSUER = 'https://test-tenant.ciamlogin.com/test-tenant/v2.0';
  const TEST_AUDIENCE = 'api://test-app-id';
  let privateKey: CryptoKey;

  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey as unknown as CryptoKey;
    _setJwksForTesting(async () => keys.publicKey);

    process.env['AUTH_ISSUER'] = TEST_ISSUER;
    process.env['AUTH_AUDIENCE'] = TEST_AUDIENCE;
    process.env['AUTH_JWKS_URI'] = 'https://example.com/keys';
  });

  afterAll(() => {
    delete process.env['AUTH_ISSUER'];
    delete process.env['AUTH_AUDIENCE'];
    delete process.env['AUTH_JWKS_URI'];
    _setJwksForTesting(null);
  });

  async function signToken(claims: Record<string, unknown> = {}, options: { expiresIn?: string; issuer?: string; audience?: string } = {}) {
    return new SignJWT({ sub: 'user-123', ...claims })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(options.issuer ?? TEST_ISSUER)
      .setAudience(options.audience ?? TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '1h')
      .sign(privateKey);
  }

  it('valid token returns UserContext with sub as userId', async () => {
    const token = await signToken({ sub: 'abc-def-123' });
    const ctx = await requireUser(makeRequest(token));
    expect(ctx.userId).toBe('abc-def-123');
    expect(ctx.tier).toBe('free');
  });

  it('missing Authorization header throws UnauthorizedError', async () => {
    await expect(requireUser(makeRequest())).rejects.toThrow(UnauthorizedError);
  });

  it('malformed Bearer throws UnauthorizedError', async () => {
    const req = { headers: { get: () => 'Basic xyz' } } as unknown as HttpRequest;
    await expect(requireUser(req)).rejects.toThrow(UnauthorizedError);
  });

  it('expired token throws UnauthorizedError', async () => {
    const token = await signToken({}, { expiresIn: '-1h' });
    await expect(requireUser(makeRequest(token))).rejects.toThrow(UnauthorizedError);
  });

  it('wrong audience throws UnauthorizedError with diagnostic aud info', async () => {
    const token = await signToken({}, { audience: 'wrong-audience' });
    const err = await requireUser(makeRequest(token)).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedError);
    // Error message must include the actual token aud so the operator can diagnose mismatches
    expect(err.message).toMatch(/token aud=/);
    expect(err.message).toMatch(/"wrong-audience"/);
  });

  it('accepts bare GUID audience when AUTH_AUDIENCE is configured as api://GUID (CIAM compat)', async () => {
    // Entra External ID CIAM issues access tokens with aud = bare GUID,
    // not the api:// URI. AUTH_AUDIENCE may be configured as either form.
    // The backend must accept both.
    const bareGuid = 'test-app-id'; // stripped form of 'api://test-app-id'
    const token = await signToken({}, { audience: bareGuid });
    const ctx = await requireUser(makeRequest(token));
    expect(ctx.userId).toBe('user-123');
  });

  it('wrong issuer throws UnauthorizedError', async () => {
    const token = await signToken({}, { issuer: 'https://evil.example.com' });
    await expect(requireUser(makeRequest(token))).rejects.toThrow(UnauthorizedError);
  });

  it('invalid signature throws UnauthorizedError', async () => {
    // Sign with a different key
    const otherKeys = await generateKeyPair('RS256');
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherKeys.privateKey);

    await expect(requireUser(makeRequest(token))).rejects.toThrow(UnauthorizedError);
  });

  it('token missing sub claim throws UnauthorizedError', async () => {
    // Create a token without sub
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    await expect(requireUser(makeRequest(token))).rejects.toThrow(UnauthorizedError);
  });
});

describe('parseBearer', () => {
  it('returns null when no authorization header', () => {
    const req = { headers: new Map() } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });

  it('extracts token from valid Bearer header', () => {
    const headers = new Map([['authorization', 'Bearer abc123']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBe('abc123');
  });

  it('returns null for malformed authorization header', () => {
    const headers = new Map([['authorization', 'Basic abc123']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });

  it('returns null for empty Bearer value', () => {
    const headers = new Map([['authorization', 'Bearer ']]);
    const req = { headers: { get: (k: string) => headers.get(k) } } as unknown as HttpRequest;
    expect(parseBearer(req)).toBeNull();
  });
});
