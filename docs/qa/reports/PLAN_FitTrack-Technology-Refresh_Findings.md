# QA Report: FitTrack Technology Refresh, Findings Gate (WP-QA-02)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` rev 2026-10-30-02 (section 0 with PO-1..PO-5, section 13a, WP-QA-02, AC-8, AC-19, AC-20)
- Review date: 2026-10-30
- Verdict: `PASS WITH ISSUES`

## Scope

Reviewed WP-QA-02: remaining audit findings against the Product Owner exceptions PO-1 (= D) and PO-2 (= C), manifest/lockfile diff since Phase 0, all executable suites, handoff completeness for WP-BE-01, -02, -03, -05, -06, -08 and WP-FE-01, -02 (AC-20), the Linux canvas evidence (PO-5), and the manual device checklist.

All checks below were executed independently on 2026-10-30 (Windows x64, Node `24.22.1`, npm `12.2.1`, branch `chore/fittrack-technology-refresh-phase-0`, HEAD `cea53b6`), not taken from handoffs. Worktree during review: only `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` is modified (not by QA); QA changed only this report. No production code, plan, or test was changed. Not run, by instruction: prompt evals, deploy, commit/push, Azure operations, EAS builds. Not run for lack of environment: Cosmos contract tests, `smoke:android-debug`, off-import scripts.

Out of scope: WP-BE-07, WP-INFRA-01/02, WP-BE-04 (no handoffs yet), AC-1..AC-7, AC-9..AC-18 (covered by Phase 0 gate or later gates).

