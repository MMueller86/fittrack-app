# QA Report: Q-1 Recipe Preparation Feedback Loop

- Format: `fittrack-qa-v1`
- Date: 2026-10-09
- Plan reference: [Approved full plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md)
- Verdict: `FAIL`
- Release Gate: `CLOSED`
- Runtime code status: `IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED`
- Frozen candidate SHA-256: `80aac40c4d980e1b6af8ed76bc7fbe36bac16dee87e14db7977ef4c681de7171`

## Scope

Independent Q-1 review authorized by the user on 2026-10-09. Read the complete approved plan, all AC-1..14 and [original requirements](../../User%20Stories/Reciepe/HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md). The latest requirements remove the ingredient-list omission instruction and reject the proposed 23-character/11-character-word limit. Neither omission nor literal repetition of every ingredient is independently imposed as a new product rule by this review.

Reviewed the [B-1 handoff](../../User%20Stories/Reciepe/B-1_Feedback-Loop_Handoff_2026-10-09.md), [B-2 handoff](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Handoff_2026-10-09.md), original and completion recovery manifests, all complete B-1/B-2/D-1 owned patches, their current owning code/tests/evals, and the [D-1 handoff](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Handoff_2026-10-09.md). Reviewed required testing/backend/AI integration/API/recipes/AI features/quota KB, system overview, official eval runner/config, backend package scripts, report contract, historical [Q-19 report](PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v19.md) and [14:12 logging release](../../../infra/release-records/Recipe-Step-Overflow-Logging_Alpha-Functions_2026-10-09.md).

Applied the `azure-openai-feature-integration` skill and its QA checklist. No new feature key, schema, dependency, nutrition output, persisted AI document or migration is introduced. Nutrition plausibility and persisted prompt-version checks are consequently not applicable. Preparation-specific failure contracts in the approved plan take precedence over the skill's generic failure examples.

Only this assigned report is added. No production, prompt, eval, KB, historical report, findings register, baseline or evidence edits; no delegation, provider/live rerun, Cosmos access, ARM, staging/MIR, publish, EAS/mobile/native smoke, commit or branch. Local build regenerated ignored build output only. R-1 was SKIPPED pending QA; no release is authorized by this report.

## Findings Summary

| Finding key | Source / disposition of observation | Criticality | Owner | Smallest proposed action |
|---|---|---|---|---|
| Q1-01 | New independently reproduced runtime logging-boundary defect; not a private-secret exposure claim | Blocking | Backend | B-2 affected-field filtering and negative logging regression |
| Q1-02 | New independently reproduced compact diagnostic mismatch; actual geometry remains correct | Blocking | Backend | B-2 production-derived font metadata and compact diagnostic regression |
| Q1-03 | Recorded mandatory oven live failure independently reconciled; protective loop works, no universal/stochastic root-cause claim | Blocking | Backend | Scoped B-2 correction-prompt investigation using the existing failed drafts |
| Q1-04 | Recorded pasta semantic failure is a reproducible inherited rubric false positive, not demonstrated cooking corruption | Blocking | Backend | Separately authorized, source-backed rubric repair with positive and negative regressions |
| Q1-05 | Recorded dough failure is literal-name enforcement beyond demonstrated source fidelity; not proven ingredient loss | Blocking | Backend | Separately authorized fixture review of unambiguous ingredient-set equivalence |

