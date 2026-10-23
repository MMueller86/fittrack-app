# QA Report: Anmeldung im FitTrack-Design ohne Entra-Bestätigungsdialog (WP 5)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md`
- Verdict: `PASS WITH ISSUES`
- Review round: 2 (re-review after fixes for F-1, F-2, F-5; round 1 verdict was `FAIL`)

## Scope

Reviewed: WP 1 (spike result as documented), WP 2 (auth rework: `mobile/src/services/authRedirect.ts`, `mobile/src/modules/auth/{useAuthLogin,loginFlow,pendingLogin,authTexts}.ts`, `mobile/app.config.js`, `mobile/auth-callback-host.json`), WP 3 (minimal login-screen parts in `LoginScreen.tsx`), WP 4 (`infra/modules/staticwebapp.bicep`, `infra/main.bicep`, `infra/parameters/alpha.bicepparam`, `infra/static/auth-relay/**`), KB updates (`docs/kb/tech/03-mobile.md`, `05-authentication.md`, `07-infrastructure.md`), privacy policy edit (`docs/legal/datenschutzerklaerung-alpha.md`, line "Anmeldung").

Out of scope: `infra/static/entra-branding/`, the PO's visual login redesign (`mobile/src/modules/auth/landing/`, `mobile/assets/landing/`, `docs/User Stories/landingpage/`), backend. Backend and shared were not touched, so their tests were not run.

Not performed by QA: any device, Entra, or Azure verification (see Verification Notes). Spike measurements are user-observed and were taken as documented, not re-measured.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 (own FitTrack-design entry UI) | PASS | `LoginScreen.tsx` shows a single "Mit Google anmelden" button (`authTexts.signIn`), loading state, error text plus "Erneut anmelden", privacy/imprint links; no extra dialog (PO-3, D4). `LoginScreen.test.tsx` 5 tests pass. Visual design itself is PO-owned and out of scope. |
| AC-2 (Google sign-in still via Entra) | PASS | `useAuthLogin.ts` uses `expo-auth-session` against the CIAM authorize/token endpoints from `authConfig`; `domain_hint` is off by default (`authRedirect.ts`, D6). |
| AC-3 (automatic return, no Entra dialog) | PASS (user-observed) | Code path: HTTPS redirect default per variant (`authRedirect.ts`), `autoVerify` intent filter (`app.config.js`) with host from `auth-callback-host.json` and `pathPrefix` `/auth/callback/{dev,alpha}`, relay fallback `infra/static/auth-relay/auth/relay.js`. Dialog removal itself is documented only as a PO observation (plan section "Messergebnisse Spike"); see Verification Notes. |
| AC-4 (same profile, data, groups) | PASS (user-observed) | No new app registration; only redirect URIs added (`05-authentication.md`); backend untouched. Plan G2: same `sub`, Admin role and data on Dev (log evidence cited in plan, not re-verified). |
| AC-5 (abort, failed login, failed return handled; retry possible) | PASS | `useAuthLogin.ts`: `fail()` resets phase, timers, pending login and loading; kinds `cancelled/provider/exchange/pending/noReturn` mapped to German texts (`authTexts.ts`), no raw Entra text shown (`loginFlow.mapProviderError`); no reliance on a dismiss event (foreground-return grace `RETURN_GRACE_MS` 4 s plus 10 min hard timer); no automatic restart. `useAuthLogin.test.tsx` (10), `loginFlow.test.ts` (10), `pendingLogin.test.ts` (5) pass. |
| AC-6 (works with the actually used Android builds and signatures) | PASS (user-observed) | `assetlinks.json` contains both packages with one fingerprint each (read from APK signing blocks per plan); intent filter per variant. Alpha and Dev confirmed by the PO only; no adb/log evidence (see Verification Notes). |

