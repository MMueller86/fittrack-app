# QA Report: FitTrack Technology Refresh (WP-QA-01)

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` rev 2026-10-30-02 (section 16, AC-1..AC-20; AC text in section 18)
- Review date: 2026-10-30
- Verdict: `PASS WITH ISSUES`

## Scope

Independent verification of AC-1..AC-20 on the uncommitted worktree (Windows x64, Node `24.22.1`, npm `12.2.1`, branch `chore/fittrack-technology-refresh-phase-0`, HEAD `cea53b6`, diff basis `23e92ff`). The worktree additionally contains the WP-BE-07, WP-INFRA-01 and WP-INFRA-02 results (CI, Dependabot, dependency raises, Bicep API versions, staging renderer smoke, handoffs). QA changed only this report. Not run, by instruction or environment: prompt evals, deploy, commit/push, `az login`, EAS builds, Cosmos contract tests (no emulator), Android assemble (PO-confirmed), Functions host smoke.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `.nvmrc` = `24.22.1`; all 7 CI setup-node steps use `.nvmrc` and `npm@12.2.1`; `engines` `>=24.22.1 <25` / npm `12.2.1`; `@types/node` `^24.0.0` in backend and off-import; no Node-20 pin found by `git grep`. Azure runtime `node`/`24` per `functionapp.bicep` (INFRA-01 handoff). |
| AC-2 | PASS | Staging `npm audit --omit=dev` = 0 (exit 0). `openai ^7.45.1`, `zod ^4.6.7`. `strict: true` count in `backend/src/lib/openai.ts` = 10, equal to base `23e92ff`; `git diff 23e92ff -- backend/src/lib/prompts` touches only eval test/fixture files (see F-03). |
| AC-3 | PASS WITH ISSUES | Backend 84/2,709, AI offline and wire tests, typecheck and `build:verify` green on the final lockfile (see Tests). Prompt evals not re-run (PO accepted the 2026-10-30 run): `UNVERIFIED`. F-03 concerns an eval fixture change. |
| AC-4 | PASS WITH ISSUES | `npm ls --all` root and staging exit 0; no `satori`, `@resvg/resvg-js`, `fflate`, `@types/sharp` in either lockfile (0 matches). Local Windows staging smoke exit 0: PNG 1,917,091 bytes, 1080x1350. New CI job `staging-linux-renderer-smoke` (ubuntu-latest, `npm ci --omit=dev`, audit, renderer smoke) closes the earlier F-01 gap in the repository; its run result is `UNVERIFIED`. Pixel comparison is report-only: F-01. |
| AC-5 | PASS | Expo SDK 58 (`expo ~58.0.21`, RN 0.88.1, React 19.3.0), `expo-doctor` 20/20, mobile typecheck 0 errors, mobile 108/1,002 green, `smoke:bundle` exit 0 (PO-4 = A, intermediate SDKs not required). Expo advisories: PO-2 exceptions only. |
| AC-6 | PASS WITH ISSUES | `smoke:manifest` exit 0 (manifest/Gradle properties match baseline), `mobile/android/` untouched (0 changes; gitignored). Android debug assemble `UNVERIFIED` (PO-confirmed, CI only). Device flows: `MANUAL VALIDATION REQUIRED`. New Dev Build required, not triggered. |
| AC-7 | PASS | No Vitest/Tinypool, Azurite/proxy-addr, shell-quote, decode-uri-component, query-string, `@azure/msal-node` advisories remain; the audit contains only the 12 PO-1/PO-2 findings. All workspaces pass tests and typecheck. |
| AC-8 | PASS WITH ISSUES | Root `npm ls --all` exit 0. Root audit = 12, all within PO-1 (D) / PO-2 (C) with ID, path, reachability, upstream proof, date (see Exceptions); `@types/sharp` removed; TypeScript 7.0.2 (latest). Deferral list with reason exists only in the WP-BE-07 handoff, without responsible reviewer and review date, and is not in the plan; `mongodb` 7.7.0 lags an in-range 7.8.0: F-02. |
| AC-9 | PASS WITH ISSUES | KB, READMEs and release instructions checked by sample: Node 24.22.1, npm 12.2.1, TypeScript 7, Vitest 5, Expo SDK 58, RN 0.88, `openai`/`zod` versions, `@napi-rs/canvas` match manifests; Satori/Resvg/fflate appear only as historical notes or the kept `FONT_OR_SATORI_FAILED` code and `Satori*` type names (documented as contract stability). No deploy/EAS/Bicep-apply performed (no evidence of any). Exception: F-01 (pixel-gate wording). INFO: unversioned local release task runs EAS in the same run (INFRA-01 open point 3). |
| AC-10 | PASS WITH ISSUES | One config source `backend/src/lib/azureOpenAiConfig.ts` (`gpt-4.1-mini`); `git grep` finds no `gpt4o`/`gpt-4o` in `backend/src`, `shared`, `mobile/src`, `infra`, `docs/kb`; `docs/legal/` has no diff and no untracked file; strict schemas unchanged. `gpt-4.1-mini` retirement date, deployed API version `2024-08-01-preview` vs code default `2024-10-21`, and Document Intelligence SDK lifecycle have no Microsoft source retrieved (BE-06 handoff): `UNVERIFIED`. Evals: `UNVERIFIED` (PO-accepted). |
| AC-11 | PASS WITH ISSUES | `ci.yml` parses (8 jobs) and `dependabot.yml` parses (npm `/`, npm `/_deploy_staging`, github-actions `/`); CI has a blocking staging `npm audit --omit=dev`; no `secrets.` reference and no deploy step (only the comment "CI only, no deploy steps" and staging copy). Action versions (`checkout@v7`, `setup-node@v7`, `cache@v6`, `setup-java@v6`), Core Tools 4.16.0 and emulator tag `vnext-EN20261019` rest on the WP-BE-07 handoff (GitHub API/MCR, not re-queried): `UNVERIFIED`. Docker ecosystem omitted: F-04. |
| AC-12 | PASS WITH ISSUES | `az bicep build --stdout --file infra/main.bicep` exit 0 (no file written, no login). Both tmp files deleted (worktree deletion, unstaged). Read-only `what-if` (0 Create/Delete of resources) was executed by the INFRA agent, not re-run by QA (no `az login`): `UNVERIFIED`. API versions raised only to versions with Bicep types (CLI 0.42.1; newer providers exist, BCP081): F-04, F-05. |
| AC-13 | PASS | Baseline 10/466, 84/2,709, 108/1,002 equals the measured counts (0 failed, 0 pending, 0 todo); `check-test-parity.mjs` exit 0; `test:scripts` 27 pass; CI runs shared/backend/mobile tests, scripts, startup, typechecks, `build:verify`, parity. |
| AC-14 | PASS | `openai.wire.test.ts`, `documentIntelligence.wire.test.ts`, `reusableItemsEnrich.wire.test.ts` exist and are green in the 84-file backend run. |
| AC-15 | PASS | Handler-level schema matrices (Phase 0 PASS, 12 route families) plus `zodCompat.test.ts` (Zod 3 wording) green on Zod 4 in the final backend run (2,709). Per-route case tables not recounted. |
| AC-16 | PASS WITH ISSUES | Six fixtures, `manifest.json`, renderer-neutral metrics; structure/metric tests are a hard gate. The pixel comparison is report-only (`referenceCorpus.test.ts` L336), which contradicts KB and CI naming: F-01. Golden change assessed (see Golden Assessment): no weakening. Visual PO review of side-by-side images still open (BE-02 handoff): `MANUAL VALIDATION REQUIRED`. |
| AC-17 | PASS WITH ISSUES | Mobile `smoke:bundle`, `smoke:manifest`, `smoke:doctor` exit 0; `mobile/android/` unchanged; CI wires the host smoke, mobile smokes and Android assemble. Functions host smoke (`/api/health` 200, `/api/diary/meals` 401, function list) not re-run by QA (local Core Tools 4.9.0 vs CI pin 4.16.0): `UNVERIFIED`. |
| AC-18 | PASS WITH ISSUES | All locally executable suites, typechecks, `build:verify`, smokes green. CI run result, Cosmos contract job, Android assemble `UNVERIFIED (PO-bestätigt)`; evals PO-accepted; no test deleted or renamed since `23e92ff`, test counts increased; device checklist below. |
| AC-19 | PASS WITH ISSUES | Staging audit 0; root audit 12 = PO exceptions exactly; no `--force`/`legacy-peer-deps`, no downgrade (`expo@51`, `azurite@2.7.1` absent), one targeted nested override (`azurite → @azure/ms-rest-js → form-data 2.5.6`, installed, no `form-data` finding, pre-existing). Parity after the last change PASS. |
| AC-20 | PASS | Handoffs present for BE-01, -02, -03, -05, -06, -07, -08, FE-01, -02, INFRA-01, -02 (11 files; FE-03 evidence inside FE-02). WP-BE-04 has no handoff file; not part of the requested list. Previous F-03 staleness resolved (see Prior Findings). |

## Tests

Environment: Windows x64, Node `24.22.1`, npm `12.2.1`.

**Group 1: installation, audit, overrides, manifest diff (AC-8, AC-19)**

| Command | Exit code | Result |
|---|---:|---|
| `npm ci --dry-run` (root) | 0 | Lockfile consistent. |
| `npm ls --all` (root) | 0 | Valid graph. |
| `npm ls --all` (`_deploy_staging`) | 0 | Valid graph. |
| `npm audit --omit=dev` (`_deploy_staging`) | 0 | 0 vulnerabilities (target 0). |
| `npm audit --json` (root) | 1 | 12: 0 critical, 3 high, 4 moderate, 5 low. Advisory IDs: GHSA-w5hq-g745-h8pq, GHSA-mrhx-c7xc-m3w5, GHSA-gcqx-w48m-w2h4; no others. |
| `npm view azurite\|expo\|@expo/cli\|@expo/config\|deepmerge\|uuid\|sequelize\|@azure/ms-rest-js version` | 0 | 3.37.0 / 58.0.21 / 58.1.17 / 58.0.9 / 4.3.1 / 14.0.3 / 6.37.8 / 2.7.0. |
| `npm outdated --workspaces --include-workspace-root` | 1 | 9 rows: async-storage 2.2.0 to 3.1.1; `@types/node` 24.19.2 to 26.6.6 (backend, off-import); `mongodb` 7.7.0 to 7.8.0; `react` 19.3.0 to 19.3.1; gesture-handler 3.3.0 to 3.4.0; safe-area-context 5.10.1 to 5.11.0; worklets 0.13.0 to 0.13.1; react-test-renderer 19.3.0 to 19.3.1. |
| `npm outdated` (`_deploy_staging`) | 0 | Nothing outdated. |
| `overrides`/`resolutions` in all tracked `package.json` | 0 | Only root: `azurite → @azure/ms-rest-js → form-data: 2.5.6`. |
| `git grep` for `--force`, `legacy-peer-deps`, `.skip/.todo/.only` | 0 | Only `docker rm --force` (emulator script) and pre-existing credential-gated `describe.skipIf(!hasCredentials)` in eval files. |
| `git diff --name-status 23e92ff -- '*.test.*'` (D/R) | 0 | No deleted or renamed test files. |
| Direct-dependency diff `23e92ff` vs worktree (6 manifests) | 0 | No downgrades. |

**Group 2: typecheck, tests, parity (AC-3, AC-5, AC-13, AC-18)**

| Command | Exit code | Result |
|---|---:|---|
| `npm run typecheck --workspace=shared` / `backend` / `mobile` | 0 / 0 / 0 | 0 errors (TypeScript 7.0.2). |
| `npm test --workspace=shared` | 0 | 10 files / 466 tests. |
| `npm test` (cwd `backend`) | 0 | 84 files / 2,709 tests. |
| `npm test --workspace=mobile` | 0 | 108 files / 1,002 tests. |
| `npm run test:scripts` | 0 | 27 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. |
| `npm run test:startup --workspace=backend` | 0 | 31 pass, 0 fail, 0 skipped, 0 todo. |
| `npm run build:verify --workspace=backend` | 0 | "All checks passed". |
| `npm run check:encoding` | 0 | Passed. |
| `node scripts/check-test-parity.mjs` (Vitest JSON of all 3 packages) | 0 | PASS 10/466, 84/2709, 108/1002 = `scripts/test-baseline.json` (asOf 2026-10-30); 0 failed/pending/todo. |

**Group 3: smokes, guard, YAML, Bicep, renderer (AC-4, AC-6, AC-10, AC-11, AC-12, AC-17)**

| Command | Exit code | Result |
|---|---:|---|
| `npm run smoke:bundle --workspace=mobile` | 0 | 1 non-empty Android bundle. |
| `npm run smoke:manifest --workspace=mobile` | 0 | Manifest and Gradle properties match baseline; `git status mobile/android` = 0 changes. Note: `userInterfaceStyle` hint (expo-system-ui), pre-existing. |
| `npm run smoke:doctor --workspace=mobile` | 0 | 20/20 checks passed. |
| `FITTRACK_PROMPT_GUARD_BASE=HEAD~2 npm run verify:daily-insight-prompt --workspace=backend` | 0 | Guard passed: v31, base releases 18, provider input changed: no. |
| YAML load via `js-yaml` of `ci.yml` and `dependabot.yml` | 0 | Syntax OK; 8 CI jobs; 3 Dependabot entries. No schema validation. |
| `az bicep build --stdout --file infra/main.bicep` | 0 | Output 58,113 chars, no file written; no login. Bicep CLI notice only (0.48.1 available). |
| `node scripts/staging-renderer-smoke.mjs ..\_deploy_staging` (cwd `backend`, after `build:verify`) | 0 | PNG 1,917,091 bytes, 1080x1350 (Windows). |
| `git diff -- docs/legal`, `git status --short docs/legal` | 0 | No change, no untracked file. |

## Exceptions (remaining audit findings, reconciled with PO decisions)

Severity split: high 3 (`zod`, `@expo/cli`, `expo`), moderate 4 (`uuid`, `@azure/ms-rest-js`, `sequelize`, `azurite`), low 5 (`deepmerge`, `@expo/config`, `@expo/metro-config`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`). Review date for all: 2026-10-30.

