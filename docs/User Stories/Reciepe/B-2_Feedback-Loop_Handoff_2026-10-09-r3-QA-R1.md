# B-2 QA Correction Round 1: r3 / QA-R1

Status: **IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED**.
Release: **CLOSED**. QA acceptance and finding closure: **NOT CLAIMED**.

This Backend-owned correction package addresses Q1-01..05 / FT-QA-2026-081..085. It does not execute QA, D-1, deployment, release, migration, branch creation or commit. No waiver, historical PASS reclassification, foreign Import/Daily correction or repeat-until-green was performed.

## Candidate And Ownership

- HEAD: `b637ee5b59a4f72b7d822443680c1951a01f9dc4`.
- Frozen candidate SHA256: `59c7d826f4b0188ed82ee675ba20e787e5aa30f8459ea7680c7f364a6bcbed44`.
- Round starting worktree: 934 files, including inherited dirty changes. Eight owned source/test paths, 926 foreign paths; foreign files are preserved, not accepted or claimed as this round's work.
- Frozen candidate: 935 source/evidence-runner files and 338 compiled runtime files. Installed dependency metadata is separately fingerprinted. Reporting-only additions after freeze are not runtime changes.
- Seven initial owned paths were captured before edits. The eighth, the adjacent Preparation-version assertion in the existing AI handler test, has a pre-edit ownership-extension record matching the round baseline.
- Only two production files changed: [recipePreparation.ts](../../../backend/src/lib/recipePreparation.ts) and [recipeAnalyze.ts](../../../backend/src/lib/prompts/recipeAnalyze.ts). Six existing test/fixture files changed; no new runtime abstraction or dependency.
- The exact owned aggregate delta is against the round starting dirty bytes, not HEAD. Five finding patches are independent baseline projections, not an additive patch series. Original inherited hunks remain in the baseline; aggregate reverse applicability passed without applying a patch.

Evidence: [Baseline](B-2_Feedback-Loop_Baseline_2026-10-09-r3-QA-R1.json), [Ownership extension](B-2_Feedback-Loop_Ownership-Extension_2026-10-09-r3-QA-R1.json), [Candidate](B-2_Feedback-Loop_Candidate_2026-10-09-r3-QA-R1.json), [Ownership and finding hashes](B-2_Feedback-Loop_Ownership_2026-10-09-r3-QA-R1.json), [Owned aggregate diff](B-2_Feedback-Loop_Owned-Diff_2026-10-09-r3-QA-R1.patch), [Patch audit](B-2_Feedback-Loop_Patch-Audit_2026-10-09-r3-QA-R1.json).

## Finding Corrections

### Q1-01 / FT-QA-2026-081

`recipePreparationAffectedFields` excludes `unrecognized_keys` diagnoses from content eligibility. Nonstring affected values remain metadata-only. Actual known-string field/reference/template failures still retain exact latest affected text; public error details remain safe metadata.

Added existing-file helper regressions for nested unknown-key-only and nonstring inputs, plus a true-validator/real-probe handler exhaustion regression: three logical calls, one quota check, zero usage, one exhaustion event, `affected_field_count:0`, `affected_fields:"[]"`. All log/warn/error channels exclude unaffected teaser/cooking/source text and unknown/nonstring sentinel values.

Evidence: [Q1-01 diff](B-2_Feedback-Loop_Q1-01-Owned-Diff_2026-10-09-r3-QA-R1.patch). Diagnostics Red reproduces the helper/handler disclosure before correction; Green and full offline gates pass. Disposition: local correction tested, pending independent QA; no finding-register closure.

### Q1-02 / FT-QA-2026-082

Measured overflow font metadata now comes from unchanged production `getRecipeDetailsTextLayoutFields`, including normal/italic and large versus compact line height. It no longer hard-codes `1.25` for compact steps. No renderer, measurement, font, asset, geometry or bounds change.

Real-font four/five-step regressions cover full correction requests and terminal diagnostics: step 22/1.25 versus 18/1.17, teaser italic 18/1.25, width failures without invented height, three logical calls and exact affected text. B-1 real-font renderer/fingerprint checks remain in focused/full gates.

Evidence: [Q1-02 diff](B-2_Feedback-Loop_Q1-02-Owned-Diff_2026-10-09-r3-QA-R1.patch). Diagnostics Red/Green and full offline gates cover the correction. Disposition: local correction tested, pending independent QA.

### Q1-03 / FT-QA-2026-083

Read-only r2 recordings show the same oven `steps[1]` assembly text in all three drafts: 300x112 against 302x105, while fitting neighbours changed. This observation supports a local correction-prompt interpretation hypothesis, not proven universal model causality.

