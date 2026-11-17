# Plan: US-02 Eigene Boulderhallen und Schwierigkeitsskalen

Story: [US-02_Hallenkatalog-und-Skalen.md](US-02_Hallenkatalog-und-Skalen.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 4, 5, 7, 8, 9, 10, 11)  
Infrastructure Impact: Alpha  
Mobile Build Impact: None

Status: Ready for Orchestrator after Product Owner approval of the story. Gyms are personal (change of 2026-11-16); an earlier shared-catalog version of this plan no longer applies.

## Open Product Owner Decisions

None for this story. PO-I (catalog abuse cap) is withdrawn and there is no limit on the number of gyms per user. PO-K is approved; the privacy policy text is applied in US-03 and US-07 (epic Section 11). Release US-02 together with US-03.

## 1. Requirement Assessment

**Accept as proposed.** Personal gyms (PO decision 2026-11-16) remove cross-user visibility, edit rights, moderation and duplicate handling between users. Remaining design points: duplicates among the user's own gyms (normalized name plus city), historical consistency (levels are never deleted, only deactivated; later entries store a grade snapshot) and deleting a gym only while nothing references it.

Privacy: gyms are private user data in the owner's partition; no policy section about visibility changes (epic Section 11).

## 2. Current Behaviour

No gym concept exists. `getCosmos()` provides 12 containers; no container for training. Storage has no boulder container. Mobile has no Training functionality beyond the shell from US-01.

## 3. Desired Behaviour

As in the story. API contract: epic Section 7 rows tagged US-02. Entities: epic Section 5 (`BoulderGym`, `BoulderGradeLevel`), stored as `_docType: 'boulderGym'` in `trainingSessions` (partition `/userId`).

Additional rules for this story:

- Normalization used for duplicates and filtering: lower case, Unicode NFD with combining marks removed, `ß` to `ss`, every run of characters that is not a letter or digit replaced by one space, trimmed. Stored as `nameNormalized` and `cityNormalized` on the document and not exposed in the DTO. An empty city normalizes to the empty string.
- Duplicate: another gym of the same user with equal `nameNormalized` and `cityNormalized`.
- `GET /api/boulder/gyms` returns all gyms of the user (no limit) ordered by `nameNormalized`; the mobile list filters client-side by the normalized text of name and city (shared helper `normalizeBoulderText`).
- Create validation: name 2 to 60 characters, city 0 to 60, `scaleType`, at least 2 levels and at most 20. `colors`: each `colorKey` unique, `label` defaults to the German color name, custom label up to 30 characters. `numbers`: labels `"1"` to `"N"`, rank equals the number, `colorKey` absent. Levels receive server-generated UUIDs; ranks are contiguous starting at 1.
- Update rules: the body contains the full level list; every stored level ID must be present (otherwise `422 gym_level_missing`); new levels (without ID) are appended or inserted with new IDs; ranks are re-assigned contiguously from the submitted order; labels, colors and `active` may change; `scaleType` change is `422 gym_scale_type_immutable`; at least 2 active levels remain; `version` increments.
- Delete: `204` when no session and no project of the user references the gym; otherwise `409 gym_in_use`.
- Response DTO `BoulderGymDto`: all `BoulderGym` fields except `userId` and `_docType`.

## 4. Scope

Shared types (complete `shared/types/boulder.ts` from the epic Section 5), gym repository and handlers, the training container and the photo container in infrastructure, colour tokens, gym list, gym editor, documentation.

## 5. Out of Scope

Sessions and `recent-gyms` (US-03), a shared gym catalog, moderation, location-based suggestions.

## 6. Existing Components to Reuse

`weightsRepository.ts` (repository pattern with in-memory fallback), `withHandler`, `parseBody`, `requireUser`, `storage.bicep` container block pattern, mobile `diaryApi.ts` structure, theme tokens.

## 7. Backend Work Package

### WP-BE-01a — Shared types and gym helpers

Agent: Backend

Goal: Create `shared/types/boulder.ts` with the complete type set of epic Section 5 plus `BoulderGymDto` and `BoulderCreateGymRequest`/`BoulderUpdateGymRequest`; export it from `shared/index.ts`. Create `shared/lib/boulderGym.ts` with pure functions `normalizeBoulderText`, `buildDefaultLevels(scaleType, input)` and `validateLevelSet(scaleType, levels)` (rules from Section 3) and the colour key to German name map. Unit tests in `shared`.

