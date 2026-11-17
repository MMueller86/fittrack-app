# Plan: Epic Training / Bouldern — Architektur, Verträge und Reihenfolge

Status: Draft for Product Owner review. Basis for the seven story plans `PLAN_US-01` to `PLAN_US-07` in this directory.  
Infrastructure Impact: Alpha  
Mobile Build Impact: Potential Native Impact (only US-03: screen keep-awake uses `expo-keep-awake`, a dependency of `expo` 58 (`~58.0.4`, latest 58.0.4 on 2026-11-16); if it is already part of the installed Dev Build the impact is None. All other stories: None)

Product concept (approved 2026-11-16): [KONZEPT_01_Produktkonzept.md](KONZEPT_01_Produktkonzept.md), [KONZEPT_02_Klickfolgen.md](KONZEPT_02_Klickfolgen.md), [KONZEPT_03_Screens.md](KONZEPT_03_Screens.md). Original vision: [EPIC_Training_Bouldern.md](../../startpage/EPIC_Training_Bouldern.md).

**Change 2026-11-16:** Gyms are personal, not a shared catalog. Every user creates their own gyms; nobody else sees them. This removes the shared catalog, the creator-only edit rule, abuse caps, moderation and the public-data privacy change. A shared catalog remains a possible later extension (`[Planned]`).

This file is the single source for the shared technical contract (data model, API, shared rules, infrastructure, privacy). The story plans reference it and contain only their own work packages. Agents read the sections named in their work package, not the whole file.

## Open Product Owner Decisions

| ID | Decision needed | Planner recommendation | Blocks |
|---|---|---|---|
| PO-J | Photo limits: maximum size and number per boulder. | Same 8 MB limit as recipe images (existing `RECIPE_IMAGE_MAX_BYTES`), one photo per entry, JPEG or PNG, downscaled by the existing framed camera before upload. | US-07 |
| PO-M | Permission rationale text in `app.config.js` (`cameraPermission`) names "Barcode-Scanner, KI-Analyse und Rezeptfotos". Add "Boulderfotos"? | Leave unchanged. On Android the string is not shown; a change touches `app.config.js` and would turn `Mobile Build Impact` into `Potential Native Impact`. | none (assumption stated) |

Decided: PO-A to PO-H (concept), PO-I withdrawn (no shared catalog, no cap needed), PO-K approved 2026-11-16 (policy edit with the wording in Section 11, applied in two stages by US-03 and US-07), PO-L (quick start card only on a Bouldern training day without a session, see US-04).

## 1. Requirement Assessment

**Accept as proposed** with the modifications agreed in the concept (5 tabs, personal gyms, bulk attempt entry, 2 hour forgotten-session rule). The concept replaces the epic's per-attempt flow with a count-based flow; both produce the same stored result.

Health and domain check: Sessions contain no health values and trigger no calorie calculation. The only link to nutrition is an explicit, user-confirmed day type change through the existing endpoint `PUT /api/diary/{date}/day-type`. No new domain rule about calories is introduced.

AI necessity: none. All logic is deterministic.

## 2. Current Behaviour (confirmed from repository)

- `RootNavigator` has five tabs: `Home`, `Nutrition`, `Recipes`, `Weight` (label `Progress`), `Profile`. Recipes have their own stack (`RecipeList`, `RecipeDetail`, `RecipeWizard`) and nothing else navigates to the route `Recipes` (search in `mobile/src`).
- `WorkoutType` already contains `'bouldering'` (`shared/types/diary.ts`); `homeTrainingPresentation.ts` already maps it to `Bouldern / Klettern`. `PUT /api/diary/{date}/day-type` accepts `dayType` and `workoutType` (`backend/src/functions/diary.ts`); mobile uses `profileApi.setDayType` and `useDayTypeStore`.
- Azure Blob Storage exists (containers `recipe-images`, `product-images`, `label-scans`), accessed only by the backend with read SAS links (1 hour). `profileDeletion.ts` deletes user blobs and the `USER_DATA_CONTAINERS` documents.
- `FramedCameraCapture`, `FramedPhotoPicker` and `FramedImageEditor` exist in `mobile/src/shared/camera/`; `expo-camera` is configured.
- 12 Cosmos containers exist (`backend/src/lib/cosmos.ts`). Deployed Function Apps only build container references; Bicep creates the containers.
- No training, session or gym concept exists.