Diff basis: no single commit equals the Phase 0 gate state. The Phase 0 PASS (2026-10-29) was issued on `23e92ff` plus uncommitted worktree changes; those changes were committed together with the upgrades in `bce9fe6`. Basis used here: `23e92ff` (last commit before `bce9fe6`, 2026-10-28); range `23e92ff..HEAD`.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-8 | PASS WITH ISSUES | Root `npm ls --all` exit 0. Root `npm audit` = 12 findings, all covered by PO-1 / PO-2 with ID, path, reachability, upstream proof and date (see Exceptions). Direct dependencies are not all at latest and no deferral list exists: finding F-02. `@types/sharp` removed; TypeScript `7.0.2`. |
| AC-19 | PASS WITH ISSUES | Staging `npm audit --omit=dev` = 0. Root audit 12 findings (5 low, 4 moderate, 3 high), exactly the expected set, no other finding. No `--force`, no downgrade, one pre-existing targeted override. Parity PASS after the last change. Issues: F-01 (Linux staging smoke), F-02. |
| AC-20 | PASS WITH ISSUES | Handoffs exist for BE-01, -02, -03, -05, -06, -08, FE-01, -02 with commands, exit codes and numbers; minor gaps and stale statements: F-03. BE-07, INFRA-01, INFRA-02 pending as stated by the plan. |
| AC-4 | UNVERIFIED (partial) | Graphs valid, no satori/fflate in lockfiles. Linux evidence only via PO statement; no staging-install smoke in CI: F-01. Reviewed only as part of PO-5. |
| AC-1..AC-3, AC-5..AC-7, AC-9..AC-18 | N/A | Not part of WP-QA-02. Regression indicators re-run here: typecheck, all suites, `build:verify`, parity, mobile smokes, all green. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm ci --dry-run` (root) | 0 | "up to date"; lockfile consistent. |
| `npm ls --all` (root) | 0 | No invalid/missing/extraneous packages. |
| `npm ls --all` (`_deploy_staging`) | 0 | Valid graph. |
| `npm audit --omit=dev` (`_deploy_staging`) | 0 | 0 vulnerabilities. |
| `npm audit --json` (root) | 1 | 12 findings: 0 critical, 3 high, 4 moderate, 5 low, 0 info (matches expectation). |
| `npm outdated --workspaces --include-workspace-root` / `npm outdated` (`_deploy_staging`) | 1 / 1 | Informational; see F-02. |
| `npm run typecheck --workspace=backend` / `shared` / `mobile` | 0 / 0 / 0 | 0 errors each (TypeScript 7.0.2). |
| `npm run build:verify --workspace=backend` | 0 | "All checks passed". |
| `npx vitest run` (`shared`, JSON reporter) | 0 | 10 files / 466 tests passed. |
| `npx vitest run` (`backend`, JSON reporter) | 0 | 84 files / 2,709 tests passed. |
| `npx vitest run` (`mobile`, JSON reporter) | 0 | 108 files / 1,002 tests passed. |
| `node scripts/check-test-parity.mjs --shared … --backend … --mobile …` | 0 | PASS: shared 10/466, backend 84/2709, mobile 108/1002; equals `scripts/test-baseline.json` (asOf 2026-10-30). |
| `npm run test:scripts` | 0 | 27 pass, 0 fail, 0 skipped. |
| `npm run test:startup --workspace=backend` | 0 | 28 pass, 0 fail, 0 skipped. |
| `npm run check:encoding` | 0 | Passed. |
| `npm run smoke:bundle --workspace=mobile` | 0 | One non-empty Android Hermes bundle (5.9 MB). |
| `npm run smoke:manifest --workspace=mobile` | 0 | Manifest and Gradle properties match native baseline; `git status` shows no `mobile/android/` change. |
| `npm run smoke:doctor --workspace=mobile` | 0 | expo-doctor 20/20 checks passed. |
| `git diff --check` | 0 | No whitespace errors (only a CRLF notice for the plan file). |
| `git diff --diff-filter=DR 23e92ff HEAD -- '*.test.*'` and added `.skip/.todo/.only` scan | 0 | No test file deleted or renamed; no skip/todo/only added. |

## Exceptions (remaining audit findings, all 12 reconciled)

Per-severity breakdown from `npm audit --json`:
- high (3): `zod`, `@expo/cli`, `expo`
- moderate (4): `uuid`, `@azure/ms-rest-js`, `sequelize`, `azurite`
- low (5): `deepmerge`, `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`

No finding outside these two exceptions. `@azure/identity` / `@azure/msal-node` (GHSA-xcx6-jx8p-x3h5), `decode-uri-component`, `query-string`, `@react-navigation/core` and `@babel/core` no longer appear. Installed: `@azure/identity 4.14.1`, `@azure/msal-node 7.1.2`, `@react-navigation/native 7.5.1`, `core 7.24.0`, `@babel/core 7.29.7`; `decode-uri-component` and `query-string` absent from the lockfile.

### PO-1 = D (time-limited): Azurite chain

| Field | Independent result (2026-10-30) | Matches handoff |
|---|---|---|
| Advisory | GHSA-w5hq-g745-h8pq (`uuid` `<11.1.1`, moderate; propagated to `@azure/ms-rest-js`, `sequelize`, `azurite`) | Yes |
| Path | `npm why uuid`: `@fittrack/backend` (dev) → `azurite@3.37.0` → `@azure/ms-rest-js@2.7.0` / `sequelize@6.37.8` → `uuid@8.3.2` | Yes |
| Reachability | Dev tool only (local storage emulator). `_deploy_staging`: `npm ls uuid azurite` finds neither; staging audit 0. No `azurite`/`sequelize`/`ms-rest-js` import in `backend/src`. | Yes |
| Upstream | `npm view`: `azurite` latest `3.37.0` (declares `sequelize ^6.31.0`, `@azure/ms-rest-js ^2.7.0`), `sequelize` latest `6.37.8`, `@azure/ms-rest-js` latest `2.7.0`, `uuid` latest `14.0.3`. npm offers only the prohibited downgrade `azurite@2.7.1`. | Yes |
| Review date | 2026-10-30 | Yes |

### PO-2 = C (time-limited): Expo chain

| Field | Independent result (2026-10-30) | Matches handoff |
|---|---|---|
| Advisory (zod) | GHSA-mrhx-c7xc-m3w5, range `<4.6.6`, high | Yes |
| Path (zod) | `npm why zod@3.25.76`: `@fittrack/mobile` → `expo@58.0.21` → `@expo/cli@58.1.17` → `zod@3.25.76` (`node_modules/expo/node_modules/zod`). Backend uses `zod 4.6.7` (not affected). | Yes |
| Advisory (deepmerge) | GHSA-gcqx-w48m-w2h4, range `>=4.2.0 <=4.3.1`, low | Yes |
| Path (deepmerge) | `@fittrack/mobile` → `expo@58.0.21` → `@expo/config@58.0.9` → `deepmerge@4.3.1` | Yes |
| Reachability | Build tooling only. `mobile/src` and `shared` import neither `zod` nor `deepmerge`; `@expo/cli` is not part of the app bundle. Bundle contents were not scanned. | Yes (path-based, as stated) |
| Upstream | `npm view`: `expo` latest `58.0.21`, `@expo/cli` latest `58.1.17` (declares `zod ^3.25.76`, `@expo/config ~58.0.9`), `@expo/config` latest `58.0.9` (declares `deepmerge ^4.3.1`), `deepmerge` latest `4.3.1`. npm offers only the prohibited downgrade `expo@51.0.39`. Expo issue tracker and release notes not retrieved (`UNVERIFIED`, same as handoff). | Yes |
| Review date | 2026-10-30 | Yes |

### Manifest and lockfile diff `23e92ff..HEAD`

- Direct dependency specs across 6 manifests: 0 downgrades (all changes are upgrades, additions or removals). Removed: `satori`, `@resvg/resvg-js`, `@types/sharp`, `react-native-vision-camera`, `react-native-image-crop-picker` (the last two: PO-3, outside this plan). `expo@51` and `azurite@2.7.1` not present anywhere.
- Lockfiles: root 538 unchanged, 282 raised, 1 lowered; staging 67 unchanged, 12 raised, 0 lowered. The single lowered entry is hoisting-related: `camelcase` 5.3.1 → 5.0.0, required exactly by `azurite → args@5.0.3` (no advisory).
- `--force` / `--legacy-peer-deps`: no occurrence in manifests, workflows, scripts or `.npmrc`; only unrelated `docker rm --force` in `backend/scripts/start-cosmos-emulator.ps1`.
- `overrides` in all tracked `package.json` files:
  - Root `package.json`: `azurite → @azure/ms-rest-js → form-data: 2.5.6`. Assessment: targeted and nested (one path), pre-existing at the diff basis, installed `form-data 2.5.6` under `@azure/ms-rest-js/node_modules`, no audit finding for `form-data`. Not blanket, not related to remaining exceptions. Acceptable (INFO).
  - Removed since basis: `fflate: 0.7.5` in root and `_deploy_staging` (Satori no longer present).
  - No other `overrides` or `resolutions` in `backend`, `mobile`, `shared`, `tools/off-import`, `_deploy_staging`.

## Verification Notes

- State: `UNVERIFIED (PO-bestätigt)`: CI on `ubuntu-latest` after WP-FE-02, WP-BE-08 part 1, raised baseline and CI corrections. Reason: no access to GitHub runs; the Product Owner reported CI green on 2026-10-30, no run link available. Manual action: add the run link to this report once available.
- State: `UNVERIFIED (PO-bestätigt)`: Linux Node 24 canvas evidence (PO-5). Repository evidence from `.github/workflows/ci.yml`:
  - Job `unit-tests` (`ubuntu-latest`, Node from `.nvmrc` = `24.22.1`) runs the whole backend Vitest suite. It includes renderer tests that execute the real canvas renderer without platform gating: `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts` (asserts PNG, 1080 x 1350, `Buffer`), `golden.test.ts`, `nutrition-layout.test.ts`, `photo.test.ts`, `recipeDetailsTemplate.test.ts` and the structure/metric part of `referenceCorpus.test.ts`. So an `ubuntu-latest` renderer test against `@napi-rs/canvas` exists. Its green result is not independently verifiable.
  - The pixel comparison runs only in job `renderer-reference-pixel-gate` on `windows-2022`; `referenceCorpus.test.ts` is canonical on `win32/x64/Node 24`.
  - The Linux job installs the root workspace (`npm ci`). No CI job installs `_deploy_staging` with `npm ci --omit=dev` and renders there (AC-4); `_deploy_staging/package-lock.json` contains `@napi-rs/canvas-linux-x64-gnu@1.0.13` and `-musl`, but loading is not exercised: F-01.
  - Font-metric differences on Linux versus the Windows-generated corpus are not demonstrated independently.
- State: `UNVERIFIED`: Cosmos contract tests, Android debug assemble (CI only; Windows path-length limit locally); PO-released earlier, not independently verified.
- State: `UNVERIFIED`: Prompt evals were not re-run by instruction (61 tests, exit 0 on 2026-10-30 per handoffs, PO-accepted; live-call character not independently proven). Azurite start under `@azure/identity 4.14.1` only indirectly covered (startup tests 28/28; Functions smoke was not re-run by QA).
- State: `UNVERIFIED`: Release notes of the navigation updates (7.2.2 → 7.5.1) and Expo issue/release notes were not read by the implementation agent and not retrieved by QA.
- INFO: `smoke:manifest` prints `userInterfaceStyle: Install expo-system-ui in your project to enable this feature` for Android. `mobile/app.json` sets `"userInterfaceStyle": "dark"`. `expo-system-ui` is not a dependency at the diff basis either, so this is not a regression introduced by the refresh; the practical effect on device is unverified.
- INFO: Handoffs of BE-06 report the `gpt-4.1-mini` retirement date, the Document Intelligence SDK lifecycle and the Alpha API version as `UNVERIFIED`/`[Open]` (AC-10 scope, not WP-QA-02).
- INFO: Kamerapaketwechsel (`expo-camera`, `expo-image-manipulator`) is outside this plan (PO-3); checklist rows for scan and crop therefore also cover that change.

## Manual Validation Checklist (`MANUAL VALIDATION REQUIRED`)

Prerequisite for all rows: a **new Expo Dev Build** (Expo SDK 58, React Native 0.88.1, React Navigation 7.5.1/core 7.24.0) installed on a physical Android device. The build was not triggered by QA (no EAS build). Compare against the Phase 0 list in `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Phase0.md`.

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
| Login | Dev Build; network; valid CIAM test account; configured redirect host. | Cold-launch, start sign-in, complete the provider flow, follow the callback, force-close and reopen. | Returns to the correct app variant, session established and persists after reopening. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Barcode scan | Physical device with camera, camera permission, known test barcode, catalog reachable. | Open Nutrition, start barcode scan, grant permission, scan the barcode. | Camera preview opens (`expo-camera`), barcode is read, matching product shown, no crash. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Label scan | Camera permission, packaging with nutrition label, backend with Document Intelligence/OpenAI configured. | Open label scan, capture the label, review the extraction, edit or cancel, save only via the explicit action. | Review screen shows extracted values and warnings; nothing is saved before confirmation; failures are handled. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Health Connect | Device with Health Connect, granted permissions, test weight/nutrition data. | Enable integration, grant permissions, run weight and nutrition sync, inspect Health Connect and app status. | Authorized records sync to the right data types; status accurate; no unrelated writes. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Photo crop | Camera/photo-library permission, test recipe image. | Choose or capture an image, adjust the crop frame, save, reopen the recipe preview. | Crop (`expo-image-manipulator`) works; the saved preview matches the selected crop; no clipping or crash. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Bottom sheets and animations | Representative Nutrition and Profile flows; Reanimated 4.7.1 / Worklets 0.13.0 / Gesture Handler 3.3.0. | Open and dismiss the food-entry hub and edit/review sheets via buttons, gestures, backdrop and Android Back; use the keyboard where applicable. | Sheets and transitions complete smoothly; no stuck states, overlap, clipped controls or broken dismissal. | `MANUAL VALIDATION REQUIRED` – not performed. |
| App Link | Dev Build for the intended variant; verified callback host; browser and CIAM test account. | Open the configured HTTPS callback link externally; complete a sign-in callback. | Android resolves the link to FitTrack and the callback reaches the correct auth route. | `MANUAL VALIDATION REQUIRED` – not performed. |
| Navigation and deep link (new, after React Navigation update) | Dev Build; signed-in test account; a deep link into a nested screen. | Switch all bottom tabs; push and pop stack screens; use hardware Back and swipe-back; open an in-app deep link while the app is in foreground, background and killed state; inspect URL parameters on the target screen. | Tab and stack navigation behave as before the update; deep links open the right screen with correct parameters (the `query-string` parsing path was removed from `@react-navigation/core`); no blank screen, loop or crash. | `MANUAL VALIDATION REQUIRED` – not performed. |

## Findings

Classification note: findings use the repository scale (Blocking, Non-blocking, Suggestion). Informational observations are listed under Verification Notes and Exceptions. The accepted PO exceptions are not findings.

Finding key: F-01
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` (PO-5, WP-BE-02, section 0)
Acceptance criterion: AC-4
Description: No CI job renders a PNG against the standalone `_deploy_staging` install (`npm ci --omit=dev`) on Linux. The only Linux renderer evidence is the root-workspace unit-test job. Loading of `@napi-rs/canvas-linux-x64-gnu` from the staging install, bundled fonts and assets, and a non-empty 1080 x 1350 PNG from the deployable artifact are not exercised. `allowScripts` sets `@napi-rs/canvas: false` so a missing prebuilt binary would not be rebuilt at install time.
Criticality: Non-blocking
Owner: Backend
Evidence: `.github/workflows/ci.yml` (no `_deploy_staging` reference; jobs `unit-tests`, `functions-host-smoke`, `mobile-smokes`, `android-debug-assemble`, `renderer-reference-pixel-gate` (windows-2022), `contract-tests`); `_deploy_staging/package-lock.json` lists the Linux binary packages; `backend/src/lib/instagramRenderer/__tests__/smoke.test.ts`. CI result itself is `UNVERIFIED (PO-bestätigt)`.
Recommendation: Add a Linux CI step that installs `_deploy_staging` with `npm ci --omit=dev`, builds or syncs `dist`, and renders one fixture, asserting PNG, 1080 x 1350 and non-empty. Attach the run link to this report.

