# Plan: Reduce the Requests at App Start

Status: Draft — Product Owner decisions PO-1 and PO-2 are made; ready for approval
Infrastructure Impact: None
Mobile Build Impact: None

Follows from the first real cold-start episode on Alpha (2026-11-17), measured with the client telemetry of [PLAN_Client-Telemetrie-Backend-Relay.md](PLAN_Client-Telemetrie-Backend-Relay.md). That plan stays unchanged; Section 8 lists which of its statements this plan supersedes.

## Decisions Made by the Product Owner

| ID | Decision | Consequence in this plan |
|---|---|---|
| PO-1 | Originally: follow the Planner recommendation for point 3 (profile request first, the other Home calls after it, no `/health` warm-up). **Amended 2026-11-17:** the Product Owner withdraws the sequencing because it would slow a warm start for an unproven gain and wants only architecturally sound changes. Remaining: the `/health` warm-up is removed. | WP-FE-02. The Planner reads "streichen" as: no `/health` call at all at start or after login. The Home requests stay parallel as today. |
| PO-2 | Also include (1) an earlier flush of the cold-start telemetry and (2) a retry for a GET that fails with a network error and no response. | WP-FE-03 (retry) and WP-FE-04 (early flush). The Planner keeps both minimal: one retry, and one extra flush right after `ready`. |

## Open Product Owner Decisions

None for this plan. The Always Ready decision (cost) stays open and is **not** part of this plan; AC-13 delivers the data for it.

## 1. Requirement Assessment

**Accept with modifications.** The Product Owner's suspicion is confirmed by the code: of the six requests fired at start, one is redundant, one is useless as a warm-up and one is not needed for the first screen. The plan removes or defers them. No request is sequenced behind another: a leading request would add about 0.1 to 0.3 s to a warm start, and its benefit in a cold start rests on an assumption that the Alpha data does not support (concurrent requests are spread over several instances even when warm).

What this plan does **not** do: it does not remove the roughly 8 s platform cold start, and it does not stop the fan-out to several instances. It removes load and a failure mode and makes the measurement complete. The lever that removes the cold start, Always Ready 1, is a cost decision and is out of scope.

## 2. Feature Summary

At app start the app currently sends `GET /health`, two times `GET /profile/me`, `GET /diary/day/{date}`, `GET /weights` and `GET /ai/weekly-insight` within about 0.1 s. After this plan it sends `GET /profile/me` once, then `diary` and `weights` in parallel with it as today, and `weekly-insight` only after Home has shown its data. Two further changes come from the observations of 2026-11-17 (Section 3): a GET that fails with a network error and no response is retried once, and the telemetry of a cold start is sent right after `ready` instead of waiting for 30 events, 60 s or the move to the background.

## 3. Current Behaviour

Confirmed from the repository and from Alpha (2026-11-17, one cold-start episode, joined through `client_request_id`):

| Request | Origin | Needed for the first Home render? |
|---|---|---|
| `GET /health` | `useAuthStore.initialize()` and `login()`, fire-and-forget, source `warmup` | No. It starts together with the data calls and warms nothing. |
| `GET /profile/me` (1) | `RootNavigator` wizard check, after the `SKIP_WIZARD_KEY` read | No, duplicate of (2). |
| `GET /profile/me` (2) | `HomeScreen.load()` via `loadHomeData` | Yes (targets, name). |
| `GET /diary/day/{date}` | `HomeScreen.load()` | Yes. |
| `GET /weights` | `HomeScreen.load()` | Yes (trend). |
| `GET /ai/weekly-insight` | `loadWeeklyReview()` in the Home focus effect, started in parallel with `load()` | No. The card is below the first cards; the screen result and `ready` do not depend on it. It is the most expensive call (25 Cosmos calls, about 3.6 s of summed Cosmos time). |