Required Knowledge Base:
- docs/kb/tech/04-shared-library.md

Required Repository Context:
- shared/index.ts
- shared/types/diary.ts
- shared/lib/weeklyReviewCalculator.test.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-2
- AC-3
- AC-6
- AC-7

Dependencies:
- None

Expected Handoff:
- exported type and function names
- normalization examples used in tests

### WP-BE-01b — Repository and container definition

Agent: Backend

Goal: Add `{ id: 'trainingSessions', partitionKey: '/userId' }` to `CONTAINER_DEFS` in `backend/src/lib/cosmos.ts` (adjust the container-count statements in tests and in `docs/kb/tech/02-backend.md` from 12 to 13). Implement `BoulderGymRepository` (interface, in-memory, Cosmos on the `trainingSessions` container with `_docType: 'boulderGym'`) with `create`, `getById`, `list(userId)`, `findDuplicate(userId, nameNormalized, cityNormalized)`, `update` (ETag-guarded), `delete`, and `isReferenced(userId, gymId)` (true when a `boulderSession` or `boulderProject` document of the user references the gym; before US-03 no such documents exist, so it returns false). Write `cosmosBoulderGymRepository.contract.test.ts` (runs in CI only) and unit tests on the in-memory implementation. Hand the container spec to the Infrastructure agent.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/cosmos.ts
- backend/src/lib/repositories/weightsRepository.ts
- backend/src/lib/repositories/cosmosWeightsRepository.ts
- backend/src/lib/repositories/cosmosDiaryRepository.ts

Required Skills:
- cosmos-data-model-and-migration

Relevant Acceptance Criteria:
- AC-2
- AC-4
- AC-8
- AC-12

Dependencies:
- WP-BE-01a

Expected Handoff:
- container spec (name, partition key, index note)
- repository interface
- note which tests are contract-only

### WP-BE-01c — Gym handlers

Agent: Backend

Goal: Create `backend/src/functions/boulderGyms.ts` registering `GET /boulder/gyms`, `GET /boulder/gyms/{id}`, `POST /boulder/gyms`, `PUT /boulder/gyms/{id}` and `DELETE /boulder/gyms/{id}` per epic Section 7 and Section 3 of this plan. Import the module in `backend/src/index.ts`. Log only `userId`, gym ID and counts, never names or cities. Handler tests with the in-memory repository: auth (401), validation (422), duplicate among own gyms (409 with `gymId`), foreign gym ID (404 on every route), immutable scale type, missing level (422), deactivation, delete of an unused gym (204) and of a referenced gym (409 `gym_in_use`), DTO without `userId` and `_docType`.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/weights.ts
- backend/src/lib/http.ts
- backend/src/index.ts
- backend/src/lib/registrations.test.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-3
- AC-4
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10

Dependencies:
- WP-BE-01b

Expected Handoff:
- final request and response shapes with error codes
- privacy report: data stored, visibility (owner only), what is logged

### WP-BE-01d — Account deletion

Agent: Backend

Goal: Add `trainingSessions` to `USER_DATA_CONTAINERS` in `backend/src/lib/repositories/profileDeletionRepository.ts` so that the user's gyms (and later sessions, entries and projects) are removed with the account. Update the deletion tests (container list, deletion of `boulderGym` documents, repeated deletion).

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/repositories/profileDeletionRepository.ts
- backend/src/lib/repositories/profileDeletionRepository.test.ts
- backend/src/lib/profileDeletion.test.ts

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-13

Dependencies:
- WP-BE-01c

Expected Handoff:
- changed tests and the final container list

### WP-BE-02 — Documentation

Agent: Backend

Goal: Update `docs/kb/tech/09-api-reference.md` (gym routes, DTO, error codes), `docs/kb/tech/02-backend.md` (module table, container count, deletion), `docs/kb/tech/04-shared-library.md`, and create `docs/kb/domain/10-training-bouldering.md` with the gym and scale rules of this story (personal gyms, a shared catalog marked `[Planned]`); add it to `docs/kb/README.md`. Mark everything not part of this story `[Planned]`.

Required Knowledge Base:
- docs/kb/README.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- WP-BE-01a to WP-BE-01d handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-14

