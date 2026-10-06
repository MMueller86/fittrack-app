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
| FT-QA-2026-026 | Local-date correction documentation, AC-12 | Non-blocking | Documentation | Closed |
| FT-QA-2026-027 | Diary local-hour parameter documentation, AC-12 | Non-blocking | Documentation | Closed |
| FT-QA-2026-028 | Instagram renderer Golden comparison, AC-12 | Blocking | Backend | Closed |
| FT-QA-2026-029 | Instagram renderer wordmark compositing, AC-5 | Blocking | Backend | Closed |
| FT-QA-2026-030 | Instagram renderer shared ambient field, AC-6 | Blocking | Backend | Closed |
| FT-QA-2026-031 | Instagram renderer footer documentation, AC-14 | Non-blocking | Documentation | Accepted |
| FT-QA-2026-032 | Instagram renderer footer SVG provenance, AC-10 | Suggestion | Backend | Accepted |
| FT-QA-2026-033 | Rezeptfoto Hero-Crop EXIF-Orientierung, AC-13 | Blocking | Backend | Closed |
| FT-QA-2026-034 | US-09 Rezept teilen, finaler Render-UI-Lock, AC-9 | Blocking | Frontend | Closed |
| FT-QA-2026-035 | US-09 Rezept teilen, Options-Sheet-Copy, AC-21 | Non-blocking | Frontend | Closed |
| FT-QA-2026-036 | US-09 Rezept teilen, UX-KB-Dokumentation, AC-23 | Non-blocking | Documentation | Closed |
| FT-QA-2026-037 | US-10 mehrdeutige Zutatenzuordnung, AC-11 | Blocking | Backend | Closed |
| FT-QA-2026-038 | US-10 stale Export-Persistenz, AC-8 | Blocking | Backend | Closed |
| FT-QA-2026-039 | US-10 stale Share-Bundle, AC-8 | Blocking | Backend | Closed |
| FT-QA-2026-040 | US-10 Preparation-Quota, AC-7/25 | Blocking | Backend | Closed |
| FT-QA-2026-041 | US-10 integrierter Zwei-Bilder-Share, AC-20/21/22/23/27 | Blocking | Frontend | Closed |
| FT-QA-2026-042 | US-10 kanonische bestätigte Metadaten, AC-20 | Blocking | Backend | Closed |
| FT-QA-2026-043 | US-10 API- und Mobile-KB-Genauigkeit, AC-28 | Blocking | Documentation | Closed |
| FT-QA-2026-044 | US-10 erforderlicher aggregierter Prompt-Eval-Gate | Blocking | Backend | Closed |
| FT-QA-2026-045 | US-10 Shared-Library-Dokumentation, AC-28 | Non-blocking | Documentation | Closed |
| FT-QA-2026-046 | US-10 Share UX R2, AC-2 | Blocking | Frontend | Closed |
| FT-QA-2026-047 | US-10 Share UX R2, AC-6/AC-14 | Blocking | Frontend | Closed |
| FT-QA-2026-048 | US-10 Share UX R2, AC-8 | Blocking | Frontend | Closed |
| FT-QA-2026-049 | US-10 Share UX R2, AC-12 | Blocking | Frontend | Closed |
| FT-QA-2026-050 | US-10 Share UX R2, AC-14 | Non-blocking | Documentation | Closed |
| FT-QA-2026-051 | Long serving labels, pre-existing test-helper diagnostic | Non-blocking | Backend | Awaiting decision |
| FT-QA-2026-052 | US-11 recipe gram quick-add prefill | Non-blocking | Frontend | Closed |
| FT-QA-2026-053 | US-11 D-1 plan execution status | Non-blocking | Documentation | Closed |
| FT-QA-2026-054 | US-11 name-consent interaction | Non-blocking | Frontend | Closed |
| FT-QA-2026-055 | US-01 diary multi-select, AC-10 | Blocking | Frontend | Closed |
| FT-QA-2026-056 | US-01 move target semantics, AC-8 | Suggestion | Planner | Closed |
| FT-QA-2026-057 | US-01 multi-source Move repository contract, AC-8 | Blocking | Backend | Closed |
| FT-QA-2026-058 | US-01 persisted plan approval status | Non-blocking | Planner | Closed |
| FT-QA-2026-059 | US-01 Move picker source-target test, AC-8 | Non-blocking | Frontend | Closed |
| FT-QA-2026-060 | US-01 selection date-reset screen test | Non-blocking | Frontend | Closed |
| FT-QA-2026-061 | US-01 foreign-user bulk reference test, AC-11 | Non-blocking | Backend | Closed |
| FT-QA-2026-062 | US-01 Same-Day Copy Cosmos guard, AC-SD-1 | Blocking | Backend | Closed |

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

### FT-QA-2026-026

- **Plan reference:** `docs/User Stories/plans/PLAN_User-Local-Date-Timezone-Korrektur.md`
- **Acceptance criterion:** AC-12
- **Description:** `docs/kb/tech/06-ai-integrations.md` still documents obsolete Daily Insight behavior in which missing or malformed date/context values use backend UTC fallback semantics and expiry uses UTC midnight. The implementation and current API documentation require explicit validated local context.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `backend/src/functions/dailyInsight.ts`; `docs/kb/tech/06-ai-integrations.md`; `docs/kb/tech/09-api-reference.md`.
- **Recommendation:** Align the Daily Insight local-time section with the implemented required date/offset contract while preserving the unchanged prompt, schema, quota, and technical UTC timestamp statements.
- **Status:** Closed
- **Decision:** User requested all necessary corrections on 2026-09-14.
- **History:** 2026-09-14 - Imported from the final QA report and routed for correction. 2026-09-14 - Backend aligned the Daily Insight Knowledge Base documentation with the required local date/offset contract. 2026-09-14 - Targeted QA re-review verified the correction; closed.

### FT-QA-2026-027

- **Plan reference:** `docs/User Stories/plans/PLAN_User-Local-Date-Timezone-Korrektur.md`
- **Acceptance criterion:** AC-12
- **Description:** `docs/kb/domain/02-diary.md` refers once to a `currentHour` query parameter although the implemented and documented API contract uses `localHour`.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `backend/src/functions/diary.ts`; `docs/kb/domain/02-diary.md`; `docs/kb/tech/09-api-reference.md`.
- **Recommendation:** Rename the remaining query-parameter reference to `localHour` and retain `currentLocalDate` only for the internal hint context.
- **Status:** Closed
- **Decision:** User requested all necessary corrections on 2026-09-14.
- **History:** 2026-09-14 - Imported from the final QA report and routed for correction. 2026-09-14 - Backend corrected the diary parameter documentation to `localHour`. 2026-09-14 - Targeted QA re-review verified the correction; closed.