Finding key: F-02
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` (AC-8, section 18)
Acceptance criterion: AC-8
Description: Several direct dependencies are not at the latest stable version and no deferral list with reason, responsible reviewer and review date exists in the plan or handoffs. QA rule on dependency versions applies (`npm view`). Observed on 2026-10-30 (`npm outdated`, `npm view ... time`):
- Newer version in the declared range, lockfile behind: `axios` 1.20.0 → 1.21.0 (published 2026-10-27), `zustand` 5.0.12 → 5.0.16, `react-native-health-connect` 4.1.2 → 4.1.3, `react-test-renderer` 19.3.0 → 19.3.1.
- Newer version outside the declared range: `@napi-rs/canvas` `~1.0.13` → 1.1.0 (published 2026-10-30 06:20Z, after the plan snapshot), `pixelmatch` `~7.2.0` → 8.0.0, `lucide-static` 1.46.0 → 1.65.0, `@tabler/icons` 3.46.0 → 3.50.0, `@types/node` 24.19.2 → 26.6.6 (Node 24 is the target, plausible reason), `@react-native-async-storage/async-storage` 2.2.0 (pinned) → 3.1.1.
- Expo-pinned (`npx expo install --check` passes per FE-01/FE-02 handoffs): `react` 19.3.0 → 19.3.1, `react-native-gesture-handler` 3.3.0 → 3.4.0, `react-native-safe-area-context` 5.10.1 → 5.11.0, `react-native-worklets` 0.13.0 → 0.13.1; reason plausible but not recorded.
Criticality: Non-blocking
Owner: Planner
Evidence: `npm outdated --workspaces --include-workspace-root` (exit 1, 15 rows), `npm outdated` in `_deploy_staging` (3 rows); `npm view <pkg>@<version> time`; no deferral text found in the plan or handoffs for these packages.
Recommendation: Record the deferral list (reason, reviewer, date) in the plan or update the in-range lockfile entries (`npm update`) with full parity; decide on `@napi-rs/canvas 1.1.0` and `pixelmatch 8` explicitly, since renderer output is gated by the reference corpus. WP-BE-07 (Dependabot) will otherwise reopen these.

Finding key: F-03
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-*_Handoff.md`
Acceptance criterion: AC-20
Description: Handoffs are present for all eight packages but contain gaps and stale statements:
- WP-FE-01: `test:scripts` result recorded as "Anzahl nicht erfasst" (number missing; independent run: 27 pass).
- WP-BE-01, -02, -05, -06, -08, FE-01, FE-02 state "nicht committet"; the work is committed (`bce9fe6`, `2763b20`, `cea53b6`) and pushed to `origin/chore/fittrack-technology-refresh-phase-0`.
- WP-FE-02 (Offene Punkte 4) and WP-BE-05 state the test baseline is not raised; `scripts/test-baseline.json` is raised (asOf 2026-10-30, 10/466, 84/2709, 108/1002), as stated in WP-BE-08/-03.
- WP-BE-02 and WP-BE-05 report older root audit counts (27 findings) that differ from the final 12; historical, but unlabeled in BE-02.
- WP-BE-02 expected handoff item "Linux Node 24 smoke" is absent (see F-01).
Criticality: Non-blocking
Owner: Documentation
Evidence: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-FE-01_Handoff.md` (Nachweise table), `..._WP-FE-02_Handoff.md` (Offene Punkte), `..._WP-BE-05_Handoff.md` (Abweichungen), `..._WP-BE-02_Handoff.md`; `git log origin/main..HEAD`; `scripts/test-baseline.json`.
Recommendation: Correct the stale statements and add the missing counts before WP-QA-01. Handoffs for BE-07, INFRA-01, INFRA-02 remain required.

Finding key: F-04
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-BE-03_Handoff.md`
Acceptance criterion: AC-8
Description: `test.poolOptions` is still configured in `backend/vitest.eval.config.mts` (line 45) and `backend/vitest.contract.config.mts` (line 42); Vitest 5 reports the option as removed (DEPRECATED warning per handoff). Not run by QA (evals excluded by instruction, contract needs the emulator); the option has no effect under Vitest 5, so intended pool limits may not apply.
Criticality: Suggestion
Owner: Backend
Evidence: `backend/vitest.eval.config.mts:45`, `backend/vitest.contract.config.mts:42`; WP-BE-03 handoff.
Recommendation: Replace with the Vitest 5 equivalent (`maxWorkers`/`isolate`) and re-run eval and contract configurations in a separate task.
