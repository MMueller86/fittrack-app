# PLAN - Daily Insight Alpha Feedback Corrections

**Related User Story:** `US_Home-Screen-Insights_Feedback_Review.md`  
**Plan type:** Focused follow-up; does not replace the broad Feedback Review plan.  
**Planner:** FitTrack Planner  
**Date:** 2026-10-06  
**Status:** Draft for approval; correct future Daily Insight generations only. Any feedback status update is a gated final operation and does not alter past Insights.  
**Classification:** Accept with modifications  
Infrastructure Impact: Alpha  
Mobile Build Impact: None

The three feedback reports are regression signals for future Daily Insight generation, not a request to repair past outputs or their source data. The plan adds prompt and server-validation safeguards, releases them as v15, and prevents that release from replacing an existing same-date v14 Daily document. Tests use synthetic fixtures only. No Alpha historical source data is to be read or written during implementation, deployment, or QA.

After backend gates pass, Alpha deployment still requires the separate, explicit user command `Deploy to Alpha`. Deployment performs no feedback status or user-data writes. Only after the durable QA report is exactly `PASS` does the Orchestrator invoke FitTrack Backend for the final status-only operation on the three exact feedback records. That operation is the last Alpha data operation in this workflow.

## Open Product Owner Decisions

None. The user statement `2250 scheint nach Ernährungstagebuch richtig zu sein` is used only as a clearly labeled expected value in a synthetic regression fixture. It is not verified against Alpha and is not authority to change past data. No historical-target reconciliation or per-item status eligibility decision is required. FitTrack Backend is the settled owner of the final metadata operation.

## 1. Requirement Assessment

The problem is three reported failure modes in future Daily Insight wording and source selection. Accept with modifications: keep the work limited to future prompt interpretation, deterministic validation, safe cache rollout, and the gated feedback metadata closure. Do not regenerate, rewrite, backfill, or investigate old Insights or source records.

AI remains appropriate for natural-language phrasing; deterministic backend logic must control intent, target provenance, and which claims are supported. `remainingCalories` is intake relative to an effective target, not a measurement of achieved energy balance. No new calorie, protein, or local-hour threshold is proposed. Invalid semantic output follows the existing friendly `unavailable` behavior; it is not persisted as a fresh Insight or quota-tracked.

## 2. Feature Summary

Make three bounded backend corrections for future Daily Insights:

1. **WS-1 - Open-day `phase_progress`:** do not advise increasing calorie intake solely because positive remaining calories are high.
2. **WS-2 - Realized deficit/surplus language:** do not claim an actual achieved energy deficit or surplus from target-relative `remainingCalories` alone.
3. **WS-3 - Historical target in `morning_orientation`:** use only the referenced past day's own available historical target; never substitute today's profile target, and omit or fail safely when the source is missing or ambiguous.

Ship the combined prompt change as v15 for new Daily documents. Preserve already-generated same-date v14 documents until their existing expiry; after expiry or on a new date, an eligible generation uses v15. Keep the Strict Structured Output schema, public/mobile API, quota contract, and persistence schema unchanged. After the release and QA gates, set only the three feedback records' `processingStatus` to `Done`.

| Reported signal | Workstream | Regression coverage |
|---|---|---|
| Open-day `phase_progress` suggests increasing calories from remaining budget | WS-1 | Semantic unit test and synthetic prompt eval |
| Target-relative overage is described as an achieved deficit | WS-2 | Semantic unit test and synthetic prompt eval |
| Morning narrative substitutes today's profile target for a past day | WS-3 | Context/semantic unit tests and synthetic prompt eval |

## 3. Current Behaviour

- `phase_progress` maps to the weight prompt module. Existing open-budget prompt guards do not forbid calorie-increase advice for this intent when there is a protein gap. The semantic validator checks some open-day and negative-budget wording, but does not reject the reported inference or achieved-deficit/surplus claims.
- `dailyInsightContext.ts` attaches an `effectiveTargetCalories` and `targetSource` to each `last3Days` entry. The shared resolver can use a per-day snapshot, a stored special-activity target, or `profile_fallback`. The morning prompt does not require claims to be grounded in that past day's own source, and the semantic validator does not verify explicit historical target claims.
- The prompt bundle is v14 and its release manifest is append-only. `shouldRegenerate` currently hard-invalidates prompt-version and prompt-identity mismatches. A v15 deployment would therefore be capable of regenerating an existing same-date v14 document unless the rollout behavior is changed.
- The existing Admin-authorized feedback status route conditionally patches only `/processingStatus`, but its repository currently point-reads a full feedback document before patching. That read includes content and provenance fields the final operation is not allowed to inspect; the repository read must be narrowed before the route can be used for the final operation.
- Feedback states are `Open`, `Done`, and `Rejected`. `Done` means reviewed and handled. No `Closed` value is supported.

