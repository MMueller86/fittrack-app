# B-2 Recipe Analyze v14 Backend Handoff

Date: 2026-10-08
Status: BLOCKED - candidate only, not accepted or release-ready.
Scope: approved v14 B-2 task package only. No deployment, KB edit, later work package, API/schema change, validator relaxation, trace repair, model change, or token-budget change.

## Changed Files

- `backend/src/lib/prompts/recipeAnalyze.ts`: deliberate v14; count source entries rather than individual actions; exactly M = min(N, 5) export groups with orders 1..M; multiple actions stay in their source entry's single group. Removed conflicting at-most-five planning in favor of the existing mapping section. Five/90 limits and other v13 rules retained.
- `backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts`: unchanged eight fixture inputs and existing quantity/classification constraints; complete reviewed source/export rubric 1..8 using existing assertion types. Extracted the existing assertion loops into a test-only helper in this existing fixture module, shared by live/offline tests; no new test framework or assertion type.
- `backend/src/lib/prompts/recipeAnalyze.eval.test.ts`: conscious v14 guard; explicit exact min(N, 5) count and contiguous export orders; shared semantic assertions.
- `backend/src/lib/recipeAnalyzeValidation.test.ts`: offline loss/swap/temperature probes, alternate valid adjacent grouping, exact duplicate trace and boundary regressions. Validator implementation unchanged by B-2.
- `backend/src/lib/openai.ts`: only analyzeRecipeText temperature changed from 0.2 to 0 for the bounded stabilization attempt. This remains a failed experimental candidate, not an accepted solution.
- `backend/src/functions/ai.test.ts`: request assertion for temperature 0, unchanged model selection and 2048 tokens; auth/quota/provider-failure/one-call/success-only-usage/nonpersistence tests for import.
- This handoff artifact.

B-1 changes in recipes.ts/recipes.test.ts were not edited by B-2. Their privacy regression passed with the focused suite and full suite. Existing worktree changes, including KB/QA/plan files, were preserved.

## Source / Export Semantics Matrix

Basis: unchanged synthetic fixture input, approved B-2 AC-2/3 and US-10 AC-15/16, not the prompt's generated wording. Each row is asserted against its exact source order and against the description of the export group referencing that order. Text elsewhere does not satisfy the row. All eight rows reject invented numeric temperatures; the input has qualitative heat only.

| Source | Required action / ingredient / relationship in source and referencing export text |
|---|---|
| 1 | Cook potatoes in salted water for 18 minutes and drain. |
| 2 | Cook beans for 8 minutes until al dente and drain. |
| 3 | Season chicken with salt and pepper. |
| 4 | Heat olive oil in the pan. |
| 5 | Fry chicken at medium heat for 4 minutes per side, preserving the side/turning relationship rather than 4 minutes total. |
| 6 | Reduce heat and cook chicken for another 6 minutes, preserving the continuation after frying. |
| 7 | Remove chicken from the pan and rest covered for 3 minutes. |
| 8 | Slice chicken and serve with potatoes as a side dish and beans. |

No exact generated sentence or grouping boundary is enforced. Two distinct adjacent groupings pass offline: [1,2]/[3,4]/[5,6]/[7]/[8] and [1,2]/[3]/[4,5]/[6,7]/[8]. Both also pass the full server validator and the unchanged 90-character limit.

## Eight-Fixture Constraint Re-Review

All original inputs and classification/quantity/count/portion constraints retained. Classification comes from KB domain/07, quantities from KB tech/06 and explicit input; step preservation comes from the input and US-10.

