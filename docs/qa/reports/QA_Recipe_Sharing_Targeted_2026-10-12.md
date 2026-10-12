# QA Report — Recipe Sharing / Export Preparation Targeted Verification

- Format: `fittrack-qa-v1`
- Date: 2026-10-12
- Plan reference: [Approved v21 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md) plus US-10 AC-15/16
- Previous report: [QA_Recipe_Sharing_Reverification_2026-10-11.md](QA_Recipe_Sharing_Reverification_2026-10-11.md) (PASS WITH ISSUES; RV-01..RV-05 = FT-QA-2026-097..101)
- **Verdict: PASS WITH ISSUES** (see the Verdict section at the end of this file)

## Status log

- Skeleton written first; evidence is appended after every step.
- Finalization: the QA agent returned no final response in three invocations and left steps 4-5 open. On the explicit instruction of the user (2026-10-12: close the report overall as PASS WITH ISSUES, no new QA run) the Orchestrator completed the criteria matrix, finding list, manual-validation list and verdict below **exclusively from the evidence already recorded in this report and its artifacts**; no further test, probe or live call was run for this completion.

## Pre-specified bar (fixed before any live run)

1. PASS requires all offline gates green and every live run of the bounded series green.
2. Any failing run is diagnosed from raw output as product defect, rubric artefact, or provider variance.
3. No retry-until-green; series are not extended to dilute a failure.
4. Bounded counts: (a) full `recipeAnalyze.eval.test.ts` x8; (b) `synthetic-dough-forced` x10; (c) `synthetic-saved-oven-seven-steps` x8; (d) `no-lost-or-invented-ingredients` x10; (e) `side-dish-and-serving-actions` x8.
5. Missing items are marked UNVERIFIED, not silently passed.

## Evidence (appended)

### Step 1 — Candidate state
- Working tree has uncommitted changes versus HEAD `b637ee5` (2026-10-07) in `backend/src/**` and `docs/kb/**` (accumulated over several rounds); new untracked files: `recipeImportCookingCheck.ts`, `recipePreparation.ts`, `recipePreparationOrder.ts`, `recipeTotalTimeGuard.ts` (+ tests `recipePreparation.test.ts`, `recipePreparationOrder.test.ts`, `recipeTotalTimeGuard.test.ts`). Modified for this round: `lib/openai.ts`, `lib/prompts/recipeAnalyze.ts`, `lib/recipeAnalyzeValidation.ts` (+tests), `functions/ai.ts`, `prompts/recipeAnalyze.eval.test.ts`, 7 KB documents. Delta since the last QA round cannot be isolated from git (no commit in between); the review reads the current files.
- Executed code is source: vitest/tsc run from `backend/src` (no dist import); the live helper hashes the candidate files before/after each series (`candidateStable`).

### Step 2 — Offline gates

| Command | Exit | Result | Evidence |
|---|---:|---|---|
| `cd backend && npx tsc --noEmit -p tsconfig.json` | 0 | no errors | [output](RECIPE-TARGETED-2026-10-12-offline-backend-tsc-Output.txt) |
| `cd backend && npx vitest run` | 0 | 69 files, 1670/1670 passed | [output](RECIPE-TARGETED-2026-10-12-offline-backend-vitest-Output.txt) |
| `node scripts/check-encoding.mjs` (repo root) | 0 | Encoding check passed | [output](RECIPE-TARGETED-2026-10-12-offline-encoding-Output.txt) |
| `cd backend && npm run build:verify` | 0 | All checks passed | [output](RECIPE-TARGETED-2026-10-12-offline-build-verify-Output.txt) |
| `cd shared && npx tsc --noEmit` / `npx vitest run` | 0 / 0 | no errors; 450/450 | [tsc](RECIPE-TARGETED-2026-10-12-offline-shared-tsc-Output.txt), [vitest](RECIPE-TARGETED-2026-10-12-offline-shared-vitest-Output.txt) |
| `cd mobile && npx tsc --noEmit` / `npx vitest run` | 0 / 0 | no errors; 640/640 | [tsc](RECIPE-TARGETED-2026-10-12-offline-mobile-tsc-Output.txt), [vitest](RECIPE-TARGETED-2026-10-12-offline-mobile-vitest-Output.txt) |

