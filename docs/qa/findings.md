# FitTrack QA Findings Register

This file is the durable register for actionable QA findings and workflow findings.
The Orchestrator is the single writer. Findings are never deleted; their status and history are updated instead.

## Status Legend

- `Awaiting decision` - the user has not decided whether to fix, accept, or defer the finding.
- `Fix requested` - correction work was requested and is waiting to start.
- `In progress` - correction or workflow remediation is underway.
- `Resolved` - the owner reports a correction; targeted QA verification is still required.
- `Closed` - targeted QA verified the correction.
- `Accepted` - the user explicitly accepted the remaining risk.
- `Deferred` - the user explicitly postponed the work.

`VERIFIED`, `UNVERIFIED`, and `MANUAL VALIDATION REQUIRED` are verification states, not finding criticalities.

## Finding Index

| ID | Plan / scope | Criticality | Owner | Status |
|---|---|---|---|---|
| FT-QA-2026-001 | Weekly review plan, AC-8 | Non-blocking | Frontend | Awaiting decision |
| FT-QA-2026-002 | Weekly review documentation handoff | Non-blocking | Documentation | Awaiting decision |
| FT-QA-2026-003 | Weekly insight AI implementation | Suggestion | Backend | Awaiting decision |
| FT-QA-2026-004 | Weekly insight eval fixtures | Non-blocking | Backend | Awaiting decision |
| FT-QA-2026-005 | Agent routing workflow | Blocking | Orchestrator | In progress |
| FT-QA-2026-006 | Agent invocation fallback workflow | Blocking | Orchestrator | In progress |
| FT-QA-2026-007 | Planner artifact and session handoff | Blocking | Planner / Orchestrator | In progress |
| FT-QA-2026-008 | Durable QA finding persistence | Blocking | Orchestrator | In progress |
| FT-QA-2026-009 | Daily Insight protein-nearly-complete eval, AC-9 | Blocking | Backend | Closed |
| FT-QA-2026-010 | Daily feedback capability signal, AC-25 | Blocking | Backend | Closed |
| FT-QA-2026-011 | Daily handler test coverage, AC-15 | Blocking | Backend | Closed |
| FT-QA-2026-012 | Daily timezone offset handling, AC-16 | Non-blocking | Backend | Awaiting decision |
| FT-QA-2026-013 | Mobile InsightCard component test coverage, AC-26 | Non-blocking | Frontend | Awaiting decision |
| FT-QA-2026-014 | Persisted plan approval status, AC-27 | Non-blocking | Planner | Awaiting decision |
| FT-QA-2026-015 | Daily stale-weight eval, AC-2 | Blocking | Backend | Closed |
| FT-QA-2026-016 | Daily weight-outlier forbidden tone, AC-1/AC-11 | Blocking | Backend | Closed |
| FT-QA-2026-017 | Daily activity-budget eval instability, AC-3/AC-9 | Blocking | Backend | Closed |
| FT-QA-2026-018 | Daily protein-gap budget consistency, AC-9 | Blocking | Backend | Closed |
| FT-QA-2026-019 | Weight-trend rename staging artifact, AC-1 | Blocking | Infrastructure | Closed |
| FT-QA-2026-020 | Weight-trend rename plan/source conflict, AC-2 | Blocking | Planner / Orchestrator | Closed |
| FT-QA-2026-021 | Daily feedback processing status documentation | Non-blocking | Backend | Closed |
| FT-QA-2026-022 | Daily prompt fingerprint mutation coverage, AC-3 | Blocking | Backend | Closed |
| FT-QA-2026-023 | Daily prompt provider-input guard coverage, AC-4 | Blocking | Backend | Closed |
| FT-QA-2026-024 | Daily cache provenance comparison, AC-7/AC-14 | Blocking | Backend | Closed |
| FT-QA-2026-025 | Pre-existing Daily Insight syntax error blocking backend build | Blocking | Backend | Awaiting decision |

## Actionable Findings