### FT-QA-2026-028

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-PoC.md`
- **Acceptance criterion:** AC-12
- **Description:** The approved Golden comparison fails with `0.5278950617283951` differing pixels, exceeding the allowed `0.03` ratio. The failure is reproducible and the generated diff artifacts show broad differences across the hero photo and lower composition.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `npx vitest run src/lib/instagramRenderer/__tests__/golden.test.ts` exits `1`; `backend/src/lib/instagramRenderer/__tests__/golden.test.ts`; `backend/src/lib/instagramRenderer/__tests__/output/diff.png`.
- **Recommendation:** Reconcile the renderer composition and asset/layout treatment with the V1.7 Golden master, then rerun the unchanged Golden test.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-09-15 - Imported from `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-PoC.md` and routed to Backend for correction. 2026-09-15 - Backend adjusted the photo/ambient composition and reduced the differing-pixel ratio to `0.03500274348422497`; targeted QA re-review confirmed AC-5 and AC-6, but AC-12 remained open. Routed to Backend for final correction retry. 2026-09-15 - Backend aligned the remaining Golden-sensitive layout geometry; unchanged Golden test passed at ratio `0.029250342935528122`. 2026-09-16 - Final QA re-review independently verified AC-12 and closed the finding.

### FT-QA-2026-029

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-PoC.md`
- **Acceptance criterion:** AC-5
- **Description:** The generated renderer PNG visibly contains the wordmark asset's dark rectangular background, so the footer wordmark is not blended into the ambient field and presents a hard rectangle.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/output/quarkbroetchen.png` versus the V1.7 master; the wordmark is composed as a direct image layer in `backend/src/lib/instagramRenderer/compose.ts`.
- **Recommendation:** Adjust the renderer's wordmark compositing or asset treatment so the wordmark background matches the surrounding ambient field without a visible rectangle.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-09-15 - Imported from `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-PoC.md` and routed to Backend for correction. 2026-09-15 - Backend removed the visible wordmark rectangle through alpha normalization; targeted QA re-review confirmed AC-5.

### FT-QA-2026-030

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-PoC.md`
- **Acceptance criterion:** AC-6
- **Description:** The generated lower area does not visually preserve the required shared green ambient field; the opaque dark transition dominates the footer and masks the intended green radial treatment.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/output/quarkbroetchen.png` versus the V1.7 master; `backend/src/lib/instagramRenderer/ambient.ts` defines the ambient field while `backend/src/lib/instagramRenderer/transition.ts` adds a full-canvas transition that reaches opaque ambient-base alpha.
- **Recommendation:** Rework the layer interaction so the photo transition and the single green ambient field compose together across the lower area without masking the field.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-09-15 - Imported from `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-PoC.md` and routed to Backend for correction. 2026-09-15 - Backend revised the transition/ambient layering so the shared field remains visible; targeted QA re-review confirmed AC-6.

### FT-QA-2026-031

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md`
- **Acceptance criterion:** AC-14
- **Description:** `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md` contains contradictory unmarked Footer documentation: its opening section documents the active transparent `micha-logo-writing.svg`, while the later Footer section still describes `fittrack-wordmark.png` and the old PNG workaround as current.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `backend/src/lib/instagramRenderer/docs/tag-icon-mapping.md`; `backend/src/lib/instagramRenderer/render.ts`; QA report finding `Q-IPR-1-DOC-001`.
- **Recommendation:** Mark the old Footer/PoC section explicitly as historical or replace its current-state claims with the active SVG path, retaining the legacy PNG only as a documented fallback.
- **Status:** Accepted
- **Decision:** User approved the current renderer and accepted the remaining documentation risk on 2026-09-16; no correction requested.
- **History:** 2026-09-16 - Imported from `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md` and routed to Documentation. 2026-09-16 - User accepted the remaining risk; no correction requested.

### FT-QA-2026-032

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md`
- **Acceptance criterion:** AC-10
- **Description:** The active backend SVG is semantically and visually equivalent to Mobile variant 02 but is not an exact text copy: its unused root-group identifier is `Layer 2` instead of `Layer_2`. The normalized files have equal length but differ at the identifier, so provenance is not byte-exact.
- **Criticality:** Suggestion
- **Owner:** Backend
- **Evidence:** `backend/src/lib/instagramRenderer/assets/branding/micha-logo-writing.svg`; `mobile/assets/brand/micha_logo_writing_02.svg`; QA report finding `Q-IPR-1-ASSET-001`.
- **Recommendation:** Preserve an exact source copy of variant 02, or document the intentional non-visual identifier normalization so future provenance checks are unambiguous.
- **Status:** Accepted
- **Decision:** User approved the current renderer and accepted the remaining SVG provenance risk on 2026-09-16; no correction requested.
- **History:** 2026-09-16 - Imported from `docs/qa/reports/PLAN_Instagram-Recipe-Renderer-Polish-and-UX-Review.md` and routed to Backend. 2026-09-16 - User accepted the remaining risk; no correction requested.

### FT-QA-2026-033

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US_Rezeptfoto_Hero_Bild.md`
- **Acceptance criterion:** AC-13
- **Description:** The renderer normalizes non-default EXIF orientation in memory and then applies the legacy landscape rotation based only on normalized `width > height`. An EXIF-6 input can therefore be rotated twice, so final visual orientation is not reliably correct.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** `backend/src/lib/instagramRenderer/render.ts` calls Sharp `rotate()` and rereads dimensions; `backend/src/lib/instagramRenderer/photo.ts` derives `rotate(90deg)` solely from `photo.width > photo.height`; `backend/src/lib/instagramRenderer/__tests__/photo.test.ts` expects that post-normalization rotation instead of proving final pixel orientation.
- **Recommendation:** Replace the post-normalization width heuristic with one explicit orientation contract and add deterministic visual/pixel regression fixtures for EXIF 0/1/90/180/270 plus normal portrait/landscape inputs. Re-run the focused renderer suite and the full backend suite.
- **Status:** Closed
- **Decision:** Correction loop started automatically after QA `FAIL`; no acceptance or deferral decision applies.
- **History:** 2026-09-17 - Imported from `docs/qa/reports/PLAN_US_Rezeptfoto_Hero_Bild.md` and routed to Backend for the first B-HR-3 correction attempt. 2026-09-17 - An intermediate correction replaced the post-normalization width heuristic with explicit `renderRotation` semantics and added pixel-based EXIF regression coverage. 2026-09-17 - Targeted QA re-review verified AC-13 and closed the finding. 2026-09-18 - Follow-up regression testing showed that ordinary landscape inputs were still rotated in the share preview; the final correction removed the redundant post-normalization landscape rotation and retained the EXIF pixel coverage.

### FT-QA-2026-034

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`
- **Acceptance criterion:** AC-9
- **Description:** During a final re-render, the last preview remains visible, but `Ausschnitt anpassen` and `Optionen ändern` remain enabled. Changing options calls `setOptions()` and invalidates or aborts the running final render, so the confirmed one-time render is not protected from concurrent UI actions.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/modules/recipes/RecipeInstagramPreview.tsx` computes the rendering state but does not use it in both action disabled conditions; `mobile/src/modules/recipes/RecipeDetailScreen.tsx` passes option/crop permissions independently of render status. QA reproduced this while `renderStatus` was `loading` with an existing preview URI.
- **Recommendation:** Disable the options and crop actions while `renderStatus === 'loading'`, and add a regression test covering an existing `previewUri` with a loading render status.
- **Status:** Closed
- **Decision:** Correction requested automatically after QA `FAIL` on 2026-09-18.
- **History:** 2026-09-18 - Imported from QA report `docs/qa/reports/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`; correction routed to Frontend. 2026-09-18 - Frontend disabled crop/options actions during the final render and added regression coverage; focused Mobile tests and typecheck passed. Targeted QA verification confirmed AC-9 and closed the finding.

### FT-QA-2026-035

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`
- **Acceptance criterion:** AC-21
- **Description:** The implemented Options Sheet copy differs from the normative approved wording for the tag question and the empty-tag state.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/modules/recipes/RecipeInstagramOptionsSheet.tsx` uses `Wähle bis zu vier Tags für dein Bild.` and `Dieses Rezept hat keine Tags. Es werden keine Tags angezeigt.` instead of the approved strings `Welche Tags sollen auf dem Bild erscheinen?` and `Für dieses Rezept sind keine Tags hinterlegt.`
- **Recommendation:** Pending user decision: adopt the normative German strings, accept the copy deviation, or defer it.
- **Status:** Closed
- **Decision:** User requested correction for both remaining US-09 findings on 2026-09-18.
- **History:** 2026-09-18 - Imported from QA report `docs/qa/reports/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`. 2026-09-18 - User requested correction; routed to Frontend. 2026-09-18 - Frontend updated both normative Options-Sheet strings and focused assertions; focused tests and typecheck passed. 2026-09-18 - Final QA verified AC-21 and closed the finding.

### FT-QA-2026-036

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`
- **Acceptance criterion:** AC-23
- **Description:** The UX Knowledge Base does not document the implemented Options Sheet, preview, crop, Back/Cancel, and retry states of the complete local share flow. It currently documents the local photo library, album, rollback, URI, and share retry behavior only.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `docs/kb/product/05-ux-patterns.md` contains the local photo library section but not the required complete options/preview/crop/back/cancel/retry flow; `docs/kb/tech/03-mobile.md` does not replace the explicitly required UX-pattern documentation.
- **Recommendation:** Pending user decision: add the implemented flow and German error semantics to the UX Knowledge Base, accept the documentation gap, or defer it.
- **Status:** Closed
- **Decision:** User requested correction for both remaining US-09 findings on 2026-09-18.
- **History:** 2026-09-18 - Imported from QA report `docs/qa/reports/PLAN_US-09_Rezept_teilen_und_Instagram-Bild_speichern.md`. 2026-09-18 - User requested correction; UX documentation routed to Frontend as the owning UX surface. 2026-09-18 - Frontend documented the complete implemented local recipe-share UX flow in the UX Knowledge Base; diff and encoding checks passed. 2026-09-18 - Final QA verified AC-23 and closed the finding.

