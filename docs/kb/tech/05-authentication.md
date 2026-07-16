# Authentication & Authorization

## Provider

Entra External ID (CIAM) — Microsoft's customer identity platform.

- Tenant ID: stored in env vars (not in code)
- CIAM Host: `michaelmuellertestapp.ciamlogin.com`
- Client ID: stored in `EXPO_PUBLIC_AUTH_CLIENT_ID`

## Authentication Flow (Mobile → CIAM → Backend)

```
1. Mobile: expo-auth-session initiates PKCE OAuth2 flow
   - Opens CIAM authorization endpoint in browser
   - Uses scopes: [API_SCOPE, 'openid', 'profile', 'offline_access']

2. CIAM: user authenticates (Google SSO or CIAM native)
   - Returns authorization code

3. Mobile: exchanges code for tokens
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

### `tier` — Env Var (current) / Entra Role (future)

| Tier | Current Assignment | Effect |
|---|---|---|
| `internal` | Listed in `INTERNAL_USER_IDS` env var (comma-separated user IDs) | Unlimited quota via `getLimit()` returning `Infinity` |
| `premium` | [Planned] Entra group/role claim — not yet implemented | Elevated monthly limits |
| `free` | All other users | Standard monthly limits |

Note: `isAdmin` and `tier = 'internal'` both achieve unlimited quota but via different code paths. In practice, admin users are granted via Entra App Role; `INTERNAL_USER_IDS` is a secondary mechanism for cases where Entra role assignment is not convenient (e.g., local dev, CI).

[Open] `premium` tier is planned for a future milestone. The intended mechanism is an Entra group or App Role claim (same pattern as `Admin`). No implementation exists yet.

## Authorization Model

- All user data is scoped by `userId` (partition key in Cosmos)
- No role-based access control beyond tier assignment
- There is no admin UI — internal users get unlimited quota only

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
| `mobile/src/shared/api/client.ts` | Axios interceptors for auth + 429 |
| `backend/src/lib/auth.ts` | JWT validation, `requireUser()` |
