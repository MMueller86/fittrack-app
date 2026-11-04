# QA Report: KI-Mahlzeitschaetzung V2

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2.md`
- Verdict: PASS WITH ISSUES

## Scope

Reviewed the approved scope: portion quick fix and legacy normalization, migration script behavior, additive shared/Diary contracts, V2 prompt/schema/handler/refine flow, quota and plausibility handling, estimate adjustments, recognized foods, Diary presentation, regression/eval coverage, privacy handling, and Knowledge Base updates. Out of scope remained model/deployment changes, new quota features, privacy-policy edits, component add/remove/rename recalculation, photo persistence, infrastructure changes, and live deployment or migration.

All listed work packages were reviewed as completed per the supplied handoff. The earlier WP-1.1 stop was followed by plan revision and approval and is not counted as skipped. A targeted plan-artifact recheck on 2026-11-04 confirmed that the plan records approval and WP-1.1 completion while preserving the earlier stop as history; see the addendum below. The reviewed scope, out-of-scope constraints, and AC-1 through AC-27 remain aligned with the approved QA record.

## Prompt and Image Review

Representative prompt excerpt from `backend/src/lib/prompts/mealEstimate.ts`:

> Schaetze die Gesamtnaehrwerte und das Gesamtgewicht der beschriebenen Mahlzeit als eine Portion (NICHT per 100g). Erkenne gleichzeitig benennbare Einzelbestandteile und eventuelle Kontextinformationen. Schaetze realistisch statt systematisch knapp und nutze sichtbare Groessenreferenzen im Foto, sofern vorhanden.

For a photo request, `backend/src/lib/openai.ts` also sends the user text `Ein Foto der Mahlzeit ist angehaengt.` and an image part with `detail: 'high'`; it sends no image part when no photo is supplied. The prompt has no calorie anchors or hidden-fat/oil heuristic and says text is not evidence of what is visible in the photo. The request wiring is correct for using visible foods and size cues, but it does not prove that the model recognizes a particular food or portion correctly. The prompt also lacks an explicit instruction to call out contradictions between the text and photo as described in plan section 11.4; this is recorded as a non-blocking finding. Semantic photo accuracy remains unverified without reviewed photo fixtures.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Both save paths send `inputMode: 'portion'` and `inputAmount: 1` without `amountGrams`; `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx`, `mobile/src/modules/nutrition/hub/AISubFlow.tsx`, `mobile/src/modules/nutrition/MealEstimateResult.tsx` |
| AC-2 | PASS | Diary amount formatting and portion scaling coverage: `mobile/src/modules/nutrition/diaryItemUtils.test.ts`; add/edit handling: `backend/src/functions/diary.test.ts` |
| AC-3 | PASS | Canonical and legacy payload normalization plus invalid nutrition cases: `backend/src/functions/diary.test.ts`; dry-run/idempotency behavior: `scripts/migrate-ai-meal-estimates.test.mjs` |
| AC-4 | PASS | Shared optional V2 read fields and component type: `shared/types/aiMealEstimate.ts`; response validation/projection: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts` |
| AC-5 | PASS | `backend/src/functions/diary.ts` rejects unknown keys on AI meal-estimate adds and rejects the unsupported `aiMealEstimateBaseCalories`; `backend/src/functions/diary.test.ts` covers both and keeps non-AI and legacy request behavior intact. |
| AC-6 | UNVERIFIED | Unit copy/move and old-shape coverage exists in `backend/src/lib/repositories/diaryRepository.test.ts`; Cosmos old-shape/copy/move contracts exist in `backend/src/lib/repositories/cosmosDiaryRepository.contract.test.ts` but were not run because the emulator endpoint is intentionally unavailable. |
| AC-7 | PASS | Prompt version, no calorie anchors/hidden-fat hints, and metadata-only estimate logging: `backend/src/lib/prompts/mealEstimate.ts`, `backend/src/lib/prompts/mealEstimate.eval.test.ts`, `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts` |
| AC-8 | PASS | Photo notice, high image detail, and absent image part without a photo: `backend/src/lib/openai.ts`, `backend/src/lib/openai.wire.test.ts`; explicit text/photo conflict guidance is missing as noted under Prompt and Image Review. |
| AC-9 | PASS | The V2 response and ordered `components` projection are covered by `backend/src/functions/ai.ts` and `backend/src/functions/ai.test.ts`; `backend/src/lib/openai.wire.test.ts` asserts `componentItems`, `estimatedTotalGrams`, then `mealEstimate` in provider schema order. V1 read fields remain optional in `shared/types/aiMealEstimate.ts`. |
| AC-10 | PASS | Hard bounds, weight-energy rejection, and warning-only Atwater/component deviations: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts` |
| AC-11 | PASS | Quota-before-provider, no tracking on invalid output, and one track on valid initial/refine calls: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts` |
| AC-12 | UNVERIFIED | `npm run test:eval` passed, but `backend/src/lib/prompts/mealEstimate.eval.fixtures.ts` has no independently validated calorie references; `backend/src/lib/prompts/mealEstimate.eval.test.ts` therefore reports DV-1 as unverified and does not measure the required aggregate calibration targets. |
| AC-13 | PASS | Strict Refine contract, bounds, null/unknown rejection, hostile note handling, multipart parsing, and pre-quota rejection: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts`, `shared/types/aiMealEstimate.ts` |
| AC-14 | PASS | The kcal hero's +/- controls use the global portion stepper; macro values remain directly editable and have independent +/- controls. `mobile/src/modules/nutrition/MealEstimateResult.tsx`, `mobile/src/modules/nutrition/mealEstimateAdjust.ts`, and their tests cover the behavior. |
| AC-15 | PASS | Pure adjustment function scales meal values and total/component grams reversibly within 50-150%: `mobile/src/modules/nutrition/mealEstimateAdjust.ts`, `mobile/src/modules/nutrition/mealEstimateAdjust.test.ts` |
| AC-16 | PASS | Atwater deltas, fiber-neutral kcal, and non-negative limits: `mobile/src/modules/nutrition/mealEstimateAdjust.ts`, `mobile/src/modules/nutrition/mealEstimateAdjust.test.ts` |
| AC-17 | PASS | Adjustment delta/reset state is implemented in `mobile/src/modules/nutrition/MealEstimateResult.tsx`; reset restores the current AI snapshot. |
| AC-18 | PASS | 400 ms hold delay, 140 ms repeat, stop-at-boundary, selection and warning haptics: `mobile/src/modules/nutrition/MealEstimateResult.tsx`; actual device haptics remain a manual check. |
| AC-19 | PASS | Structured components show estimated grams and kcal; portion scaling updates both values and total weight. V1 fallback remains names-only. `mobile/src/modules/nutrition/MealEstimateResult.tsx` and `mobile/src/modules/nutrition/mealEstimateAdjust.test.ts` cover the implementation. |
| AC-20 | PASS | Exclusive larger/smaller hints, note length/short-input gating, loading/quota states, and 3-attempt limit: `mobile/src/modules/nutrition/MealEstimateRefineSheet.tsx`, `mobile/src/modules/nutrition/MealEstimateRefineSheet.test.tsx`, `mobile/src/modules/nutrition/MealEstimateResult.tsx` |
| AC-21 | PASS | Original text/photo and latest AI snapshot are sent; local adjustments are not used as `previous`: `mobile/src/modules/nutrition/MealEstimateResult.tsx`, `mobile/src/modules/nutrition/MealEstimateResult.test.tsx`, `mobile/src/shared/api/aiApi.ts` |
| AC-22 | PASS | Sheet locking, retained errors, quota messaging, and Precision Path action: `mobile/src/modules/nutrition/MealEstimateRefineSheet.tsx`, `mobile/src/modules/nutrition/MealEstimateRefineSheet.test.tsx`, `mobile/src/modules/nutrition/MealEstimateResult.tsx` |
| AC-23 | PASS | Portion/weight formatting and structured-to-legacy component-name fallback without fabricated detail: `mobile/src/modules/nutrition/diaryItemUtils.ts`, `mobile/src/modules/nutrition/diaryItemUtils.test.ts`, `mobile/src/modules/nutrition/DiaryScreen.tsx` |
| AC-24 | PASS | Save payload contains adjusted confirmed macros and no base-calorie snapshot: `mobile/src/modules/nutrition/MealEstimateResult.tsx`, `mobile/src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx` |
| AC-25 | PASS | Protected AI handler calls `requireUser`; no credentials are introduced in the reviewed source/tests: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts` |
| AC-26 | PASS | Photo is request-only; estimate telemetry contains metadata/lengths and no request contents; confirmed Diary fields are persisted. Existing policy describes Azure OpenAI photo/text processing and confirmation and remains unchanged: `backend/src/functions/ai.ts`, `backend/src/functions/ai.test.ts`, `backend/src/functions/diary.ts`, `docs/legal/datenschutzerklaerung-alpha.md` |
| AC-27 | PASS | Route, V2 contract, quota, Diary fields, UX, and mobile behavior are documented in `docs/kb/domain/07-ai-features.md`, `docs/kb/domain/02-diary.md`, `docs/kb/domain/08-quota-system.md`, `docs/kb/tech/06-ai-integrations.md`, `docs/kb/tech/09-api-reference.md`, `docs/kb/product/03-design-system.md`, `docs/kb/product/05-ux-patterns.md`, and `docs/kb/tech/03-mobile.md` |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm.cmd --prefix backend exec -- vitest run src/functions/diary.test.ts src/functions/ai.test.ts src/lib/openai.wire.test.ts` | 0 | 3 files, 485 tests passed; covers the previous backend blockers, handler validation, quota, and wire contract. |
| `npm.cmd --prefix mobile exec -- vitest run src/modules/nutrition/MealEstimateResult.test.tsx src/modules/nutrition/mealEstimateAdjust.test.ts src/modules/nutrition/MealEstimateRefineSheet.test.tsx src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx src/modules/nutrition/diaryItemUtils.test.ts` | 0 | 5 files, 56 tests passed. |
| `npm.cmd --prefix shared run test` | 0 | 10 files, 466 tests passed. |
| `npm.cmd --prefix backend run test` | 0 | 84 files, 2,780 tests passed. |
| `npm.cmd --prefix mobile run test` | 0 | 115 files, 1,123 tests passed. |
| `npm.cmd run typecheck` | 0 | Backend, shared, and mobile typechecks passed. |
| `npm.cmd --prefix backend run build:verify` | 0 | Backend build and emitted-import verification passed. |
| `npm.cmd --prefix backend run test:eval` | 0 | 6 files, 66 tests passed; this does not establish independent DV-1 calibration. |
| `npm.cmd run test:scripts` | 0 | 32 script tests passed, including migration dry-run and idempotency behavior. No live migration was run. |
| `npm.cmd run check:encoding` | 0 | Encoding check passed. |
| `npx vitest run --config vitest.contract.config.mts` (from `backend/`) | Not run | Cosmos endpoint intentionally unavailable; contract assertions were not executed. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: Cosmos contract assertions require the local emulator. The supplied handoff reports the endpoint intentionally unavailable; no endpoint setup or contract-suite attempt was made in this review. This is not a finding or blocker.
- Manual action: None requested for the emulator. The user may run the existing contract suite only when the local emulator is intentionally available.

- State: `UNVERIFIED`
- Reason: DV-1 independent review of calorie reference ranges was not supplied. Passing synthetic eval tests cannot establish signed median bias, within-20% rate, or maximum positive reference deviation. This is not a finding or blocker.
- Manual action: Domain reviewer to approve independent fixture reference ranges before claiming AC-12 calibration; result: pending.

- State: `UNVERIFIED`
- Reason: The migration script was unit-tested, but no live Alpha dry-run or apply was performed, as requested. No deployment or migration was attempted.
- Manual action: None in this QA run; any later Alpha operation must follow the plan's backend-first order and explicit operational approval.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: No device screenshots, screen-reader run, or device haptic validation was supplied.
- Manual action: On a supported device, inspect the result and re-estimation sheet at narrow and standard viewport sizes; use a screen reader on each stepper and sheet control; hold a stepper through repeat and boundary; submit an approved meal photo. Expected: no overlap, correctly announced controls, repeat/stop and haptic behavior match the plan, and visible foods/portion cues are reflected with uncertainty where appropriate. Result: pending.

## Findings
## Prior Finding Recheck

- KI-MEAL-V2-01 (AC-5): No longer reproducible. Unknown AI-add fields, including `aiMealEstimateBaseCalories`, return 400; focused and full backend suites pass.
- KI-MEAL-V2-02 (AC-14): No longer reproducible. Kcal hero +/- controls drive the global portion scaler and macro values remain directly editable; focused mobile suite passes.
- KI-MEAL-V2-03 (AC-19): No longer reproducible. Component kcal now scale with component grams; the adjustment regression test passes.
- KI-MEAL-V2-04 (AC-9): No longer reproducible. Provider schema order is asserted as `componentItems`, `estimatedTotalGrams`, then `mealEstimate`; the wire suite passes.
- KI-MEAL-V2-06 (FT-QA-2026-162; 2026-11-04): Status: **No longer reproducible after authorized plan correction.** Evidence: the current plan status and WP-1.1 entry record approval and completion; execution order says the earlier stop is not a current blocker, and the audit history preserves the initial incomplete-contract stop. The approved scope and AC inventory remain aligned with this report. Cosmos Contract remains `UNVERIFIED` and DV-1 remains a prerequisite, with neither claimed as passed. See the targeted recheck addendum below.


Finding key: KI-MEAL-V2-05
Plan reference: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2.md`
Acceptance criterion: AC-8 / plan section 11.4
Description: Photo transport uses high detail and the prompt says that free-text claims are not photo evidence, but the system prompt does not explicitly direct the model to identify and report uncertainty when the described meal conflicts with the photo. The transport criterion passes; this is a remaining prompt-instruction gap from section 11.4.
Criticality: Non-blocking
Owner: Backend
Evidence: `backend/src/lib/prompts/mealEstimate.ts`; `backend/src/lib/openai.ts`; `backend/src/lib/openai.wire.test.ts` verifies photo transport but not contradiction handling.
Recommendation: Add the planned neutral text/photo conflict instruction and, when suitable reviewed photo fixtures are available, cover it in an eval without introducing hidden-fat heuristics.

## Targeted Recheck Addendum — FT-QA-2026-162

- Recheck date: 2026-11-04
- Finding key: KI-MEAL-V2-06
- Result: No longer reproducible after authorized plan correction.
- Evidence: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2.md` states that the revised plan is approved and WP-1.1 is completed; the WP-1.1 status describes the incomplete-contract stop as history; the execution order states it is not a current execution blocker; and the audit trail retains the original stop and approval sequence.
- Scope check: The plan retains the approved scope and out-of-scope constraints, and its AC-1 through AC-27 inventory matches the report matrix. The status correction does not introduce a substantive scope or acceptance-criteria change.
- Verification limits: The plan continues to mark Cosmos Contract assertions `UNVERIFIED`; DV-1 validation remains a prerequisite and AC-12 remains `UNVERIFIED` in this report. No claim that either check passed was added. No Cosmos/emulator, deployment, migration, or full application suite was run for this document-only recheck.