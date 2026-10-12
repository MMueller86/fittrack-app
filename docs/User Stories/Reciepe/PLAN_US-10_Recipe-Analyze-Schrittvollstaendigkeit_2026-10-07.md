# PLAN_US-10: Recipe-Analyze-Schrittvollstaendigkeit

**Status:** Revised after the v12 QA failure; pending fresh explicit user approval before any further Orchestrator or QA execution. The v12 plan was explicitly approved in conversation, but this artifact still showed Draft. Backend has implemented the v13 correction and reported verification; QA re-verification is pending. No deployment is authorized.

Infrastructure Impact: Alpha
Mobile Build Impact: None

**Approval gate:** This revision changes the prompt identity and acceptance contract. It supersedes the prior v12 approval; do not resume Orchestrator or QA work until the user explicitly approves this revision.

**Related User Story:** [US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md](US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md), Acceptance Criteria 15 and 16.

**Plan boundary:** This plan addresses the separately observed Recipe Analyze export-step omission. It does not replace, approve, or change the existing US-10 AC-11 correction plan, its approval gate, or its Backend/Mobile work packages.

## 1. Requirement Assessment

**Classification:** Accept with modification. The v13 correction addresses the same focused US-10 AC-15/AC-16 problem, but adds an observable guarantee to analysis `steps`: explicitly numbered input instructions remain one-to-one and in order. That requirement was not explicit in the v12 acceptance criteria, so the plan must be revised and approved again. The prior approval does not authorize further Orchestrator or QA execution.

The original Alpha reproduction returned HTTP 422 from `recipes.prepareExportView` because the generated export trace omitted source steps. The analyzed source steps were ordered 1 through 8; the export trace was `1,2,3,4,6,7`. The missing source actions were cooking the separate rice side dish and the final serving step. Preparation stopped before `recipes.share-bundle` ran.

**v12 QA and v13 correction history:**

- The first QA report, [PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md](../../qa/reports/PLAN_US-10_Recipe-Analyze-Schrittvollstaendigkeit_2026-10-07.md), returned `FAIL` for v12. Blocking finding `RECIPE-ANALYZE-LIVE-EVAL-001` identified duplicate/out-of-order `sourceStepOrders` in two pre-existing live fixtures: `[1,2,3,4,5,5]` and `[1,2,3,4,5,4]`. The new side-dish/serving fixture passed; the strict server validator correctly rejected invalid traces.
- Backend corrected the prompt/eval and incremented the semantic prompt version to v13. The prompt now keeps explicitly numbered input instructions one-for-one in analysis `steps`, and confines grouping to `exportSuggestion`, where source orders are assigned as a complete ordered partition. The v13 eval guard and the two AI Knowledge Base references were updated.
- Backend reports that the targeted live Recipe Analyze eval passed 8/8 fixtures in three consecutive runs; the focused tests passed 103 tests, the full backend suite passed 1,287 tests across 66 files, and typecheck, build verification, and `git diff --check` passed. These are Backend-reported results, not a QA verdict; QA re-verification remains pending.
- The v12 QA report remains unchanged as evidence of the first run. This plan revision does not rewrite that report or the central findings register.

The v13 source-step rule is a closely related correction to stable source identity and ordered export coverage, but it changes observable analyzer output beyond the approved v12 wording. The revised plan therefore records that contract explicitly rather than treating the v13 prompt bump as covered by the old approval.

AI remains part of the existing Recipe Analyze/export workflow. The server validator is deterministic and must remain the final fail-closed gate; it cannot itself rewrite concise German export text while preserving meaning.

**Open Product Owner Decisions:** None. The product goal remains specified by US-10 AC-15/AC-16 and the Recipe domain rules; fresh plan approval is the gate for the revised technical acceptance, not a new product decision.

## 2. Current and Desired Behaviour

**At the v12 QA run:** The v12 prompt allowed export compression and required a complete ordered trace, but two existing live fixtures still returned duplicate/out-of-order source references. The server validator rejected those responses with the existing HTTP 422 behavior.

