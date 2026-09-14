# QA Report: Geräte-lokale Kalenderdaten und lokale Zeitentscheidungen

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_User-Local-Date-Timezone-Korrektur.md`
- Verdict: `PASS`

## Scope

Reviewed the approved backend, mobile, shared, test, and Knowledge Base changes against the complete plan. The review covered date-only contracts, local device date and time context, technical UTC instants, Class-0 persistence compatibility, API validation, favorites and usage-date ranking, and unchanged Daily Insight prompt/schema/quota behavior. No QA production-code edits were made.

This targeted correction re-review verified FT-QA-2026-026 / DOC-01 and FT-QA-2026-027 / DOC-02. The correction scope is limited to `docs/kb/tech/06-ai-integrations.md` and `docs/kb/domain/02-diary.md`; no production-code, test, infrastructure, or findings-register file is part of that correction. Existing implementation/test changes and the existing central findings-register entries from the preceding review remain outside this re-review and were not changed here.

## Out of Scope

- No historical date correction, backfill, or migration.
- No new Cosmos container, partition key, Bicep change, secret, or mobile native dependency.
- No global replacement of technical `toISOString()` usage.
- No change to UTC technical timestamps, UTC quota periods, AI prompts, Structured Outputs, models, quotas, or nutrition heuristics.
- No Alpha deployment; development/device execution is recorded as verification work only.

## Persistence Impact

Migration classification: **Class 0**. Existing Diary, Weight, Hint-State, Daily Insight, and User-Food-Relation documents remain readable. New date-only writes use the explicit local/request/meal date, while technical timestamps remain UTC ISO instants. No production Cosmos container, partition-key, or IaC change was found. The test emulator definition adds the already-existing `userFoodRelations` container to the contract-test setup only.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | Home and DayType use `getLocalDateContext()`/`getLocalIsoDate()`; Diary and Daily Insight clients send explicit local context. Evidence: `mobile/src/modules/home/HomeScreen.tsx`, `mobile/src/modules/home/homeDate.ts`, `mobile/src/modules/nutrition/useDayTypeStore.ts`, `mobile/src/shared/api/diaryApi.ts`, `mobile/src/shared/api/aiApi.ts`; local-date boundary tests passed under UTC-5, UTC, UTC+2, and UTC+14. |
| AC-2 | PASS | Diary initialization, previous/next navigation, Heute/Gestern labels, and date-only history grouping use local helpers and calendar arithmetic. Evidence: `mobile/src/modules/nutrition/DiaryScreen.tsx`, `mobile/src/shared/components/HistoryList.tsx`, `mobile/src/shared/date/localDate.ts`, `mobile/src/shared/date/localDate.test.ts`, `mobile/src/modules/home/homeDate.test.ts`. |
| AC-3 | PASS | Food Entry Hub, Copy Item, recipe logging, and hiking/cycling labels use local date defaults and date-only arithmetic. Evidence: `mobile/src/modules/nutrition/hub/useFoodEntryHubStore.ts`, `mobile/src/modules/nutrition/CopyItemSheet.tsx`, `mobile/src/modules/recipes/LogRecipeModal.tsx`, `mobile/src/modules/nutrition/CyclingInputScreen.tsx`, `mobile/src/modules/nutrition/HikingInputScreen.tsx`; the mobile suite passed. |
| AC-4 | PASS | Weight service defaults missing or `undefined` dates locally while preserving explicit dates; the backend requires a real date. Evidence: `mobile/src/services/weightsService.ts`, `backend/src/functions/weights.ts`, `mobile/src/services/weightsService.test.ts`, `backend/src/functions/weights.test.ts`. |
| AC-5 | PASS | Diary, Weight, Daily Insight, and ranked Favorites handlers reject missing or invalid required date/context values instead of using a UTC fallback. Evidence: `backend/src/functions/diary.ts`, `backend/src/functions/weights.ts`, `backend/src/functions/dailyInsight.ts`, `backend/src/functions/favorites.ts` and their handler tests. |
| AC-6 | PASS | Hint cooldown date state uses the explicit current local device date; nullable local hour remains unknown; generated timestamps remain UTC. Evidence: `backend/src/lib/hintEngine.ts`, `shared/types/hint.ts`, `backend/src/functions/diary.ts`, `backend/src/lib/hintEngine.test.ts`. |
| AC-7 | PASS | Daily Insight uses explicit date, validated offset, offset-aware current-day detection, local-midnight expiry/TTL, and UTC technical timestamps; the prompt release guard confirms no provider-visible prompt change. Evidence: `backend/src/functions/dailyInsight.ts`, `backend/src/lib/repositories/insightRepository.ts`, `mobile/src/shared/api/aiApi.ts`; the prompt guard passed. |
| AC-8 | PASS | Diary usage recording passes `meal.date`; in-memory and Cosmos implementations trim date-only usage windows relative to the explicit reference date, while ranked Favorites receives `localDate` and technical recency remains instant-based. Evidence: `backend/src/functions/diary.ts`, `backend/src/lib/repositories/userFoodRelationRepository.ts`, `backend/src/lib/repositories/cosmosUserFoodRelationRepository.ts`, `backend/src/lib/favoritesScoring.ts`, `mobile/src/shared/api/favoritesApi.ts`. Cosmos execution is listed as unverified below. |
| AC-9 | PASS | Technical timestamps continue to use UTC ISO instants, quota periods and explicit date-only calculations remain unchanged, and no global `toISOString()` replacement was introduced. Evidence: backend/mobile/shared typechecks, `backend` build verification, full package tests, and source review of timestamp/date-only call sites. |
| AC-10 | PASS | The implementation is Class 0: no production Cosmos container, partition key, Bicep, or historical migration changes; existing document shapes remain readable and historical values are not rewritten. Evidence: `backend/src/lib/repositories/cosmosUserFoodRelationRepository.contract.test.ts`, `backend/src/test-utils/cosmosEmulator.ts`, `infra/modules/cosmos.bicep`, `infra/main.bicep`, and worktree scope review. |
| AC-11 | PASS | Focused regression coverage exists for local date helpers, APIs, handlers, hint state, scoring, repositories, and weight behavior. Full suites passed: backend 46 files/968 tests, shared 9 files/444 tests, mobile 38 files/400 tests. Boundary helper tests passed with 13 tests each in UTC-5, UTC, UTC+2, and UTC+14; real-device UI and Cosmos execution are listed as unverified below. |
| AC-12 | PASS | Re-review confirms that `docs/kb/tech/06-ai-integrations.md` now requires a real `date` and integer `timezoneOffsetMinutes` in `[-840,840]`, documents local-day/local-midnight semantics with technical UTC instants, and keeps prompt/schema/quota unchanged. `docs/kb/domain/02-diary.md` now uses `localHour` for the request parameter. The wording matches `backend/src/functions/dailyInsight.ts`, `backend/src/lib/repositories/insightRepository.ts`, `backend/src/functions/diary.ts`, and `docs/kb/tech/09-api-reference.md`; the focused consistency scan found no stale fallback or `currentHour` request wording. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd backend; npx vitest run` | 0 | 46 test files passed, 968 tests passed. |
| `cd shared; npx vitest run` | 0 | 9 test files passed, 444 tests passed. |
| `cd mobile; npx vitest run` | 0 | 38 test files passed, 400 tests passed. |
| `cd backend; npx tsc --noEmit` | 0 | Backend typecheck passed. |
| `cd shared; npx tsc --noEmit` | 0 | Shared typecheck passed. |
| `cd mobile; npx tsc --noEmit` | 0 | Mobile typecheck passed. |
| `cd backend; npm run build:verify` | 0 | Backend build and duplicate-function/import verification passed. |
| `npm run verify:daily-insight-prompt --workspace=backend` | 0 | Offline prompt release guard passed; provider input unchanged. |
| `npm run check:encoding` | 0 | Encoding check passed. |
| `git diff --check` | 0 | No whitespace errors; Git reported only existing CRLF normalization warnings. |
| `cd backend; npx vitest run src/functions/dailyInsight.test.ts src/functions/diary.test.ts src/lib/repositories/insightRepository.test.ts` | 0 | Focused re-review: 3 test files and 148 tests passed. |
| `PowerShell Select-String consistency scan on both corrected KB files` | 0 | No stale Daily-Insight fallback or `currentHour` request matches; 10 required-contract matches found. |
| `git diff --check -- docs/kb/tech/06-ai-integrations.md docs/kb/domain/02-diary.md` | 0 | No whitespace errors in the correction files. |
| `cd mobile; $env:TZ='Etc/GMT+5'; npx vitest run src/shared/date/localDate.test.ts` | 0 | UTC-5 boundary run: 13 tests passed. |
| `cd mobile; $env:TZ='UTC'; npx vitest run src/shared/date/localDate.test.ts` | 0 | UTC boundary run: 13 tests passed. |
| `cd mobile; $env:TZ='Etc/GMT-2'; npx vitest run src/shared/date/localDate.test.ts` | 0 | UTC+2 boundary run: 13 tests passed. |
| `cd mobile; $env:TZ='Pacific/Kiritimati'; npx vitest run src/shared/date/localDate.test.ts` | 0 | UTC+14 boundary run: 13 tests passed. |
| `cd backend; npx vitest run --config vitest.contract.config.mts` | 1 | The Cosmos emulator was unreachable; 9 contract suites failed during setup and 69 tests were skipped. See Verification Notes. |

