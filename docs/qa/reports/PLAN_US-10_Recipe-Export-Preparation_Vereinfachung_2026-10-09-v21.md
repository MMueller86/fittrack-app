# QA Report: Q-21 FINAL2 Abschluss-QA

- Format: `fittrack-qa-v1`
- Plan reference: [Approved v21 plan](../../User%20Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md)
- Verdict: `FAIL`
- Review date: 2026-10-10; all execution intervals are UTC.
- Candidate: Preparation v11, Import v16, Daily v17 / assembly v2.
- `retry_counts`: Preparation=2, Daily=2. STOP: no third automatic candidate, no further live attempt, NO DEPLOY.

## Scope

Independent final QA after the second and LAST automatic correction. All AC1..10 and [US-10](../../User%20Stories/Reciepe/US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md) AC15/16 reviewed under selective cooking-summary interpretation: optional details may be omitted; no exact-five, adjacent-only, fixed wording or universal semantic-runtime requirement. Latest NO DEPLOY supersedes the plan's older conditional Alpha authorization, even after acceptance. Stale v9 plan literals are baseline descriptions, not directions to roll back v11/v17.

Read complete plan/story, [Round2 handoff](../../User%20Stories/Reciepe/HANDOFF_Q21_Corrections_Round2_2026-10-10.md), [candidate](../../User%20Stories/Reciepe/Q21-CORR2-2026-10-10-candidate.json), [evidence index](../../User%20Stories/Reciepe/Q21-CORR2-2026-10-10-evidence.json), CORR1 handoff/manifest/FAIL/reconciliation, historical Q19/v18 follow-up, required KB/context, read-only register FT086..091, QA instructions/report README and Azure OpenAI skill/checklist. Upstream offline results are not substituted for independent executions.

Only this report and new `Q21-FINAL2-2026-10-10-*` QA helper/evidence are manually written. No production, test/eval, KB, plan, story, register, dependency, configuration, Mobile or infrastructure edit, subdelegation, branch, commit or deploy. Existing dirty worktree preserved; ignored builds/caches are normal gate artifacts. Real provider calls use official runner; fixtures use test JWTs, in-memory recipes and mocked quota/storage, not production Cosmos or real-account usage booking.