### Step 1b — Full run 08 (finalization note)
- The earlier session's series script (`RECIPE-TARGETED-2026-10-12-run-series.ps1 -Name full -Count 8`) was still running when this finalization began (run 07 in progress). A duplicate run 08 started by QA was stopped before completion; run 08 is the series' own run ([output](RECIPE-TARGETED-2026-10-12-full-run08-Output.txt), written 10:13:15, matches [summary](RECIPE-TARGETED-2026-10-12-full-summary.json)). Not a retry; no run was replaced.
- Raw captures are UTF-16 PowerShell redirects; read-only decoding helpers: [tally](RECIPE-TARGETED-2026-10-12-tally.mjs), [import events](RECIPE-TARGETED-2026-10-12-import-events.mjs) (no production, test, fixture, prompt or KB file changed by this QA round).
- All series summaries report `candidateStable: true` (candidate file hashes identical before/after each series).

## Step 2 — Live series tally (bar applied as pre-specified; no run extended or replaced)

| Series | Bar | Result | Evidence |
|---|---|---|---|
| (a) Full `recipeAnalyze.eval.test.ts` x8 | 8/8 green | **8/8 green** (21/21 tests each, 90-131 s) | [summary](RECIPE-TARGETED-2026-10-12-full-summary.json), [run01](RECIPE-TARGETED-2026-10-12-full-run01-Output.txt) .. [run08](RECIPE-TARGETED-2026-10-12-full-run08-Output.txt) |
| (b) `synthetic-dough-forced` x10 | 10/10 green | **10/10 green**; every run: 2 logical Preparation calls (1 injected overflowing initial draft + 1 real text-only correction), 1 SDK call, usage 1, HTTP 200; final lengths [60,28,54,30], 4 steps; initial overflow 300x112 vs 302x105 | [summary](RECIPE-TARGETED-2026-10-12-dough-forced-summary.json), [run01](RECIPE-TARGETED-2026-10-12-dough-forced-run01-Output.txt) |
| (c) `synthetic-saved-oven-seven-steps` x8 | 8/8 green | **8/8 green** (2 tests each). Cheese wording: **8/8 "streue/streuen"**, 0/8 "gieße/gebe/darüber geben". Logical calls: 4 runs one call (runs 2,4,5,7), 4 runs two calls (runs 1,3,6,8; second = text-only shortening, still "Käse streuen") | [summary](RECIPE-TARGETED-2026-10-12-oven-seven-steps-summary.json), [run01](RECIPE-TARGETED-2026-10-12-oven-seven-steps-run01-Output.txt) |
| (d) `no-lost-or-invented-ingredients` x10 | 10/10 green | **10/10 green** (9-20 s; run 4 took 20 s, consistent with an additional import call - not directly observable). No HTTP 422 / `RecipeAnalysisContractError` (every test would have thrown). Frequency of the refs-only repair: **UNVERIFIED** - the Import eval logs neither attempt counts nor repair events | [summary](RECIPE-TARGETED-2026-10-12-import-no-lost-or-invented-ingredients-summary.json), [events](RECIPE-TARGETED-2026-10-12-import-events.mjs) |
| (e) `side-dish-and-serving-actions` x8 | 8/8 green | **7/8 green, 1 FAIL (run 08)** | [summary](RECIPE-TARGETED-2026-10-12-import-side-dish-and-serving-actions-summary.json), [run08](RECIPE-TARGETED-2026-10-12-import-side-dish-and-serving-actions-run08-Output.txt) |

Failure diagnosis (series e, run 08), from raw output: assertion `Source 8: ... /(?:mit|dazu|zusammen)[^;]*kartoffel[^;]*beilage/iu` received `Schneide das Hähnchen auf und serviere es mit den Kartoffeln und den Bohnen.` The fixture input (fixtures.ts line 542) says "... mit den Kartoffeln als Beilage und den Bohnen"; the model dropped the words "als Beilage" in source step 8 only. Export steps (potatoes cooked, beans cooked, chicken cooked and rested, served with potatoes and beans) and ingredient assertions were intact; no step, ingredient or action was lost. Classification: **provider variance on an LLM wording choice, with the rubric correctly flagging a minor source-fidelity loss**; not a rubric artefact (the input does contain "als Beilage") and not evidence of a deterministic product defect (the same fixture passed 8/8 in the 2026-10-11 series and 8/8 inside the full runs of this round, so 15/16 this round). Per bar items 1 and 3 the series is **not green** and is not extended or replaced; it blocks a clean PASS.

