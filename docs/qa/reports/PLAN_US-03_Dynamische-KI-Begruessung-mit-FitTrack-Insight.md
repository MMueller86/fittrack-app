# QA Report: US-03 Dynamic Greeting and FitTrack Insight

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md](../../User%20Stories/startpage/PLAN_US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md)
- Verdict: `FAIL`
- Review: Q-1 final independent review R2 after Backend correction attempt 2, 2026-10-16. This is the sole current verdict. Everything below the Historical R1 boundary is historical evidence, not another current disposition.

## R2 Scope And Result

Read the complete approved plan, original story, current B-1 and F-1 handoffs, prior QA report, read-only central register, relevant KB and both required skills with their full implementation/QA checklists. The approved leading v23 and latest addenda control this review; historical collision/waiting instructions do not revoke that approval. No new domain rule, plan waiver or finding acceptance was assumed. The earlier agent-name invocation failure is not a product finding.

Only this report was manually edited by QA. No implementation, prompt/eval/test/fixture, KB, plan or register edits; no third Backend correction, agent fallback, new paid live reroll, emulator/device setup, remote Cosmos write or deployment. Tests/build generated local outputs only. No secrets/settings copied or printed. Existing and concurrent changes were preserved.

**Mandatory executable gates:** current bound Backend 1942 and Shared 466 units pass; independently executed Backend slice 465 and current Mobile 912 pass. Backend/Shared typechecks and independently rerun build/release guard pass. Current Mobile typecheck now passes, including a non-incremental check. Nevertheless, the complete source-bound live gate is 78 passed / 3 failed, exit 1. Accepted locked advice still reproduces; current historical-target generation and eval time-attribution remain incomplete. These observed defects, not unavailable device tooling, determine the result.

**Emulator-Persistenz: UNVERIFIED / vom User aus Prüfauftrag ausgenommen.** No emulator invocation or substitute remote test. Offline repository/handler coverage is not real SDK roundtrip, partition isolation, native TTL, conditional-write or concurrency proof. Historical setup-only contract execution (0 executed, 15 setup-skipped) remains historical, not a success. This explicitly excluded boundary alone does not block acceptance.

Physical UI/native accessibility checks remain separately **MANUAL VALIDATION REQUIRED**, with no invented UI defect or downgrade merely for unavailable tooling. Plan autoapproval is not acceptance, deferral or closure of FT140/141.

## R2 Candidate And Evidence Binding

- Current runtime, computed bundle, active manifest and eval guard agree: v23 / assembly v7 / `sha256:e25b88c2362f2d276f28342460a35722a93accfb1de23a053449fbf2e74a91db`. Historical v14-v22 remain preserved; v5/v6 identities and results are not rebound to v7.
- Independently enumerated the documented source roots/configuration files and matched all 291 raw-byte rows against both [pre](../../../backend/output/b1-q1-c2-source-pre.json) and [post](../../../backend/output/b1-q1-c2-source-post.json), including a final post-test check. SHA-256 of `JSON.stringify(rows)` is `f468d7068337a4eb7eebc47223424a2660cb5b8a1b9af03b2b85b2ef102eabfe`. This binds validator/eval as well as prompt, but is local evidence, not signed attestation.
- Current validator raw hash: `59d6aa2c79b41ba2e13d2dd4e40620a642f9027b11a5fbfd51d64bd7b63610d5`; eval raw hash: `0abb7a498e20f8b422dd50dfd94c3ed2a07246133f9389a9b6829c448d8b4923`. All 16 report hashes/counts and all seven gate-log hashes in [B-1 evidence](../../../backend/output/b1-q1-c2-evidence.json) matched independently. Evidence raw hash: `1938347c5c5e183fea8e5021c693788079345f7637fe7c1a061505ec3d671a7a`.
- [Gate metadata](../../../backend/output/b1-q1-c2-gates.json) records immediate numeric child exits, not a later pipeline status. Full live ran once `2026-10-16T18:12:04.092Z-18:14:51.723Z`. Full-live report raw hash: `27d7e8df717028bbaa4cc79b7842009c2cccc70a072432a880749cdb42fa727e`.
- Initially all 321 [protected rows](../../../backend/output/b1-q1-c2-protected.json) and all 16 F-1 hash-table rows matched. During review three unrelated Mobile files changed externally (table below). Backend/Shared 291 and all eight F-1 source files remain unchanged. Therefore R2 reran the complete Mobile suite and typecheck rather than treating old F-1 results as current. The apparent old Home render path from one editor read was disproved by raw disk content, unchanged Home hash and all six Home integration tests; no Home regression is established.
- Read and independently replayed the exact 10 originals, 22 R1 artifacts and 22 current artifacts in [replay evidence](../../../backend/output/b1-q1-c2-replay.json), raw hash `248796d66d0e3dea896faedabf18a0f1cb670ef9873c5a0bd4c7a0dc32d4f1a8`. All 54 actual Runtime/helper results match. TypeScript AST comparison also confirms 62 literal response fields across all 10 embedded original cases against their raw artifact payloads. All 22 current outputs bind v7 and finish `stop`; inspected short/full text as well as counters. There were 81 assertions, not 81 Daily provider calls.
- The register remained byte-identical: `b06e2f8d531972cf2a192c8b085452c91af9822f75732deecff0d62c35df87bf`. Prior report hash before this authorized update was `fabdbcd95731a9711a0fe7402315b82aa865b7ad2b3bc97c3f4d0b8884148cda`. The report is the sole intended manual protected-file change.

External Mobile drift observed at `18:24:17Z`, not authored or reverted by QA:

| File | Current raw SHA-256 |
|---|---|
| [ProgressHeroCard test](../../../mobile/src/shared/components/ProgressHeroCard.test.ts) | `54555fa6d5d5132f864996446f70fc5aa9574a0b3f89015b6ccba25c5990b0c3` |
| [WeightChart test](../../../mobile/src/shared/components/WeightChart.test.ts) | `51c49a67db548e95581b241ade7cfa8021b2d556be67451c3eeef1f2b46db2d9` |
| [WeightChart](../../../mobile/src/shared/components/WeightChart.tsx) | `181e1bea9559aeb5a78dc7c5b99372b5f8b3783c3a430adf2e8519038ff65e22` |

## R2 Acceptance Criteria

This is the only current criteria matrix. R1 and earlier tables below are historical observations.

