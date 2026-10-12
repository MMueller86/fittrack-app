# QA Report — Recipe Sharing / Export Preparation Re-Verification

- Format: `fittrack-qa-v1`
- Date: 2026-10-11
- Plan reference: [Approved v21 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md) plus US-10 AC-15/16 ([story](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md))
- Previous verdicts: FAIL ([QA_Current_Recipe_Sharing_2026-10-10.md](QA_Current_Recipe_Sharing_2026-10-10.md), [QA_Recipe_Preparation_Stability_2026-10-10.md](QA_Recipe_Preparation_Stability_2026-10-10.md))
- **Verdict: PASS WITH ISSUES** (see the Verdict section at the end of this file)

## Status log

- Skeleton written first; evidence appended incrementally. A previous invocation of this task had already produced offline-gate artifacts and live full-file runs 01/02 (`RECIPE-REVERIFY-2026-10-11-*`); they are reused as recorded evidence.
- Note: `docs/qa/reports/PLAN_US-10_..._v21.md`, named in the request, is a historical QA report (Q-21 FINAL2). The approved plan with AC-1..AC-10 is the file under `docs/User Stories/Reciepe/`.

## Pre-specified stability bar (fixed before the live series; see `RECIPE-REVERIFY-2026-10-11-baseline.json`)

1. PASS requires all offline gates green and every live run of the bounded series green (full file 21/21; isolated fixtures N/N).
2. Any failing run is diagnosed from raw output as product defect, eval-rubric artefact, or provider variance.
3. A served/accepted output with wrong content (lost source action, invented value, wrong order) is a product defect and Blocking.
4. A controlled safe rejection (HTTP 422, usage 0, no writes, no wrong content) in at most 1 of N comparable runs is Non-blocking at most (PASS WITH ISSUES). Two or more failures of the same fixture, or any accepted wrong content, keep FAIL.
5. No retry-until-green; failures stay recorded; series are not extended to dilute a failure.
6. The doneness-clause dispute (FT-QA-2026-086) is not used as a blocker; oven content judgment is MANUAL VALIDATION REQUIRED.

## Interim evidence (appended during the run)

| Check | Exit | Result |
|---|---:|---|
| Executed code is current `backend/src` (vitest/tsc run from sources; eval runs load `src/**` through vitest, no `dist` import); candidate hash stable before/after every live run | - | OK, see `candidateStable` in each `RECIPE-REVERIFY-2026-10-11-*-runNN.json` |
| `cd backend && npx tsc --noEmit -p tsconfig.json` | 0 | no errors |
| `cd backend && npx vitest run` | 0 | 69 files, 1659/1659 passed |
| Live full file `recipeAnalyze.eval.test.ts` x10 (8 requested; the pre-registered helper ran 10, no failure to dilute) | 0 each | 10/10 runs 21/21 |
| Live rice isolated x10 | 0 each | 10/10 (2 tests per run: provenance + handler) |
| Live Import `side-dish-and-serving-actions` x8 | 0 each | 8/8 |

## Content inspection of recorded oven/dough runs (FT-QA-2026-094, 096, 086)

Source: `synthetic preparation complete attempt evidence` lines in `RECIPE-REVERIFY-2026-10-11-oven-seven-steps-run01..06-Output.txt` and `...-dough-forced-run01..06-Output.txt` (identical text also logged in the 10 full-file runs).

- Oven source step 3 `Schichte Kartoffeln ... gieße Sahne darüber`, step 4 `Streue Käse über die Kartoffeln`. In 5 of 6 oven runs the first draft already merged both and a second (text-only) correction shortened it; run05 was fit on the first call. Final merged step per run:
  - run01 `Kartoffeln schichten, Sahne gießen, Käse streuen.` (correct)
  - run02 `Kartoffeln in die Form schichten, Sahne darüber gießen, Käse streuen.` (correct)
  - run03 `Kartoffeln in die Form schichten, Sahne darüber gießen, Käse streuen.` (correct)
  - run04 `Kartoffeln schichten, Sahne gießen, Käse streuen.` (correct)
  - run05 `Schichte Kartoffeln in die Form, gieße Sahne darüber und streue Käse darüber.` (correct, no correction)
  - run06 `Kartoffeln in die Form schichten, Sahne und Käse darüber geben.` (cheese `streuen` weakened to the neutral `darüber geben`; not pour-cheese, but the sprinkle action is no longer explicit)
  - The 10 full-file oven runs carry the same evidence lines; the six dedicated runs are the sample used for the assessment.