## 4. Desired Behaviour

- For `phase_progress` with positive `remainingCalories`, remaining budget alone never justifies advice to increase total calorie intake. Preserve progress-oriented and independently supported non-nutrition responses. Do not add a time-of-day cutoff.
- A response may accurately compare consumed intake with the effective target when context supports that comparison. It must not present an achieved or actual energy deficit/surplus as a fact when only target-relative remaining calories are available. Apply this rule across all user-visible fields.
- For `morning_orientation`, each past-day statement is resolved against the matching `last3Days` entry and its own `effectiveTargetCalories` and `targetSource`. A current profile target or `profile_fallback` is not evidence of that past day's recorded target. If the source is missing, unavailable, or ambiguous, omit the numerical/directional claim or reject the response to the existing `unavailable` result.
- A v15 prompt-identity mismatch alone never replaces an unexpired same-date v14 Daily document. Preserve that document's response and provenance through its existing expiry, including for Admin requests. Once it is expired/absent, or for a new date, an eligible new document uses v15.
- The final feedback operation reads only a projected set of permitted identity/state fields from the three exact feedback records and conditionally changes only `processingStatus` from `Open` to `Done`. It does not read or change any past Daily Insight or source data.

## 5. Scope

- Update the active Daily prompt bundle and semantic validator for WS-1 through WS-3.
- Validate historical target claims against the referenced per-day context, allowing only an unambiguous per-day target source; treat `profile_fallback` as insufficient for a historical claim.
- Bump the active prompt release once to v15 and append a v15 manifest entry without rewriting v14 history.
- Change cache rollout behavior so deployment of v15 cannot replace an unexpired same-date v14 Daily document; add the narrow cache regression and verify v15 use after expiry/new date.
- Add synthetic unit, prompt-eval, and Cosmos-emulator contract coverage for the three behaviors, cache preservation, provenance, and the status-operation read/write boundary.
- Before the final operation, change the existing feedback status repository path from full-document reads to a narrow projection containing only `date`, exact `userComment`, `submittedAt`, `_docType`, `promptVersion`, `userId`, `id`, and `processingStatus`. Keep the existing Admin-authenticated route and conditional single-field patch; do not change its public contract.
- Update `docs/kb/tech/06-ai-integrations.md` and `docs/kb/domain/07-ai-features.md` after implementation.
- Deploy the backend correction to Alpha only after backend gates and a separate explicit `Deploy to Alpha` command. Require QA `PASS` before the final Backend status operation.

During implementation, deployment, and QA, do not read or write Alpha historical Insights, Diary, DayMeta, profile, or other user records; do not query Alpha feedback. Synthetic fixtures and the documented release health check are the only QA/release inputs. The separately gated final operation is limited to the three feedback records and the exact projection fields above.

## 6. Out of Scope

- Any regeneration, rewrite, backfill, migration, or correction of an already-generated Daily Insight.
- Any change to existing Diary, DayMeta, `calorieTargetSnapshot`, profile, feedback content, prompt snapshots, or other historical user data.
- Any Alpha historical-source verification/read, including investigating previously reported target values. The reported values are not implementation, release, QA, or status-operation prerequisites.
- Mobile UI, shared/public API types, request/response shapes, routes, quota behavior, Strict Structured Output schema, new Cosmos fields/containers/partition keys, Bicep resources, or migrations.
- New calorie/protein/local-hour thresholds, general prompt redesign, or broad Insight refactoring.
- Any feedback status write during implementation, deployment, or QA; any status other than `Done` for this final operation; broad query updates; or per-item closure based on historical-target evidence.
- Editing `docs/qa/findings.md` or changing a QA finding while planning.

