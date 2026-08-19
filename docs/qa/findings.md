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

`UNVERIFIED` and `MANUAL VALIDATION REQUIRED` are verification states, not finding criticalities.

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

## Verification Notes (Not Findings)

These items were reported as unverified environment checks. They must not lower a QA verdict and must not enter the actionable finding list unless a defect is demonstrated.

### VER-2026-001 - Azure live evals

- **State:** `UNVERIFIED`
- **Reason:** Azure OpenAI credentials were not available in the test environment.
- **Manual action:** Run `cd backend && npm run test:eval` in an appropriately configured environment and record the result.

### VER-2026-002 - Cosmos contract tests

- **State:** `UNVERIFIED`
- **Reason:** The local Cosmos emulator was not running during the review.
- **Manual action:** Start the approved local emulator or rely on the CI service container, then run `cd backend && npm run test:contract`.

### VER-2026-003 - Real-device and viewport checks

- **State:** `MANUAL VALIDATION REQUIRED`
- **Reason:** No `adb`-connected device or equivalent viewport/screen-reader setup was available to the QA agent.
- **Manual action:** Execute the device and accessibility checklist from the approved plan and record the actual result separately from this findings register.