- FT-094 literal defect (`Sahne und Käse darüber gießen`, pour-cheese) did not occur in 0/6 oven runs. 1/6 shows the same class in a milder form (`geben`). Human culinary judgment of that wording = MANUAL VALIDATION REQUIRED. The shortening/text-correction flow and prompts were not changed; FT-094 is therefore not reproduced in its original form, not closed (no code change, finite sample).
- Dough forced-overflow (FT-096): 6/6 runs identical: forced overflow draft, two real text-only corrections (call 1 and 2 `generated-text-failure`), call 3 `success`, HTTP 200, 2 SDK calls / 3 logical calls, semantic assertion passed (`Mehl, Quark, Zucker, Backpulver, Ei, Kerne, Salz vermischen.`; all source ingredients retained). The previous 422 exhaustion did not recur. Output is nearly deterministic at temperature 0.2, so 6 equal samples carry limited extra information.
- Oven provenance test (FT-087): `uses only source-supported total time` passed in all 16 oven runs (10 full + 6 dedicated); the quota-before-provider and usage-after-success order assertions also passed.
- FT-086 doneness clause: not treated as blocker. Oven content judgment = MANUAL VALIDATION REQUIRED (test status `MANUAL_VALIDATION_REQUIRED` in output).
, tallied from `*-summary.json`; candidate hash stable in every run)

| Series | Artifacts | Runs | Runs exit 0 | Failed tests | Result |
|---|---|---:|---:|---:|---|
| Full file `recipeAnalyze.eval.test.ts` | [summary](RECIPE-REVERIFY-2026-10-11-full-summary.json), `full-run01..10` | 10 | 10 | 0 (210/210 tests) | PASS 10/10 |
| Rice isolated `synthetic-saved-eight-steps-rice-serv` | [summary](RECIPE-REVERIFY-2026-10-11-rice-summary.json) | 10 | 10 | 0 (20/20 tests) | PASS 10/10 |
| Import `side-dish-and-serving-actions` | [summary](RECIPE-REVERIFY-2026-10-11-import-side-dish-and-serving-actions-summary.json) | 8 | 8 | 0 | PASS 8/8 |
| Import `full-recipe-output-fields` | [summary](RECIPE-REVERIFY-2026-10-11-import-full-recipe-output-fields-summary.json) | 8 | 8 | 0 | PASS 8/8 |
| Import `indeterminate-spray-oil-stays-food` | [summary](RECIPE-REVERIFY-2026-10-11-import-indeterminate-spray-oil-stays-food-summary.json) | 8 | 8 | 0 | PASS 8/8 |
| Import `no-lost-or-invented-ingredients` | [summary](RECIPE-REVERIFY-2026-10-11-import-no-lost-or-invented-ingredients-summary.json) | 8 | 8 | 0 | PASS 8/8 |
| Oven `synthetic-saved-oven-seven-steps` (provenance + handler tests) | `oven-seven-steps-run01..06` (`-Report.json`, `-Output.txt`) | 6 | 6 | 0 (12/12 tests) | PASS 6/6 |
| Dough `synthetic-dough-forced-initial-overfl…` (forced initial overflow, real correction; handler test) | `dough-forced-run01..06` | 6 | 6 | 0 (6/6 tests) | PASS 6/6 |
| Dough, first attempt with the untruncated id filter | `dough-overflow-run01..06` | 6 | 6 | 0 tests executed (21 skipped) | NO EVIDENCE: vitest truncates `$id` in the title, so the filter matched nothing; no provider call was made; kept as recorded, replaced by the `dough-forced` series |

Totals of executed live tests: 210 (full) + 20 (rice) + 8 + 8 + 8 + 8 (Import) + 12 (oven) + 6 (dough) = 280 passed, 0 failed. No run failed, so the bar's failure rules (items 2-4) were not triggered. Secret scan of all `RECIPE-REVERIFY-2026-10-11-*` artifacts and this report for the configured endpoint/key: none found (237 files).

## Offline gates (recorded)