### FT-QA-2026-001

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick.md`
- **Acceptance criterion:** AC-8
- **Description:** `HomeScreen.tsx` protects against stale weekly responses with request IDs, but Focus and refresh triggers are not debounced or coalesced. Parallel weekly requests can therefore still be started.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/modules/home/HomeScreen.tsx`; QA review reported the missing Focus/Refresh debounce.
- **Recommendation:** Add request coalescing or a short debounce for Focus, pull-to-refresh, and retry triggers, with a focused regression test.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred`.
- **History:** 2026-08-19 - Imported from the previous QA report.

### FT-QA-2026-002

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick.md`
- **Acceptance criterion:** Documentation handoff
- **Description:** `docs/kb/tech/02-backend.md` still lists the old diary GET route, while the implementation and API reference use `GET /api/diary?date=YYYY-MM-DD`.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** `docs/kb/tech/02-backend.md`; `docs/kb/tech/09-api-reference.md`; `backend/src/functions/diary.ts`.
- **Recommendation:** Align `02-backend.md` with the implemented route and keep `09-api-reference.md` as the contract reference.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred`.
- **History:** 2026-08-19 - Imported from the previous QA report.

### FT-QA-2026-003

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick.md`
- **Acceptance criterion:** AC-15 / AI regression
- **Description:** The weekly insight request uses `temperature: 0.3`. A deterministic temperature of `0` may be more appropriate for this short, structured evaluation.
- **Criticality:** Suggestion
- **Owner:** Backend
- **Evidence:** `backend/src/lib/openai.ts`; the weekly insight generation request sets `temperature: 0.3`.
- **Recommendation:** Evaluate changing the value to `0`, then update the focused request test and run the prompt eval when Azure credentials are available.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred`.
- **History:** 2026-08-19 - Imported from the previous QA report.

### FT-QA-2026-004

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick.md`
- **Acceptance criterion:** AI eval and totals consistency
- **Description:** The `mixed-data-and-adjusted-activity-target` weekly eval fixture reports totals that do not match the calculator inclusion rules. It counts data that has no valid target.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/prompts/weeklyInsight.eval.fixtures.ts`; `shared/lib/weeklyReviewCalculator.ts`.
- **Recommendation:** Recalculate the fixture totals from the same inclusion rules as the calculator and add a deterministic consistency assertion.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred`.
- **History:** 2026-08-19 - Imported from the previous QA report.

### FT-QA-2026-005

- **Plan reference:** `N/A - agent workflow`
- **Acceptance criterion:** `N/A`
- **Description:** The Orchestrator agent list used identifier slugs for agents whose custom-agent names include spaces. A first handoff failed at routing, indicating that the configured identifiers were not reliably aligned with the available custom agents.
- **Criticality:** Blocking
- **Owner:** Orchestrator
- **Evidence:** `.github/agents/fittrack-orchestrator.agent.md`; prior workflow log reported a failed first agent handoff.
- **Recommendation:** Use the exact effective custom-agent names in the `agents` allow-list and verify routing with a harmless smoke test.
- **Status:** In progress
- **Decision:** User requested this workflow correction on 2026-08-19.
- **History:** 2026-08-19 - Imported and remediation started.

### FT-QA-2026-006

- **Plan reference:** `N/A - agent workflow`
- **Acceptance criterion:** `N/A`
- **Description:** After a subagent handoff failed, the workflow used a standard-agent fallback instead of reporting the invocation failure as a process error.
- **Criticality:** Blocking
- **Owner:** Orchestrator
- **Evidence:** Prior workflow log reported that the first handoff failed and the same package was re-submitted through a standard agent.
- **Recommendation:** Stop on invocation or routing failure, report the exact process error, preserve the task package, and wait for user direction. Never substitute an unrelated or standard agent automatically.
- **Status:** In progress
- **Decision:** User requested this workflow correction on 2026-08-19.
- **History:** 2026-08-19 - Imported and remediation started.

### FT-QA-2026-007