## 7. Confirmed Facts

- The three reports are signals about generated wording/source selection. Their historical source records have not been verified for this plan and must not be read to resolve them.
- Earlier notes mention a reported historical snapshot value of 2500 and a reported current-profile fallback value of 2000. Both are unverified report context only; neither is queried or used as an expected historical value. The user's 2250 note is separately identified as a synthetic expected historical target. In the source-selection fixture, 2250 is the synthetic past-day snapshot and 2000 is an independently specified synthetic current-profile control; the identical number in an old report does not make that fixture value Alpha data.
- `resolveHistoricalTarget` distinguishes `day_target_snapshot`, `special_activity_snapshot`, `profile_fallback`, and `unavailable`. The first two are per-day stored sources; a profile fallback is not a recorded historical target.
- The current `morning_orientation` module lacks a source-provenance rule. The semantic validator does not currently validate actual deficit/surplus wording or historical target statements.
- The active prompt is v14. Prompt version, bundle fingerprint, system-prompt hash, intent, and snapshot participate in the current hard cache invalidation path.
- New Daily documents persist prompt provenance, and new feedback copies provenance from the exact Daily instance. Existing optional legacy fields remain readable; this plan requires no schema migration.
- The current feedback status handler requires Admin authorization and delegates to an existing conditional point patch that changes `/processingStatus`. Its current repository pre-read is full-document and must be narrowed for this operation.
- No Alpha data was accessed while preparing this plan. No actual historical target value is established here.

## 8. Proposed Technical Solution

### WS-1 - Open-day `phase_progress` recommendation

Add a focused prompt guard when `intent === 'phase_progress'` and `remainingCalories > 0`: do not recommend increasing calorie intake solely to consume the remaining budget or imply that the user is under-eating. Add a matching deterministic semantic guard over title, summary, recommendation, and CTA so provider wording cannot bypass the prompt. Preserve valid weight/progress and independent non-nutrition responses. Use a synthetic local-hour-12 case with positive remaining calories and a material protein gap; the hour is fixture context, not a new threshold.

### WS-2 - Realized deficit/surplus language

Clarify the shared tone contract that a target-relative difference is not a measured energy balance. Add deterministic validation for explicit claims that an actual/achieved calorie deficit or surplus exists when the context supplies only target-relative values. Check all user-visible fields. Retain supported statements explicitly framed as intake above or below the effective target. A rejected response follows the existing friendly `unavailable` contract and is neither freshly cached/persisted nor quota-tracked.

### WS-3 - Historical target in `morning_orientation`

Update `promptMorning.ts` to associate every historical comparison with its referenced `last3Days` entry and that entry's own target/source. For a past day, never substitute today's target. Validate explicit numerical and directional statements against that entry. `day_target_snapshot` and `special_activity_snapshot` may support a historical claim when the effective value is present and unambiguous; `profile_fallback`, missing, invalid, unavailable, or ambiguous source cannot support an asserted historical target. The prompt requests omission in those cases; the validator rejects unsupported claims to the existing `unavailable` response.

Use a synthetic source-selection fixture with historical `day_target_snapshot = 2250` and a separate synthetic current profile target of `2000`; assert the historical statement follows the per-day 2250 source, not today's 2000. Add a separate missing/ambiguous-source control that permits no numerical/directional claim or returns `unavailable`. Do not load the previously reported 2500/2000 Alpha values, infer their truth, or change any past record.

### Prompt release, cache, and provenance

- Increment `DAILY_INSIGHT_PROMPT_VERSION` once to v15 for the combined provider-visible change. Append a v15 manifest entry; preserve the v14 manifest entry, fingerprint, and history. Update `TESTED_PROMPT_VERSION` only after reviewing all synthetic fixture constraints and passing the required live eval.
- Add a v14-to-v15 cache-preservation branch before ordinary prompt-mismatch/admin regeneration decisions. While the existing v14 document is unexpired, serve its stored response and provenance without provider call or upsert; do not extend or rewrite its TTL/expiry. When it is expired/absent, or the date key is new, an eligible generated document uses v15. Cover both Admin and non-Admin cache requests.
- Newly generated v15 Daily documents persist the current version, fingerprint, exact prompt snapshot, and system-prompt hash. New feedback continues to copy provenance from its exact Daily instance. No existing document is rewritten or backfilled.
- Keep `DAILY_INSIGHT_SCHEMA`, `InsightResponse`, API routes, quota key/order, and the friendly failure contract unchanged.

