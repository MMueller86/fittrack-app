# Auth Relay Migration — Release Record (2026-10-26)

## Static Web App

- New auth relay SWA in the Fittrack subscription, region `centralus`, host `red-mushroom-07229ab10.3.azurestaticapps.net`.
- Deployed in WP-1 to WP-3 (see plan `docs/User Stories/plans/PLAN_Auth-Relay-Migration.md`); `mobile/auth-callback-host.json` points to this host.
- `/.well-known/assetlinks.json` returns 200 `application/json` with packages `com.fittrack.app` and `com.fittrack.app.dev` (one fingerprint each).
- The old SWA `swa-fittrack-alpha-ppf5sc` (legacy PRODYNA) stays untouched as a backup.

## Entra

- Redirect URIs `https://red-mushroom-07229ab10.3.azurestaticapps.net/auth/callback/alpha` and `/dev` were added by the user (U-1); the old URIs remain.

## EAS Builds (WP-4)

Both builds started sequentially with `--no-wait` from `mobile/` on account `michi01mueller`; built from the working tree including uncommitted changes (`auth-callback-host.json`, `eas.json`, auth tests). No diff in `mobile/android` or `mobile/app.config.js`.

| Profile | Build ID | Reason |
|---|---|---|
| `preview` | `56f54138-9489-472b-aa2e-96f1639c7e21` | Alpha API `func-fittrack-alpha-wcobsd` and new auth host |
| `development` | `23017929-e7d5-4acb-91de-9d5f6e890197` | Explicit user request: the new auth host is also in the Dev manifest |

Status at record time: both `IN_PROGRESS`.

## assetlinks vs. EAS keystore

- UNVERIFIED: `eas credentials` has no non-interactive mode and `eas build:view` exposes no keystore SHA-256.
- User check: `eas credentials --platform android` (per profile, Keystore), compare SHA-256 with `sha256_cert_fingerprints` in the SWA `assetlinks.json`.
- For `com.fittrack.app.dev` the same check applies; on mismatch the Android App Link is not verified.