- `loadHomeData()` receives three promises that the caller has already started, so all three run at once.
- `daily-insight` already starts only after the three data calls (inside `load()`); it is not changed.
- The Home screen event and the `ready` milestone end when the three required calls have settled (`measure.dataReady`), not when `weekly-insight` has finished.
- Measured in that episode: JS start to navigator 0.16 s; every request 9.0 to 10.2 s on the client although handler time was 0.4 to 0.8 s; `ready` at 10,452 ms; the five concurrent requests were served by five different instances; the server received them about 8 s after they were sent. Platform start is the probable cause (inference, not measured directly).
- The sync services (`healthSyncService`, `nutritionSyncService`) start from `App.tsx` after authentication and tag their calls `source: sync`. In the measured episode none occurred. They are not changed.

Further observations on Alpha, 2026-11-17 (times UTC, user local time minus one hour; client figures from `client.*` traces, server figures joined through `client_request_id` and `cloud_RoleInstance`):

| Start | Kind | Home `ready` (client) | Requests (client) | Server handler / request | Instances |
|---|---|---|---|---|---|
| 13:31:01, first episode | cold | 10,452 ms | 9.0 to 10.2 s | 0.4 to 0.8 s | 5 for 7 requests |
| 14:00:05 | warm | 1,205 ms | about 1.0 s | 0.22 to 0.38 s | 5 for 6 requests |
| 14:04:13 | cold | 9,823 ms | 9.0 to 9.8 s (the `/health` warm-up 9.0 s, like the others) | 0.29 to 0.92 s handler, requests reached the host about 7.8 s after they were sent (estimate) | 4 for 6 requests, all `worker_first_invocation = true` except one |
| 14:05:48 | warm | 674 ms | 0.37 to 0.57 s | 6 to 227 ms | 3 for 6 requests |

- The same device and network start in 0.7 to 1.2 s when the backend is warm and in about 9.8 s when it is cold. The wait before the host receives the requests is therefore very probably the platform activating instances and not the device or the network. This is still an inference: no measurement separates the two.
- A cold-start `/health` warm-up took as long as the data calls; it warmed nothing.
- Concurrent requests are spread over several instances even when warm instances exist (14:00:05 and 14:05:48).
- **Lost episode:** at 13:59 UTC a cold start ended with a red banner "Ernährungsdaten konnten nicht geladen werden" (user report, German UI text). The server has no `diary-get` for that start; the request never arrived. The client retries a GET only after 502, 503, 504 or a timeout (`mobile/src/shared/api/client.ts`), so a network error without a response is shown at once. The telemetry batch of that episode was aborted by the app being closed (`telemetry-client`, status 499, `handler.error` "aborted" at 14:00:01) and is lost. The in-memory buffer is flushed at 30 events, after 60 s in the foreground, or when the app moves to the background; a cold start that is closed within a minute loses its events.

## 4. Desired Behaviour

1. **One `profile/me` request at start.** While one `GET /profile/me` is in flight, further `profileApi.getMe()` callers receive the same result instead of sending a second request. After it settles nothing is cached.
2. **`weekly-insight` after Home data.** On focus, `loadWeeklyReview()` starts only after the Home data load has settled and Home has reported its data (`setLoading(false)`), and only if the screen is still focused. Pull-to-refresh keeps its current behaviour.
3. **Withdrawn.** The sequencing of the Home requests behind a leading request is not part of this plan (PO-1 amended). The three required calls stay parallel.
4. **No `/health` warm-up.** `useAuthStore.initialize()` (all three paths) and `login()` send no `/health` request.
5. **One retry for a network error.** A GET that fails with a network error and no response is retried once after 1.5 s, with the existing wait and attempt accounting. Other methods, other errors and the existing 502, 503, 504 and timeout retries stay as they are.
6. **Cold-start telemetry is sent right after `ready`.** When the cold-start `ready` milestone has been recorded, whatever the Home result (`data`, `empty` or `error`), one flush is started without waiting and without blocking the UI. The existing triggers (30 events, 60 s foreground, background) stay.

## 5. Scope