### FT-QA-2026-037

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-11
- **Description:** The original wizard review, confirmation, ingredient-selection, and preparation-action gaps were corrected. A remaining AC-11 defect exists in existing-recipe preparation: when multiple recipe ingredients match an AI ingredient name exactly or fuzzily, the handler silently chooses the first match and returns its ID. The review draft can then confirm and persist that arbitrary selection without asking the user to resolve the ambiguity.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `backend/src/functions/recipes.ts`; `backend/src/functions/recipes.test.ts`; `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`.
- **Recommendation:** Return an ingredient ID only for a unique source match. For duplicate exact or overlapping fuzzy matches, return an unresolved candidate state and require explicit user selection or clarification before confirmation; add regression tests for both ambiguity cases.
- **Status:** Closed
- **Decision:** The F-1 UI corrections were routed after the initial QA `FAIL`; the residual Backend ambiguity correction was routed after the re-review on 2026-09-30. The user approved the AC-11 re-plan on 2026-10-01; final Q-1 verified the V2 candidate-resolution contract and explicit Mobile clarification flow and closed the finding.
- **History:** 2026-09-30 - Imported from the initial US-10 `fittrack-qa-v1` report and routed to Frontend. 2026-09-30 - Re-review verified the editable review, confirmation and preparation UI; the unresolved Backend exact/fuzzy matching ambiguity remains Blocking under AC-11 and is routed to Backend. 2026-10-01 - After the user's explicit approval, Backend added V2 resolution states and fail-closed V1 ambiguity handling; final Q-1 verified explicit candidate resolution/exclusion and closed FT-QA-2026-037.

### FT-QA-2026-038

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-8
- **Description:** An ordinary recipe edit can resubmit a stale export as confirmed, and the update handler can assign a new source fingerprint without requiring explicit review and confirmation against the effective recipe source.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `mobile/src/modules/recipes/recipeWizardEditBootstrap.ts`; `mobile/src/modules/recipes/RecipeWizardScreen.tsx`; `backend/src/functions/recipes.ts`; `backend/src/functions/recipes.test.ts`.
- **Recommendation:** Enforce the atomic stale GET/PUT precondition and only compute a new fingerprint after explicit user review and confirmation.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 under the approved Orchestrator workflow.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report and routed to Backend. 2026-09-30 - Re-review verified ETag confirmation and compare-and-replace behavior for ordinary and confirming updates; finding closed.

### FT-QA-2026-039

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-8
- **Description:** `shareBundleHandler` checks only for an existing export view and does not reject a stale fingerprint before rendering either image.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `backend/src/functions/instagramRecipe.ts`; `backend/src/functions/instagramRecipe.test.ts`.
- **Recommendation:** Derive export freshness server-side, return a controlled stale-export response before rendering, and test stale and current bundle requests.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 under the approved Orchestrator workflow.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report and routed to Backend. 2026-09-30 - Re-review verified stale bundle rejection before rendering; finding closed.

### FT-QA-2026-040

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-7, AC-25
- **Description:** The authenticated export-preparation handler calls recipe analysis without enforcing or tracking the `recipe-analyze` quota, unlike the existing recipe-analysis handler.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `backend/src/functions/recipes.ts`; `backend/src/functions/ai.ts`; `backend/src/functions/recipes.test.ts`.
- **Recommendation:** Apply quota enforcement and successful-use tracking to preparation, with exhausted-quota and usage-tracking handler tests.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 under the approved Orchestrator workflow.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report and routed to Backend. 2026-09-30 - Re-review verified strict preparation body, quota enforcement and success-only usage tracking; finding closed.

### FT-QA-2026-041

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-20, AC-21, AC-22, AC-23, AC-27
- **Description:** The production Mobile share flow remains single-image: it calls the legacy renderer, aliases a missing detail URI to the preview URI, and deduplicates the resulting media. The bundle route and native candidate are not wired into the screen, and preview readiness does not require two images.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `mobile/src/modules/recipes/recipeShareDraftState.ts`; `mobile/src/modules/recipes/RecipeDetailScreen.tsx`; `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`; `mobile/src/services/recipeShareMediaService.ts`; `mobile/src/services/nativeShareCandidate.ts`.
- **Recommendation:** Integrate the bundle API, maintain and preview two distinct images, gate save/share on both, and call the Android native adapter exactly once with both local URIs; add integrated pair, rollback, and retry tests.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 under the approved Orchestrator workflow.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report and routed to Frontend. 2026-09-30 - Re-review verified bundle-backed pair readiness, distinct image URIs, retry/rollback tests, and exactly one mocked native call; actual device behavior remains a verification note, not a finding.