| Exception | Advisory | Path | Reachability | Upstream proof (`npm view`) |
|---|---|---|---|---|
| PO-1 = D | GHSA-w5hq-g745-h8pq (`uuid <11.1.1`) | `@fittrack/backend` (dev) to `azurite@3.37.0` to `@azure/ms-rest-js@2.7.0` / `sequelize@6.37.8` to `uuid@8.3.2` | Local dev emulator only; not in `_deploy_staging` (audit 0) | `azurite` latest 3.37.0, `@azure/ms-rest-js` latest 2.7.0, `sequelize` latest 6.37.8, `uuid` latest 14.0.3; no patched chain upstream. |
| PO-2 = C | GHSA-mrhx-c7xc-m3w5 (`zod <4.6.6`) | `@fittrack/mobile` to `expo@58.0.21` to `@expo/cli@58.1.17` to `zod@3.25.76` | Build tooling, not in app bundle | `expo` latest 58.0.21, `@expo/cli` latest 58.1.17 (declares `zod ^3.25.76`). |
| PO-2 = C | GHSA-gcqx-w48m-w2h4 (`deepmerge <=4.3.1`) | `expo` to `@expo/config@58.0.9` to `deepmerge@4.3.1` | Build tooling | `@expo/config` latest 58.0.9, `deepmerge` latest 4.3.1. |

