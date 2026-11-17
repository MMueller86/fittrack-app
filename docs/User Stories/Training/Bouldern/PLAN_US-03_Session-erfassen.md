# Plan: US-03 Boulder-Session starten, erfassen und beenden

Story: [US-03_Session-erfassen.md](US-03_Session-erfassen.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 4 to 9)  
Infrastructure Impact: Alpha (no new work: relies on the containers created by US-02 WP-INFRA-01; backend deployment requires them to exist in the target environment)  
Mobile Build Impact: Potential Native Impact (`expo-keep-awake`; see Section 3)

Status: Ready for Orchestrator after Product Owner approval of the story and after US-02. Open Product Owner Decisions: none.

## 1. Requirement Assessment

**Accept as proposed.** The count-based capture replaces the per-attempt flow of the original epic with identical stored results. The click budget (concept Section 4) is an acceptance criterion: first-try top = 2 taps, five attempts = 3 taps.

Domain check: no calorie or health calculation is introduced. The Flash rule is the Product Owner's rule (PO-4) and lives in one shared function.

## 2. Current Behaviour

No session, entry or capture code. Available: `profileApi.setDayType`, `expo-haptics`, `react-native-gesture-handler`, bottom sheets (`@gorhom/bottom-sheet`), `SwipeableRow`, snackbar pattern, `GradeChip` and `GymPickerScreen` with `select` mode (US-02).

## 3. Desired Behaviour

As in the story. Technical decisions:

- **Keep awake:** `expo-keep-awake` (resolved: `expo` 58 depends on `~58.0.4`; `npm view expo-keep-awake dist-tags.latest` returned 58.0.4 on 2026-11-16). The Frontend agent checks whether it resolves in the installed workspace. If it is only transitive, add it as a direct dependency with `npx expo install expo-keep-awake`. `Mobile Build Impact` stays `Potential Native Impact` until Infrastructure & Release decides `Dev Build Required`.
- **Haptics:** `expo-haptics` (already installed).
- **Tab bar hiding:** the Session screen hides the parent tab bar through the tab navigator options while focused and restores it on blur and on unmount. If that proves unreliable on Android, move the Session screen to a root-level stack above the tabs. The Frontend agent verifies Back behaviour on a device (manual validation) and reports the chosen mechanism.
- **Optimistic UI with in-memory retry:** an action updates the store immediately and sends the request; failed sends keep the entry flagged `failed` until retried or dismissed. Operations per entry ID are serialized (create before update before delete); different entries are independent. No persistence of pending operations (PO-2).
- **Idempotency:** session and entry IDs are client-generated UUID v4. Repeating `POST` or `PUT` with the same ID does not create a duplicate.
- **Server authority:** the backend normalizes the result (epic Section 6) and returns the stored entry; the client replaces its local copy.
- **Timer:** elapsed time is derived from `startedAt`; the header refreshes once per minute.
- **Last grade preselection:** the grade of the most recent entry of the active session; with no entries the card shows `Wähle eine Stufe` and its buttons are disabled.
- **Entry creation moment:** an entry document is created only when `Geschafft`, `Offen`, or an automatic `Offen` on grade change happens (concept principle 7).
- **Entry upsert and projects:** in this story the schema is strict: `projectId` and `photo` are rejected until US-07 extends it.

## 4. Scope

Shared rules, session and entry persistence, session and entry routes, `recent-gyms`, account deletion for `trainingSessions`, hub start and resume, capture screen, detail sheet, finish sheet, documentation.

## 5. Out of Scope

History, summary screen, correction of session times and backfill (US-06); Home cards and forgotten-session prompt (US-04); day type link (US-05); projects, project stars and photos (US-07).

## 6. Existing Components to Reuse

Gym repository and `GradeChip` (US-02), `weightsRepository.ts` pattern, `withHandler`, `parseBody`, `useDayTypeStore` as the store pattern, `SwipeableRow`, snackbar, `ConfirmSheet`, `InfoOverlay`, bottom-sheet snap points `['50%','92%']`.

## 7. Backend Work Packages

### WP-BE-01 — Shared rules

Agent: Backend