### FT-QA-2026-042

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-20
- **Description:** The share-bundle Instagram adapter does not derive time and difficulty from the authenticated recipe's confirmed export view, allowing missing or client-supplied metadata instead of the canonical server-owned values.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `backend/src/functions/instagramRecipe.ts`; `backend/src/lib/instagramRenderer/recipeAdapter.ts`.
- **Recommendation:** Build the bundle's Instagram metadata from the server-loaded confirmed export view and ignore client metadata as authority for this flow.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 under the approved Orchestrator workflow.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report and routed to Backend. 2026-09-30 - Re-review verified both renderers use the current server-confirmed export metadata and reject client recipeMeta; finding closed.

### FT-QA-2026-043

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-28
- **Description:** The API reference omits the new preparation and share-bundle routes, and the Mobile Knowledge Base documents a two-image integration that is not present in the production screen flow.
- **Criticality:** Blocking
- **Owner:** Documentation
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `docs/kb/tech/09-api-reference.md`; `docs/kb/tech/03-mobile.md`.
- **Recommendation:** Document both API contracts and align Mobile documentation with the implemented integration state; update it after the two-image flow is wired.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` on 2026-09-30 to the Backend and Frontend documentation owners declared in the approved plan.
- **History:** 2026-09-30 - Imported from the US-10 `fittrack-qa-v1` report; API reference correction routed with B-5/B-6 and Mobile documentation correction with F-3. 2026-09-30 - Re-review confirmed API, domain, mobile and UX documentation match the implemented contracts; finding closed.

### FT-QA-2026-044

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** N/A (required full prompt-eval gate)
- **Description:** The required aggregate `npm run test:eval` exits non-zero even though all Recipe Analyze eval tests pass; unrelated Daily Insight and Weekly Insight assertions failed during QA. Backend's subsequent rerun reproduced a Daily Insight historical-effective-target failure while the Weekly special-activity assertion passed, indicating that the aggregate live eval remains red and its failing case varies between runs.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** QA report `docs/qa/reports/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`; `backend: npm run test:eval` exit code 1; `backend/src/lib/prompts/dailyInsight.eval.test.ts`; `backend/src/lib/prompts/weeklyInsight.special-activity.diagnostic.eval.test.ts`; Backend correction handoff reports a later aggregate run with 30 passed and 1 failed.
- **Recommendation:** Keep the Recipe Analyze eval result distinct, reproduce and report the aggregate gate accurately, and route unrelated prompt failures only through their owning approved workstream; do not hide a red aggregate result or make unrelated prompt edits under B-3.
- **Status:** Closed
- **Decision:** The approved re-plan scopes the US-10 blocking prompt gate to Recipe Analyze v11; unrelated Daily/Weekly aggregate failures are outside this story and are not authorized for correction here.
- **History:** 2026-09-30 - Imported from the initial US-10 `fittrack-qa-v1` report. Backend reran the aggregate eval: Recipe Analyze passed, Daily Insight failed, and the Weekly failure was not reproduced. 2026-09-30 - The approved re-plan narrowed the US-10 gate to the scoped Recipe Analyze eval; re-review passed 8/8 Recipe Analyze tests and the aggregate diagnostic passed 31/31. No US-10 finding remains; closed under the revised scope.

### FT-QA-2026-045

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Rezeptteilen_um_Exportansicht_und_Detailbild_erweitern.md`
- **Acceptance criterion:** AC-28
- **Description:** The shared-library Knowledge Base still prefixes the implemented Frontend consumption of the US-10 request/response types and `If-Match` ETag with `[Planned: US-10 Frontend subtasks]`. The Mobile implementation and API documentation show that this behavior is already present, so the status marker misstates the current repository state.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `docs/kb/tech/04-shared-library.md`; the implemented client and workflow are documented in `docs/kb/tech/03-mobile.md` and tested in `mobile/src/shared/api/recipeApi.test.ts` and `mobile/src/modules/recipes/recipeWizardExportView.test.ts`.
- **Recommendation:** Remove the stale `[Planned: US-10 Frontend subtasks]` marker or revise it to identify only any remaining unimplemented work.
- **Status:** Closed
- **Decision:** The user instructed that documentation errors should always be corrected; the targeted correction was implemented and verified by QA.
- **History:** 2026-10-01 - Imported from the US-10 Q-1 re-review (`US10-Q1-F02`); the user instructed that documentation errors should always be corrected, so the finding was routed for correction. 2026-10-01 - The stale Planned marker was removed and the Shared/Mobile/Backend responsibilities were clarified; targeted QA verified AC-28 and returned `PASS`; finding closed.

### FT-QA-2026-046

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- **Acceptance criterion:** AC-2
- **Description:** The combined editor does not map controls to the approved image sections. Teaser is rendered in `Titelbild (Instagram)` although it feeds the detail image, while `Detailbild` omits it. The crop action is only rendered outside editor mode, so it is unavailable within the title section.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md` (R2-QA-01); `mobile/src/modules/recipes/RecipeInstagramPreview.tsx`; `mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx`.
- **Recommendation:** Move Teaser into `Detailbild`, expose crop in `Titelbild (Instagram)`, and assert field ownership and crop access within the combined editor.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` under the auto-approved R2 plan.
- **History:** 2026-10-02 - Imported from the R2 QA report and routed to Frontend in the correction loop. 2026-10-02 - Frontend moved Teaser into Detailbild, exposed crop in the title section, and added section-placement/crop assertions. 2026-10-02 - QA re-review verified AC-2; closed.

### FT-QA-2026-047

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- **Acceptance criterion:** AC-6 / AC-14
- **Description:** Provider preparation uses the obsolete message `Ich prüfe das Rezept und optimiere die Texte` instead of the approved R2 copy, and the paired-image ready-state review hint is absent. The Mobile and UX Knowledge Base pages also retain the obsolete provider message.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md` (R2-QA-02); `mobile/src/modules/recipes/RecipeDetailScreen.tsx`; `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx`; `mobile/src/modules/recipes/RecipeInstagramPreview.test.tsx`; `docs/kb/tech/03-mobile.md`; `docs/kb/product/05-ux-patterns.md`.
- **Recommendation:** Use the approved provider copy only during preparation, show the approved review hint after both previews are ready, and align tests and both Knowledge Base pages.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` under the auto-approved R2 plan.
- **History:** 2026-10-02 - Imported from the R2 QA report and routed to Frontend in the correction loop. 2026-10-02 - Frontend applied the approved provider and ready-state copy and updated Mobile/product UX documentation. 2026-10-02 - QA re-review verified AC-6 and AC-14; closed.

### FT-QA-2026-048

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- **Acceptance criterion:** AC-8
- **Description:** A stale stored view is treated as needing a save even when its export fields are unchanged; the save handler therefore sends a confirmation PUT for unchanged values.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md` (R2-QA-03); `mobile/src/modules/recipes/RecipeDetailScreen.tsx`; `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx` lacks an unchanged-stale-save regression case.
- **Recommendation:** Require new or changed export fields before issuing the confirmation PUT; stale status alone must not force a write. Add an unchanged-stale-view regression test.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` under the auto-approved R2 plan.
- **History:** 2026-10-02 - Imported from the R2 QA report and routed to Frontend in the correction loop. 2026-10-02 - Frontend added no-PUT behavior and regression coverage for unchanged stale export fields. 2026-10-02 - QA re-review verified AC-8; closed.

