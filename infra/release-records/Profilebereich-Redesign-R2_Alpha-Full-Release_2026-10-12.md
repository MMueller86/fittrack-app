# Alpha Full Release - Profilebereich Redesign R2

Date: 2026-10-12
Authorization: Explicit user commands "Deploy to Alpha" and "New Alpha Build" (auto approved).
Target: func-fittrack-alpha-ppf5sc in rg-Michael-Mueller; EAS profile `preview` (Android)
Function App last modified (UTC): 2026-10-12T20:00:29Z, state Running
EAS build ID: 3c59c15e-e6cb-40a1-98bd-59ef90beb41f
EAS build logs: https://expo.dev/accounts/michi01mueller/projects/fittrack/builds/3c59c15e-e6cb-40a1-98bd-59ef90beb41f

## Release Report

| Field | Result |
|---|---|
| Dev Build Required | NO; only `mobile/src/**` and backend changed, no native config, `android/`, `package.json` or `eas.json` change |
| Dev infrastructure applied | N/A |
| Azure Functions deployed | YES |
| Health check | PASS; public /api/health HTTP 200, protected /api/diary/meals HTTP 401 |
| Alpha infrastructure applied | N/A; no Bicep changes |
| Expo Dev Build created | N/A |
| Expo Alpha Build created | QUEUED/IN PROGRESS at record time (build submitted successfully, status `in progress`) |

## Executed Workflow

- `az account show`: session active, subscription enabled. Function runtime verified as `Node|22`. `eas whoami`: logged in.
- No changes under `infra/`, `shared/`, `mobile/app.config.js`, `app.json`, `package.json`, `eas.json`, `android/`, `assets/`. Persistence Impact class 0; no migration.
- Clean build (`backend/dist`, `tsconfig.tsbuildinfo` removed), `npm run build:verify` passed (compile, duplicate Function ID check).
- `robocopy backend\dist _deploy_staging\dist /MIR` exit 1 (success). `instagramRecipe.js` and renderer asset `LICENSE.txt` present. Compiled output contains `updateDisplayDenormalized` and `recipeGuardReadFailed`. No `local.settings.json` in staging.
- `func azure functionapp publish func-fittrack-alpha-ppf5sc --build remote --javascript` exit 0; function list incl. HTTP, queue and timer triggers returned.
- Post-deploy probes: health 200, diary/meals 401.
- `eas build --profile preview --platform android --non-interactive --no-wait` exit 0; app version 1.2.0, version code 1 (remote versioning), SDK 54. Preview profile points to the Alpha API.

## Git State

- Branch `main`, HEAD `1e2c4d8` (equals `origin/main`). No commit, no push, no branch created; working tree unchanged.
- Instructions do not require commit/push. EAS reports commit hash `1e2c4d8` (HEAD) for the build, although the R2 changes are uncommitted. EAS CLI packages the local working tree (including uncommitted and untracked files), so the artifact is expected to contain R2; this is not provable from the CLI output alone (see limits).
- Recommended follow-up: commit R2 so that the build is reproducible from a git hash. Not done here because it was not requested.

## Warnings And Verification Limits

- UNVERIFIED: that the EAS archive contains the untracked R2 files (e.g. `mobile/src/modules/legal/`, `mobile/src/modules/profile/*`). Confirm by checking the profile hub, in-app legal texts and favourites summary on the installed build.
- MANUAL VALIDATION REQUIRED: install the APK on a device and run the Alpha flows. No authenticated Alpha smoke was executed (no user token); only unauthenticated probes.
- Cosmos contract tests were not run (no emulator); backend 1729 / mobile 752 unit tests green per QA handoff.
- Installation: open the build page above, scan the QR code or download the APK on the Android device (internal distribution).
- EAS CLI 21.6.0 is outdated (24.12.1 available); proceeded without upgrade.
- Remote npm install may report dependency vulnerabilities (existing behaviour); no remediation performed.