Dependencies:
- WP-BE-01d

Expected Handoff:
- changed KB files

## 8. Infrastructure Work Package

### WP-INFRA-01 — Container and storage

Agent: Infrastructure

Goal: Add the Cosmos container `trainingSessions` (`/userId`) to `infra/modules/cosmos.bicep` and the private blob container `boulder-photos` to `infra/modules/storage.bicep` using the existing naming and settings. Run `what-if` (Delete or Recreate is a stop condition), apply to Development, verify, apply to Alpha, verify the resources exist. Update `docs/kb/tech/07-infrastructure.md`. This subtask precedes any backend deployment that references the container. Deploying the Function App or building the app is not part of it.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- infra/modules/cosmos.bicep
- infra/modules/storage.bicep
- infra/main.bicep
- WP-BE-01b handoff (container specs)

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12

Dependencies:
- WP-BE-01b

Expected Handoff:
- what-if result
- confirmation per environment that the two resources exist
- Bicep diff summary

## 9. Frontend Work Packages

### WP-FE-01a — Tokens, API client, grade chip

Agent: Frontend

Goal: Add `colors.boulder.*` (12 keys from the epic Section 5) to the theme with sufficient contrast against `colors.surface`; `white` and `black` additionally need a visible rim. Create `mobile/src/shared/api/boulderApi.ts` with the five gym calls and types from `@fittrack/shared`. Create `GradeChip` under `mobile/src/modules/training/components/` (colour plus label or abbreviation, states normal, selected, disabled; selected is never indicated by colour alone: thick rim plus a marker; min 48 dp, 56 dp variant for later capture). Tests for the chip states and the API client.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- mobile/src/app/theme/
- mobile/src/shared/api/diaryApi.ts
- mobile/src/shared/api/client.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-11

Dependencies:
- WP-BE-02
- WP-INFRA-01 (Alpha usage only; development against mocks does not need it)

Expected Handoff:
- token names and values
- `GradeChip` props
- API function signatures

### WP-FE-01b — Gym list and gym editor

Agent: Frontend

Goal: Implement `GymPickerScreen` (mode `browse` for this story and a `select` mode callback prop reserved for US-03), reachable from the hub card `Bouldern` through a row `Hallen`, with client-side filtering by the normalized text of name and city, an empty state `Noch keine Hallen. Lege deine erste an.`, an error state with `Erneut versuchen`, and a footer button `Neue Halle anlegen`. Implement `GymEditorScreen` for create and edit: name and optional city fields, scale type segment (`Farben`, `Zahlen`, immutable in edit), colour rows with remove (create only), up and down buttons for order (48 dp), add-colour sheet listing the palette (colours already used are disabled), custom label field, preview row of `GradeChip`s, numbers stepper (2 to 20, default 7), handling of `409 gym_duplicate` (offer the existing gym) and `409 gym_in_use` (messages in an `InfoOverlay`), and `Löschen` for unused gyms with a `ConfirmSheet`. Sticky footer `Speichern` (pattern: Sticky Wizard Actions). Tests for validation, filter normalization, the duplicate and in-use responses, and delete confirmation.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/training/
- mobile/src/app/navigation/RootNavigator.tsx
- mobile/src/modules/recipes/RecipeListScreen.tsx
- WP-FE-01a handoff

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
- WP-FE-01a

Expected Handoff:
- route names and params
- the `select` mode contract for US-03
- privacy report: data sent, nothing stored on device

### WP-FE-02 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/03-design-system.md` (boulder colour tokens, `GradeChip`), `docs/kb/product/02-navigation.md` (gym routes) and `docs/kb/tech/03-mobile.md`.

Required Knowledge Base:
- docs/kb/product/03-design-system.md

Required Repository Context:
- WP-FE-01a and WP-FE-01b handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-14

Dependencies:
- WP-FE-01b

Expected Handoff:
- changed KB files

## 10. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria, the persistence change (container list, deletion of gyms with the account, no `userId` in responses) and the privacy handling (gyms private to the owner). Contract tests are verified as written and as passing in CI only; they are not run locally. Manual device checks stay open: gym editor at 320 and 360 dp with font scale 1.3, colour distinguishability, keyboard behaviour in the editor.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/boulderGyms.ts
- backend/src/lib/repositories/
- mobile/src/modules/training/
- docs/legal/datenschutzerklaerung-alpha.md
- all handoffs of this plan

