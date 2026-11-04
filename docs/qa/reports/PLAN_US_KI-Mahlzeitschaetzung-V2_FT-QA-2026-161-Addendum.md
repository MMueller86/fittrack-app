# QA Report: WP-161.3 - Foto- und Textabgleich bei der KI-Mahlzeitschaetzung

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2_FT-QA-2026-161-Addendum.md`
- Verdict: PASS WITH ISSUES

## Scope

Independently reviewed the approved FT-QA-2026-161 addendum against AC-161-1 through AC-161-14, including backend assessment/routing, provider schemas, quota and plausibility behavior, Shared compatibility, Mobile notices and Diary attribution, telemetry, privacy flow, and the specified Knowledge Base updates. The parent V2 review was not rewritten and the complete parent V2/release suite was not rerun. No deployment, migration, Cosmos provisioning/startup, or central finding-register edit was performed.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-161-1 | PASS | The approved addendum records user approval and PO-161-1 through PO-161-3 confirmation on 2026-11-04. |
| AC-161-2 | PASS | `backend/src/lib/openai.ts` defines the closed strict assessment schema; runtime Zod parsing and `backend/src/functions/ai.test.ts` reject unsupported, malformed, and extra-field output before estimation. |
| AC-161-3 | PASS | `backend/src/lib/prompts/mealEstimate.ts` distinguishes primary-meal incompatibility from omitted sides, garnish, and additional visible ingredients; prompt structure guards are in `backend/src/lib/prompts/mealEstimate.eval.test.ts`. Semantic accuracy remains unverified under AC-161-5/12. |
| AC-161-4 | PASS | `backend/src/functions/ai.ts` omits image inputs and suppresses `refine.previous` for contradictory routing; handler and wire tests assert text-only estimation and prior-snapshot suppression. The final estimate is validated and returned as a normal reviewable result. |
| AC-161-5 | UNVERIFIED | Unit and wire tests prove consistent/complementary routes forward the image, and the V3 prompt permits visibly supported additional ingredients. No independently labeled, rights-cleared photo/text fixture exists to verify model recognition or additional-ingredient reflection. |
| AC-161-6 | PASS | Uncertain routing is text-only with the structured uncertain status and fixed notice. Assessment/schema failures return controlled 502 responses without estimation or usage tracking; covered in `backend/src/functions/ai.test.ts`. |
| AC-161-7 | PASS | V3 response fields are server-derived in `backend/src/functions/ai.ts`; V1-compatible optional photo fields are in `shared/types/aiMealEstimate.ts`. The classifier schema has no rationale field. |
| AC-161-8 | PASS | `mobile/src/modules/nutrition/MealEstimateResult.tsx` maps structured routing to fixed accessible German notices before nutrition values. `MealEstimateResult.test.tsx` covers exact text and confirms a successful excluded-photo estimate remains savable. |
| AC-161-9 | PASS | Consistent/complementary states show no exclusion warning; their estimator requests retain the image. `MealEstimateResult.tsx` continues rendering structured components, and the focused UI tests cover complementary notice behavior. |
| AC-161-10 | PASS | Mobile save callers derive `aiMealEstimatePhotoUsed` from `photoUsed`; `nutritionDiaryMutationCallers.test.tsx` covers true/false and `diaryItemUtils.test.ts` covers the badge. No assessment, rationale, or image is added to the Diary contract. |
| AC-161-11 | PASS | `enforceQuota` precedes provider calls and `trackUsage` occurs once after final validation in `backend/src/functions/ai.ts`. Handler tests cover quota rejection, successful two-call use, assessment failure, and hard-validation failure. |
| AC-161-12 | UNVERIFIED | Prompt versions and guards match, and `npm run test:eval` passed. Its meal-estimate fixtures are text-only; there are no independently labeled, rights-cleared image fixtures, so photo classification and complementary ingredient recognition are not established. No calorie anchors or hidden-fat/oil/sauce heuristics were found in the V3 prompts. |
| AC-161-13 | PASS | `backend/src/functions/ai.ts` logs bounded metadata only; handler tests assert that text, note, image bytes, assessment value, and user ID are absent. Provider payloads and model rationale are not logged. |
| AC-161-14 | PASS WITH ISSUE | AI, quota, API, mobile UX, and privacy-flow Knowledge Base text matches the implementation; the privacy policy is unchanged and remains within the declared text/photo processing purpose. A Shared request-type comment still implies every supplied photo improves nutrition estimation; see finding `WP-161-QA-01`. Cosmos, DV-1, and device limits are recorded below. |

## Finding Recheck

FT-QA-2026-161 / KI-MEAL-V2-05 is no longer reproducible at the implementation and wire-contract level: photo requests now receive a separate strict assessment and the approved source-routing behavior is asserted by tests. Model-level classification accuracy, including the complementary case, remains UNVERIFIED because no suitable independent image fixtures are available. The central register was not changed; status remains for the Orchestrator to decide.

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm.cmd --prefix backend test -- --reporter=dot --silent` | 0 | 84 files; 2,791 backend unit tests passed. |
| `npm.cmd --prefix backend run build:verify` | 0 | TypeScript build and emitted-import verification passed. |
| `npm.cmd --prefix shared test -- --reporter=dot --silent` | 0 | 10 files; 466 Shared tests passed. |
| `npm.cmd --prefix shared run typecheck` | 0 | Shared typecheck passed. |
| `npm.cmd --prefix mobile test -- src/modules/nutrition/MealEstimateResult.test.tsx src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx src/modules/nutrition/diaryItemUtils.test.ts src/shared/api/aiApi.test.ts --reporter=dot --silent` | 0 | 4 files; 61 focused Mobile tests passed. |
| `npm.cmd --prefix mobile run typecheck` | 0 | Mobile typecheck passed. |
| `npm.cmd --prefix backend run test:eval` | 0 | 6 eval files; 67 tests passed. Meal-estimate eval fixtures are text-only and do not test image semantics. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: There are no independently labeled, rights-cleared, non-personal photo/text fixtures. Passing mocked routing and text-only evals does not demonstrate classification accuracy or complementary ingredient recognition.
- Manual action: When suitable fixtures are available, evaluate at least consistent, complementary, contradictory, and uncertain examples independently of prompt wording. Expected result: labels and source routing match the independent review, and only visibly supported complementary ingredients are reflected. Result: not run; fixtures unavailable.

