# Plan: US-07 Boulder-Projekte und Fotos

Story: [US-07_Projekte-und-Fotos.md](US-07_Projekte-und-Fotos.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 4 to 9, 11)  
Infrastructure Impact: None (the blob container `boulder-photos` and the Cosmos containers exist since US-02; the backend deployment is a separate command)  
Mobile Build Impact: None (`expo-camera`, `expo-image-picker` and the framed camera components exist; no `app.config.js` change, PO-M)

Status: Ready for Orchestrator after Product Owner approval of the story and after US-03. Open decision: PO-J (see below). PO-K is approved.

## Open Product Owner Decisions

| ID | Decision needed | Planner recommendation | Blocks |
|---|---|---|---|
| PO-J | Photo limits (size, count). | 8 MB, one photo per entry, JPEG or PNG; the story and this plan use these values as proposed heuristics. | Nothing to start; values live in one constants location |

## 1. Requirement Assessment

**Accept as proposed.** Projects are derived aggregates over entries (no stored counters), so corrections stay consistent. Privacy impact is the largest of the epic: user photos and free text are stored; see the epic Section 11 and the Privacy Impact below.

Privacy Impact: Policy update proposed. Data flow, affected sections and proposed German wording are in the epic plan Section 11 (stage 2 applied by WP-FE-05; PO-K approved 2026-11-16). Additional facts for this story: the photo goes from the device to the backend and into private Blob Storage (`boulder-photos`), read access only through 1 hour SAS links created by the backend after an ownership check; photos may show people or private surroundings (user responsibility; not scanned); blob soft delete of up to seven days applies (existing policy statement); photos are deleted with the entry, the session and the account.

## 2. Current Behaviour

From US-03 and US-06: entries have no project or photo handling; the strict entry schema rejects `projectId` and `photo`. `storage.ts` has recipe and product image upload, delete, listing by user prefix and SAS functions; `profileDeletion.ts` deletes personal recipe and product images by prefix. `FramedCameraCapture`, `FramedPhotoPicker` exist.

## 3. Desired Behaviour

As in the story. Technical decisions:

- **Project documents:** `BoulderProject` (epic Section 5) in `trainingSessions`. Created by the entry upsert when an entry arrives with a `projectId` that does not exist yet (the client generates the ID); then gym, grade snapshot and zone are copied from the entry. Status stored is only `open` or `archived`; `topped` is derived (an entry with result `topped` or `flash` exists).
- **Entry upsert with `projectId`:** the project must belong to the user and the same gym; `grade.levelId` of the entry must equal the project's level (`422 project_grade_mismatch`); a new entry (not an update of an existing one) for an archived project returns `422 project_archived`, for a topped project `422 project_not_open`. `priorProjectAttempts` = sum of `attempts` of all other entries of the project, passed to `normalizeEntryResult`. The first entry of a new project has prior attempts 0.
- **Remove flag** (`projectId: null` on an entry that had one): if all entries of the project belong to that entry's session, all of them are unflagged and the project is deleted; otherwise `409 { error: "project_has_history" }` and nothing changes (the app offers archiving).
- **Delete entry or session:** projects without remaining entries are deleted; projects with entries in other sessions stay; blobs of removed entries are deleted.
- **Photo:** `POST /boulder/sessions/{sessionId}/entries/{entryId}/photo` (multipart field `image`, `image/jpeg` or `image/png`, at most 8 MB), stored at `{userId}/{entryId}/{photoId}.{ext}`; replaces and deletes a previous photo; the entry stores `{ photoId, blobName }`; DTOs expose `photoUrl`. `DELETE` removes the blob and the reference. Reuses the pattern of `recipes.ts` (`request.formData()`, content type and size checks, SAS URL).
- **Aggregates:** `aggregateProject(entries, sessions)` in `shared` returns attempts sum, session count, latest progress and zone, `toppedAt`, `lastEntryAt`, derived status.
- **Project suggestion:** `shouldSuggestProject(attempts, result)` in `mobile/src/modules/training/session/projectSuggestion.ts`.
- **Mobile photo handling:** capture with the existing framed camera components; downscale to a maximum long edge of 1600 px (proposed heuristic) before upload; the upload operation of an entry is queued behind that entry's create operation in the store; failures show `Foto nicht gespeichert · Erneut senden`.

## 4. Scope

Project and photo persistence and routes, extended entry rules, account deletion for blobs, capture screen additions (star, camera, suggestion, project sheet, continue), project overview and detail, hub row, policy text, documentation.

## 5. Out of Scope

Sharing of projects or photos, image editing beyond the existing crop, AI image features, restoring an archived project, notifications, hall-level boulder identification.

## 6. Existing Components to Reuse