## 3. Navigation Decision

Tabs after the change: `Home`, `Nutrition`, `Training`, `Weight` (label `Progress`), `Profile` (PO-A approved). Recipes move into the Nutrition stack with a segment `Tagebuch | Rezepte`; the last used segment is remembered. Details in US-01.

## 4. Persistence Impact

Persistence Impact: one new Cosmos container and one new blob container, no change to existing documents. Class 0 (no migration). Dev and Alpha have separate Cosmos accounts; Bicep is applied to Dev first, then Alpha, before the backend that uses the container is deployed (skill `cosmos-data-model-and-migration`, Sections 6 and 7).

### 4.1 Container `trainingSessions` (all training data, user-owned)

- Partition key `/userId`. Justification: user-owned training data in its own repository domain with an independent lifecycle. It does not go into `nutritionDiaryMeals`, because diary reads must exclude foreign document types there. Gyms are personal and share the owner partition, so a separate gym container is not justified.
- Document types by `_docType`: `boulderGym`, `boulderSession`, `boulderEntry`, `boulderProject`.
- Container spec for the Infrastructure agent:

```
containerName: trainingSessions
partitionKey: /userId
indexPolicyNote: default
```

- Must be added to `USER_DATA_CONTAINERS` in `backend/src/lib/repositories/profileDeletionRepository.ts` (US-03). Gyms are deleted with the account by the same mechanism; no anonymization step exists.

### 4.2 Blob container `boulder-photos`

Private container in the existing storage account, defined in `infra/modules/storage.bicep` next to `recipe-images`. Blob path `{userId}/{entryId}/{photoId}.{jpg|png}`. Access only through the backend (read SAS, 1 hour TTL, same pattern as `generateRecipeImageSasUrl`).

### 4.3 Deploy sequence

Infrastructure first, backend second. Both resources are created in one Infrastructure work package in US-02 so that later stories need no infrastructure step. Backend code adds the container to `CONTAINER_DEFS` in US-02 (first use: gyms).

## 5. Data Model (shared types `shared/types/boulder.ts`)

API values are English identifiers; labels are German in the app.

```ts
export type BoulderScaleType = 'colors' | 'numbers';

export type BoulderColorKey =
  | 'white' | 'yellow' | 'orange' | 'green' | 'turquoise' | 'blue'
  | 'purple' | 'pink' | 'red' | 'brown' | 'grey' | 'black';

export interface BoulderGradeLevel {
  id: string;            // stable UUID, never reused
  rank: number;          // 1 = easiest, contiguous order of active and inactive levels
  label: string;         // color name, custom label, or the number as text
  colorKey?: BoulderColorKey; // only for scaleType 'colors'
  active: boolean;       // false = deactivated, hidden for new entries
}

export interface BoulderGym {
  id: string;
  userId: string;
  _docType: 'boulderGym';
  name: string;
  city: string;
  scaleType: BoulderScaleType;   // immutable after creation
  levels: BoulderGradeLevel[];
  createdAt: string;
  updatedAt: string;
  version: number;               // incremented on every change
}

export interface BoulderGradeSnapshot {
  levelId: string;
  rank: number;
  label: string;
  colorKey?: BoulderColorKey;
  scaleType: BoulderScaleType;
}

export type BoulderResult = 'open' | 'topped' | 'flash';
export type BoulderProgress = 'start' | 'half' | 'almost' | 'top_uncontrolled';

export interface BoulderSession {
  id: string;                    // client-generated UUID v4 (idempotent create)
  userId: string;
  _docType: 'boulderSession';
  gymId: string;
  gymName: string;               // snapshot
  gymCity: string;               // snapshot
  localDate: string;             // YYYY-MM-DD
  startedAt: string | null;      // ISO UTC; null for backfill without time
  endedAt: string | null;        // null while active or unknown
  status: 'active' | 'finished';
  origin: 'live' | 'backfill';
  createdAt: string;
  updatedAt: string;
}

export interface BoulderEntry {
  id: string;                    // client-generated UUID v4 (idempotent upsert)
  userId: string;
  _docType: 'boulderEntry';
  sessionId: string;
  grade: BoulderGradeSnapshot;
  attempts: number;              // total attempts including the successful one, >= 1
  result: BoulderResult;
  progress?: BoulderProgress | null; // only stored while result is 'open'
  comment?: string | null;
  zone?: string | null;
  projectId?: string | null;
  photo?: { photoId: string; blobName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoulderProject {
  id: string;                    // client-generated UUID v4
  userId: string;
  _docType: 'boulderProject';
  gymId: string;
  gymName: string;
  grade: BoulderGradeSnapshot;
  zone?: string | null;
  status: 'open' | 'archived';   // 'topped' is derived from entries, never stored
  createdAt: string;
  archivedAt?: string | null;
}
```

