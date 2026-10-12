# QA Report: Recipe Analyze Step Completeness

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`
- Verdict: FAIL

## Scope

Reviewed the approved prompt v12 change, synthetic live-eval fixture and assertions, current AI Knowledge Base references, strict export trace validation, HTTP 422 behavior, focused tests, full backend unit suite, typecheck, build verification, and diff checks. Mobile, Shared, Cosmos, Bicep, renderer, Share Bundle, release, and deployment work were not performed.

The plan header still says Draft and that implementation is unauthorized. The explicit user approval and implementation handoff governed this review; the plan was not edited.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/lib/prompts/recipeAnalyze.ts` exports v12; `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` expects v12. Both current-version references identify v12 in `docs/kb/domain/07-ai-features.md` and `docs/kb/tech/06-ai-integrations.md`. |
| AC-2 | PASS | `backend/src/lib/prompts/recipeAnalyze.ts` inventories action, ingredients, temperature, time, turning points, and side-dish/serving relationships before grouping; it permits only adjacent groups, limits export to five, and says to shorten text rather than drop actions. |
| AC-3 | PASS | `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts` adds eight explicitly numbered instructions with separately cooked potatoes and a final serving action. The live eval checks exact ordered source coverage, at most five export steps, and descriptions of at most 90 characters. The new fixture passed in both live runs. |
| AC-4 | PASS | `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` associates semantic assertions with source orders 1 and 8 and checks cooking the side dish and serving the main dish with both sides in the traced export descriptions. The new fixture passed. |
| AC-5 | PASS | `backend/src/lib/recipeAnalyzeValidation.ts` still enforces the step-count/description limits and rejects incomplete, duplicate, unknown, or unordered source traces. `backend/src/functions/recipes.ts` retains HTTP 422 on validation failure and tracks usage only after validation. Focused validator/handler tests passed (103/103); no API, quota, persistence, or additional AI-call change was identified in the prompt change. |
| AC-6 | FAIL | The isolated live Recipe Analyze eval exited 1: two of eight live fixtures produced duplicate/out-of-order source references. The prompt-version guard and six live fixtures passed. Focused tests, full backend suite, typecheck, build verification, and `git diff --check` passed. See Tests and Finding `RECIPE-ANALYZE-LIVE-EVAL-001`. |
| US-10 AC-15 | PASS | The eight-source-step fixture passed with no more than five export steps and a complete trace; the existing fail-closed validator still provides controlled HTTP 422 rejection for invalid traces. Evidence: `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`, `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`, and `backend/src/functions/recipes.test.ts`. |
| US-10 AC-16 | FAIL | The prompt directs preservation of sequence and cooking details, but the isolated live run returned traces `[1,2,3,4,5,5]` and `[1,2,3,4,5,4]` for two fixtures. These duplicate/reordered references do not preserve the export sequence and would be rejected by the strict validator. Evidence: `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` and `backend/src/lib/recipeAnalyzeValidation.ts`. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run test:eval --workspace=backend` | 1 | 33 passed, 4 failed across the live-eval suite. Recipe Analyze passed 9/9 in this run; the four failures were in Daily/Weekly Insight evals outside this plan's scope. |
| `npm run test:eval --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts` | 1 | Version guard passed; 6/8 live Recipe Analyze fixtures passed. `explicit-quantities-with-unit-conversion` repeated source order 5; `no-lost-or-invented-ingredients` repeated source order 4 after order 5. |
| `npm run test --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts` | 0 | 103 focused validator/handler unit tests passed across 2 test files. |
| `npm run test --workspace=backend -- --reporter=dot --silent` | 0 | Full backend suite: 1,287 tests passed across 66 files. |
| `npm run typecheck --workspace=backend` | 0 | TypeScript check passed with no diagnostics. |
| `npm run build:verify --workspace=backend` | 0 | Build and all verification checks passed. Azure Functions emitted its runtime-detection/test-mode fallback warning; verification completed successfully. |
| `git diff --check` | 0 | No whitespace errors. Git emitted CRLF-to-LF working-copy warnings. |

## Verification Notes

No `UNVERIFIED` or `MANUAL VALIDATION REQUIRED` checks. Azure credentials were available and live Recipe Analyze evaluations ran. No deployment was performed.

## Findings

Finding key: `RECIPE-ANALYZE-LIVE-EVAL-001`  
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`  
Acceptance criterion: AC-6; US-10 AC-16  
Description: The isolated live Recipe Analyze eval failed two existing fixtures because export `sourceStepOrders` contained duplicates and, in one case, a source order repeated after a later order. This violates the exact ordered trace contract despite the strict server validator correctly rejecting such output. The new side-dish/serving fixture itself passed.  
Criticality: Blocking  
Owner: Backend  
Evidence: `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`; live command `npm run test:eval --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts` exited 1 with traces `[1,2,3,4,5,5]` and `[1,2,3,4,5,4]`; `backend/src/lib/recipeAnalyzeValidation.ts` rejects incomplete or unordered traces.  
Recommendation: Stabilize export grouping so each source order appears exactly once in order for all fixtures, retain the strict validator, and rerun the isolated Recipe Analyze live eval until all fixtures pass.