### FT-QA-2026-049

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- **Acceptance criterion:** AC-12
- **Description:** After an explicit export save receives `412 recipe_revision_conflict`, if the reloaded recipe has no stored `exportView`, the conflict path starts forced preparation and can invoke AI automatically instead of returning the failed draft for user review.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md` (R2-QA-04); `mobile/src/modules/recipes/RecipeDetailScreen.tsx`; `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx`.
- **Recommendation:** Preserve and return the local draft for explicit review after conflict. Do not start preparation, auto-merge, or retry the save. Add a regression test where the reloaded recipe has no export view.
- **Status:** Closed
- **Decision:** Correction routed automatically after QA `FAIL` under the auto-approved R2 plan.
- **History:** 2026-10-02 - Imported from the R2 QA re-review and routed to Frontend in the correction loop. 2026-10-02 - Frontend preserves the edited draft after a 412 when no stored view exists, blocks automatic preparation/render/save retry, and revalidates ingredient IDs; regression tests added. 2026-10-02 - Final QA verified the no-stored-view conflict path and AC-12; closed.

### FT-QA-2026-050

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-10_Exportansicht_beim_Teilen_2026-10-02.md`
- **Acceptance criterion:** AC-14
- **Description:** The Share-bundle introduction in the API reference contains a dangling duplicate fragment, `An optional request-only server-loaded recipe and one selected stored image.`, before the accurate `exportViewDraft` description. The contract remains accurate but the duplicated sentence is confusing and grammatically incomplete.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** `docs/qa/reports/PLAN_US-10_Share-UX-Follow-up_2026-10-02.md` (R2-QA-05); `docs/kb/tech/09-api-reference.md`.
- **Recommendation:** Remove the dangling fragment and keep one sentence describing the optional request-only `exportViewDraft`.
- **Status:** Closed
- **Decision:** Correction routed to the Backend owner of the API-reference documentation within B-1's declared scope.
- **History:** 2026-10-02 - Imported from the R2 QA re-review and routed for correction. 2026-10-02 - Backend removed the duplicated fragment and verified UTF-8 and `git diff --check`. 2026-10-02 - Final QA verified AC-14 and the corrected API reference; closed.

### FT-QA-2026-051

- **Plan reference:** `docs/User Stories/plans/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md`
- **Acceptance criterion:** N/A; separately reported under AC-7.
- **Description:** The editor reports `'value' is possibly 'null'` in the unchanged `isTemplateElement` helper. `Boolean(value)` does not provide TypeScript's null narrowing for the later `in` operator. This is pre-existing, not introduced by the label fix.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** `docs/qa/reports/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md` (QA-LSL-01); `backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts`, helper expression `Boolean(value) && typeof value === "object" && "type" in value && "props" in value`. QA confirmed the identical expression in HEAD and no B-1 change to the helper. The full unit suite passes; the production build excludes test files and does not certify test-file typechecking.
- **Recommendation:** Address the explicit null guard in a separate coordinated Backend change and rerun test-file typechecking plus the detail-template tests.
- **Status:** Awaiting decision
- **Decision:** Pending user choice: `Fix requested`, `Accepted`, or `Deferred`.
- **History:** 2026-10-03 - Imported from the validated long-serving-label QA report. All AC-1 through AC-7 passed; no actionable B-1 implementation findings. No additional correction authorized.

### FT-QA-2026-052

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md` (section 8)
- **Acceptance criterion:** N/A (approved plan mobile behavior)
- **Description:** `FoodEntryHub` forwards a saved recipe preference in grams to `RecipeQuantityView`, but that view initializes from the prefill only when its mode is `portion`; a gram preference silently becomes one portion. The planned compatible grams-to-portions conversion is not performed.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/modules/nutrition/hub/FoodEntryHub.tsx`; `mobile/src/modules/nutrition/hub/QuantityView.tsx`; saved-amount cases in `mobile/src/modules/nutrition/hub/FoodEntryHub.test.ts`; `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md` (US11-01).
- **Recommendation:** Convert historical gram preferences using the existing recipe portion-weight rule and its fallback, and add regression tests for gram and portion prefills.
- **Status:** Closed
- **Decision:** User requested correction on 2026-10-04; Frontend converted saved gram preferences using the recipe-weight rule and fallback. QA re-review verified the correction.
- **History:** 2026-10-03 - Imported from the validated US-11 QA report. No correction started. 2026-10-04 - User requested correction; Frontend added gram/portion prefill handling and regression tests. QA re-review verified the conversion and tests; closed.