- **Plan reference:** `N/A - planning workflow`
- **Acceptance criterion:** `N/A`
- **Description:** A plan was at one point available only through a temporary Copilot session path outside the repository, and the path could not be resolved reliably for a later handoff.
- **Criticality:** Blocking
- **Owner:** Planner / Orchestrator
- **Evidence:** Prior workflow log referenced an unresolved session-file path and a plan that was not yet present in the repository.
- **Recommendation:** Require a verified `PLAN_*.md` artifact under `docs/User Stories/**` before plan-driven execution. Do not reconstruct an approved plan from temporary session files.
- **Status:** In progress
- **Decision:** User requested this workflow correction on 2026-08-19.
- **History:** 2026-08-19 - Imported and remediation started.

### FT-QA-2026-008

- **Plan reference:** `N/A - QA workflow`
- **Acceptance criterion:** `N/A`
- **Description:** `PASS WITH ISSUES` previously ended the workflow with findings only in the chat log. There was no durable central register, no stable finding ID, and no explicit user decision between correction and acceptance or deferral.
- **Criticality:** Blocking
- **Owner:** Orchestrator
- **Evidence:** Existing `orchestrator.instructions.md` ended `PASS WITH ISSUES` immediately and defined no durable finding artifact.
- **Recommendation:** Persist actionable findings in this file, ask the user per finding whether to fix, accept, or defer, and update status and history without deleting entries.
- **Status:** In progress
- **Decision:** User requested this workflow correction on 2026-08-19.
- **History:** 2026-08-19 - Register created and remediation started.

### FT-QA-2026-009

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-9
- **Description:** A live Azure OpenAI Daily evaluation fails for the nearly complete protein case. The provider response is rejected by `validateBudgetSemantics` because it judges an open day as completed, so the required eval suite does not pass.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `cd backend && npm run test:eval` exits 1; `backend/src/lib/prompts/dailyInsight.eval.test.ts`; `backend/src/lib/dailyInsightValidation.ts`; 25/26 eval tests passed.
- **Recommendation:** Correct the v10 nutrition prompt and/or semantic contract so a valid nearly-complete protein context produces a non-contradictory response, then rerun the complete eval suite.
- **Status:** Closed
- **Decision:** Correction requested by the Orchestrator after QA FAIL; the second full QA re-review verified the protein-nearly-complete scenario and closed the finding.
- **History:** 2026-08-20 - Imported from the Dedicated QA report; correction routed to Backend. 2026-08-20 - First WP4 correction applied; `npm run test:eval` was reported as 26/26, but targeted QA re-run still failed the case. 2026-08-20 - Second and final correction applied; complete eval passed 26/26. 2026-08-20 - QA re-review verified F-01 PASS; closed.

### FT-QA-2026-010

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-25
- **Description:** Mobile treats a missing `feedbackAvailable` field as available, while the Daily backend never emits the server-owned capability field. A legacy or incomplete Daily can therefore show the Kebab menu and fail only after submit.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/functions/dailyInsight.ts`; `mobile/src/modules/home/InsightCard.tsx`; `docs/kb/tech/09-api-reference.md` documents the divergence.
- **Recommendation:** Emit `feedbackAvailable: false` for Daily responses whose stored instance lacks complete feedback provenance, keep the POST guard authoritative, and add a regression test for legacy trigger visibility.
- **Status:** Closed
- **Decision:** Correction requested by the Orchestrator after QA FAIL; targeted QA re-review confirmed the server-owned capability signal and regression coverage.
- **History:** 2026-08-20 - Imported from the Dedicated QA report; correction routed to Backend. 2026-08-20 - F-02 correction applied; Daily capability signal and regression tests added, focused suite 63/63 and Backend regression 817 tests passed. 2026-08-20 - QA re-review marked F-02 PASS; closed.

### FT-QA-2026-011

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-15
- **Description:** The substantially changed Daily GET handler has no colocated handler test and no Daily handler cases in the existing AI handler tests. The full unit suite therefore does not exercise the Daily auth, context-failure, cache, quota-200, persistence, or post-success tracking paths.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/functions/dailyInsight.ts`; no `backend/src/functions/dailyInsight.test.ts`; `.github/instructions/qa.instructions.md` requires HTTP handler happy-path and error-case tests.
- **Recommendation:** Add colocated Daily handler tests for authentication, invalid date/time behavior, cache invalidation, unavailable context/provider results, quota exhaustion with HTTP 200, no tracking on failure, persistence, and successful tracking.
- **Status:** Closed
- **Decision:** Correction requested by the Orchestrator after QA FAIL; targeted QA re-review confirmed the Daily handler tests and required paths.
- **History:** 2026-08-20 - Imported from the Dedicated QA report; correction routed to Backend. 2026-08-20 - F-03 correction applied; Daily handler tests added, 12/12 focused, 827 Backend tests, and 26/26 evals passed. 2026-08-20 - QA re-review marked F-03 PASS; closed.