Plan conformance: D1 (hybrid redirect: App Link plus relay fallback) implemented; D2 (no Play signing, array extensible) per `07-infrastructure.md`; D3 (one shared SWA, variant paths) implemented; D4/PO-3 (no extra dialog) confirmed in `LoginScreen.tsx`; D5 (pending login) implemented; D6 (`domain_hint` off, no auto-restart) confirmed; PO-2 (`fittrack://auth` stays) confirmed: scheme remains in `app.json`, rollback `EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme` in `authRedirect.ts`, KB marks removal `[Open]`. Spike diagnostics (`AUTH-SPIKE`, `EXPO_PUBLIC_AUTH_PROMPT`) and the `preview-https` eas profile are removed (`git grep` found no matches outside the plan document).

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd mobile && npx vitest run` | 0 | Round 2: 106 files, 993 tests, all passed (round 1: 1 failure in `legalTexts.test.ts`, now green). Auth test files `loginFlow.test.ts` (incl. new "ignores a stray redirect when no pending login exists"), `pendingLogin.test.ts`, `useAuthLogin.test.tsx` (incl. new "ignores a stray redirect without a pending login silently"), `authRedirect.test.ts`, `LoginScreen.test.tsx` pass. Stderr output in the run comes from tests that deliberately trigger error paths. |
| `cd mobile && npx tsc --noEmit` | 0 | No type errors (re-run in round 2). |
| `npm run check:encoding` (repo root) | 0 | "Encoding check passed." (re-run in round 2). Relay HTML verified as valid UTF-8 in round 1. |
| `git grep -n "pending PO approval\|// NEW" -- mobile/src/modules/auth docs/kb/tech/03-mobile.md` | 1 (no matches) | Pending-approval markers are gone (F-2). |
| `git grep -n "console\.\|AUTH-SPIKE" -- mobile/src/modules/auth mobile/src/services/authRedirect.ts` (excluding tests) | 1 (no matches) | Still no logging in the auth path after the F-5 change. |
| `git grep -nEi "(deployment[_-]?token\|api[_-]?key\|client[_-]?secret\|AccountKey=\|SharedAccessSignature\|BEGIN (RSA\|PRIVATE))" -- infra mobile/src mobile/app.config.js mobile/auth-callback-host.json docs/kb/tech` | 0 | Only pre-existing parameter names and the Bicep storage connection string built at deploy time; no literal secrets. `mobile/.env` is gitignored (`.gitignore:30`) and not tracked. No SWA deployment token in the repository. |
| `Select-String console\.\|AUTH-SPIKE\|AUTH_PROMPT` over the non-test auth module files and `authRedirect.ts` | 1 (no matches) | No logging statements in the auth module; no spike remnants. |
| Backend / shared tests | not run | Not touched by this change. |

## Re-check of PKCE/state/single-use after the F-5 change (round 2)

- State mismatch: `loginFlow.ts` `consumeRedirect` returns `{ kind: 'error', error: 'pending' }` when `state` is absent or differs from the stored state; `useAuthLogin.ts` calls `exchangeCodeAsync` only for `kind: 'code'`. Test "fails on state mismatch and does not keep the entry" (`loginFlow.test.ts`). No exchange possible. PASS.
- Single use: `consumePendingLoginDetailed` deletes the entry on every read (valid and invalid) before returning; a second redirect yields `missing` and is ignored without exchange. `claimRedirect` still blocks double delivery of the same code/error. Tests: `pendingLogin.test.ts` "is single-use", `loginFlow.test.ts` "accepts a redirect once...", `useAuthLogin.test.tsx` "ignores a double delivery" and "survives a remount". PASS.
- F-5 behaviour: only status `missing` (never stored or already consumed) is ignored; `invalid` (expired, malformed) and state mismatch still show the `pending` message (tests "fails when the pending login is expired", "shows a retryable error on cold start with an expired pending login"). An ignored redirect never reaches the token endpoint. PASS.
- Startup purge: `loadPendingLogin()` now runs in `.finally` after `getInitialURL()` has been evaluated, so a cold-start expired entry can still report `pending`. PASS.
- Secrets: no logging calls in the auth module (grep above); code and verifier exist only in memory in `RedirectOutcome`; errors are enum kinds. PASS.
- Observation (no finding): if a redirect arrives during the `waiting` phase and the pending entry is gone (e.g. SecureStore read failure returns `missing`), the attempt silently returns to idle without a message; the user can tap sign-in again. Security is unaffected.

## Code review notes (security-relevant, no defect found)

- State/PKCE: `consumeRedirect` consumes the pending login before evaluating (single-use), requires `state` equal to the stored state, evaluates `error` only after the state check, and returns code plus the stored verifier. The token request uses `outcome.redirectUri` taken from the pending login, so it equals the authorize request's `redirect_uri` regardless of the delivery path.
- Double delivery/remount: `phase` ref plus module-level `claimRedirect` set keyed by `code`/`error`; the same redirect arriving via session result, `Linking` event and `getInitialURL` is exchanged at most once. Covered by tests.
- No code, state, verifier or token is logged or put into error state; errors are enum kinds only.
- Pending-login TTL 10 min with clock-skew guard (`createdAt > now + 60 s` rejected); expired or malformed entries are deleted on load.
- Relay: fixed host, variant and package from static page attributes, allowlisted parameters, query removed via `replaceState`, no external resources. SWA headers: CSP `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` on callback routes and `relay.js`. No open redirect found. Intent filter, host, path and package are consistent with `assetlinks.json` and the relay.
- Bicep: Free SKU, only in alpha parameters, region constrained to Free-supported regions, no secrets.

## Verification Notes

- State: `MANUAL VALIDATION REQUIRED`
  - Reason: no device, adb, or Entra access.
  - Manual action: on the final (post-WP 2) Dev and Alpha builds, sign in; expect direct return into the app with no Entra dialog and no extra tap. Result: ______
- State: `UNVERIFIED`
  - App Link verification state (`adb shell pm get-app-links com.fittrack.app` and `.dev`, expect `verified`). Reason: adb unavailable. Result: ______
  - Whether the final (post-WP 2) builds were installed and tested by the PO. Reason: not documented. Result: ______
  - Cold start (kill app during open Custom Tab, then complete login; expect pending login restored; with expired or missing entry expect the `pending` message plus "Erneut anmelden"). Reason: no device; PO waived the manual T10 and unit tests cover the logic. Result: ______
  - T8/T11: Dev and Alpha installed in parallel without an app chooser; old `fittrack://auth` build and new build on the same device and account. Reason: no device. Result: ______
  - Rollback: build with `EXPO_PUBLIC_AUTH_REDIRECT_MODE=scheme` completes a login via `fittrack://auth`. Reason: no build or device; logic covered by `authRedirect.test.ts`. Result: ______
  - Relay page in a real browser (Network tab shows no third-party requests, response headers as in `staticwebapp.config.json`, query removed from the address bar, fallback button after 2.5 s). Reason: no network or browser access in this review. Result: ______
  - Entra redirect URIs for alpha and dev (portal state; PO screenshot only), Entra sign-in logs, whether Azure SWA logs URL queries. Reason: no portal or log access. The policy wording already states that Azure may process access data.
  - Alpha-build logs and Alpha-side evidence for G1b (user-observed only).

