# QA Report: Recipe Analyze Step Completeness v13

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`
- Verdict: FAIL

## Scope

Independently reviewed the v13 prompt and eval, numbered source-step extraction, adjacent export grouping and ordered trace, side-dish and serving preservation, strict validation and HTTP 422 behavior, required Knowledge Base references, and the plan's test/build gates. The direct QA request authorized this review; the plan and `docs/qa/findings.md` were not edited. The pre-existing worktree changes were preserved. No deployment was performed.

The historical v12 report remains unchanged. Its SHA-256 was `4F38F3CE26A0C0639A540095BED5441065D5AF6D306B592853546E350220DF79` before this review and was rechecked after writing this report. Finding `FT-QA-2026-063` is **not resolved**; the dedicated v13 live eval still fails.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/lib/prompts/recipeAnalyze.ts` and `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` both use v13. `docs/kb/domain/07-ai-features.md` and `docs/kb/tech/06-ai-integrations.md` identify v13 as current. |
| AC-2 | FAIL | The prompt instructs one source step per explicitly numbered instruction. The live fixture checks eight source entries and contiguous 1-based order, but semantic assertions cover only source instructions 1 and 8; it does not verify that each of all eight source entries retains its corresponding input instruction. See `RECIPE-ANALYZE-STEP-COVERAGE-001`. |
| AC-3 | PASS | `side-dish-and-serving-actions` contains eight numbered instructions. The eval checks the exact source count and order, an exact flattened export trace, at most five export steps, descriptions at most 90 characters, and thereby only contiguous adjacent grouping. This fixture passed all three focused live runs. |
| AC-4 | PASS | The fixture checks potato cooking and final serving with both sides in source steps and in export descriptions mapped to source orders 1 and 8. Both assertions passed in all three focused live runs; no exact grouping or wording is required. |
| AC-5 | PASS | `backend/src/lib/recipeAnalyzeValidation.ts` remains fail-closed for incomplete, duplicate, unknown, or unordered traces. Handler tests confirm invalid preparation still returns HTTP 422; quota ordering, success-only usage tracking, and request/response behavior remain unchanged. No second AI call or persistence change was found. The separate telemetry scope violation is recorded below. |
| AC-6 | FAIL | The focused live Recipe Analyze eval failed in all three runs, and the full backend suite exited 1 with two timeouts. Focused unit tests, typecheck, build verification, and diff check passed. See Tests and findings. |
| US-10 AC-15 | PASS | The eight-step fixture produced eight ordered source entries and a complete export trace with no more than five export steps. Invalid traces continue to be controlled by server validation and HTTP 422. |
| US-10 AC-16 | FAIL | The focused live eval repeatedly returned a duplicate source order, breaking the exact ordered trace. In addition, the fixture does not assert preservation of each numbered source instruction or of ingredient relationships, temperatures, durations, and turning points. See `RECIPE-ANALYZE-LIVE-TRACE-001` and `RECIPE-ANALYZE-STEP-COVERAGE-001`. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` (three runs) | 1 each | Run 1 passed 7/8 live fixtures; runs 2 and 3 passed 6/8. `explicit-quantities-with-unit-conversion` returned flattened trace `[1,2,3,4,5,5]` in all three runs. Other failures varied: one run had an empty export description, and a different fixture had another duplicate trace. The new side-dish/serving fixture passed all three times. |
| `npm run test:eval -- --reporter=dot --silent` | 1 | Aggregate live eval: 35/37 passed. The Recipe Analyze file passed 9/9 in this run. The two unrelated failures were Daily Insight `likely-completed-activity` and `protein-nearly-complete`; neither is part of this plan. |
| `npx vitest run src/lib/prompts/recipeAnalyze.eval.test.ts src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts` | 0 | 103 focused validator/handler unit tests passed. |
| `npx vitest run` | 1 | Full backend suite: 1,285/1,287 passed across 66 files. `highlight.test.ts` and `tags.test.ts` each had a 30-second timeout. |
| `npx vitest run src/lib/instagramRenderer/__tests__/highlight.test.ts` | 0 | 3/3 passed when run alone. |
| `npx vitest run src/lib/instagramRenderer/__tests__/tags.test.ts` | 0 | 6/6 passed when run alone. |
| `npm run typecheck` | 0 | TypeScript check completed with no diagnostics. |
| `npm run build:verify` | 0 | Build and verification checks passed. Azure Functions emitted test-mode/runtime-detection warnings; the command completed successfully. |
| `git diff --check` | 0 | No whitespace errors. Git emitted CRLF-to-LF working-copy warnings. |

## Verification Notes

No `UNVERIFIED` or `MANUAL VALIDATION REQUIRED` checks. Azure credentials were available and live evaluations ran. The aggregate Daily Insight failures are reported separately from the scoped Recipe Analyze failures. The full-suite timeouts passed when their files were run individually, but the required full-suite command itself did not pass. No deployment was performed.

## Findings

Finding key: `RECIPE-ANALYZE-LIVE-TRACE-001`  
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`  
Acceptance criterion: AC-6; US-10 AC-16  
Description: The dedicated live eval failed all three runs. The existing `explicit-quantities-with-unit-conversion` fixture repeatedly emitted `[1,2,3,4,5,5]`; additional live failures varied between runs. This violates complete exact-once ordered source coverage. The strict validator still rejects the invalid trace, and the new side-dish/serving fixture passed, but the required live gate is not stable or passing.  
Criticality: Blocking  
Owner: Backend  
Evidence: `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`, `backend/src/lib/recipeAnalyzeValidation.ts`; `npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` exited 1 in three runs.  
Recommendation: Stabilize the export grouping for every live fixture without weakening server validation, then rerun the focused live eval until all eight fixtures pass consistently.