### FT-QA-2026-012

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-16
- **Description:** Mobile sends `timezoneOffsetMinutes`, but the Daily handler does not read or validate it. Current-day detection, Daily TTL, and `expiresAt` remain UTC-based, so local-date requests near a UTC boundary can receive a mismatched activity status or expiry.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** `mobile/src/services/insightService.ts`; `backend/src/functions/dailyInsight.ts`; `backend/src/lib/repositories/insightRepository.ts`; `docs/kb/tech/09-api-reference.md`.
- **Recommendation:** Either implement and test the planned validated offset semantics or remove the parameter from the approved contract and document the remaining UTC behavior before Alpha.
- **Status:** Closed
- **Decision:** Fix requested by the user; CWP-B1 implemented the validated offset, local Current-Day, local-midnight TTL, fallback, and cache semantics. Final QA verified the correction and closed the finding.
- **History:** 2026-08-20 - Imported from the Dedicated QA report. 2026-08-20 - CWP-B1 correction implemented with focused offset/TTL/cache tests. 2026-08-20 - Final QA verified AC-28 through AC-33 and closed the finding; native/release checks remain manual validation.

### FT-QA-2026-013

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-26
- **Description:** The Mobile package has service/date tests but no `InsightCard` component test. Trigger visibility, Bottom Sheet submission, retry identity, changed-comment ID rotation, Snackbar success, and 404/409 error retention are not automatically exercised.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/services/insightService.test.ts`; `mobile/src/shared/date/localDate.test.ts`; no `mobile/src/modules/home/InsightCard.test.tsx`; implementation in `mobile/src/modules/home/InsightCard.tsx`.
- **Recommendation:** Add focused component tests for the feedback state machine or attach a repeatable Mobile dev/preview validation record covering the AC-26 interaction matrix.
- **Status:** Closed
- **Decision:** Fix requested by the user; CWP-F1/F2 added and executed a real `InsightCard` component test covering the feedback interaction matrix. Final QA verified the correction and closed the finding.
- **History:** 2026-08-20 - Imported from the Dedicated QA report. 2026-08-20 - CWP-F1 enabled `.test.tsx` execution and CWP-F2 added 16 component tests. 2026-08-20 - Final QA verified AC-38 through AC-41 and closed the finding; native preview checks remain manual validation.

### FT-QA-2026-014

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-27
- **Description:** The persisted plan header still says `[Planned]` and `nicht genehmigt`, conflicting with the conversational approval and the active implementation/review state. This weakens durable process traceability but does not alter runtime behavior.
- **Criticality:** Non-blocking
- **Owner:** Planner
- **Evidence:** The header in `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`; WP7 was supplied as the active approved QA scope.
- **Recommendation:** Update the plan status through the normal Orchestrator/Planner process after approval is recorded. No re-planning is needed for this documentation correction.
- **Status:** Closed
- **Decision:** Fix requested by the user; the persisted plan status and approval traceability were corrected without reopening the feature design. Final QA verified AC-42 and closed the finding.
- **History:** 2026-08-20 - Imported from the Dedicated QA report. 2026-08-20 - Plan updated to `[Correction Approved]` with durable approval traceability. 2026-08-20 - Final QA verified the corrected status and closed the finding.

### FT-QA-2026-015

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-2
- **Description:** The live stale-weight evaluation is rejected because the generated response refers to weight/trend/kg without an allowed explicit stale-data reference. The required stale-weight scenario is therefore not reliably handled by the prompt and semantic contract.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `cd backend && npm run test:eval` exits 1; `backend/src/lib/prompts/dailyInsight.eval.test.ts`; `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`; `backend/src/lib/dailyInsightValidation.ts`; failure is `Daily insight refers to stale weight data as current`.
- **Recommendation:** Adjust the weight prompt and/or semantic validator so stale data is either omitted or explicitly described as stale with the required actionable wording, then rerun the complete eval suite.
- **Status:** Closed
- **Decision:** Correction requested from Backend during the QA correction loop; the second full QA re-review verified the stale-weight scenario and closed the finding.
- **History:** 2026-08-20 - Imported from the QA re-review; correction routed to Backend. 2026-08-20 - Prompt/validation correction applied with F-01; complete eval passed 26/26. 2026-08-20 - QA re-review verified F-07 PASS; closed. 2026-08-20 - A new runtime log challenged the earlier closure; CWP-B2 added credential-free validator, generator, and handler regressions, the global v11 stale guard, and verified 26/26 evals. Final correction QA retained the finding as Closed.

### FT-QA-2026-016

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-1 / AC-11
- **Description:** The current live `weight-outlier-context` scenario is rejected by `validateToneSemantics` because the provider response contains a forbidden technical or abstract phrase. The complete Daily prompt/eval contract remains red, and a valid outlier-coaching scenario cannot currently be accepted end to end.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `cd backend && npm run test:eval` exits 1; `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`; `backend/src/lib/prompts/dailyInsight.eval.test.ts`; `backend/src/lib/dailyInsightValidation.ts`; 25/26 live eval tests passed.
- **Recommendation:** Adjust the weight/outlier prompt or semantic validation contract so natural goal-aligned coaching language is accepted without reintroducing forbidden technical or abstract wording, then rerun the complete live eval suite.
- **Status:** Closed
- **Decision:** Correction requested from Backend after QA FAIL; final QA verification confirmed the weight-outlier scenario and complete eval pass.
- **History:** 2026-08-20 - Imported from the QA re-review; correction routed to Backend. 2026-08-20 - Weight/outlier prompt correction applied; complete eval passed 26/26, focused regression 32/32, Backend 831 tests and typecheck passed. 2026-08-20 - Final QA verification confirmed the scenario; closed.

### FT-QA-2026-017

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-3 / AC-9
- **Description:** The `current-effective-activity-budget` live contract is not reliably satisfied. One complete eval run omitted the required natural target vocabulary, and isolated repetitions produced an additional protein recommendation although `remainingProteinG` was 10; the server-side semantic validator rejected that response. A later complete run passed, but repeated executable failure means the corrected prompt contract is not stable end to end.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`; `backend/src/lib/prompts/dailyInsight.eval.test.ts`; `backend/src/lib/dailyInsightValidation.ts`; the QA review recorded complete runs of 25/26 and 26/26 plus isolated repetitions with exit codes 0, 0, and 1.
- **Recommendation:** Harden the v10 activity/budget prompt and server validation contract so every valid provider response for this context names the effective target and never recommends additional protein when the guard is active. Re-run the complete live eval and repeated targeted scenario; do not weaken the fixture assertion.
- **Status:** Closed
- **Decision:** Correction requested from Backend after QA FAIL; final QA verification confirmed the complete eval and three targeted repetitions.
- **History:** 2026-08-20 - Imported from the final QA report; correction routed to Backend. 2026-08-20 - Activity-budget prompt/validation correction applied; full eval 26/26 and three targeted repetitions passed 0/0/0, with 834 Backend tests and typecheck/build green. 2026-08-20 - Final QA verification confirmed F-09 PASS; closed.