**Current repository state:** The prompt and eval guard now use v13. Explicitly numbered input instructions remain one analysis source step each, in input order; only `exportSuggestion` may group source steps. Export suggestions remain limited to five steps of at most 90 characters, and the flattened source trace must include every source order exactly once and in order. The validator and its rejection contract are unchanged. Backend reports the v13 eval and test results recorded above; independent QA verification is pending.

**Desired for this revision:** Preserve the existing export behavior and limits while making source identity explicit: each explicitly numbered input instruction appears once as its own ordered analysis step, without applying the five-step export limit to `steps`. Compression is confined to `exportSuggestion`, may combine adjacent source steps only, and must retain every source order, action, and relevant serving relationship. Keep the existing fail-closed validator and HTTP 422 behavior unchanged.

## 3. Scope

- Preserve each explicitly numbered input instruction exactly once as its own ordered analysis `steps` entry; do not apply the five-step export limit to `steps`. Grouping is allowed only in `exportSuggestion`.
- In `exportSuggestion`, form a complete, non-overlapping, ordered partition of the source steps; group adjacent source steps only, and preserve independent side-dish preparation and final assembly/serving in the descriptions. Shorten wording rather than dropping an action.
- Set `RECIPE_ANALYZE_PROMPT_VERSION` and the eval version guard to `v13` because the correction changes prompt semantics.
- Keep the synthetic live-eval fixture with explicit numbered source steps, a separately cooked side dish, and a final serving action. Assert the expected one-to-one source extraction, complete ordered export trace, and retention of those actions in the source and export descriptions.
- Keep the current prompt-version references and export-step behavior in `docs/kb/domain/07-ai-features.md` and `docs/kb/tech/06-ai-integrations.md` aligned with v13.
- Keep the change limited to the shared Recipe Analyze prompt. Both new-recipe analysis and existing-recipe export preparation consume it and must remain compatible.

## 4. Out of Scope

- Weakening or bypassing `validateRecipeExportPreparationOutput()` or changing the existing HTTP 422 contract.
- Changing the five-step or 90-character limits, Structured Output schema, API request/response, quota, persistence, or confirmation behavior.
- Adding a second AI call, automatic repair retry, deterministic text rewrite, or fallback export.
- Mobile, Shared types, Cosmos, Bicep, renderer, Share Bundle, or logging changes.
- The separate US-10 AC-11 preparation ambiguity correction.

## 5. Backend Work Package

**Agent:** Backend

**Status:** Backend reports the v13 correction and handoff complete; independent QA verification is pending.

**Goal:** Correct the v12 live-eval failure by separating one-to-one extraction of explicitly numbered source instructions from export-only grouping, adding regression-sensitive eval coverage, bumping prompt identity, and updating the two affected Knowledge Base references.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/06-ai-integrations.md`

**Required Repository Context:**
- `backend/src/lib/prompts/recipeAnalyze.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`
- `backend/src/lib/recipeAnalyzeValidation.ts`
- `backend/src/functions/recipes.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- US-10 AC-15
- US-10 AC-16

**Dependencies:** None.

**Expected Handoff:** Prompt v13, the synthetic fixture and source/export semantic assertions, updated AI feature/version documentation, and verification results. Backend reports 8/8 targeted live fixtures passing in three consecutive runs, 103 focused tests passing, 1,287 tests across 66 backend files passing, and successful typecheck, build verification, and diff check. These results do not replace QA review. Report live eval as `UNVERIFIED` rather than passed if Azure OpenAI credentials are unavailable.

## 6. QA Work Package

**Agent:** QA

**Status:** Pending fresh explicit approval of this revised plan.

**Goal:** Re-verify v13, confirm the v12 blocking finding is resolved, verify the one-to-one numbered-source contract, continued fail-closed server validation, documentation accuracy, and all required test/build gates. Review the AI change against the Azure OpenAI checklist.

