# Plan: US-06 Verlauf, Zusammenfassung und nachträgliche Session

Story: [US-06_Verlauf-Zusammenfassung-Nachtrag.md](US-06_Verlauf-Zusammenfassung-Nachtrag.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 5 to 8)  
Infrastructure Impact: None (the containers exist since US-02; the backend deployment is a separate command)  
Mobile Build Impact: None

Status: Ready for Orchestrator after Product Owner approval of the story and after US-03 and US-05. Open Product Owner Decisions: none.

## 1. Requirement Assessment

**Accept as proposed.** Summary values are derived, never stored (epic Section 5), so corrections cannot make them inconsistent. The 24 hour maximum duration below is a proposed heuristic.

## 2. Current Behaviour

From US-03: sessions and entries can be created, finished and deleted; entries of finished sessions can be edited by route; `trainingSessions` documents carry `sortKey`. `summarizeSession` exists in `shared`. The mobile store focuses on the active session. `ProgressCalendar` (`mobile/src/modules/progress/ProgressCalendar.tsx`) is a month calendar that disables future days. No time-of-day picker library is installed (`mobile/package.json`).

## 3. Desired Behaviour

As in the story. Technical decisions:

- **History query:** `SELECT * FROM c WHERE c.userId = @userId AND c._docType = 'boulderSession' AND c.status = 'finished' ORDER BY c.sortKey DESC` with Cosmos continuation as the opaque `cursor`; the entries of the page's sessions are loaded with one query using `ARRAY_CONTAINS(@sessionIds, c.sessionId)`. Page size 20 (proposed heuristic). Ties inside one page are sorted by `createdAt`; ties across a page boundary are possible and accepted.
- **Summaries:** computed with `summarizeSession` per session; the response contains `summary` with boulder count, attempts sum, topped count, flash count, hardest topped grade (label and colour key), distribution by `levelId`.
- **Corrections:** `PUT /boulder/sessions/{id}` accepts `localDate`, `startedAt`, `endedAt` (nullable for backfill sessions). Rules: `localDate` not in the future (server UTC plus one day); `endedAt >= startedAt`; duration at most 24 h; an active session cannot get an `endedAt`; `sortKey` is rewritten when `localDate` changes.
- **Backfill:** `POST /boulder/sessions` with `origin: 'backfill'`, `localDate`, optional `startedAt` and `endedAt`; stored as `status: 'finished'`; does not conflict with an active session.
- **Mobile store:** generalized from "the active session" to "the session in focus" (`openSession(sessionId)` loading `GET /boulder/sessions/{id}`), reused by the capture screen in backfill mode (header `Nachtrag · <Datum>`, no timer, `Speichern`).
- **Date input:** reuse the calendar component through a thin wrapper or extraction (no new dependency); time input is a small stepper input (hour and minute, minute step 5, proposed heuristic) built in this story because no picker library exists; if the Frontend agent proposes a native picker instead, the plan is revised first (`Mobile Build Impact` would change).
- **Empty backfill sessions:** deleted by the app when the capture screen is left without entries; an app kill can leave an empty session; the history shows it with `0 Boulder` and it can be deleted.
- **Day type area:** `FinishDayArea` from US-05 is reused with the session date.

## 4. Scope

History, detail and summary routes, corrections, backfill, history and summary screens, backfill flow, documentation.

## 5. Out of Scope

Filter by sport, charts and progress analysis (the Progress tab, `[Planned]`), project handling (US-07), photos (US-07).

## 6. Existing Components to Reuse

`summarizeSession`, `BoulderSessionRepository`, `ProgressCalendar`, `SwipeableRow`, `ConfirmSheet`, capture screen and entry sheet (US-03), `FinishDayArea` (US-05).

## 7. Backend Work Packages

### WP-BE-01 — Repository and handlers

Agent: Backend