Preparation v6 adds only correction-focused guidance: zero-based path/index versus displayed order, measured overflow despite the character limit, reword the diagnosed field rather than fitting neighbours, preserve source actions/parameters/references. No ingredient-omission strategy, canned output, new limit, model change or fourth call.

An offline replay uses the exact recorded draft twice, then an injected complete shorter assembly draft. Both correction payloads preserve original/latest/error identity; the final real probe and independent cooking-core assertions pass. This deterministic test is not a provider-success claim. Existing companion version guards now expect v6.

Evidence: [Q1-03 diff](B-2_Feedback-Loop_Q1-03-Owned-Diff_2026-10-09-r3-QA-R1.patch), [investigation](B-2_Feedback-Loop_Q1-03-Investigation_2026-10-09-r3-QA-R1.json). **NOT RESOLVED**: new live oven text fits, but independent source binding fails; rice and dough also exhaust. Required F failed.

### Q1-04 / FT-QA-2026-084

Test-only pasta rubric correction: cooking/component association and the contradiction suffix cannot cross `und`. The exact recorded separate salted-water cooking followed by sauce mixing sentence is accepted. Cooking pasta in/with sauce, pasta15min, sauce cooked as pasta's component and swapped sauce/pasta durations remain rejected. Flexible grouping remains allowed; source fixture is unchanged.

Evidence: [Q1-04 diff](B-2_Feedback-Loop_Q1-04-Owned-Diff_2026-10-09-r3-QA-R1.patch). Prompt/rubric Red/Green and full offline gates pass; new live pasta independently passes. Historical failure records remain failures. Disposition: local correction tested, pending independent QA.

### Q1-05 / FT-QA-2026-085

Test-only whole-ingredient equivalence is restricted to the exact unchanged full single-stage dough source: source count/order/descriptions must match, and a narrowly anchored whole-set mixing statement must match. Literal ingredient requirements remain for other text/sources; contradictions still run. This is not a general rule that arbitrary `alle Zutaten` text is source-faithful.

Positive exact recorded generic and complete literal formulations pass. Partial omission, `except salt`, invented ingredients, a second mixing stage, another component, missing baking core and wrong time/temperature remain negative. Original preparation and forced initial draft are unchanged.

Evidence: [Q1-05 diff](B-2_Feedback-Loop_Q1-05-Owned-Diff_2026-10-09-r3-QA-R1.patch). Prompt/rubric Red/Green and full offline gates pass. New live dough repeats the overflowing literal field and never reaches independent semantics; no new live equivalence success is claimed. Disposition: local correction tested, pending independent QA.

## Preserved Contracts

Strict provider schema equals the recorded r2 schema. Preparation v6 / Import v16; actual live model `gpt-4o-mini`, API `2024-08-01-preview`, temperature0.2, max_tokens2048, all SDK finish reasons `stop`. Three maximum logical calls, two corrections, 75000ms monotonic aggregate deadline, request `min(20000,remaining)`, maxRetries0 and AbortSignal remain unchanged. Each whole draft is schema/reference-validated and real-font probed. No heuristic truncation, server repair or fabricated fitting result.

Authentication, owner/ETag/source checks, generic HTTP mapping, sourceEtag, V2 and save contracts, internal-reference stripping, quota-once and usage-after-success remain unchanged. The library has no logging/repositories. Parsed exhaustion logs only eligible exact latest affected strings, never arbitrary objects, unknown keys, source/provider input or unaffected content. Existing technical terminal paths remain metadata-only.

No shared/mobile/public API changes; mobile90s and no timeout/5xx POST retry remain unchanged. B-1 probe/template/assets/fonts and dependencies are unchanged. Eight source/import AST comparisons and 13 untouched-contract hash comparisons passed; scoped added-line credential patterns found no matches. Private settings were not read by the review. This is not a claim of exhaustive secret detection.

Evidence: [Prompt/provider/loop contract](B-2_Feedback-Loop_Prompt-Provider-Loop-Contract_2026-10-09-r3-QA-R1.json), [scope review](B-2_Feedback-Loop_Scope-Review_2026-10-09-r3-QA-R1.json).

## Offline Gates

Native commands, outputs, report paths/hashes, start/end times and exits are retained in [Gate summary](B-2_Feedback-Loop_Gate-Summary_2026-10-09-r3-QA-R1.json). These pre-freeze records have `candidateSha256:null`; the frozen candidate identifies their final source bytes. No post-freeze runtime edit or build occurred.

