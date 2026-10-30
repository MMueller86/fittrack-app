# QA Report: FitTrack Technology Refresh, Phase 0

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_FitTrack-Technology-Refresh.md` rev 2026-10-27-03 (Phase 0, WP-T0-01..07, WP-QA-00, AC-13..AC-18)
- Review date: 2026-10-29 (final re-review with explicit Product Owner release)
- Verdict: `PASS`

## Scope

Reviewed Phase 0 (WP-T0-01 through WP-T0-07 and WP-QA-00), AC-13 through AC-18 only. The review covers test suites and helpers, fixtures, CI wiring/scripts, test documentation, and type-only native wrappers. Future upgrade packages and all deployment/release operations are out of scope.

The current worktree changes are limited to request-schema tests, the Functions smoke and fixed registration baseline, the prompt-eval fixture matcher, test documentation, and the startup-test script entry. No runtime production behavior or dependency version changed. No test file was removed or renamed, and no test was disabled or weakened; old cases were retained in parameterized matrices or expanded. The package manifest diff only adds the baseline test to `test:startup`; manifests and lockfiles have no dependency-version changes, and `mobile/android/` is unchanged.

Wire/eval inputs are synthetic and use dummy test credentials. The renderer corpus uses only the plan-approved versioned `quarkbroetchen-source.png` or generated transparent pixels; no Alpha-photo path is used by the corpus. No user-data flow changed, so no privacy-policy change is indicated. No Bicep apply, Azure deployment, Functions publish, EAS build, or EAS submit was run. An existing worktree edit to `docs/qa/findings.md` was left untouched.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-13 | PASS | `scripts/test-baseline.json` retains minima shared 10/466, backend 77/1,944, mobile 106/993. Fresh local suites pass at 10/466, 82/2,682, and 106/994. `scripts/check-test-parity.mjs` rejects lower counts and failed, skipped, pending, todo, or other non-passing assertions; `scripts/check-test-parity.test.mjs` covers those failure modes. The latest parity command was reported exit 0, and `.github/workflows/ci.yml` wires all package tests, scripts/startup tests, typechecks, `build:verify`, and parity. |
| AC-14 | PASS | `backend/src/lib/openai.wire.test.ts`, `backend/src/lib/documentIntelligence.wire.test.ts`, and `backend/src/functions/reusableItemsEnrich.wire.test.ts` exercise real SDK clients against local fake HTTP servers. OpenAI coverage checks deployment path, API version/key, strict schema families, empty responses, HTTP 400/429/500, and observed retry counts; Document Intelligence covers synthetic analysis start, polling, result reconstruction, and the existing label parser. Full Backend suite passed (82 files / 2,682 tests). No existing fake-client tests were changed. |
| AC-15 | PASS | Handler-level schema matrices cover the twelve planned route families, including both Instagram render and share-bundle handlers. They exercise valid bounds, required fields, types, limits, enums, extras, null/absent cases, IDs, dates, and field-specific response errors without changing handlers. Focused suite passed 12 files / 1,280 tests. Existing observations remain documented for PO review: AddItem numeric nutrition `null` coerces to zero under Zod 3; the day-type route accepts shape-valid impossible date `2026-02-30`. |
| AC-16 | PASS | `backend/src/lib/instagramRenderer/test-fixtures/reference-corpus/manifest.json` contains six fixtures, renderer-neutral dimensions/content/overflow/text-box metrics, Windows x64 Node 24 as the canonical platform, and pixelmatch tolerance `0.10` / maximum differing ratio `0.03`. `referenceCorpus.test.ts` passed 1/1 on this Windows x64 Node 24.15.0 environment. |
| AC-17 | PASS | Local Functions smoke passed: `/api/health` 200, unauthenticated `/api/diary/meals` 401, and 79 host registrations matched fixed baseline v1. The checked-in sorted baseline and tests reject missing, unexpected, duplicate, malformed, or reordered names. Mobile bundle, manifest, and Doctor smokes passed; Health Connect, Vision Camera, and lazy Crop Picker wrappers use module-derived types, and the mobile typecheck passes. The Windows Android assemble attempt failed on path length; CI-only Android assemble was approved; its result is `PO-RELEASED (not independently verified)`. See Verification Notes. |
| AC-18 | PASS | All locally executable suites, typechecks, `build:verify`, prompt evals, and available smokes passed; dependencies are unchanged, no tests were removed/weakened, and the manual checklist is present. The CI run result, Cosmos contract job, and Android debug assemble could not be independently retrieved; on 2026-10-29 the Product Owner explicitly released them under plan section 9a (`PO-RELEASED (not independently verified)`), which lifts the UNVERIFIED gate block for exactly these items. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm test --workspace=shared -- --reporter=dot --silent` | 0 | 10 files / 466 tests passed. |
| `npm test --workspace=backend -- --reporter=dot --silent` | 0 | 82 files / 2,682 tests passed. |
| `npm test --workspace=mobile -- --reporter=dot --silent` | 0 | 106 files / 994 tests passed. |
| `npm test --workspace=backend -- --reporter=dot --silent src/functions/ai.test.ts src/functions/dailyInsightFeedback.test.ts src/functions/diary.test.ts src/functions/favorites.test.ts src/functions/foodEstimate.test.ts src/functions/foodEstimateBatch.test.ts src/functions/instagramRecipe.test.ts src/functions/profile.test.ts src/functions/recipes.test.ts src/functions/reusableItems.test.ts src/functions/specialActivity.test.ts src/functions/weights.test.ts` | 0 | 12 files / 1,280 tests passed. |
| `node scripts/check-test-parity.mjs --shared <Vitest JSON> --backend <Vitest JSON> --mobile <Vitest JSON>` | 0 (reported) | Latest supplied local run passed; fresh counts exceed all baseline minima. The checker and its failure cases were independently reviewed/tested. |
| `npm run test:scripts` | 0 | 27/27 passed. |
| `npm run test:startup --workspace=backend` | 0 | 28/28 passed; includes 12 fixed-registration-baseline checks. |
| `npm run typecheck --workspace=backend`; `npm run typecheck --workspace=shared`; `npm run typecheck --workspace=mobile` | 0 | All three typechecks passed. |
| `npm run build:verify --workspace=backend` | 0 | Build verification passed. |
| `node scripts/check-encoding.mjs` | 0 | Passed. |
| `npm run test:eval --workspace=backend` | 0 | 5 files / 61 tests passed using synthetic fixtures. |
| `npm test --workspace=backend -- --reporter=dot --silent src/lib/instagramRenderer/__tests__/referenceCorpus.test.ts` | 0 | Canonical-platform renderer gate passed, 1/1. |
| `npm run test:functions-smoke --workspace=backend` | 1; 0; 0 | Earlier startup attempt had transient `Value cannot be null. (Parameter 'provider')`; the reported fresh rerun and this independent rerun passed. Health 200, unauthenticated diary 401, fixed baseline 79/79. |
| `npm run smoke:bundle --workspace=mobile` | 0 | One non-empty Android JavaScript bundle produced. |
| `npm run smoke:manifest --workspace=mobile` | 0 | Isolated prebuild matched manifest/Gradle baseline; no tracked `mobile/android/` changes. |
| `npm run smoke:doctor --workspace=mobile` | 0 | Wrapper passed; 17/18 Doctor checks, with only the documented Expo `54.0.36` vs `~54.0.37` patch mismatch. |
| `npm run smoke:android-debug --workspace=mobile` (prior Windows attempt) | 1 | NDK/Ninja path-length failure in the OneDrive checkout. CI-only verification was approved; result is PO-RELEASED (not independently verified). |
| `npm run test:contract --workspace=backend` / current CI jobs | N/A | Not run locally (Cosmos emulator unavailable); CI run and contract job: PO-RELEASED (not independently verified). |