### FT-QA-2026-018

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Review.md`
- **Acceptance criterion:** AC-9
- **Description:** The required `protein-gap-with-budget` live contract is not satisfied in the complete eval. Its context has 600 remaining calories and an 80 g protein gap, but the provider response is rejected by the server-side semantic validator as judging an open day as completed. The F-09 activity-budget scenario passes in the complete eval and targeted repetitions; this is a separate remaining live-eval failure.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/prompts/dailyInsight.eval.fixtures.ts`; `backend/src/lib/dailyInsightValidation.ts`; `cd backend && npm run test:eval` returned exit code 1 with 25/26 scenarios passing and `protein-gap-with-budget` failing.
- **Recommendation:** Harden the v10 nutrition/budget contract so a positive remaining calorie budget with a material protein gap receives consistent, non-contradictory guidance without judging the open day as completed. Re-run the complete live eval; do not weaken the fixture or server validation.
- **Status:** Closed
- **Decision:** Correction requested from Backend after the final QA FAIL; final QA verification confirmed `protein-gap-with-budget` and the complete eval pass.
- **History:** 2026-08-20 - Imported from the final QA report; correction routed to Backend. 2026-08-20 - Nutrition/budget prompt correction applied with regression tests; focused tests 30/30, Backend 836 tests, typecheck/build green, and complete eval 26/26. 2026-08-20 - Final QA verification confirmed F-10 PASS; closed.