Paths are taken from the PO decision text and handoffs and match the installed versions queried here; `npm why` was not re-run in this session. Expo issue tracker and release notes were not retrieved: `UNVERIFIED`. The exceptions are time-limited and need re-review at each Azurite/Expo release.

## AC-8 deferral assessment (critical review)

- Expo-managed (`react`, gesture-handler, safe-area-context, worklets, async-storage): justified; `node_modules/expo/bundledNativeModules.json` pins `react 19.3.0`, `~3.3.0`, `~5.10.1`, `0.13.0`, `2.2.0`, and `expo install --check` passes per handoff. `react-test-renderer` must follow `react`. Accepted, but reason, reviewer and date are only in the WP-BE-07 handoff.
- `@types/node` 24: matches Azure Functions Node 24 runtime. Accepted.
- `@typescript/typescript6 ~6.0.2` (backend, mobile): required for the classic AST API (`nutritionDiaryMutationBoundary.test.ts`, `functions-baseline.mjs`); 6.0.2 is the latest of that package. Accepted as intentional debt; no reviewer/date and no exit criterion.
- `mongodb` 7.7.0 vs in-range 7.8.0: no reason recorded; the handoff statement that all other direct dependencies are current is incorrect (F-02).
- `@napi-rs/canvas` 1.1.0 and `pixelmatch` 8.0.0 are now adopted.