| Gate | Exit | Executed / Passed / Failed / Skipped |
| --- | --- | --- |
| Diagnostics Red | 1 | 5 / 2 / 3 / 166 |
| Diagnostics Green | 0 | 5 / 5 / 0 / 166 |
| Prompt/rubric Red | 1 | 23 / 18 / 5 / 195 |
| Prompt/rubric Green | 0 | 23 / 23 / 0 / 195 |
| Focused initial, retained stale v5 companion assertion | 1 | 519 / 518 / 1 / 0 |
| Focused final, six approved files | 0 | 519 / 519 / 0 / 0 |
| Backend units | 0 | 1600 / 1600 / 0 / 0 |
| Backend typecheck | 0 | Not a test-count gate |
| Build verification, startup/import/duplicate checks and ten assets | 0 | Not a test-count gate |

Touched-source diagnostics: none. No persistence/shared/mobile change required emulator/shared/mobile gates; they were not run or claimed. The focused suite includes validators, both handlers, provider request tests, real-font renderer and bounded loop.

## Frozen F / R / G

Exactly one F was dispatched with the official eval runner and the authorized preparation version/`recipePreparation` filter. Start `2026-10-09T17:02:21.479Z`, end `2026-10-09T17:03:18.702Z`; exit1, executed5 / passed2 / failed3 / skipped9. Passed: preparation version guard and pasta. Import tests remained skipped. Totals: 10 logical / 9 SDK calls; forced dough's initial attempt is synthetic, not an SDK call.

F raw output SHA256: `36f4ffdc97fdd9945ca3d6e1e753df2c052f8f48fa0e12f34a8d3f94724546c7`.
F native report SHA256: `4f6520e1069ab596b1c6b1b36ded2e88c83adecc38423c48e59fdcdd9bd6fbe2`.

| Fixture | Logical / SDK | Final HTTP / steps / fit | Independent semantics |
| --- | --- | --- | --- |
| Rice | 3 / 3 | 422 / 4 / false | NOT_REACHED: FIRST starts 6 before 5; indices1/2 also 300x112 vs302x105 |
| Oven | 3 / 3 | 200 / 4 / true | FAIL: source3 references first group, but cream action moved into source4 group |
| Pasta | 1 / 1 | 200 / 4 / true | PASS, actual post-assertion marker and native passed test |
| Forced dough | 3 / 2 | 422 / 3 / false | NOT_REACHED: literal mixing text repeats at index0, 300x112 vs302x105 |

All four sources remained byte-equivalent in captured state; update/replace/create counts are zero. Usage calls: rice0, oven1, pasta1, dough0. HTTP200/usage/geometry/reference coverage are not semantic acceptance. A later pattern matrix cannot turn NOT_REACHED into PASS.

R and G: **NOT_RUN_REQUIRED_LIVE_FAILURE**, blockedBy F, exit null, zero counts/calls, not dispatched, not verified. STOP was enforced; no additional live calls, retries, candidate edits or repeat-until-green after F.

Evidence: [F record](B-2_Feedback-Loop_F_2026-10-09-r3-QA-R1.json), [raw output](B-2_Feedback-Loop_F-Output_2026-10-09-r3-QA-R1.txt), [native report](B-2_Feedback-Loop_F-Report_2026-10-09-r3-QA-R1.json), [reconciliation](B-2_Feedback-Loop_F-Reconciliation_2026-10-09-r3-QA-R1.json), [R NOT_RUN](B-2_Feedback-Loop_R_2026-10-09-r3-QA-R1.json), [G NOT_RUN](B-2_Feedback-Loop_G_2026-10-09-r3-QA-R1.json).

## Evidence Integrity And Remaining Work

The frozen runner's read-only `reconcile F` exited1 before writing because Vitest quoted/truncated names did not match exact brackets. The first post-freeze reporting parser likewise exited1 before writing because two lines began with ANSI colors. A separate reporting-only tool now verifies unique native-name prefixes and strips colors only for parsing. Raw bytes/hashes, candidate, gates and runtime were never replaced. This reporting completion dispatches zero provider calls and is not a second F.

Original B-2 baseline, original/r2/resume/completion evidence and final 83-artifact historical manifest remain immutable. Q1 report, Q19 history, dirty B-1/B-2/D-1/register/QA files remain untouched. Final preservation/inventory generation verifies all 926 foreign baseline files, 935 frozen files, 338 runtime files, dependency metadata and all 83 old artifacts before recording current hashes. Reporting artifacts use exclusive creation; no failed record is overwritten.

Knowledge Base conflict remains: inherited D-1 describes r2/v5 and treats pasta/dough rubric findings as demonstrated cooking loss. This round does not edit D-1 or retrospectively reclassify failures. A separately authorized D-1 follow-up must describe v6, the corrected rubric scope and the new failed gate accurately. Q19 and other inherited concerns are not closed here.

Next authorized decision is independent QA review of the local corrections and the blocked handoff, not deployment. Any further prompt/loop or live-gate work requires a new authorized candidate/round; this frozen r3 is finished with required F failure. Finite synthetic source rubrics do not establish universal cooking correctness or human Alpha acceptance.