# QA Report: US-01 Gewichtsmessungen bearbeiten und nachtragen

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md](docs/User%20Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md)
- Verdict: `FAIL`

## Scope

Independent re-review after correction attempt 2 against all nine criteria in the approved plan, covering the weight handler and repositories, Progress calendar/day editor, HistoryList edit actions, weight service, Health Connect sync, tests, and required Knowledge Base pages. `FT-QA-2026-129` is no longer current: HistoryList now exposes date/value/ordinal labels, and its regression test confirms identical same-minute measurements remain distinct and route to their original entries. `FT-QA-2026-132` remains current because the weight-domain unit guidance still contradicts the implemented lbs edit conversion. `FT-QA-2026-133` remains current; the full Backend suite now has two unrelated Daily Insight fingerprint failures. A new blocking Mobile test finding is recorded below.

Cosmos checklist: the existing `weights` container remains partitioned by `/userId`; Cosmos updates target `item(id, userId)` and patch only `/value`. No document shape, partition key, container, index, migration, Bicep, or shared-type change is present. No Mobile dependency was added. The Cosmos contract test remains in the repository but was not run because the local emulator is unavailable. No cloud writes or deployment were performed. Unrelated Daily Insight and package-manifest worktree changes were not attributed to US-01 or modified. `docs/qa/findings.md` was not edited.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `ProgressScreen` initializes `selectedDate` from `getLocalIsoDate()`. The empty-day card shows the kg input and `Speichern`; `onSave` calls `addWeight` with the explicit selected date. Covered by [ProgressScreen.tsx](mobile/src/modules/progress/ProgressScreen.tsx), [ProgressHeroCard.tsx](mobile/src/shared/components/ProgressHeroCard.tsx), and the passing explicit-date case in [weightsService.test.ts](mobile/src/services/weightsService.test.ts). |
| AC-2 | PASS | The screen filters exact-date entries and renders each day row by ID. Day-editor ordinals distinguish duplicate values; HistoryList now includes date, ordinal, value, and unit in edit labels. The isolated HistoryList regression passed and verifies both unique names and callbacks to the original entries. See [ProgressScreen.tsx](mobile/src/modules/progress/ProgressScreen.tsx), [ProgressHeroCard.tsx](mobile/src/shared/components/ProgressHeroCard.tsx), and [ProgressHeroCard.test.ts](mobile/src/shared/components/ProgressHeroCard.test.ts). |
| AC-3 | PASS | [ProgressCalendar.tsx](mobile/src/modules/progress/ProgressCalendar.tsx) disables future dates and future-month navigation; the screen independently rejects future selection callbacks and prevents a future-date POST. Calendar and date utility tests passed in the focused Mobile run: [ProgressCalendar.test.tsx](mobile/src/modules/progress/ProgressCalendar.test.tsx), [progressUtils.test.ts](mobile/src/modules/progress/progressUtils.test.ts), and [ProgressScreen.test.tsx](mobile/src/modules/progress/ProgressScreen.test.tsx). |
| AC-4 | PARTIAL | The implementation stores the selected ID, prefills the editor (including stored-lbs conversion), and calls `updateWeight(entryToUpdate.id, value)`; the service test confirms a PUT to the selected ID with `{ value }`. The screen integration test for selecting a HistoryList row currently fails before it can exercise the update because it searches for the retired date-only label; see `US01-RR-MOBILE-01`. See [ProgressScreen.tsx](mobile/src/modules/progress/ProgressScreen.tsx), [weightsService.ts](mobile/src/services/weightsService.ts), and [weightsService.test.ts](mobile/src/services/weightsService.test.ts). |
| AC-5 | PASS | Focused handler/in-memory tests passed 47/47, including metadata preservation and the same-date sibling isolation regression. The Cosmos implementation targets `(id, userId)` and patches only `/value`; the contract test is present but its runtime round-trip is separately `UNVERIFIED`. See [weights.test.ts](backend/src/functions/weights.test.ts), [weightsRepository.test.ts](backend/src/lib/repositories/weightsRepository.test.ts), [cosmosWeightsRepository.ts](backend/src/lib/repositories/cosmosWeightsRepository.ts), and [cosmosWeightsRepository.contract.test.ts](backend/src/lib/repositories/cosmosWeightsRepository.contract.test.ts). |
| AC-6 | PASS | The populated-day form stays hidden until exact edit or explicit `Weitere Messung`; explicit add uses POST with the selected date. The focused Mobile tests cover the add mode, and the in-memory repository regression confirms a same-day sibling remains fully unchanged. See [ProgressHeroCard.tsx](mobile/src/shared/components/ProgressHeroCard.tsx), [ProgressScreen.test.tsx](mobile/src/modules/progress/ProgressScreen.test.tsx), and [weightsRepository.test.ts](backend/src/lib/repositories/weightsRepository.test.ts). |
| AC-7 | PASS | `requireUser()` guards the weight handlers; PUT strictly accepts a positive value up to 1000 and returns 404 for missing/foreign ownership. Existing POST and DELETE handlers remain. Focused handler tests passed 47/47. See [weights.ts](backend/src/functions/weights.ts), [weights.test.ts](backend/src/functions/weights.test.ts), and [09-api-reference.md](docs/kb/tech/09-api-reference.md). |
| AC-8 | PARTIAL | The screen replaces only the returned matching ID, syncs that same response, and on rejected PUT retains the existing row/input while showing an error. The Health Connect unit tests passed. However, the screen-level success, lbs-update, and rejected-update tests currently fail at their old HistoryList selector before reaching those assertions; see `US01-RR-MOBILE-01`. See [ProgressScreen.tsx](mobile/src/modules/progress/ProgressScreen.tsx), [ProgressScreen.test.tsx](mobile/src/modules/progress/ProgressScreen.test.tsx), and [healthSyncService.test.ts](mobile/src/services/health/healthSyncService.test.ts). |
| AC-9 | PARTIAL | Duplicate HistoryList actions now have distinct date/value/ordinal labels and the isolated regression passes; no Mobile dependency was added, and the mobile/design documentation describes the flow. The domain page still says Progress does not convert stored measurements, contradicting the lbs editor behavior. Physical 320/360 dp and screen-reader validation remains separately `MANUAL VALIDATION REQUIRED`. See [HistoryList.tsx](mobile/src/shared/components/HistoryList.tsx), [ProgressHeroCard.test.ts](mobile/src/shared/components/ProgressHeroCard.test.ts), [05-weight-tracking.md](docs/kb/domain/05-weight-tracking.md), [03-mobile.md](docs/kb/tech/03-mobile.md), and [03-design-system.md](docs/kb/product/03-design-system.md). |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm exec --workspace=@fittrack/backend -- vitest run src/functions/weights.test.ts src/lib/repositories/weightsRepository.test.ts --reporter=dot --silent` | 0 | PASS: 2 files, 47/47 tests. |
| `npm exec --workspace=@fittrack/mobile -- vitest run src/modules/progress/ProgressScreen.test.tsx src/modules/progress/ProgressCalendar.test.tsx src/modules/progress/progressUtils.test.ts src/shared/components/ProgressHeroCard.test.ts src/services/weightsService.test.ts src/services/health/healthSyncService.test.ts --reporter=dot --silent` | 1 | FAIL: 6 files, 82/85 tests passed. Three `ProgressScreen.test.tsx` cases fail before the edit flow because they search for the old date-only HistoryList label. |
| `npm exec --workspace=@fittrack/mobile -- vitest run src/shared/components/ProgressHeroCard.test.ts --reporter=dot --silent --testNamePattern "HistoryList accessible edit actions"` | 0 | PASS: 1 HistoryList regression passed; 30 unrelated tests skipped. |
| `npm exec --workspace=@fittrack/backend -- vitest run --reporter=dot --silent` | 1 | FAIL: 71 files, 1,852/1,854 tests passed. Two unrelated Daily Insight checks fail: the fixture digest is expected `4de395fb7fe066936ffc43c5b32276e79f68230444e3ebdc638cad40a94e5bf2` but received `f1c2c22ba534fbb5c9fdd12a271205e7a594e9ae8ee9c801f82486e5a6389482`; the prompt manifest expects `sha256:5d7b16b62169d9ed741c79adaeb20eb7fe1b6727050f61099f91c672ffa1daf9` but receives `sha256:e5746fbb6d309e2b1819e7cf2d3f5cd3607403a7dca653c3214901a4fd3b1bb6`. See `FT-QA-2026-133`. |
| `npm exec --workspace=@fittrack/mobile -- vitest run --reporter=dot --silent` | 1 | FAIL: 88 files, 883/886 tests passed. The same three stale-selector failures occur in the HistoryList-driven update success, lbs update, and failed-update cases. |
| `npm run typecheck --workspace=@fittrack/backend` | 0 | PASS: no TypeScript errors. |
| `npm run typecheck --workspace=@fittrack/mobile` | 0 | PASS: no TypeScript errors. |
| `npm run build:verify --workspace=@fittrack/backend --silent` | 0 | PASS: build, module-resolution, duplicate Azure Function ID, and shared-import checks passed. |
| `cd backend && npx vitest run --config vitest.contract.config.mts` | N/A | NOT RUN: the local emulator is unavailable. No remote Cosmos account was contacted. |

## Verification Notes

## Verification Notes

- State: `UNVERIFIED`
- Reason: The local Cosmos emulator port `127.0.0.1:18081` is not listening; Docker and Podman are unavailable. The contract test was not run, and no remote Cosmos account was contacted. This runtime check is explicitly non-gating in the approved plan.
- Manual action: Prerequisite: start the local emulator using [start-cosmos-emulator.ps1](backend/scripts/start-cosmos-emulator.ps1). Then run `cd backend && npx vitest run --config vitest.contract.config.mts` against the emulator only. Expected: an update round-trips with only `value` changed, preserving ID/date/unit/createdAt; missing or foreign-partition IDs return null/404, and a same-day sibling remains unchanged. Result: NOT RUN.

- State: `MANUAL VALIDATION REQUIRED`
- Reason: No physical-device/simulator viewport or TalkBack/VoiceOver validation was available; the component tests do not substitute for device layout or assistive-technology behavior.
- Manual action: Prerequisite: launch the app on a physical device or simulator capable of 320 dp and 360 dp widths; seed multiple same-day entries including equal values recorded in the same minute. Check empty-today save, populated-day hiding/edit, explicit `Weitere Messung`, past-day backfill, future-date/month disabling, and HistoryList/day-editor actions with a screen reader. Expected: no clipping or overlap, future dates cannot be selected or saved, duplicate labels are distinguishable, and each edit updates only its intended ID. Result: NOT RUN.

## Findings
## Findings

### US01-RR-MOBILE-01: ProgressScreen tests use the retired HistoryList label

Finding key: `US01-RR-MOBILE-01`
Plan reference: [docs/User Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md](docs/User%20Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md)
Acceptance criterion: AC-4, AC-8
Description: Three ProgressScreen integration tests still look up `Eintrag vom 2026-10-12 bearbeiten`. HistoryList now exposes labels containing the ordinal, value, and unit, so the tests throw `Touchable not found` before exercising selected-ID update success, lbs round-trip, or failed-update state retention. The new isolated HistoryList test passes and confirms unique labels and exact original-entry callbacks; this finding is the stale screen-test selector, not a demonstrated runtime defect.
Criticality: Blocking
Owner: Frontend
Evidence: The focused Mobile command exits 1 with 82/85 passed, and the full Mobile suite exits 1 with 883/886 passed. The stale selector is in [ProgressScreen.test.tsx](mobile/src/modules/progress/ProgressScreen.test.tsx); current labels are in [HistoryList.tsx](mobile/src/shared/components/HistoryList.tsx); the new passing regression is in [ProgressHeroCard.test.ts](mobile/src/shared/components/ProgressHeroCard.test.ts).
Recommendation: Update the affected ProgressScreen tests to select the current accessible name or a stable test identifier, then rerun the focused and complete Mobile suites.

### FT-QA-2026-133: Unrelated Daily Insight fingerprints keep the Backend suite red

Finding key: `FT-QA-2026-133`
Plan reference: N/A
Acceptance criterion: N/A
Description: The complete Backend unit suite still exits 1 with two Daily Insight fingerprint mismatches. This is outside US-01 and is not attributed to the weight implementation. The current received fixture digest differs from the pinned r10/r11 digest, and the active prompt fingerprint differs from the manifest value.
Criticality: Blocking
Owner: Backend
Evidence: `npm exec --workspace=@fittrack/backend -- vitest run --reporter=dot --silent` exits 1 with 1,852/1,854 tests passing. Failures are in [openai.daily.test.ts](backend/src/lib/openai.daily.test.ts) and [dailyInsightPromptManifest.test.ts](backend/src/lib/prompts/dailyInsightPromptManifest.test.ts). No Daily Insight source or tests were changed during this review.
Recommendation: Reconcile the fixture and active prompt fingerprints in the owning Daily Insight work item, then rerun the complete Backend suite.

### FT-QA-2026-132: Weight-domain unit guidance is stale

Finding key: `FT-QA-2026-132`
Plan reference: [docs/User Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md](docs/User%20Stories/Progress/PLAN_US-01_Gewichtsmessungen-bearbeiten-und-nachtragen.md)
Acceptance criterion: AC-9
Description: The domain KB says Progress does not convert or rewrite stored measurements. The current editor converts stored `lbs` values to kg for editing and converts them back before PUT, preserving the stored unit. The mobile KB describes this behavior, leaving the domain guidance inconsistent with both implementation and feature documentation.
Criticality: Non-blocking
Owner: Documentation
Evidence: [05-weight-tracking.md](docs/kb/domain/05-weight-tracking.md) conflicts with [03-mobile.md](docs/kb/tech/03-mobile.md) and the conversion path in [ProgressScreen.tsx](mobile/src/modules/progress/ProgressScreen.tsx).
Recommendation: Update the domain unit section to distinguish kg-only new entries from editing existing lbs entries through the kg editor, while documenting that the stored unit and other metadata remain unchanged.
