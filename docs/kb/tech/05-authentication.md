# Authentication & Authorization

## Provider

Entra External ID (CIAM) — Microsoft's customer identity platform.

- Tenant ID: stored in env vars (not in code)
- CIAM Host: `michaelmuellertestapp.ciamlogin.com`
- Client ID: stored in `EXPO_PUBLIC_AUTH_CLIENT_ID`

## Authentication Flow (Mobile → CIAM → Backend)

```
1. Mobile: expo-auth-session initiates PKCE OAuth2 flow (useAuthLogin.ts)
   - Persists a pending login (state, code_verifier, redirect_uri) in SecureStore
   - Opens CIAM authorization endpoint in browser
   - redirect_uri: HTTPS App Link https://<static web app host>/auth/callback/<alpha|dev>
     (see "Login Redirect (HTTPS App Link)")
   - Uses scopes: [API_SCOPE, 'openid', 'profile', 'offline_access']

2. CIAM: user authenticates (Google SSO or CIAM native)
   - Redirects with authorization code to the HTTPS redirect URI

3. Mobile: receives the redirect (auth session result, Linking event or cold-start
   initial URL), validates state against the pending login, then exchanges code for tokens
   (code_verifier and redirect_uri taken from the pending login)
   - Access token (short-lived JWT, ~1h)
   - Refresh token (long-lived, for silent renewal)

4. Mobile: stores both tokens in expo-secure-store
   - Keys: 'fittrack_access_token', 'fittrack_refresh_token'

5. Mobile: attaches access token as Bearer on every API request
   - Request interceptor in Axios client (mobile/src/shared/api/client.ts)
   - Proactively refreshes if token expires within 60s buffer

6. Backend: validates access token on every protected request
   - requireUser() in backend/src/lib/auth.ts
   - Verifies signature via JWKS (cached singleton)
   - Validates issuer and audience
   - Extracts sub claim as userId
```

## Login Redirect (HTTPS App Link)

The OAuth redirect URI is `https://<static web app host>/auth/callback/<alpha|dev>`, delivered to the app as an Android App Link (`autoVerify`). The host is defined once in `mobile/auth-callback-host.json` (read by `app.config.js` and `authRedirect.ts`). The variant segment is `dev` for `APP_VARIANT=development`/`EXPO_PUBLIC_APP_VARIANT=development`, otherwise `alpha`.

**Why:** with the custom scheme `fittrack://auth`, Entra shows a confirmation dialog (`AADSTS50199 / CmsiInterrupt`) before redirecting; Entra's safe list covers http/https redirects.

**Hosting:** the Static Web App is defined in `infra/static/auth-relay/`. It serves `/.well-known/assetlinks.json` (package `com.fittrack.app` and `com.fittrack.app.dev` with their signing-certificate fingerprints) and the callback pages `/auth/callback/alpha` and `/auth/callback/dev`.

**Relay fallback:** if Android opens the browser instead of the app, the callback page (`relay.js`) immediately forwards to an `intent://` URL for the fixed host and the fixed package of the page variant (`com.fittrack.app` / `com.fittrack.app.dev`). Only `code`, `state`, `error` and `error_description` are forwarded; the query is removed from the address bar. The page has no storage, no logging and no network access (CSP `default-src 'none'`, `no-store`, `no-referrer`). If the app does not open within 2.5 s, a manual "back to app" link is shown.

**Scheme fallback / rollback:** `fittrack://auth` stays registered in the Entra app registration for older builds and as rollback; `EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme` makes a build use it again. Default (unset or any other value) is HTTPS. `eas.json` `preview` does not set the variable, so it uses HTTPS. [Open] Removal of `fittrack://auth` from Entra requires a Product Owner decision.

**Entra registration:** redirect URIs are registered manually in the Azure portal on the existing app registration (platform "Mobile and desktop applications"). There is no new app registration, so identity (`sub`) and the Admin role are unchanged. The portal state is not verifiable from the repository.

**`domain_hint`:** optional; `EXPO_PUBLIC_AUTH_DOMAIN_HINT` (pattern `[A-Za-z0-9._-]{1,64}`, e.g. `google`) is sent as `domain_hint`. Default is off. Known issues in the Entra external tenant: the Entra error page does not reach the app, and there is no automatic retry.

### Pending login and cold start

`pendingLogin.ts` stores `{ state, codeVerifier, redirectUri, createdAt }` in SecureStore key `fittrack_pending_login`. It is valid for 10 minutes, deleted when read (single-use), purged when expired or malformed, and never logged. Because the redirect may start the app cold (or recreate it), `useAuthLogin` also evaluates `Linking.getInitialURL()` and runtime `Linking` events. `handleRedirect()` exchanges the code at most once (`claimRedirect()` guards double delivery; the pending login is consumed). A state mismatch or missing pending login yields the `pending` error.

