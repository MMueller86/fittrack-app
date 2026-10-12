# QA Report: Current Recipe Preparation Stability, 2026-10-10

- Format: `fittrack-qa-v1`
- Plan reference: [approved v21 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md), interpreted under current saved contracts and the user's bounded stability-only research authorization
- Verdict: `FAIL`

## Result

The newest saved source really executed. Rice is NOT consistently successful under the observed conditions: **4/5** prespecified isolated handler trials pass, Recipe R rice passes, Overall G rice fails: **5/7 comparable current rice handler samples pass**. Two samples exhaust three real SDK calls and return HTTP422 with FIRST references `1,3,4,6,5`. Later success does not replace either failure. This finite experiment is not a statistical reliability estimate or universal guarantee.

Current versions: Preparation **v12**, Import **v16**, Daily **v17**, Daily assembly **v2**. Candidate SHA-256: `01cd0cd18d4f5a3e443dafd9deb5ff7915dd97f1ab5ddc8387907a710f16acd3`. This is **the same hash** as the earlier CURRENT-RECIPE-SHARING candidate, not an archived v11 candidate. All548 candidate files and1221 preexisting repository files remain unchanged before/after every gate and reconciliation. No candidate mutation or configuration change was detected.

Full R is18/20, exit1; its rice passes. Full G is45/48, exit1; its rice fails. Daily18/18, Scale3/3, Weekly4/4 and Weekly diagnostic3/3 pass in G. Other current failures are separately described below. No feature acceptance, deployment approval or historical blanket closure follows.

## Scope

Authorized: saved-source/runner investigation, focused offline checks, five isolated rice live trials, one full Recipe live gate and one full Overall live gate; new QA reports/evidence/helpers only. Counts and order were fixed in [baseline](RECIPE-STABILITY-2026-10-10-baseline.json) before the first live call. Actual fixture is `synthetic-saved-eight-steps-rice-serving`, not Import's different chicken/potatoes/beans fixture.

Not authorized or performed: implementation/test/eval/config/KB/plan/story/register changes, delegation, deployment, prompt/validator repairs, third implementation, repeat-until-green, extra live gates, private/Alpha replay, device testing. Existing user/other changes were preserved. Prior full offline-suite results are historical context, not newly rerun certification. Current accepted share-editor/optional-ETag behavior is retained; old mandatory-ETag/editor-placement rules are not reintroduced.

Applicable inputs: global/QA instructions, Azure OpenAI feature skill and QA checklist, KB architecture/backend/shared/testing/AI/recipes/API contracts, [US-10](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md), and [previous current report](QA_Current_Recipe_Sharing_2026-10-10.md). v21's stale version literals describe history and are not instructions to revert v12.

## Evidence

- [baseline](RECIPE-STABILITY-2026-10-10-baseline.json): hashes, resolved prompt strings, versions, provider/settings fingerprints, previous-hash comparison, fixed experiment.
- [verified reconciliation](RECIPE-STABILITY-2026-10-10-reconcile-verified.json): authoritative no-call comparison of all captured requests, complete saved sources, initial/full/text attempts and raw final texts, source/core matrices, current final validation diagnostics, probes and assertion markers.
- [trial1](RECIPE-STABILITY-2026-10-10-trial1.json), [trial2](RECIPE-STABILITY-2026-10-10-trial2.json), [trial3](RECIPE-STABILITY-2026-10-10-trial3.json), [trial4](RECIPE-STABILITY-2026-10-10-trial4.json), [trial5](RECIPE-STABILITY-2026-10-10-trial5.json): immutable native execution records, per-call raw SDK requests/responses and outputs, UTC, counts, output/reporter hashes and stable-source checks.
- [R](RECIPE-STABILITY-2026-10-10-R.json) and [G](RECIPE-STABILITY-2026-10-10-G.json): same evidence for full gates; full co-located `-Output.txt` and `-Report.json` paths/hashes are in each record.
- [QA experiment helper](RECIPE-STABILITY-2026-10-10-verification.mjs), [no-call reconciliation helper](RECIPE-STABILITY-2026-10-10-reconcile.mjs). Neither changes an existing test or product file.