- State: `UNVERIFIED`
- Reason: The Cosmos emulator was intentionally unavailable; this addendum introduces no Cosmos shape change, and no contract tests were run.
- Manual action: Only in a separately authorized environment with an already-running emulator, run `npx vitest run --config vitest.contract.config.mts` from `backend/`. Do not provision or start Cosmos for this review. Expected result: affected existing Diary contracts pass. Result: not run.

- State: `UNVERIFIED`
- Reason: Independent DV-1 calorie-reference validation remains pending; the eval fixtures contain no validated reference ranges.
- Manual action: A domain reviewer must approve independent reference ranges before rerunning calibration. Expected result: report the defined bias/range metrics from those approved references. Result: pending.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: No physical-device or screen-reader validation was available; component tests do not establish native accessibility or layout behavior.
- Manual action: On a supported Android test build, inspect consistent, complementary, contradictory, uncertain, and no-photo results with TalkBack. Verify notice order/announcement, retained review and save flow, and the Diary camera badge. Expected result: correct non-blocking copy is announced before nutrition, excluded photos are not attributed as used, and included photos are. Result: pending.

- State: `UNVERIFIED`
- Reason: Azure GlobalStandard processing region, provider retention, and legal basis were not newly verified. This pre-existing question is recorded in the approved plan; this review makes no legal conclusion and does not change the policy.
- Manual action: Product/Legal review of the declared processing-region and retention question. Expected result: any required policy decision is separately approved. Result: open.

## Findings

Finding key: WP-161-QA-01
Plan reference: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-V2_FT-QA-2026-161-Addendum.md`
Acceptance criterion: AC-161-14
Description: The `imageBase64` comment in `shared/types/aiMealEstimate.ts` says that a supplied image improves portion-size and component detection without explaining that the image can be excluded from nutrition estimation after contradictory or uncertain assessment. This overstates image use compared with the V3 `photoUsed` contract.
Criticality: Non-blocking
Owner: Documentation
Evidence: `shared/types/aiMealEstimate.ts`; routing in `backend/src/functions/ai.ts` excludes the image for contradictory/uncertain assessments while keeping `photoProvided` true and `photoUsed` false.
Recommendation: Clarify that a supplied image is assessed transiently and contributes to nutrition estimation only when the validated routing includes it; treat `photoUsed` as the authoritative use indicator.