Required Skills:
- cosmos-data-model-and-migration
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-14

Dependencies:
- WP-BE-02, WP-INFRA-01, WP-FE-02

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 11. Acceptance Criteria

1. The hub card `Bouldern` has a row `Hallen` that opens the gym list of the user; the list shows a filter field and, per gym, name and city; an empty list shows `Noch keine Hallen. Lege deine erste an.`.
2. The list filter matches `bruck` to a gym named `Brück Boulder` and `NORD berlin` to name or city (normalization of case, umlauts and `ß`); `GET /api/boulder/gyms` returns all gyms of the user ordered by normalized name and never a gym of another user.
3. `POST /api/boulder/gyms` returns `201` for a valid colour or number gym; names and cities are trimmed; the city may be empty; invalid inputs (missing or too short name, fewer than 2 or more than 20 levels, duplicate colour keys, number labels not equal to rank, unknown colour key) return `422` with a stable error code.
4. Creating a gym whose normalized name and city equal another gym of the same user returns `409 { error: "gym_duplicate", gymId }`; the app offers that gym and does not create a second one; a different user can create a gym with the same name and city.
5. For `colors`, each palette colour can be added at most once; the colour rows can be removed before saving and moved up and down; ranks equal the visible order; the preview shows the `GradeChip`s with label.
6. For `numbers`, the stepper accepts 2 to 20 and produces labels `1` to `N`; the default is 7.
7. `PUT /boulder/gyms/{id}` can rename, recolour, re-label, reorder, deactivate and append levels; a request that omits a stored level ID returns `422 gym_level_missing`; a `scaleType` change returns `422 gym_scale_type_immutable`; a request leaving fewer than 2 active levels returns `422`; `version` increments by 1.
8. `DELETE /boulder/gyms/{id}` returns `204` for a gym that no session or project references and `409 gym_in_use` otherwise; the app asks for confirmation first and shows a message for `gym_in_use`.
9. Every gym route returns `404` for another user's gym ID.
10. No gym response contains `userId` or `_docType`; no log line contains a gym name or city.
11. `GradeChip` shows the colour and its label or abbreviation, marks the selected state with a rim and marker in addition to colour, and every colour token meets the contrast target agreed in the handoff against `colors.surface`; no hardcoded hex value appears in components.
12. The container `trainingSessions` is in `CONTAINER_DEFS`, the Bicep templates define `trainingSessions` and `boulder-photos`, `what-if` showed no Delete or Recreate, and both resources exist in Dev and Alpha.
13. Account deletion removes all `boulderGym` documents of the user (`trainingSessions` is in `USER_DATA_CONTAINERS`); a repeated deletion succeeds.
14. The Knowledge Base documents the routes, DTO, error codes, tokens, navigation and `docs/kb/domain/10-training-bouldering.md`; everything not yet implemented (including a shared catalog) is marked `[Planned]`.

## 12. Test Strategy

- Shared: unit tests for normalization (umlauts, `ß`, punctuation, whitespace) and level validation.
- Backend: handler tests with in-memory repositories (all error codes in AC-3 to AC-10); repository unit tests; contract tests written for the Cosmos repository and run in CI only (Tier 2).
- Mobile: component and API-client tests (validation, filter, duplicate and in-use flows, chip states).
- Commands as in the epic Section 13.

## 13. Risks and Edge Cases

- Users in the same gym each enter it themselves (accepted; a shared catalog is `[Planned]`).
- Two requests creating the same own gym at the same time can both pass the duplicate check; accepted for the first release because the check is not transactional.
- Reordering levels changes the ranks used for future entries (epic Section 14).
- Display of long gym names and cities needs ellipsis rules at 320 dp and font scale 1.3.
- `isReferenced` returns false until sessions exist (US-03); a gym deleted before the first session creates no inconsistency.

## 14. Recommended Execution Order

1. WP-BE-01a, 2. WP-BE-01b, 3. WP-BE-01c, 4. WP-BE-01d, 5. WP-BE-02, 6. WP-INFRA-01 (infrastructure before any backend deployment), 7. WP-FE-01a, 8. WP-FE-01b, 9. WP-FE-02, 10. WP-QA-01. Sequential.