| Command | Exit | Result | Evidence |
|---|---:|---|---|
| `cd backend && npx tsc --noEmit -p tsconfig.json` | 0 | no errors | [tsc output](RECIPE-REVERIFY-2026-10-11-offline-backend-tsc-Output.txt) |
| `cd backend && npx vitest run` | 0 | 69 files, 1659/1659 passed | [vitest output](RECIPE-REVERIFY-2026-10-11-offline-backend-vitest-Output.txt), [report](RECIPE-REVERIFY-2026-10-11-offline-backend-vitest-Report.json) |
| `cd backend && npm run build:verify` | 0 | All checks passed | [output](RECIPE-REVERIFY-2026-10-11-offline-build-verify-Output.txt) |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed | [output](RECIPE-REVERIFY-2026-10-11-offline-encoding-Output.txt) |
| `cd shared && npx tsc --noEmit` / `npx vitest run` | 0 / 0 | no errors; 10 files, 450/450 | [tsc](RECIPE-REVERIFY-2026-10-11-offline-shared-tsc-Output.txt), [vitest](RECIPE-REVERIFY-2026-10-11-offline-shared-vitest-Output.txt) |
| `cd mobile && npx tsc --noEmit` / `npx vitest run` | 0 / 0 | no errors; 59 files, 640/640 | [tsc](RECIPE-REVERIFY-2026-10-11-offline-mobile-tsc-Output.txt), [vitest](RECIPE-REVERIFY-2026-10-11-offline-mobile-vitest-Output.txt) |
| Offline probe of the new helpers (no provider calls) | 0 | 8/8 probe tests; edge cases in the code review below | [probe](RECIPE-REVERIFY-2026-10-11-probe.mjs), [output](RECIPE-REVERIFY-2026-10-11-probe-Output.json), [vitest probe](RECIPE-REVERIFY-2026-10-11-probe-vitest-Output.txt) |

Prompt version guards: `TESTED_PROMPT_VERSION = 'v17'` (Import) and `TESTED_PREPARATION_PROMPT_VERSION = 'v12'` in `recipeAnalyze.eval.test.ts` match `RECIPE_ANALYZE_PROMPT_VERSION = 'v17'` and `RECIPE_PREPARATION_PROMPT_VERSION = 'v12'` in `recipeAnalyze.ts`; the three version-guard tests passed in every full-file run.

## Assessment of earlier findings (current candidate, recorded evidence only)

QA reports observed results; it does not close findings in the register. "Closed by evidence" below means: no recurrence in the executed series plus matching offline tests.

| Finding | Assessment | Evidence |
|---|---|---|
| FT-QA-2026-086 (oven doneness clause) | Not treated as a blocker (disputed clause). Oven content judgment = MANUAL VALIDATION REQUIRED; oven fixture runs 16/16 (10 full + 6 dedicated) technically green, test status `MANUAL_VALIDATION_REQUIRED` in output. | oven-seven-steps-run01..06 |
| FT-QA-2026-087 (unsupported aggregate time) | Closed by evidence for the current candidate: provenance test `uses only source-supported total time` passed 10/10 (full) + 6/6 (oven) for rice, oven, pasta, explicit-total, all-timed, component-times fixtures; guard code in `recipeTotalTimeGuard.ts` (see RV-02 for residual edge cases). No universal guarantee. | full-run01..10, oven-seven-steps-run01..06 |
| FT-QA-2026-090 (rice core / required success) | Closed by evidence: rice isolated 10/10 (provenance + handler = 20/20 tests) and rice inside 10/10 full runs; first-reference inversion repaired mechanically (probe: `1,3,6,5,8` becomes `1,3,5,6,8` with text pairing kept; genuinely invalid drafts such as duplicates, unknown or empty references still exhaust after 3 calls). | rice-run01..10, probe output |
| FT-QA-2026-093 (Import finishing action loss) | Closed by evidence: `side-dish-and-serving-actions` 8/8 isolated and 10/10 inside full runs including the strict source-6 semantic assertion. | import-side-dish-and-serving-actions-run01..08 |
| FT-QA-2026-094 (oven shortening substitutes sprinkle-cheese by pour-cheese) | Not reproduced in its literal form (0/6 `gießen` for cheese); still open (no code or prompt change to the text-correction path; finite sample). One of six runs shows a milder related wording (`Sahne und Käse darüber geben`, run06). See RV-05. Human judgment = MANUAL VALIDATION REQUIRED. | oven-seven-steps-run01..06 |
| FT-QA-2026-095 (KB version / ETag drift) | Still open (Non-blocking). Import v17 and the up-to-3-provider-call correction loop are documented (`domain/07-ai-features.md:105,178`, `tech/06-ai-integrations.md:66,217`); stale statements remain, see RV-03. | grep of `docs/kb` |
| FT-QA-2026-096 (forced-dough text-correction exhaustion) | Not reproduced: 6/6 runs HTTP 200, semantic assertion passed, 2 SDK calls / 3 logical calls; the earlier 422 did not recur. Not closed by QA (outputs are near-deterministic at temperature 0.2). | dough-forced-run01..06 |
| FT-QA-2026-073 (spray-oil invented quantity) | Closed by evidence: `indeterminate-spray-oil-stays-food` 8/8 isolated + 10/10 in full runs; production code additionally nulls food `amountGrams < 0.1` (`openai.ts` end of `analyzeRecipeText`). | import-indeterminate-spray-oil-stays-food-run01..08 |
| FT-QA-2026-076 (Import missing finish-cooking core) | Closed by evidence: `side-dish-and-serving-actions` 8/8 + `no-lost-or-invented-ingredients` 8/8 + full runs; `cookingEssential` planning flag and `missingEssentialCookingOrders` feedback in place. | same series |
| FT-QA-2026-078 (Import duplicate source trace) | Closed by evidence: `full-recipe-output-fields` 8/8 isolated and all `mixed-food-seasoning` runs in 10/10 full runs; ascending/unique trace rule retained and enforced via sort plus directed correction. | import-full-recipe-output-fields-run01..08 |