Mobile only: `profileApi.getMe()`, the Home focus effect, `useAuthStore`, the GET retry rule in `client.ts`, the flush trigger in the telemetry module, tests, Knowledge Base, post-release verification.

## 6. Out of Scope

- Always Ready, instance limits, Function App configuration, any backend or Bicep change. No deployment.
- A combined Home endpoint (changes the API contract; a separate plan if the data still calls for it).
- Sequencing the Home requests behind a leading request (withdrawn, PO-1 amended).
- The sync services and any change to when they start.
- Any other change to the retry policy (status codes, waits, number of retries, the 15 s timeout) and token refresh. Only the single retry for a network error without a response is in scope.
- Persisting telemetry on the device (the in-memory design is kept on purpose, see the earlier plan).
- The `jsEntryPerfMs` finding (separate fix).
- Removing the `warmup` value from the relay schema or the mobile type. It stays valid on the wire; the client simply no longer sends it (like `auth` today).
- `profileApi.updateHealthSync()`, which calls the endpoint directly and is a user action.

## 7. Confirmed Facts

- `RootNavigator` calls `profileApi.getMe()` in an effect after reading `SKIP_WIZARD_KEY`; when the key is `'1'` it sends no request. Home's focus effect mounts first (child effects run before parent effects), so Home's call starts first and the wizard check joins it while it is in flight.
- `homeDataLoader.ts` is a pure `Promise.allSettled` over three started promises; `homeDataLoader.test.ts` covers the failure case.
- `useAuthStore.test.ts` currently asserts the `/health` warm-up call.
- No test covers `RootNavigator`; `HomeScreen.insight.test.tsx` mocks `aiApi.getWeeklyInsight`.
- Alpha: Flex Consumption, Always Ready 0, maximum 5 instances; no explicit per-instance concurrency in `infra/modules/functionapp.bicep` (platform default).
- `client.ts` retries a GET at most twice, after 502, 503, 504 or an Axios timeout (`ECONNABORTED`), waiting 1.5 s and then 3 s through `addRetryWait`; the telemetry already records `attempts`, `attemptStatus` (0 = no response), `retryWaitMs` and `errorClass` `network`.
- The relay allows 10 batches per user and minute per worker; a cold start sends at most two batches in the first minute with the early flush.

## 8. Assumptions and Open Questions

- **A1 and A3: withdrawn** together with the sequencing (PO-1 amended).
- **A2:** Sharing an in-flight `getMe()` is safe because the profile is read-only for the two consumers (Home, wizard check) and the share ends when the request settles. A mutation (`createProfile`, `updateProfile`, `deleteProfile`) ends the sharing so that no caller gets a response that started before the mutation.
- **Supersedes in PLAN_Client-Telemetrie-Backend-Relay.md:** assumption A7 ("the warm-up stays") and the `warmup` expectation in AC-31. WP-BE-06 item (d) (effect of the warm-up probe) and the classification `platform_start_suspected`, which used the slow probe as one criterion, lose that input: from this change on only `worker_first_invocation` of the first request remains. The Orchestrator tells the Backend agent before WP-BE-06 starts.
- **A4 (unverified):** the failure at 13:59 UTC was an Axios network error without a response (`code` `ERR_NETWORK`). The user saw "Netzwerkfehler", but the episode was lost, so the error class is not logged. WP-FE-03 must confirm from the code which Axios error a dropped or reset connection produces in React Native and cover exactly that case; the early flush (WP-FE-04) makes the next such case visible.
- **A5:** one retry after 1.5 s is enough to reach an instance that is already running, because the other requests of the same start are answered within seconds. Whether it helps is reported by AC-21.
- **Interpretation:** PO-1 is read as "remove the warm-up". See the decision table.

## 9. Existing Components to Reuse

- `profileApi`, `useScreenMeasure`, the existing `useFocusEffect` structure, the existing retry branch in `client.ts`, the existing flush in `telemetry.ts`, the request-ID and episode telemetry for verification.