### Abort handling

No dismiss/cancel event is relied on. When the app leaves the foreground while waiting and returns without a received redirect, a 4 s grace period (`RETURN_GRACE_MS`) runs; then the attempt is reset with the `noReturn` error. A 10 minute hard timer resets the attempt as well. `access_denied` maps to `cancelled`; other provider errors to `provider`; token exchange failures to `exchange`. User-facing texts live in `authTexts.ts`; the login screen shows the text and an "Erneut anmelden" retry link.

### Verified result (Spike)

User-observed on 2026-10-23: Dev and Alpha builds return directly to the app without the Entra dialog and without an extra tap; same `sub` and Admin role. This is a manual observation, not an automated test.

## Silent Token Refresh

Two-layer refresh strategy in the Axios client:

1. **Proactive:** Before each request, `authService.isTokenExpired()` checks the JWT `exp` field. If within 60s buffer, `refreshAccessToken()` is called silently using the CIAM token endpoint.
2. **Reactive:** If the backend returns 401, the response interceptor attempts one refresh + retry. On a second 401, tokens are cleared and the user is logged out.

[Note] Client-side expiry check is for UX only — the backend always re-validates the token signature.

## Backend Validation (`backend/src/lib/auth.ts`)

- **`requireUser(request)`** — main entry point for all protected handlers
  - Extracts Bearer token from `Authorization` header
  - Verifies JWT signature against JWKS endpoint (`AUTH_JWKS_URI`)
  - JWKS client is a cached singleton (initialized once per cold start)
  - Validates `iss` (issuer) and `aud` (audience — supports both `api://GUID` and bare GUID)
  - Returns `UserContext { userId: string, tier: UserTier }`
  - Throws `UnauthorizedError` on any failure — `withHandler()` converts to 401

- **`UserContext`** — passed to all handlers
  - `userId`: the user's subject (`sub`) claim from the JWT
  - `tier`: `'free' | 'premium' | 'internal'` (see below)

## User Tiers and Admin Flag

`UserContext` carries two independent access signals:

```ts
interface UserContext {
  userId: string;
  tier: UserTier;   // 'free' | 'premium' | 'internal'
  isAdmin: boolean;
}
```

### `isAdmin` — Entra App Role

Extracted from the `roles` claim in the verified JWT:
```ts
const isAdmin = Array.isArray(payload['roles']) && payload['roles'].includes('Admin');
```

Assigned in Azure Entra ID by adding the user to the **Admin App Role** on the FitTrack application registration. No env var needed.

Effect:
- Bypasses all AI feature quotas completely (`quota.ts`: `if (user.isAdmin) return null`)
- Bypasses the 3-regeneration-per-day limit on daily insight
- Authorizes the dedicated `PATCH /api/ai/daily-insight/feedback/status` operational update after normal JWT validation

For this route, the request `userId` selects the target Cosmos partition; it
does not establish the caller identity or bypass the admin check. The status
operation is limited to feedback metadata and cannot read the source Daily
snapshot.

### `tier` — Env Var (current) / Entra Role (future)

| Tier | Current Assignment | Effect |
|---|---|---|
| `internal` | Listed in `INTERNAL_USER_IDS` env var (comma-separated user IDs) | Unlimited quota via `getLimit()` returning `Infinity` |
| `premium` | [Planned] Entra group/role claim — not yet implemented | Elevated monthly limits |
| `free` | All other users | Standard monthly limits |

Note: `isAdmin` and `tier = 'internal'` both achieve unlimited quota but via different code paths. In practice, admin users are granted via Entra App Role; `INTERNAL_USER_IDS` is a secondary mechanism for cases where Entra role assignment is not convenient (e.g., local dev, CI).

[Open] `premium` tier is planned for a future milestone. The intended mechanism is an Entra group or App Role claim (same pattern as `Admin`). No implementation exists yet.

## Authorization Model

- User-owned data remains scoped by the JWT `userId` (the `/userId` Cosmos partition key). Recipe sharing is a narrow exception: only dedicated authenticated community reads, and recipe-reference resolution for favorites/logging, may cross partitions, and only for a recipe whose current visibility is explicitly `community`.
- No role-based access control beyond tier assignment
- There is no admin UI — internal users get unlimited quota only