## Latest-Code Proof

The official [runner](../../../backend/scripts/run-eval.mjs) loads required settings without printing them, preserves explicit process environment and launches repository-local Vitest in `backend` with `vitest.eval.config.mts`. `npm run test:eval --workspace=backend` resolves to this same wrapper. The experiment used the wrapper directly for all seven live gates, with exact argv/cwd recorded.

The [eval config](../../../backend/vitest.eval.config.mts) includes `src/**/*.eval.test.ts`, excludes `dist`, aliases Shared to its TypeScript source, and uses sequential single-fork execution. The [Recipe eval](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts) directly imports `../openai`, `../../functions/recipes`, `../recipeAnalyzeValidation`, the current prompt module and the real renderer. Failure stacks resolve to those current source files. Backend package `main` pointing at compiled Functions output is not the eval entry point. A separate new Node/Vitest process is spawned for each trial; there is no cross-trial loaded-module singleton reuse. R/G additionally execute other tests before/around rice, but the actual rice initial payload/configuration is identical.

Saved handler -> `prepareValidatedRecipeExport` -> `prepareRecipeExport` -> real `Completions.prototype.create` -> current saved validator/real production-font probe. SDK and generator spies call through; the rice initial result is NOT mocked. Only quota/storage are mocked and auth/repository use the existing safe test setup; Cosmos is disabled. Forced dough is explicitly different: its initial draft is synthetic, its two corrections are real SDK calls.

Every captured Preparation SDK request was checked against actual resolved current strings, not version labels alone:

| Prompt | Current resolved SHA-256 |
|---|---|
| Initial | `a44a5f46bf18a89bc66d67487f58d5ff23cec13db224fd0247f6422eb771223c` |
| Full draft | `4c285f3125e641b9f498204edf0f7850c666259ba2d541340cf3dc6e801f57c2` |
| Text only | `218133320e5fb1a739b3ab76c79c29637b066a09992f465a7dacf3e350a41b6f` |
| Import, resolved source | `ef251ca7bfb822da8162349f547c008aa6ed4ea30f374d4c442474fdc127f405` |

Actual saved-handler requests exercised initial, full-draft and text-only routes and matched exact strings/hashes. Model `gpt-4o-mini`, API setting `2024-08-01-preview`, temperature0.2, max_tokens2048; Preparation request options maxRetries0, positive timeout<=20000ms, AbortSignal present, strict closed schemas, finish_reason `stop`. Immutable original context and exact correction payloads/merged target strings were verified. The aggregate loop remains75000ms/three logical calls. No extra retry loop was added. SDK retries0 applies to Preparation; Import's separate caller does not pass this per-request override, so no zero-retry claim is made for every other domain.

All seven rice initial system/user messages and response schemas have equal hashes, and saved source/context are deep-equal. Earlier CURRENT F/R/G rice initial prompts/context also match today's. Source path, settings and different source payload therefore do not explain the observed rice success/failure differences. Same request does not imply same AI response; temperature0.2 is not determinism. No claim is made about hidden provider internals or model snapshot changes, which this instrumentation cannot establish.

## Why A Green Suite Can Differ

The provided terminal context includes `npm exec --workspace backend -- vitest run --reporter=dot --silent` with exit0. The current default [unit config](../../../backend/vitest.config.mts) explicitly excludes all `*.eval.test.ts` and mocks external services. That command does not exercise this live rice case. Whether it is exactly the green command the user meant is not established; no terminal-history capability was available here to recover the disputed command. No guessed command is attributed to the user.

A green actual live gate is also compatible with this evidence: the prior same-hash full G passed48/48, prior F failed rice, and today's five identical-input isolated runs include both success and failure. The current R rice pass versus G rice failure further demonstrates why a single green live sample cannot certify consistent behavior. The focused filter executes only the saved-rice handler; R/G also include direct metadata provenance and Import, explaining additional unrelated failures.