## Step 3 — Per-finding verification

| Finding | Scope checked | Result | Evidence |
|---|---|---|---|
| FT-QA-2026-094 (oven cheese action substituted) | Cheese wording in all oven runs | **Verified closed by automatic evidence; human oven judgment = MANUAL VALIDATION REQUIRED.** 8/8 runs keep "streue(n) Käse"; 0/8 "gieße/gebe/darüber geben"; also in the 4 runs that went through text-only shortening ("Käse streuen"). Automatic evidence is not a human content approval. | [oven summary](RECIPE-TARGETED-2026-10-12-oven-seven-steps-summary.json), [run01](RECIPE-TARGETED-2026-10-12-oven-seven-steps-run01-Output.txt), [run03](RECIPE-TARGETED-2026-10-12-oven-seven-steps-run03-Output.txt) |
| FT-QA-2026-095 (KB version / ETag drift) | Current-contract statements | **Verified closed.** KB states Import v17 / Preparation v12 (07-ai-features lines 105-106, 170-171; 06-ai-integrations lines 66-67; 02-backend line 277; 09-api-reference line 404; code: `recipeAnalyze.ts` lines 9-10). `If-Match` optional and `sourceEtag` compatibility-only (09-api-reference lines 269, 380-386, 428-433, 536). Remaining v4/v6/v7/v8/v16 mentions in 06-ai-integrations (lines 260-295, 342-357, 439, 523) sit in dated or version-titled history sections and none is phrased as current. | [kb grep](RECIPE-TARGETED-2026-10-12-kb-version-grep.txt), KB files cited |
| FT-QA-2026-096 (forced-dough text-only exhaustion) | `textCorrectionLimit`, shortening prompt, dough series, v12 label, eval mirror | **Verified closed.** `textCorrectionLimit` (openai.ts line 571) = max(10, floor(len x min(1, width ratio, height ratio) x 0.75)); independent hard-coded expectations in `openai.recipeAnalyze.test.ts` (maxCharacters 53/10/11) so the formula is unit-tested without self-reference. Shortening prompt (recipeAnalyze.ts line 12) requires counting against `maxCharacters` and dropping conjunctions/target phrases. Dough series 10/10 with exactly 2 logical calls (initial forced overflow + 1 real shortening) and a valid 4-step result. Preparation prompt version deliberately left at v12 although the text-correction prompt changed: **acceptable** for this round because the version guard test pins v12, all live evidence was gathered against the current hashed candidate, and the output contract is unchanged; recorded as Suggestion RT-04 (provenance). Eval test mirrors the user message with production `openai.textCorrectionLimit`: **not circular** for the formula (unit-tested independently) but it only proves message assembly, not that 0.75 is the right factor; the live dough series supplies that proof. | [dough summary](RECIPE-TARGETED-2026-10-12-dough-forced-summary.json), [run05](RECIPE-TARGETED-2026-10-12-dough-forced-run05-Output.txt), `backend/src/lib/openai.ts`, `backend/src/lib/prompts/recipeAnalyze.eval.test.ts` line 477 |
| FT-QA-2026-097 (Import v17 repair / violations) | `redistributeExportReferences`, `blockingImportViolations`, 422 path | **Verified closed.** `redistributeExportReferences` (recipePreparationOrder.ts line 25) only rewrites `sourceStepOrders`; step objects, texts, `order` and count are spread through unchanged; I traced the partition arithmetic and the union of references is preserved. It is only invoked when every blocking violation is of kind `trace` (openai.ts lines 676-686); all other blocking violations throw `RecipeAnalysisContractError`, handled in `ai.ts` line 542 as HTTP 422 before `trackUsage` (line 567); details are server-generated messages (violation texts, step orders, temperatures, keys), no recipe text. `blockingImportViolations` (recipeImportCookingCheck.ts line 105) lets a missing `cookingEssential` reference through only when the input has fewer than two numbered instructions; numbered mismatch always blocks. Unit tests: `recipePreparationOrder.test.ts`, `ai.test.ts` (422 without usage, 3 provider calls). Live: no 422 in 18+ import-fixture runs. **Residual (Suggestion RT-02/RT-05):** the repaired references and `ingredientKeys` remain in the HTTP JSON of `recipe-analyze` (`exportSuggestion` passed through at ai.ts line 604); they are absent from `shared` and `mobile` (grep: no `sourceStepOrders` in either), so "not part of any client contract" is true for typed consumers, not for the wire. | `backend/src/lib/openai.ts`, `recipePreparationOrder.ts`, `recipeImportCookingCheck.ts`, `functions/ai.ts`, `ai.test.ts`, [no-lost summary](RECIPE-TARGETED-2026-10-12-import-no-lost-or-invented-ingredients-summary.json) |
| FT-QA-2026-098 (total-time guard) | `recipeTotalTimeGuard.ts`, probes | **Verified closed.** Compound "1 Std. 30 Min." handled as one duration; explicit totals via bounded `gesamt/insgesamt/total` patterns; sum rules (all steps timed, or >=2 durations in description); probes: range 40-45 with draft 40 -> null, h-unit 120, decimal comma 90, seconds 1, non-integer/zero untouched. Regex robustness: no nested unbounded quantifiers, but digit runs are quadratic (20 000 digits = 3.2 s; bounded worst case 50 steps x 2000 digits = 822 ms, step text is limited to 2000 chars). Two guard false positives exist ("insgesamt dreimal ... 40 Minuten" keeps 40; "Gesamtmenge ... 30 Min." keeps 30). Neither is blocking: the guard only ever nulls, never invents, and the model must have proposed the number. Recorded as Suggestion RT-03. | [probe](RECIPE-TARGETED-2026-10-12-guard-probe-Output.json), [bounded probe](RECIPE-TARGETED-2026-10-12-guard-probe-bounded-Output.json), [probe source](RECIPE-TARGETED-2026-10-12-guard-probe.mjs), oven run [01](RECIPE-TARGETED-2026-10-12-oven-seven-steps-run01-Output.txt) (total-time provenance test passes) |
| FT-QA-2026-099 (KB drift, continuation of 095) | As FT-095 plus new behaviour | **Verified closed.** KB 07-ai-features line 178 and 06-ai-integrations line 69 describe: up to two directed corrections (3 import calls, no extra usage), refs-only repair then `422`/no usage, "never drops or rewrites", total-time guard rules incl. "1 Std. 30 Min.", 30 s per call + `maxRetries: 1` + no correction after 45 s, `maxCharacters` budget 25 % below proportional fit. Matches code (openai.ts lines 630-690, 571). Usage booked once after validation (ai.ts line 567). | KB lines cited, `backend/src/lib/openai.ts` |
| FT-QA-2026-100 (import call timeout/retry) | `IMPORT_CALL_TIMEOUT_MS`, `maxRetries`, deadline, eval timeout | **Verified closed.** openai.ts lines 630-666: 30 s per call, `maxRetries: 1`, 45 s `IMPORT_CORRECTION_DEADLINE_MS` checked before starting another correction. Worst case therefore about 45 s + one more attempt of up to 2 x 30 s (SDK retry) - bounded, below the platform HTTP limit. The Import eval `it.each` timeout is 100 s (eval.test.ts line 270); assertions are unchanged in meaning (diff: the old `tracedOrders == sourceOrders` full-coverage assertion was replaced by uniqueness + strictly ascending + known-source checks, which is exactly the approved v21 rule "full coverage not required"; a timeout only bounds duration). **Gate not weakened.** | `backend/src/lib/openai.ts`, eval test diff |
| FT-QA-2026-101 (oven cheese weakened, Suggestion) | Same evidence as 094 | **Not closed by QA; status stays with the owner decision ("Awaiting decision").** The automatic evidence supports resolution (0/8 weakened wording), but this is a wording judgment. | oven series |