### FT-QA-2026-053

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`
- **Acceptance criterion:** N/A (execution-status documentation)
- **Description:** The plan header and execution-status section still state that D-1 is next/not started, while the supplied D-1 handoff reports completion and the US-11 API/domain/auth/product documentation changes are present.
- **Criticality:** Non-blocking
- **Owner:** Documentation
- **Evidence:** Plan status text; `docs/kb/tech/09-api-reference.md`; `docs/kb/tech/05-authentication.md`; `docs/kb/domain/02-diary.md`; `docs/kb/domain/03-food-catalog.md`; `docs/kb/domain/06-recipes.md`; `docs/kb/product/04-food-entry-hub.md`; `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md` (US11-02).
- **Recommendation:** Update the plan's execution status to record the D-1 handoff before the next workflow handoff; do not alter approved scope or requirements.
- **Status:** Closed
- **Decision:** User requested correction on 2026-10-04; Planner updated the plan execution status without changing scope. QA re-review verified the correction.
- **History:** 2026-10-03 - Imported from the validated US-11 QA report. No correction started. 2026-10-04 - User requested correction; Planner updated D-1/Q-1/I-1 progress and preserved plan scope. QA re-review verified the status; closed.

### FT-QA-2026-054

- **Plan reference:** `docs/User Stories/Reciepe/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md` (section 8)
- **Acceptance criterion:** N/A (approved plan UI interaction)
- **Description:** The plan and API/domain documentation specify a name-consent checkbox initially off. The implemented confirmation sheet instead offers separate publish-with-name and publish-without-name actions. Both actions are explicit and consent remains opt-in, so the privacy outcome is preserved, but the specified interaction is not implemented and the documentation does not describe the actual controls precisely.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** `mobile/src/modules/recipes/RecipeDetailScreen.tsx`; `mobile/src/modules/recipes/RecipeDetailScreen.test.tsx`; `docs/kb/tech/09-api-reference.md`; `docs/kb/domain/06-recipes.md`; `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md` (US11-03).
- **Recommendation:** Align the UI with the approved unchecked-checkbox interaction, or obtain approval to retain the two-action design and update the plan and Knowledge Base wording accordingly.
- **Status:** Closed
- **Decision:** User requested correction on 2026-10-04; Frontend aligned the publication interaction to an initially unchecked name-consent checkbox. QA re-review verified the correction.
- **History:** 2026-10-03 - Imported from the validated US-11 QA report. No correction started. 2026-10-04 - User requested correction; Frontend implemented the unchecked consent checkbox and interaction tests. QA re-review verified default-off consent, request behavior, and accessibility tests; closed.

### FT-QA-2026-055

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** AC-10
- **Description:** Explicitly cancelling a bulk action does not exit selection mode or clear the selected references. Reproduction: enter selection mode, select an item, open Move or Copy and press `Abbrechen`; the sheet closes but the selection toolbar and selected item remain. The same occurs when cancelling or dismissing the Delete `ConfirmSheet`. Failed requests correctly retain valid selection as required by PO-2; this finding is limited to explicit cancellation.
- **Criticality:** Blocking
- **Owner:** Frontend
- **Evidence:** `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md` (AC-10); `mobile/src/modules/nutrition/DiaryScreen.tsx`, where `closeConfirmSheet`, `closeMoveSheet`, and `closeCopySheet` do not clear selection mode or selected references.
- **Recommendation:** Make each explicit bulk-action abort clear selection mode and selected references, while preserving selection on failed requests. Add screen tests for cancelling/backing out of Delete confirmation, Move, and Copy.
- **Status:** Closed
- **Decision:** Frontend corrected explicit cancellation for Delete, Move, and Copy while preserving valid selection on failed requests. QA re-review verified the implementation and focused regression tests.
- **History:** 2026-10-04 - Imported from the validated US-01 QA report; correction was paused pending plan clarification and reapproval. 2026-10-05 - User approved the revised plan. Frontend updated the action-cancellation handlers and added screen regression coverage; 13 focused tests and mobile typecheck passed. 2026-10-05 - QA re-review verified AC-10; closed.

### FT-QA-2026-056

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** AC-8
- **Description:** The approved plan is inconsistent about moving into a meal that is also a source meal. Confirmed move semantics describe a different or newly created target, while Risks and Edge Cases specify behavior for a target equal to a source meal. The implementation rejects a target that is among the selected source meals, matching the different-target contract but not the edge-case text.
- **Criticality:** Suggestion
- **Owner:** Planner
- **Evidence:** `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md` (AC-8); `backend/src/lib/repositories/cosmosDiaryRepository.ts`; `docs/kb/tech/09-api-reference.md`.
- **Recommendation:** Clarify whether a target may be one of the source meals; align the risk note and API contract before treating this edge case as an acceptance expectation.
- **Status:** Closed
- **Decision:** Planner aligned the plan's Move target rule, API contract, AC-8, tests, and edge-case guidance: an existing target must differ from every source meal; a new same-day target remains allowed. The user approved this revised plan on 2026-10-05. QA re-review verified the plan, API, implementation, and test alignment.
- **History:** 2026-10-04 - Imported from the validated US-01 QA report; routed to Planner and execution paused pending revised plan approval. 2026-10-05 - Planner updated the approved-plan clarification and the user approved the revised plan. 2026-10-05 - QA re-review verified alignment; closed.

### FT-QA-2026-057

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** AC-8
- **Description:** Runtime guards and the API contract agree that an existing Move target in the source-meal set is rejected, and the handler test covers the single-source case. However, the approved test strategy requires an in-memory case where the target matches one of multiple source meals and a Cosmos contract proving rejection without partial commit; neither regression is present. The required no-mutation edge case therefore lacks repository-level test evidence.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** The required cases are specified in the approved plan's Test Strategy. The single-source handler case is in `backend/src/functions/diary.test.ts`; the in-memory guard is in `backend/src/lib/repositories/diaryRepository.ts` and the Cosmos pre-check is in `backend/src/lib/repositories/cosmosDiaryRepository.ts`. The corresponding repository test files do not cover a multi-source rejection or Cosmos no-commit Move contract.
- **Recommendation:** Add an in-memory regression where the existing target equals one source among multiple selected meals and assert every Diary meal is unchanged on rejection. Add a Cosmos contract for the same case that verifies no partial batch commit, then run it against the emulator.
- **Status:** Closed
- **Decision:** Backend added the multi-source in-memory regression and Cosmos contract asserting `400 invalid_diary_bulk_request` with no Diary changes. QA re-review verified the handler/in-memory behavior and confirmed the Cosmos contract source. Cosmos runtime execution remains `UNVERIFIED` because the emulator was unreachable.
- **History:** 2026-10-05 - Imported from the validated US-01 QA re-review; first B1 correction attempt authorized and routed to Backend. 2026-10-05 - Backend added repository and Cosmos regression tests; in-memory/handler tests and typecheck passed. Cosmos contract test stopped before execution because `127.0.0.1:18081` was unreachable. 2026-10-05 - QA re-review verified AC-8 source coverage and in-memory behavior; closed with Cosmos runtime remaining unverified.

### FT-QA-2026-058

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** N/A (approval/execution status)
- **Description:** The QA assignment records that the revised plan was approved on 2026-10-05, but the plan header still says fresh user approval is outstanding and section 21 says execution remains paused until reapproval. The QA assignment's approval statement was treated as authoritative for the review; the durable plan status remains stale.
- **Criticality:** Non-blocking
- **Owner:** Planner
- **Evidence:** Approval-pending status in the plan header and paused execution wording in section 21 conflict with the user's 2026-10-05 approval recorded in this workflow.
- **Recommendation:** Update the plan's approval/execution status to record the 2026-10-05 approval without changing approved requirements or scope.
- **Status:** Closed
- **Decision:** Planner recorded the user's 2026-10-05 approval and current execution/QA follow-up status without changing approved scope or requirements. Final QA re-review verified the header and execution section; closed.
- **History:** 2026-10-05 - Imported from the validated US-01 QA re-review; awaiting the user's decision. 2026-10-05 - User requested correction; Planner updated the plan status metadata and section 21. 2026-10-05 - Final QA re-review verified approval/execution status and unchanged scope; closed.

### FT-QA-2026-059

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** AC-8
- **Description:** The Move picker filters all selected source meals from existing targets, but the approved mobile API/service test strategy calls for verifying that behavior and no focused `MoveItemSheet` test exists. `DiaryScreen` tests mock the sheet, so they do not exercise its filtering rule. Backend rejection protects data integrity if a source target is submitted directly.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** The approved test strategy requires Move target-selection coverage; source filtering is implemented in `mobile/src/modules/nutrition/MoveItemSheet.tsx`, while `DiaryScreen.f2.test.tsx` mocks the sheet. No `MoveItemSheet` test file exists.
- **Recommendation:** Add a focused component test with multiple source meal IDs, asserting none is offered as an existing target while an eligible same-day target remains selectable.
- **Status:** Closed
- **Decision:** Frontend added a focused `MoveItemSheet` regression for multiple selected source meals. Final QA verified both source meals are excluded, an eligible same-day target is selectable, and the focused test/typecheck pass; closed.
- **History:** 2026-10-05 - Imported from the validated US-01 QA re-review; awaiting the user's decision. 2026-10-05 - User requested correction; Frontend added `MoveItemSheet.test.tsx`; focused test and mobile typecheck passed. 2026-10-05 - Final QA re-review verified the component test and behavior; closed.

### FT-QA-2026-060

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`
- **Acceptance criterion:** N/A (plan sections 5 and 18: selection reset on date change)
- **Description:** DiaryScreen clears selection when its date changes, but no screen test changes the diary date while selection is active. Existing tests cover reference normalization and action success/cancel/failure, not this explicit date transition. This leaves the F1 handoff's date-reset test claim without a corresponding focused regression in the workspace.
- **Criticality:** Non-blocking
- **Owner:** Frontend
- **Evidence:** Date-change reset is implemented in `mobile/src/modules/nutrition/DiaryScreen.tsx`. The screen tests in `mobile/src/modules/nutrition/DiaryScreen.f2.test.tsx` do not change the route/date during selection. The approved plan's mobile selection test strategy explicitly lists reset on date change.
- **Recommendation:** Add a DiaryScreen regression that starts selection, changes the displayed date through navigation or route params, and asserts selection mode and old references are cleared.
- **Status:** Closed
- **Decision:** Frontend added a `DiaryScreen` route-date regression that selects an item, changes the displayed date, and verifies selection mode and old references are cleared. Final QA verified the route transition, focused test, and typecheck; closed.
- **History:** 2026-10-05 - Imported from the validated US-01 QA re-review; awaiting the user's decision. 2026-10-05 - User requested correction; Frontend added the route-date test to `DiaryScreen.f2.test.tsx`; focused test and mobile typecheck passed. 2026-10-05 - Final QA re-review verified date reset and test coverage; closed.