`storage.ts` and the multipart handling in `recipes.ts`, `profileDeletion.ts` dependency pattern, `FramedCameraCapture`, `FramedPhotoPicker`, `GradeChip`, `ConfirmSheet`, segmented control from US-01, bottom sheet, `SwipeableRow`.

## 7. Backend Work Packages

### WP-BE-01 — Shared project rules

Agent: Backend

Goal: Add `aggregateProject` to `shared/lib/boulderRules.ts`, and `BoulderProjectDto`, `BoulderProjectAggregate` types to `shared/types/boulder.ts`; add `BoulderEntryDto` with `photoUrl`. Unit tests: no entries, entries across two sessions, topped project, reopening after the topping entry is removed, latest progress selection by `updatedAt`, session count.

Required Knowledge Base:
- docs/kb/tech/04-shared-library.md

Required Repository Context:
- shared/lib/boulderRules.ts
- shared/types/boulder.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-8
- AC-9
- AC-12
- AC-14

Dependencies:
- US-03 complete

Expected Handoff:
- function signatures and DTO types

### WP-BE-02 — Project repository and entry rules

Agent: Backend

Goal: Extend the session repository with project operations: `getProject`, `listProjects(userId, { gymId?, status? })`, `listEntriesByProject(userId, projectId)`, `createProject`, `archiveProject`, `deleteProject`, and transactional-safe helpers for the unflag-all rule. Extend the entry upsert in `boulderSessions.ts` (strict schema gets `projectId`; the rules in Section 3), the entry delete and session delete flows (project cleanup, blob cleanup call through an injected storage dependency). Repository and handler tests with in-memory implementations for each rule: grade mismatch, archived and topped project, flash with prior attempts, remove flag with and without history, deletion cleanups. Contract tests for the new queries written, CI only.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- backend/src/functions/boulderSessions.ts
- backend/src/lib/repositories/ (session repositories)
- shared/lib/boulderRules.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-1
- AC-7
- AC-8
- AC-9
- AC-10
- AC-11
- AC-12
- AC-13

Dependencies:
- WP-BE-01

Expected Handoff:
- error codes and request shapes
- storage dependency interface used for blob cleanup

### WP-BE-03 — Photo storage and routes

Agent: Backend

Goal: Add `boulder-photos` functions to `backend/src/lib/storage.ts` (upload with content type and size check, delete, read SAS URL with 1 hour TTL, list by user prefix) reusing the existing client singleton and error classes; constants for the size limit and content types in one location (PO-J). Add routes in a new `backend/src/functions/boulderProjects.ts` (imported in `index.ts`): `POST` and `DELETE` photo, `GET /boulder/projects`, `GET /boulder/projects/{id}`, `POST /boulder/projects/{id}/archive` per epic Section 7. Entry and project DTOs carry `photoUrl`. Tests with the storage module mocked (`vi.mock('../lib/storage')`): ownership (`404`), type (`415`), size (`413`), replacement deletes the old blob, project list filters and aggregates, archive idempotent, DTOs contain no `blobName`, no free text in logs.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/lib/storage.ts
- backend/src/functions/recipes.ts
- backend/src/index.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-3
- AC-4
- AC-6
- AC-9
- AC-14
- AC-15
- AC-17

Dependencies:
- WP-BE-02

Expected Handoff:
- request and response shapes and error codes
- privacy report: data stored, SAS usage, retention behaviour

### WP-BE-04 — Account deletion for photos

Agent: Backend

Goal: Extend `profileDeletion.ts` and its dependencies with listing and deleting `boulder-photos` blobs by user prefix before the container documents are removed; keep the staged error handling and locking behaviour. Update `profileDeletion.test.ts` (including failure and repeat paths).

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/profileDeletion.ts
- backend/src/lib/profileDeletion.test.ts
- backend/src/lib/storage.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-17

Dependencies:
- WP-BE-03

Expected Handoff:
- new deletion stage name

### WP-BE-05 — Documentation

Agent: Backend

Goal: Update `docs/kb/tech/09-api-reference.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/04-shared-library.md`, `docs/kb/domain/10-training-bouldering.md` (project and photo rules, derived values, heuristics marked as proposed), `docs/kb/tech/07-infrastructure.md` (blob container use).

Required Knowledge Base:
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- WP-BE-01 to WP-BE-04 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-18

Dependencies:
- WP-BE-04

Expected Handoff:
- changed KB files

## 8. Frontend Work Packages

### WP-FE-01 — API client, store and rules

Agent: Frontend