## 10. Proposed Technical Solution

**In-flight sharing in `profileApi.getMe()`.** One module-level promise variable. `getMe()` returns it if set, otherwise sends the request, stores the promise and clears the variable in a `finally` when it settles (success or failure; a failure is never reused). `createProfile`, `updateProfile` and `deleteProfile` clear the variable before sending. No time-based cache, no result cache.

**Home load.** `loadHomeData()` and the three parallel data calls stay unchanged.

**Weekly review.** In the Home focus effect, `void loadWeeklyReview()` moves behind the awaited `load()`: after `measure.dataReady(...)` and `setLoading(false)`, and only when `cancelled` is false. The `onRefresh` path keeps `void loadWeeklyReview()` where it is.

**Warm-up.** Delete the three `/health` calls and `WARMUP_CONFIG` in `useAuthStore.ts`. `ApiSource` keeps `'warmup'` (wire compatibility).

**Network-error retry.** In the existing retry branch of the response interceptor in `client.ts`, add the case "Axios error without `response` and not a timeout" (the exact condition from A4) for GET requests: one retry, delay 1.5 s, through `addRetryWait`, counted in the same `_retryCount` (so the total never exceeds the present limit of two). The user is offline: the error appears about 1.5 s later than today; accepted.

**Early flush.** The flush that exists in `telemetry.ts` is called, not awaited, right after the cold-start `ready` milestone has been recorded (the place where `markReady` is called from the Home screen event). It keeps all its guards: authenticated only, errors swallowed, no retry, no persistence, buffer rules unchanged. The 60 s timer and the 30-event trigger continue to apply.

No new dependency, no native change, no shared-package change, no new data.

## 11. Privacy Impact

Privacy Impact: None. No data is collected, derived, stored, logged or sent that is not already; fewer requests are sent and the relay schema is unchanged.

## 12. Persistence Impact

None. No Cosmos document, container or repository is touched.

## 13. Frontend Work Packages

### WP-FE-01 — One `profile/me` request at start

Agent: Frontend

Goal: Implement the in-flight sharing of `profileApi.getMe()` as specified in Section 10, with its unit tests.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/shared/api/profileApi.ts
- mobile/src/shared/api/profileApi.test.ts
- mobile/src/app/navigation/RootNavigator.tsx

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2

Dependencies:
- None

Expected Handoff:
- the sharing rule as implemented, including which methods end it
- test results

### WP-FE-02 — Weekly review after the Home data and warm-up removal

Agent: Frontend

Goal: Implement desired behaviours 2 and 4 as specified in Section 10: move `loadWeeklyReview()` behind the data load in the focus effect, remove the `/health` warm-up from `useAuthStore`, and update the tests that describe the old behaviour. `loadHomeData()` is not changed.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/product/02-navigation.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/modules/home/HomeScreen.tsx
- mobile/src/modules/home/HomeScreen.insight.test.tsx
- mobile/src/modules/auth/useAuthStore.ts
- mobile/src/modules/auth/useAuthStore.test.ts
- mobile/src/services/telemetry/screenTelemetry.ts
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-6 to AC-10

Dependencies:
- WP-FE-01

Expected Handoff:
- the order of requests at start as implemented, per source
- confirmation that the Home `screen` event and `ready` milestone still end with the three required calls, not with `weekly-insight`
- which existing tests were changed and why (old behaviour described)
- test, typecheck and `smoke:bundle` results; confirmation that no `package.json` or native file changed

### WP-FE-03 — One retry for a network error

Agent: Frontend

Goal: Implement desired behaviour 5 as specified in Section 10 with unit tests in `client.test.ts`. First confirm from the Axios code and its React Native adapter which error a connection that is dropped or reset before any response produces, state it in the handoff (A4) and cover exactly that condition in the tests.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/shared/api/client.ts
- mobile/src/shared/api/client.test.ts
- mobile/src/services/telemetry/apiTelemetry.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-15 to AC-17