### FT-QA-2026-061

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`, section 18
- **Acceptance criterion:** AC-11
- **Description:** The approved test strategy calls for backend coverage of both missing and foreign IDs. Existing bulk handler tests cover unauthenticated requests and unknown references with no partial mutation, but no bulk test submits a meal ID owned by a second user under the first user's authenticated context. The implementation is user-scoped by inspection: handlers pass the token `userId`, the in-memory resolver filters by owner, and Cosmos point reads/batches use that user's partition. No cross-user access or mutation was observed; the distinct foreign-reference regression remains unexercised.
- **Criticality:** Non-blocking
- **Owner:** Backend
- **Evidence:** Unknown-reference/no-partial-mutation cases are in `backend/src/functions/diary.test.ts` and `backend/src/lib/repositories/diaryRepository.test.ts`. Owner filtering is in `backend/src/lib/repositories/diaryRepository.ts`; partition-scoped reads/batches are in `backend/src/lib/repositories/cosmosDiaryRepository.ts`. The approved test requirement is in the plan's Test Strategy.
- **Recommendation:** Add a focused bulk handler or repository test that seeds a source/target meal for user B, submits its reference as authenticated user A, and asserts the same not-found response as an unknown ID with no change to either user's Diary.
- **Status:** Closed
- **Decision:** Backend added bulk handler, in-memory repository, and Cosmos contract coverage for a user-B meal reference submitted as user A, including a mixed valid-A/foreign-B request with no changes to either user's Diary. Final QA re-review verified the handler/in-memory assertions and confirmed the Cosmos contract source. Cosmos runtime execution remains `UNVERIFIED` because the emulator was unreachable.
- **History:** 2026-10-05 - Imported from the validated US-01 final QA report; awaiting the user's decision. 2026-10-05 - User requested correction; routed to Backend. 2026-10-05 - Backend added the foreign-reference and mixed-request regressions; 84 focused handler/in-memory tests, typecheck, and diff check passed. Cosmos contract suite stopped before execution because `127.0.0.1:18081` was unreachable. 2026-10-05 - Final QA re-review verified the foreign-reference no-mutation assertions; closed with Cosmos runtime remaining unverified.

### FT-QA-2026-062

- **Plan reference:** `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl_Addendum_Same-Day-Copy.md`, section 9
- **Acceptance criterion:** AC-SD-1 (also blocks the persistent-path evidence for AC-SD-2 through AC-SD-5 and AC-SD-7)
- **Description:** `CosmosDiaryRepository.bulkCopyItems()` still rejects `sourceDate === targetDate` with `invalid_diary_bulk_request` before reading or writing. This prevents valid same-day copies to the same existing meal, a different existing meal, or a new target on the persistent Cosmos path; handler and in-memory tests do not expose this Cosmos-only guard.
- **Criticality:** Blocking
- **Owner:** Backend
- **Evidence:** The initial QA report `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl_Addendum_Same-Day-Copy_Revision-B.md`, finding `Q5-RB-001`; the correction re-review confirmed the guard is absent and the same-meal source/target uses one deduplicated record/ETag for one Replace. Cosmos contract runtime remains `UNVERIFIED` because the emulator was unreachable and all 21 tests were skipped.
- **Recommendation:** Remove the stale equal-date rejection from the Cosmos Copy path only, preserve Move/Delete behavior and the existing request/response shape, then run the focused Cosmos contract suite with the local emulator.
- **Status:** Closed
- **Decision:** The user explicitly approved same-day copy with fresh item IDs and requested immediate implementation on 2026-10-05. Backend removed the stale Cosmos equal-date guard; final QA correction re-review verified the source fix and issued Revision B verdict `PASS`. Cosmos runtime remains separately `UNVERIFIED`.
- **History:** 2026-10-05 - Revision B QA reported blocking finding `Q5-RB-001`; assigned `FT-QA-2026-062` and routed to Backend. Cosmos contract runtime remains unverified. 2026-10-05 - Backend removed the Cosmos Copy equal-date guard; focused tests, full backend unit suite, typecheck, and build verification passed. Contract execution remains unverified because the local emulator was unreachable. 2026-10-05 - Q5 correction re-review verified the stale guard was removed and closed the finding with Revision B QA verdict `PASS`; emulator runtime remains unverified.

## Verification Notes (Not Findings)

These items were reported as unverified environment checks. They must not lower a QA verdict and must not enter the actionable finding list unless a defect is demonstrated.

### VER-2026-001 - Azure live evals

- **State:** `VERIFIED`
- **Reason:** The final QA review executed the credential-backed live eval successfully.
- **Evidence:** `cd backend && npm run test:eval` returned exit code 0 with 26/26 scenarios passed; three targeted `current-effective-activity-budget` repetitions also returned exit code 0.

### VER-2026-002 - Cosmos contract tests

- **State:** `UNVERIFIED`
- **Reason:** The local Cosmos emulator was unavailable during review. Revision B Q5 could not reach `http://127.0.0.1:18081`; all 21 focused contract tests were skipped before assertions.
- **Manual action:** After closing FT-QA-2026-062, start the approved local emulator or use the CI service container, then run `npm --prefix backend run test:contract -- src/lib/repositories/cosmosDiaryRepository.contract.test.ts`. Verify same-Meal one-read/one-Replace behavior, target creation, and stale-ETag conflict.

### VER-2026-003 - Real-device and viewport checks

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** No `adb`-connected device or equivalent viewport/screen-reader setup was available to the QA agent.
- **Manual action:** Execute the device and accessibility checklist from the approved plan and record the actual result separately from this findings register.

### VER-2026-004 - Dev Cosmos provenance verification

- **State:** `UNVERIFIED`
- **Reason:** The Dev Function App health check passed with HTTP 401 and the deployed routes are registered, but the read-only Dev Cosmos provenance check was rejected with HTTP 401 because the configured `COSMOS_KEY` does not authorize the configured Dev Cosmos endpoint.
- **Manual action:** Correct the Dev Cosmos endpoint/key configuration, then rerun the read-only check for server-owned Daily provenance, identical-identity cache hits, and regeneration after identity changes. Do not treat this as an application-code finding without evidence after valid authentication.