Finding key: `RECIPE-ANALYZE-STEP-COVERAGE-001`  
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`  
Acceptance criterion: AC-2; US-10 AC-16  
Description: The synthetic fixture verifies eight source entries and ordered `order` values, but its source-semantic assertions cover only the potato-cooking instruction and final serving instruction. It does not establish a one-to-one semantic mapping for every numbered input instruction, nor assert preservation of ingredient relationships, temperature, duration, and turning points required by US-10 AC-16. The prompt requests these properties, but the eval can pass while those details are lost.  
Criticality: Blocking  
Owner: Backend  
Evidence: `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts` and `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`; the eight-step fixture's semantic assertions are limited to source orders 1 and 8.  
Recommendation: Extend the reviewed fixture assertions to cover each numbered source instruction and representative ingredient, temperature, duration, and turning-point details in the corresponding export text.

Finding key: `RECIPE-ANALYZE-LOGGING-SCOPE-001`  
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`  
Acceptance criterion: N/A (plan Out of Scope: logging changes)  
Description: On source-trace validation failures, the handler now logs the recipe input text and generated source/export step descriptions, bounded to 16,000 characters per field. The updated backend Knowledge Base states that this content is retained in Application Insights for 30 days, and a new handler test explicitly expects the private source text in logs. Logging changes are outside the approved plan and expose user-provided recipe content and model output to telemetry.  
Criticality: Blocking  
Owner: Backend  
Evidence: `backend/src/functions/recipes.ts`, `backend/src/functions/recipes.test.ts`, `docs/kb/tech/02-backend.md`, plan section 4 (`Out of Scope`).  
Recommendation: Remove recipe and generated-text logging and its test/documentation changes, or obtain explicit approval for a separately scoped privacy/retention change before retaining this diagnostic behavior.

Finding key: `BACKEND-UNIT-SUITE-TIMEOUT-001`  
Plan reference: `docs/User Stories/Reciepe/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md`  
Acceptance criterion: AC-6  
Description: The required full backend suite exited 1 because the high-protein highlight render and tag-chip-count tests each exceeded the 30-second timeout. Both files passed when run individually, so the failure appears load-sensitive; the cause is not established, and the full-suite gate remains unmet.  
Criticality: Blocking  
Owner: Backend  
Evidence: `backend/src/lib/instagramRenderer/__tests__/highlight.test.ts`, `backend/src/lib/instagramRenderer/__tests__/tags.test.ts`; `npx vitest run` exited 1 with 1,285/1,287 passed, while the two isolated commands passed.  
Recommendation: Make the full backend suite pass under its normal invocation and rerun `npx vitest run`; retain the isolated results as diagnostic evidence, not as a replacement for the required gate.