Goal: Extend the session repository with `listFinishedSessions(userId, limit, continuation)`, `listEntriesForSessions(userId, sessionIds)`, `updateSession` (rewrites `sortKey`). Add the US-06 routes to `boulderSessions.ts`: `GET /boulder/sessions` (limit default 20, maximum 50, opaque `cursor`), `GET /boulder/sessions/{sessionId}` (session, entries, summary), `PUT /boulder/sessions/{sessionId}`, and backfill creation in `POST /boulder/sessions`. Return DTOs per epic Section 7. Handler tests for ordering, paging with cursor, summary values, correction validation, backfill rules, foreign IDs (`404`), no log of free text. Contract test for the new queries written, CI only.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/boulderSessions.ts
- backend/src/lib/repositories/ (session repositories from US-03)
- shared/lib/boulderRules.ts
- backend/src/lib/deltaSync.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-4
- AC-7
- AC-8
- AC-10
- AC-12

Dependencies:
- US-03 complete

Expected Handoff:
- request and response shapes, error codes
- cursor format description (opaque to the client)

### WP-BE-02 — Documentation

Agent: Backend

Goal: Update `docs/kb/tech/09-api-reference.md`, `docs/kb/domain/10-training-bouldering.md` (history, summary values, correction rules, backfill, heuristics marked) and `docs/kb/tech/02-backend.md`.

Required Knowledge Base:
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- WP-BE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-15

Dependencies:
- WP-BE-01

Expected Handoff:
- changed KB files

## 8. Frontend Work Packages

### WP-FE-01 — History and summary

Agent: Frontend

Goal: Extend `boulderApi.ts` and generalize the store (`openSession`). Implement `HistoryScreen` (S9: month sections, rows, infinite loading, empty and error states, `Session nachtragen` button), `SessionSummaryScreen` (S7: key figures, distribution bars using `GradeChip` colours with label, entry list with edit via the detail sheet and swipe delete, `Zeiten ändern` sheet, `Session löschen` with `ConfirmSheet`), the hub rows `Letzte Einheiten` and `Alle anzeigen`, and navigation from the finish flow to the summary. Tests for paging, grouping by month, summary rendering (flash counted in topped and separately), delete confirmation, correction rejection messages.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/modules/training/
- mobile/src/shared/api/boulderApi.ts
- WP-BE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-14

Dependencies:
- WP-BE-02

Expected Handoff:
- routes and params
- store changes

### WP-FE-02 — Time and date input

Agent: Frontend

Goal: Build `SessionTimesSheet` and the date field: date through the calendar component (future days disabled), start and end through a stepper input (hour and minute, minute step 5), validation messages for end before start and duration over 24 h, and the same sheet inside the backfill start screen. No new dependency. Tests for validation and value conversion to ISO UTC from local time.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/progress/ProgressCalendar.tsx
- mobile/src/shared/date/

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-7
- AC-10

Dependencies:
- WP-FE-01

Expected Handoff:
- component props and conversion rules

### WP-FE-03 — Backfill flow

Agent: Frontend

Goal: Implement `BackfillStartScreen` (S8: date default yesterday, gym via the picker in `select` mode, optional times, `Weiter`) creating the backfill session, then the capture screen in backfill mode (`Nachtrag · <Datum>`, no timer, `Speichern`), automatic deletion when left without entries, and the finish sheet with the `FinishDayArea` for the session date (`Speichern` instead of `Session beenden`). Tests for the flow, the empty-session deletion and the date passed to the day type area.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/training/session/
- WP-FE-01 and WP-FE-02 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-10
- AC-11
- AC-12
- AC-13

Dependencies:
- WP-FE-02

Expected Handoff:
- backfill mode contract of the capture screen

### WP-FE-04 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/02-navigation.md`, `docs/kb/product/05-ux-patterns.md` and `docs/kb/tech/03-mobile.md` (history, summary, backfill, time input).

Required Knowledge Base:
- docs/kb/product/02-navigation.md

Required Repository Context:
- WP-FE-01 to WP-FE-03 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-15

Dependencies:
- WP-FE-03

Expected Handoff:
- changed KB files

