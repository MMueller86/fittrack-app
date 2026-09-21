# US-09 Infrastructure and Release Gate

- RecordedAtLocal: 2026-09-18
- OperatorMode: Infrastructure and Release
- Scope: Dev reachability, native impact, and release gates only
- Infrastructure Impact: Dev
- Alpha release: NOT EXECUTED

## Infrastructure decision

- No Bicep change is required.
- No Cosmos container, partition key, migration, or persistence change is required.
- No new Function App application setting is required. The existing Linux Node 20 Function App settings for Storage, Cosmos, authentication, and the renderer remain applicable.
- The Bicep application-setting contract was inspected, but deployed/external Azure application settings were not queried: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`.
- No new Azure resource or resource group was created.
- `infra/` and `_deploy_staging/` had no worktree changes.

## Dev reachability

- The local Azure Functions host was listening on `127.0.0.1:7071`.
- `POST /api/recipes/00000000-0000-0000-0000-000000000000/instagram-render` without credentials returned HTTP `401 Unauthorized` with the expected missing/malformed authorization error.
- This proves local host, route registration, and authentication middleware reachability. An authenticated end-to-end render against a real Dev recipe/blob remains `MANUAL VALIDATION REQUIRED` because no safe test token and recipe fixture were available for this check.
- Focused backend contract/adapter tests passed: 2 files, 13 tests.
- Mobile TypeScript typecheck passed.

## Native and package gate

- `Dev Build Required: YES`.
- Trigger: `mobile/app.config.js` adds the `expo-media-library` config plugin and photo/save permissions; `mobile/package.json` adds `expo-file-system`, `expo-media-library`, and `expo-sharing`.
- Expo config introspection confirmed the media-library plugin and existing camera configuration.
- `npx expo install --check` reports `expo@54.0.36`, expected `~54.0.37`. The proposed automatic fix was declined. No package update was performed. This remains an open compatibility gate.
- Physical-device/native permission and album/share-sheet validation is `MANUAL VALIDATION REQUIRED` and has not been executed.

## Linux renderer gate

- The existing I-IR-1 status remains valid: AC-13 is `UNVERIFIED`.
- A fresh Linux Node 20 x64 staging install and isolated compiled-renderer smoke could not be run on this Windows host because no Linux Node 20 x64, WSL, or Docker environment was available.
- Publication remains blocked until the Linux native-binding and renderer smoke gates pass. A Windows-native installation is not accepted as evidence.

## Dev Build execution

- Profile: `development`
- Platform: `android`
- EAS account: `michi01mueller` (`eas whoami` exit 0)
- Build command: `eas build --profile development --platform android`
- Build command exit: `0`
- Build ID: `0456228c-4221-4b33-a965-92c7198cadd5`
- Build status: `FINISHED`
- Build page: https://expo.dev/accounts/michi01mueller/projects/fittrack/builds/0456228c-4221-4b33-a965-92c7198cadd5
- Android APK artifact: https://expo.dev/artifacts/eas/elG6YVH1BTmijKat_tH0Tdbio7yJ8b17iTj0GnUeWZ8.apk
- `eas build:view 0456228c-4221-4b33-a965-92c7198cadd5 --json`: exit `0`

## Preflight manifest

| Command | Exit | Result |
|---|---:|---|
| `npm run check:encoding` | 0 | Passed. |
| `git diff --check` | 0 | Passed. |
| `cd mobile; npm run typecheck` | 0 | Passed. |
| `cd mobile; npm run test` | 0 | 45 files, 443 tests passed. |
| `cd mobile; npx expo config --type introspect --json` | 0 | Media-library plugin and SDK-54 native modules resolved. |
| `cd mobile; npx expo install --check` | 1 | Known warning: `expo@54.0.36` versus expected `~54.0.37`; automatic fix declined and no dependency change made. |
| `cd mobile; eas whoami` | 0 | Authenticated as `michi01mueller`. |

## Files changed by this workflow

- `infra/release-records/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern_Dev-Gate.md` updated with this manifest.
- No application source, mobile configuration, backend, Bicep, Alpha, or `docs/qa/findings.md` file was changed by the build workflow.
- Existing US-09 worktree changes were preserved and included in the uploaded build archive.

## Release report

```text
Final status:                  SUCCEEDED
Dev Build Required:            YES  [mobile/app.config.js and native Expo package changes]
Dev infrastructure applied:    N/A  [no Bicep change]
Azure Functions deployed:      NO
Health check:                  N/A  [no deployment]
Alpha infrastructure applied:  NO
Expo Dev Build created:        YES  [development / android]
Expo Alpha Build created:      NO
Notes: The Android EAS build finished successfully. EAS reported an Android
partial outage with elevated queue times, but the artifact was produced. The
Expo patch-version warning remains documented; physical-device permission,
album, crop, and share-sheet validation remains a separate manual gate. No
Alpha release, backend deployment, or new Azure resource was executed.
```