## Verification Notes

- State: `PO-RELEASED (not independently verified)` for exactly: CI run result, Cosmos contract job, Android debug assemble.
- PO release (plan section 9a): On 2026-10-29 the Product Owner stated he has seen the CI result as green and that it is fine ("Wenn ich sage es passt, dann passt es"). This is recorded as an explicit release. QA did not retrieve or verify these results; no CI link or run identifier is available and none is claimed. The release lifts the UNVERIFIED gate block for these items only.
- Android assemble: The Windows attempt failed on the documented path-length limit; CI-only execution was approved. Result is PO-released, not independently verified; no local retry or EAS operation was made.
- Cosmos contracts: Not run locally (emulator unavailable). Result is PO-released, not independently verified.
- Re-verification (2026-10-29): worktree changes unchanged from prior review; the fixed baseline `backend/scripts/fixtures/functions-baseline.v1.json` exists (`version`, `expectedCount`, `names`); the eval matcher change is a one-line change in `recipeAnalyze.eval.fixtures.ts` only; the only `backend/package.json` diff is the `test:startup` entry; no lockfile, dependency, or `mobile/android/` changes.
- Prompt evaluation: Fresh local `npm run test:eval --workspace=backend` passed 5 files / 61 tests. The only code change is in the test fixture matcher; the production prompt, schema, and runtime behavior are unchanged.
- Characterization notes, not production findings: AddItem numeric nutrition `null` currently coerces to zero; the day-type route accepts the shape-valid impossible date `2026-02-30`. These behaviors were not changed and are reported for PO review.
- Manual device checks were not performed. They are listed below and do not independently lower the verdict.
- Scope check: no dependency versions, lockfiles, production behavior, or tracked Android project files changed. No deployment, Bicep apply, Functions publish, EAS build, or submit occurred. `docs/qa/findings.md` was not edited by QA.