Dependencies:
- WP-FE-02

Expected Handoff:
- the exact error condition retried and why
- confirmation that existing retry, 401 and quota tests pass unchanged
- test results

### WP-FE-04 — Early flush of the cold-start telemetry

Agent: Frontend

Goal: Implement desired behaviour 6 as specified in Section 10 with unit tests (mocked clock and transport): one flush right after the cold-start `ready` milestone, whatever the Home result.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/services/telemetry/telemetry.ts
- mobile/src/services/telemetry/screenTelemetry.ts
- mobile/src/services/telemetry/episode.ts
- the existing tests of these files

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-18
- AC-19

Dependencies:
- WP-FE-03

Expected Handoff:
- where the flush is started and why it cannot delay the screen
- test results

### WP-FE-05 — Mobile Knowledge Base

Agent: Frontend

Goal: Document in `docs/kb/tech/03-mobile.md` the start request sequence (what is requested at start, that `weekly-insight` follows the first data, that the same-time `getMe()` callers share one request), the single retry for a network error, and the additional flush trigger after the cold-start `ready`; mark the `warmup` source as no longer sent by the client, like `auth`. Change nothing else.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md

Required Repository Context:
- WP-FE-01 to WP-FE-04 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-11

Dependencies:
- WP-FE-04

Expected Handoff:
- the changed sections of 03-mobile.md

## 14. QA Work Package

### WP-QA-01 — Review before release

Agent: QA

Goal: Verify the acceptance criteria that can be checked without a build or live data (AC-1, AC-2, AC-6 to AC-11 and AC-15 to AC-19; AC-3 to AC-5 are withdrawn). State explicitly what is verified only on mocks. In particular, review that the sharing in `getMe()` cannot return a stale response after a mutation and that the network-error retry cannot exceed the existing limit of two retries.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/03-mobile.md

Required Repository Context:
- mobile/src/shared/api/profileApi.ts
- mobile/src/modules/home/HomeScreen.tsx
- mobile/src/modules/auth/useAuthStore.ts
- mobile/src/shared/api/client.ts
- mobile/src/services/telemetry/telemetry.ts
- all earlier handoffs of this plan

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1 to AC-11
- AC-15 to AC-19

Dependencies:
- WP-FE-05

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of items verified only on mocks

## 15. Infrastructure and Release

### WP-INFRA-01 — Post-release verification

Agent: Infrastructure

Goal: After a separately approved `New Alpha Build` (no `Deploy to Alpha`: the backend is unchanged) and normal use of the new build, run read-only aggregate queries on `appi-fittrack-alpha` and report AC-12 to AC-14, AC-20 and AC-21. This package is not an approval to build. Aggregates only; no user values. Bear in mind the CLI notes already learned: `--offset` is needed for windows longer than 1 h, `first` is a reserved word in KQL, and `traces.message` is JSON parsed with `parse_json`.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/functions/clientTelemetry.ts (event field names)
- the reference episode and its figures in Section 3 of this plan

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12 to AC-14
- AC-20
- AC-21

Dependencies:
- WP-QA-01 with PASS
- explicit user command `New Alpha Build`
- normal use of the new build until at least 5 cold-start episodes exist (the user does not run a script). If after one week fewer than 5 exist, the package reports that and the Orchestrator asks for targeted use.

Expected Handoff:
- aggregate counts and distributions per acceptance criterion
- a statement of the distribution of distinct instances per episode, cold and warm, as input for the Always Ready decision

## 16. Shared Package Changes

None.

## 17. Documentation Updates

`docs/kb/tech/03-mobile.md` only (WP-FE-05). It precedes QA so QA can verify it. The earlier plan file is not edited; Section 8 records what it supersedes.

## 18. Test Strategy