## Golden Assessment

`golden.test.ts` changes `EXPECTED_HISTORICAL_DIFFERING_PIXEL_RATIO` 0.5602764 to 0.5945508 with unchanged `PIXELMATCH_THRESHOLD` 0.1, `MAX_DIFFERING_PIXEL_RATIO` 0.03 and tolerance 0.01; assertion structure unchanged (L81-88). The value pins a deliberate historical difference (the pair must differ above 0.03 and match the pinned ratio), not a release gate. Cause is the pixelmatch 8 colour metric (OKLab instead of YIQ). Assessment: justified metric change, not a weakening. The claim that 7.2 measured 0.5639 on the same pair was not re-measured: `UNVERIFIED`.

## Prior Findings (`PLAN_FitTrack-Technology-Refresh_Findings.md`)

| Prior | Status | Evidence |
|---|---|---|
| F-01 (no Linux staging-install renderer smoke) | Repository part done, CI result open | New `staging-linux-renderer-smoke` job, `backend/scripts/staging-renderer-smoke.mjs` plus test; Windows run exit 0. Linux run `UNVERIFIED`. |
| F-02 (outdated dependencies, no deferral list) | Mostly done, residual open | `@napi-rs/canvas` 1.1.0, `pixelmatch` 8.0.0, `lucide-static` 1.65.0, `@tabler/icons` 3.50.0, `axios` 1.21.0, `zustand` 5.0.16, health-connect 4.1.3 applied; deferrals in WP-BE-07 handoff only; see F-02 below. |
| F-03 (handoff gaps and stale text) | Done | Stale "nicht committet" and baseline statements now carry dated corrections; BE-07, INFRA-01, INFRA-02 handoffs exist. |
| F-04 (`poolOptions` in Vitest configs) | Done | `maxWorkers: 1`, `isolate: false` in `vitest.eval.config.mts` L46-47 and `vitest.contract.config.mts` L43-44; no `poolOptions`. Evals/contract not run (instruction/emulator). |