## Criteria matrix

Plan: approved v21 (`docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md`, AC-1..AC-10) and US-10 AC-15/16.

| AC | Result | Evidence |
|---|---|---|
| AC-1 small Preparation provider contract; Import full analysis in one operation; first call creation, corrections via existing prompt/schema selection | PASS, with deviation: the plan text says Import v16, the candidate is Import v17 (one analysis incl. export suggestion, up to 3 provider calls of the same analysis). Deviation noted, matches the request and `tech/06-ai-integrations.md:217`. | `openai.ts` `prepareRecipeExport` (`recipe_export_preparation` / `recipe_text_correction` schemas), `analyzeRecipeText` loop; backend unit suite; dough series 2 SDK calls / 3 logical calls |
| AC-2 complete saved ID-free context to provider; no private IDs; free grouping, original order | PASS | unit suite 69/1659; rice/oven/pasta/dough handler tests in 10 full runs + series; `savedSourceUnchanged`, `v2Body`, `compactSchema` true in executed-protection evidence |
| AC-3 shared limits (1/5 steps, 90 chars, teaser 96/97) and renderer 1..5 steps | PASS | shared 450/450, backend template tests (`renders selective cooking summaries at 1..5 steps including 90 characters`), mobile 640/640 |
| AC-4 unchanged Preparation validation accepts `[1,4,6],[5]`, rejects empty/unknown/duplicate/inverted; Import keeps global monotone rule | PASS | unit tests; probe: duplicate across/within group, unknown, empty, zero steps, six steps all exhausted after 3 calls (probe output). New mechanical sort changes order only, never fills or deduplicates references. |
| AC-5 saved eight-step rice fixture, independent handler/SDK eval; cooking, separate rice, finishing identifiable | PASS | rice isolated 10/10, full runs 10/10; semantic assertions inside the test (`exportStepSemanticAssertions` for sources 1, 4, 5, 6) executed |
| AC-6 oven and pasta fixtures pass technical gates; no invented times/temperatures; oven human review separate | PASS (technical); human oven review MANUAL VALIDATION REQUIRED | oven 16/16 and pasta 10/10 (inside full runs); no-invented-temperature assertion; manual note emitted in output |
| AC-7 auth/owner/ETag, 429/502/422, schemas, temperature 0.2 / max_tokens 2048, usage only after success, no writes, call budget | PASS | executed evidence per run: `quotaOrder`, `usageOrder`, `noWrites` true, `temperature` 0.2, `maxTokens` 2048; handler tests in unit suite; `ai.ts` order: quota, provider, validation, `trackUsage` once. Note: Preparation budget (initial + up to 2 corrections) confirmed by dough run (3 logical calls). |
| AC-8 cooking-core/contradiction regressions, Import protection tests, unit suite, typecheck, build:verify | PASS | tsc 0, vitest 69 files / 1659 passed, build:verify 0, encoding 0, shared/mobile green (tables above) |
| AC-9 Preparation live gate, Recipe live gate, overall eval gate; focus filters verified; no retry-until-green | PASS for Preparation and Recipe gates (full `recipeAnalyze.eval.test.ts` 10/10 = 210/210; Preparation fixtures isolated). Overall Daily/Weekly gate: OUT OF SCOPE for this re-verification per the request, not claimed. One unusable first dough filter attempt is disclosed (matched 0 tests, no provider call) and replaced by the corrected filter; no failure was diluted. | full-summary.json; baseline.json; dough-overflow-run01..06 (no evidence) vs dough-forced-run01..06 |
| AC-10 documentation of small Preparation output, Import separation, reference validation/API, limits of runtime semantic checks; KB deviations named | PASS WITH ISSUES | Core v12/v17 versions documented; residual stale statements named in RV-03 |
| US-10 AC-15 more than five source steps are condensed semantically to at most five export steps | PASS | rice (8 steps), oven (7), pasta (7), dough (4 steps) fixtures; export step counts 4-5 in executed handler evidence; 5-step cap enforced by schema/validation |
| US-10 AC-16 condensation keeps order, actions, ingredient relation, temperature, time | PASS for automated checks; oven content = MANUAL VALIDATION REQUIRED | retained times must occur in referenced source (provenance assertions), retained temperatures must occur in source, order sorted by first reference; Import `inventedExportTemperatures` check |