## Acceptance Criteria

Results apply only to this stability investigation. The complete supplied v21 criteria are mapped once below; adjacent full-feature gates not rerun are explicitly excluded, not silently accepted.

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS saved Preparation routing; PARTIAL Import | Current source and exact SDK prompt/schema checks; Import source6 loss in R/G, RS-02 |
| AC-2 | PASS rice full original context; PARTIAL whole-feature semantics | Every initial rice payload deep-equal and ID-free, all eight source steps retained; no first-five filtering. General cooking quality is not runtime-certified |
| AC-3 | PASS observed rice limits/probes; remaining boundaries OUT OF SCOPE | All final rice outputs1..5/<=90 chars and real-font fit; Shared constants unchanged; no new full boundary/PNG/device suite certification |
| AC-4 | PASS protection/regressions; FAIL consistent successful output |262 current owning regressions pass; current validator rejects FIRST6 before5 in trial4/G; free non-adjacent groups remain allowed, no sorting/padding/source mutation |
| AC-5 | FAIL |4/5 focused rice success,5/7 total comparable handler success; two bounded422 failures, independent cooking-core assertions NOT_REACHED in them |
| AC-6 | PARTIAL automated; MANUAL VALIDATION REQUIRED oven | R/G saved oven and pasta technical gates pass; G separate direct oven provenance fails40-versus-null. Oven human content approval not performed |
| AC-7 | PASS observed protections; wider contracts OUT OF SCOPE | Real <=3-call loop, current SDK options, strict schemas, no writes/source changes, failure usage0/success1;262 owning regressions. No new full mobile/auth/concurrency certification |
| AC-8 | PARTIAL |262 focused current regressions and backend typecheck pass. R Import and dough fail; G provenance fails. Full offline suites/build intentionally not repeated; no implementation change required build output |
| AC-9 | FAIL current stability gates |Prespecified5 isolated rice runs then exactly one R and G; corrected list proves1/20/48 names; every intended name executed, no gate replacement. This experiment does not impersonate a full preparation-filter acceptance rerun |
| AC-10 | PARTIAL existing documentation conflict | Current runtime v12 versus current-contract KB v11/mandatory-ETag prose persists; source and applicable current contracts read, no KB changes or claimed alignment |
| US-10 AC-15 | PASS safe block; FAIL v21 required rice success consistency | Source8 condensed to5 or controlled422. Two failures block rather than accept invalid sixth steps; safety does not satisfy v21's required rice success |
| US-10 AC-16 | FAIL |Rice FIRST inversion safely blocked; separate Import omits finishing action/duration6min in R/G. No disputed literal oven-doneness wording used as a new blocker |

## Commands And Results

Canonical live commands from root:

`node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "recipePreparation: synthetic saved-source live evaluation.*synthetic-saved-eight-steps-rice-serv"`

`node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts`

`node backend/scripts/run-eval.mjs`

All add default/JSON reporters and unique workspace output paths. Official wrapper child cwd is `backend`; exact parent native executable/argv/cwd are recorded in each stage JSON. Each of the five focused runs executes exactly one handler;19 exclusions are intentional, not all-skipped acceptance. R/G have no skips.