## Repository state hygiene (nothing committed)

Belonging to this work:
- Modified: `docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/tech/05-authentication.md`, `docs/kb/tech/07-infrastructure.md`, `docs/legal/datenschutzerklaerung-alpha.md`, `infra/main.bicep`, `infra/parameters/alpha.bicepparam`, `mobile/app.config.js`, `mobile/src/modules/auth/LoginScreen.tsx`, `mobile/src/modules/auth/LoginScreen.test.tsx`.
- Untracked: `infra/modules/staticwebapp.bicep`, `infra/static/auth-relay/**`, `mobile/auth-callback-host.json`, `mobile/src/modules/auth/{authTexts.ts,loginFlow.ts,loginFlow.test.ts,pendingLogin.ts,pendingLogin.test.ts,useAuthLogin.ts,useAuthLogin.test.tsx}`, `mobile/src/services/authRedirect.ts`, `mobile/src/services/authRedirect.test.ts`.

Unrelated or out of scope:
- Modified: `.github/instructions/infra-release.instructions.md` (health-check section changed to `/api/health` and Instagram handler names; not related to login, see F-3).
- Untracked: `infra/static/entra-branding/` (listed as out of scope), `docs/User Stories/landingpage/`, `mobile/assets/landing/`, `mobile/src/modules/auth/landing/` (PO visual redesign). Note: the tracked file `LoginScreen.tsx` imports `./landing/GoogleGlyph` and `./landing/LandingPager`, so it cannot be committed without the untracked `landing/` files (F-4).

## Findings