Goal: Extend `boulderApi.ts` and the store with project and photo operations: entry with `projectId`, archive, project list and detail, photo upload and delete (photo operation queued behind the entry create), error mapping for `project_has_history`, `project_archived`, `project_not_open`, `project_grade_mismatch`. Add `shouldSuggestProject` with tests. Photo downscaling helper (long edge 1600 px, JPEG) using existing image utilities (`cropImageToFrame` family) without a new dependency. Store tests: photo before entry commit is sent afterwards, failed photo retry, project flag on a new entry, unflag conflict.

Required Knowledge Base:
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/shared/api/boulderApi.ts
- mobile/src/modules/training/ (store)
- mobile/src/shared/camera/
- WP-BE-05 handoff

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-2
- AC-3
- AC-5
- AC-11

Dependencies:
- WP-BE-05

Expected Handoff:
- store API additions
- privacy report: what leaves the device, what stays

### WP-FE-02 — Capture screen: star, camera, suggestion, project sheet

Agent: Frontend

Goal: Extend the capture screen and detail sheet: star toggle, camera icon opening the framed capture, photo thumbnail with replace and delete, suggestion chip (attempts of 3 or more) and snackbar action after `Offen` with 3 or more attempts, row `Projekte (n)` and `ProjectsSheet` (S5) listing open projects of the session gym with cover photo, the continue flow (grade and zone locked from the project, info line `Bisher … Versuche · <Fortschritt>`, prior attempts passed for the flash rule), remove-flag flow with the `Archivieren` offer on `project_has_history` through a `ConfirmSheet`. Tests: tap counts for continuing (3 or 4 taps), no flash for continued projects, suggestion rules, photo queue behaviour, archived and topped errors.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/modules/training/session/
- mobile/src/shared/camera/FramedCameraCapture.tsx
- WP-FE-01 handoff

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8
- AC-10
- AC-11

Dependencies:
- WP-FE-01

Expected Handoff:
- component contracts and changed routes

### WP-FE-03 — Project overview, detail, hub

Agent: Frontend

Goal: Implement `ProjectsScreen` (S10: segmented `Offen`, `Geschafft`, `Archiv`, grouped by gym), `ProjectDetailScreen` (S11: cover photo, totals, progress, history per session, `Archivieren` with `ConfirmSheet`, photo viewing), and the hub row `Offene Projekte` with up to three thumbnails. Loading, empty and error states. Tests for the grouping, segments, archive flow, empty states.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/training/hub/
- mobile/src/modules/nutrition/ (segment component from US-01)
- WP-FE-02 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-9
- AC-14
- AC-15
- AC-16

Dependencies:
- WP-FE-02

Expected Handoff:
- routes and params

### WP-FE-04 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/02-navigation.md`, `docs/kb/product/05-ux-patterns.md`, `docs/kb/product/03-design-system.md` and `docs/kb/tech/03-mobile.md` (projects, photos, queue behaviour).

Required Knowledge Base:
- docs/kb/product/02-navigation.md

Required Repository Context:
- WP-FE-01 to WP-FE-03 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-18

Dependencies:
- WP-FE-03

Expected Handoff:
- changed KB files

### WP-FE-05 — Privacy policy update (stage 2)

Agent: Frontend

Goal: Apply stage 2 of the approved wording from the epic plan Section 11 to `docs/legal/datenschutzerklaerung-alpha.md` (PO-K approved 2026-11-16): replace the stage 1 bullet and sentence (set by US-03) and change the storage bullet to mention Boulderfotos. Update the `Stand:` date and change nothing else in the file.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- docs/legal/datenschutzerklaerung-alpha.md
- docs/User Stories/Training/Bouldern/PLAN_EPIC_Training_Bouldern.md (Section 11)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-18

Dependencies:
- WP-FE-04

Expected Handoff:
- policy diff limited to the three approved sections

## 9. QA Work Package

### WP-QA-01 — Review (final epic review)

Agent: QA

Goal: Verify all acceptance criteria of this story and run the epic-level checks: click budgets (2, 3, and 3 to 4 taps) by test, privacy consistency between policy and actual data handling (data stored, photo privacy, deletion), persistence rules, deletion completeness including blobs. If the policy text deviates from the epic Section 11 stages, QA records an open `Blocking` finding. Contract tests are checked as written and passing in CI only. Manual validation stays open and is listed: camera permission and capture on a device, upload on a mobile connection, photo display, 320 and 360 dp, font scale 1.3, tab bar, Android Back across the whole Training flow.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- backend/src/functions/boulderProjects.ts
- backend/src/functions/boulderSessions.ts
- backend/src/lib/profileDeletion.ts
- backend/src/lib/storage.ts
- mobile/src/modules/training/
- docs/legal/datenschutzerklaerung-alpha.md
- all handoffs of this plan

Required Skills:
- cosmos-data-model-and-migration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-18

Dependencies:
- WP-FE-05

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 10. Test Strategy