FULL prior CORR1 report preserved verbatim as `priorReport.text` in [new baseline](Q21-FINAL2-2026-10-10-baseline.json), SHA-256 `97a49c93c4cc584a9903c211a88c4ea0c38ca88ff39aff608cf49d7c44dc4423`. All old Q21/CORR1 baselines/F/R/G/failure records and [Q19](PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) unchanged. Replacement follows [report contract](README.md), not historical closure.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [Provider](../../../backend/src/lib/openai.ts#L522)/[prompts](../../../backend/src/lib/prompts/recipeAnalyze.ts): closed required small Preparation schema; initial/full-draft/text-only selection verified offline/live. Import v16 full analysis/export one call; R/G Import8/8 plus guards pass. |
| AC-2 | FAIL | Entire saved ID-free context/all ingredients/steps, Shared bounds and untrusted-data boundary verified. F accepts rice without source5 cooking; oven40/pasta25 unsupported despite source-first v11 guidance. FINAL2-CORE/METADATA. |
| AC-3 | PASS | Fresh focus788/units1639: 1/5 steps,90/96 chars,positive bounded time/null positives;0/6,91/97,blank/bad metadata/extras negatives. Production-font overflow/1..5/1080x1350 PNG checks. Renderer44 files unchanged. |
| AC-4 | PASS for validator contract | [Validator](../../../backend/src/lib/recipeAnalyzeValidation.ts#L165): `[1,4,6],[5]`/gaps accepted; empty/unknown/duplicate/local reversal/reversed starts rejected. Import flattened policy unchanged. No mutation/padding. R/G rice correctly rejected, not successful fixture proof. |
| AC-5 | FAIL | F rice200/usage1 still omits separate rice cooking; null metadata passes and cooking assertion reaches missing-ref failure. R/G exhaust3 calls with FIRST inversion,422/usage0. No mandatory complete successful rice result. |
| AC-6 | FAIL | All final oven outputs fit/200 but omit source6 doneness; oven40/pasta25 provenance fails. Pasta core/source-backed15/10 visible, but final cooking assertion stops at metadata. Human oven approval separately NOT PERFORMED. |
| AC-7 | PASS for executable technical contracts | Auth/owner/optional ETag before quota,429/502/422,Strict schema,0.2/2048/maxRetries0,initial+2 ceiling,20s request/75s deadline,empty source before provider/usage,V2 stripped refs,validated-fit usage/no writes. R/G rice422/usage0;all12 source/ETag unchanged;text-only metadata/refs/other text preserved. Save/Share/fingerprint regressions pass,not device certification. |
| AC-8 | PASS for required offline verification | Focus788/788,units1639/1639,typecheck/build/release/encoding exit0. Core/contradiction/provenance/Import/text-only/Daily/cache/manifest regressions pass. Weekly evidence helper stays eval-only with changed-number rejection;production Weekly16 files unchanged. No historical closure. |
| AC-9 | FAIL | Exact selections5/14/42; once each F5executed:2pass/3fail/9 intentional exclusions;R14:11pass/3fail/0skip;G42:38pass/4fail/0skip. Stable hashes,real calls; Daily phase-progress-open-day additionally fails G. No retry/historical/guard-only substitution. |
| AC-10 | PASS for current-contract alignment | Six current KB sections align Preparationv11/Importv16/Dailyv17,small schema/API/reference/semantic boundaries and partial status. Four selected historical heading blocks exact against Round2 snapshots. FT089 remains narrow current-contract alignment;no QA KB/register edit or retrospective acceptance. |
| US-10 AC-15 | FAIL | <=5/overflow/blocking technically verified, but F accepted rice loses essential separate cooking; all oven finals lose source doneness. No exact-five/first-five/adjacent-only obligation. |
| US-10 AC-16 | FAIL | Lost essential rice action/oven endpoint and unsupported totals remain. Retained component times/valid IDs do not establish source fidelity. Optional oil/rest/serve omissions allowed. |

## Tests

Commands are workspace-root equivalents. [New helper](Q21-FINAL2-2026-10-10-verification.mjs) records exact executable/native argv/cwd/UTC/native child exit/counts/transcript and JSON hashes; repeated stages refused. Reporting flags only capture evidence; official runner/config/settings unchanged. F/R/G are distinct requested gates,not retries/replacements; failures remain immutable.

| Command / check | Exit code | Result |
|---|---:|---|
| `node --check docs/qa/reports/Q21-FINAL2-2026-10-10-verification.mjs` | 0 | Syntax checked immediately after helper edits; editor diagnostics clean. Initial syntax call returned only Ctrl+C,inconclusive; completed syntax check obtained,not a live retry. |
| Helper `baseline` | 0 | [Baseline](Q21-FINAL2-2026-10-10-baseline.json):1125 prior files,20 candidate hashes,full CORR1 report. |
| Backend `vitest run` on14 focused files, `--silent` | 0 | [Focus](Q21-FINAL2-2026-10-10-focused.json):788passed/0failed/0skipped;actual SDK files,validators,loop,handlers,renderer,Weekly helper,Daily composition/manifest/cache. |
| `npm run test --workspace=backend -- --silent` | 0 | [Units](Q21-FINAL2-2026-10-10-units.json):1639passed/0failed/0skipped,67 files. |
| `npm run typecheck --workspace=backend` | 0 | [Typecheck](Q21-FINAL2-2026-10-10-typecheck.json):no errors. |
| `npm run build:verify --workspace=backend` | 0 | [Build](Q21-FINAL2-2026-10-10-build.json):compile/assets/module check,no publish. |
| `npm run verify:daily-insight-prompt --workspace=backend` | 0 | [Daily release](Q21-FINAL2-2026-10-10-dailyRelease.json):official fingerprint/append-only manifest check. |
| `node scripts/check-encoding.mjs` | 0 | [Encoding](Q21-FINAL2-2026-10-10-encoding.json):repository encoding check. |
| Eval config Recipe+Daily filter `prompt version matches fixture expectations` | 0 | [Versions](Q21-FINAL2-2026-10-10-versionGuards.json):3passed/0failed/29skipped;only guards,NO live PASS. |
| `vitest list --disableConsoleIntercept --json --config vitest.eval.config.mts`, F filter / Recipe file / all | 0 each | [F selection](Q21-FINAL2-2026-10-10-listPreparation.json):5;[R selection](Q21-FINAL2-2026-10-10-listRecipe.json):14;[G selection](Q21-FINAL2-2026-10-10-listOverall.json):42;asserted names/counts,no calls. |
| F: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` | 1 | [F](Q21-FINAL2-2026-10-10-F.json):5executed/2passed/3failed;9 intentional Import exclusions. UTC00:24:43.465..00:25:00.551. |
| R: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts` | 1 | [R](Q21-FINAL2-2026-10-10-R.json):14executed/11passed/3failed/0skipped. UTC00:25:12.075..00:26:34.354. Import8/8,Preparation1/4,guards2/2. |
| G: `npm run test:eval --workspace=backend --` | 1 | [G](Q21-FINAL2-2026-10-10-G.json):42executed/38passed/4failed/0skipped. UTC00:26:43.028..00:28:45.146. Recipe11/14,Daily17/18,Scale3/3,Weekly4/4,diagnostic3/3. |
| Helper `reconcile` / `docsHistory` | 0 each | [Reconciliation](Q21-FINAL2-2026-10-10-reconcile.json):selection/capture/hash reconciliation,12 complete source/final/all-attempt matrices,68 relevant executed regression assertions. [Document history](Q21-FINAL2-2026-10-10-docsHistory.json):4 selected historical blocks exact;no calls. |
| Helper `validateReport` / `finish` | 0 each | Report format/12 criteria/structured fields/links/UTF-8/scoped configured-value scan;1124 prior non-report files and20candidate hashes stable,prior report hash verified. Durable post-report records use the same FINAL2 prefix. |

Each stage transcript/JSON report is co-located as `Q21-FINAL2-2026-10-10-<stage>-Output.txt` / `-Report.json`; records contain exact commands/hashes. No stopped/all-skipped/credential-missing live run occurred. Read-only Node summary initially failed PowerShell quoting; corrected reads used existing records only. Delete/Add report replacement was ineffective in editor-backed file; direct update used. No gate rerun or historical data alteration.

## Independent Live And Content Review

All four Preparation fixtures execute in each gate. Model `gpt-4o-mini`,configured API `2024-08-01-preview`;temperature0.2/max_tokens2048/maxRetries0,signal/bounded timeout,finish reasons `stop`. Preparation only: F9SDK/10logical,R8/9,G8/9,total25SDK/28logical. Difference:three forced synthetic initial dough drafts without SDK. All-domain SDK/HTTP call totals UNVERIFIED,not instrumented;counts exclude Import/Daily/Weekly/scale. No timeout/abort observed.

[Reconciliation](Q21-FINAL2-2026-10-10-reconcile.json) retains complete contexts/source/final/all attempts/SDK requests-responses/probes/core-contradiction matrices and reached assertions. All12 recipes/ingredients/steps/ETags unchanged,writes update/replace/create0/0/0;fixture setup precedes spies. Ten reach complete V2/quota/usage/no-write/schema/fit protection markers. R/G rice stop at structural assertion before success-body/metadata/cooking markers;their422/usage0 are protective rejection,not successful fixture proof.

| Gate / fixture | Source/export | SDK/logical calls | HTTP/usage | Writes update/replace/create; unchanged | Semantics |
|---|---|---|---|---|---|
| F rice | 8/5 | 3/3 | 200/1 | 0/0/0; true | Null metadata PASS; cooking reached, FAIL missingref5 |
| F oven | 7/4 | 3/3 | 200/1 | 0/0/0; true | Metadata40 FAIL;endpoint absent;manual branch NOT_REACHED |
| F pasta | 7/4 | 1/1 | 200/1 | 0/0/0; true | Metadata25 FAIL;final cooking NOT_REACHED |
| F forced dough | 4/4 | 2/3 | 200/1 | 0/0/0; true | Executed metadata/core/contradiction PASS |
| R rice | 8/5 | 3/3 | 422/0 | 0/0/0; true | FIRST1,3,6,5,8 invalid;metadata/cooking NOT_REACHED |
| R oven | 7/4 | 2/2 | 200/1 | 0/0/0; true | Metadata40 FAIL;endpoint absent;manual branch NOT_REACHED |
| R pasta | 7/4 | 1/1 | 200/1 | 0/0/0; true | Metadata25 FAIL;final cooking NOT_REACHED |
| R forced dough | 4/4 | 2/3 | 200/1 | 0/0/0; true | Executed PASS |
| G rice | 8/5 | 3/3 | 422/0 | 0/0/0; true | References FAIL;metadata/core NOT_REACHED |
| G oven | 7/4 | 2/2 | 200/1 | 0/0/0; true | Metadata40 FAIL;endpoint absent;manual branch NOT_REACHED |
| G pasta | 7/4 | 1/1 | 200/1 | 0/0/0; true | Metadata25 FAIL;final cooking NOT_REACHED |
| G forced dough | 4/4 | 2/3 | 200/1 | 0/0/0; true | Executed PASS |

### Cooking-Core / Contradiction Matrix

Read-only AI-assisted source comparison below is not human sign-off or a claim that an unreached assertion executed. Complete contexts/texts are compared,not truncated excerpts. Fit alone is not cooking fidelity;all final drafts fit but R/G rice references fail. Their raw totalnull is not an executed metadata PASS. F rice reaches andfails independent cooking check after null metadata passes.

| Fixture | Required source core | Observed F/R/G text/references | Deviations / limits |
|---|---|---|---|
| Rice | Cut1;fry4 at4min/side;separately cook rice5 at12min;finish chicken6 another6min. Season/oil/medium heat/drain/rest/serve optional. | F `[1,2],[3],[4],[6],[7]`:cut/season,oil,fry,finish,rest;NO rice cooking anywhere. R `[1,2],[3,4],[6,7],[5],[8]`;G `[1,2],[3],[4,6],[7],[5]` retain rice but invert FIRST. | F source5 absent,not merely missing IDs;null metadata isolates loss. R/G rejected422. Retained4/6/12min source-backed,no observed component-time swap. No complete successful rice result. |
| Oven | Slice1;layer/cream3;bake6 at180C40min UNTIL potatoes cooked. Grease/preheat/rest/serve optional. | F `[1,2],[3],[4,5,6],[7]`;R `[1,2],[3,4],[5,6],[7]`;G `[1,2],[3],[4,5],[6,7]`. Slice/assembly/cheese/baking retained;all final endpoints absent. | F initial endpoint present but full-draft correction loses it;shortening does not restore. R/G missing initially. Numeric values source-backed;total40 not aggregate. Human review outstanding,not fidelity PASS. |
| Pasta | Cut1;fry3;sauce4 simmer15min;separate pasta5 at10min. | All `[1,2,3],[4],[5,6],[7]`:onion prep/fry,sauce15min,pasta10min salted water,then mix. | Core true/contradictions false,no component-time swap/cooking in sauce observed. Total25 unjustified sum with untimed prep/unclear overlap. Final cooking assertions NOT_REACHED. |
| Forced dough | Mix seven ingredients1;shape2;bake3 at180C20min;cool optional. | All4 groups retained;only mixing string shortened to `Mehl, Quark, Zucker, Backpulver, Ei, Kerne, Salz vermischen.` | All ingredients/shape/bake/numeric values/null retained;completed existing assertions pass. Initial forced overflow/two real text-only operations each;not natural-generation or general language-style proof. |

### Oven Review Detail

Source6: `Backe den Kartoffelauflauf im Ofen bei 180\u00b0C f\u00fcr 40 Minuten, bis die Kartoffeln gar sind.` Exact final baking text (Unicode escapes preserve characters):

- F: `K\u00e4se \u00fcber Kartoffeln streuen, bei 180\u00b0C 40 Minuten backen.` refs `[4,5,6]`.
- R: `Heize den Ofen auf 180\u00b0C vor und backe den Auflauf 40 Minuten.` refs `[5,6]`.
- G: `Backe den Auflauf 40 Minuten bei 180\u00b0C und lasse ihn kurz ruhen.` refs `[6,7]`.

All final texts omit any equivalent doneness condition. F initial draft retains it but has duplicate source3 and measured300x112 overflow against302x105. Full-draft correction removes the endpoint;third text-only shortening changes only overflowing baking text. R shortens only assembly;G full-draft correction repairs duplicate refs/overflow without restoring endpoint. Technical correction success does not establish content preservation;no literal wording/exact-five requirement.

Rice now returns null in all raw finals,improvement over CORR1 unsupported35;only F executes its metadata assertion. Oven40/pasta25 still fail unchanged null criteria in all gates. Full contexts contain untimed preparation/no explicit complete sequential aggregate;isolated40 orsum15+10 do not justify totals. Positive explicit50/complete5+10=15 and wrong/null negatives pass offline rubric checks,not fresh live generation or production provenance parsing. No blanket-null/runtimeparser requirement introduced.

## Daily, Weekly And Import Boundaries

Active [Daily composition](../../../backend/src/lib/prompts/dailyInsightPrompt.ts) v17 / assembly v2 fingerprint: `sha256:0373462c2f0e3b3050c51b4cfe468c6aca238ce3c0b15cf80c5be2b8847e4386`. Official release check and executed manifest tests preserve historical v14/v15/v16 fingerprints exactly and append v17. Actual unknown-activity context: activity_focus, hour null, status unknown, remainingCalories 500 / protein 40. Final activity-open-day guard follows the output contract independently of hour/protein, with neutral unknown completion and conditional fueling/liquids/recovery. Four forbidden-phrase negatives, safe conditional response and stale-weight phase guards pass. Strict validator, hash and expected outcomes are unchanged; no regex relaxation or exemption.

G stale-weight and unknown-activity PASS. G instead fails phase-progress-open-day: intent phase_progress, hour 12, remainingCalories 700 / protein 40, weight-phase signal. Unchanged strict validator throws `Daily insight recommends increasing intake based on an open calorie budget` at [validator](../../../backend/src/lib/dailyInsightValidation.ts#L254), via [provider](../../../backend/src/lib/openai.ts#L949) and Daily eval. This establishes rejection, not exact raw wording, field or v17 causation. Raw Daily response is not retained. Daily 17/18 leaves FT088 overall blocker unresolved; one unknown-activity pass does not erase CORR1 FAIL or certify Daily overall.

[Cache decision](../../../backend/src/lib/repositories/insightRepository.ts#L300) only extends the existing temporary v14 preservation allowlist to v17. Executed handler tests prove complete unexpired same-date v14 remains unchanged for Admin/nonadmin, without quota/provider/upsert; expired/incomplete v14 regenerates with current identity. Missing/mismatched fingerprint/system/snapshot/intent invalidates before limits; unchanged complete current identity stays cached. Existing tests use active constant v17 despite one historical test name saying v16. No new container, method, migration or cache redesign; Cosmos integration not run.

SharedTone's only production consumer is Daily. [WeeklyV2 prompt](../../../backend/src/lib/prompts/weeklyInsightV2.ts) and provider are independent; 16 Weekly files are unchanged against original QA. Eval-only case-insensitive evidence retains changed-number rejection; G 4/4 plus diagnostic 3/3 pass. No production Weekly/calculation coupling or historical closure.

Import v16 retains full schema/normalization/global trace in one call; provider/validators/handlers/Shared unchanged. R/G all eight Import fixtures pass, including numbered full source, separate core, quantity and category cases. Round2 handoff states no Import-body edit; exact pre-correction body-byte/session attribution is UNVERIFIED without a text baseline. Current review finds no Preparation coupling; stale HEAD is not used as a false baseline.

## Preservation And Documentation

[Reconciliation](Q21-FINAL2-2026-10-10-reconcile.json) independently verifies Round2 handoff/artifact/execution/transcript/report hashes: 1,113 unique checked paths, including 1,054 foreign files from implementation baseline. Baseline starts after the first owned regression edit, before production edits; not universal session attribution. All 20 candidate hashes match. Original QA categories: renderer 44/44, Weekly 16/16, API/provider/quota/loop/validators/Shared 38/38 unchanged. All 1,125 review baseline files unchanged before report replacement; final checks permit only the report to differ.

Six current KB contracts align v11/v16/v17 and partial unaccepted status, not old v6 current behavior. [Document history](Q21-FINAL2-2026-10-10-docsHistory.json) verifies four selected historical v9/v8/v7/r3 heading blocks exactly against complete Round2 snapshots; not universal paragraph/authorship proof. KB independent-final-QA-pending language describes the handoff-time boundary. This new FAIL is not silently written into KB because QA was explicitly prohibited from editing it. Orchestrator may route a later documentation update separately.

## Closure Recommendations

Recommendations to Orchestrator only;register unchanged.

| Existing finding | Recommendation | Evidence / boundary |
|---|---|---|
| FT086 / OVEN-ENDPOINT | Do not close; STOP. | All three final endpoints absent; F loses initial endpoint in full-draft correction. |
| FT087 / PREP-METADATA | Do not close; STOP. | Rice raw null improves, but all oven40/pasta25 totals unsupported and accepted. |
| FT090 / CORE | Do not close; STOP. | F essential rice cooking loss reproduced with null; R/G FIRST inversion rejected, no full rice success. |
| FT088 / DAILY-OVERALL | Do not close; STOP. | Stale-weight/unknown-activity pass, but phase-progress-open-day keeps Daily17/18 and G38/42 red. |
| FT091 / UNKNOWN-ACTIVITY | Narrow recurrence not reproduced in one G; no overall closure. | Actual fixture/strict negatives pass; raw Daily unavailable, historical CORR1 FAIL retained. Recommend acknowledging only finite improvement, no broad Daily acceptance. |
| FT089 / DOC-01 | Current alignment remains supported; already closed by Orchestrator. | Current v11/v17 docs verified, four dated blocks exact. Not a new register decision. |
| FT071 | No closure recommendation. | Mandatory independent complete rice success absent; IDs/fit/other fixtures insufficient. |
| FT076 and old Import/Daily/Capture | No automatic closure. | New finite passes do not reinterpret historical failures,missing captures/private original/revision. |

## Verification Notes

### HUMAN/MANUAL REVIEW REQUIRED

- State: `MANUAL VALIDATION REQUIRED`. Prerequisites: human culinary reviewer and complete new oven source/F/R/G records. Steps: compare slicing/assembly/order/180C/40min/doneness/aggregate provenance, allowing optional omissions. Expected: understandable source-faithful workflow without invented metadata. Result: `NOT PERFORMED`; record reviewer/date/result after actual review. AI comparison is not sign-off; missing review alone is not finding criticality or verdict downgrade; observed defects are.
- State: `UNVERIFIED`. Private original/exact deployed revision, Alpha replay, device Save/Share/visual approval and Cosmos emulator integration not executed. Prerequisites: separately authorized environment/device/test data. Steps: owner/ETag/no-write/export-confirm/share/cache-expiry replay. Expected: documented contracts and source fidelity. Result: `NOT PERFORMED`; local regressions are not end-to-end certification; NO DEPLOY.
- State: `UNVERIFIED`. Daily raw response/exact trigger field and all-domain SDK/transport counts absent in unchanged eval. Prerequisites: separately authorized instrumentation/replay. Steps: capture actual SDK response/guard decision without weakening validation. Expected: traceable input/output/counts. Result: `NOT PERFORMED`; no additional call or causal claim made.
- State: `UNVERIFIED`. Full pre-correction Import-body/session authorship/universal KB paragraph attribution lack text baseline. Prerequisite: trusted pre-edit text/revision. Steps: byte compare relevant body/history. Expected: no out-of-scope change. Result: `LIMITED`: current contracts, 20 candidate hashes, foreign history files and four selected blocks verified; broader claim not made.
- State: `UNVERIFIED`. Positive50/15 totals are offline rubric proof, not fresh live generation; synthetics are not universal stochastic/safety quality. Prerequisite: separately approved coverage. Steps: reviewed positive/negative cases without retry-until-green. Expected: source-supported totals/null otherwise. Result: `NOT PERFORMED` for additional coverage.

### History And Scope

- Post-report `Q21-FINAL2-2026-10-10-validateReport.json` / `-finish.json` protect 1,124 prior non-report files and 20 candidate hashes; exact full CORR1 report hash verified. One verdict/12 criteria/finding fields/links/UTF-8/configured Azure keys-endpoints longer than eight characters checked in new QA artifact plus candidate scope; not a universal secret audit. First validation precedes prose polishing; finish repeats the same checks and records the authoritative final report hash.
- Historical Q19/v18/oldQ21/CORR1 FAIL and all raw captures remain immutable. Current G38/42 is distinct, not historical PASS. Register untouched; FT071/076/old Import/Daily/Capture not closed. No deploy.

## Findings

Finding key: Q21-FINAL2-OVEN-ENDPOINT  
Plan reference: docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md  
Acceptance criterion: AC-2; AC-6; US-10 AC-15/16  
Description: All three accepted final oven summaries omit source6 potato-doneness while retaining180C40min. F initial endpoint is lost in full-draft correction; later shortening does not restore it. Not an optional-detail or fixed-wording failure.  
Criticality: Blocking  
Owner: Backend  
Evidence: [F](Q21-FINAL2-2026-10-10-F.json), [R](Q21-FINAL2-2026-10-10-R.json), [G](Q21-FINAL2-2026-10-10-G.json), reconciliation/Exact Oven Assessment; all200/usage1/fittrue. Automated oven content assertion absent by design; independent read-only comparison establishes loss.  
Recommendation: STOP and return unresolved FT086 to Orchestrator. No third automatic candidate, assertion/renderer relaxation or fit-as-fidelity claim; further implementation requires new scope authorization.

Finding key: Q21-FINAL2-METADATA  
Plan reference: docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md  
Acceptance criterion: AC-2; AC-6; AC-9; US-10 AC-16  
Description: All three gates accept oven40/pasta25 as aggregates without an explicit total or complete timed explicit sequence. Independent null checks fail after technical success200/usage1. Rice raw null improves, but does not resolve these provenance failures.  
Criticality: Blocking  
Owner: Backend  
Evidence: F/R/G full contexts/raw outputs/reports; [metadata assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L330); unchanged null-source counterexamples and positive50/15 offline checks.  
Recommendation: STOP and return unresolved FT087; retain null when unsupported, positive coverage and existing contracts. No blanket null, runtime parser requirement, waiver or automatic third correction.

Finding key: Q21-FINAL2-DAILY-PHASE-OPEN-DAY  
Plan reference: docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md  
Acceptance criterion: AC-9 (overall gate)  
Description: G phase-progress-open-day throws `Daily insight recommends increasing intake based on an open calorie budget`; Daily17/18 and G38/42 remain failed despite successful stale-weight/unknown-activity. Actual context: phase_progress, hour12, remainingCalories700/protein40. Exact raw response/cause unavailable; not proof of v17 causation or Preparation/Weekly failure.  
Criticality: Blocking  
Owner: Backend  
Evidence: [G report](Q21-FINAL2-2026-10-10-G-Report.json), [G transcript](Q21-FINAL2-2026-10-10-G-Output.txt); [strict validator](../../../backend/src/lib/dailyInsightValidation.ts#L254), [provider](../../../backend/src/lib/openai.ts#L949) and Daily eval; validator unchanged.  
Recommendation: STOP and return separate Daily overall blocker FT088/new recurrence to Orchestrator; retain failure and strict guard, no third automatic candidate or additional replay by QA. FT091 finite pass is not broad closure.

Finding key: Q21-FINAL2-CORE-ORDER  
Plan reference: docs/User Stories/Reciepe/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md  
Acceptance criterion: AC-2; AC-5; AC-9; US-10 AC-15/16  
Description: F accepts rice without any separate rice cooking, retaining oil/rest instead; null metadata passes and core check fails missingref5. R/G retain rice but both exhaust three calls with FIRST inversion,422/usage0. Correct validator rejection, not a bug; mandatory complete successful rice fixture unmet.  
Criticality: Blocking  
Owner: Backend  
Evidence: F `[1,2],[3],[4],[6],[7]`/200usage1; R `[1,2],[3,4],[6,7],[5],[8]`; G `[1,2],[3],[4,6],[7],[5]`/422usage0; [structural assertion](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L452), F/R/G reconciliation. F independent core assertion now reaches and fails.  
Recommendation: STOP and return FT090; do not close FT071 or hide core loss with references/looser rubrics. Preserve free grouping, call budget and validator; new work only after separate authorization.

## Handoff

Final independent QA complete: offline green, F/R/G red. Preparation=2/Daily=2 automatic correction budget exhausted; STOP, NO DEPLOY. Concrete blockers: oven endpoint, oven/pasta aggregates, rice core/order, Daily phase-progress-open-day. Human oven review MANUAL VALIDATION REQUIRED / NOT PERFORMED. Orchestrator owns register/status and any newly authorized work; QA writes no register and performs no further provider attempt.