- `profileApi` unit tests with a mocked `apiClient`: concurrent callers, sequential callers, mutation in between, rejection not reused.
- `loadHomeData` stays unchanged and its existing test keeps passing.
- Home: a test that `getWeeklyInsight` is not called before the data load has settled and is called after it; not called when the screen was left first. If the screen cannot be rendered in the existing test setup, the Frontend agent extracts the sequencing into a small testable function and says so in the handoff.
- `useAuthStore` tests updated: no `/health` request on the three `initialize()` paths and on `login()`.
- `client.test.ts`: a GET with a network error and no response is retried once after 1.5 s and then succeeds or fails with the accumulated accounting; a POST with the same error is not retried; the existing 502, 503, 504, timeout, 401 and 429 tests stay unchanged.
- Telemetry tests (mocked clock and transport): the cold-start `ready` milestone triggers one flush call; a flush that never resolves, rejects or is made unauthenticated changes nothing on screen and is not retried; a resume or tab-switch episode does not trigger it.
- Gates: mobile typecheck, mobile Vitest suite, `smoke:bundle`, parity gate, encoding check. No backend change, so no backend gate.
- Real instance behaviour is `MANUAL VALIDATION REQUIRED` and checked in WP-INFRA-01.

## 19. Acceptance Criteria

Mobile (checked by QA):

1. AC-1: Two `profileApi.getMe()` calls made while the first is in flight cause exactly one `GET /profile/me` request and both resolve with the same response; a call made after the first settled sends a new request; after a rejection the next call sends a new request.
2. AC-2: A `getMe()` call made after `createProfile`, `updateProfile` or `deleteProfile` was started never receives the response of a request that began before it; the wizard check in `RootNavigator` still calls `profileApi.getMe()` and its logic is unchanged.
3. AC-3 to AC-5: **withdrawn** with the sequencing (PO-1 amended). The numbers stay unused so that references remain valid; `loadHomeData` and its test are unchanged.
6. AC-6: On focus, no `weekly-insight` request is made before the Home data load has settled; it is made once afterwards; it is not made if the screen was left before the load settled; pull-to-refresh still starts it as before.
7. AC-7: `daily-insight` still starts only after the Home data load (unchanged).
8. AC-8: `useAuthStore.initialize()` with a valid token, with a refreshed token and with a failed refresh, and `login()`, send no request to `/health`; `markAuthReady` and the `authPath` values are unchanged.
9. AC-9: The Home `screen` event, its `trigger` and the `ready` milestone are still produced; `dataReadyMs` ends with the three required calls, not with `weekly-insight`.
10. AC-10: Mobile typecheck, the mobile suite, `smoke:bundle`, the parity gate and the encoding check pass; no `package.json`, `app.config.js` or native file changed; no existing test was removed or weakened without a stated reason (the tests that describe the `/health` warm-up and the parallel start are changed and listed).
11. AC-11: `docs/kb/tech/03-mobile.md` describes the start request order, the shared `getMe()`, the single retry for a network error and the early flush trigger, marks `warmup` as not sent by the client, and changes nothing else.

Mobile, retry and early flush (checked by QA):

15. AC-15: A GET that fails with the network error condition of A4 and no response is retried exactly once after 1.5 s; if the retry succeeds the caller receives the response and the telemetry event shows `attempts = 2`, `attemptStatus` `[0, 200]` and `retryWaitMs = 1500`.
16. AC-16: A GET with the same error that fails again rejects after the second attempt, with `attempts = 2` and no third request; the total never exceeds the existing limit of two retries for any mixture of errors.
17. AC-17: A POST, PUT, PATCH or DELETE with the same error is not retried; the existing tests for 502, 503, 504, timeout, 401 and 429 pass unchanged.
18. AC-18: Recording the cold-start `ready` milestone starts exactly one flush call; the flush is not awaited by the Home screen, and a flush that rejects, never resolves or finds no authentication changes neither the screen nor the Home screen event.
19. AC-19: A cold start whose Home result is `error` also triggers the flush; a resume episode, a tab switch and a focus return do not; the 30-event, 60 s and background triggers and the buffer limit of 200 are unchanged (existing tests pass).