Goal: Create `shared/lib/boulderRules.ts` with `resolveResult`, `normalizeEntryResult`, `summarizeSession`, `isForgottenSession`, `suggestEndedAt` exactly as specified in the epic Section 6 (without `shouldSuggestProject` and `resolveFinishDayAction`, which belong to US-07 and US-05) and export them from `shared/index.ts`. Unit tests for every rule and boundary: attempts 1 and 2; prior project attempts 0 and 1; a `flash` with 2 attempts is normalized to `topped`; `progress` cleared when result is not `open`; `isForgottenSession` at 1 h 59 min 59 s, exactly 2 h and later; `suggestEndedAt` with and without entries; summary of an empty session; flash counted in topped and separately.

Required Knowledge Base:
- docs/kb/tech/04-shared-library.md

Required Repository Context:
- shared/types/boulder.ts
- shared/lib/weeklyReviewCalculator.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-3
- AC-4
- AC-5
- AC-9
- AC-10
- AC-12

Dependencies:
- US-02 WP-BE-01a (shared types)

Expected Handoff:
- function signatures
- list of test cases

### WP-BE-02 — Session repository

Agent: Backend

Goal: Implement `BoulderSessionRepository` (interface, in-memory, Cosmos) on the `trainingSessions` container: `createSession` (idempotent on ID; writes the internal `sortKey = localDate + '#' + createdAt` required by the history query of US-06 — see epic Section 7), `getSession`, `getActiveSession`, `listEntries(sessionId)`, `upsertEntry` (create or replace; keeps `createdAt`; rejects an existing entry that belongs to another session), `deleteEntry`, `finishSession` (idempotent), `deleteSessionWithEntries` (entries first in chunks of at most 100 operations per transactional batch, then the session; a repeated call completes a partial deletion), `listRecentGymRefs(userId, limit)` (last 20 sessions by `createdAt` descending, deduplicated by `gymId` in code, so no `DISTINCT` with `ORDER BY` is needed). Contract test file written for CI only; unit tests on the in-memory implementation.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/repositories/weightsRepository.ts
- backend/src/lib/repositories/cosmosWeightsRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts
- backend/src/lib/cosmos.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-2
- AC-13
- AC-14
- AC-18

Dependencies:
- WP-BE-01
- US-02 WP-BE-01b (`CONTAINER_DEFS` entry)

Expected Handoff:
- repository interface
- note which tests are contract-only

### WP-BE-03 — Session handlers

Agent: Backend