Shared rule tests, backend handler tests with in-memory repositories and a mocked storage module, contract tests written (CI only), mobile store, component and flow tests; commands per epic Section 13; `smoke:bundle` for the mobile changes.

## 11. Acceptance Criteria

1. Pressing the star on the current card and then `Offen` or `Geschafft` stores the entry with a `projectId`; the backend creates a `BoulderProject` with the entry's gym, grade snapshot and zone; `GET /boulder/projects?status=open` returns it with `attemptsTotal` equal to the entry's attempts and `sessionsCount` 1.
2. `shouldSuggestProject(attempts, result)` is true exactly for `open` with 3 or more attempts; after `Offen` with 3 attempts the snackbar offers `Als Projekt merken`; with 2 attempts and after `Geschafft` it does not.
3. `POST .../entries/{entryId}/photo` with a valid JPEG returns `201` with `photoUrl`; a second upload replaces the first and the first blob is deleted; `DELETE` returns `204` and the entry has no `photoUrl`.
4. A photo over 8 MB returns `413`, a content type other than `image/jpeg` or `image/png` returns `415`, a foreign entry returns `404`; the app shows a matching message.
5. A photo taken before its entry is saved is uploaded only after the entry create succeeded (asserted by call order in the store test); a failed upload shows `Foto nicht gespeichert · Erneut senden`.
6. `Projekte (n)` lists only open projects of the session's gym, newest edit first, each with cover photo, grade chip, zone, attempts total and sessions count; `n` equals the number of open projects.
7. Selecting a project sets the card grade and zone, shows `Bisher <n> Versuche`, and an entry saved with `Geschafft` is stored with the project's `projectId`; the entry upsert with a different `levelId` returns `422 project_grade_mismatch`.
8. A project with earlier attempts and a new entry with 1 attempt and `Geschafft` is stored as `topped`; a new project with 1 attempt and `Geschafft` is stored as `flash`; `normalizeEntryResult` receives the sum of attempts of all other entries of the project.
9. After a topping entry the project is returned under `status=topped`, is absent from `status=open`, and its entries remain.
10. A new entry for an archived project returns `422 project_archived`; for a topped project `422 project_not_open`; the app does not offer these projects for continuing.
11. Setting `projectId` to `null` on an entry whose project has entries only in the same session unflags all those entries and deletes the project; with entries in an earlier session the response is `409 project_has_history`, nothing changes, and the app offers `Archivieren` through a `ConfirmSheet`.
12. Deleting the topping entry or setting it to `open` returns the project to `open` and `attemptsTotal`, `sessionsCount` and `toppedAt` equal the aggregate of the remaining entries (`aggregateProject` tests including the empty case).
13. Deleting an entry or a session deletes its photo blobs and removes projects without remaining entries; projects with entries in other sessions remain and their aggregates update.
14. `ProjectsScreen` shows the segments `Offen`, `Geschafft`, `Archiv` grouped by gym; `ProjectDetailScreen` shows cover photo, attempts total, sessions count, latest progress and the history per session; empty and error states exist.
15. `POST /boulder/projects/{id}/archive` returns `200` and is idempotent; the app asks for confirmation first; the archived project appears under `Archiv` and not under `Offen` or in the session's project list.
16. The hub shows `Offene Projekte` with at most three cover thumbnails and the open count.
17. Every project and photo route returns `404` for another user's IDs; no response contains `blobName`; account deletion removes all `boulderProject` documents and all blobs under `{userId}/` in `boulder-photos`, and a repeated deletion succeeds.
18. The Knowledge Base documents the project and photo rules; the policy text contains exactly the three stage 2 changes of the epic Section 11 and a new `Stand:` date and no other changes.

## 12. Risks and Edge Cases

- **Photos can show people:** the policy states privacy of photos; no automated checks.
- **Upload on a weak connection:** the framed capture plus downscaling keeps files small; failures are retryable; unsent photos are lost when the app is killed (PO-2).
- **Entry and project consistency on concurrent edits:** every aggregate is derived; the unflag-all rule is not atomic, so a repeated call completes it.
- **Large number of projects per gym:** the list has no paging in this story; acceptable for personal data, revisit if it grows.
- **A project grade scale change in the gym** (reorder or deactivation) does not alter project snapshots; a deactivated level still works for existing projects because the entry stores the level it already used.
- **Blob soft delete** keeps deleted photos up to seven days (existing policy statement).

## 13. Recommended Execution Order

1. WP-BE-01, 2. WP-BE-02, 3. WP-BE-03, 4. WP-BE-04, 5. WP-BE-05, 6. WP-FE-01, 7. WP-FE-02, 8. WP-FE-03, 9. WP-FE-04, 10. WP-FE-05, 11. WP-QA-01. Sequential. Precondition: US-03 and US-06 are complete.