### Final status-operation read boundary

The existing status repository path must use a partition-scoped metadata projection instead of `item.read<InsightFeedbackDocument>()`. The projection may contain only `date`, `userComment`, `submittedAt`, `_docType`, `promptVersion`, `userId`, `id`, and `processingStatus`; it must not materialize `response`, `inputContext`, `promptSnapshot`, or other feedback content. The existing Admin route and exact `(id, userId)` conditional patch remain in place. The patch request must contain exactly one operation: set `/processingStatus`. A synthetic contract test verifies that all other stored feedback fields remain unchanged. Alpha postchecks use the same allowed projection and do not read content fields.

### Persistence Impact

No schema change or migration. Daily Insight and feedback continue using the existing `aiInsights` container and `/userId` partition. The status-operation change narrows reads and retains the existing status field and conditional patch; deployment requires no Cosmos/Bicep update.

## 9. Acceptance Criteria

- **AC-1** With a synthetic `phase_progress` case (local hour 12, positive `remainingCalories`, and a material protein gap), neither the prompt nor server validation permits advice to increase calorie intake solely because calories remain. No new time-of-day threshold is introduced.
- **AC-2** Unit tests reject the synthetic open-day calorie-increase recommendation and accept at least one valid progress-oriented or non-nutrition response, so the guard does not suppress the intent indiscriminately.
- **AC-3** With synthetic negative `remainingCalories`, validation rejects an actual/achieved energy-deficit or surplus claim unsupported by measured energy-balance context, while allowing a supported target-relative comparison.
- **AC-4** The deficit/surplus guard checks every user-visible output field. Rejection returns the existing HTTP 200 `unavailable` response, does not persist/cache a fresh Insight, and does not track Daily quota.
- **AC-5** The morning prompt and validator bind every explicit historical numerical/directional target claim to the referenced past day's own available target/source. Today's profile target and `profile_fallback` cannot support a historical claim. Missing, unavailable, or ambiguous source results in omission or the existing `unavailable` response.
- **AC-6** Synthetic source-selection tests use a historical snapshot of 2250 (the user's expected value, labeled synthetic only) and a distinct current-profile control of 2000, and prove that the historical statement follows the snapshot rather than the current profile. A separate missing/ambiguous-source control permits no numerical/directional historical claim or returns `unavailable`. The old reported 2500 snapshot and 2000 fallback are not read, verified, or used as test oracles; the synthetic 2000 has fixture-only provenance. No historical data is written.
- **AC-7** The active prompt release is v15, the v14 manifest entry is unchanged, and the active fingerprint/version guard is verified. An unexpired same-date v14 Daily document is not regenerated or overwritten solely due to v15 prompt identity, including for Admin requests; its response/provenance remain unchanged until expiry. A new date or eligible request after expiry generates with v15.
- **AC-8** Strict Structured Outputs, public/mobile response/API contracts, quota behavior, Cosmos schema, and migration requirements remain unchanged.
- **AC-9** Unit and Cosmos-emulator contract coverage verifies the semantic cases, v15 provenance persistence and exact-instance feedback provenance copy, plus metadata-only status pre/post reads and a patch limited to `/processingStatus`. Tests use synthetic documents; contract tests never target real Azure Cosmos.
- **AC-10** Three v15 prompt-eval fixtures cover WS-1 through WS-3 using synthetic inputs only. The historical fixtures keep the user-provided expected value separate from the synthetic current-profile control and include a missing/ambiguous-source case. The live eval passes before Backend handoff; unavailable Azure OpenAI credentials are a blocking implementation gate, not a pass.
- **AC-11** `docs/kb/tech/06-ai-integrations.md` and `docs/kb/domain/07-ai-features.md` describe the implemented v15 behavior and cache-preservation rule; no unrelated Knowledge Base documents are changed.
- **AC-12** Alpha deployment occurs only after backend gates pass and the user separately issues `Deploy to Alpha`. Deployment performs no feedback status or historical user-data writes and does not regenerate existing Daily documents. QA reviews the release evidence before the final status operation.

## 10. Post-QA Operational Completion Criteria

These are final operational gates, not additional QA criteria. The status operation is the last Alpha data operation in the workflow.

- **OC-1 - QA and release gate:** Do not start unless the durable report at `docs/qa/reports/PLAN_US_Home-Screen-Insights_Alpha-Feedback-Corrections.md` has exactly one verdict, `PASS`, evidence for every criterion in Section 9, and the Backend handoff and Alpha release/health checks have passed. The release must follow the user's separate explicit `Deploy to Alpha` command. Missing/invalid report, `PASS WITH ISSUES`, `FAIL`, missing command, or failed gate means zero status writes.
- **OC-2 - Owner and read scope:** After OC-1, the Orchestrator invokes **FitTrack Backend** for this final operation. Using the operator-supplied exact `(date, userComment, submittedAt)` tuples, read only the three exact feedback records through the permitted metadata projection: `date`, exact `userComment`, `submittedAt`, `_docType`, `promptVersion`, `userId` (partition), `id`, and `processingStatus`. Require `_docType = 'insightFeedback'`, `promptVersion = 'v14'`, exact partition/id, and stored `processingStatus = 'Open'`. Do not use `SELECT *` or a full-document point read. Do not read Daily Insight, `inputContext`, `promptSnapshot`, response, DayMeta, Diary, profile, or any other historical user data. Do not copy IDs or comments into this plan or another repository artifact.
- **OC-3 - Batch precheck:** Resolve exactly one record per supplied tuple and complete all three identity/state prechecks before the first write. If any match is missing, duplicated, mismatched, not v14, not `Open`, or fails its exact partition/id check, stop with zero writes. There is no source-history gate and no per-item partial closure.
- **OC-4 - Conditional updates and postchecks:** Only after all prechecks pass, conditionally update each exact record to `processingStatus: 'Done'` through the existing Admin-authorized `PATCH /api/ai/daily-insight/feedback/status` path. The repository must patch only `/processingStatus`, guarded by `_docType = 'insightFeedback'` and current `Open` status. Do not use `Closed`, broad query updates, bulk updates, or migrations. After each successful update, re-read only the allowed projection and verify unchanged identity fields plus `processingStatus = 'Done'`. Verify the update operation contains only the status path; this and the synthetic contract test establish that feedback content was not changed without reading content fields in Alpha. Stop at the first update or postcheck anomaly; do not retry blindly or roll back a terminal state.
- **OC-5 - Completion/reporting:** The workflow is complete only after all three conditional updates and all three postchecks succeed. Backend reports only counts of unique prechecks, updates, and successful postchecks, plus any stopped condition. Do not expose credentials, copy user IDs/comments into repository artifacts, or edit `docs/qa/findings.md`.

## 11. Backend Work Package - Future Daily Insight Corrections

**Agent:** Backend  
**Goal:** Implement WS-1 through WS-3 for future generations, protect existing v14 same-date cache entries, enforce the narrow feedback status-operation read boundary, add synthetic regressions/evals, update the related Knowledge Base, and hand off complete evidence. Do not perform Alpha reads/writes or final status closure in this package.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/05-authentication.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/09-api-reference.md`

**Required Repository Context:**
- `backend/src/lib/prompts/dailyInsightPrompt.ts`
- `backend/src/lib/prompts/sharedTone.ts`
- `backend/src/lib/prompts/promptWeight.ts`
- `backend/src/lib/prompts/promptMorning.ts`
- `backend/src/lib/prompts/promptNutrition.ts`
- `backend/src/lib/dailyInsightValidation.ts` and `backend/src/lib/dailyInsightValidation.test.ts`
- `backend/src/lib/dailyInsightContext.ts` and `backend/src/lib/dailyInsightContext.test.ts`
- `shared/lib/weeklyReviewCalculator.ts`
- `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts` and `backend/src/lib/prompts/dailyInsight.eval.test.ts`
- `backend/src/lib/prompts/dailyInsightPromptManifest.ts` and its tests
- `backend/src/functions/dailyInsight.ts` and `backend/src/functions/dailyInsight.test.ts`
- `backend/src/functions/dailyInsightFeedback.ts` and `backend/src/functions/dailyInsightFeedback.test.ts`
- `backend/src/lib/repositories/insightRepository.ts` and `backend/src/lib/repositories/insightRepository.test.ts`
- `backend/src/lib/repositories/cosmosInsightRepository.contract.test.ts`

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- Open-day `phase_progress` guard and valid control
- Target-relative versus achieved energy-balance validation
- Past-day target-source selection and missing/ambiguous controls
- v15 release, v14 cache preservation, and provenance
- Metadata-only feedback status operation and single-field patch
- Knowledge Base and synthetic test/eval evidence

**Dependencies:** None

**Expected Handoff:**
- Implementation notes for the three workstreams and the cache/status read-boundary changes, with touched files.
- Passing focused unit tests, full backend unit/type/build verification, offline prompt release verification, and Cosmos-emulator contract tests using synthetic records only.
- Passing v15 live prompt eval for all three synthetic scenarios; report a blocker if credentials/eval are unavailable.
- Evidence that v14 same-date cache content is preserved until expiry and eligible new documents use v15.
- Evidence that the status operation reads only permitted metadata fields and patches only `processingStatus`; no Alpha status operation, source read, or data write in this package.
- Updated Knowledge Base documents named above; no public API, schema, quota, or mobile change.

## 12. Alpha Release Gate - Explicit `Deploy to Alpha` Command

This is a direct operational command for Infrastructure & Release, not feature implementation work. It remains a separate user gate after all Backend gates pass.

**Agent:** Infrastructure & Release  
**Goal:** Deploy the QA-ready backend correction only after the user explicitly issues `Deploy to Alpha`; make no feedback status or historical user-data writes.

**Required Knowledge Base:**
- `docs/kb/tech/01-system-overview.md`
- `docs/kb/tech/07-infrastructure.md`

**Required Repository Context:**
- `_deploy_staging/`
- `backend/host.json`
- `backend/package.json`
- `infra/parameters/alpha.bicepparam`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- Explicit Alpha deployment gate and clean release evidence
- No feedback status or historical-data writes during deployment

**Dependencies:** Backend handoff complete with required tests/evals passing; separate explicit user command `Deploy to Alpha`.

**Stop Conditions:**
- Without the explicit command, do not deploy and do not run the final status operation.
- Stop on invalid/expired authentication, failed clean build, failed staging sync/artifact check, failed publish, or failed health check. Do not perform a feedback status update.
- No Bicep, infrastructure resource, Cosmos schema, or settings change is planned.

**Expected Handoff:**
- FitTrack Release Report with clean-build, staging-sync, deployment, function-list, and health-check results.
- Confirmation that deployment did not write feedback status or historical user data.
- `Dev Build Required: NO`; no EAS build.

## 13. QA Work Package - Full Correction Review

**Agent:** QA  
**Goal:** Independently verify all criteria, synthetic regressions/evals, release identity/cache preservation, documentation, metadata-only status-operation code, and Alpha deployment evidence. Do not query Alpha feedback/history or change feedback status.

**Required Knowledge Base:**
- `docs/kb/domain/01-nutrition-model.md`
- `docs/kb/domain/04-profile-goals.md`
- `docs/kb/domain/07-ai-features.md`
- `docs/kb/tech/06-ai-integrations.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- The implementation and test files listed in the Backend Work Package
- `docs/qa/reports/README.md`
- The Infrastructure & Release Report handoff

**Required Skills:**
- `azure-openai-feature-integration`

**Relevant Acceptance Criteria:**
- Every criterion in Section 9; QA validates the complete set

**Dependencies:** Completed Backend handoff and successful Alpha release handoff after the explicit deployment command.

**Expected Handoff:**
- Durable report at `docs/qa/reports/PLAN_US_Home-Screen-Insights_Alpha-Feedback-Corrections.md` using `fittrack-qa-v1`, exactly one verdict, and a result/evidence row for every criterion.
- Non-empty response manifest naming the report path and verdict.
- Separate `UNVERIFIED` notes for environment-limited checks; no unsupported `PASS` claim.
- Explicit confirmation that QA did not read Alpha feedback/history, write feedback status, or edit `docs/qa/findings.md`.

## 14. Test Strategy

- Unit tests in `dailyInsightValidation.test.ts` cover WS-1/WS-2 rejection and valid controls across visible fields. `dailyInsightContext.test.ts` covers synthetic per-day snapshot, activity-snapshot, profile-fallback, and unavailable source distinctions; no Alpha records are loaded.
- Prompt composition tests in `dailyInsightPrompt.test.ts` verify guard inclusion and v15 snapshots. Manifest tests verify append-only v14 history and the active v15 fingerprint.
- A focused `insightRepository.test.ts` or `dailyInsight.test.ts` regression proves an unexpired same-date v14 document is not regenerated/upserted solely because v15 is active, including the Admin path. The expired/missing cache and new-date controls prove eligible new documents use v15.
- Synthetic Cosmos-emulator contract coverage verifies new Daily/feedback provenance and status repository query projection. It checks the status update contains exactly one patch operation for `/processingStatus` and that all other synthetic feedback fields remain unchanged. Contract tests never use real Azure Cosmos.
- Backend unit/type/build checks: `cd backend && npx vitest run`; `npm run build:verify --workspace=backend`.
- Offline prompt release guard: `npm run verify:daily-insight-prompt --workspace=backend`.
- Live Azure prompt eval with synthetic fixtures: `cd backend && npm run test:eval`. All v15 assertions must pass before Backend handoff; unavailable credentials are not a pass. No Alpha records or identifiers are sent to the eval.
- Cosmos contract suite, local/CI emulator only: `cd backend && npx vitest run --config vitest.contract.config.mts`.
- QA records commands, exit codes, results, and environment limits in the durable report. No implementation, deployment, or QA test targets Alpha historical data.

## 15. Risks and Edge Cases

- Text-semantic guards can overmatch or miss German paraphrases. Keep them scoped to explicit calorie-increase, achieved deficit/surplus, and historical-target claims; include negative and valid controls; prefer the existing `unavailable` response when support is unclear.
- A live prompt eval can be unavailable because shared Azure OpenAI credentials or service capacity are unavailable. This blocks Backend handoff rather than demonstrating a pass.
- **Cross-partition status risk:** the three feedback items may belong to separate `/userId` partitions, so Cosmos cannot make their status patches one atomic transaction. Complete all three exact identity/state prechecks before the first write; any precheck failure means zero writes. If a conditional write or postcheck fails after writes begin, stop immediately, report the actual states using only the permitted projection, and do not continue, retry blindly, or roll back. No per-item closure is allowed for any historical-target reason; completion requires all three postchecks.
- Alpha deployment requires the separate explicit user command. Plan approval, Backend completion, or QA acceptance does not substitute for it.

## 16. Recommended Execution Order (Strictly Sequential)

1. **Backend Work Package:** implement WS-1 through WS-3, the v15 cache-preservation behavior, and metadata-only status repository reads; complete unit, emulator contract, build, offline prompt, live eval, and Knowledge Base gates. Do not access Alpha records or update feedback status.
2. **Alpha Release Gate:** only after Backend gates pass and the user explicitly issues `Deploy to Alpha`; Infrastructure & Release deploys the backend correction and completes documented health checks. Do not write feedback status or historical data.
3. **QA Work Package:** independently verify the full implementation and release handoff and write the durable report. Only the exact verdict `PASS` opens the final status gate. `PASS WITH ISSUES`, `FAIL`, or missing/invalid QA evidence means no status writes.
4. **Final Post-QA Backend Operation:** after the Orchestrator validates the exact QA `PASS` and successful release gates, FitTrack Backend performs all three projection-only prechecks, then the three conditional `Done` updates and all three postchecks. If any precheck fails, write nothing. If any update/postcheck is anomalous, stop and report; do not partially close items based on source evidence. This is the final Alpha data operation; workflow completion requires all three verified `Done` states.

## 17. Approval Gate

This artifact is a planning draft. Plan approval may start the Backend Work Package but does not authorize an Alpha deployment or feedback status change. `Deploy to Alpha` remains a separate explicit user command after Backend gates; deployment performs no feedback status or historical-data writes. QA must produce the exact durable `PASS` report before the final FitTrack Backend operation. The final operation is limited to the three feedback metadata projections and `processingStatus` fields, uses `Done`, leaves feedback content and all historical Insights/source data unchanged, and is the final Alpha data operation. No historical verification, correction, or Product Owner decision is outstanding.