Derived values, never stored (single source of truth is the entry list):

- Session summary: boulder count, attempts sum, topped count (flash included), flash count, distribution by `grade.levelId`, hardest topped grade by highest `grade.rank`, duration, last activity (`max(entry.updatedAt)`).
- Project aggregate: attempts sum over its entries, number of sessions, latest progress and zone, `toppedAt`, cover photo, `lastEntryAt`. Project state `topped` = at least one entry with result `topped` or `flash`.

Limits are proposed heuristics, not confirmed rules: attempts 1 to 99, comment at most 500 characters, zone at most 60 characters, gym name 2 to 60 characters, city 0 to 60 characters (optional for personal gyms), at most 200 entries per session, at most 20 levels per gym. There is no limit on the number of gyms per user (decided 2026-11-16).

## 6. Shared Rules (`shared/lib/boulderRules.ts`, pure functions, unit tested)

One implementation, used by the backend as the authority and by the mobile client for optimistic UI.

| Function | Rule |
|---|---|
| `resolveResult({ attempts, wantsSuccess, priorProjectAttempts })` | Success with `attempts === 1` and `priorProjectAttempts === 0` gives `flash`; success otherwise `topped`; no success `open`. |
| `normalizeEntryResult(entry, priorProjectAttempts)` | `flash` with `attempts > 1` or `priorProjectAttempts > 0` becomes `topped`; `progress` is cleared when result is not `open`; `attempts` below 1 is invalid. |
| `summarizeSession(entries, session)` | Session summary as in Section 5. |
| `aggregateProject(entries)` | Project aggregate as in Section 5. |
| `isForgottenSession(lastActivityAt, now)` | True when `now - lastActivityAt >= 2 h` (PO-E). |
| `suggestEndedAt(session, entries)` | `max(entry.updatedAt)` or `startedAt` when there are no entries. |
| `resolveFinishDayAction(dayMeta)` | Mobile-only pure function in `mobile/src/modules/training/session/finishDayAction.ts` (US-05), not part of `shared`. |
| `shouldSuggestProject(attempts, result)` | Mobile-only pure function (US-07): true when `result === 'open'` and `attempts >= 3` (proposed heuristic, PO-E). |

The two mobile-only functions are specified in the story plans that use them.

## 7. API Contract

All routes require `requireUser()` and follow `withHandler`. Request bodies are validated with Zod. Errors use the existing `{ "error": "<code>" }` shape. Routes are registered in three new function modules so each story owns its file: `boulderGyms.ts` (US-02), `boulderSessions.ts` (US-03, US-06), `boulderProjects.ts` (US-07). Each must be imported in `backend/src/index.ts` (`registrations.test.ts`).