## Verification Notes

- `UNVERIFIED (PO-bestätigt)`: GitHub CI run on the current state, Cosmos contract tests, Android debug assemble, Linux Node 24 `@napi-rs/canvas` evidence (PO-5). No run link available; add it when provided.
- `UNVERIFIED`: prompt evals (not repeated by instruction); Microsoft sources for `gpt-4.1-mini` retirement, API version `2024-08-01-preview`, Document Intelligence SDK lifecycle; read-only `what-if` result (no `az login`); action and emulator versions beyond the handoff; Functions host smoke; Dependabot validity on GitHub; Expo issue tracker for PO-2.
- INFO: `docs/kb/README.md` states "TypeScript 7 everywhere"; backend and mobile additionally carry `@typescript/typescript6` for AST tests (documented in 08-testing).
- INFO: `docs/kb/Specs/health-connect/implementation-plan.md` mentions SDK 54 (historical spec).
- INFO: replacement of vision-camera / image-crop-picker by `expo-camera` / `expo-image-manipulator` is outside this plan (PO-3).
- INFO: local unversioned release task runs EAS in the same run as Functions publish, contradicting the separate EAS gate (INFRA-01 open point 3); not in the repository.

## Manual Validation Checklist (`MANUAL VALIDATION REQUIRED`)

Prerequisite for all rows: new Expo Dev Build (SDK 58, RN 0.88.1, React Navigation 7.5.1) on a physical Android device; not triggered by QA. Compare with `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Phase0.md`.

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
| Login | Dev Build, network, CIAM test account, callback host | Cold-launch, sign in, follow callback, force-close and reopen | Session established and persists | `MANUAL VALIDATION REQUIRED` |
| Barcode scan | Camera, permission, known barcode | Nutrition, start scan, grant permission, scan | Preview opens (`expo-camera`), product shown, no crash | `MANUAL VALIDATION REQUIRED` |
| Label scan | Camera, label, backend with Document Intelligence/OpenAI | Capture label, review, edit/cancel, save explicitly | Review shows values and warnings; nothing saved before confirmation | `MANUAL VALIDATION REQUIRED` |
| Health Connect | Health Connect, permissions, test data | Enable, grant, sync weight and nutrition | Authorized records sync, status accurate, no unrelated writes | `MANUAL VALIDATION REQUIRED` |
| Photo crop | Camera/library permission, test image | Pick, adjust crop, save, reopen preview | Crop (`expo-image-manipulator`) matches selection | `MANUAL VALIDATION REQUIRED` |
| Bottom sheets and animations | Nutrition and Profile flows; Reanimated 4.7.1, Worklets 0.13.0, Gesture Handler 3.3.0 | Open and dismiss sheets via button, gesture, backdrop, Back | Smooth, no stuck states or clipping | `MANUAL VALIDATION REQUIRED` |
| App Link | Dev Build, verified callback host, browser | Open HTTPS callback link, complete sign-in | Resolves to FitTrack, reaches auth route | `MANUAL VALIDATION REQUIRED` |
| Navigation and deep link | Signed-in account, nested deep link | Switch tabs, push/pop, Back and swipe-back, open deep link foreground/background/killed | Unchanged behaviour, correct parameters, no blank screen or crash | `MANUAL VALIDATION REQUIRED` |
| Renderer visual review (additional) | Side-by-side images via `RENDERER_CORPUS_REVIEW_DIR` | PO reviews all 6 fixtures against the Satori baseline | PO approval recorded | `MANUAL VALIDATION REQUIRED` |