| Check / command | Native exit | Result / durable evidence |
|---|---:|---|
| `node --check <new experiment helper>` initial, repair1, repair2 |1,1,0|QA-only bracket errors repaired before any provider call; no product/test change |
| `node <experiment helper> baseline` |0|548 candidate/1221 preserved files; fixed five+R+G experiment |
| backend Vitest owning validator/loop/SDK files, `--silent` |0|262/262; [focused](RECIPE-STABILITY-2026-10-10-focused.json) |
| backend `tsc --noEmit` |0|[typecheck](RECIPE-STABILITY-2026-10-10-typecheck.json) |
| Recipe/Daily version guards only, eval config |0|3 passed/35 intentionally excluded; [guards](RECIPE-STABILITY-2026-10-10-guards.json);0 provider calls |
| Configured `vitest list --disableConsoleIntercept --json` initial full-ID rice filter |0 runner /1 helper|0 selected; INVALID discovery, [listRice](RECIPE-STABILITY-2026-10-10-listRice.json);0 provider calls |
| Corrected unique rice-prefix list |0|Exactly1 saved-rice handler, [listRiceVerified](RECIPE-STABILITY-2026-10-10-listRiceVerified.json);0 provider calls |
| Configured full Recipe/Overall lists |0/0|20/48 selected, [listR](RECIPE-STABILITY-2026-10-10-listR.json), [listG](RECIPE-STABILITY-2026-10-10-listG.json);0 provider calls |
| Five official rice invocations |0,0,0,1,0|4 passed/1 failed executed tests; full immutable records linked above |
| Official R once |1|18 passed/2 failed/0 skipped, rice passes |
| Official G once |1|45 passed/3 failed/0 skipped, rice fails |
| Initial `node <reconciliation helper>` |0 native; INVALID independent validation|[first reconciliation](RECIPE-STABILITY-2026-10-10-reconcile.json) retained; old transpile target incorrectly skipped iterator-based validation, superseded ONLY for independent finalValidation fields |
| Corrected `node <reconciliation helper>` |0|ES2022 preserves iterators, asserts rice validator agreement; authoritative verified reconciliation linked above;0 new provider calls |
| Editor diagnostics, both new helpers |N/A|No diagnostics reported |
| `node <experiment helper> finish` |0 required completion check|Checks report contract, all12 unique matrix rows, finding fields/links, UTF-8, configured-secret absence and preservation; immutable finish record created only after this report |

Discovery correction: Vitest interpolates/truncates the rice ID to `synthetic-saved-eight-steps-rice-serv...` in the actual test name. Full-ID regex returned0; the uniquely matching truncated prefix plus handler-suite name was verified before trial1. Baseline's original full-ID filter remains preserved; actual corrected filter is in listRiceVerified and all trial argv. Five counts/order never changed. This was not an eval edit or an extra live run.

## Seven Live Samples

UTC timestamps below are2026-10-10. Every row has stable candidate and unchanged settings fingerprints.

| Stage | UTC interval | Overall passed/failed | Rice SDK/logical | Rice HTTP/usage | Rice FIRST | Cooking assertion |
|---|---|---|---|---|---|---|
|trial1|13:15:04.351..13:15:08.362|1/0|1/1|200/1|1,3,5,6,8|Completed |
|trial2|13:15:13.321..13:15:18.160|1/0|1/1|200/1|1,3,5,6,8|Completed |
|trial3|13:15:27.476..13:15:31.885|1/0|1/1|200/1|1,3,5,6,8|Completed |
|trial4|13:15:37.887..13:15:46.309|0/1|3/3|422/0|1,3,4,6,5|NOT_REACHED |
|trial5|13:15:51.548..13:15:56.728|1/0|1/1|200/1|1,3,5,6,8|Completed |
|R|13:16:06.471..13:17:35.185|18/2|1/1|200/1|1,3,5,6,8|Completed |
|G|13:17:44.018..13:19:57.290|45/3|3/3|422/0|1,3,4,6,5|NOT_REACHED |

Rice total:11 SDK/logical calls. All instrumented saved handlers:20 SDK/22 logical calls; the difference is two forced dough initial drafts, not hidden provider calls. This is NOT an all-domain provider-call total: direct provenance, Import, Daily/Weekly/Scale do not expose equivalent complete request counters in the existing eval. Their executed assertions are known, total SDK counts/raw direct responses remain UNVERIFIED.

## Source And Raw Failure Diagnosis

Full exact source and every final raw text, all three drafts/corrections, SDK raw strings and measurements are in verified reconciliation and original gate records. This synopsis transliterates German spelling for ASCII; the JSON evidence retains the actual unchanged strings.

