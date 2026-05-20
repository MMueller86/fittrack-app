// Auth utilities.
//
// Provides user context extraction for all protected endpoints.
//
// Modes (controlled by AUTH_MODE env var):
//   - "dev"   → returns a fixed dev user (default for local development)
//   - "entra" → validates Entra External ID JWT from Authorization header
//               (JWT validation logic implemented in Sprint 2)
//
// All handlers call `requireUser(request)` which returns a `UserContext`.
// The userId is used for data isolation; the tier drives quota enforcement.

import type { HttpRequest } from '@azure/functions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserTier = 'free' | 'premium' | 'internal';
export type AuthSource = 'entra' | 'dev';

export interface UserContext {
  userId: string;
  tier: UserTier;
  source: AuthSource;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEV_USER_ID = 'dev-user';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isDevMode(): boolean {
  const mode = process.env['AUTH_MODE'] ?? 'dev';
  return mode === 'dev';
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
 *
 * In dev mode: always returns the dev user (no token required).
 * In entra mode: validates the Bearer JWT and extracts claims.
 *
 * Throws an Error with message 'Unauthorized' on missing/invalid token
 * in entra mode — the wrapping `withHandler` translates uncaught errors
 * to 500, so callers should use `requireUser()` which catches and returns 401.
 */
function getUserContext(request: HttpRequest): UserContext {
  if (isDevMode()) {
    return { userId: DEV_USER_ID, tier: 'internal', source: 'dev' };
  }

  // Entra mode — validate JWT
  const token = parseBearer(request);
  if (!token) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  // Sprint 2: real JWT validation (jose library, JWKS, issuer/audience check).
  // For now, reject all requests in entra mode until validation is implemented.
  throw new UnauthorizedError('Entra JWT validation not yet implemented');
}

/**
 * Convenience wrapper used by HTTP handlers.
 * Returns UserContext on success, or a 401 HttpResponseInit on failure.
 */
export function requireUser(request: HttpRequest): UserContext {
  try {
    return getUserContext(request);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      throw e; // Re-throw — caught by withHandler or caller
    }
    throw e;
  }
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