### FT-QA-2026-019

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md`
- **Acceptance criterion:** AC-1
- **Description:** The ignored deployment artifact is stale. `_deploy_staging/dist` still contains the old `trend7d` contract and older prompt modules, while the current `backend/dist` contains `weeklyTrend30d` and `v14`.
- **Criticality:** Blocking
- **Owner:** Infrastructure
- **Evidence:** `docs/qa/reports/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md`; generated staging audit reported 44 old-name matches and 0 `weeklyTrend30d`/v14 matches in `_deploy_staging/dist`.
- **Recommendation:** Rebuild and mirror the current backend output into `_deploy_staging/dist` through the documented release flow, then rerun the active old-name gate and verify the staged context, hash, prompt version, and migration package. Do not hand-edit generated output.
- **Status:** Closed
- **Decision:** Correction requested by the Orchestrator after QA FAIL; Infrastructure rebuilt and mirrored the generated output, and final QA verified the active artifact gate.
- **History:** 2026-08-21 - Imported from the QA report; correction reserved for Infrastructure after a revised plan is approved. 2026-08-21 - I1 clean-built and mirrored the backend output; final QA verified source/staging parity and zero active legacy-token matches; closed.

### FT-QA-2026-020

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md`
- **Acceptance criterion:** AC-2
- **Description:** The approved plan states that the calculation and `shared/lib/weightTrend.ts` remain unchanged, but the current implementation contains the intended 30-day regression and the new shared module as untracked files relative to the tracked baseline. The implementation matches the requested product behavior, but the approved plan does not accurately describe that change.
- **Criticality:** Blocking
- **Owner:** Planner / Orchestrator
- **QA owner:** Backend
- **Evidence:** `docs/qa/reports/PLAN_US_Home-Screen-Insights_Weight-Trend-Rename.md`; the tracked baseline used a local seven-value calculation with different thresholds, while the current source uses the shared 30-day regression and `weeklyTrend30d` contract.
- **Recommendation:** Reconcile the approved plan with the intended 30-day behavior and explicitly include the shared helper and its tests in the deliverable. Do not silently revert the requested 30-day semantics or accept the implementation against a contradictory plan.
- **Status:** Closed
- **Decision:** Plan revision required by the Orchestrator after QA FAIL; the revised plan received fresh approval and final QA verified the corrected scope and implementation.
- **History:** 2026-08-21 - Imported from the QA report; routed to Planner as a plan/source conflict. Execution paused pending revised plan and fresh approval. 2026-08-21 - Planner rebuilt the plan from verified repository state; fresh approval was received; final QA verified AC-1 through AC-13; closed.