## Critical code review

Reviewed: `backend/src/lib/recipePreparationOrder.ts`, `recipeTotalTimeGuard.ts`, `recipeImportCookingCheck.ts`, `analyzeRecipeText` in `backend/src/lib/openai.ts`, plus the handler order in `backend/src/functions/ai.ts`.

Checked and found fine:
- `cookingEssential` does not leak: it exists only in the provider schema and prompt, `stripCookingEssential` runs before any value leaves `analyzeRecipeText`, and `openai.recipeAnalyze.test.ts` asserts it.
- Quota/usage ordering: `enforceQuota` runs before the first provider call, `trackUsage` once after validation, regardless of up to three provider calls; failed validation returns 422 before usage.
- Logging/secrets: no new logging in the helpers or the loop; handler logs only counts; no secrets in code or artifacts.
- Sort: input not mutated, malformed or empty references returned untouched so the validator still rejects; duplicates stay duplicates (probe).

### Findings

```text
Finding key: RV-01
Plan reference: docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md
Acceptance criterion: AC-4 (Import trace rule); US-10 AC-16
Description: After two failed directed corrections, analyzeRecipeText applies forceAscendingExportReferences, which silently drops every reference that does not continue the ascending trace and removes steps left without references. Other violated rules (step count vs numbered instructions, missing cookingEssential steps, invented temperatures) are not repaired at all and the result is still served. A request can therefore return HTTP 200 with a lost source action, an invented temperature or fewer source steps than numbered instructions, with usage tracked normally.
Criticality: Non-blocking
Owner: Backend
Evidence: openai.ts lines ~650-662 (attempt === 2 branch); probe output: forceInterleave [1,4,6],[5],[8] becomes [1,4,6],[8] (source 5 dropped), forceDuplicate drops the garnish step. Not observed in any live run (all Import runs passed their semantic assertions), frequency unknown.
Reproduction: node docs/qa/reports/RECIPE-REVERIFY-2026-10-11-probe.mjs
Recommendation: Prefer a controlled failure (422, no usage) or at least a server-side warning when forcing drops a step that was flagged cookingEssential; add a unit test for the exhausted-corrections path with a dropped essential step.
```

```text
Finding key: RV-02
Plan reference: v21 plan AC-2 / AC-6 (no unsupported aggregate time)
Acceptance criterion: AC-2; AC-6
Description: enforceSourceBackedTotalTime is conservative in one direction and permissive in the other. (a) It nulls legitimate totals: "Gesamtzeit: 1 Std. 30 Min." with model total 90 is nulled because only the first number is read (60), and prep+cook components stated in the source (15 + 30 = 45) are nulled. (b) If every saved step contains any duration, any model total is kept, including a wrong one (15 + 10 minutes steps, model 90 kept).
Criticality: Non-blocking
Owner: Backend
Evidence: probe output: guardExplicitTotalHoursMinutes null, guardPrepPlusCook null, guardAllTimedWrongSum 90, guardAllTimedSum 25. Losing a time is not wrong content; (b) can show an unsupported value only when every step is timed.
Reproduction: node docs/qa/reports/RECIPE-REVERIFY-2026-10-11-probe.mjs
Recommendation: Parse "h + min" combinations, and for the all-timed case compare against the sum of step durations (or accept only a total >= the sum); add tests for both.
```