| Fixture | Retained reviewed constraints |
|---|---|
| mixed-food-seasoning | Chicken 295-305 g, rice 195-205 g, olive oil 25-35 g and onion are food; parsley/salt/pepper seasoning with kitchen amounts. |
| borderline-classification | Spaghetti 395-405 g, garlic/onion/oil food; fresh basil and salt seasoning; oil 25-35 g. |
| explicit-quantities-with-unit-conversion | Beef 245-255 g, tomato paste 40-50 g, canned tomatoes 395-405 g, cream cheese 25-35 g; oregano seasoning with positive estimate and kitchen amount. |
| missing-quantities-food-gets-estimated | Chicken/oil have positive estimates; garlic food; rosemary/thyme seasoning with kitchen amounts. |
| indeterminate-spray-oil-stays-food | Exactly 3 ingredients; spray oil food with null grams; explicit olive oil 10-20 g, chicken 295-305 g. |
| no-lost-or-invented-ingredients | Exactly 6 ingredients; spaghetti 195-205 g, bacon 95-105 g, eggs food, parmesan 45-55 g; salt/pepper seasoning. |
| full-recipe-output-fields | Portions 1-8; flour 495-505 g, water 290-310 g, yeast 6-8 g and oil 25-35 g food; salt seasoning. |
| side-dish-and-serving-actions | Same eight numbered instructions; exactly 8 source entries and ordered trace; newly complete source/export semantics matrix above. Existing ingredients constraint remains empty, not replaced by new classification rules. |

All fixtures retain structural checks, food kitchenAmountText null, existing ingredient-key references/whitelist and export limits. The eval now explicitly checks exact group count and orders for every fixture. Failed early structural assertions prevent later semantic assertions from executing; retained constraints are not claimed as live-verified for those failed fixtures.

## Offline Red / Green Evidence

Before any prompt change, added negative probes to the existing validator test file.

- Red: `npm test --workspace=backend -- src/lib/recipeAnalyzeValidation.test.ts --reporter=dot`, exit 1: 54 failed / 18 passed. Coverage was [1,8], not [1..8]; removed times/actions/heat/rest relationships were accepted by the old rubric.
- Rubric correction, same command, exit 1: 2 failed / 70 passed. Local regex defect: the noun salt was treated as a seasoning verb.
- Local verb correction, same command, exit 0: 72/72 passed, still before prompt modification.
- Subsequent focused expansion exposed one invalid alternate-success test text, exit 1: 251/252 passed. That test text exceeded 90 characters and omitted its slicing referent. Replaced it with another genuinely valid adjacent grouping and required validator success, without loosening assertions.
- Corrected focused expansion, exit 0: 252/252 passed.
- Final focused command below, exit 0: 265/265 passed; validator file contains 89 tests.

Final offline coverage includes 70 source/export loss probes, source instruction swap, swapped export potato/bean times, details moved to unrelated export groups, and invented numeric temperature in source/export. Mutation cases first assert server structural/trace validity, then require the semantic rubric to throw. Thus counts or trace failures do not accidentally explain the expected semantic rejection.

Exact trace [1,2,3,4,5,5] against source 1..5 is rejected by both full import validation and preparation validation, including when duplicates occur across groups. Diagnostic asserts mismatch position 6, expectedOrder null, actualOrder 5. Missing/unknown/reordered references and empty/whitespace export text are rejected; input equality proves no post-hoc trace repair. Valid adjacent groups pass.

## Live Attempts And Stop Decision

Command for each attempt:

`npm run test:eval --workspace=backend -- src/lib/prompts/recipeAnalyze.eval.test.ts --reporter=verbose`

Unchanged deployment: gpt-4o-mini. Unchanged API version: 2024-08-01-preview. Unchanged max_tokens: 2048. Strict recipe_analyze JSON schema and existing client/model selection unchanged. Each run evaluates all 8 existing fixtures once, plus the version guard. No selective fixture rerun, retry-until-green, output repair or assertion relaxation.

| Attempt | Time (local terminal) | Temperature | Fixtures passed | Guard | Exit | Result |
|---|---|---:|---:|---|---:|---|
| Initial v14 baseline | 16:27:00 | 0.2 (original) | 0/8 | PASS | 1 | Seven count failures; full-recipe-output-fields repeated [1,2,3,4,5,5]. |
| Corrected v14, new proof run 1 | 16:29:17 | 0 (Recipe Analyze only) | 2/8 | PASS | 1 | Six count failures persist. Stop. |
| New proof run 2 | Not run | - | - | - | - | Blocked by failed run 1 and explicit stop requirement. |
| New proof run 3 | Not run | - | - | - | - | Blocked by failed run 1 and explicit stop requirement. |