These are observed findings and proposed actions, not acceptance, deferral, closure or authorization decisions. Mandatory F remains failed. R/G non-execution and release/environment limits are recorded separately, not assigned finding criticalities.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | [B-1 complete patch](../../User%20Stories/Reciepe/B-1_Feedback-Loop_Owned-Diff_2026-10-09.patch), [template](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts), [v5 prompt](../../../backend/src/lib/prompts/recipeAnalyze.ts): existing template, fonts, teaser 22..18, image format/count and Shared limits preserved. Three pinned PNG hashes pass independently. No rejected cap, clipping, new font/layout/image fallback or ingredient-omission instruction in the production prompt. |
| AC-2 | PASS | Independent [renderer tests](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts) cover all 1..5 counts, shared Satori subtree/constraints, German breaks, title variants, teaser sizing and 0.5/0.5001 tolerance. Exact Alpha sentence reproduces 300x112 versus 302x105 and enters correction in [loop tests](../../../backend/src/lib/recipePreparation.test.ts); source-backed shorter text passes at unchanged font. Diagnostic metadata defect is separately AC-4/10. |
| AC-3 | PASS | Real-font cold-start tests prohibit Sharp/Resvg/non-font reads; text-only tree contains no image/ingredient nodes. Missing/corrupt fonts, absent/nonfinite dimensions and probe failures terminate technically without correction/booking; no geometric success is fabricated. |
| AC-4 | FAIL | Call/context/latest-draft mechanics pass initial/correction1/correction2/exhaustion tests and recorded 1..3 calls. However [templateDiagnostics](../../../backend/src/lib/recipePreparation.ts#L57) sends inaccurate current compact font metadata: lineHeight1.25 instead of production1.17. Q1-02. |
| AC-5 | PASS | Whole-output validation uses unchanged saved-source authority; all measurable steps/teaser are reprobed. Count changes, previous-fitting regressions, FIRST-group interleaving/gaps and unknown/duplicate/reversed references pass independent [validator](../../../backend/src/lib/recipeAnalyzeValidation.test.ts) and loop tests. No sorting/reference repair or assertion weakening found in the owned patch. |
| AC-6 | PASS | Controlled clock/late provider/probe tests pass; aggregate75000 and per-call20000 with remaining-time reduction, timer cleanup and pre-booking check. [Injected SDK tests](../../../backend/src/lib/openai.recipeAnalyze.test.ts) exercise all three operations, maxRetries0/AbortSignal and unchanged Import options. All seven recorded SDK calls have maxRetries0, timeout20000, signal present, stop finish. Booking itself is intentionally awaited, not subject to a raced timeout. |
| AC-7 | PASS | Independent [handler tests](../../../backend/src/functions/recipes.test.ts) and SDK tests cover strict request/auth/owner/ETag/source/quota, empty/parse/refusal/truncation/transport and technical/backend/booking paths. Saved malformed source is rejected before quota/provider. Preparation errors are generic502/500 or safe422 details, with no raw HTTP Error.message echo. Logging exception violation is AC-10, not an HTTP leak. |
| AC-8 | PASS | Quota once before provider; usage once only after full validation/probe and deadline check. Failure paths book zero; in-memory write spies and before/after versioned recipe checks pass. All four recorded fixtures report update/replace/create0 and unchanged source; oven usage0. No recipe/export/image/diary writes added; explicit confirmation remains separate. |
| AC-9 | PASS | Strict V2 request/plain200/sourceEtag unchanged, internal refs stripped, no shared/mobile owned edits. [Mobile prepare timeout](../../../mobile/src/shared/api/recipeApi.ts#L176) remains90000; [client](../../../mobile/src/shared/api/client.ts) retries timeout/5xx only for GET, not this POST. No mobile build needed. |
| AC-10 | FAIL | Exact latest-field JSON escaping, terminal-only event and sentinel privacy tests pass for covered scenarios. Unknown-key-only nested schema error nevertheless logs a fitting description (Q1-01), contrary to metadata-only handling and unaffected-text exclusion. Compact logged font metadata is also inaccurate (Q1-02). |
| AC-11 | FAIL | V5/version guard, real provider+real probe and final-output assertions are present; original three saved sources/rubrics preserved. Recorded F has oven fit failure, pasta regex false positive and dough literal-name failure. No semantic acceptance inferred from refs/fit/200. Q1-03..05; all existing failed results retained. |
| AC-12 | FAIL | Independently495 focused tests/typecheck/build pass; verified original focused495/full1576 native/report counts and hashes. Recorded F exit1, 5 executed/2 pass/3 fail/9 selection skips. R/G NOT_RUN after failure, required and UNVERIFIED. No gate waiver or historical Q-19 closure. |
| AC-13 | PARTIAL / UNVERIFIED | Complete inventory/candidate/runtime identities and owned/inherited baseline evidence verified below; actual source matches frozen runtime. This is NOT a verified deployable package: live gates fail, complete inherited-code release acceptance is not claimed, and clean-release staging/MIR/Linux Node22 remote-publish parity gates have not run. Candidate identity is not release readiness. |
| AC-14 | PENDING INFRASTRUCTURE / UNVERIFIED | R-1 skipped because gate is CLOSED. No loop deployment/function-list/health/authenticated/native/log smoke verified for this candidate. Prior14:12 health200/protected401 belongs to logging-only release and cannot satisfy this criterion. Not a pre-release PASS or a new environment finding. |

## Tests

Counts are executed / passed / failed / skipped. QA owns only the independent commands labeled QA below; recorded commands are read/hash/count reconciliations, not claimed reruns. Exact historical executable/argument arrays and reporter destinations remain in the linked gate JSONs. This table uses workspace-root command summaries, not machine-specific paths.

| Command / origin | Exit code | Result |
|---|---:|---|
| QA: `npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts src/functions/recipes.test.ts src/functions/ai.test.ts src/lib/openai.recipeAnalyze.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts src/lib/recipePreparation.test.ts --reporter=dot --silent` | 0 | 6 files; 495 / 495 / 0 / 0; duration45.04s. Real-font and three full-render PNG fingerprint checks included. |
| QA: `npm run typecheck --workspace=backend` | 0 | Backend typecheck passed. |
| QA: `npm run build:verify --workspace=backend` | 0 | Compile, ten renderer assets, startup/module imports and duplicate Function ID checks passed. Expected Azure Functions test-mode registration warnings only; not a running host or Linux native proof. |
| QA: `node -e` read-only inventory/candidate/native-report assertions described below | 0 | 83 asset hashes, all13 required assets, 846 candidate paths, 7 authorized document deltas, 922 D-1 foreign files and3 native JSON test reports verified. |
| QA: `node -e` synthetic compiled-code checks in Reproductions below | 0 | Reproduced pasta contradiction-regex match, compact line-height mismatch and unknown-key text inclusion. Three injected logical calls, zero SDK/provider calls. Exit0 means the observed defects were reproduced, not that feature behavior passed. |
| QA: `node -e` raw F reconciliation/dependency/asset assertions | 0 | Every request/response/latest draft verified for4 fixtures,8 logical/7 recorded SDK calls;7 installed dependency metadata identities and10 source/dist assets match. No new live call. |
| QA: `node -e` assigned report contract/link/hash/preservation assertions | 1, 1, then 0 | Initial two harness checks failed on PowerShell console/pipeline encoding of one inherited Unicode filename, not an implementation check. Corrected raw Git-path/hash matching verifies14 unique criterion rows,5 complete findings,55 existing local links, exact F/candidate hashes and all933 pre-existing nonignored files unchanged. Report ASCII/editor checks pass; only this report is added. |
| QA: `node -e` recorded API-version/timestamp scalar check | cancelled, 1, 1, then 0 | Shell quoting/regex transport attempts were cancelled or failed before a meaningful evidence assertion. Structured parsing of all4 native counter records then passed: API2024-08-01-preview and exact F start/end match this report. No settings/network access or evidence modification. |
| Recorded: [Focused gate](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Focused_2026-10-09-r2.json), approved six-file command with default+JSON reporters | 0 | 495 / 495 / 0 / 0. Native output/report hashes and report counts independently checked. |
| Recorded: [Units gate](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Units_2026-10-09-r2.json), `npm run test --workspace=backend` with default+JSON reporters | 0 | 1576 / 1576 / 0 / 0. Full suite not redundantly rerun by QA under the bounded offline scope; original evidence verified. |
| Recorded: [Typecheck gate](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Typecheck_2026-10-09-r2.json), `npm run typecheck --workspace=backend` | 0 | Original non-test gate; native output hash verified. |
| Recorded: [Build gate](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Build_2026-10-09-r2.json), `npm run build:verify --workspace=backend` | 0 | Original non-test gate; native output hash verified. |
| Recorded F: [F gate](../../User%20Stories/Reciepe/B-2_Feedback-Loop_F_2026-10-09-r2.json), `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` with recorded reporters | 1 | 5 / 2 / 3 / 9; version guard plus4 required fixtures;8 logical calls include1 forced initial;7 SDK calls. Failure evidence, not rerun. |
| Required R: `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts` | null | [NOT_RUN_REQUIRED_LIVE_FAILURE](../../User%20Stories/Reciepe/B-2_Feedback-Loop_R_2026-10-09-r2.json); executed0, provider0, UNVERIFIED. |
| Required G: `npm run test:eval --workspace=backend` | null | [NOT_RUN_REQUIRED_LIVE_FAILURE](../../User%20Stories/Reciepe/B-2_Feedback-Loop_G_2026-10-09-r2.json); executed0, provider0, UNVERIFIED. |

No credentials were read/printed and no real Cosmos check was necessary: persistence/repository methods are unchanged, and handler/eval storage/quota are mocked or in-memory. Shared/mobile suites are not needed for this backend-only owned delta. [Official runner](../../../backend/scripts/run-eval.mjs) preserves settings/environment precedence and missing-credentials exit2; [eval config](../../../backend/vitest.eval.config.mts) separates live tests from units, with sequential execution. Preparation's explicit100000ms test timeout overrides the default30000ms. No direct all-skipped command is substituted for F/R/G.

## Candidate Audit

[Candidate JSON](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Candidate_2026-10-09-r2.json) hashes to the exact SHA above. The [artifact manifest](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r2-completion.json) is complete: all83 listed paths exist and match, and all13 expected handoff assets exist. Its self-hash is deliberately excluded internally; its actual hash matches the [D-1 manifest](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Manifest_2026-10-09.json). No missing completion asset remains. The [earlier recovery manifest](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Recovery-Manifest_2026-10-09.json) truthfully records earlier missing assets; the [completion recovery manifest](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Recovery-Manifest_2026-10-09-r2-completion.json) supplies them without replacing historical failures.

Actual846 frozen paths checked:839 unchanged and exactly7 authorized post-freeze D-1 document deltas, with current after-hashes matching D-1. These are six required KB documents and the stale SPEC pointer, not runtime changes. All12 B-2 owned runtime/test/eval paths, all B-1 backend paths/fonts/photo and dependency manifests remain frozen. All922 D-1 foreign baseline files are preserved. The pre-report QA in-memory hash baseline contains933 existing nonignored regular files; it excludes private settings/env and ignored generated output/dependencies, not a universal filesystem inventory.

Read all32 B-1,41 B-2 aggregate and28 D-1 patch hunks. B-1 uses shared real nodes/font cache, not approximate geometry. B-2 has a Preparation-only loop/provider API and thin handler orchestration. D-1 changes only current behavior/status and a stale-SPEC pointer. Original/resume/aggregate ownership is explicit in the [ownership record](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Ownership_2026-10-09-r2-completion.json); inherited original/resume diffs are inventoried and hashed, not adopted as newly owned changes or assumed independently accepted. The [patch audit](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Patch-Audit_2026-10-09-r2-completion.json) records reverse-check exit0 and the ownership record records isolated original-byte reconstruction for12 files; QA did not reverse/apply patches to the worktree. [Preservation evidence](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Preservation_2026-10-09-r2-completion.json) remains historical; current D-1 deltas are explicitly accounted for.

Installed dependency package-metadata hashes/versions match the frozen identities: OpenAI4.104.0, Satori0.33.4, Hyphen1.14.1, Sharp0.34.5, Resvg2.6.2, Vitest2.1.9 and TypeScript5.9.3; QA Node is v24.15.0 on Windows, not target Linux Node22. All ten source renderer assets, including fonts/license, match freshly compiled local dist hashes. No dependency edit means a latest-version lookup/update is not applicable. Installed metadata/lock/source fingerprints do not certify every installed binary, a clean release build, staging parity or Linux remote installation.

Scoped secret review of owned additions found no introduced credential literal or broad provider/source serialization in production. Existing synthetic raw eval captures are read-only evidence, not a new runtime logging permission. Q1-01 is a concrete overlogging defect despite passing tested sentinel scenarios. No private recipe/provider secret was retrieved or reproduced in this report.

## Recorded F Diagnosis

Independent reconciliation parsed the existing [raw F output](../../User%20Stories/Reciepe/B-2_Feedback-Loop_F-Output_2026-10-09-r2.txt) and compared all four complete-attempt JSON records with [provider evidence](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Recorded-Provider-Evidence_2026-10-09-r2-completion.json) and [live reconciliation](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Live-Reconciliation_2026-10-09-r2.json). Every raw SDK response parses to its corresponding draft; every correction carries unchanged original context and exact previous draft. Original request/options/probe/terminal counters were inspected, not accepted from handoff counts alone. F ran once16:02:27.683Z..16:02:46.279Z; raw-output hash `220fd741cbe6f1cc9010c508a0ea2e10b15f1487f666a7f58b852f68c0de0c0c`, JSON-report hash `7cf9cb2e1c9cd527bbb586667966c1d1025aa41c536d1581aef942a23302fec0`. All7 SDK calls use model gpt-4o-mini, configured API2024-08-01-preview, temperature0.2/max_tokens2048, maxRetries0/timeout20000/signal/finish stop.

| Fixture | Logical / SDK | Final HTTP / usage / fit | Actual independent assertion boundary | QA diagnosis, without changing recorded status |
|---|---|---|---|---|
| Saved eight-step rice | 1 / 1 | 200 / 1 / true | Final V2/protection and semantic assertions executed and passed | This synthetic fixture preserves cutting/frying/separate rice/low-heat finishing. Not closure of historical rice corruption or private Alpha replay. |
| Saved seven-step oven | 3 / 3 | 422 / 0 / false | Structure passes; final real-probe assertion fails; later success/fidelity assertions NOT REACHED | Step[1] remains300x112 against302x105 in all3 attempts. Provider corrects other steps but repeats the offending assembly sentence. Correct loop exhaustion, missing required live success; no rubric artifact or loop bypass found. |
| Saved essential-sauce pasta | 2 / 2 | 200 / 1 / true | Final V2/protection assertions reached; source5 contradiction assertion FAIL | Final sentence explicitly cooks in salted water10min, then mixes with sauce. Regex incorrectly matches across `und`; captured cooking is not demonstrated to contradict the source. Historical FAIL remains. |
| Forced dough initial, real correction | 2 / 1 | 200 / 1 / true | Final V2/protection assertions reached; source1 literal ingredient patterns FAIL | Final says mix ALL ingredients into dough and form rolls; original context has only this single ingredient-mixing stage. Literal ingredient words absent, not proof ingredients omitted. No independent test PASS or universal fidelity claim. |

All recorded writes update/replace/create0 and saved records unchanged. The forced initial dough call is not counted as a provider request. Oven semantic-matrix booleans in evidence are diagnostic observations, not later executed/passing assertions. Pasta/dough protection markers precede semantic checks and cannot be read as semantic acceptance.

### Reproductions

Read-only QA checks used freshly compiled owning modules, injected synthetic generation and `node:assert/strict`, without changing a test or loading credentials:

1. Compact diagnostics: five valid ordered/ref-backed synthetic steps, first description90 `W` characters, short teaser/title, remaining descriptions `Mische den Teig.`. Inject the same whole draft three times into `prepareValidatedRecipeExport`. Actual exhaustion has compact/font18/bounds318 and diagnostic lineHeight1.25; `getRecipeDetailsTextLayoutFields` for exactly that candidate reports1.17. Actual width1663; width-only diagnosis correctly has no invented height. Three injected calls, zero SDK calls.
2. Unknown-key logging: valid one-step output with `description: 'Mische den Teig.'`, source ref1 and an extra synthetic property on that step. `validateRecipeExportPreparationOutput` returns only `schema:unrecognized_keys@steps[0]`; `recipePreparationAffectedFields` nevertheless returns the exact fitting description. [Handler](../../../backend/src/functions/recipes.ts#L821) serializes these returned fields on exhaustion. No text/reference/geometry error is required to reproduce the inclusion.
3. Pasta: apply the unchanged source5 contradiction regex from [fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L306) to recorded final `Koche die Pasta in Salzwasser 10 Minuten und mische sie mit der Sauce.`. Actual match is `Pasta in Salzwasser 10 Minuten und mische sie mit der Sauce`. The prefix stops at `und`, but the suffix after `(?:in|mit)` uses unrestricted `[^;,.]*`, crosses the boundary and treats subsequent sauce MIXING as sauce COOKING. No cooking-in-sauce or swapped10/15min is present in that final sentence.
4. Dough source comparison: final source[1,2] group is `Vermische alle Zutaten zu einem Teig und forme ihn zu Broetchen.` (the recorded text uses the German umlaut). It preserves the single-stage all-ingredient action, forming, and later180C/20min baking. The new [fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L361) instead requires each literal ingredient token. The approved requirements specify meaning/source fidelity and leave rewriting strategy open; they do not require an explicit list in every accepted sentence. This is a fixture-authority gap, not a proven production omission. General staged recipes must not automatically accept indiscriminate `all ingredients` wording.

## Findings

### Q1-01: Unknown-Key Error Logs Unaffected Cooking Text

- Finding key: Q1-01
- Plan reference: [Approved plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), section4.6
- Acceptance criterion: AC-10
- Description: A nested `unrecognized_keys` diagnostic at `steps[0]` is mapped to that step's description even when the description/references/geometry are valid. Unknown keys are explicitly metadata-only under the approved log exception; this emits unaffected text after exhaustion.
- Criticality: Blocking
- Owner: Backend
- Evidence: Reproduction2; [affected-field mapper](../../../backend/src/lib/recipePreparation.ts#L156), [handler serialization](../../../backend/src/functions/recipes.ts#L821). Existing sentinel test combines unknown keys with an actually invalid affected field and does not cover the unknown-key-only boundary.
- Recommendation: Small B-2 change classifying content-eligible diagnostics before mapping known strings. Add an unknown-key-only handler/helper negative regression while retaining actual reference/text/metadata affected-field tests and exact escaping. Do not suppress genuinely implicated reference-error descriptions or broaden logging. QA made no repair.

### Q1-02: Compact Correction Font Metadata Is Incorrect

- Finding key: Q1-02
- Plan reference: [Approved plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), sections4.1/4.2/4.6
- Acceptance criterion: AC-4, AC-10
- Description: All overflow diagnoses hardcode lineHeight1.25. For five steps the real template is font18/lineHeight1.17; correction payloads and exhaustion logs therefore misdescribe the actual production layout. Measurements/acceptance still use the correct real renderer; no accepted overflow is demonstrated.
- Criticality: Blocking
- Owner: Backend
- Evidence: Reproduction1; [diagnostic construction](../../../backend/src/lib/recipePreparation.ts#L57) versus [production constants](../../../backend/src/lib/instagramRenderer/recipeDetailsTemplateV3.ts#L49). Existing correction tests assert font size/bounds but not compact line height.
- Recommendation: Source diagnostic font metadata from the existing production layout owner; add compact-step and teaser assertions, preserving large1.25/compact1.17 and teaser1.25 without changing fonts/bounds. Small B-2 metadata/test correction, not renderer redesign.

### Q1-03: Mandatory Oven Live Case Exhausts Without Fitting

- Finding key: Q1-03
- Plan reference: [Approved plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), sections4.3/7
- Acceptance criterion: AC-11, AC-12
- Description: Both real corrections retain the same overflowing assembly sentence, despite receiving the exact previous draft and measured current error. Mandatory successful oven final-output checks are unmet. Protective422/usage0 is correct behavior, not a loop-count/probe/validator defect; one recorded run cannot establish model causality or failure frequency.
- Criticality: Blocking
- Owner: Backend
- Evidence: Recorded F oven3/3 calls, all step[1]300x112 versus302x105; [raw provider evidence](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Recorded-Provider-Evidence_2026-10-09-r2-completion.json), final real-probe assertion at [eval](../../../backend/src/lib/prompts/recipeAnalyze.eval.test.ts#L425).
- Recommendation: Orchestrator-approved smallest B-2 correction-prompt investigation of why the reported failing step is preserved while other steps change. Retain full source/ref/geometry fidelity, fixed fonts/schema/budgets and at most3 calls; no truncation, server repair, fourth attempt or repeat-until-green. A future changed prompt needs a new identified candidate/version guard and authorized gates; no new call is authorized here.

### Q1-04: Pasta Rubric Mistakes Later Mixing For Cooking In Sauce

- Finding key: Q1-04
- Plan reference: [Approved plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), AC-11 and preserved independent contradiction rubric
- Acceptance criterion: AC-11, AC-12
- Description: Unchanged inherited source5 contradiction regex crosses the action boundary into sauce mixing, rejecting a source-backed separate10min salted-water cooking sentence. This is an independently reproduced test defect, not justification to weaken the independent cooking requirement or label recorded F passing.
- Criticality: Blocking
- Owner: Backend
- Evidence: Reproduction3; [source and regex](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L287), original raw final text/protection evidence and failed assertion in immutable F report.
- Recommendation: Separately authorized test-only rubric correction within the existing fixture/test homes, with a positive regression for this exact separate-cook-then-mix sentence and negative regressions for actual cooking in sauce and component/time swaps. Preserve all original source fixtures and historical failed artifacts. Do not modify the production prompt for this observation or rerun live in Q-1.

### Q1-05: Dough Rubric Requires Literal Names Rather Than Demonstrated Ingredient Fidelity

- Finding key: Q1-05
- Plan reference: [Approved plan](../../User%20Stories/Reciepe/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09.md), sections4.3/7 and latest original requirements
- Acceptance criterion: AC-11, AC-12
- Description: New forced-dough rubric treats absent literal ingredient names as omission even when the final source[1,2] sentence explicitly mixes ALL ingredients in the single mixing stage represented by this source. Literal repetition is not an approved universal requirement. Recorded test fails, but actual source1 ingredient loss is not established by those token checks.
- Criticality: Blocking
- Owner: Backend
- Evidence: Reproduction4; [forced fixture](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L334), literal patterns at [source1 check](../../../backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts#L361), immutable recorded correction and final semantic matrix.
- Recommendation: Separately authorized fixture review deriving equivalent ingredient-set assertions from this source, retaining negative ingredient-omission/invention and staged-component cases. Do not broadly accept generic wording, force a prompt strategy, alter fixed fonts or silently reclassify the failed F run. Any subsequent D-1 update should distinguish a failed lexical rubric from proven cooking loss, not rewrite old evidence.

## Documentation And Historical Boundaries

Six D-1 KB edits and the SPEC pointer accurately identify the implemented v5 loop, terminal contracts, transient V2/ETag, aggregate/per-call retry policy, geometry-only scope and failed/unrun gates. Documentation assertions are not live acceptance. Two review divergences remain: the documented unaffected-text exclusion is violated by Q1-01, and KB/handoff statements that pasta contradicts source5 or dough loses ingredients overstate what the recorded failing regex/token assertions establish (Q1-04/05). Propose a later scoped D-1 wording correction after owner review, not a production/KB edit by QA. The existing quota KB explicitly records its baseline-versus-code recipe-analyze limit divergence; this is inherited, unchanged and not a new Q-1 finding.

Historical Q-19 remains unchanged and unresolved: accepted rice cooking change, missing rice/oven success, foreign Import/Daily failures and historical private/Alpha limitations are not closed. This candidate's rice fixture pass is new synthetic evidence only. R/G NOT_RUN provides no new foreign-flow result. The previous14:12 Alpha record establishes a logging-only deployment and then-observed health/protected checks, not deployment of this loop or proof that prior native install-script/vulnerability warnings are resolved.

## Verification Notes

These are UNVERIFIED limitations, not finding criticalities. They do not independently lower the verdict; observed runtime defects and failed mandatory F already do. Unexecuted required gates nevertheless keep release readiness closed.

| State | Reason / prerequisites | Manual action or subsequent authorized check | Expected result | Result |
|---|---|---|---|---|
| UNVERIFIED | Required F failed; user expressly prohibits another live call or R/G continuation here | Only after separately approved owner corrections, freeze a new candidate and execute authorized F then R then G in order; stop on failure and preserve each artifact | All required changed-feature assertions and unwaived gates pass on that exact candidate | NOT_RUN R/G; executed0/provider0; no QA live rerun |
| UNVERIFIED | Clean release staging/MIR/Linux Node22 package identity and inherited candidate acceptance not established | Infrastructure only after gate opens: reviewed source manifest, clean generated build, mirrored dist/ten assets/production manifests and hashes, authorized remote publish | No incidental unreviewed dirty code, settings or Windows dependencies; verified Linux Node22 artifact | R-1 skipped; no staging or publish |
| MANUAL VALIDATION REQUIRED | Authorized owner recipe, signed-in Alpha/device context, supplied directly to release tooling; no tokens in chat | After authorized release, prepare without autosave, explicitly confirm when intended, render/share the pair and inspect quota/source revision; inspect exhausted event only with an authorized reproducible case | Real fonts/native images render; one success booking/no failure booking; unchanged source/no implicit save; exact affected-only logs | Not performed; no mobile/native/authenticated smoke context supplied |
| UNVERIFIED | New deployment/function-list/health evidence absent for this loop | Infrastructure after release: verify registered prepare/share/health functions, public health200 and protected route401 | Published functions and protection correct for identified new deployment | Prior logging release only; AC-14 pending |
| MANUAL VALIDATION REQUIRED | Finite synthetic rubrics do not prove arbitrary cooking or metadata derivation; human cooking reviewer required | Compare sources/final outputs and component transitions, ingredient-set meaning, time/temperature and useful concise workflow without imposing a new shortening strategy | Source-faithful usable text; unsupported totals/difficulty and staged-ingredient ambiguity identified | Independent read-only QA assessment recorded; no human sign-off or universal guarantee |
| UNVERIFIED | Historical private source/exact deployed revision not supplied | Separately authorized historical replay scope and user-owned test context needed before any retrieval/call | Direct evidence for specific historical finding/revision | No historical closure or replay |

## Handoff

Recommended smallest follow-up is owner-scoped B-2 work on Q1-01/02 plus investigation of Q1-03, and separately authorized test-only review of Q1-04/05. Preserve the existing schema, original sources, negative fidelity checks, rejected-budget decisions, terminal response contracts and failed records. No foreign Import/Daily repair or architectural redesign is recommended within this slice. No release or new live gate is permitted by this review.

QA response manifest: report path is this assigned artifact; verdict is the single header value; release gate CLOSED; findings Q1-01..Q1-05. Runtime code is unchanged and implemented but not accepted/deployed as this loop. Mandatory F remains exit1 with R/G required and UNVERIFIED; AC-14 remains pending Infrastructure.