```text
Finding key: RV-03
Plan reference: v21 plan AC-10; US-10 AC-28 (see FT-QA-2026-095)
Acceptance criterion: AC-10
Description: Current-contract KB prose still names superseded versions or contracts. domain/07-ai-features.md:170-171 and :204 say Import v16 / Preparation v11 (same file :105 says v17/v12); tech/06-ai-integrations.md:76 says import v16 (same file :66, :217 say v17); tech/02-backend.md:277, tech/09-api-reference.md:404 and tech/08-testing.md:133 say Preparation v11; tech/04-shared-library.md:109-110 describes a mandatory If-Match plus sourceEtag comparison, contradicting tech/03-mobile.md:221, tech/09-api-reference.md and domain/06-recipes.md:224-230 (optional ETag, sourceEtag compatibility metadata).
Criticality: Non-blocking
Owner: Documentation
Evidence: grep results above against backend/src/lib/prompts/recipeAnalyze.ts:9-10 (v17, v12).
Reproduction: grep -nE "Import v16|Preparation v11|If-Match" docs/kb/domain/07-ai-features.md docs/kb/tech/*.md
Recommendation: Align only current-version and optional-ETag statements; keep dated historical sections.
```

```text
Finding key: RV-04
Plan reference: N/A (new behaviour of Import v17)
Acceptance criterion: AC-7 (call budget and robustness, Import side)
Description: The Import loop makes up to three sequential provider calls without a per-call timeout, abort signal or maxRetries override; the client is created with SDK defaults (new AzureOpenAI at openai.ts:94), whereas the Preparation path sets maxRetries 0 and a 20 s timeout. Worst-case latency and retry volume grow threefold versus the former single call.
Criticality: Suggestion
Owner: Backend
Evidence: openai.ts:94 versus :605; loop at :635-660.
Reproduction: code inspection.
Recommendation: Pass an explicit timeout and maxRetries for the Import calls or bound the total loop time.
```

```text
Finding key: RV-05
Plan reference: v21 plan AC-6 / US-10 AC-16 (see FT-QA-2026-094)
Acceptance criterion: AC-6; US-10 AC-16
Description: In 1 of 6 recorded oven runs (run06) the text-only correction merged the layered steps to "Kartoffeln in die Form schichten, Sahne und Käse darüber geben." The cheese action "streuen" is no longer explicit. The other five runs keep "Sahne gießen / Käse streuen" (or the equivalent). The oven fixture is manual-tagged, so no automated assertion covers component-action relations; the literal FT-094 defect ("Käse darüber gießen") was not seen.
Criticality: Suggestion
Owner: Backend
Evidence: RECIPE-REVERIFY-2026-10-11-oven-seven-steps-run06-Output.txt (complete attempt evidence, attempt 2 output).
Reproduction: cd backend; node scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts -t "synthetic-saved-oven-seven-steps" (non-deterministic).
Recommendation: Human review of the oven wording; optionally add a component-action contradiction assertion for cheese pouring if the product owner treats "geben" as unacceptable.
```

## Manual validation and unverified items (not findings)

| Item | Status | Prerequisite / steps | Result field |
|---|---|---|---|
| Oven export culinary correctness (FT-086 doneness clause, FT-094 wording) | MANUAL VALIDATION REQUIRED | Read oven final texts in `oven-seven-steps-run01..06-Output.txt`; judge endpoint (potatoes done), cheese action, no invented values | ______ |
| On-device share flow with a real recipe (mobile), PNG visual check | MANUAL VALIDATION REQUIRED | Device/emulator, real Azure OpenAI backend | ______ |
| Overall eval gate including Daily/Weekly insight evals | OUT OF SCOPE for this review (request); not claimed | - | - |
| Contract tests against Cosmos emulator | UNVERIFIED (not run in this review; no persistence code changed) | Cosmos emulator | ______ |
| Statistical stability beyond the executed samples | UNVERIFIED by nature: samples are finite at temperature 0.2; no guarantee claimed | - | - |

## Verdict

**Verdict: PASS WITH ISSUES**

Basis (pre-specified bar): all offline gates green; every live run of every bounded series passed (full file 10/10, rice 10/10, four Import fixtures 8/8 each, oven 6/6, dough 6/6; 280/280 live tests); no failing run, so no run needed classification; no accepted wrong content observed. Open actionable findings are Non-blocking or Suggestion only (RV-01..RV-05; FT-QA-2026-095 documentation drift continues as RV-03). Manual and unverified items are listed separately and do not lower the verdict.
