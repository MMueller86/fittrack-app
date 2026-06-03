// Auth utilities.
//
// Provides user context extraction for all protected endpoints.
//
// Validates Entra External ID access_token (JWT) from the Authorization header.
// All handlers call `await requireUser(request)` which returns a `UserContext`.
// The userId (from JWT `sub` claim) is used for data isolation; the tier drives
// quota enforcement.

import type { HttpRequest } from '@azure/functions';
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import type { JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserTier = 'free' | 'premium' | 'internal';

export interface UserContext {
  userId: string;
  tier: UserTier;
}

// ---------------------------------------------------------------------------
// JWKS (module-level singleton — jose caches keys internally)
// ---------------------------------------------------------------------------

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    const jwksUri = process.env['AUTH_JWKS_URI'];
    if (!jwksUri) {
      throw new Error('AUTH_JWKS_URI environment variable is required');
    }
    _jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return _jwks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without signature verification.
 * Used only to extract diagnostic claims (e.g. aud) for error logging.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Build the list of accepted audience values from AUTH_AUDIENCE.
 * Entra External ID (CIAM) issues v2 access tokens where `aud` is the bare
 * Application ID GUID — NOT the `api://...` URI. We accept both forms so
 * the backend works regardless of which value is configured.
 */
function buildAudiences(audience: string): string[] {
  if (audience.startsWith('api://')) {
    // Configured as api://GUID[/scope] → also accept bare GUID
    const bare = audience.slice('api://'.length).split('/')[0];
    return bare ? [audience, bare] : [audience];
  }
  // Configured as bare GUID → also accept api://GUID form
  return [audience, `api://${audience}`];
}

/**
 * Extract a Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function parseBearer(request: HttpRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extract the authenticated user context from the request.
 * Validates the Bearer access_token (JWT) and extracts claims.
 * Throws UnauthorizedError if the token is missing, malformed, or invalid.
 */
async function getUserContext(request: HttpRequest): Promise<UserContext> {
  const token = parseBearer(request);
  if (!token) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const issuer = process.env['AUTH_ISSUER'];
  const audience = process.env['AUTH_AUDIENCE'];

  if (!issuer || !audience) {
    throw new Error('AUTH_ISSUER and AUTH_AUDIENCE environment variables are required');
  }

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, getJwks(), {
      issuer,
      audience: buildAudiences(audience),
    });
    payload = result.payload;
  } catch (err: unknown) {
    if (err instanceof joseErrors.JOSEError) {
      // JWT validation failure (expired, wrong audience/issuer, bad signature, etc.)
      // → 401 so the client knows the token is invalid and should re-authenticate.
      // Decode the token's claims (without verification) to include the actual `aud`
      // value in the error — this surfaces in both the response body and server logs.
      const claims = decodeJwtPayload(token);
      const actualAud = claims !== null ? JSON.stringify(claims['aud']) : 'undecodable';
      throw new UnauthorizedError(
        `Invalid token: ${err.message} (token aud=${actualAud}, expected one of ${JSON.stringify(buildAudiences(audience))})`,
      );
    }
    // Non-jose error (e.g., network failure fetching JWKS keys) → re-throw as-is
    // so withHandler returns 500 instead of 401. The client's token is fine;
    // the server side has a transient infrastructure problem.
    throw err;
  }

  const userId = payload.sub;
  if (!userId) {
    throw new UnauthorizedError('Token missing sub claim');
  }

  // Allow specific user IDs to be granted 'internal' tier (unlimited quota).
  // Set INTERNAL_USER_IDS as a comma-separated list in local.settings.json or Azure config.
  const internalIds = (process.env['INTERNAL_USER_IDS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const tier: UserTier = internalIds.includes(userId) ? 'internal' : 'free';

  return { userId, tier };
}

/**
 * Convenience wrapper used by HTTP handlers.
 * Returns UserContext on success, throws UnauthorizedError on failure.
 */
export async function requireUser(request: HttpRequest): Promise<UserContext> {
  return getUserContext(request);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// ---------------------------------------------------------------------------
// Test helpers — allow tests to inject a mock JWKS
// ---------------------------------------------------------------------------

export function _setJwksForTesting(jwks: ReturnType<typeof createRemoteJWKSet> | null): void {
  _jwks = jwks;
}