Alpha, after release (checked by Infrastructure):

12. AC-12: For each cold-start episode of the new build, the report states: the number of `GET /api/profile/me` events (expected 1), the number of `GET /api/health` events (expected 0), and the number of `weekly-insight` events that started before the end of the Home `screen` event (expected 0). Deviations are counted and explained.
13. AC-13: For each cold-start episode, the report gives the number of distinct `cloud_RoleInstance` values among the server events whose `client_request_id` belongs to `ui` calls of that episode that started before `ready`. Reference before the change (2026-11-17): 5 instances for 7 requests (cold), 5 for 6 (warm, 14:00:05), 4 for 6 (cold, 14:04:13), 3 for 6 (warm, 14:05:48). The figures are reported, not judged: they inform the Always Ready decision of the Product Owner and are no pass or fail criterion.
14. AC-14: The report gives p50 and p95 of `ready.atMs` and of the Home `dataReadyMs`, separately for cold episodes (first request with `worker_first_invocation = true`) and warm episodes. The references before the change (2026-11-17): cold `ready` 10,452 ms and 9,823 ms; warm `ready` 1,205 ms and 674 ms (all four on the previous build, same device). A warm p50 above 1,500 ms (proposed heuristic) is reported to the Orchestrator as a regression. With fewer than 5 episodes the numbers are marked as not reliable.
20. AC-20: For each cold-start episode of the new build, the `client.batch` that contains its `ready` milestone is written less than 10 s after the last server event of the episode's `ui` calls (proposed heuristic), and no cold-start episode of normal use is missing its `ready` milestone because of a close within the first minute. Episodes with missing milestones are counted and explained.
21. AC-21: The report lists every `client.api` event of the new build with `error_class = network` or `attempts >= 2` caused by a network error, with the outcome (recovered or failed) and the share of cold-start episodes whose Home result was `error`. If no such case occurred, the report says so; this does not fail the criterion.

## 20. Risks and Edge Cases

- **The platform cold start stays.** The plan removes load, not the roughly 8 s of instance activation; concurrent requests are still spread over several instances. The remedy is Always Ready, not this plan; AC-13 and AC-14 deliver the data for that decision.
- **Cold instance later in a session:** after a long idle time every load is cold again; same remedy.
- **Shared `getMe()` result:** two consumers get the same object. Home and the wizard check only read it; the Frontend agent confirms this in the handoff.
- **Weekly card appears later** by the length of the data load. Its loading and error states are unchanged because the card already handles `review === null`.
- **Sync services** can still compete for instances if the user has them enabled; they are tagged `sync` and show up in the data.
- **Retry on a network error** hides a short connection problem but delays the error message by about 1.5 s when the device is offline. If the real error class differs from A4 the retry does nothing; AC-21 shows that.
- **Early flush** adds one request per cold start. It runs while the screen is rendering; it uses the plain `fetch` path, is not awaited and is dropped on failure. If the user closes the app within the first second after `ready`, it can still be lost; nothing is persisted on purpose.
- **Changed tests:** the old `/health` test is replaced by its opposite; this is intended.

## 21. Recommended Execution Order

Sequential, one work package at a time:

1. WP-FE-01 one `profile/me` request.
2. WP-FE-02 weekly review after the Home data and warm-up removal.
3. WP-FE-03 one retry for a network error.
4. WP-FE-04 early flush of the cold-start telemetry.
5. WP-FE-05 Knowledge Base.
6. WP-QA-01 review.
7. User command `New Alpha Build` (JS-only change; no backend deploy needed). Not part of this plan.
8. The user uses the new build normally until at least 5 cold-start episodes exist.
9. WP-INFRA-01 post-release verification.
10. Depending on AC-13 and AC-14: the Product Owner decides about Always Ready, or a follow-up plan addresses the next largest bucket.

The open tasks of the earlier plan (WP-INFRA-02 and WP-BE-06) are not affected, except for the points in Section 8.