## Verification Notes

- State: `UNVERIFIED`
  Reason: The local Cosmos emulator at `http://127.0.0.1:18081` was not reachable, and no local Docker/Podman runtime was available. This is an environment limitation, not an observed product defect.
  Manual action: Start the local emulator with `cd backend; npm run emulator:start`, then rerun `cd backend; npx vitest run --config vitest.contract.config.mts`. Expected result: all Cosmos contract suites, including `cosmosUserFoodRelationRepository.contract.test.ts`, pass against the emulator only.

- State: `MANUAL VALIDATION REQUIRED`
  Reason: No `adb` executable or connected Android device/emulator was available, so visible user flows were not executed.
  Manual action: With the development app and backend available, run the matrix at local `00:30` before and after UTC midnight in UTC-5, UTC, UTC+2, and UTC+14. Check Home, Diary initial date and navigation, Tagesziel/DayType, weight logging, activity labels and logging, Copy Item, Recipe Logging, Food Entry Hub, and Daily Insight. Expected result: every user-facing calendar value uses the same device-local `YYYY-MM-DD`; technical timestamps retain a trailing `Z`; no date shifts across the local-midnight boundary.
  Result: `UNVERIFIED`

- State: `UNVERIFIED`
  Reason: No authenticated development end-to-end session was available for a real-device/API visual run. Automated package, build, API-contract, and timezone-boundary checks passed.
  Manual action: Complete the device matrix above against the development environment and retain the observed date/request/persistence results with the release evidence.

## Findings

No actionable findings.