Goal: Create `backend/src/functions/boulderSessions.ts` with the US-03 routes of the epic Section 7: `GET /boulder/sessions/active`, `POST /boulder/sessions` (live only), `PUT` and `DELETE /boulder/sessions/{sessionId}/entries/{entryId}`, `POST /boulder/sessions/{sessionId}/finish`, `DELETE /boulder/sessions/{sessionId}`, and `GET /boulder/recent-gyms` (returns `BoulderGymDto`s of the user's gyms resolved from the gym repository, skipping gyms that no longer resolve). Import the module in `backend/src/index.ts`. Rules:

- `POST` returns `201` for a new session, `200` for the same client ID again, `409 { error: "session_already_active", sessionId }` when another active session exists, `404 gym_not_found`; `startedAt` is the server time; `localDate` is validated as `YYYY-MM-DD` and not more than one day in the future relative to server UTC.
- Entry upsert: Zod `.strict()`; `attempts` 1 to 99; `comment` at most 500 characters; `zone` at most 60; `grade.levelId` must exist in the session's gym and be active, or equal the grade already stored in that entry; the stored `grade` snapshot is built by the server from the gym level (the client sends only `levelId`); result normalized with `normalizeEntryResult` and `priorProjectAttempts = 0`; at most 200 entries per session (`422 session_entry_limit`); response `200 { entry }` with the stored entry as DTO (epic Section 7 DTO rules).
- Entries can be written to finished sessions (history corrections later).
- Finish: `endedAt` default now; an optional `endedAt` must be at or after `startedAt` and not in the future (`422 session_time_invalid`); idempotent.
- No free text (comment, zone, gym name) in logs; log IDs, counts and codes.
- Handler tests with in-memory repositories for every route: 401, foreign session 404, validation 422, idempotent retries, conflict 409, normalization, entry limit, finished-session edit, recent gyms deduplication and order.
- Verify that `boulder/recent-gyms` and `boulder/gyms/{id}` do not collide (registration test).

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/weights.ts
- backend/src/functions/boulderGyms.ts
- backend/src/lib/http.ts
- backend/src/index.ts
- backend/src/lib/registrations.test.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-8
- AC-9
- AC-10
- AC-11
- AC-13
- AC-14
- AC-15

Dependencies:
- WP-BE-02

Expected Handoff:
- final request and response shapes with error codes
- privacy report: data stored, what is logged

### WP-BE-04 — Account deletion

Agent: Backend

Goal: `trainingSessions` is already in `USER_DATA_CONTAINERS` since US-02. Extend the deletion tests so that documents of all four types (`boulderGym`, `boulderSession`, `boulderEntry`, `boulderProject`) of the user are removed and documents of another user remain; add no production change unless the tests show a gap.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/repositories/profileDeletionRepository.ts
- backend/src/lib/repositories/profileDeletionRepository.test.ts
- backend/src/lib/profileDeletion.test.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-18

Dependencies:
- WP-BE-02

Expected Handoff:
- changed tests and the final container list

### WP-BE-05 — Documentation

Agent: Backend

Goal: Update `docs/kb/tech/09-api-reference.md` (routes, shapes, error codes), `docs/kb/tech/02-backend.md` (module table, deletion), `docs/kb/tech/04-shared-library.md`, and `docs/kb/domain/10-training-bouldering.md` (session, entry, result and flash rules, limits marked as proposed heuristics, single active session, deletion). Mark US-04 to US-07 contents `[Planned]`.

Required Knowledge Base:
- docs/kb/tech/09-api-reference.md
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- WP-BE-01 to WP-BE-04 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-19

Dependencies:
- WP-BE-04

Expected Handoff:
- changed KB files

## 8. Frontend Work Packages

### WP-FE-01 — API client and session store

Agent: Frontend

Goal: Extend `boulderApi.ts` with the session, entry, finish, delete and `recent-gyms` calls. Create `useBoulderSessionStore` (Zustand): active session and entries, current boulder draft (grade, attempts), per-entry status (`synced`, `pending`, `failed`), serialized operation queue per entry ID, `loadActive()`, `startSession(gymId)` (handles `409 session_already_active` by loading the active session), `commitEntry`, `undo` actions, `retry`, `deleteEntry`, `finish`, `discard`. Uses `resolveResult` and `normalizeEntryResult` from `@fittrack/shared` for the optimistic result and replaces the local entry with the server response. Store tests: optimistic update, failed send then retry produces exactly one entry, ordering of create then update then delete, undo of create and undo of delete (re-upsert with the same ID), `409` resume, server correction of a flash.

Required Knowledge Base:
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/03-mobile.md

Required Repository Context:
- mobile/src/shared/api/boulderApi.ts
- mobile/src/modules/nutrition/useDayTypeStore.ts
- shared/lib/boulderRules.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-2
- AC-6
- AC-8
- AC-9
- AC-11
- AC-13
- AC-14

Dependencies:
- WP-BE-05

Expected Handoff:
- store API and state shape
- test list

### WP-FE-02 — Hub start and resume

Agent: Frontend

Goal: In `TrainingHubScreen` add the start card in two states: idle (`Bouldern`, last gym from `recent-gyms`, `Starten`, `Andere Halle`) and running (`Bouldern läuft`, elapsed time, entry count, `Training fortsetzen`). Without a recent gym `Starten` opens `GymPickerScreen` in `select` mode and starts after the choice. Loading, error with `Erneut versuchen`, offline start via `InfoOverlay`. Use the Home-style card (Card DNA). Tests for the states and for the single-tap start.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/modules/training/hub/
- mobile/src/modules/training/gyms/GymPickerScreen.tsx
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-14

Dependencies:
- WP-FE-01

Expected Handoff:
- route params
- state matrix

### WP-FE-03 — Capture screen

Agent: Frontend

Goal: Implement `BoulderSessionScreen` per concept S3: header (back, gym, elapsed time, `Beenden`), status line, entry list with `SwipeableRow`, fixed bottom area with the grade chip grid (`GradeChip` 56 dp variant, wrapping rows, active levels only), current card (attempt chips 1 to 5 plus `−` and `+`, `Offen`, `Geschafft`), snackbar actions (`Kein Flash`, `Rückgängig`), failed-send marking with `Erneut senden`, connection hint line, `expo-haptics` on every saved action, `expo-keep-awake` while focused, tab bar hidden while focused, Back leaves without finishing. Add `expo-keep-awake` as a direct dependency only if it does not resolve (see Section 3). Component and interaction tests for the click budget (2 and 3 taps), grade change auto-open rule, undo and flash correction, snackbar rules, failed marking.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/modules/training/
- mobile/src/modules/training/components/GradeChip.tsx
- mobile/src/app/navigation/RootNavigator.tsx
- mobile/src/shared/components/ (SwipeableRow, snackbar)
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-9
- AC-11
- AC-12
- AC-13
- AC-16
- AC-17

Dependencies:
- WP-FE-02

Expected Handoff:
- tab-bar hiding mechanism and any fallback used
- `Mobile Build Impact` confirmation and whether `package.json` changed
- test list

### WP-FE-04 — Detail sheet and finish sheet

Agent: Frontend

Goal: Implement the entry detail sheet (S4) with versions only for this story's fields: attempts stepper, result chips (`Flash` disabled unless attempts are exactly 1), progress chips (only for `Offen`), zone and comment fields, `Speichern`, delete action with immediate delete and `Rückgängig`. Implement the finish sheet (S6, without the day type area, which US-05 adds): summary line and `Session beenden`, or `Session verwerfen` when there are no entries, and `Weiter trainieren`. After finishing return to the hub with a snackbar `Session beendet · <Dauer> · <n> Boulder`. Tests for consistency rules in the sheet (flash disabled, auto downgrade with notice, progress hidden after success) and for the finish flows.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/training/session/
- WP-FE-03 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-10
- AC-15

Dependencies:
- WP-FE-03

Expected Handoff:
- extension point for the day type area of US-05

### WP-FE-05 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/05-ux-patterns.md` (capture pattern: count-based entry, auto-commit rule, undo), `docs/kb/product/03-design-system.md` (capture components), `docs/kb/product/02-navigation.md` (routes, tab bar hidden in the session), `docs/kb/tech/03-mobile.md` (store, optimistic retry, known limitation without offline).

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- WP-FE-01 to WP-FE-04 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-19

Dependencies:
- WP-FE-04

Expected Handoff:
- changed KB files

### WP-FE-06 — Privacy policy update (stage 1)

Agent: Frontend

Goal: Apply stage 1 of the approved wording from the epic plan Section 11 to `docs/legal/datenschutzerklaerung-alpha.md` (PO-K approved 2026-11-16): the new bullet in `Welche Daten verarbeiten wir?` and the new sentence in `Speicherdauer und Löschen`. Update the `Stand:` date and change nothing else in the file.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- docs/legal/datenschutzerklaerung-alpha.md
- docs/User Stories/Training/Bouldern/PLAN_EPIC_Training_Bouldern.md (Section 11)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-20

Dependencies:
- WP-FE-05

Expected Handoff:
- policy diff limited to the two stage 1 changes

## 9. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria, the click budget by test, the idempotency and the account deletion, the privacy handling and the persistence rules. Contract tests are checked as written and passing in CI only. Manual validation stays open and is listed explicitly: physical device with Android Back, tab bar hiding and restoration, keep-awake behaviour, haptics, 320 and 360 dp, font scale 1.3, offline hint, airplane-mode retry, app kill and resume.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- backend/src/functions/boulderSessions.ts
- backend/src/lib/repositories/
- shared/lib/boulderRules.ts
- mobile/src/modules/training/
- all handoffs of this plan

Required Skills:
- cosmos-data-model-and-migration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-20

Dependencies:
- WP-BE-05, WP-FE-06

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 10. Test Strategy

Shared unit tests for all rules; backend handler and repository unit tests with in-memory repositories; Cosmos contract tests written, CI only; mobile store, component and interaction tests including the tap-count tests; commands per epic Section 13; `smoke:bundle` and `smoke:doctor` because a dependency may be added.

## 11. Acceptance Criteria

1. With a recent gym, one tap on `Starten` calls `POST /boulder/sessions`, shows the capture screen and the hub then shows the running state; without a recent gym the gym picker opens in `select` mode and the session starts after the selection.
2. `POST /boulder/sessions` returns `201` for a new ID, `200` when repeated with the same ID, `409 { error: "session_already_active", sessionId }` when another active session exists, `404 gym_not_found` for an unknown gym; the app resumes the existing session on `409`.
3. Selecting a grade and pressing `Geschafft` with the attempt count 1 stores one entry with `result: "flash"` and `attempts: 1`; this takes exactly two taps in the component test (grade chip, `Geschafft`).
4. Selecting a grade, the chip `5` and `Geschafft` stores `result: "topped"` and `attempts: 5` in exactly three taps.
5. Selecting a grade, the chip `5` and `Offen` stores `result: "open"` and `attempts: 5`; no `progress` is set.
6. Tapping `+` twice then `Geschafft` stores `topped` with 3 attempts, identical to selecting chip `3` then `Geschafft`.
7. After saving an entry the same grade remains selected and the attempt count is 1; no entry exists before the first result action.
8. Changing the grade with an attempt count of 3 and no result stores `open` with 3 attempts and shows `Rückgängig`; changing the grade with attempt count 1 untouched stores nothing.
9. After a flash the snackbar offers `Kein Flash`; pressing it changes the stored entry to `topped` with 1 attempt; `Rückgängig` deletes the entry.
10. `PUT .../entries/{entryId}` returns the stored entry; a request with `result: "flash"` and `attempts: 2` is stored as `topped`; `progress` with a non-`open` result is dropped; `attempts` 0 or 100, a comment over 500 characters, a zone over 60 characters, an unknown `levelId` and an inactive `levelId` (for a new entry) return `422` with stable codes; unknown body fields return `422`.
11. `DELETE` of an entry returns `204`; swiping removes the row and `Rückgängig` restores the entry with the same ID through an idempotent `PUT`.
12. The session summary line shows `n Boulder · m Versuche · k ✓` (k counts `topped` and `flash`); `summarizeSession` counts flash in the topped total and separately, and returns zeros for an empty session; the header shows the gym and the elapsed minutes.
13. When a request fails the row shows `Nicht gespeichert · Erneut senden`; pressing it resends the same ID and the final state contains exactly one entry; entry operations for the same ID are sent in the order create, update, delete.
14. `GET /boulder/sessions/active` returns the session and its entries sorted by `createdAt`; after killing and reopening the app the hub shows the running state and `Training fortsetzen` restores the entries; `GET /boulder/recent-gyms` returns at most 5 distinct gyms ordered by latest session.
15. `POST .../finish` sets `endedAt` and `status: "finished"`, repeating it changes nothing, an `endedAt` before `startedAt` or in the future returns `422 session_time_invalid`; `DELETE /boulder/sessions/{id}` removes the session and all its entries and returns `204`; a foreign session ID returns `404` for every route.
16. While the capture screen is focused the device stays awake and the tab bar is hidden; pressing Back returns to the hub with the session still active; the tab bar is visible again afterwards.
17. In the component test the grade chips, attempt chips and steppers have a minimum height of 48 dp and `Offen` and `Geschafft` of 56 dp; the shared chips use theme tokens.
18. Account deletion removes all `boulderSession`, `boulderEntry` documents of the user (`trainingSessions` is in `USER_DATA_CONTAINERS`); a repeated deletion succeeds.
19. The Knowledge Base documents the routes, error codes, rules and the capture pattern, marks US-04 to US-07 contents `[Planned]`, and states the known limitation that unsent actions are lost when the app is killed.
20. The privacy policy contains exactly the two stage 1 changes of the epic Section 11 (training data bullet, deletion sentence) and a new `Stand:` date and no other change.

## 12. Risks and Edge Cases

- Tab bar hiding and Back behaviour differ between devices; manual validation required.
- Rapid taps create many small writes; acceptable on the serverless account, to be watched in telemetry.
- A flash decided on stale local data is corrected by the server and the client replaces its copy; the user may see the result change from `flash` to `topped`.
- Two devices with the same account can both try to start a session; the `409` response resolves it to one active session.
- Deleting a session with many entries is chunked and not atomic; a repeated call completes it.
- Session `localDate` is the client's local date; server only checks format and plausibility.
- Day boundary: a session that runs across midnight keeps the date of its start.

## 13. Recommended Execution Order

1. WP-BE-01, 2. WP-BE-02, 3. WP-BE-03, 4. WP-BE-04, 5. WP-BE-05, 6. WP-FE-01, 7. WP-FE-02, 8. WP-FE-03, 9. WP-FE-04, 10. WP-FE-05, 11. WP-FE-06, 12. WP-QA-01. Sequential. Precondition: US-02 is complete and the containers exist in the target environments before any backend deployment.