Test-diff review (`git diff` of `ai.test.ts`, `recipeAnalyze.eval.test.ts`, `recipeAnalyze.eval.fixtures.ts` against HEAD, only removed lines checked): `ai.test.ts` removed the old test "rejects export steps that do not trace every source step" and its 422/trace assertions - superseded by the approved v21 rule (selective trace allowed, 'accepts a selective export without requiring every source step' added) and by the new 422 tests (merged numbered steps, 3 provider calls, no usage). Eval test removed `expect(tracedOrders).toEqual(sourceOrders)` for the same reason and raised `TESTED_PROMPT_VERSION` v11 to the current versions. Fixtures removed only comments/description wording. No test was deleted without a replacement of equal or higher strictness.

## Criteria matrix

Plan: approved v21 (`docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md`, AC-1..AC-10) and US-10 AC-15/16. Results are derived from the recorded Step 2/3 evidence and the earlier [re-verification report](QA_Recipe_Sharing_Reverification_2026-10-11.md) matrix (unchanged requirements).

| AC | Result | Evidence |
|---|---|---|
| AC-1 small Preparation provider contract; Import one full analysis | PASS, with deviation: Import is v17 and may re-send the same analysis for up to two directed corrections (max. 3 provider calls, usage once after validation); KB states this | Step 3 FT-099/100; tsc/vitest in Step 2; dough series 2 logical calls |
| AC-2 complete saved ID-free context, free grouping, original order | PASS | Backend suite 1670/1670; full runs 8/8 (rice, oven, pasta, dough handler tests); order is sorted server-side by first reference |
| AC-3 shared limits (1..5 steps, 90 chars, teaser) and renderer | PASS | shared 450/450, mobile 640/640, backend template tests in the suite; dough final lengths [60,28,54,30] |
| AC-4 reference validation unchanged; Import trace rule | PASS | Step 3 FT-097: `redistributeExportReferences` moves references only, other violations -> HTTP 422; Preparation validator unchanged |
| AC-5 saved eight-step rice fixture, independent handler/SDK eval | PASS | rice fixtures inside full runs 8/8 (not run in isolation in this round) |
| AC-6 oven/pasta fixtures technical gates; no invented values; oven human review separate | PASS (technical); oven content = MANUAL VALIDATION REQUIRED | oven 8/8, 8/8 "streuen", total-time provenance passes; Step 3 FT-094/098 |
| AC-7 auth/ETag, 429/502/422, schemas, parameters, usage after success, no writes, call budget | PASS | Step 3 FT-097/100: quota before provider, `trackUsage` once after validation, usage 0 on 422, 30 s timeout + `maxRetries: 1` + 45 s correction deadline |
| AC-8 regressions, unit suite, typecheck, build:verify | PASS | tsc 0; vitest 69 files / 1670 passed; build:verify 0; encoding 0; shared 450; mobile 640 |
| AC-9 Preparation/Recipe/overall live gates; no retry-until-green | PASS WITH ISSUES | all series green except `side-dish-and-serving-actions` 7/8 (provider variance, RT-01); series not extended or replaced; Daily/Weekly overall gate OUT OF SCOPE by user decision, not claimed |
| AC-10 documentation | PASS | Step 3 FT-095/099: current contract states v17/v12, optional `If-Match`, compatibility-only `sourceEtag`, new behaviour; remaining old versions only in dated history sections |
| US-10 AC-15 condensation to at most five export steps | PASS | rice 8, oven 7, pasta 7, dough 4 source steps; 1..5 export steps in all series |
| US-10 AC-16 order, actions, ingredients, temperature, time kept | PASS for automated checks; oven wording MANUAL VALIDATION REQUIRED | retained times/temperatures must occur in the source (assertions + `inventedExportTemperatures`); RT-01 shows one minor source-fidelity loss in a source step, not in the export |