### FT-QA-2026-021

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Feedback_Status_Operations.md`
- **Acceptance criterion:** `N/A`
- **Description:** The planned documentation update for domain behavior is incomplete. The API reference documents the new PATCH status endpoint and lifecycle semantics, but `docs/kb/domain/07-ai-features.md` does not yet describe the `processingStatus` lifecycle (`Open`/`Done`/`Rejected`) for operational feedback handling.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** `docs/kb/tech/09-api-reference.md` contains the PATCH status endpoint section; `docs/kb/domain/07-ai-features.md` documents feedback snapshot persistence but has no `processingStatus` lifecycle or admin status-update semantics.
- **Recommendation:** Extend the feedback subsection in `docs/kb/domain/07-ai-features.md` with the canonical `processingStatus` model, terminal-state rules, and unresolved-versus-handled operational search semantics so it matches the implemented backend behavior and approved plan.
- **Status:** Closed
- **Decision:** User requested correction of the missing domain documentation.
- **History:** 2026-08-21 - Imported from the QA report; awaiting the user's decision on the non-blocking documentation correction. 2026-08-21 - User requested the documentation fix and clarified that the implementation owner must correct implementation-related documentation omissions; routed to Backend. 2026-08-21 - Backend updated the domain Knowledge Base; targeted QA re-check passed and found no actionable issues; closed.

### FT-QA-2026-022

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md`
- **Acceptance criterion:** AC-3
- **Description:** The fingerprint mutation tests do not establish that every imported prompt module changes the fingerprint. The test mutates only the `general` entry, leaving the activity, morning, nutrition, and weight module wiring without the acceptance-criteria proof required for the global bundle identity.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/prompts/dailyInsightPrompt.test.ts` contains one intent-module mutation for `general`; `backend/src/lib/prompts/dailyInsightPrompt.ts` imports the other provider-visible modules into the bundle.
- **Recommendation:** Parameterize the offline fingerprint test over each imported module, including the shared weight module used by both weight intents, and assert that each targeted mutation changes the fingerprint.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-08-21 - Imported from the QA report and routed to Backend for correction. 2026-08-21 - Backend added mutation coverage for activity, general, morning, nutrition, and the shared weight module; focused tests passed. 2026-08-21 - Full QA re-review verified AC-3; closed.

### FT-QA-2026-023

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md`
- **Acceptance criterion:** AC-4
- **Description:** The offline release guard does not track `dailyInsightValidation.ts`, even though the central provider schema imports provider-visible length constants from it. A change to those constants can change the provider-visible schema without requiring a manifest update or a new append-only release entry.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/scripts/verify-daily-insight-prompt.mjs` omits `backend/src/lib/dailyInsightValidation.ts` from `providerInputPaths`; `backend/src/lib/dailyInsightSchema.ts` imports four constants from that file. QA's focused guard probe marked only that path as changed and returned `providerInputChanged: false`, while the standard guard exited 0.
- **Recommendation:** Include the validation dependency in provider-input tracking or make the provider schema constants part of a directly tracked canonical schema source, then add a regression test that requires a new manifest release for a validation-constant change.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-08-21 - Imported from the QA report and routed to Backend for correction. 2026-08-21 - Backend tracked `dailyInsightValidation.ts` as provider-visible and added validation-only release-guard regression coverage; focused tests passed. 2026-08-21 - Full QA re-review verified AC-4; closed.

### FT-QA-2026-024

- **Plan reference:** `docs/User Stories/Insight/PLAN_US_Home-Screen-Insights_Prompt-Provenance-Correction.md`
- **Acceptance criterion:** AC-7 and AC-14
- **Description:** `shouldRegenerate()` hard-invalidates missing intent and snapshot fields but does not compare existing cached intent or the exact cached prompt snapshot with the current expected values. The handler does not pass those expected values to `shouldRegenerate()`. Consequently, a mismatched provenance record can be treated as an ordinary input-hash change and suppressed by the 30-minute or daily-generation limits. The Knowledge Base documents the stronger comparison behavior, so it is out of alignment with the implementation until corrected.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/repositories/insightRepository.ts` accepts active version/fingerprint/system-hash values and checks intent/snapshot for presence; `backend/src/functions/dailyInsight.ts` does not pass expected intent or snapshot. QA's focused probe with a recent, maxed-out non-admin cache returned `false` for both intent and system/user snapshot mismatches.
- **Recommendation:** Pass a current provenance object, or expected intent and exact snapshot, into `shouldRegenerate()` and compare all fields before input-hash and rate-limit decisions. Add regression tests for mismatched intent, system snapshot, and user snapshot under both recent and max-generation conditions; keep the Knowledge Base aligned after implementation.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-08-21 - Imported from the QA report and routed to Backend for correction. 2026-08-21 - Backend added exact intent and system/user snapshot comparisons before hash and rate-limit checks, with recent/max-generation regression coverage; focused tests passed. 2026-08-21 - Full QA re-review verified AC-7 and AC-14; closed.