| Fixture | Baseline temperature 0.2 | Corrected candidate temperature 0 |
|---|---|---|
| mixed-food-seasoning | Count 3, expected 5 | Count 3, expected 5 |
| borderline-classification | Count 3, expected 5 | PASS |
| explicit-quantities-with-unit-conversion | Count 4, expected 5 | Count 4, expected 5 |
| missing-quantities-food-gets-estimated | Count 2, expected 5 | Count 2, expected 5 |
| indeterminate-spray-oil-stays-food | Count 1, expected 3 | Count 2, expected 3 |
| no-lost-or-invented-ingredients | Count 2, expected 5 | Count 3, expected 5 |
| full-recipe-output-fields | Duplicate trace [1,2,3,4,5,5] | PASS |
| side-dish-and-serving-actions | Count 4, expected 5 | Count 4, expected 5 |

Local investigation after the first failure identified competing at-most-five planning and exact-M mapping instructions. The candidate replaces the former with one exact-M plan and preserves multiple actions inside the same mapped group. Temperature 0 was a bounded, evidence-based trial after all eight fixtures failed with original parameters. The second full attempt still violates group counts. This does not establish that temperature improves stability: prompt and temperature both changed, and neither passed the gate.

No further prompt experiment or live retry was performed after the failed stabilization attempt. In particular the eight-step live source/export semantic matrix is NOT verified: its fixture failed the earlier group-count assertion. The three consecutive passing full runs are a concrete missing artifact, not a presumed success. The stricter eval exposes a prompt-generation defect; runtime server validation remains unchanged and does not newly enforce exact min(N,5) grouping.

Decision needed from Orchestrator: disposition of this failed v14 candidate and its local temperature-0 experiment, and authorization of any further stabilization approach. Neither is presented as a solution. No broader client/model/token change was attempted.

## Final Gates

Commands run from the workspace root:

| Command | Exit | Evidence |
|---|---:|---|
| `npm test --workspace=backend -- src/lib/recipeAnalyzeValidation.test.ts src/functions/ai.test.ts src/functions/recipes.test.ts --reporter=dot --silent` | 0 | 265/265 tests, 3 files. |
| `npm test --workspace=backend -- --reporter=dot --silent` | 0 | 1378/1378 tests, 66 files, 65.11 seconds; no renderer timeout. |
| `npm run typecheck --workspace=backend` | 0 | No TypeScript diagnostics. |
| `npm run build:verify --workspace=backend` | 0 | Build, module resolution and duplicate Function ID checks pass; expected Functions test-mode warnings. |
| `git diff --check` | 0 | No whitespace errors; existing CRLF/LF warnings only. |

Handler tests preserve 422/429/502, auth-before-quota/provider, quota-before-provider, exactly one provider call and usage exactly once only on valid success. Import still validates ingredient keys and all Analyze fields; text-only preparation validates against saved source orders and ignores irrelevant ingredient output. Preview/preparation tests prove no recipe persistence. B-1 privacy regression remains green; no raw recipe/output logging was added.

## Acceptance / KB Boundary

- AC-1: v14 guard and prompt, exact group-count/export-order eval coverage implemented. Schema/API/five/90/v13 invariants preserved. KB agreement remains pending D-1; both required AI KB references still say v13, deliberately not edited by B-2.
- AC-2/3: complete offline-tested semantic rubric and source-bound export checks implemented; live output compliance NOT established.
- AC-4: deterministic negative/positive trace and boundary tests pass. Required three consecutive all-eight-fixture live passes NOT achieved.
- AC-6: focused and full unit gates, typecheck and build pass; saved-source validation and import contracts retained.

The previously reported KB content-logging/16000-character/30-day statement is outside B-2 and remains D-1's correction. No KB edits were made. This artifact contains only synthetic fixture-derived details, test results and non-secret provider metadata; no private user recipes, endpoint, credential, token or provider response dump.