## Findings

No Blocking finding. Registered for the central register by the Orchestrator as FT-QA-2026-102..106 (RT-01..RT-05).

```text
Finding key: RT-01
Plan reference: v21 plan AC-9; US-10 AC-16
Criticality: Non-blocking
Owner: Backend
Description: Import fixture side-dish-and-serving-actions failed in 1 of 8 isolated runs (run 08): source step 8 lost the words "als Beilage" ("serviere es mit den Kartoffeln und den Bohnen" instead of "... Kartoffeln als Beilage und den Bohnen"). Export steps, ingredients and cooking actions were intact. The same fixture passed 8/8 in the previous round and inside all 8 full runs of this round.
Evidence: RECIPE-TARGETED-2026-10-12-import-side-dish-and-serving-actions-run08-Output.txt; summary JSON; Step 2 diagnosis above (provider variance, rubric correct).
Reproduction: cd backend; node scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts -t "side-dish-and-serving-actions" (non-deterministic, about 1 in 16 observed).
Proposed fix: Optional prompt/validation tightening for source-step fidelity; otherwise accept as residual provider variance.
```

```text
Finding key: RT-02
Criticality: Suggestion
Owner: Backend
Affected AC: AC-4
Description: `exportSuggestion.steps[].sourceStepOrders` (also after the refs-only repair) stays in the HTTP JSON of `recipe-analyze`. Absent from shared and mobile types (grep), so not part of any typed client contract, but present on the wire.
Evidence: functions/ai.ts line ~604 passes `exportSuggestion` through; grep of mobile/src and shared finds no `sourceStepOrders`.
Proposed fix: Strip server-side anchors before responding, or document them as ignorable wire fields.
```