### FT-QA-2026-025

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md`
- **Acceptance criterion:** `N/A` (QA build verification baseline)
- **Description:** `npm run build:verify` exits with code 2 because the unchanged `backend/src/lib/prompts/dailyInsightV10.ts` contains raw prompt prose instead of a valid TypeScript declaration. This is outside the approved Weekly Insight diagnostic scope and is unrelated to the tested Sonderaktivität path, but it prevents a clean backend build and caused the QA report to return `FAIL`.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `docs/qa/reports/PLAN_US-01_Wochenrückblick_AI-Sonderaktivitaet-Kalorien.md`; `cd backend; npm run build:verify` exit code 2; `backend/src/lib/prompts/dailyInsightV10.ts`.
- **Recommendation:** Decide separately whether to repair or restore the pre-existing Daily Insight prompt syntax, then rerun `cd backend; npm run build:verify`. Do not mix this unrelated repair with a Weekly Insight correction; the Weekly Red Gate produced no `RED_CONFIRMED_A` or `RED_CONFIRMED_B`.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred` as a separate baseline-build task.
- **History:** 2026-08-21 - Imported from the Weekly Insight diagnostic QA report. The Weekly payload and credentialed prompt eval did not authorize a correction; the finding remains separate from that workflow.

## Verification Notes (Not Findings)

These items were reported as unverified environment checks. They must not lower a QA verdict and must not enter the actionable finding list unless a defect is demonstrated.

### VER-2026-001 - Azure live evals

- **State:** `VERIFIED`
- **Reason:** The final QA review executed the credential-backed live eval successfully.
- **Evidence:** `cd backend && npm run test:eval` returned exit code 0 with 26/26 scenarios passed; three targeted `current-effective-activity-budget` repetitions also returned exit code 0.

### VER-2026-002 - Cosmos contract tests

- **State:** `UNVERIFIED`
- **Reason:** The local Cosmos emulator was not running during the review.
- **Manual action:** Start the approved local emulator or rely on the CI service container, then run `cd backend && npm run test:contract`.

### VER-2026-003 - Real-device and viewport checks

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** No `adb`-connected device or equivalent viewport/screen-reader setup was available to the QA agent.
- **Manual action:** Execute the device and accessibility checklist from the approved plan and record the actual result separately from this findings register.

### VER-2026-004 - Dev Cosmos provenance verification

- **State:** `UNVERIFIED`
- **Reason:** The Dev Function App health check passed with HTTP 401 and the deployed routes are registered, but the read-only Dev Cosmos provenance check was rejected with HTTP 401 because the configured `COSMOS_KEY` does not authorize the configured Dev Cosmos endpoint.
- **Manual action:** Correct the Dev Cosmos endpoint/key configuration, then rerun the read-only check for server-owned Daily provenance, identical-identity cache hits, and regeneration after identity changes. Do not treat this as an application-code finding without evidence after valid authentication.