**Required Knowledge Base:**
- `docs/kb/domain/06-recipes.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/prompts/recipeAnalyze.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`
- `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`
- `backend/src/lib/recipeAnalyzeValidation.ts`
- `backend/src/functions/recipes.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- AC-1 through AC-6 in this plan
- US-10 AC-15 and AC-16

**Dependencies:** Fresh explicit approval of this revised plan; Backend handoff complete, including the v13 live-eval result and documentation updates.

**Expected Handoff:** QA verdict with evidence for every revised plan acceptance criterion; explicitly distinguish `PASS`, `FAIL`, and `UNVERIFIED`, and identify the v12 QA report as historical evidence without editing it. A live prompt eval without credentials is not a pass.

## 7. Verification Strategy

Backend's v13 results are recorded in the handoff above. After fresh plan approval, QA independently runs the following gates in sequence:

1. `cd backend && npm run test:eval` with configured Azure OpenAI credentials, and `cd backend && npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts` to capture the focused result. The focused Recipe Analyze eval must pass all eight live fixtures. Backend reports three consecutive 8/8 runs; QA's own result remains required. Report any failures from other feature evals separately. Do not expose credentials or copy recipe/user data into fixtures.
2. `cd backend && npx vitest run src/lib/prompts/recipeAnalyze.eval.test.ts src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts`.
3. `cd backend && npx vitest run`.
4. `cd backend && npm run typecheck` and `cd backend && npm run build:verify`.
5. `git diff --check` and verify both Knowledge Base references describe v13, the numbered-source extraction rule, and the unchanged export limits/coverage contract.

The live Recipe Analyze eval is required for completion because this plan changes AI output behavior. An offline version-guard pass or a skipped live suite is insufficient evidence.

## 8. Acceptance Criteria

- **AC-1:** Recipe Analyze uses prompt version `v13`; its eval guard also expects `v13`, and both Knowledge Base references identify v13 as current.
- **AC-2:** For explicitly numbered input instructions, the prompt preserves each instruction exactly once as its own analysis source step in the same order; the five-step limit does not apply to analysis `steps`. Grouping is confined to `exportSuggestion`.
- **AC-3:** The synthetic fixture contains eight explicitly numbered source instructions, including a separate side dish and final serving. The live eval verifies exactly eight ordered analysis source steps, no more than five export steps, no description over 90 characters, and flattened export source orders equal all source orders exactly once and in order. Export grouping may combine adjacent steps only.
- **AC-4:** The eval verifies that the numbered side-dish cooking action and final serving action survive in both their analysis source steps and the export descriptions mapped to those source orders. It does not assert exact export grouping or exact generated sentences.
- **AC-5:** Existing server validation remains strict: a missing source order is rejected with the current validation failure/HTTP 422 behavior. No API contract, quota, persistence, or second-call behavior changes.
- **AC-6:** QA independently verifies the live Recipe Analyze eval passes all eight fixtures, focused validator/handler tests, full backend unit suite, typecheck, build verification, and diff checks. Any missing live credentials are reported as `UNVERIFIED`, not a pass; unrelated live-eval failures are identified separately from this plan's Recipe Analyze result.

## 9. Risks and Release Impact

- The v12 QA result shows that a general preservation rule alone was insufficient. The v13 prompt distinguishes source-step extraction from export grouping and specifies a sequential partition; the server validator must remain strict.
- Live model output is nondeterministic. Backend's three consecutive passing runs are useful handoff evidence, not a QA verdict or guarantee for all recipes. QA must independently rerun the focused eval. The server validator remains authoritative for trace completeness; semantic text preservation is covered by the focused live fixture.
- A future automatic repair call could add latency, cost, and quota implications and would conflict with the existing single-analysis-call design. It is deliberately not part of this correction and would require a separate product/technical decision if prompt hardening proves insufficient.
- No Bicep or resource change is required. The backend prompt change must reach Alpha through the normal backend deployment after merge; this plan does not execute or authorize that operational deployment. No mobile build is needed.

## 10. Recommended Execution Order

1. Backend's v13 prompt/eval/Knowledge Base correction and verification handoff are already reported complete. This records the current state; any additional implementation work requires fresh approval of this revision.
2. After the user explicitly approves this revised plan, QA independently verifies v13 and reports each acceptance criterion as `PASS`, `FAIL`, or `UNVERIFIED`. Keep the v12 QA report unchanged as historical evidence.
3. After merge, Alpha activation is handled only through a separate explicit `Deploy to Alpha` operational request.