## Findings

No blocking findings. PO-decided exceptions PO-1 and PO-2 are not findings.

Finding key: F-01
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` (AC-16, AC-9)
Acceptance criterion: AC-16
Description: The reference-corpus pixel comparison is report-only (only `Number.isFinite` is asserted; comment "report for human review, not a gate"), while `docs/kb/tech/08-testing.md` ("The hard pixel comparison ... maximum differing pixel ratio 0.03") and the CI job `renderer-reference-pixel-gate` describe it as a hard gate. Only structural and text-layout metrics gate.
Criticality: Non-blocking
Owner: Documentation
Evidence: `backend/src/lib/instagramRenderer/__tests__/referenceCorpus.test.ts` L336-348; `docs/kb/tech/08-testing.md` L172-175; `.github/workflows/ci.yml` job `renderer-reference-pixel-gate`.
Recommendation: Correct KB and job naming to "report", or restore a bounded pixel gate against a Canvas-generated baseline; record the PO decision.

Finding key: F-02
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` (AC-8)
Acceptance criterion: AC-8
Description: Deferrals lack the required responsible reviewer and review date and are recorded only in the WP-BE-07 handoff, not in the plan. The handoff claim "all other direct dependencies current" is wrong: `mongodb` lockfile 7.7.0 while 7.8.0 is in range (off-import).
Criticality: Non-blocking
Owner: Planner
Evidence: `npm outdated --workspaces --include-workspace-root` (mongodb Wanted 7.8.0); `PLAN_FitTrack-Technology-Refresh_WP-BE-07_Handoff.md` (deferral table).
Recommendation: Add the deferral table with reviewer and date to the plan, run `npm update mongodb` with parity, set a re-check trigger for `@typescript/typescript6`.

Finding key: F-03
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-BE-01_Handoff.md`
Acceptance criterion: AC-3
Description: Commit `bce9fe6` changed the eval fixture `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`: the "cook potatoes" contradiction pattern now ignores matches with "und" between "kartoffel" and "8 min", so fewer outputs count as contradictions. The handoff calls it a "Testfixture" without rationale or proof that the accepted eval run used this version.
Criticality: Non-blocking
Owner: Backend
Evidence: `git diff 23e92ff -- backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`; WP-BE-01 handoff. QA did not re-run evals by instruction.
Recommendation: Document why the regex changed and confirm the PO-accepted eval run (61 tests) used this fixture version.

Finding key: F-04
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` (AC-11, AC-12)
Acceptance criterion: AC-11, AC-12
Description: (a) AC-11 requires Docker images in the update automation; `dependabot.yml` omits Docker (no Dockerfile; the Cosmos emulator image is a workflow service, which Dependabot does not track), so the emulator tag has no automated update. (b) AC-12 requires current checked API versions; they stop at versions with Bicep types in CLI 0.42.1 (e.g. Storage 2025-08-01 vs 2026-09-01 available, Cosmos 2025-10-15 vs 2026-03-15). Both are documented in the handoffs.
Criticality: Non-blocking
Owner: Infrastructure
Evidence: `.github/dependabot.yml` L2 comment; WP-INFRA-02 handoff section 1; `az bicep build` exit 0.
Recommendation: Have the PO accept the AC deviations explicitly, add a periodic emulator-tag check, and raise API versions after `az bicep upgrade` with a repeated `what-if`.

Finding key: F-05
Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh_WP-INFRA-02_Handoff.md`
Acceptance criterion: AC-12
Description: The two temp-file deletions are unstaged, and the `what-if` property noise (Cosmos defaults, Storage `staticWebsite`, Function App `deployment.storage.value`) was evaluated with placeholder secrets.
Criticality: Suggestion
Owner: Infrastructure
Evidence: INFRA-02 handoff sections 3-4; `git status --short infra` shows two ` D` entries.
Recommendation: Re-run `what-if` with real secrets before the separately approved apply; include the deletions in the commit.

## Verdict

`PASS WITH ISSUES`: no Blocking finding; the 12 audit findings are fully covered by the PO-decided time-limited exceptions PO-1 and PO-2; remaining items are Non-blocking findings F-01..F-04, one Suggestion, and the `UNVERIFIED` / `MANUAL VALIDATION REQUIRED` checks listed above.