| Recipe operation | Authorization |
|---|---|
| Owner recipe list/detail/create/update/delete, image management, export, and scale | Authenticated owner only; foreign recipe IDs remain not found |
| Community list/detail/image bytes | Any valid signed-in user, but only for currently published (`visibility: 'community'`) recipes; image requests recheck visibility and require the Bearer token |
| Favorite or recipe log reference | Owner, or another signed-in user while the recipe is currently published; private, deleted, or revoked foreign references cannot be newly opened/logged |

This exception does not relax access to any other user's data or turn a
community recipe into an owner-managed recipe. Setting a recipe private removes
community access but leaves its owner's normal access unchanged. Community
image bytes use the authenticated API proxy, not an anonymous SAS URL; the
ordinary owner image routes retain their existing short-lived SAS contract.

## Authentication by Environment

FitTrack uses the same authentication flow in all environments. There is no local-only auth bypass.

### Alpha / Production (Primary Flow)

Full CIAM + JWKS validation as described above. `isAdmin` comes from the Entra App Role claim.

### Local Development

The auth mechanism is identical — the same CIAM tenant is used locally. The difference is:

- `backend/local.settings.json` contains the same `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE` as Alpha
- The developer's real CIAM tokens are used when running the app against a local backend
- `INTERNAL_USER_IDS` in `local.settings.json` should include the developer's own `userId` to grant unlimited quota during development (avoids hitting quota limits while testing AI features)

### Unit Tests

Backend unit tests that need a `UserContext` use `_setJwksForTesting()` (`backend/src/lib/auth.ts`) to inject a mock JWKS, allowing JWT validation without a real CIAM connection.

```ts
// In test setup:
_setJwksForTesting(mockJwks);
```

This is the only "simplified" auth path — it exists exclusively for automated tests, not for running the app locally.

## Key Files

| File | Purpose |
|---|---|
| `mobile/src/services/authConfig.ts` | CIAM OAuth config (from env vars) |
| `mobile/src/services/authService.ts` | Token storage, refresh, expiry |
| `mobile/src/services/authRedirect.ts` | Redirect URI (HTTPS/scheme mode) and optional `domain_hint` |
| `mobile/src/modules/auth/useAuthLogin.ts` | Login hook: PKCE request, redirect handling, abort handling |
| `mobile/src/modules/auth/pendingLogin.ts` | Pending login in SecureStore (10 min, single-use) |
| `mobile/src/modules/auth/loginFlow.ts` | Redirect parsing, state check, error mapping, double-delivery guard |
| `mobile/src/modules/auth/authTexts.ts` | User-facing login texts and error messages |
| `mobile/auth-callback-host.json` | Static Web App host for the HTTPS redirect / App Link |
| `infra/static/auth-relay/` | Static Web App: assetlinks.json, callback/relay pages |
| `mobile/src/shared/api/client.ts` | Axios interceptors for auth + 429 |
| `backend/src/lib/auth.ts` | JWT validation, `requireUser()` |

## Profile Deletion Guard

After validating the JWT, `requireUser()` checks the short-lived per-user
deletion lease for the verified `sub`. New protected HTTP requests are rejected
with retryable `409 profile_deletion_in_progress` while the lease is active.
Only `DELETE /api/profile` bypasses that admission check so it can acquire the
lease or report a concurrent deletion. The lease in `aiInsights` is only
admission/concurrency state; the HTTP wrapper does not register or renew
operation tokens, and repositories do not re-check the lease after a request
has been admitted.

Work admitted before lease acquisition is not cancelled, drained, or awaited.
It may finish a write after `204` and after lock release; this late-write risk
is an accepted limitation, not a completion guarantee. The enrichment
scheduler checks the lease before enqueueing each user's item. The queue worker
checks at start and rejects locked work before loading the library item or
calling AI; it does not coordinate work already admitted before the lock.
The five-minute TTL lease contains no operation list, phase, progress, choice,
journal, or recovery state. A failed deletion request can be retried with the
same usable session and complete request body.

Successful FitTrack data deletion does not call Microsoft Graph and does not
delete, disable, or revoke the Entra External ID identity. Any required identity
follow-up is an internal manual Product Owner task, not an end-user action.

### Mobile cleanup after `204`

After the backend returns `204`, Mobile makes one best-effort attempt to remove
the wizard marker, both per-datatype Health Connect sync-state keys, the local
sync log, and both SecureStore tokens, then logs out even if cleanup partially fails. A partial
failure displays a transient, one-time notice. Local cleanup is not durably
retried and does not repeat `DELETE /api/profile`; force-closing the app can
leave local token or sync state. Health Connect data already written and
permissions are unchanged.

See [`tech/02-backend.md`](02-backend.md#profile-deletion) for the deletion
scope and the accepted pre-lock late-write residual.