| ID | Current result | Evidence |
|---|---|---|
| AC-1 | PASS | Same single strict provider call supplies neutral name/emoji greeting, one complete short sentence and full response. Focused generator35/validator139/prompt74 cover one-call/no retry, 120/240-unit limits, required fresh pair, decimal/abbreviation handling and Sportler fallback. All 22 current outputs inspected, no observed truncation/time-of-day greeting. Structural success does not establish grounding. |
| AC-2 | FAIL | Current long-name/personal/protein-nearly-complete/phase originals contain accepted locked advice or weight-focus nutrition side topics (FT135). Current midday falsely equates historical1980 with profile-fallback2100 and correctly rejects, but generation still recurs (FT142). Exact old null-budget/weight/completion/arithmetic cases now reject; current bounded corrections FT136-138 and FT139 controls confirmed. See finding outcomes and concrete evidence below. |
| AC-3 | UNVERIFIED | Current Mobile912 includes detail22, hero14, Home6 and layout7. Source/tests cover exact displayed response/date snapshot, no new fetch, full text, CTA routing/dismissal and feedback provenance/retry/races. InfoOverlay wires close/backdrop/onRequestClose. Physical Android Back, backdrop/navigation and sheet transitions remain unexecuted, not claimed complete. |
| AC-4 | PASS | Focused handler47/feedback41/repository81/context21/intent10 plus generator35 cover identity/cache, refresh, quota-before-provider, interval/3-per-day/Admin, valid-success-only usage and midnight expiry. v14 exception remains restricted to active v15-v18, not activev23. Handler/context/repository/Shared remain unchanged in correction2; Home request IDs and no detail/day-selection/field-gap trigger pass current integration tests. Real Cosmos effects are separately excluded. |
| AC-5 | PASS | Current disk [HomeScreen](../../../mobile/src/modules/home/HomeScreen.tsx#L290) passes insight/date/callbacks into hero and has no separate Home InsightCard. All eight F-1 files retain their handoff hashes. Right-hand selector/callback and other Home areas pass current source/mocked regression coverage; no native geometry claim. |
| AC-6 | PASS | Current handler/generator coverage confirms invalid AI returns200 unavailable without write/usage or compact pair, quota returns quota_exceeded without AI, auth401/input400 remain. Atomic fresh/cached client pair guard and current fallback tests cover loading/network/partial/blank/oversize fields with static greeting, no short/link or forced request. No migration/backfill/deletion or special legacy UX introduced. |
| AC-7 | UNVERIFIED | Source/mocks cover responsive wrapping, unchanged theme/SafeArea and 48dp styles, not measured native bounds or TalkBack. Required 320/360dp x font1.0/1.3 with long names,120/240-unit text and Bouldern label remains manual; checklist below. |
| AC-8 | FAIL | Bound full Backend1942/Shared466 and current independently executed Mobile912 pass; typechecks/build/guard pass. Complete live78/3 exit1 remains failed, including Daily48/50 and Weekly special diagnostic2/3. FT141's KB contradictions persist. FT140 is not reproduced current, not silently waived. Excluded emulator and unavailable physical checks are not classified as defects. |

## R2 Commands And Results

All commands use repository-root cwd; npm workspaces determine output-file cwd. B-1 full gates are reused only after independent current source/report/log binding, as authorized; no fresh full live reroll was needed to discriminate the remaining failures. Executed child commands used immediate `spawnSync('cmd.exe',['/d','/s','/c',command]).status` for numeric exits.

| Exact command/action | Exit | Result |
|---|---:|---|
| `npm test --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/b1-q1-c2-backend-units.json --silent` | 0 | Reused complete bound B-1 gate:1942 pass,71 files,0 failed/skipped/todo. |
| `npm test --workspace=@fittrack/shared -- --reporter=dot --reporter=json --outputFile=../backend/output/b1-q1-c2-shared-units.json` | 0 | Reused complete bound B-1 gate:466 pass,10 files,0 failed/skipped/todo. |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | Reused complete bound B-1 gate/log. |
| `npm run typecheck --workspace=@fittrack/shared` | 0 | Reused complete bound B-1 gate/log. |
| `npm run test:eval --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/b1-q1-c2-full-eval.json --silent` | 1 | Reused complete current live:78 pass,3 fail,0 skipped/todo,5 files. Daily48/50; Analyze21/21; Scale3/3; Weekly4/4; Weekly special diagnostic2/3.22 Daily artifacts. |
| `npm test --workspace=@fittrack/backend -- src/functions/dailyInsight.test.ts src/functions/dailyInsightFeedback.test.ts src/lib/openai.daily.test.ts src/lib/dailyInsightContext.test.ts src/lib/dailyInsightIntent.test.ts src/lib/dailyInsightValidation.test.ts src/lib/prompts/dailyInsightPrompt.test.ts src/lib/prompts/dailyInsightPromptManifest.test.ts src/lib/prompts/dailyInsightEvalEvidence.test.ts src/lib/repositories/insightRepository.test.ts --reporter=dot --reporter=json --outputFile=output/q1-us03-r2-focused.json --silent` | 0 | Independently executed465 pass,10 files,0 failed/skipped/todo; `18:24:04.501Z-18:24:22.736Z`. |
| `npm run test:eval --workspace=@fittrack/backend -- src/lib/prompts/dailyInsight.eval.test.ts --testNamePattern=compact-output.*rubric --reporter=dot --reporter=json --outputFile=output/q1-us03-r2-rubric.json --silent` | 0 | Independently executed provider-free helper27 pass,23 selection-skipped,0 failed/todo; `18:24:24.708Z-18:24:25.179Z`. Not a complete live gate and no provider calls. |
| `npm test --workspace=@fittrack/mobile -- --reporter=dot --reporter=json --outputFile=../output/q1-us03-r2-mobile-units.json --silent` | 0 | Independently executed after external drift:912 pass,89 files,0 failed/skipped/todo; `18:25:24.011Z-18:25:27.609Z`. |
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | Independently executed on current externally changed Mobile sources. Historical two-error result does not describe this candidate. |
| `npm exec --workspace=@fittrack/mobile -- tsc --noEmit --incremental false` | 0 | Independently executed non-incremental confirmation of current Mobile type gate. |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | Independently rerun:compile,10 asset copies,module resolution/duplicate IDs pass. Functions test-mode registration warnings are not skipped Vitest tests or deploy proof. |
| `npm run verify:daily-insight-prompt --workspace=@fittrack/backend` | 0 | Independently rerun:7 script +4 manifest tests, actual computed v23/v7 identity matches. |
| `@'<read-only binding/Runtime/helper/AST assertions described below>'@ \| node -` | 0 | Independent source291/report16/log7/F-1 binding,54 actual original replays,4 FT139 controls,62 embedded literal comparisons and isolated FT143 probe completed. No source file or provider call. |
| Initial FT139 supplemental in-memory probe | 1 | QA probe's PowerShell stdin encoding changed umlauts and triggered compact-sentence validation. Repeated same offline probe with Unicode escapes, then all54+4 assertions passed. Not a product defect or reroll. |
| `test:contract`, physical devices, emulator/install/deploy/remote Cosmos, new complete live | N/A | NOT RUN. Excluded/manual checks are separated below, never recorded as passes. |

The read-only Node method registers a TypeScript `transpileModule` loader, loads the real fixture/prompt/validator from disk, and compiles the actual eval helper declarations in memory at their original module path. It parses artifact content, calls `validateDailyInsightResponse` with unchanged fixture input/intent and calls the actual `getInsightPolicyViolations` using the real `.join('. ')` field assembly. Assertions compare exact rejection strings and violation arrays with all replay rows. No duplicated validator/helper implementation or synthetic pass counter. AST literal comparisons additionally bind embedded regressions to original payload bytes. The helper delegates to Runtime guards, so two green results are not two independent semantic oracles.

| Independent R2 report | Raw-byte SHA-256 |
|---|---|
| [Focused465](../../../backend/output/q1-us03-r2-focused.json) | `e8ec0f4876b7572239a95e01127026a33b9701c0de3ebaeeb92ce809604eb85b` |
| [Local rubric27](../../../backend/output/q1-us03-r2-rubric.json) | `fa1b05a6efbfd3093c2d6e2a84688cc7d4680edbc569454c28427cc9506de5f9` |
| [Current Mobile912](../../../output/q1-us03-r2-mobile-units.json) | `5a91ad04ffe7d44e64bdd86853ef5a4de91e01f2531d1656d2ddcc84796fda45` |

The complete live failures are: target-relative-overage generation recommends extra protein at gap15 (Runtime rejects); midday-empty falsely describes historical1980 as matching a profile-fallback target (Runtime rejects); Weekly `special-activity-under-effective-target` has actual diagnostic status UNVERIFIED instead of expected CORRECT at [diagnostic assertion](../../../backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts#L80). The last is an executed failed gate, not proof of a new Weekly product bug or an excuse to change that unrelated implementation. Its underlying cause is not established here. No complete-live success is claimed, even though safe Runtime rejection prevents persistence for the two Daily failures. Investigate the existing diagnostic evidence before any separately authorized live rerun.

## R2 Finding Outcomes

These are review observations, not central-register edits or user acceptance/deferral/closure decisions. FT139's existing closed register state is not reopened. No new product defect beyond the stable keys below was independently established.

| Register / stable key | Current R2 observation |
|---|---|
| FT-QA-2026-135 / Q1-US03-01 | NOT CORRECTED overall. Old exact meal-action originals now reject, but new long-name/personal/protein-nearly-complete generic eating/planning advice and phase nutrition side topic still pass Runtime/helper. Blocking residual. |
| FT-QA-2026-136 / Q1-US03-02 | CORRECTION CONFIRMED within reported cases/current sample. Exact null-budget/stable-weight original rejects. Current midday correctly describes80 below80.2; carbs-below no longer calls those measurements stable. Other current failures are separately attributed, not evidence this same old defect persists. No universal reliability claim. |
| FT-QA-2026-137 / Q1-US03-03 | CORRECTION CONFIRMED within reported cases/current sample. Exact historical performed/participated originals reject; provider projection marks history registrationOnly/unknown. Current priority has no performed-hike assertion; current likely/intensive/unknown/planned samples pass without the reported unsupported completion. No blanket future guarantee. |
| FT-QA-2026-138 / Q1-US03-04 | CORRECTION CONFIRMED for the reported inconsistent-budget case. Both exact arithmetic originals reject; unchanged1500/2000/-120 fixture is projected as budget uncertainty only, and current output has no budget numbers/overage/protein/advice. This does not establish consistency for every other fixture or arbitrary arithmetic. |
| FT-QA-2026-139 / Q1-US03-05 | CORRECTION RETAINED. Exact3500 target/1500 intake/2000 remainder compound and sentence-separated controls pass Runtime/helper; both swapped controls reject. Current unknown-activity also passes. Existing independently confirmed closure preserved, no new QA closure action. |
| FT-QA-2026-140 / Q1-US03-06 | Historical blocker NOT REPRODUCED current: Mobile typecheck0, non-incremental0, full Mobile912 pass after external changes to the three listed files. This is a factual gate update, not QA-authored repair or silent acceptance/deferral. Register still says Awaiting decision; Orchestrator/user owns verification/status decision for that external change. |
| FT-QA-2026-141 / Q1-US03-07 | NOT CORRECTED. Three known KB statements remain inconsistent with implemented F-1/currentv23. Non-blocking finding, Awaiting decision retained; no implicit acceptance or deferral. |
| FT-QA-2026-142 / Q1-US03-R1-08 | NOT FULLY CORRECTED. Exact R1 personal1980=2100/profile_fallback now rejects Runtime/helper; current personal avoids that equality. But current midday repeats `1980 ... was deinem Ziel entspricht`; Runtime correctly rejects, so accepted-content hole is repaired for these examples while provider-generation/full-gate completion remains missing. |
| FT-QA-2026-143 / Q1-US03-R1-09 | NOT FULLY CORRECTED. Exact R1 empty-morning yesterday-positive now passes; four fabricated-current negative regressions remain protected. Current midday `heute ... unbekannt, aber in den letzten Tagen ...1980` is still falsely flagged as numeric current intake. Isolated truthful historical sentence passes Runtime content validation but triggers that helper error, proving residual temporal false positive separately from FT142. |

### Q1-US03-01 / FT135

- Finding key: `Q1-US03-01` (existing FT-QA-2026-135).
- Plan reference: approved US-03 plan linked above.
- Acceptance criterion: AC-2, AC-8.
- Description: active mealAdviceAllowed=false/gap20 still accepts `kannst noch 500 Kalorien essen` in long-name full text. Personal says `deine Nahrungsaufnahme gut planst`; gap10 protein-nearly-complete says `die verbleibenden Kalorien sinnvoll nutzt`. Phase weight-only says `weiterhin auf deine Ernährung und Aktivität zu achten`. Null action fields do not make these narrative actions/side topics permissible. Earlier plural meal matching was corrected but this finding was not eliminated.
- Criticality: Blocking.
- Owner: Backend.
- Evidence: [long-name original](../../../backend/output/daily-insight-v23-long-name-neutral-greeting-2026-10-16T18-13-50-822Z.json), raw hash `6213848e4c488e1cab1cf2849af952ef8c4c4154e992dd669ba82f2392717d5f`; [personal](../../../backend/output/daily-insight-v23-personal-neutral-greeting-2026-10-16T18-13-48-411Z.json); [protein-nearly-complete](../../../backend/output/daily-insight-v23-protein-nearly-complete-2026-10-16T18-14-21-836Z.json); [phase](../../../backend/output/daily-insight-v23-phase-progress-open-day-2026-10-16T18-13-55-860Z.json). All four Runtime rejection=null/helper=[] in independent actual replay. [Meal matcher](../../../backend/src/lib/dailyInsightValidation.ts#L85), [protein guard](../../../backend/src/lib/dailyInsightValidation.ts#L470), [weight side-topic guard](../../../backend/src/lib/dailyInsightValidation.ts#L618), [explicit prompt grounding](../../../backend/src/lib/prompts/dailyInsightPrompt.ts#L46).
- Recommendation: user/Orchestrator must decide further disposition; no third automatic correction. A separately authorized fix should cover these exact accepted originals and preserve approved locks/focus/thresholds, not relax fixtures or count safe-looking null actions as sufficient.

### Q1-US03-R1-08 / FT142

- Finding key: `Q1-US03-R1-08` (existing FT-QA-2026-142).
- Plan reference: approved US-03 plan linked above.
- Acceptance criterion: AC-2, AC-8.
- Description: original acceptance gap is now guarded, but current provider generation again equates historical1980 intake with a historical target that is only profile_fallback2100. This current output fails instead of being persisted; it is not a continuing acceptance of the exact R1 payload. The required current generation/live gate remains red.
- Criticality: Blocking.
- Owner: Backend.
- Evidence: [current midday original](../../../backend/output/daily-insight-v23-midday-empty-day-not-morning-2026-10-16T18-14-32-564Z.json), raw hash `6705d6c6cd80c694c6ecd9b3d07924216903d702e9f13f0f9b30d862423bc470`; actual Runtime `Daily insight presents a read-only profile fallback as a historical target` at [guard](../../../backend/src/lib/dailyInsightValidation.ts#L328). Full-live exit1 and exact54 replay confirm both old-original protection and new recurrence. Context still has last3Days1980/profile_fallback2100; current personal no longer makes this claim.
- Recommendation: retain exact historical provenance/equality negatives. Any separately authorized work must address generation as well as preserve the corrected Runtime guard, and establish the required complete gate rather than rerolling only a favorable sample. No further Backend loop initiated by QA.

### Q1-US03-R1-09 / FT143

- Finding key: `Q1-US03-R1-09` (existing FT-QA-2026-143).
- Plan reference: approved US-03 plan linked above.
- Acceptance criterion: AC-8 (trustworthy grounding verification for AC-2).
- Description: explicit yesterday segmentation is fixed, but `in den letzten Tagen` is absent from temporal boundaries. A truthful mixed sentence with today's intake unknown and1980 explicitly attributed to recent days still produces `claims a numeric current nutrition value without logged current intake`. The real midday also independently violates FT142; that true defect must not conceal this separate false-positive reason.
- Criticality: Blocking.
- Owner: Backend.
- Evidence: current midday artifact above; [number matcher](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L24) and [segmentation](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L73). Provider-free isolated exact clause `Deine Kalorienaufnahme für heute ist noch unbekannt, aber in den letzten Tagen hast du jeweils 1980 Kalorien konsumiert.` passes actual `validateDailyInsightContentSemantics` with unchanged midday fixture/intent and fails actual helper only for the numeric-current message. Exact R1 empty-morning now passes both; current local rubric27 passes,23 live selections skipped, so those green units do not disprove the residual.
- Recommendation: separately authorized helper correction should add this positive historical attribution while retaining the four fabricated-current negatives. QA does not modify evals or weaken grounding assertions.

### Q1-US03-07 / FT141

- Finding key: `Q1-US03-07` (existing FT-QA-2026-141).
- Plan reference: approved US-03 plan linked above.
- Acceptance criterion: AC-8 documentation consistency.
- Description: known KB drift is unchanged: implemented Home fallback is still marked Planned F-1 in two places and newly generated Daily responses are still described as currentv20 rather thanv23.
- Criticality: Non-blocking.
- Owner: Documentation.
- Evidence: [API fallback](../../kb/tech/09-api-reference.md#L944), [domain fallback](../../kb/domain/07-ai-features.md#L759), [API promptVersion](../../kb/tech/09-api-reference.md#L1130), current source/F-1 binding and active manifest v23/v7. Original awaiting-decision register entry remains unchanged.
- Recommendation: explicit user/Orchestrator decision to correct or otherwise disposition the known drift. No silent KB repair, acceptance or deferral; plan autoapproval does not make that decision.

FT140 has no currently reproduced actionable type defect after external source changes, so R2 does not invent a new blocking finding or rewrite its old evidence. The historical R1 finding below remains historical. Orchestrator must reconcile the observed correction and pending register status explicitly.

## R2 Manual And Excluded Checks

These are verification limitations, not finding criticalities. No physical observation is inferred from React test-renderer or source styles. No extra legacy product matrix is added.

| Check | Prerequisites | Steps | Expected result | Result |
|---|---|---|---|---|
| Native size matrix | Existing Android build/device, no new setup authorized in this review | At320dp/font1.0,320dp/font1.3,360dp/font1.0,360dp/font1.3 display long name, maximum120/240-unit copy and long Bouldern selector label; capture native screenshots/bounds | Complete greeting/short copy, no clipping, overlap, unintended scroll or truncation; selector right and usable; theme/SafeArea consistent | UNVERIFIED; manual result pending |
| Detail and navigation | Same device, available response and observable request count | Open Mehr lesen, refresh while detail open, close via button/backdrop/Android Back; exercise Nutrition/Weight CTA and re-open | Same displayed full-response snapshot/date, no detail request, correct dismiss-before-navigation and unchanged targets | MANUAL VALIDATION REQUIRED |
| Feedback | Same device and test identity with feedback-capable response | Open from that detail, submit negative feedback, exercise error/retry and overlap with newer Home response | Original displayed provenance retained, one stable submission ID on retry, correct sheet transition and success state | MANUAL VALIDATION REQUIRED |
| TalkBack/theme/SafeArea | Existing Android/TalkBack and supported theme settings | Traverse hero/selector/read-more/detail/feedback, change text scale, inspect touch bounds/insets | Logical focus/labels, reachable dismissals, at least48dp touch targets, no inset/content collision | UNVERIFIED; manual result pending |
| Emulator persistence | Explicitly excluded by user; do not start/install or use remote Cosmos | No execution in R2; any later task must be separately authorized | Actual compact-field roundtrip, legacy compatibility, partition isolation, TTL/conditional-write/concurrency verified by real emulator SDK, not mocks | UNVERIFIED / vom User aus Prüfauftrag ausgenommen |

## R2 Handoff

Required remaining decisions: explicit user/Orchestrator direction for residual FT135/142/143 after correction budget exhaustion; reconcile FT140's current green external change without silently accepting its pending register entry; decide FT141 documentation disposition; obtain the separate native evidence when available. Complete live remains failed, including the unresolved Weekly diagnostic; no gate waiver or deployment approval is inferred. QA neither initiates a third correction nor edits the central register.

---

## Historical R1 And Earlier Evidence

Everything below this boundary is preserved historical R1/first-review evidence. Its old Current headings, candidate hashes, failure counts, type errors and criteria tables describe those earlier candidates only. They do not override R2, imply current defects already disproved by R2, or supply another current verdict.

- Historical review: Q-1 independent re-review R1 after Backend correction attempt 1, 2026-10-16; disposition at that time was unsuccessful. v23 / assembly v6.

## Current Scope

Read the complete approved plan and original story, the complete newest B-1 correction-attempt section, unchanged F-1 handoff, central register read-only, relevant KB and both required skills including their full QA checklists. The latest approved addenda and user-confirmed leading v23 take precedence over historical waiting/identity instructions. No new product rule, acceptance waiver or technical plan deviation was established. Active v23 now has assembly v6; the older v5 evidence below is historical only.

QA changed only this report manually. No implementation, test, eval, fixture, KB, plan or register correction; no device/emulator/install/deploy/remote Cosmos work, new dependency, extra product call or paid live reroll. Commands generated only local test/build output. No secrets/settings were printed or copied. Existing unrelated worktree changes remain untouched. Findings 140/141 predate this correction and still await the user's decision; plan autoapproval is not a finding decision.

**Remaining mandatory gates:** current source-bound Backend 1925, Shared 466 and unchanged Mobile 912 units pass. Backend/Shared typechecks, build and release guard pass. Complete current live evidence is 68 passed / 8 failed, numeric exit 1, without reroll. Mobile typecheck still fails on the two pre-existing errors. Independent replay confirms accepted unsafe content despite green fixtures. These real defects preclude Story acceptance. Physical UI checks remain separately UNVERIFIED, not actionable defects inferred from unavailable tooling.

**Emulator-Persistenz: UNVERIFIED / vom User aus Pruefauftrag ausgenommen.** No real Cosmos roundtrip/partition/conditional-write/TTL proof; this excluded boundary alone is not a blocker. No substitute remote test.

## Current Candidate Binding

- Runtime v23 / assembly v6, active manifest and `TESTED_PROMPT_VERSION` agree. Independently loaded the current prompt and manifest, compared the computed bundle fingerprint and reran the release guard: `sha256:41167bc280fab7a131763f47b5a830b3f236ad70d4179c2c4ea2515befd80f75`. Historical v14-v22 entries are preserved. No v5 fingerprint/result is rebound to v6.
- Independently enumerated the documented source roots/configuration files and verified exactly 291 entries against both [source pre](../../../backend/output/b1-q1-c1-source-pre.json) and [source post](../../../backend/output/b1-q1-c1-source-post.json). Pre/post rows equal current raw bytes; aggregate SHA-256 of `JSON.stringify(rows)` is `fef8279252295d42bdc775f4fad3f4644f39af9ba3c3c9f1767a53cef454a2cf`. Rechecked after executable checks. This is local byte binding, not a signed attestation or commit.
- Validator raw SHA-256: `08e2c904fab62105dca0d243165da0b3ac36194e4cdeb0a309a9ff7847dddce4`; eval raw SHA-256: `770ef4b39f0f0bee34927ad452de59659cd526b5f202b7934e59bab46baad6cb`. Provider fingerprint alone would not bind this validator; the 291-file capture does.
- Independently verified all 19 report hashes/counts and seven gate-log hashes in [current evidence](../../../backend/output/b1-q1-c1-evidence.json), SHA-256 `80f219fb7abd2e7a7cffd085a67ea2cec3f53b9c13e2cb13a37bf5e9c0ce940c`. [Gate metadata](../../../backend/output/b1-q1-c1-gates.json) records numeric process status immediately, not a later PowerShell pipeline exit. Full-live process window: `17:47:46.529Z-17:50:29.055Z`, 2026-10-16.
- All 280 [protected rows](../../../backend/output/b1-q1-c1-protected.json), including fixture, Mobile sources, register and previous report, matched before this report update. All 16 F-1 source/report/artifact hashes also match. The report hash will intentionally change with this update; the register is not edited. Unchanged Mobile evidence is reused, not relabeled as newly executed.
- Independently parsed and replayed all eight [exact originals](../../../backend/output/b1-q1-c1-original-replay.json) and all 22 current Daily artifacts listed in the current evidence against the actual validator and unchanged fixture/intent. All eight originals reject with the documented errors. All current artifacts bind v23/v6 and finish `stop`; no truncation was observed. Runtime/helper outcomes match the handoff when the actual eval `.join('. ')` field separation is used. The helper now reuses Runtime content guards and is not an independent semantic oracle.

## Acceptance Criteria

| ID | Current result | Current evidence |
|---|---|---|
| AC-1 | PASS | Same single Strict call produces greeting, short sentence and full text; schema/name/emoji/120-240-unit/sentence/abbreviation/decimal and one-call generator regressions pass in the independently executed 448-test slice. All 22 new outputs inspected; no time-of-day greeting or observed truncation. Client displays unchanged server fields. Structural success is not grounding approval. [Generator tests](../../../backend/src/lib/openai.daily.test.ts), [validator tests](../../../backend/src/lib/dailyInsightValidation.test.ts), unchanged F-1 source binding. |
| AC-2 | FAIL | Exact old failures are now rejected, but current long-name meal planning under gap20 and personal historical equality/provenance pass Runtime and helper. Current budget, midday weight and historical-completion generation defects recur and safely reject. FT135-138 remain incomplete; new R1-08 is an accepted-content gap. FT139's attribution correction is independently confirmed. See current findings and current artifact table. |
| AC-3 | UNVERIFIED | Unchanged source-bound 912 Mobile suite and first-review inspection cover exact response/date snapshot, no detail request, full text, CTAs, callback dismissals and feedback provenance/retry/races. Physical Back/backdrop/navigation and sheet transition remain unexecuted. [F-1 handoff](../../User%20Stories/startpage/F-1_US-03_Frontend_Handoff_2026-10-16.md); retained manual checklist below. |
| AC-4 | PASS | Current focused 448 includes handler47, feedback41, repository81, context21, intent10, generator33, validator133, prompt65, manifest4 and evidence13. No modified handler/repository/context semantics or Shared contract in attempt1. Ordinary identity invalidation, v14 exception only for active v15-v18, interval/3-per-day/Admin, quota-before-AI, valid-success-only usage and local-midnight TTL remain covered. Unchanged Mobile request-ID/focus/refresh and no detail/day-selection/field-gap request evidence reused. Real Cosmos effects are excluded separately. |
| AC-5 | PASS | Unchanged protected Home/hero source and first-review 912-suite evidence retain combined card, right-hand selector/callback and removal of separate Home InsightCard. Other Home areas unchanged by correction1. Native geometry is not inferred. [HomeScreen](../../../mobile/src/modules/home/HomeScreen.tsx), [hero](../../../mobile/src/modules/home/CoachingHeroCard.tsx). |
| AC-6 | PASS | Current handler/generator tests retain 200 unavailable without pair/write/usage after invalid generation, quota_exceeded without AI, 401/400 boundaries. Unchanged atomic fresh/cached pair guard and Mobile fallback evidence cover loading/errors/partial/blank/oversize fields without link or forced generation. No legacy UX, migration/backfill/deletion or new trigger. [Display guard](../../../mobile/src/services/insightService.ts), current focused report. |
| AC-7 | UNVERIFIED | No device work authorized/performed. Unchanged source/mocked coverage shows theme/Safe Area reuse, wrapping without forced line truncation and 48-dp style constraints, not measured native bounds/TalkBack. Required 320/360 dp x font1.0/1.3 and native interaction checklist below remains unexecuted; no new actionable UI defect inferred. |
| AC-8 | FAIL | Current bound 1925 Backend/466 Shared/912 Mobile units; Backend/Shared typechecks, independently rerun build/guard and focused checks pass. Full current live 68/8 exit1; Mobile typecheck exit2 with unchanged existing errors. FT141's three old KB contradictions intentionally remain pending decision. New semantic/rubric defects are not hidden by green counters. Excluded emulator remains UNVERIFIED, never PASS. |

## Current Tests

All commands below run from repository root; output paths follow npm workspace working directories. B-1 full gates are reused only after independent source/report/log binding. No new full live invocation was dispatched: the existing complete failed gate plus deterministic replays are discriminating evidence, and another paid sample is unnecessary.

| Exact command / action | Numeric exit | Result and provenance |
|---|---:|---|
| `npm test --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/b1-q1-c1-backend-units.json --silent` | 0 | Reused source-bound complete B-1 gate: 1925 pass,71 files,0 failed/skipped/todo. |
| `npm test --workspace=@fittrack/shared -- --reporter=dot --reporter=json --outputFile=../backend/output/b1-q1-c1-shared-units.json` | 0 | Reused source-bound B-1 gate:466 pass,10 files,0 failed/skipped/todo. |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | Reused B-1 complete gate/log, current sources unchanged. |
| `npm run typecheck --workspace=@fittrack/shared` | 0 | Reused B-1 complete gate/log, current sources unchanged. |
| `npm run test:eval --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/b1-q1-c1-full-eval.json --silent` | 1 | Reused complete B-1 live gate:68 pass/8 fail/0 skipped/todo,5 files; Daily37/45, other suites31/31;22 Daily provider artifacts, not76 calls. Hash `1174ad410b244d13ecefadc62c6971a3039284951e9a4fc80c79d092ba0c32d0`. |
| `npm test --workspace=@fittrack/mobile -- --reporter=dot --reporter=json --outputFile=../output/q1-us03-mobile-units-2026-10-16.json --silent` | 0 | Reused independent first-review complete gate:912 pass,89 files,0 failed/skipped/todo; all protected Mobile source bytes and original report hash still match. |
| `npm test --workspace=@fittrack/backend -- src/functions/dailyInsight.test.ts src/functions/dailyInsightFeedback.test.ts src/lib/openai.daily.test.ts src/lib/dailyInsightContext.test.ts src/lib/dailyInsightIntent.test.ts src/lib/dailyInsightValidation.test.ts src/lib/prompts/dailyInsightPrompt.test.ts src/lib/prompts/dailyInsightPromptManifest.test.ts src/lib/prompts/dailyInsightEvalEvidence.test.ts src/lib/repositories/insightRepository.test.ts --reporter=dot --reporter=json --outputFile=output/q1-us03-r1-focused.json --silent` | 0 | Independently executed:448 pass,10 files,0 failed/skipped/todo; start17:57:29.202Z. Includes eight mocked original-provider regressions, one call/no retry and unchanged context. |
| `npm run test:eval --workspace=@fittrack/backend -- src/lib/prompts/dailyInsight.eval.test.ts --testNamePattern="compact-output rubric" --reporter=dot --reporter=json --outputFile=output/q1-us03-r1-rubric.json --silent` | 0 | QA argument/filter error:0 executed,45 selection-skipped. Not a passing rubric or full live gate; no provider calls. |
| `npm run test:eval --workspace=@fittrack/backend -- src/lib/prompts/dailyInsight.eval.test.ts --testNamePattern=compact-output.*rubric --reporter=dot --reporter=json --outputFile=output/q1-us03-r1-rubric-final.json --silent` | 0 | Corrected provider-free selection:22 pass,23 selection-skipped; start17:58:02.619Z. Not full live coverage; no source change or provider reroll. |
| `npm run verify:daily-insight-prompt --workspace=@fittrack/backend` | 0 | Independently rerun:7 script +4 manifest tests; actual computed v23/v6 fingerprint matches. |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | Independently rerun:compile,10 renderer assets,module resolution/duplicate IDs pass. Functions test-mode warnings are not test skips or deploy proof. |
| `npm run typecheck --workspace=@fittrack/mobile` | 2 | Independently reproduced only TS2345 at ProgressHeroCard.test.ts456:41 and TS2339 at WeightChart.test.ts116:19; same pre-existing FT140 errors. |
| `@'<read-only Node binding/replay assertions>'@ \| node -` | 0 | Independently verified enumeration291/pre-post/current bytes,protected280,F-1 rows16,reports19,logs7,originals8,new outputs22,computed prompt/manifest and FT139 compound/separated/swapped controls. Method below; no provider calls. |
| Initial read-only Node replay | 1 | QA probe used spaces instead of actual eval field separators and mismatched one additional helper error. Corrected to `.join('. ')` after reading actual call site; all replay assertions then pass. Not a product failure or evidence drift. |
| Independent final enumeration/hash/report inspection | 0 | Exact291 current source files and all current report counts/hashes reconfirmed after build. |
| `test:contract`, devices, installs, deploy, remote Cosmos, new full live | N/A | NOT RUN, not fabricated successes. |

Self-executed shell child statuses were captured immediately using Node `spawnSync('cmd.exe',['/d','/s','/c',command]).status`, including Mobile2 and the all-skipped filter0. No green shell exit is interpreted as semantic coverage.

| Current independent report | Raw-byte SHA-256 |
|---|---|
| [Focused448](../../../backend/output/q1-us03-r1-focused.json) | `9a358c6d7094647514ef7a9e488479a47e3f13e880ec465825308f59d1a29508` |
| [Corrected rubric22](../../../backend/output/q1-us03-r1-rubric-final.json) | `b96f788d11bf0b480cd37ed0c80250c50abc9ec01c0106534d7b8e1eaa9af63d` |
| [Unchanged first-review Mobile912](../../../output/q1-us03-mobile-units-2026-10-16.json) | `94f2058a47033d9574b6e36ce27fe08766825ff9c17d37fd9ccb96a928a90b8e` |

## Current Finding Outcomes

Stable register mapping is retained. Verification of a correction is not a register closure or user acceptance decision.

| Register / stable key | Independent R1 outcome |
|---|---|
| FT-QA-2026-135 / Q1-US03-01 | NOT FULLY CORRECTED. Both exact originals now reject; current phase is weight-only and stale-weight nutrition rejects. New long-name original still accepts meal-planning advice under gap20 in Runtime/helper; Blocking. |
| FT-QA-2026-136 / Q1-US03-02 | NOT FULLY CORRECTED. Exact old null-budget/weight original rejects; new midday and carbohydrate-below stable-weight contradictions also reject. No repeat of current-space claim in new midday output; generation and full gate remain red, not an ongoing acceptance of that old payload. |
| FT-QA-2026-137 / Q1-US03-03 | NOT FULLY CORRECTED. Both exact completion originals reject; current intensive/likely/planned/unknown cases pass without those exact defects. New historical performed-hike assertion recurs and rejects. No unsupported claim that the old acceptance hole still reproduces. |
| FT-QA-2026-138 / Q1-US03-04 | NOT CORRECTED. Both old arithmetic outputs and the new unchanged-fixture contradiction reject correctly; generation still fails. No unsafe persisted output is inferred. |
| FT-QA-2026-139 / Q1-US03-05 | CORRECTION CONFIRMED for the reported numeric-clause defect. Neutral compound and sentence-separated exact3500/1500/2000 controls pass Runtime/helper; swapped remainder rejects both. Original unknown output rejects for separate planning language, not correct calorie attribution; new unknown output passes. No register closure performed. |
| FT-QA-2026-140 / Q1-US03-06 | Unchanged, pre-existing, Awaiting decision; independently reproduced Mobile exit2. Not introduced by this correction or F-1. |
| FT-QA-2026-141 / Q1-US03-07 | Unchanged, pre-existing, Non-blocking, Awaiting decision. Three KB statements deliberately not corrected; no implied acceptance/deferral. |

### FT135 / Q1-US03-01 Current Residual

- Finding key: `Q1-US03-01` (FT-QA-2026-135, retained).
- Plan reference: approved US-03 plan above; AC-2, AC-8.
- Acceptance criterion: AC-2, AC-8.
- Description: current long-name output says `Achte darauf, deine nächsten Mahlzeiten entsprechend zu planen, um deine Ziele zu unterstützen.` after discussing protein under the range and remaining calories. At authoritative gap20/nutrition_guidance this is forbidden meal advice, even with null action fields. Both Runtime and helper accept; formal live case passes. The singular/imperative meal matcher misses adjective/plural wording. This is residual FT135, not a duplicate new finding.
- Severity: High. Criticality: Blocking. Owner: Backend.
- Evidence: [long-name current original](../../../backend/output/daily-insight-v23-long-name-neutral-greeting-2026-10-16T17-49-24-430Z.json), SHA-256 `112c82075d7d95736f81a34291459b6ef53cb1eb18397e9c94d8dfd5abb76c76`; [meal matcher](../../../backend/src/lib/dailyInsightValidation.ts#L85), [nutrition lock](../../../backend/src/lib/prompts/promptNutrition.ts#L19).
- Repro: parse artifact.content, find unchanged long-name fixture, invoke actual `validateDailyInsightResponse(output,input,intent)`; returns. Invoke actual helper using live field order/separation; returns `[]`. Compare complete summary and gap20, not only short/null CTA fields.
- Recommendation: Backend should correct this bounded generation/recognition gap and add the exact accepted plural/adjective original as a regression without weakening thresholds, null fields or fixtures.

### FT136 / Q1-US03-02 Current Residual

- Finding key: `Q1-US03-02` (FT-QA-2026-136, retained).
- Plan reference: approved US-03 plan above.
- Acceptance criterion: AC-2, AC-8.
- Description: current midday still calls weight stable despite80 versus80.2 and losing trend. Runtime correctly rejects now; the original accepted null-budget hole is corrected for its exact replay, but successful grounded generation is not established. Carbohydrates-below also generates contradictory stability.
- Severity: High. Criticality: Blocking. Owner: Backend.
- Evidence: [current midday](../../../backend/output/daily-insight-v23-midday-empty-day-not-morning-2026-10-16T17-50-12-623Z.json), SHA-256 `66d1716970a37da6c34dadd171357c045e42d09f823b9efd26a30a11f1374576`; full-live failures and exact replay in current evidence.
- Repro: replay with original fixture; throws `Daily insight weight stability contradicts the supplied weight signals`. New output has no repeated meal-space claim; do not invent one.
- Recommendation: correct weight-faithful generation and demonstrate unchanged fixture/full gate; retain correct rejection and unknown-current-budget controls.

### FT137 / Q1-US03-03 Current Residual

- Finding key: `Q1-US03-03` (FT-QA-2026-137, retained).
- Plan reference: approved US-03 plan above.
- Acceptance criterion: AC-2, AC-8.
- Description: new historical-target-source-priority summary again says the hike was `durchgeführt`, which is not proved by stored registration. Runtime now rejects; this fixes the exact accepted originals, not reliable generation.
- Severity: High. Criticality: Blocking. Owner: Backend.
- Evidence: [current historical activity original](../../../backend/output/daily-insight-v23-historical-target-source-priority-2026-10-16T17-49-34-964Z.json), SHA-256 `fdf4dd3df07417732eedb17fea5adaaf8fedd3db0bf792b6b093bad936ed267d`; original/provider regressions pass in focused448.
- Repro: replay exact fixture/intent; throws `Daily insight treats a planned or unknown activity as completed`. Current likely/intensive controls pass; an unrelated qualifier no longer authorizes a separate definitive claim.
- Recommendation: correct the remaining historical generation defect while retaining claim-local uncertainty rejection and positive controls; rerun required gates after owner correction.

### FT138 / Q1-US03-04 Current Residual

- Finding key: `Q1-US03-04` (FT-QA-2026-138, retained).
- Plan reference: approved US-03 plan above, unchanged budget-lock scope.
- Acceptance criterion: AC-2, AC-8.
- Description: new title/short/full output again claims overage from intake1500,target2000,remainder-120 despite explicit inconsistency guidance. Correct rejection prevents persistence/usage, but required generation/full live fails.
- Severity: Medium. Criticality: Blocking. Owner: Backend.
- Evidence: [current budget original](../../../backend/output/daily-insight-v23-budget-lock-2026-10-16T17-49-54-628Z.json), SHA-256 `17f374b9caa18facf5400ea7f8e884d8f7884e32ed05ab15b3efae059ed4acd0`; current full report/live exit1.
- Repro: replay unchanged budget-lock fixture; throws `Daily insight calorie budget contains inconsistent current calorie values`. Null actions remain. This fixture is not ordinary production remainder calculation.
- Recommendation: correct bounded uncertainty generation, not fixture arithmetic/Runtime safety; no retries or pass-seeking reroll.

### FT140 / Q1-US03-06 Existing Type Gate

- Finding key: `Q1-US03-06` (FT-QA-2026-140, retained).
- Plan reference: approved US-03 plan above.
- Acceptance criterion: AC-8.
- Description: required Mobile typecheck remains red on the same two existing unrelated test errors; not newly caused by US-03/F-1/attempt1.
- Severity: Medium. Criticality: Blocking. Owner: Frontend.
- Evidence: independently executed `npm run typecheck --workspace=@fittrack/mobile`, exit2: [ProgressHeroCard.test.ts](../../../mobile/src/shared/components/ProgressHeroCard.test.ts#L456) TS2345 unknown-to-string; [WeightChart.test.ts](../../../mobile/src/shared/components/WeightChart.test.ts#L116) TS2339 children missing on local ReactTestInstance.
- Repro: run that command; exactly these two diagnostics remain.
- Recommendation: user decision and authorized Frontend handling remain with Orchestrator; QA neither fixes nor waives this gate.

### FT141 / Q1-US03-07 Existing KB Drift

- Finding key: `Q1-US03-07` (FT-QA-2026-141, retained).
- Plan reference: approved US-03 plan above.
- Acceptance criterion: AC-8.
- Description: the same two `[Planned F-1]` consumer statements and current-v20 provenance statement remain. Backend intentionally left these pending user decision. Their persistence is not a new defect caused by correction1.
- Severity: Low. Criticality: Non-blocking. Owner: Documentation.
- Evidence: [API consumer](../../kb/tech/09-api-reference.md#L944), [API provenance](../../kb/tech/09-api-reference.md#L1119), [domain consumer](../../kb/domain/07-ai-features.md#L743). Current source is v23/v6 and F-1 is implemented. New v6 KB correction/gate summaries otherwise match current bound evidence; historical records stay historical.
- Repro: compare these three current-state lines to source/manifest and unchanged Home implementation.
- Recommendation: await user's fix/accept/defer decision; do not treat plan autoapproval as permission or acceptance. No QA KB edit.

### R1-08 New Accepted Historical Equality And Provenance Gap

- Finding key: `Q1-US03-R1-08` (new local key; no central ID allocated by QA).
- Plan reference: approved US-03 plan above, server-data-only requirement.
- Acceptance criterion: AC-2, AC-8.
- Description: formally passing personal-neutral-greeting summary says all last three days'1980 Kalorien `deinem Ziel von 2100 Kalorien entspricht`.1980 is not2100; all three supplied targetSource values are profile_fallback, not stored historic targets. The unqualified historical target relation is accepted by Runtime and helper. Recent-days handling only covers macro ranges and the relation matcher omits `entspricht`; no per-day history index is set by this three-day wording. This distinct historical calorie/provenance defect is not FT136's missing-current-data case.
- Severity: High. Criticality: Blocking. Owner: Backend.
- Evidence: [current personal original](../../../backend/output/daily-insight-v23-personal-neutral-greeting-2026-10-16T17-49-22-019Z.json), SHA-256 `8fb4ad50624607cef7375739be06f2051b13440be3780724d6da2054f53403f9`; [historical validation](../../../backend/src/lib/dailyInsightValidation.ts#L262), [unchanged fixtures](../../../backend/src/lib/prompts/dailyInsight.eval.fixtures.ts); independent all-output replay returns successfully and helper `[]`.
- Repro: parse exact artifact.content; load personal-neutral-greeting input/intent; call actual validator. Compare the quoted1980/2100 equality and profile_fallback sources. Do not reinterpret this exact unqualified equality as an approved approximate range or stored target.
- Recommendation: Backend should regress this exact accepted original and enforce truthful historical relations/source qualification for recent-days narration without inventing thresholds or altering fixtures. Preserve current-target versus historical-source distinctions.

### R1-09 New Eval Current/Yesterday Attribution False Positive

- Finding key: `Q1-US03-R1-09` (new local key; no central ID allocated by QA).
- Plan reference: approved US-03 plan above, trustworthy source-bound full eval gate.
- Acceptance criterion: AC-8.
- Description: empty-morning short sentence `Heute ist noch offen, und du hast gestern 1980 kcal aufgenommen.` explicitly attributes1980 to yesterday. The helper's current-number regex crosses the conjunction/day reference and calls it invented current intake. Runtime accepts; the full live case fails solely at this helper assertion. Today's nutrition/remainder are null and yesterday's logged1980 is present. This is a demonstrated rubric false positive, not invented current intake and not a waiver of other output requirements.
- Severity: Medium. Criticality: Blocking. Owner: Backend.
- Evidence: [current empty-morning original](../../../backend/output/daily-insight-v23-empty-morning-2026-10-16T17-50-08-349Z.json), SHA-256 `9345d447f485220c3e16f56370bdb845ad930badb4027a80e6bbdb2246e400c4`; [regex](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L24), [actual call assembly](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L340); bound full report fails `claims a numeric current nutrition value without logged current intake`.
- Repro: replay exact output/fixture; Runtime returns, actual helper with `.join('. ')` returns that error. Read the explicit `gestern` and compare last3Days[0].calories1980.
- Recommendation: Backend owns eval correction; add this exact positive temporal control and retain genuine fabricated-current-intake negatives. Do not skip/waive the fixture, call the entire output semantically certified or reroll until passing. QA does not edit evals.

## Current Live Failure Separation

| Failed fixture | Independently verified interpretation |
|---|---|
| historical-target-source-priority | New unconfirmed historical completion; correct Runtime rejection, residual FT137. |
| budget-lock | New inconsistent overage arithmetic; correct rejection, residual FT138. |
| target-relative-overage-not-achieved-surplus | Full summary says `morgen deine Proteinaufnahme zu erhöhen`; protein guard rejects. This is future wording, not proof of same-day advice. No new exemption or claim that every part is safe; absolute protein-lock wording also applies. Not folded into FT139 or mislabeled as calorie-attribution failure. |
| protein-nearly-complete | Protein-rich meal advice at gap10; correct rejection, same generation-lock family as FT135. |
| carbohydrates-below-range-neutral | Stable-weight assertion contradicts supplied signals; correct rejection, FT136 family. |
| empty-morning | Runtime accepts, local helper misattributes explicit yesterday intake; new R1-09. |
| midday-empty-day-not-morning | Stable despite80/80.2; correct rejection, residual FT136. |
| stale-weight | Today's1500/500 nutrition side topic despite weight-only focus; correct rejection, residual FT135. |

Two formally passing outputs remain accepted-content counterexamples: long-name meal planning (FT135) and personal historical equality/source (R1-08). The fixture-authorized safe rejections in historical-target-unavailable and morning-unlogged-prior-day are not endorsements of rejected text; unchanged allowances were not added by correction1. More conservative Runtime rejection is not successful generation and zero policy errors are not universal German semantic safety.

## Current Verification Limits And Method

- Physical UI/accessibility/native navigation: `MANUAL VALIDATION REQUIRED / UNVERIFIED`. The retained checklists below provide prerequisites, steps, expected results and empty result status for all four320/360-dp,font1.0/1.3 combinations, long/maximal text,48-dp targets,Safe Area,TalkBack,Back and feedback transitions. No device/emulator work requested/performed; these limits are outside actionable findings and are not the cause of this verdict. No final UI acceptance is claimed.
- Real Cosmos persistence: `UNVERIFIED / vom User aus Pruefauftrag ausgenommen`. Contract suite not run/installed; historical0 executed/15 setup-skipped remain historical. Offline coverage checks optional Class0 Daily/Feedback fields,IDs/provenance/TTL logic and Weekly isolation, not SDK serialization,real partition enforcement,TTL expiry or concurrency. No unrestricted persistence approval.
- Full live suite is existing newly completed source-bound evidence, not independently re-executed by QA R1. Numeric exit1 and all report/log/artifact hashes were independently verified. This explicitly authorized reuse avoids a redundant paid run and does not turn a failed gate into success.
- Replay uses installed TypeScript `transpileModule`/process-local `.ts` hook and actual fixture/validator/prompt exports. The real helper declarations are extracted in memory from the eval module with the real validation imports; no replacement matcher, file edit or provider call. Output order is shortInsight,title,summary,recommendation,cta filtered and joined by `. ` exactly as live eval. Each eight-original and22-current result matches current evidence. Exact originals also have embedded mocked-provider regression tests in the independently run448 slice; historical artifacts retain their old generation identity while current validator binding is recorded separately.
- Source enumeration recursively includes `.ts/.mts/.mjs/.json` under backend/src,backend/scripts,shared/lib,shared/types plus the13 explicit root/workspace/config entries documented in B-1; sorts repository-relative `/` paths and hashes raw bytes/JSON rows. Secrets/local settings/docs/output are excluded. Register SHA-256 before report update is `49532c436b5e72ae2490d93a2d69902cd9f96803f085fcab93875a4e1688cf80`; no QA write.
- Both skill checklists applied: existing daily-insight key, backend-only Strict single call, equivalent domain validator and special200 fallback, quota-before-AI/usage-after-valid-success, auth and exact feedback provenance remain unchanged/covered. Optional Class0 nested fields and /userId ownership persist; no migration/container/infra changes. Generic skill429/422/confirmation guidance does not override this approved advisory-Daily200 contract. No new nutrition-estimate endpoint or classification logic was introduced.

## Current Handoff

Orchestrator may update status and route any separately authorized final Backend correction attempt2. QA does not spend that attempt, close FT139 in the register, authorize FT140/141 fixes or accept the Story. Return FT135-138 plus new keys R1-08/R1-09 to Backend; FT139's numeric-clause correction is independently verified only within the stated regression boundary. No unavoidable architectural/product plan deviation found; leading v23 remains authorized. Historical plan/F-1 v5 references are not used as current candidate evidence.

---

## Historical First Review (Before Correction Attempt 1)

The entire remainder is the preserved first-review record on v23/assembly v5, including its then-observed acceptance holes, counts, recommendations and limits. It does not describe current v6 behavior or add a second current verdict. Its original report raw-byte SHA-256 was `9769892dc5da8c4c1d8ee8b5e96453086c3ca893566540704d6be03aca7b2688`. Original disposition was rejection of Story acceptance; the full live result was67/3 with numeric shell exit not retained. Current corrective verification is exclusively above.

## Scope

Reviewed the complete approved plan, its latest API-dependency addendum, the [original story](../../User%20Stories/startpage/US-03_Dynamische-KI-Begruessung-mit-FitTrack-Insight.md), current [B-1 handoff](../../User%20Stories/startpage/B-1_US-03_Backend_Handoff_2026-10-16.md), [F-1 handoff](../../User%20Stories/startpage/F-1_US-03_Frontend_Handoff_2026-10-16.md), implementation, related tests and required KB documents. Applied both required skills and their QA checklists: Azure OpenAI integration and Cosmos data-model/migration.

The latest addendum permits F-1 and Q-1 to start against the implemented stable API without accepting B-1. Earlier waiting instructions are superseded. It does not waive either known backend defect or any remaining acceptance gate. PO-1 requires the time-neutral greeting; PO-2 introduces no special legacy UX. The illustrative two-sentence story example does not override the approved one-sentence contract.

Reviewed additive Shared/provider/API/response persistence fields, single-call generation, semantic validation and evals, Home integration, exact-instance details/feedback, fallback, unchanged request/cache/quota/TTL boundaries, and relevant documentation. No new endpoint, source of user data, business threshold, dependency, native module, migration, container/index, infrastructure change or release is required by this story. The pre-existing dirty worktree includes unrelated renderer/package changes; those are not attributed to US-03.

QA made no implementation, prompt, fixture, eval, test or KB corrections. Only this report was manually added; commands generated test reports, live synthetic output artifacts and normal build output. No deployment, emulator setup/start/install, Dev/Alpha/remote Cosmos write test or central findings-register edit was performed. Model credentials were consumed by the existing live runner, not printed or copied into this report.

**Remaining required gates:** unit suites, backend/shared typechecks, build verification and release guard passed. Mobile typecheck and the complete live eval failed. Independent original-output replays additionally confirmed semantically invalid outputs accepted by runtime validation and, in several cases, the live rubric. These observed defects determine the verdict, not unavailable device tooling or the excluded emulator check. No unrestricted story, persistence or release acceptance is given.

**Emulator-Persistenz: UNVERIFIED / vom User aus Pruefauftrag ausgenommen.** This is the user-excluded check, not a passing check and not a blocker by itself. Actual Cosmos serialization, partition isolation, conditional writes and TTL effects remain unproved by this QA run.

## Candidate and Evidence Binding

- Current source: `v23`, assembly `v5`; independently recomputed bundle fingerprint `sha256:af10a905066358e252d9b2e123b08e272f5f2b84c63225682fce32eff334f8de`. Runtime root, strict schema, append-only manifest and tested-version guard agree. Release-guard checks preserve historical releases rather than relabeling them.
- Independently compared all raw-byte SHA-256 rows in [backend/output/b1-v23-residual-source-pre-2026-10-16.json](../../../backend/output/b1-v23-residual-source-pre-2026-10-16.json) and [backend/output/b1-v23-residual-source-post-2026-10-16.json](../../../backend/output/b1-v23-residual-source-post-2026-10-16.json): identical 291-file source sets. All 291 current files still match. Aggregate SHA-256 of `JSON.stringify(rows)`: `3dfd3c13706aca3b5105a78e8b27ea6fc709cea9be4bebbc68f5a02e0c6edd3b`. Rechecked after the independent tests/replays; no candidate drift.
- Independently resolved and hashed every one of the 16 source/report/artifact rows in the F-1 handoff, including its eight implementation/test sources and inherited B-1 artifacts. All match the declared bytes. This verifies provenance, not semantic correctness.
- Historical B-1 full live evidence remains 69 passed / 1 failed, SHA-256 `db6cfa40712541d81b055d43866ba546596ae41261d17431aede59b9291473c0`, in [backend/output/b1-v23-residual-final-full-eval-2026-10-16.json](../../../backend/output/b1-v23-residual-final-full-eval-2026-10-16.json). It is not substituted for the independent Q-1 run below. Earlier v20/v23 assembly-v4 counts are historical, not acceptance of this source.
- Q-1 ran the complete live suite once, without rerolling failing cases. Window: `2026-10-16T17:24:54.496Z` to `17:27:53.327Z`; Daily live window `17:26:40.670Z` to `17:27:39.908Z`. All 22 captured Daily provider outputs use the current fingerprint and `finishReason: stop`; no observed truncation. The 70 assertions include local rubric/version checks and live cases, not 70 Daily provider requests.

## Acceptance Criteria

Historical first-review criteria summary, not a second current matrix: AC-1/4/5/6 passed; AC-2/8 failed; AC-3/7 were UNVERIFIED. The v5 evidence and original findings below explain those outcomes. The sole current complete AC-1-8 matrix is above.

## Tests

Commands were run from the workspace root. Reporter output paths are interpreted relative to each npm workspace.

| Command | Exit code | Result |
|---|---:|---|
| `npm test --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/q1-us03-backend-units-2026-10-16.json --silent` | 0 | 1899 passed, 71 files; 0 failed/skipped/todo. Includes handler, SDK, prompt, validator, offline repository and registration regressions. |
| `npm test --workspace=@fittrack/mobile -- --reporter=dot --reporter=json --outputFile=../output/q1-us03-mobile-units-2026-10-16.json --silent` | 0 | 912 passed, 89 files; 0 failed/skipped/todo. |
| `npm test --workspace=@fittrack/shared -- --reporter=dot --reporter=json --outputFile=../output/q1-us03-shared-units-2026-10-16.json` | 0 | 466 passed, 10 files; 0 failed/skipped/todo. |
| `npm run typecheck --workspaces --if-present` | 1 | Backend and Shared completed without diagnostics; Mobile `tsc --noEmit` exited 2 with the two errors in Q1-06. Aggregate workspace command failed. |
| `npm run verify:daily-insight-prompt --workspace=@fittrack/backend` | 0 | Seven release-script checks and four manifest tests passed; active v23/v5 identity and historical preservation verified. |
| `npm run build:verify --workspace=@fittrack/backend` | 0 | TypeScript build, ten renderer assets, shared-import resolution and duplicate-module verification passed. Not a deployment test. |
| `npm run test:eval --workspace=@fittrack/backend -- --reporter=dot --reporter=json --outputFile=output/q1-us03-full-eval-2026-10-16.json --silent` | Numeric exit not retained | Completed failed run: JSON `success=false`, 67 passed / 3 failed / 0 skipped/todo, five files. Daily 36/39; other evals 31/31. No claim of a captured numeric shell exit; failed gate is independently established by the completed structured report and assertion stacks. No second paid run was made to recover that shell metadata. |
| Read-only Node source/report SHA-256 assertions | 0 | All 291 B-1 source rows, equal pre/post source sets, current source bytes and all 16 F-1 handoff hashes verified. |
| Read-only Node/TypeScript in-memory original-output replay | 0 | Parsed original JSON content, loaded unchanged fixture context/intent and actual runtime validator; extracted the unchanged local policy helper in memory. Original phase accepted with no local policy violation; all 22 Q-1 Daily artifacts inspected/replayed. |
| Read-only Node clause-boundary counterexample | 0 | Same correct intake/target/remainder: compound clause rejected as wrong remainder, sentence-separated version accepted. Also asserts acceptance of four original semantic counterexamples. |
| `test:contract` | NOT RUN | Explicitly excluded; zero new emulator contract executions. No emulator setup or remote Cosmos substitute. |

The first auxiliary in-memory replay attempt exited 1 because the probe passed an undefined filename to Node's module compiler. A separate clause probe exited 1 because the Windows stdin encoding changed a non-ASCII regex literal. These were QA-command errors, not product test failures. Corrected read-only probes passed; no source/test files were changed and no provider calls were repeated for either probe.

### Independent Report Hashes

| Report | SHA-256 |
|---|---|
| [backend/output/q1-us03-backend-units-2026-10-16.json](../../../backend/output/q1-us03-backend-units-2026-10-16.json) | `c43479664bd926a6bd27c0f8b83d18af145296412be804ece0a8b83271984eb0` |
| [output/q1-us03-mobile-units-2026-10-16.json](../../../output/q1-us03-mobile-units-2026-10-16.json) | `94f2058a47033d9574b6e36ce27fe08766825ff9c17d37fd9ccb96a928a90b8e` |
| [output/q1-us03-shared-units-2026-10-16.json](../../../output/q1-us03-shared-units-2026-10-16.json) | `5722ab457a4df2d5f63e47ddfd3461412b4cd1074840b2fdf0d8f9ff6d473439` |
| [backend/output/q1-us03-full-eval-2026-10-16.json](../../../backend/output/q1-us03-full-eval-2026-10-16.json) | `47e5450b9f0ecee09253596b74f5d45fcff35d5271c5744681809d2945f01633` |

## Verification Notes

### Physical UI and Accessibility

- State: `MANUAL VALIDATION REQUIRED / UNVERIFIED`.
- Prerequisite: physical Android device with a compatible FitTrack build, test account and synthetic insight data; ability to set logical width to 320/360 dp, font scale to 1.0/1.3 and enable TalkBack. `Get-Command adb -ErrorAction SilentlyContinue` returned no command in this session. No device or native screenshot tooling was available; no Android emulator was requested or started.
- Steps: exercise all four width/font combinations using a long name, valid greeting exactly 120 JS units, complete short sentence exactly 240 units and the longest supported training label. Capture Home and scrolled detail screenshots. Measure changed actions; inspect safe-area edges and text bounds. Open/close using button, backdrop and Android Back; repeat with TalkBack and after rotation/large text.
- Expected: no overlap, horizontal scroll or sentence truncation; selector remains right and usable; all actions at least 48 dp; correct theme/insets, readable order, labels, modal focus and focus restoration. Native rendering is not inferred from mocked component props.
- Result: `UNVERIFIED`; screenshots and measured bounds not produced by QA. This verification limit is not an actionable finding or the reason for the verdict.

### Native Detail, Navigation and Feedback

- State: `MANUAL VALIDATION REQUIRED / UNVERIFIED`.
- Prerequisite: same physical build, synthetic generation A and newer generation B, controllable network/offline response and feedback-capable stored snapshot.
- Steps: open A, refresh Home to B while details remain open, confirm A's full content, then submit feedback. Exercise Nutrition/Weight CTAs; retry a failed submission unchanged, change the comment, cancel/reopen, and cover server 404/409/snapshot-unavailable. Close details before feedback and confirm the bottom sheet appears and remains operable through keyboard/Back transitions.
- Expected: no additional AI request for details/day selection; open A and its feedback date/generatedAt remain paired; unchanged retries retain submissionId; changed bodies use the intended conflict handling. No invisible/blocked sheet, duplicate submission, focus trap or stale-generation substitution.
- Result: automated object/date/race/retry callbacks passed; physical overlay, keyboard, screen-reader and navigation behavior `UNVERIFIED`. Not an actionable finding.

### Excluded Cosmos Persistence

- State: `UNVERIFIED / vom User aus Pruefauftrag ausgenommen`.
- Scope: actual emulator-backed roundtrip, serialization, partition/id isolation, conditional feedback updates and Cosmos TTL. The existing [contract tests](../../../backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts) were reviewed, not executed or removed. The handoff's historical 0 executed / 15 setup-skipped cases are historical, not new QA executions.
- Prerequisite for any future check: a separate explicit user authorization and a local Cosmos emulator only. No setup/install/start, current execution request or Dev/Alpha/remote Cosmos write is implied by this report.
- Steps if separately authorized: execute the existing contract suite against the local emulator and inspect its actual results for compact-pair and legacy reads, Daily/Feedback/Weekly isolation, exact-instance feedback, TTL and partition behavior.
- Expected: existing Class-0 optional nested fields roundtrip without migration and without changing legacy records/keys/expiry. Offline in-memory repository/handler coverage is not proof of Cosmos SDK behavior.
- Result: `UNVERIFIED`; excluded boundary alone does not block B-1/F-1/Q-1. No unrestricted persistence approval.

## Findings

### Q1-01: Accepted protein-lock and weight-focus violations

- Finding key: `Q1-US03-01`
- Plan reference: approved US-03 plan linked above, latest API-dependency addendum and B-1 residual scope.
- Acceptance criterion: AC-2, AC-8.
- Description: the known original phase output asks the user to increase protein with `remainingProteinG=20` and treats 700 remaining calories as room for eating despite weight-only focus. Actual runtime validation accepts it; the local eval helper reports no policy violation. The independent Q-1 `stale-weight` original also passes the live case and runtime replay while describing `500 Kalorien Spielraum` for meals and telling the user to reach a protein range of 120-160 g with the same active lock. The final weight-only prompt guard is present, but does not reliably control the provider, and the validator's narrow protein phrase list does not enforce that semantic contract.
- Severity: High.
- Criticality: Blocking.
- Owner: Backend.
- File and line: [backend/src/lib/dailyInsightValidation.ts](../../../backend/src/lib/dailyInsightValidation.ts#L454), especially `proteinAction`; [weight-focus prompt guard](../../../backend/src/lib/prompts/dailyInsightPrompt.ts#L47); [local rubric](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L56).
- Evidence: original [phase output](../../../backend/output/daily-insight-v23-phase-progress-open-day-2026-10-16T17-03-38-873Z.json), SHA-256 `86bcf893fed58c9e23c153253ce02aa929f3d5b814a4e0391b0e8df73ae16b9a`; Q-1 [stale-weight output](../../../backend/output/daily-insight-v23-stale-weight-2026-10-16T17-27-39-906Z.json), hash in appendix. Both use current fingerprint and stop normally. The independent Q-1 phase output happens not to repeat the earlier advice; that does not invalidate the unchanged-source original counterexample.
- Repro: parse each artifact's `content`; locate its fixture by `fixtureId` in the unchanged fixture set; invoke `validateDailyInsightResponse(output, fixture.input, fixture.intent)`. Both return successfully. Applying the actual current `getInsightPolicyViolations` helper also returns an empty array. Compare the supplied 20-g gap and weight intent with the original full summary, not only its short sentence or null CTA fields.
- Recommendation: Backend should repair the bounded generation/validation defect and add regressions for these exact source-bound originals, including advice phrased as increasing/reaching protein in summary and forbidden nutrition side topics under weight focus. Strengthen actual semantic detection/eval coverage without relaxing the protein threshold, removing cases, inventing a client workaround or relabeling existing evidence. Rerun remaining required gates after correction.

### Q1-02: Missing current diary data becomes an invented budget and weight claim

- Finding key: `Q1-US03-02`
- Plan reference: approved US-03 plan, server-data-only and missing-data requirements.
- Acceptance criterion: AC-2, AC-8.
- Description: the Q-1 midday fixture has `today=null`, `remainingCalories=null`, latest weight 80 and previous 80.2 with a losing trend. The accepted short sentence says weight has remained stable since the last measurement; the full text calls it unchanged and derives room for remaining meals from the 2000-kcal target despite no current intake. This is an unsupported current-day budget, not a false positive from a neutral open-day sentence. Runtime accepts the entire response; the independent live assertion correctly fails its missing-budget policy check.
- Severity: High.
- Criticality: Blocking.
- Owner: Backend.
- File and line: [runtime semantic orchestration](../../../backend/src/lib/dailyInsightValidation.ts#L550), [budget validation](../../../backend/src/lib/dailyInsightValidation.ts#L358), [eval missing-budget check](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L66).
- Evidence: [midday original](../../../backend/output/daily-insight-v23-midday-empty-day-not-morning-2026-10-16T17-27-36-253Z.json), SHA-256 `68f5e9e8272c72d609181abbeae19e4182055fa5b91dffd45ffeefc8d3025a97`; full Q-1 report assertion `claims available current calorie space without a positive remaining budget`.
- Repro: replay that unchanged original with fixture `midday-empty-day-not-morning`, intent `general`; runtime accepts. Compare short/full claims with both supplied measurements and null current nutrition/remainder. The unchanged local policy helper returns the missing-budget violation.
- Recommendation: preserve null-as-unknown and authoritative weight signals throughout short/full generation and runtime checking; add regressions for this exact accepted output. Do not derive current room from a target alone or suppress the correct live assertion.

### Q1-03: Unconfirmed activity is accepted as completed

- Finding key: `Q1-US03-03`
- Plan reference: approved US-03 plan, existing activity certainty rules.
- Acceptance criterion: AC-2, AC-8.
- Description: the Q-1 intensive-endurance output's short text says the tour probably happened, but its summary asserts that the user covered about 360 minutes and 30 km. Context supplies only `likely_completed`, not confirmed completion. Its summary contains no uncertainty marker for that assertion; the definitive-language heuristic misses the verb describing distance covered. Separately, the passing historical-target-priority original says the user participated in yesterday's hiking activity, although a stored historical activity is not completion evidence. Both original responses pass runtime and live policy checks. A probabilistic short sentence cannot make a definitive full-text assertion safe.
- Severity: High.
- Criticality: Blocking.
- Owner: Backend.
- File and line: [definitive activity matcher](../../../backend/src/lib/dailyInsightValidation.ts#L52), [activity validation](../../../backend/src/lib/dailyInsightValidation.ts#L499), [local policy helper](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L56).
- Evidence: [intensive-endurance original](../../../backend/output/daily-insight-v23-intensive-endurance-fueling-2026-10-16T17-27-14-073Z.json) and [historical-target-priority original](../../../backend/output/daily-insight-v23-historical-target-source-priority-2026-10-16T17-26-57-061Z.json), hashes in appendix. Both are formally passing cases in the independent full report; read-only assertions independently confirm runtime acceptance.
- Repro: parse and replay both originals against their exact fixtures/intents. Read the first summary's claim of completed movement and the second summary's claim of participation against the supplied status/source. The current validator returns successfully for both.
- Recommendation: retain the distinction between recorded/planned, probable and confirmed events for current and historical contexts. Backend should add exact-original regressions and enforce uncertainty at the actual claim boundary across short and full narratives, not by a nearby unrelated marker or small verb list. Do not treat a recorded activity as a performed event.

### Q1-04: Inconsistent negative-budget fixture still generates false arithmetic

- Finding key: `Q1-US03-04`
- Plan reference: approved US-03 plan, known B-1 `budget-lock` residual defect and unchanged mandatory full eval.
- Acceptance criterion: AC-2, AC-8.
- Description: the unchanged fixture intentionally combines intake 1500, target 2000 and remainder -120. The exact final prompt guard requires an uncertainty description, no current calorie arithmetic and no reliable above-target claim. The original B-1 output and independent Q-1 output instead claim an exceeded target; the latter states 1500 versus 2000 and a 120-kcal overage. The runtime correctly rejects this contradiction, causing unavailable rather than persisting it. This is a generation/eval-gate defect, not evidence that invalid text reaches Home or that production context normally computes such a remainder.
- Severity: Medium.
- Criticality: Blocking.
- Owner: Backend.
- File and line: [inconsistent-budget prompt guard](../../../backend/src/lib/prompts/dailyInsightPrompt.ts#L52), [guard assembly](../../../backend/src/lib/prompts/dailyInsightPrompt.ts#L296), [correct runtime rejection](../../../backend/src/lib/dailyInsightValidation.ts#L370).
- Evidence: [historical original](../../../backend/output/daily-insight-v23-budget-lock-2026-10-16T17-04-02-060Z.json), SHA-256 `2bc17b5fc2657731addd6e683056f39658923cb6083b6bd65fbc2f9ab1922c9a`; [Q-1 original](../../../backend/output/daily-insight-v23-budget-lock-2026-10-16T17-27-16-730Z.json), SHA-256 `cdf56d280d6a3e711ab296d4b673985f7e1fa4f23372349bbbddc5df71fd2050`. Q-1 live report fails with `Daily insight calorie budget contains inconsistent current calorie values`.
- Repro: replay either original against unchanged `budget-lock` fixture. Runtime throws the above error. Inspect generated short/full arithmetic and final system guard. Handler regressions confirm validation failure produces HTTP 200 unavailable without compact pair, persistence or usage booking.
- Recommendation: repair this bounded generation failure and demonstrate the unchanged fixture and full gate passing. Preserve the correct validator and null actions; do not alter the intentionally inconsistent fixture to make arithmetic convenient, weaken safety, add retries or silently change production context semantics.

### Q1-05: Compound calorie sentence is falsely read as a wrong remainder

- Finding key: `Q1-US03-05`
- Plan reference: approved US-03 plan, exact effective-budget attribution and required full eval.
- Acceptance criterion: AC-2, AC-8.
- Description: in the Q-1 unknown-activity original, the correctly stated 1500-kcal intake is followed by a clause saying 2000 kcal remain. The reverse remainder regex spans `1500 Kalorien aufgenommen und es bleiben` and incorrectly assigns 1500 to the remainder. The same heuristic is duplicated in the eval policy helper. This rejection is independent of the original's other imperfect activity wording; a neutral synthetic variant with the exact same correct numbers also fails, and changing only the clause separator to a full stop makes it pass. That isolates an actual runtime false rejection, not an invented provider number.
- Severity: Medium.
- Criticality: Blocking.
- Owner: Backend.
- File and line: [remainder matchers](../../../backend/src/lib/dailyInsightValidation.ts#L72), [attribution enforcement](../../../backend/src/lib/dailyInsightValidation.ts#L117), [duplicated eval matchers](../../../backend/src/lib/prompts/dailyInsight.eval.test.ts#L37).
- Evidence: [unknown-activity original](../../../backend/output/daily-insight-v23-unknown-activity-2026-10-16T17-27-11-532Z.json), SHA-256 `734fd717f25e0adba58694b2477e2ac8ddce3c0382482c2c82ee93f0bf80bf59`. Q-1 full eval fails with `Daily insight uses an unsupported remaining calorie amount value`. Independent clause counterexample exits 0 with both expected assertions.
- Repro: retain the original fields but set summary to a neutral registered/unknown-activity introduction, `Dein effektives Kalorienziel liegt bei 3500 Kalorien.` and `Aktuell hast du bereits 1500 Kalorien aufgenommen und es bleiben dir noch 2000 Kalorien bis zu deinem Ziel.` Runtime throws the remainder error. Replace only `aufgenommen und es bleiben` with `aufgenommen. Es bleiben`; runtime accepts. Context and numbers are identical.
- Recommendation: Backend should repair claim/number boundaries in runtime and corresponding eval coverage, retaining rejection of genuinely swapped target/intake/remainder values. Add this exact positive control plus negative controls; do not broadly disable attribution validation. Handle the original's separate activity semantics without declaring this numeric claim wrong.

### Q1-06: Required Mobile typecheck remains red on existing test errors

- Finding key: `Q1-US03-06`
- Plan reference: approved US-03 plan, mandatory Mobile typecheck gate; F-1's documented pre-existing boundary.
- Acceptance criterion: AC-8.
- Description: the independent workspace typecheck reproduces two errors already reported by F-1. They are not introduced by the eight F-1 source/test files, but the required package-wide gate is still failing; passing Vitest transpilation does not make TypeScript clean.
- Severity: Medium.
- Criticality: Blocking.
- Owner: Frontend.
- File and line: [mobile/src/shared/components/ProgressHeroCard.test.ts](../../../mobile/src/shared/components/ProgressHeroCard.test.ts#L456), column 41: TS2345, `unknown` is not assignable to `string`; [mobile/src/shared/components/WeightChart.test.ts](../../../mobile/src/shared/components/WeightChart.test.ts#L116), column 19: TS2339, `children` does not exist on `ReactTestInstance`.
- Evidence: `npm run typecheck --workspaces --if-present` exits 1; Mobile child `tsc --noEmit` exits 2 with exactly those diagnostics. Backend and Shared have no type diagnostics. F-1 explicitly records the same existing errors.
- Repro: run the same workspace command, or the Mobile package's existing typecheck script; inspect the two locations. No QA fix or unrelated cleanup was made.
- Recommendation: return the existing type-gate defects to Frontend for authorized correction, then rerun the full required typecheck. Do not call them US-03 regressions or waive the gate merely because they predate F-1.

### Q1-07: KB still marks implemented Home behavior planned and misstates prompt provenance

- Finding key: `Q1-US03-07`
- Plan reference: approved US-03 plan, implemented-behavior and accurate API/provenance documentation requirement.
- Acceptance criterion: AC-8.
- Description: API and domain documentation still label the implemented Home fallback `[Planned F-1]`. The feedback provenance table says new generations currently use v20, while source, manifest, handoffs and independently bound artifacts use v23/v5. These are explicit current-state statements, not merely historical result sections. Newer Mobile/product documents already describe the implementation correctly; the remaining contradictions need a bounded documentation correction.
- Severity: Low.
- Criticality: Non-blocking.
- Owner: Documentation.
- File and line: [API Home-consumer paragraph](../../kb/tech/09-api-reference.md#L944), [API promptVersion table](../../kb/tech/09-api-reference.md#L1107), [domain fallback paragraph](../../kb/domain/07-ai-features.md#L724).
- Evidence: compare those current-state statements with implemented [HomeScreen](../../../mobile/src/modules/home/HomeScreen.tsx), [display guard](../../../mobile/src/services/insightService.ts#L9) and active [manifest](../../../backend/src/lib/prompts/dailyInsightPromptManifest.ts). Historical v20 and assembly-v4 evidence must remain explicitly historical.
- Repro: read the three linked KB locations and the current source. No runtime or release action is needed to reproduce the divergence.
- Recommendation: Documentation owner should remove obsolete planned markers for implemented F-1 behavior and correct current provenance while retaining open backend defects, historical results and all verification limits. QA did not edit the KB or central findings register.

## Replay Method

The successful read-only probes used Node, the repository's installed TypeScript `transpileModule` and a process-local `.ts` require hook. No helper file was written. They loaded the unchanged fixture export and actual validator, parsed each artifact's outer JSON and inner `content`, then called `validateDailyInsightResponse(content, fixture.input, fixture.intent)`. The actual local rubric declarations between `UNSUPPORTED_GREETING_EMOJI` and the first rubric `describe` were transpiled in memory to expose `getInsightPolicyViolations`; the helper was not reimplemented or changed. Short text/title/summary/recommendation/CTA were passed in their normal output order. This establishes actual acceptance/rejection behavior, not human semantic approval of accepted text.

Each failed live case's original was reviewed separately: budget-lock is a genuine generated contradiction correctly rejected; unknown-activity has a demonstrated attribution false positive; midday-empty-day has a genuine unsupported budget claim and an independently observed weight contradiction. Other passing originals were inspected as well, yielding Q1-01/Q1-03. The existing morning-unlogged-prior-day fixture intentionally allows its specific safe validation rejection; that formal pass is not approval of its rejected text or evidence it is persisted.

## Q-1 Daily Artifact Inventory

All entries below are original outputs from the single independent full live run. SHA-256 covers raw file bytes. A passing assertion is not a semantic endorsement; see the findings.

| Artifact | SHA-256 |
|---|---|
| [budget-lock](../../../backend/output/daily-insight-v23-budget-lock-2026-10-16T17-27-16-730Z.json) | `cdf56d280d6a3e711ab296d4b673985f7e1fa4f23372349bbbddc5df71fd2050` |
| [carbohydrates-above-range-neutral](../../../backend/output/daily-insight-v23-carbohydrates-above-range-neutral-2026-10-16T17-27-29-164Z.json) | `ec1ce9953750e55796d2a97a5d8ae66bd6645e233574bfc0bb564ccaa1475f3e` |
| [carbohydrates-below-range-neutral](../../../backend/output/daily-insight-v23-carbohydrates-below-range-neutral-2026-10-16T17-27-26-794Z.json) | `a688b9e75c86e9ec062557aad3f3f41ca3c985fbc3fc6f55cae08454624b0c90` |
| [current-effective-activity-budget](../../../backend/output/daily-insight-v23-current-effective-activity-budget-2026-10-16T17-26-54-853Z.json) | `8aa2cafb5744519dd451a9d1ca9ab1d337abcf216317ce2948899c8133a23e42` |
| [empty-morning](../../../backend/output/daily-insight-v23-empty-morning-2026-10-16T17-27-31-461Z.json) | `19c271c4ab21cee17a999d98994b6f3c1128f9e4ca6fe3afa7af4b38456d7863` |
| [historical-target-ambiguous-source](../../../backend/output/daily-insight-v23-historical-target-ambiguous-source-2026-10-16T17-27-02-719Z.json) | `1767d2131c19625f73830bb4aa5cc0f2866efe9ce20e4e7ad94351252417946c` |
| [historical-target-source-priority](../../../backend/output/daily-insight-v23-historical-target-source-priority-2026-10-16T17-26-57-061Z.json) | `d2c1a9600e45ca05404694fd46f55f34b9931cd5825240328c99da461d63e511` |
| [historical-target-unavailable](../../../backend/output/daily-insight-v23-historical-target-unavailable-2026-10-16T17-27-00-169Z.json) | `9d956a8873f195fdd88b9b7423c68b558ad29212bad7b642dcee729f0a39383a` |
| [intensive-endurance-fueling](../../../backend/output/daily-insight-v23-intensive-endurance-fueling-2026-10-16T17-27-14-073Z.json) | `7dc530fd3ece0ef1c5e02ffa817f14577276bc5250142ebc87dc5070d6c68917` |
| [likely-completed-activity](../../../backend/output/daily-insight-v23-likely-completed-activity-2026-10-16T17-27-08-658Z.json) | `815e96b5ffd9fb6ebe21e52bb8895a904ab60b89ad04d9d25a25c33586210a8a` |
| [long-name-neutral-greeting](../../../backend/output/daily-insight-v23-long-name-neutral-greeting-2026-10-16T17-26-44-915Z.json) | `0f058d87170f61dc1ce0a3e759b13f1d35bafd8fb34633e8e15366e2e0cb4007` |
| [midday-empty-day-not-morning](../../../backend/output/daily-insight-v23-midday-empty-day-not-morning-2026-10-16T17-27-36-253Z.json) | `68f5e9e8272c72d609181abbeae19e4182055fa5b91dffd45ffeefc8d3025a97` |
| [morning-unlogged-prior-day](../../../backend/output/daily-insight-v23-morning-unlogged-prior-day-2026-10-16T17-27-34-006Z.json) | `0a095a9f43a38b1f9e1ff2c67125e2079b4dc6430b9ab84f448a85f65d7e171b` |
| [personal-neutral-greeting](../../../backend/output/daily-insight-v23-personal-neutral-greeting-2026-10-16T17-26-42-767Z.json) | `ef84a85bbfa049772d1cc1b361dda5f701e376c3f527ac86638b02b579c0ce04` |
| [phase-progress-open-day](../../../backend/output/daily-insight-v23-phase-progress-open-day-2026-10-16T17-26-49-270Z.json) | `3188911aec248593d031df83b4c992b76d3ef5fa9c02798ef742d96a7bedb1a4` |
| [planned-activity](../../../backend/output/daily-insight-v23-planned-activity-2026-10-16T17-27-05-677Z.json) | `3c91e2b7276a4129c5c5f35624392af45efcb51c41a7833372ca66498d3ebb3c` |
| [protein-gap-with-budget](../../../backend/output/daily-insight-v23-protein-gap-with-budget-2026-10-16T17-27-21-814Z.json) | `15a3799f79f8848107de6c5259d87a8d48f6175fae9c84f7e0e0a9d294036de4` |
| [protein-nearly-complete](../../../backend/output/daily-insight-v23-protein-nearly-complete-2026-10-16T17-27-24-371Z.json) | `6528e04937cc0968b2c6f37a003f4f42ab2167bba7c721f089e730f4f98ea318` |
| [sparse-data-name-fallback](../../../backend/output/daily-insight-v23-sparse-data-name-fallback-2026-10-16T17-26-46-956Z.json) | `6a8f3133d8c1706a3a745256621fcf75e0fab1f2742c07470e918e193c5b9247` |
| [stale-weight](../../../backend/output/daily-insight-v23-stale-weight-2026-10-16T17-27-39-906Z.json) | `9a88bd6fcbaf76b3fac8ef08907b7681fa3aab18768e9fec08c0b61a84866af2` |
| [target-relative-overage-not-achieved-surplus](../../../backend/output/daily-insight-v23-target-relative-overage-not-achieved-surplus-2026-10-16T17-27-19-108Z.json) | `8bfa73d4b865405ee3363f08029d95bbbef5a36e3e43d2e573164e99cea550e2` |
| [unknown-activity](../../../backend/output/daily-insight-v23-unknown-activity-2026-10-16T17-27-11-532Z.json) | `734fd717f25e0adba58694b2477e2ac8ddce3c0382482c2c82ee93f0bf80bf59` |

## Handoff

Return Q1-US03-01 through Q1-US03-05 to Backend, Q1-US03-06 to Frontend, and Q1-US03-07 to Documentation. The Orchestrator owns prioritization and the central register; QA has not accepted, deferred or closed any finding. Corrections require targeted evidence and renewed independent verification of the required gates, not a blind fourth backend loop or client-side suppression of unsafe content. Physical-device checks remain on the manual checklist. Emulator persistence remains separately excluded and unverified.