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
- **Owner:** Documentation
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