## Manual Validation Checklist

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
| Login | Android Phase-0 build; network access; valid CIAM test account and configured redirect host. | Cold-launch FitTrack, start sign-in, complete the provider flow, follow the callback, then reopen the app. | Authentication returns to the correct app variant, establishes the session, and the signed-in app remains usable after reopening. | `UNVERIFIED` - not performed. |
| Barcode scan | Physical device with camera; camera permission; known test barcode; backend/catalog reachable. | Open Nutrition, launch barcode scanning, grant permission if requested, scan the known product barcode, and inspect the result. | Camera opens and reads the barcode; the matching product result is shown without a crash. | `UNVERIFIED` - not performed. |
| Label scan | Physical device with camera; test food packaging; camera permission; backend plus configured Document Intelligence/OpenAI services. | Open label scan, capture the nutrition label, review the OCR/AI result, edit or cancel it, and save only through the existing explicit user action. | The review screen presents extracted nutrition and warnings for user review; failures remain controlled and no data is saved before confirmation. | `UNVERIFIED` - not performed. |
| Health Connect | Compatible Android device with Health Connect available; app permissions; test account and test weight/meal data. | Enable the integration, grant requested permissions, run the supported weight and nutrition sync, then inspect the corresponding Health Connect records and app status. | Authorized records synchronize to the matching data types; permission/status feedback is accurate and no unrelated records are written. | `UNVERIFIED` - not performed. |
| Photo crop | Physical device; camera/photo-library permission; test recipe image. | Open recipe image selection, choose or capture the test image, adjust its crop, save, reopen the recipe preview, and inspect the crop. | Crop controls work, the saved preview reflects the selected crop, and the image flow remains usable without clipping or a crash. | `UNVERIFIED` - not performed. |
| Bottom sheets and animations | Android Phase-0 build on a physical device; representative Nutrition and Profile flows. | Open and dismiss the food-entry hub and representative edit/review sheets using their buttons, gestures, backdrop, and Android Back; exercise the keyboard where applicable. | Sheets and transitions complete without stuck states, overlapping content, clipped controls, or broken dismissal behavior. | `UNVERIFIED` - not performed. |
| App Link | Android build for the intended variant; configured verified callback host; browser and CIAM test account. | Open the configured HTTPS callback link externally, then complete a sign-in callback for the app variant. | Android resolves the verified link to FitTrack and the callback reaches the correct development or Alpha authentication route. | `UNVERIFIED` - not performed. |

## Findings

No actionable findings.