# QA Report: Reduce the Requests at App Start

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Home-Start-Anfragen-reduzieren.md`
- Verdict: `PASS`

## Scope

Reviewed WP-FE-01 to WP-FE-05 (mobile only) against Section 19 of the plan, including the handoffs in `docs/handoffs/PLAN_Home-Start-Anfragen-reduzieren/` (01 to 05).

Reviewed code: `mobile/src/shared/api/profileApi.ts`, `mobile/src/shared/api/client.ts`, `mobile/src/modules/home/HomeScreen.tsx`, `mobile/src/modules/auth/useAuthStore.ts`, `mobile/src/services/telemetry/episode.ts`, `mobile/src/services/telemetry/telemetry.ts` (flush guards), `docs/kb/tech/03-mobile.md`, and the related tests.

Out of scope and confirmed untouched by this plan: `loadHomeData`, the sync services, token refresh, retry rules other than the single network-error retry, backend, Bicep, relay schema, the `warmup` value of `ApiSource` (still in `telemetry.ts`), deployment. WP-INFRA-01 was not part of this review.

Baseline limit: the working tree also holds uncommitted work of the earlier telemetry plan (`mobile/src/services/telemetry/` is untracked, and `HomeScreen.tsx`, `useAuthStore.ts`, `RootNavigator.tsx`, `03-mobile.md` also contain its changes). Changes of this plan were separated by the handoffs and by reading the code. No `git diff` baseline exists for `episode.ts` and `telemetry.ts`.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `profileApi.ts` `getMe()` returns the stored in-flight promise or sends one request. A `finally` clears the slot on success and on failure, so a rejection is not reused. `profileApi.test.ts` covers concurrent calls (one request, same result), a call after settle, and a call after a rejection. Mocked `apiClient` only. |
| AC-2 | PASS | `createProfile`, `updateProfile` and `deleteProfile` set the slot to `null` before sending. The `finally` clears the slot only if it still holds the same promise, so an old request cannot clear a newer shared one. Tests cover each mutation, including an old request that settles later. `RootNavigator.tsx` still calls `profileApi.getMe()` (line 187) and its wizard logic is unchanged. The mutation audit of the other `getMe()` callers is under "Audit: shared `getMe()` result" below. |
| AC-3 | WITHDRAWN | Leader sequencing withdrawn (PO-1 amended). `loadHomeData` still receives three started promises (`HomeScreen.tsx` lines 167 to 171). Not a failure. |
| AC-4 | WITHDRAWN | As AC-3. |
| AC-5 | WITHDRAWN | As AC-3. |
| AC-6 | PASS | `HomeScreen.tsx` focus effect: `if (!cancelled) void loadWeeklyReview();` runs after `await load()`, `measure.dataReady` and `setLoading(false)`. The cleanup sets `cancelled`. `onRefresh` still calls `void loadWeeklyReview()` first, with `load()` running in parallel. `HomeScreen.insight.test.tsx` has new tests (not called before the load settles, called once after, not called if unmounted first, pull-to-refresh unchanged). The tests render the real `HomeScreen` with mocked APIs. |
| AC-7 | PASS | `getInsight(currentDate)` is still started inside `load()` after `loadHomeData` settled. Unchanged. |
| AC-8 | PASS | `useAuthStore.ts` has no `apiClient` import and no `/health` call in `initialize()` (no token, valid, refreshed, refresh failed) or `login()`. `markAuthReady` calls and the `authPath` values (`no_token`, `valid`, `refreshed`, `refresh_failed`) are intact. `grep` over `mobile/src` finds no `/health` request. `useAuthStore.test.ts` asserts no `apiGet` on all paths. |
| AC-9 | PASS | `measure.dataReady(homeResultRef.current)` is set after the three required results and before `loadWeeklyReview()` starts, so `dataReadyMs` cannot include `weekly-insight`. `reportHomeRendered()` still runs when `loading` is false. The result is derived from diary and weights only. Home `screen` event, `trigger` and `ready` are produced (covered by `episode.test.ts`). Verified on mocks. |
| AC-10 | PASS | See Tests: typecheck, 1236 mobile tests, `smoke:bundle`, parity gate and encoding check all exit 0. No `package.json`, `app.config.js`, `app.json`, `eas.json` or native file under `mobile/` is changed (`git status` shows only `mobile/index.ts` besides `src`; it is a JS entry change from the earlier telemetry plan, not from this plan). Test changes: the `/health` assertion in `useAuthStore.test.ts` and the `warmup` source assertion in `episode.test.ts` were replaced by their opposite, as the plan intends and the handoffs list. The `profileApi.test.ts` mock setup was restructured; no test was removed. |
| AC-11 | PASS | `docs/kb/tech/03-mobile.md` has: the Retry bullet (single network-error retry, limit, GET only, `ERR_CANCELED`), the `profileApi.ts` entry (shared in-flight `getMe()`, no cache, mutations end sharing), the "Start request sequence" paragraph (no `/health`, shared `getMe()`, parallel data calls, `daily-insight`, `weekly-insight` after data and only if focused, pull-to-refresh), the Module bullet (one flush after cold-start `ready`, not awaited, no early flush on resume, tab switch or focus), and the `api` row (`auth` and `warmup` valid on the wire, no client call sends them). The statements match the code. The file diff also contains the earlier telemetry plan's sections (Client Telemetry, Request ID, Timing); they are not from this plan. The known duplicate `reusableItemsApi.ts` line is out of scope. |
| AC-12 | UNVERIFIED | Post-release check by Infrastructure on real Alpha data after `New Alpha Build` (WP-INFRA-01). See Verification Notes. |
| AC-13 | UNVERIFIED | As AC-12. |
| AC-14 | UNVERIFIED | As AC-12. |
| AC-15 | PASS | `client.ts`: `isNetworkError` is `isAxiosError && code === 'ERR_NETWORK' && response == null`; it applies to GET only, with `_retryCount === 0`, delay 1500 ms through `addRetryWait`. `client.test.ts` ("network error without response") checks the retry after 1.5 s, `attempts = 2`, `attemptStatus [0, 200]`, `retryWaitMs = 1500`. Mocked adapter only. |
| AC-16 | PASS | The network retry is allowed only at `retryCount === 0`, and the shared condition `retryCount < 2` stays. All paths: network, network gives 2 attempts; 502/503/504/timeout, network gives no further retry; network, 503, 503 gives at most 3 attempts (2 retries). The total never exceeds two retries. Covered by tests. |
| AC-17 | PASS | `isGetRequest` is required for every retry branch; tests cover POST, PUT, PATCH, DELETE and `ERR_CANCELED` without retry. The 401 and 429 branches precede the retry code and are unchanged. The existing 502, 503, 504, timeout, 401 and 429 tests passed in the full suite; the handoff states no existing client test was edited. |
| AC-18 | PASS | `episode.ts` `markReady`: `milestone('ready', ...)` returns `true` only when `ready` was newly emitted for a cold-start episode, then `flush().catch(() => {})` is called, not awaited, inside the existing try/catch. `flush()` checks `started`, `flushing`, buffer and `appInfo`, requires an access token, and drops failed batches (`telemetry.ts` lines 136 to 155). Tests in `episode.test.ts` ("early flush after ready"): one flush, never-resolving, rejecting and throwing flush change nothing on screen or in events. Verified on mocks (`flush` mocked at the episode boundary). |
| AC-19 | PASS | The flush is reached for `data`, `empty` and `error` (tests); resume, tab switch, focus return and a second Home load do not flush (tests, plus `milestone()` returns `false` outside cold start or once emitted). The constants `MAX_BUFFER = 200`, `FLUSH_AT = 30`, `FLUSH_INTERVAL_MS = 60_000` and the background flush are unchanged; the existing `telemetry.test.ts` passes. |
| AC-20 | UNVERIFIED | Post-release check by Infrastructure on real Alpha data. See Verification Notes. |
| AC-21 | UNVERIFIED | As AC-20. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `cd mobile; npx tsc --noEmit -p .` | 0 | No type errors |
| `cd mobile; npx vitest run` (JSON report) | 0 | 121 files, 1236 tests passed |
| `cd shared; npx vitest run` (JSON report for the parity gate) | 0 | 10 files, 466 tests passed |
| `cd backend; npx vitest run` (JSON report for the parity gate; no backend change) | 0 | 88 files, 2868 tests passed |
| `node scripts/check-test-parity.mjs --shared <fresh> --backend <fresh> --mobile <fresh>` | 0 | PASS shared 10/466, backend 88/2868, mobile 121/1236 |
| `node scripts/check-encoding.mjs` | 0 | Encoding check passed |
| `cd mobile; npm run smoke:bundle` | 0 | Android bundle exported, 1 non-empty bundle file |

No backend gate and no Cosmos contract test applies: there is no backend change. Cosmos contract tests: CI-only, not run locally.

## Audit: shared `getMe()` result

Callers audited by reading the code at each call site and by a repository-wide search for writes to returned `profile` or `targets` objects (property assignment, `push`, `splice`, `sort`, `Object.assign`, `delete`):

- `RootNavigator.tsx`, `HomeScreen.tsx`, `HealthConnectScreen.tsx`, `CyclingInputScreen.tsx`, `HikingInputScreen.tsx`, `DiaryScreen.tsx`, `useProfileData.ts`, `ProgressScreen.tsx`, `WeightDetailScreen.tsx` only read fields (`profile`, `targets`, `weightKg`, `targetWeightKg`, `goal`, `displayName`) or pass the object to React state or `useDayTypeStore.setTargets`. None mutates the returned object.
- The search found no mutation of `profile` or `targets` objects anywhere in `mobile/src`.
- Result: no stale data or aliasing risk. The audit is static; it does not prove the absence of a mutation in code reached through other names.

## Verification Notes

- State: `UNVERIFIED` / `MANUAL VALIDATION REQUIRED`
  - Items: AC-12, AC-13, AC-14, AC-20, AC-21 (post-release checks)
  - Reason: they need real Alpha data after a user-triggered `New Alpha Build` and normal use of the new build.
  - Manual action: WP-INFRA-01 (Infrastructure agent) runs the read-only aggregate queries on `appi-fittrack-alpha` after at least 5 cold-start episodes of the new build. Expected results are in the plan, Section 19.
- State: `UNVERIFIED`
  - Item: the real error class of the lost 13:59 UTC episode (assumption A4). The `ERR_NETWORK`, no-response condition was derived from the Axios 1.20.0 XHR adapter code by the Frontend agent, not observed on a device. If the real error differs, the retry does nothing; AC-21 will show it.
  - Manual action: after release, check the `client.api` events with `error_class = network` (AC-21).
- State: `UNVERIFIED`
  - Items: verified only on mocks: `getMe()` sharing (mocked `apiClient`), network-error retry and accounting (mocked adapter and timers), early flush (mocked `flush`, `record` and auth), Home request order (rendered `HomeScreen` with mocked APIs). Real instance behaviour, timing and the effect on cold-start duration are not verified.
  - Manual action: covered by WP-INFRA-01.
- Cosmos contract tests: CI-only, not run locally (no backend change).

## Findings

No actionable findings.