```text
Finding key: RT-03
Criticality: Suggestion
Owner: Backend
Affected AC: AC-2/AC-6
Description: recipeTotalTimeGuard has two false positives that keep an unsupported total ("insgesamt dreimal ... 40 Minuten" keeps 40; "Gesamtmenge ... 30 Min." keeps 30) and quadratic digit-run matching (20 000 digits = 3.2 s; bounded worst case 50 steps x 2000 digits = 822 ms). The guard only nulls and never invents a value.
Evidence: RECIPE-TARGETED-2026-10-12-guard-probe-Output.json, -guard-probe-bounded-Output.json.
Proposed fix: Anchor the explicit-total pattern more tightly; bound digit runs.
```

```text
Finding key: RT-04
Criticality: Suggestion
Owner: Backend
Affected AC: AC-10
Description: The text-only shortening prompt changed (maxCharacters, drop rules) while the Preparation prompt version label stayed v12, so version-based provenance cannot distinguish the old and new shortening prompt.
Evidence: lib/prompts/recipeAnalyze.ts line 12; version guard tests pin v12; live evidence was gathered against the hashed current candidate.
Proposed fix: Version the shortening prompt or bump the Preparation version at the next prompt change.
```

```text
Finding key: RT-05
Criticality: Suggestion
Owner: Backend
Affected AC: AC-4
Description: Like the references, `ingredientKeys` of the import export suggestion remain in the `recipe-analyze` response (analysis-local keys used by the new-recipe flow); this is the documented contract but should be kept in mind for any future wire clean-up.
Evidence: functions/ai.ts line ~604; KB tech/04-shared-library.md describes `RecipeExportSuggestion` with `includedIngredientKeys`.
Proposed fix: None required; document only.
```

## Manual validation and unverified items (not findings)

| Item | Status |
|---|---|
| Oven export culinary correctness (doneness clause FT-086, cheese wording FT-094/101) | MANUAL VALIDATION REQUIRED |
| On-device share flow with a real recipe, PNG visual check | MANUAL VALIDATION REQUIRED |
| Cosmos contract tests | UNVERIFIED (not run; no persistence code changed) |
| Frequency of the refs-only repair in the Import eval | UNVERIFIED (the eval logs neither attempt counts nor repair events) |
| Overall Daily/Weekly insight eval gate | OUT OF SCOPE by user decision; not claimed |
| Statistical stability beyond the executed finite samples at temperature 0.2 | UNVERIFIED by nature; no guarantee claimed |

## Verdict

**Verdict: PASS WITH ISSUES**

Basis: all offline gates green (tsc 0; backend 1670/1670; shared 450/450; mobile 640/640; build:verify and encoding 0); live series (a) 8/8, (b) 10/10 with 2 logical calls, (c) 8/8, (d) 10/10, (e) 7/8 with one diagnosed provider-variance failure that was not replaced or diluted. FT-QA-2026-094, 095, 096, 097, 098, 099 and 100 are verified closed by the evidence in Step 3 (094 with manual wording validation outstanding). No Blocking finding. Under the pre-specified bar a clean PASS was not reached (series e); the user decided on 2026-10-12 to close the round as PASS WITH ISSUES, accepting the single side-dish source-wording variance (RT-01) and the Suggestions RT-02..RT-05. This verdict is a release-readiness statement for the recipe-sharing feature under that decision; it is not a guarantee against future model variance, and the manual items above remain open.