Rice source orders:1 dice chicken;2 season;3 heat olive oil;4 fry4min per side;5 separately cook rice12min/drain;6 lower heat/finish chicken6min;7 rest chicken covered3min;8 serve with rice. No durations are totaled: all seven final raw rice totals are null.

Successful final groups are `[1,2],[3,4],[5],[6,7],[8]`. Separate rice cooking/draining and chicken finish/resting remain source-bound; independent cooking-core/metadata/protection assertions complete.

Both failures have the same final groups `[1,2],[3],[4],[6,7],[5]` and these actual final meanings: dice/season chicken; heat oil; fry chicken4min per side; cook chicken at low heat another6min and rest3min; cook rice12min in salted water and drain. Essential actions are present, but rice group5 follows group6/7. Do not characterize this as accepted rice-action omission. Initial FIRST is `1,3,6,5,8`; both full-draft corrections leave final FIRST `1,3,4,6,5`. All three drafts fit real production-font geometry. Final diagnostics are `semantic:export_source_trace_not_ascending@steps[3].sourceStepOrders` (offending6) and the same code at `steps[4].sourceStepOrders` (offending5). The test fails its `validateRecipeExportPreparationOutput(...): { ok:true }` assertion at current eval source508. Handler exhaustion is `CORRECTIONS_EXHAUSTED`, three calls/422/usage0/no writes, source/ETag unchanged. Independent semantic and successful-response/metadata markers are NOT_REACHED; raw null/fit must not be relabeled as passed assertions.

R Import's DIFFERENT eight-step chicken/potatoes/beans source retains source6: reduce heat and finish chicken another6min. R/G five export groups reference only1,2,3,5,8, containing potatoes18min, beans8min, seasoning, frying4min per side and slicing/serving. No export text retains finishing6min. Both fail `Missing export reference 6: finish cooking chicken after frying`. This is real source-backed action/duration loss, not merely an ID mismatch.

R forced dough has one synthetic initial draft and two real text-only corrections; both return the same mixing sentence: `Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig vermischen.` Final production Inter22/lineHeight1.25 measures300x112px against302x105px (0.5px tolerance). All ingredients remain, but template overflow remains; full structural validation succeeds while probe fails. Handler422/usage0/no writes; cooking assertions NOT_REACHED. G's dough correction succeeds separately and does not replace R.

G's separate DIRECT oven provenance test returns totalTimeMinutes40 instead of expected null (`expected 40 to be null`). Untimed preparation plus40min baking is not a supported total. Its raw direct SDK response is not instrumented; only the actual failed value/assertion is established, and no response text/call count is invented. Saved oven handler outputs in both R/G independently have null and retain180C/40min with fit/200/usage1. These are different calls/tests, not contradictory bookkeeping.

Current R/G saved oven texts correctly retain pouring cream and sprinkling cheese. The prior action-substitution finding was not reproduced in these two outputs, but is not blanket closed. The disputed literal oven-doneness wording is not a new automated blocker or waived criterion. Human content review remains separate.

## Findings

Finding key: RS-01-current-rice-first-exhaustion
Plan reference: approved v21 plan linked above
Acceptance criterion: AC-4/5/9; US-10 AC-15/16
Description: Latest unchanged v12 rice handler fails trial4 and G despite identical initial prompts/source/schema to successful samples; both exhaust3 calls with FIRST1,3,4,6,5 and return422. Observed success is4/5 focused,5/7 comparable total, not consistent success.
Criticality: Blocking
Owner: Backend
Evidence: trial4/G immutable records and verified reconciliation; exact source/groups/raw drafts/diagnostics above; usage0/no writes/fit true.
Recommendation: Retain validation/budget/usage protection; return source-order-preserving bounded success to the owner under separately authorized implementation. Do not erase these failures or rerun until green. FT-QA-2026-090 remains reproducible and should not be closed by this experiment.