## 9. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria, ordering and paging behaviour with in-memory data, the derived summaries after corrections, and the persistence rules (`sortKey` rewrite). Manual validation stays open: history with many sessions on a device, time stepper usability, 320 and 360 dp, font scale 1.3.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- backend/src/functions/boulderSessions.ts
- mobile/src/modules/training/
- all handoffs of this plan

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1 to AC-15

Dependencies:
- WP-BE-02, WP-FE-04

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 10. Test Strategy

Backend handler tests with in-memory repositories, contract tests written (CI only), shared summary tests extended with correction scenarios, mobile component and flow tests; commands per epic Section 13.

## 11. Acceptance Criteria

1. `GET /boulder/sessions?limit=20` returns finished sessions only, ordered by `sortKey` descending, with `nextCursor`; passing `cursor` returns the next page without overlap; `limit` above 50 is rejected with `422`; the app groups rows under month headings and loads the next page when the end of the list is reached.
2. Each list row and DTO contains `localDate`, gym name, duration in minutes (null when a time is missing), boulder count and attempts sum; the app shows `–` for a missing duration.
3. Pressing a row opens `SessionSummaryScreen` loaded from `GET /boulder/sessions/{id}`; a foreign or unknown ID returns `404`.
4. `summary` contains boulder count, attempts sum, topped count including flash, flash count, hardest topped grade (highest snapshot rank among `topped` and `flash`), and a distribution by `levelId` with boulder count and topped count; for 9 entries with 2 flash, 4 topped and 3 open the response has `toppedCount = 6` and `flashCount = 2`; an empty session has zeros and no hardest grade.
5. After `Session beenden` the app navigates to the summary of that session.
6. Editing or deleting an entry on the summary refreshes all key figures; deletion supports `Rückgängig`.
7. `PUT /boulder/sessions/{id}` accepts `localDate`, `startedAt`, `endedAt`; it returns `422 session_time_invalid` for `endedAt < startedAt`, a duration over 24 h, or `endedAt` on an active session, and `422` for a `localDate` later than the server UTC date plus one day; changing `localDate` changes `sortKey`; the app displays the matching messages.
8. Neither the API nor the app can change `gymId` of an existing session (an unknown body field returns `422`; the app shows no gym edit control).
9. `DELETE /boulder/sessions/{id}` after a `ConfirmSheet` confirmation removes the session and its entries; the history no longer lists it.
10. `POST /boulder/sessions` with `origin: 'backfill'` creates a finished session for the given `localDate` without conflicting with an active session; a future `localDate` returns `422`; the date picker disables future days.
11. In backfill mode the capture screen shows `Nachtrag · <Datum>`, no running timer, and `Speichern` instead of `Beenden`; entries are created with the same interaction and tap counts as live (2 and 3 taps).
12. Leaving a backfill session without entries deletes it; leaving it with entries keeps it.
13. The finish sheet of a backfill session passes the session `localDate` to the day type area; the calls use that date.
14. The empty history shows `Noch keine Einheiten.`; a failed load shows `Erneut versuchen`; a failed next page keeps the loaded pages and offers a retry.
15. The Knowledge Base documents the history and summary values, the correction and backfill rules, the heuristics (page size 20, 24 h, minute step 5) marked as proposed, and `[Planned]` for the sport filter.

## 12. Risks and Edge Cases

- Sorting ties across page boundaries are possible; accepted.
- A day boundary: the `localDate` is set by the client; a session that crosses midnight keeps its start date.
- Empty backfill sessions can remain after an app kill; the history shows and allows deleting them.
- The custom time stepper is less convenient than a native picker; revisit if feedback demands it.
- Hardest grade is based on snapshot ranks; after a gym scale reorder the ranks of old and new entries may not be comparable (epic Section 14).

## 13. Recommended Execution Order

1. WP-BE-01, 2. WP-BE-02, 3. WP-FE-01, 4. WP-FE-02, 5. WP-FE-03, 6. WP-FE-04, 7. WP-QA-01. Sequential.
