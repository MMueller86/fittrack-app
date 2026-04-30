// Auth utilities.
//
// CURRENT STATE (development stub):
//   - getUserId(request) returns a fixed dev user id ("dev-user").
//   - All protected endpoints call getUserId() so the seam for real auth exists.
//
// PLANNED (M2 — Authentication & Onboarding):
//   - googleValidator  — validate Google ID token via google-auth-library
//   - jwtMiddleware    — validate Bearer accessToken on incoming requests
//   - tokenService     — sign/verify access tokens, hash/validate refresh tokens
//
// When real JWT auth lands, replace the body of getUserId() with token
// extraction + verification logic. The function signature must stay the same
// so no call sites need to change.

import type { HttpRequest } from '@azure/functions';

export const DEV_USER_ID = 'dev-user';

/**
 * Extract the authenticated user id from the request.
 *
 * TODO(M2): Replace this dev stub with real JWT auth.
 *   1. Read `Authorization: Bearer <token>` header.
 *   2. Verify token with tokenService.verifyAccessToken().
 *   3. Return decoded `sub` claim (user id).
 *   4. Throw UnauthorizedError on missing/invalid token; the wrapping
 *      `requireUser()` helper will translate that to a 401 response.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getUserId(_request: HttpRequest): string {
  return DEV_USER_ID;
}

/**
 * Convenience wrapper used by HTTP handlers.
 *
 * TODO(M2): When real auth is wired, this should throw/return 401 on
 * missing or invalid tokens. For now it always succeeds with the dev user.
 */
export function requireUser(request: HttpRequest): { userId: string } {
  return { userId: getUserId(request) };
}