Finding key: RS-02-current-import-finish-cooking-loss
Plan reference: approved v21 plan linked above and current US-10 interpretation
Acceptance criterion: AC-1/8/9; US-10 AC-16
Description: Both R/G Import export summaries omit source6 finishing action and its6min while original source extraction retains it. This is independent of saved rice.
Criticality: Blocking
Owner: Backend
Evidence: R/G `side-dish-and-serving-actions`, exact source/export evidence and failing missing-reference6 assertion.
Recommendation: Preserve the cooking-core expectation and return Import source-backed finishing preservation to its owner; recommend retaining the corresponding FT-QA-2026-093 observation, not blanket closure.

Finding key: RS-03-current-dough-text-correction-exhaustion
Plan reference: approved v21 plan linked above
Acceptance criterion: AC-7/8/9
Description: R's two real corrections of forced dough repeat the same112px-high mixing text against105px, exhausting budget and yielding422. G's later success is a separate sample.
Criticality: Blocking
Owner: Backend
Evidence: R forced-dough attempts, actual texts/Inter22 measurements, final probe failure;3 logical/2 SDK, usage0/no writes.
Recommendation: Owner should investigate bounded meaning-preserving shortening under existing production bounds. Do not relax geometry or ingredient rubric in QA.

Finding key: RS-04-current-direct-oven-total-provenance
Plan reference: approved v21 plan linked above
Acceptance criterion: AC-6/8/9; source-supported metadata
Description: G's direct saved-oven-context Preparation provenance sample returns40 as total despite untimed preparation; expected null assertion fails. Separate successful handler null samples do not remove this failure.
Criticality: Blocking
Owner: Backend
Evidence: G failure `recipePreparation: total-time provenance regression ['synthetic-saved-oven-seven-steps']`, expected40/null; current v12 guard passed and candidate unchanged.
Recommendation: Retain source-supported-time assertion; owner should investigate provenance consistency under separately authorized implementation. Earlier green provenance evidence is finite history, not a current universal closure basis.

## Existing Findings And Limits

FT-QA-2026-090 is reproduced as required successful rice/FIRST-order failure; recommendation is no closure. FT-QA-2026-093 Import finishing loss is reproduced in R and G. Prior FT-QA-2026-094 oven cheese-action substitution is not seen in these two final texts; two successes do not certify closure. FT-QA-2026-095 KB drift remains visible: current-contract v11 prose in backend/API/AI-feature/testing sections and Shared mandatory-ETag/sourceEtag prose conflicts with saved v12/optional-ETag contract. No documentation change was authorized; suggest owner alignment separately, preserving history. No central register was written.

UNVERIFIED / MANUAL VALIDATION REQUIRED, outside findings: human oven cooking-content review, device/gallery/two-image sharing, real Cosmos contracts, private original rice/Alpha replay, provider-internal snapshot behavior, complete all-domain raw SDK counts/responses. Prerequisites are separately authorized human/device/local-emulator/private-revision access; compare actual source/output and verify current contracts on the target environment. None was performed or certified by this stability experiment. The remaining sharing feature and full-plan acceptance are out of scope, not implicitly passed.

## Preservation And Completion

Only new QA artifacts were created. Original discovery, every red/green live sample and initial invalid offline reconciliation are retained, never overwritten. Authoritative independent-validation evidence is `reconcile-verified`; invalid first reconciliation's validator fields must not be used. Helper repairs made0 new provider calls. There were exactly seven live gates and0 replacements. Candidate/test/eval/config/KB/plan/story/register hashes are unchanged; no deployment/build/delegation occurred.

Completion runs `node docs/qa/reports/RECIPE-STABILITY-2026-10-10-verification.mjs finish` after report creation and stores `RECIPE-STABILITY-2026-10-10-finish.json` with actual native exit0, single-verdict/12-row/finding/link validation, fatal UTF-8 validation, configured endpoint/key absence in new artifacts, report hash and final1221-file preservation/new-foreign-file checks. Any failed completion check would invalidate this completion claim and must be repaired as a QA artifact issue, not hidden or replaced by live reruns.