### VER-2026-005 - US-10 Cosmos persistence contract

- **State:** `UNVERIFIED`
- **Reason:** The local emulator at `127.0.0.1:18081` was unavailable; the US-10 Cosmos contract suites stopped during setup and skipped their tests. No real Cosmos endpoint was accessed.
- **Evidence:** `cd backend && npx vitest run --config vitest.contract.config.mts` exited 1; nine suites failed reachability setup and 74 tests were skipped.
- **Manual action:** Start the local emulator or use the emulator-backed CI service and rerun the exact US-10 contract command before treating persistence/CAS as Cosmos-verified.

### VER-2026-006 - US-10 Android U-1 device and transport checks

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** The approved plan reserves physical Android multi-image share behavior and Base64 budget measurement for the user's post-QA U-1. Q-1 used only automated mocked bridge tests; no device test, native build, deployment, or transport measurement was performed.
- **Manual action:** After QA has no unresolved Blocking findings and after the I-1 documentation update, the user performs U-1 on Android, verifying both distinct saved PNGs, exactly one native share call with both URIs, recipient handoff, and measured transport budgets. Request a Dev Build separately only if the chosen setup requires one.

### VER-2026-007 - US-10 Share UX R2 physical-device validation

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** R2 was reviewed with mocked native-share tests only; no physical Android or iOS device run was performed.
- **Manual action:** After blocking findings are closed, validate the combined editor, transient AI preview, explicit save and rerender, image save, and one native share containing both distinct PNGs on a supported device.
- **Expected result:** Both images render and save as a pair; transient preview and image sharing do not persist export text; explicit `Speichern` does; the native share sheet receives both image URIs once.
- **Result:** `UNVERIFIED`.

### VER-2026-008 - Long serving labels Alpha end-to-end

- **State:** `UNVERIFIED`
- **Reason:** The approved plan excludes deployment, EAS builds, installation and Azure access/mutations. Local real-renderer tests verify the fix, not its presence in the deployed Alpha binary.
- **Evidence:** `docs/qa/reports/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md`; focused 48 tests, full 1193 backend tests and isolated `build:verify` pass.
- **Manual action:** Only after a separately authorized backend deployment, use an existing authenticated installation to share a seven-ingredient recipe whose seventh amount is `3 1 portion (10 g)` and inspect both returned images.
- **Expected result:** An atomic pair of 1080x1350 PNGs with the full fitting amount label and no recipe or nutrition mutation; genuine overflow returns a controlled error without a partial pair.
- **Result:** Not performed; no installation or deployment authorized.

### VER-2026-009 - US-11 Cosmos persistence contracts

- **State:** `UNVERIFIED`
- **Reason:** The emulator at `127.0.0.1:18081` was unreachable; nine contract suites failed during setup and 83 tests were skipped. No Cosmos repository contract assertions executed.
- **Evidence:** `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`; `cd backend && npx vitest run --config vitest.contract.config.mts` exited 1.
- **Manual action:** Start the local Cosmos emulator or use the emulator-backed CI service, then rerun the contract suite from `backend/`.
- **Expected result:** Legacy private defaults, publication writes, pagination, cross-partition community reads, and compare-and-replace behavior pass against the emulator.
- **Result:** `UNVERIFIED`.

### VER-2026-010 - US-11 Dev and Alpha two-user E2E

- **State:** `UNVERIFIED`
- **Reason:** No deployed Dev/Alpha two-user scenario was run; local tests do not verify deployed CIAM, Cosmos pagination, protected blob delivery, or revocation behavior.
- **Evidence:** `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`.
- **Manual action:** With two authenticated accounts in Dev and Alpha, run the plan's create-private, publish, read, favorite, log, edit, revoke, and delete sequence, including old favorite and direct URLs.
- **Expected result:** New reads and logs fail after revocation while previously stored diary snapshots remain unchanged.
- **Result:** `UNVERIFIED`.

### VER-2026-011 - US-11 device, accessibility, and HealthConnect validation

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** No physical or equivalent iOS/Android device, enlarged-text viewport, or screen-reader run was performed. HealthConnect diary-sync behavior was not exercised on device.
- **Evidence:** `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`; F-1/F-2 handoffs.
- **Manual action:** On supported devices, follow the report's owner/community navigation, publication consent, protected image, favorite, diary log, and revoked-state checklist using small/large viewports, enlarged text, and VoiceOver/TalkBack. Verify HealthConnect sync occurs only after successful logging and not after rejected access.
- **Expected result:** Controls remain readable and accessible; consent is never implicit; foreign management actions are absent; only successful diary writes sync.
- **Result:** `MANUAL VALIDATION REQUIRED`.

### VER-2026-012 - US-11 Dev and Alpha release gate

- **State:** `UNVERIFIED`
- **Reason:** I-1 preflight found the implementation is not merged/released to Dev. No deployed route, two-user smoke, protected-blob request, or Cosmos pagination check was run; Alpha deployment was correctly held until merge and Dev gates are satisfied.
- **Evidence:** I-1 Infrastructure & Release handoff; `docs/qa/reports/PLAN_US-11_Community-Rezepte_veroeffentlichen_und_entdecken.md`.
- **Manual action:** After the normal merge and Dev rollout, complete the plan's two-user checks for route registration, publication/revocation, authenticated image bytes without SAS or redirect, and paginated Cosmos reads. Proceed to Alpha only after those gates pass, then repeat the two-user smoke there.
- **Expected result:** Dev and Alpha checks pass for publication, revocation, protected image delivery, pagination, and preservation of existing diary snapshots.
- **Result:** `UNVERIFIED`; no deployment or environment changes were made.

### VER-2026-013 - US-01 Cosmos persistence contracts

- **State:** `UNVERIFIED`
- **Reason:** The local Cosmos emulator at `127.0.0.1:18081` was unreachable; the full contract suite failed during setup and the focused Move contract run skipped all 16 tests, so Cosmos transaction assertions did not execute.
- **Evidence:** `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`; full contract command exited 1 with nine suites/90 tests skipped, and focused `npm test --prefix backend -- --config vitest.contract.config.mts --reporter=basic --silent src/lib/repositories/cosmosDiaryRepository.contract.test.ts` exited 1 with 16 tests skipped.
- **Manual action:** Start the local Cosmos emulator or use the emulator-backed CI service, then rerun `npx vitest run --config vitest.contract.config.mts` from `backend/`.
- **Expected result:** Bulk delete/move/copy atomicity, ETag conflicts, target creation, user-partition isolation, and existing document roundtrips pass against Cosmos Emulator.
- **Result:** Not run against Cosmos in this QA environment.

### VER-2026-014 - US-01 Android visual and accessibility validation

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** `adb` was unavailable; no Android device/emulator interaction or TalkBack check was performed.
- **Evidence:** `docs/qa/reports/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl.md`.
- **Manual action:** On an Android Dev Build, exercise item and meal selection, partial/full/empty meal states, action-bar spacing, confirmation/cancel flows, and TalkBack announcements using a diary day with multiple meals and an empty meal.
- **Expected result:** Controls remain visible and accessible; selected, mixed, and empty states are announced accurately; cancelling and error behavior match AC-10.
- **Result:** Not run (`adb` unavailable).