| Story | Method and route | Purpose | Notable responses |
|---|---|---|---|
| US-02 | `GET /api/boulder/gyms` | All gyms of the user, ordered by normalized name | `200 { gyms }` |
| US-03 | `GET /api/boulder/recent-gyms` | Up to 5 gyms last used by the user (derived from sessions); a literal route avoids ambiguity with `gyms/{id}` | `200 { gyms }` |
| US-02 | `GET /api/boulder/gyms/{id}` | One gym | `404 gym_not_found` |
| US-02 | `POST /api/boulder/gyms` | Create | `201 { gym }`, `409 { error: gym_duplicate, gymId }` (same normalized name and city among the user's gyms), `422` |
| US-02 | `PUT /api/boulder/gyms/{id}` | Edit | every existing level id must be present (no removal, only `active: false`); `scaleType` immutable |
| US-02 | `DELETE /api/boulder/gyms/{id}` | Delete an unused gym | `204`, `409 gym_in_use` when a session or project references it |
| US-03 | `GET /api/boulder/sessions/active` | Active session with entries | `200 { session, entries }`, `session` null when none |
| US-03 | `POST /api/boulder/sessions` | Start live session | `201`, idempotent on repeated client id, `409 session_already_active`, `404 gym_not_found` |
| US-03 | `PUT /api/boulder/sessions/{sessionId}/entries/{entryId}` | Idempotent upsert of one entry | `200 { entry }` (stored, normalized), `404`, `422` |
| US-03 | `DELETE /api/boulder/sessions/{sessionId}/entries/{entryId}` | Delete entry | `204` |
| US-03 | `POST /api/boulder/sessions/{sessionId}/finish` | Set `endedAt` (default now), status `finished` | `200 { session }`, idempotent |
| US-03 | `DELETE /api/boulder/sessions/{sessionId}` | Delete session with all entries (and photos from US-07) | `204` |
| US-06 | `GET /api/boulder/sessions?limit=&cursor=` | History, newest first, with summaries | `200 { sessions, nextCursor }` |
| US-06 | `GET /api/boulder/sessions/{sessionId}` | Detail with entries and summary | `404` |
| US-06 | `PUT /api/boulder/sessions/{sessionId}` | Correct `localDate`, `startedAt`, `endedAt` | `422 session_time_invalid` |
| US-06 | `POST /api/boulder/sessions` with `origin: 'backfill'` | Create finished session for a past date | no active-session conflict; `localDate` not in the future |
| US-07 | `GET /api/boulder/projects?gymId=&status=open\|topped\|archived` | Project list with aggregates | `200 { projects }` |
| US-07 | `GET /api/boulder/projects/{id}` | Project with entry history | `404` |
| US-07 | `POST /api/boulder/projects/{id}/archive` | Archive | `200`, idempotent |
| US-07 | `POST /api/boulder/sessions/{sessionId}/entries/{entryId}/photo` | Multipart `image` | `201 { photoUrl }`, `413`, `415` |
| US-07 | `DELETE /api/boulder/sessions/{sessionId}/entries/{entryId}/photo` | Remove photo | `204` |

Contract rules:

- Entry upsert validates: session belongs to the user; `grade.levelId` exists in the gym of the session and is active, or the entry already stored that level; `result` and `progress` are consistent (Section 6); the server overwrites inconsistent `flash` with `topped` and returns the stored entry; `projectId` rules from US-07.
- Entries of a finished session can still be edited and deleted (history corrections).
- The gym of a session cannot change after creation. A wrong gym is corrected by deleting the session.
- No user free text (comment, zone, gym name, city) is written to logs. Log only IDs, counts and error codes.
- The documented API reference `docs/kb/tech/09-api-reference.md` is updated by the Backend agent in each story.
- Responses are DTOs: they never contain `userId`, `_docType`, `sortKey`, `nameNormalized`, `cityNormalized` or `blobName`. Entry DTOs carry `photoUrl` (read SAS) instead of `photo`.
- `BoulderSession` documents carry an internal `sortKey = localDate + '#' + createdAt` from the first write (US-03). It lets the history (US-06) use a single-field `ORDER BY c.sortKey DESC` without a composite index; documents without the field would be dropped from such queries, so it must exist from the start. It is rewritten when `localDate` is corrected.

## 8. Mobile Architecture

- New module `mobile/src/modules/training/` with subfolders `hub/`, `gyms/`, `session/`, `history/`, `projects/`; API client `mobile/src/shared/api/boulderApi.ts` (same style as `diaryApi.ts`, `profileApi.ts`).
- Navigation: `TrainingStack` (hub, gym picker, gym editor, history, session detail, projects) inside the tab. The session screen hides the tab bar (US-03 decides the mechanism and verifies Android back).
- State: Zustand store `useBoulderSessionStore` for the active session, entries and pending actions, modelled on `useDayTypeStore`.
- No offline persistence (PO-2). A failed write shows `Nicht gespeichert · Erneut senden`; retries are in-memory, idempotent through the client-generated IDs. Unsent actions are lost when the app is killed; this is a documented limitation.
- Design: Dark theme tokens only, Card DNA, `ConfirmSheet`, snackbar, `SwipeableRow`, bottom sheets per `docs/kb/product/05-ux-patterns.md`. New colour tokens `colors.boulder.*` (12 keys from Section 5) go into `mobile/src/app/theme/` and `docs/kb/product/03-design-system.md`. Contrast against `surface` and a visible rim for `black` and `white` are required (concept, PO-G).
- Reuse: `FramedCameraCapture`/`FramedPhotoPicker` for photos, `SwipeableRow`, snackbar, `ConfirmSheet`, `InfoOverlay`, the existing segmented-control styling pattern (no shared component exists yet; US-01 extracts one only if more than one screen needs it, which is the case for Nutrition and the project list).

## 9. Security

- All routes `requireUser()`. Gym, session, entry, project and photo operations are scoped to `userId` through the partition key; a foreign ID yields `404`.
- Photo content type is checked server-side (`image/jpeg`, `image/png`), size limit PO-J.
- No secrets, no new keys in the app. No data of one user is visible to another user.

## 10. Infrastructure and Release

Infrastructure & Release subtask in US-02: add `trainingSessions` to `infra/modules/cosmos.bicep` and `boulder-photos` to `infra/modules/storage.bicep`; `what-if` first (Delete or Recreate is a stop condition); apply to Dev, then Alpha; verify the resources exist. Deploying the Function App and building the app are separate direct operational commands and are not planned here.

## 11. Privacy Impact

Privacy Impact: Policy update proposed

Data flow: Training gyms, sessions, entries, projects, comments, zones and photos go from the app to the FitTrack backend and are stored in Azure Cosmos DB (`trainingSessions`) and Azure Blob Storage (`boulder-photos`), both in the existing Azure resources. No third party and no AI service receives training data. All training data, gyms and photos are visible only to the owner; no other user can see them. Retention until the user deletes it or deletes the account; blob soft delete of up to seven days applies as for existing images (existing policy statement). No identifiers are added to logs.

Policy sections affected: `Welche Daten verarbeiten wir?`, `Wo und womit werden die Daten verarbeitet?`, `Speicherdauer und Löschen`. Not affected: `Wer sieht meine Daten?` (the sentence "Deine Daten sind privat" stays true because gyms are personal).

Proposed text (German; PO-K approved 2026-11-16; the `Stand:` date is updated with each stage). Stage 1 is applied in US-03 (WP-FE-06) when the first training data is stored; stage 2 is applied in US-07 (WP-FE-05) when photos and projects arrive. The policy never describes data the app does not yet store.

Stage 1 (US-03):

- `Welche Daten verarbeiten wir?` add: `- Training: Boulderhallen, Boulder-Sessions mit Datum, Dauer, Stufen, Versuchen und Kommentaren`
- `Speicherdauer und Löschen` add: `Bei der Kontolöschung werden auch deine Trainingsdaten gelöscht.`

Stage 2 (US-07):

- `Welche Daten verarbeiten wir?` replace the stage 1 bullet by: `- Training: Boulderhallen, Boulder-Sessions mit Datum, Dauer, Stufen, Versuchen, Kommentaren und optionalen Fotos sowie deine Boulder-Projekte`
- `Wo und womit werden die Daten verarbeitet?` change the storage bullet to: `**Speicherung:** Microsoft Azure (Azure-Dienste in Europa): Cosmos DB für deine Daten, Blob Storage für Rezept- und Boulderfotos.`
- `Speicherdauer und Löschen` replace the stage 1 sentence by: `Bei der Kontolöschung werden auch deine Trainingsdaten und Boulderfotos gelöscht.`

Open questions: legal basis stays an `Open question` for legal review; the planner does not invent one. Photos may show people; the app does not analyse photos.

## 12. Story Overview and Execution Order

Stories are executed strictly one after another. The file numbers are story names; the execution order is the first column (US-04 moved behind US-06 because the Home quick-start rule needs the history route to find sessions of today).

| Order | Story | Owner agents | Infrastructure | Core delivery |
|---|---|---|---|---|
| 1 | [US-01](US-01_Training-Navigation-und-Hub.md) | Frontend, QA | none | 5-tab navigation, Nutrition segment `Tagebuch / Rezepte`, empty Training hub |
| 2 | [US-02](US-02_Hallenkatalog-und-Skalen.md) | Infrastructure, Backend, Frontend, QA | Cosmos x1, Blob x1 | Personal gyms with scales: create, edit, delete, list |
| 3 | [US-03](US-03_Session-erfassen.md) | Backend, Frontend, QA | none | Session start, capture, correct, finish, discard, account deletion |
| 4 | [US-05](US-05_Trainingstag-Verknuepfung.md) | Frontend, QA | none | Day type chip and choice in the finish sheet |
| 5 | [US-06](US-06_Verlauf-Zusammenfassung-Nachtrag.md) | Backend, Frontend, QA | none | History, summary, correction, backfill session |
| 6 | [US-04](US-04_Home-Integration.md) | Frontend, QA | none | Home cards (continue, quick start on a Bouldern day), forgotten-session prompt |
| 7 | [US-07](US-07_Projekte-und-Fotos.md) | Backend, Frontend, QA | none | Projects across sessions, archive, photos, privacy policy |

Release note: gyms (US-02) are stored user data, so release US-02 together with US-03, whose stage 1 policy text covers them. The policy edit under `docs/legal/` happens only through the plan subtasks WP-FE-06 (US-03) and WP-FE-05 (US-07). Each story ends with its own QA work package. Final QA PASS of the epic is the QA package of US-07.

## 13. Test Strategy (epic level)

- Shared rules: unit tests in `shared` for every function in Section 6 including boundaries (attempts 1 and 2, prior attempts 0 and 1, exactly 2 hours).
- Backend: unit tests with in-memory repositories for every handler (auth, validation, ownership, idempotent retry, conflict). Contract tests (`*.contract.test.ts`) are written for each new Cosmos repository and run only in CI (Tier 2); local verification uses the in-memory repositories.
- Mobile: component and store tests for the capture flow, optimistic update and retry, plus layout tests for new cards following the existing Home layout tests.
- Documented command set (from `docs/kb/tech/08-testing.md`): `npm run typecheck --workspace=backend`, `npm run build:verify --workspace=backend`, backend and shared `npx vitest run`, mobile test and typecheck, `node scripts/check-test-parity.mjs`, `node scripts/check-encoding.mjs`, mobile smoke checks.
- Device behaviour (camera, tab-bar hiding, Android back, screen keep-awake, haptics, 320 and 360 dp layouts, font scale 1.3) is `MANUAL VALIDATION REQUIRED` and is listed per story.

## 14. Risks

- **Duplicate data across users:** users in the same gym each enter it. Accepted. A later shared catalog would need a copy or link mechanism; not planned.
- **Scale edits and history:** reordering levels changes ranks for future entries while old entries keep their snapshot rank. Summaries group by `levelId` and sort by snapshot rank; a mixed-rank display is possible after reordering. Accepted for the first release.
- **Lost taps without offline support (PO-2):** documented limitation.
- **Rapid taps and ordering:** every tap writes an independent entry document with a client ID, so there are no write conflicts on a session document; the cost is more small writes.
- **Tab bar hiding** differs between navigation setups; US-03 verifies on a device.
- **Moving Recipes into Nutrition** changes a documented navigation decision (approved as PO-A) and requires updating `docs/kb/product/02-navigation.md` in the same story.
- **Rounding of "heuristics":** limits in Section 5, the project suggestion (3 attempts), and the 2 hour rule are heuristics; only the 2 hour rule is PO-confirmed.

## 15. Documentation Updates (distributed over the stories)

`docs/kb/product/02-navigation.md` (US-01), `docs/kb/product/03-design-system.md` (US-02 colour tokens, US-03 capture components), `docs/kb/product/05-ux-patterns.md` (US-03), `docs/kb/domain/10-training-bouldering.md` new (US-02, extended in later stories), `docs/kb/tech/09-api-reference.md` (each backend story), `docs/kb/tech/02-backend.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/tech/04-shared-library.md`, `docs/kb/tech/07-infrastructure.md` (US-02), `docs/kb/README.md` index (US-02). The planner does not edit these files; each story plan assigns them to Backend or Frontend before the QA work package.