Finding key: F-1
Status: Resolved (round 2)
Resolution evidence: `mobile/src/modules/legal/legalTexts.ts` line 43 now contains the approved "Anmeldung" wording (Google, Azure Static Web Apps relay page, pending login of at most 10 minutes); `legalTexts.test.ts` passes; full mobile suite 993/993 green.
Plan reference: `docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md` section 8.5 (policy state) and section 10
Acceptance criterion: N/A (consistency and test suite)
Description: The in-app embedded privacy text is out of sync with the approved policy. `docs/legal/datenschutzerklaerung-alpha.md` line 31 was updated, but `mobile/src/modules/legal/legalTexts.ts` line 43 still has the old "Anmeldung" sentence. The app therefore shows users a policy that omits Google, the relay page and the pending login, and the mobile test suite is red.
Criticality: Blocking
Owner: Frontend
Evidence: `cd mobile && npx vitest run` exit 1, 1 failed of 992: `src/modules/legal/legalTexts.test.ts` "matches docs/legal markdown outside approved mobile account-deletion wording" (diff is exactly the "Anmeldung" line). `git grep -n "Deine Anmelde-Tokens liegen" -- mobile` shows the old text only in `legalTexts.ts:43`.
Recommendation: Update the embedded copy in `mobile/src/modules/legal/legalTexts.ts` to the approved wording (docs/legal itself must not be edited by this correction) and re-run the mobile suite.

Finding key: F-2
Status: Resolved (round 2)
Resolution evidence: `git grep "pending PO approval\|// NEW"` over `mobile/src/modules/auth` and `docs/kb/tech/03-mobile.md` returns no matches.
Plan reference: `docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md` WP 3 (texts)
Acceptance criterion: AC-5
Description: `mobile/src/modules/auth/authTexts.ts` still carries the header comment "Wording of the entries marked NEW is pending PO approval" and `// NEW` markers, although the PO has approved all open points. `docs/kb/tech/03-mobile.md` repeats "some wordings are marked pending PO approval in the file". Stale status, no behavioural impact.
Criticality: Non-blocking
Owner: Frontend
Evidence: `authTexts.ts` lines 1, 13-27; `03-mobile.md` login module section.
Recommendation: Remove the pending markers in `authTexts.ts` and the matching sentence in `03-mobile.md`.

Finding key: F-3
Status: Open (unchanged)
Plan reference: N/A
Acceptance criterion: N/A
Description: `.github/instructions/infra-release.instructions.md` carries an uncommitted health-check rewrite unrelated to the login change. It would be mixed into the login change if committed together.
Criticality: Suggestion
Owner: Documentation
Evidence: `git status --short`: ` M .github/instructions/infra-release.instructions.md`; the diff touches only the "Health Check" section.
Recommendation: Commit it separately or confirm its owner before committing the login change.

Finding key: F-4
Status: Open (unchanged)
Plan reference: N/A
Acceptance criterion: AC-1
Description: The tracked `LoginScreen.tsx` depends on the untracked PO redesign files (`mobile/src/modules/auth/landing/`, `mobile/assets/landing/`). A commit of the login change without them breaks the build.
Criticality: Suggestion
Owner: Frontend
Evidence: `LoginScreen.tsx` imports `./landing/GoogleGlyph` and `./landing/LandingPager`; `git status` lists `landing/` as untracked.
Recommendation: Commit `landing/` and `mobile/assets/landing/` together with `LoginScreen.tsx`, or keep the screen change out of the login commit.

Finding key: F-5
Status: Resolved (round 2); the optional "clear pending login on logout" part is not implemented (entry is single-use and expires after 10 minutes)
Resolution evidence: `loginFlow.ts` `consumeRedirect` returns `ignore` for a missing entry and `useAuthLogin.ts` returns to idle without `fail()`; tests "ignores a stray redirect when no pending login exists" and "ignores a stray redirect without a pending login silently"; expired, malformed and mismatching entries still report `pending`; startup purge runs after cold-start evaluation. See the PKCE re-check section.
Plan reference: `docs/User Stories/Auth/PLAN_US_Anmeldung-im-FitTrack-Design.md` section 8.4, question 6
Acceptance criterion: AC-5
Description: A stray or replayed redirect URL matching the redirect URI while no login is in progress (phase idle, no pending login) calls `fail('pending')` and shows the "Anmeldung konnte nicht abgeschlossen werden" error. Not a security problem (no code is exchanged without a matching pending state), only a cosmetic edge case. Logout and account deletion do not explicitly clear the pending login (expires after 10 min).
Criticality: Suggestion
Owner: Frontend
Evidence: `useAuthLogin.ts` `handleRedirect` and `loginFlow.ts` `consumeRedirect` (no pending record returns `{ kind: 'error', error: 'pending' }`).
Recommendation: Optional: ignore redirects when idle and no pending login exists (except on cold start); optionally clear the pending login on logout.
