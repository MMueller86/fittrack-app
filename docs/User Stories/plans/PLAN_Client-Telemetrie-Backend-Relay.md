# Plan: Client Telemetry via Backend Relay

Status: Draft — all Product Owner decisions PO-1 to PO-7 are made; ready for approval
Infrastructure Impact: Alpha
Mobile Build Impact: None

Replaces [PLAN_Mobile-Application-Insights-Telemetrie.md](PLAN_Mobile-Application-Insights-Telemetrie.md) (SDK in the app, rejected under PO-1). Companion to [PLAN_Azure-Functions-Cold-Start-Telemetrie.md](PLAN_Azure-Functions-Cold-Start-Telemetrie.md), which instruments the backend. This plan adds the client side so that a slow screen load can be split into client, retry, token-refresh, network, platform and server time.

## Decisions Made by the Product Owner

| ID | Decision | Consequence in this plan |
|---|---|---|
| PO-1 | No keys or connection strings in the app. | No Application Insights SDK in the mobile app. The app sends its measurements to the backend, which writes them to Application Insights (Section 10). |
| PO-2 | Daily ingestion cap approved. | Recommended value 0.1 GB per day (proposed heuristic: the highest day since 2026-10-26 was about 7.4 MB). WP-INFRA-01. |
| PO-3 | Adjust the privacy policy. | The policy is aligned to the live retention (90 days, see Section 3), not the other way round. WP-BE-04. |
| PO-4 | No toggle. Telemetry is always on. A consent step will be added later and is `[Planned]`. Collect regardless of consent now. | No setting, no opt-out, no consent check in this plan. The app has exactly one function through which every event passes (Section 10), so a later consent gate is a one-place change. The legal basis stays `Open question` (OQ1); the Planner does not supply one. |
| PO-5 | Policy edit under `docs/legal/` is approved. Adjust it where needed. | WP-BE-04 may edit the policy. |
| PO-6 | Log user IDs. Normal practice here, needed for later tracing. | Client events carry the raw `userId`, exactly like the existing backend events (Option C). One function builds the field (Section 10). The policy discloses it. |
| PO-7 | Keep logging search terms. | The events `food-products.search` and `reusableItems.search` stay unchanged. The former work package for log hygiene is cancelled. The policy discloses the search terms. |

The Planner notes for the record (no further decision needed): the user ID is a pseudonym and still personal data; search terms are free text typed by the user; both end up in logs that are not deleted per user and are kept 90 days. The policy wording in Section 12 is written for exactly that. Pseudonymisation remains a follow-up to consider before any release beyond the invited Alpha testers.

## Open Product Owner Decisions

None. Open legal questions are listed under OQ1 and OQ2 in Section 8; they do not block implementation.

## 1. Requirement Assessment

**Accept with modifications.** The goal (see why the app feels slow, including the part the server cannot see) is valid and the data is not available any other way: the backend has no access to the time spent in the app, in token refresh and in retry waits. The original proposal of an Application Insights SDK in the app was changed by PO-1. The relay keeps all secrets on the backend, matching the documented principle that the backend owns all secrets and the app only consumes APIs.

## 2. Feature Summary

The app collects small anonymous measurements in memory and posts them in batches to one authenticated backend endpoint. The backend validates them strictly and writes them as structured log events to the existing Application Insights resource. Every API request additionally carries a random request ID that the backend also logs, so a client event and the server events of the same call can be joined in one query.

## 3. Current Behaviour

Confirmed from the repository and from live Azure (2026-11-13 to 2026-11-16):

- The app sends no telemetry. No Application Insights or Sentry dependency in `mobile/package.json`. `ErrorBoundary.tsx` only calls `console.error`.
- `mobile/src/shared/api/client.ts`: one Axios instance, 15 s timeout. The request interceptor refreshes an expired access token against CIAM before sending. GET requests are retried up to twice after 502, 503, 504 or a timeout, waiting 1.5 s and 3 s. The backend sees none of that time.
- `backend/src/lib/http.ts` `withHandler()` logs `handler.start`, `handler.success`, `handler.response.failure` and `handler.error` with worker diagnostics. Pending deploy: `cosmos_init_ms`.
- No rate-limiting mechanism exists in the backend (repository search found only a provider error code in a test).
- `backend/host.json` samples Application Insights telemetry except type `Request`. Traces can therefore be sampled under load; at current Alpha volume this is expected to be rare but is not measured.
- **Existing logging of identifiers and free text (finding):** in the last 30 days `appi-fittrack-alpha` holds 52,244 trace events. 1,750 contain a `userId` (3 distinct users); 264 contain a search term (`q` or `query`). The code is in `backend/src/functions/foodProducts.ts` (`food-products.search`) and `backend/src/functions/reusableItems.ts` (`reusableItems.search`); many other events log `userId` together with IDs such as meal, recipe and item IDs. `docs/kb/tech/02-backend.md` states that the worker diagnostics contain no user ID; that is true for those fields but not for the events above.
- **Retention (finding):** the live Application Insights component and the tables `AppRequests`, `AppTraces`, `AppExceptions`, `AppDependencies`, `AppEvents` show 90 days (read 2026-11-13 and 2026-11-16). `infra/modules/appinsights.bicep` sets only the workspace to 30 days. The privacy policy and several Knowledge Base documents say 30 days. That the oldest stored data is only from 2026-10-26 means the 90 days cannot yet be observed in effect.
- The privacy policy (Stand 2026-10-23) says only "Betriebsprotokolle: Application Insights, 30 Tage" and that these logs are not deleted individually. `DELETE /api/profile` does not touch Application Insights.
- Alpha Application Insights: ingestion mode `LogAnalytics`, IP masking at the default, public ingestion, no daily cap.

## 4. Desired Behaviour

- Every API call through `apiClient` generates a client event: HTTP method, route template, the screen that was open, final status or error class, total duration from the first attempt to the final result (retry waits included), the duration and outcome of every single attempt, the retry wait time, token-refresh duration and outcome if one preceded it, and the start time of the call on the episode timeline, and `source` (`ui`, `sync`, `warmup`, `auth`).
- Every API request sends the header `x-fittrack-request-id` (random UUID); `withHandler()` logs it as `client_request_id` on its lifecycle events when it is a valid UUID.
- Screen loads of the five tabs (Home, Nutrition, Recipes, Progress, Profile) record `screen.load`: the time from the moment the user opens the screen (tab press or app start into that screen) until the screen has rendered its first data or its error or empty state. A screen that never finishes loading records nothing. The Frontend agent states in the handoff, per screen, which event ends the measurement.
- Episodes and milestones as defined in Section 4a: a cold-start episode with the six milestones, a resume episode with `backgroundMs`, `jsEntryPerfMs` on the cold start, and the device model in the app block. Every screen event carries `trigger` (`cold_start`, `resume`, `tab_switch`, `focus`), `dataReadyMs`, `renderMs` and `result` (`data`, `empty`, `error`).
- Unhandled JavaScript errors reaching `ErrorBoundary` record error name and a truncated stack, never the message.
- Events are buffered in memory (maximum 200, oldest dropped) and sent in batches, never awaited by UI code. A failed or rejected batch is dropped silently and never retried.
- The relay endpoint `POST /api/telemetry/client` requires a valid user, accepts only the strict schema in Section 10, rate-limits per user and answers `204`.
- The relay writes one `client.batch` trace and one trace per event.
- Always on. No setting, no consent check.

## 4a. The Question This Plan Must Answer

**How long does the user really wait until the app is usable, and where is the time lost?** After implementation this must be answerable from the logs alone, for three situations:

| Situation | Starts | Usable means | Wait metric |
|---|---|---|---|
| Cold start | tap on the app icon | Home shows data, an empty state or an error state | native start before JavaScript plus `ready.atMs` |
| Resume after background | app returns to the foreground | the first screen load the user triggers has finished | duration of the first `screen` event of the resume episode, with `backgroundMs` as explanation |
| Tab switch or screen open in a running app | tab press | the screen shows data, an empty state or an error state | `screen.durationMs` |

**Startup chain as it is in the code today** (confirmed from `mobile/index.ts`, `App.tsx`, `useAuthStore.ts`, `RootNavigator.tsx`, `HomeScreen.tsx`, `homeDataLoader.ts`): `index.ts` imports (gesture handler first) and calls `registerRootComponent(App)`. `App` calls `useAuthStore.initialize()`; until it finishes a spinner is shown (`isAuthenticated === null`). `initialize()` reads the access token from SecureStore; if it is expired it awaits a refresh against CIAM; then it fires `GET /health` as a warm-up (not awaited). After authentication `RootNavigator` mounts and calls `profileApi.getMe()`; the Home screen loads weights, profile and diary in parallel on focus; at the same time `healthSyncService.syncForeground()` and `nutritionSyncService.syncForeground()` start. The native splash is shown until the first React view renders. On resume from the background nothing reloads automatically (`useFocusEffect` does not fire); the next wait is the first user action.

**Episodes and milestones.** An episode starts with a cold start (origin: first module evaluation after the gesture handler import) or with a return to the foreground (origin: the `active` app state). It ends when the app moves to the background. Every event carries `episodeId` and a time in milliseconds relative to the episode origin. Cold-start milestones, each emitted once: `js_entry` (0), `app_registered` (end of the `index.ts` imports), `root_mounted`, `auth_ready` (with `authPath`: `no_token`, `valid`, `refreshed` or `refresh_failed`, and `authMs`), `navigator_mounted`, `ready` (the Home screen result is rendered). A resume episode records `backgroundMs`. The cold-start episode also records `jsEntryPerfMs`, the `performance.now()` value at JS entry, as an indicator for the time before JavaScript started (see below).

**Breakdown rule (critical path).** For a screen load, the critical call is the `ui` API call of the same episode that ended last inside the screen window. The screen duration is split without overlap into: (1) `pre_data_gap`, the time from screen start to the start of the critical call (queueing, auth, earlier calls, JS thread); (2) inside the critical call: `token_refresh`, `failed_attempts` (all attempts but the last), `retry_wait`, and the last attempt, which is split into `server_handler` (from the matching server event), within it `cosmos` and `handler_other`, and the remainder `network_platform_device`; (3) `client_after_response`, the time from the end of the critical call to the rendered result (includes rendering). The parts add up to the screen duration (AC-33). For a cold start the milestones split the time before the screen: native start, `app_registered - js_entry` (imports), `root_mounted - app_registered`, `auth_ready - root_mounted`, `navigator_mounted - auth_ready`, then the Home screen load as above.

**Remainder classification.** `network_platform_device` is labelled `platform_start_suspected` when the matching server event has `worker_first_invocation = true` or the warm-up probe of the same episode was slow (see next paragraph); `no_server_event` when no server event with the request ID exists (the attempt failed before the handler, for example 502, 503, 504, timeout); otherwise `network_or_device`. The probe threshold is a proposed heuristic to be calibrated on the first week of data, not a confirmed rule.

**Warm-up probe.** `initialize()` already sends `GET /health` at start. The handler does no work, so its client duration minus its server duration is a clean measure of network plus platform start for that episode. The client event carries `source: warmup`.

**What is measured and what maps to which action** (a bucket is only an action item when it is among the largest shares of the wait at p50 or p95):

| Bucket | Meaning | Follow-up action |
|---|---|---|
| native start before JS | process start to first JS line | device class, splash and native initialisation, bundle size; compare with the manual calibration (AC-35) |
| imports (`app_registered - js_entry`) | module evaluation at start | lazy loading of heavy modules, Metro inline requires |
| auth (`auth_ready - root_mounted`) | SecureStore read and a blocking refresh at start (`authPath`) | do not block the UI on the refresh, single refresh in flight, refresh earlier |
| `pre_data_gap` after navigator | start chain runs sequentially or competes with `sync` calls | start independent calls in parallel, defer `sync` calls until `ready` |
| `token_refresh` in a call | expired token before a normal request | proactive refresh, one refresh shared by concurrent requests |
| `failed_attempts` and `retry_wait` | retries after 502, 503, 504 or timeout | retry policy, first-attempt timeout, warm-up, Always Ready |
| `platform_start_suspected` | cold instance | Always Ready 1, earlier warm-up (the existing `/health` call is already one; its effect is reported) |
| `cosmos` | database time inside the handler | queries, indexes, partitioning; `cosmos_init_ms` verifies the `getCosmos()` fix |
| `handler_other` | server code outside Cosmos | handler code path |
| `network_or_device` | transfer and device scheduling | payload size, region, request count; connection type is not measured |
| `client_after_response` and render | JS thread and rendering | list rendering, state updates, JS thread load |

**What cannot be separated, stated once and covered as far as possible:** the time before the first JavaScript line is not visible to JavaScript. It is estimated through `jsEntryPerfMs` and calibrated once by hand (AC-35). `network_or_device` cannot be split into network and device scheduling, and the connection type (WLAN or mobile data) is not recorded because that needs a native module; if this bucket dominates, a follow-up plan decides about adding it. The matching of client and server events needs the request ID header, so old app builds without it are excluded from the breakdown.

## 5. Scope

- Backend: request-ID logging in `withHandler()`, relay endpoint with schema, rate limit and tests, per-invocation Cosmos timing (WP-BE-05), the wait-time analysis queries and report (WP-BE-06), Knowledge Base corrections, policy update. Existing search-term and user-ID logging stays as it is (PO-6, PO-7).
- Mobile: telemetry module, startup milestones, episodes, `apiClient` header and timing, screen timings, `ErrorBoundary` hook, tests, Knowledge Base.
- Infrastructure: ingestion cap, retention alignment, post-release verification.

## 6. Out of Scope

- Any telemetry SDK in the app, any key or connection string in the app, any native module.
- Consent screen, opt-out, or a consent-dependent code path (`[Planned]`, separate plan).
- Request or response content, free text, health values, tokens, query strings, concrete resource IDs, IP addresses or device identifiers in client events.
- Native crash reporting, dashboards, alerts, session replay, funnels.
- Time before the first JavaScript line as a precise measurement, and the connection type; see Section 4a for the estimate and the manual calibration.
- Fixing the causes the data will reveal (token-refresh deduplication, retry delays, parallel loading, Always Ready). Separate plans.
- Deploying or building. `Deploy to Alpha` and `New Alpha Build` are separate direct commands, each needing its own explicit request.

## 7. Confirmed Facts

- `requireUser(request)` returns `UserContext { userId, tier }` with `userId` from the JWT `sub` claim (`docs/kb/tech/05-authentication.md`).
- `backend/src/index.ts` must import every function module; `registrations.test.ts` fails otherwise (backend instructions). The functions smoke test and `scripts/release-alpha.ps1` compare against a registered-function baseline (currently 79 functions); adding an endpoint changes that baseline and the number quoted in the Knowledge Base.
- `expo-crypto ~58.0.8` is already a mobile dependency (UUIDs). `Platform.OS` and `Platform.Version` need no package.
- `apiClient` interceptors, retry rules and 401 handling are covered by `mobile/src/shared/api/client.test.ts`.
- Daily Application Insights volume since 2026-10-26: traces up to 7.0 MB per day, requests up to 0.5 MB per day (Usage table).

## 8. Assumptions and Open Questions

- **A1:** A client event of about 250 bytes and 20 to 60 events per session stays far below the cap. Verified by AC-14 after release.
- **A2:** Sampling may drop individual client traces. Mitigation: the `client.batch` trace carries `received_events`, so loss is measurable (AC-12).
- **A3:** In-process rate limiting is per worker and therefore approximate. Acceptable for Alpha; the ingestion cap is the hard backstop.
- **A4:** `expo-constants` provides the app version. If it is not a direct dependency the Frontend agent adds it with `npx expo install` and reports it. No new native module is expected.
- **A5:** `performance.now()` at JS entry may or may not be measured from process start in React Native 0.88 with Hermes. It is recorded as `jsEntryPerfMs` and its meaning is established by the manual calibration (AC-35), not assumed.
- **A6:** `Platform.constants.Model` provides the Android device model name without a new package. If it does not, the field is omitted.
- **A7:** The warm-up `GET /health` in `useAuthStore.initialize()` and `login()` stays as it is; this plan only measures it.
- **OQ1 (legal):** Legal basis for collecting device performance data and a user ID without consent, and the erasure obligation for logs that contain the user ID. Decided by the Product Owner as "collect always" (PO-4); not evaluated by the Planner.
- **OQ2:** Whether Azure purge tooling should be used for erasure requests that concern log data. Operational question for the Product Owner.

## 9. Existing Components to Reuse

- `withHandler()` and `logEvent()` for the relay and the request-ID field.
- `requireUser()`, `parseBody()` and the Zod pattern from existing handlers.
- `apiClient` and its interceptors; `authService.refreshAccessToken()` for the refresh timing.
- `expo-crypto` for UUIDs; `ErrorBoundary.tsx` for error capture.
- The KQL conventions in `docs/kb/tech/02-backend.md`.

## 10. Proposed Technical Solution

**Request ID.** `apiClient` request interceptor sets `x-fittrack-request-id` to a fresh UUID for every logical request (retries reuse the same ID). `withHandler()` reads the header; if it matches the UUID pattern it adds `client_request_id` to `handler.start`, `handler.success`, `handler.response.failure`, `handler.error`; otherwise the field is omitted. Older app builds simply send no header.

**Relay endpoint.** `POST /api/telemetry/client`, handler `telemetry.client` via `withHandler()`, file `backend/src/functions/clientTelemetry.ts`, imported in `backend/src/index.ts`.

Strict Zod schema (unknown keys rejected, body at most 32 KB, at most 100 events). Times are integers in milliseconds relative to the episode origin (Section 4a), 0..604800000:

```
{
  app: { version: string(<=20), variant: 'development' | 'preview' | 'production',
         os: 'android' | 'ios', osVersion: string(<=20),
         deviceModel?: string(<=40, ^[A-Za-z0-9 ._()+-]+$) },
  sessionId: uuid,
  events: Array<
    { type: 'episode', episodeId: uuid, trigger: 'cold_start' | 'resume',
      backgroundMs?: int (resume only), jsEntryPerfMs?: int (cold start only) }
  | { type: 'milestone', episodeId: uuid,
      name: 'js_entry' | 'app_registered' | 'root_mounted' | 'auth_ready' | 'navigator_mounted' | 'ready',
      atMs: int, authPath?: 'no_token' | 'valid' | 'refreshed' | 'refresh_failed', authMs?: int }
  | { type: 'api', episodeId: uuid, clientRequestId: uuid, route: string(<=120, pattern below),
      source: 'ui' | 'sync' | 'warmup' | 'auth',
      screen?: 'Home' | 'Nutrition' | 'Recipes' | 'Progress' | 'Profile',
      startedAtMs: int,
      status: int 0..599, errorClass?: 'timeout' | 'network' | 'http' | 'canceled',
      durationMs: int 0..600000, attempts: int 1..3,
      attemptMs: int[1..3] (each 0..600000), attemptStatus: int[1..3] (0 = no response),
      retryWaitMs: int 0..10000,
      tokenRefreshMs?: int 0..600000, tokenRefreshOk?: boolean }
  | { type: 'screen', episodeId: uuid, name: 'Home' | 'Nutrition' | 'Recipes' | 'Progress' | 'Profile',
      trigger: 'cold_start' | 'resume' | 'tab_switch' | 'focus',
      startedAtMs: int, durationMs: int, dataReadyMs: int, renderMs: int,
      result: 'data' | 'empty' | 'error' }
  | { type: 'error', episodeId: uuid, name: string(<=60, ^[A-Za-z0-9_.$ -]+$), stack: string(<=1000) }
  >
}
```

`route` pattern: `^(GET|POST|PUT|PATCH|DELETE) /api(/([a-z0-9-]+|\{id\}|\{date\}))+$`. The client builds templates itself (literal path segments kept only if they match an allowlist derived from `docs/kb/tech/09-api-reference.md`; everything else becomes `{id}`, dates become `{date}`, query strings are removed). The server validates the pattern but does not trust it for anything except logging.

Behaviour: authenticate; validate; per-user in-memory limit of 10 batches per minute per worker (excess answered `429` without a body, never logged as an error); write `client.batch` (`session_id`, `app_version`, `app_variant`, `os`, `os_version`, `device_model`, `received_events`) and one trace per event: `client.episode` (`episode_id`, `trigger`, `background_ms`, `js_entry_perf_ms`), `client.milestone` (`episode_id`, `name`, `at_ms`, `auth_path`, `auth_ms`), `client.api` (`episode_id`, `client_request_id`, `route`, `source`, `screen`, `started_at_ms`, `status`, `error_class`, `client_ms`, `attempts`, `attempt_ms`, `attempt_status`, `retry_wait_ms`, `token_refresh_ms`, `token_refresh_ok`), `client.screen` (`episode_id`, `name`, `trigger`, `started_at_ms`, `client_ms`, `data_ready_ms`, `render_ms`, `result`), `client.error` (`episode_id`, `name`, `stack`). Respond `204`. Every event trace carries `userId` (PO-6), added through one small function `clientEventActorFields(userId)` so the field has a single place of definition.

The telemetry call itself is not instrumented and not retried, so it cannot recurse or amplify.

**Mobile module** `mobile/src/services/telemetry/`:

- `startMark.ts`: imported as the second import of `mobile/index.ts` (right after the gesture handler import, which must stay first); records the episode origin and `performance.now()` at JS entry. Everything else is created lazily after the first render.
- `telemetry.ts`: the single entry `record(event)`; in-memory ring buffer (200); flush when 30 events are queued, every 60 s while the app is in the foreground, and when the app moves to the background; flush only when authenticated; every public function swallows all errors. A later consent gate goes into `record()` and nowhere else (`[Planned]`).
- `episode.ts`: starts the cold-start episode, starts a new episode on each return to the foreground (`AppState` `active`, with `backgroundMs`), ends it on `background`, and emits the milestones; `App.tsx`, `useAuthStore.ts` (`auth_ready` with `authPath` and `authMs`) and `RootNavigator.tsx` (`navigator_mounted`) call it, as does the Home screen for `ready`.
- `routeTemplate.ts`: pure function URL to template as described above.
- `apiTelemetry.ts`: used by the existing interceptors; measures total duration, attempts and refresh time per logical request and sets `source`: `warmup` for the `/health` call in `useAuthStore`, `sync` for the health and nutrition sync services, `auth` for the token refresh, `ui` for everything else.
- `screenTelemetry.ts`: helper for `screen` events including `trigger`, `dataReadyMs`, `renderMs` and `result`.
- Session ID: random UUID per launch, memory only.

**Infrastructure.** `workspaceCapping.dailyQuotaGb` in `infra/modules/appinsights.bicep` (PO-2). Retention: align to 90 days in documentation; the Infrastructure agent evaluates whether to pin the 90 days explicitly in Bicep so that code and live state cannot drift again (only if the API version in use supports it; verified with `what-if`).

**Join query** (proposed, finalised by the Backend agent in WP-BE-02):

```kusto
let Client = traces
| where timestamp > ago(1d)
| extend p = parse_json(message)
| where tostring(p.event) == "client.api"
| project client_request_id = tostring(p.client_request_id), route = tostring(p.route),
  client_ms = toreal(p.client_ms), attempts = toint(p.attempts), token_refresh_ms = toreal(p.token_refresh_ms);
let Server = traces
| where timestamp > ago(1d)
| extend p = parse_json(message)
| where tostring(p.event) == "handler.success"
| project client_request_id = tostring(p.client_request_id), server_ms = toreal(p.duration_ms),
  is_first = tobool(p.worker_first_invocation), cosmos_init_ms = toreal(p.cosmos_init_ms);
Client
| join kind=inner Server on client_request_id
| summarize calls = count(), p50_client_ms = percentile(client_ms, 50), p95_client_ms = percentile(client_ms, 95),
  p50_server_ms = percentile(server_ms, 50), p95_gap_ms = percentile(client_ms - server_ms, 95)
  by route, is_first
| order by p95_gap_ms desc
```

## 11. Why the Relay Instead of the SDK (summary of PO-1)

An Application Insights connection string in the app can only write telemetry, not read it. The risk is that anyone who extracts it from the app package can send arbitrary data into your resource, which pollutes the logs and costs money. The relay removes that: only a signed-in user can send, the backend decides what is stored and in which shape, and the app contains nothing secret. Costs of the relay: a new endpoint to maintain, our own batching and validation code, no automatic correlation (solved by the request ID), and no standard SDK features such as automatic crash grouping. It also needs no native module, so no new native build is expected.

## 12. Privacy Impact

Privacy Impact: Policy update proposed

Data flow: device to FitTrack backend over the existing authenticated API, then to Application Insights of the same environment (Dev build to `appi-fittrack-dev`, Alpha to `appi-fittrack-alpha`). Categories in client events: HTTP method, route template, status or error class, durations, retry count, whether and how long a token refresh took, screen name and load time, app version, build variant, OS and OS version, the device model (Android model name, not a unique identifier), start milestones with their timing, how long the app was in the background before a resume, a random per-launch session ID, JavaScript error name and truncated stack, plus the user ID (PO-6). Not included in client events: tokens, email, request or response content, free text, query strings, concrete resource IDs, device identifiers, IP address (the app talks only to the backend; Azure sees connection data as for any API call). The existing server events are unchanged (PO-7) and contain, among others, `userId`, resource IDs, the two search terms and, in targeted failure diagnostics, recipe text (backend instructions, "Actionable Failure Logging"). Visible to operators with access to the Azure resources. Retention: 90 days (live value, Section 3). Erasure: logs are not deleted per user (existing policy statement). With a user ID in them, the statement needs to say so; an individual erasure request would need manual purge (OQ2). Consent: none requested now (PO-4); a consent step is `[Planned]`.

Existing behaviour that the same policy edit covers (PO-6, PO-7): the backend logs `userId` in many events and search terms in two (Section 3). The policy states both.

Policy sections affected: "Wo und womit werden die Daten verarbeitet?" (bullet Betriebsprotokolle), "Speicherdauer und Löschen". Proposed German wording (retention 90 days; the `Stand:` date is updated when applied):

> **Betriebsprotokolle:** Application Insights, 90 Tage. Dazu gehören technische Protokolle des Servers und Leistungs- und Fehlerdaten der App: welche Funktion aufgerufen wurde, wie lange sie gedauert hat, wie oft sie wiederholt werden musste, App- und Android-Version, das Gerätemodell, Zeitpunkte beim App-Start (zum Beispiel wie lange Anmeldung und erstes Laden gedauert haben) sowie technische Fehlernamen. In diesen Protokollen wird deine technische Nutzerkennung gespeichert (eine zufällige Konto-ID, nicht deine E-Mail-Adresse), damit wir Vorgänge einem Konto zuordnen und Probleme nachvollziehen können. Außerdem werden die Suchbegriffe protokolliert, die du in der Lebensmittel- und der Bibliothekssuche eingibst. In seltenen Fehlerfällen können zur Fehlersuche auch Teile von Rezepttexten enthalten sein. Anmelde-Tokens werden nicht protokolliert. Aktuell erheben wir diese Daten ohne gesonderte Zustimmung; eine Zustimmungsabfrage ist geplant.

and in "Speicherdauer und Löschen" the sentence on logs becomes: "Betriebs- und Fehlerprotokolle werden nicht einzeln gelöscht und nach 90 Tagen automatisch entfernt. Sie können deine technische Nutzerkennung und Suchbegriffe enthalten; auf Anfrage prüfen wir die Löschung."

Open questions: legal basis and consent (OQ1); erasure tooling (OQ2); whether the sentence about "ohne gesonderte Zustimmung" stays in the published text (Product Owner; the policy edit is approved under PO-5, the exact sentence is the Product Owner's call at review). The claim about recipe text in failure diagnostics follows the backend rule that allows it; the Backend agent verifies in WP-BE-04 that it matches the code and removes the sentence if no such logging exists.

## 13. Backend Work Packages

### WP-BE-01 — Request ID in handler logs

Agent: Backend

Goal: In `withHandler()`, read `x-fittrack-request-id`, validate it as a UUID and add `client_request_id` to the four lifecycle events. Invalid or missing values are omitted. No other behaviour changes.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/http.ts
- backend/src/lib/http.test.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2

Dependencies:
- None

Expected Handoff:
- field name and validation rule
- test results

### WP-BE-02 — Relay endpoint

Agent: Backend

Goal: Implement `POST /api/telemetry/client` as specified in Section 10 including strict schema, size limit, per-user in-memory rate limit, the five event kinds and the batch trace, the single function `clientEventActorFields()`, registration, baseline update, tests and the API reference entry. The five event kinds (episode, milestone, api, screen, error) and their traces are defined in Section 10. Finalise the join query by running it read-only against Alpha only after deployment is confirmed (not part of this package).

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/05-authentication.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/http.ts
- backend/src/lib/log.ts
- backend/src/lib/auth.ts
- backend/src/index.ts
- backend/src/functions/registrations.test.ts
- one existing handler with `parseBody` as pattern (for example `backend/src/functions/weights.ts`)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-3 to AC-9
- AC-12
- AC-30

Dependencies:
- WP-BE-01 handoff

Expected Handoff:
- final request and response contract
- final log event and field names for the join query
- data-handling report for the privacy review: what is logged, which identifier, no user text
- updated function baseline and registration test result
- test, typecheck and `build:verify` results

### WP-BE-03 — Cancelled

The former search-term log hygiene package is cancelled by PO-7. The work package number is kept so that references in earlier discussions remain valid. No work.

### WP-BE-04 — Knowledge Base corrections and privacy policy

Agent: Backend

Goal: (a) Correct the retention statements to the verified live value in `docs/kb/tech/01-system-overview.md`, `docs/kb/tech/07-infrastructure.md` (coordinate with WP-INFRA-01) and `docs/kb/tech/09-api-reference.md` and record that the workspace default (30 days) and the Application Insights data retention (90 days) are different settings. (b) Correct the `02-backend.md` statement about user IDs in logs, document the relay, the request ID and the final join query. (c) Apply the approved wording from Section 12 to `docs/legal/datenschutzerklaerung-alpha.md`, update the `Stand:` date and change nothing else in the file. Before applying, verify each factual claim in the wording against the code (user ID, the two search events, recipe text in failure diagnostics, retention 90 days) and report any claim that does not hold instead of publishing it.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- docs/legal/datenschutzerklaerung-alpha.md
- WP-BE-02 and WP-INFRA-01 handoffs

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-11
- AC-13

Dependencies:
- WP-BE-02
- WP-BE-05
- WP-INFRA-01 handoff

Expected Handoff:
- list of corrected documents and statements
- policy diff limited to the approved sections

### WP-BE-05 — Cosmos request timing per handler invocation

Agent: Backend

Goal: Make the share of the server handler time that is spent in Cosmos visible, without slowing requests down. Each terminal handler event (`handler.success`, `handler.response.failure`, `handler.error`) gets `cosmos_ms` (sum of the durations of all Cosmos network requests of this invocation), `cosmos_calls` (number of such requests), `cosmos_max_ms` (slowest single request) and `cosmos_ru` (sum of the request charge). The fields are omitted when the invocation made no Cosmos request. Concurrent requests are summed, so `cosmos_ms` can exceed `duration_ms`; `cosmos_max_ms` is the lower bound for the time that must have been spent waiting.

Design (the Backend agent follows it; it does not switch to another approach without a revised plan). It uses only public, typed SDK surface: `CosmosClientOptions.httpClient` is a documented option of `@azure/cosmos` 4.10.1 whose type is the `HttpClient` interface of `@azure/core-rest-pipeline`, and the SDK passes it to every network request (`ClientContext` hands it to `RequestHandler`, which uses it instead of the cached default client).

- New `backend/src/lib/cosmosTiming.ts` with an `AsyncLocalStorage` holding the per-invocation counters, a function that runs a callback inside a fresh store and returns the counters, and a small class implementing `HttpClient`. It wraps the default client from `createDefaultHttpClient()` of `@azure/core-rest-pipeline` and delegates `sendRequest` unchanged.
- The wrapper does only constant-time synchronous work around the delegated call: two monotonic clock reads, additions to the counters, and reading the `x-ms-request-charge` response header when present. No I/O, no logging, no extra network call and no extra `await` besides the one on the delegated call. It records the duration in a `finally` so failed and throttled requests are counted, and it returns the response or rethrows the error unchanged. Everything it does besides the delegated call is wrapped so that a measurement failure cannot affect a request.
- `getCosmos()` passes the wrapper as `httpClient` to the `CosmosClient` options. No type assertion is needed.
- Dependency: `@azure/core-rest-pipeline` is installed today only as a transitive dependency (1.25.0, shared by `@azure/cosmos`, `@azure/ai-form-recognizer` and others). Because the backend now imports it directly it becomes a direct production dependency in `backend/package.json` and `_deploy_staging/package.json` with `^1.25.1` (latest stable on 2026-11-16, modified 2026-11-08; re-verify with `npm view @azure/core-rest-pipeline dist-tags.latest` before installing). `npm ls @azure/core-rest-pipeline` must still show one deduplicated copy; if the lockfile resolves a second copy, the agent reports it. The version table in `docs/kb/tech/01-system-overview.md` gets the new entry.
- `withHandler()` runs the wrapped handler inside the counter store and adds the four fields to the terminal events. No other handler and no repository changes.
- The SDK's own retries are separate network requests and are counted individually; `cosmos_calls` therefore can be higher than the number of repository calls. A throttled request (429) appears as its own call with its request charge.
- If a future SDK version stops honouring `httpClient`, the contract test (CI only, no local emulator) that proves the wrapper ran for a real request fails; the unit tests with a fake inner client run locally.

Required Knowledge Base:
- docs/kb/tech/02-backend.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/lib/cosmos.ts
- backend/src/lib/cosmos.test.ts
- backend/src/lib/http.ts
- backend/src/lib/http.test.ts
- backend/package.json
- _deploy_staging/package.json
- docs/kb/tech/01-system-overview.md (version pins)
- node_modules/@azure/cosmos/dist/commonjs/CosmosClientOptions.d.ts
- WP-BE-02 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-27
- AC-28
- AC-29

Dependencies:
- WP-BE-02

Expected Handoff:
- final field names and semantics (sum, max, concurrency caveat)
- where the wrapper is attached and the contract test that guards it
- proof from unit tests that the wrapper adds no I/O and never alters responses or errors
- the new direct dependency and the result of `npm ls @azure/core-rest-pipeline` (one deduplicated copy)
- test, typecheck and `build:verify` results
- the KQL query that splits `duration_ms` into `cosmos_ms` and the rest

### WP-BE-06 — Wait-time analysis and report

Agent: Backend

Goal: Make the question of Section 4a answerable repeatedly. After release, write and verify the KQL queries that (a) produce the cold-start, resume and tab-switch wait per episode and its percentiles, (b) decompose a cold-start episode and a screen load into the buckets and the critical-path rule of Section 4a, (c) classify the remainder, (d) report whether the existing `/health` warm-up helps (client duration of the probe versus `worker_first_invocation` of the following calls), and (e) check milestone completeness. Run them read-only against `appi-fittrack-alpha` (Backend read-only diagnostics rules apply: aggregates, no user free text, no tokens). Deliver a wait-time report and document the queries in `docs/kb/tech/02-backend.md`. Calibrate the proposed probe threshold on the first week of data and state the value used.

The report contains: p50 and p95 of the cold-start wait (native start estimate plus `ready.atMs`), of the first screen load after a resume, and of tab-switch loads; the share of each bucket at p50 and p95; the three largest buckets with the follow-up action from the table in Section 4a; the effect of the warm-up probe; and the milestone completeness. It states which numbers rest on the manual native-start calibration.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/http.ts
- backend/src/functions/clientTelemetry.ts
- WP-FE-01 handoff (final event shapes)
- WP-INFRA-02 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-33
- AC-34
- AC-35

Dependencies:
- WP-INFRA-02 handoff (data arrives and is complete enough)
- optionally the manual native-start calibration by the user (see AC-35)

Expected Handoff:
- the verified queries, documented in `02-backend.md`
- the wait-time report with the top three buckets and their follow-up actions
- the calibrated probe threshold

## 14. Frontend Work Packages

### WP-FE-01 — Telemetry module and API client

Agent: Frontend

Goal: Implement the module in Section 10 and the model in Section 4a: the episode and milestone events (cold start with six milestones, resume episode with `backgroundMs`), `startMark` as the second import of `mobile/index.ts`, `jsEntryPerfMs`, the device model, the request-ID header and per-attempt timing in `apiClient` without changing retry, 401 or quota behaviour, `source` on every API event (`warmup` for the `/health` call in `useAuthStore`, `sync` for the health and nutrition sync services), `auth_ready` with `authPath` and `authMs` from `useAuthStore.initialize()`, `navigator_mounted` from `RootNavigator`, `ready` and the screen events (with `trigger`, `dataReadyMs`, `renderMs`, `result`) for the five tabs, the `ErrorBoundary` hook, and unit tests with a mocked transport and a mocked clock.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/shared/api/client.ts
- mobile/src/shared/api/client.test.ts
- mobile/src/services/authService.ts
- mobile/src/app/ErrorBoundary.tsx
- mobile/src/app/App.tsx
- mobile/src/modules/home/HomeScreen.tsx
- mobile/index.ts
- mobile/src/modules/auth/useAuthStore.ts
- mobile/src/app/navigation/RootNavigator.tsx
- mobile/src/services/health/healthSyncService.ts
- mobile/src/services/health/nutritionSyncService.ts
- mobile/src/modules/home/homeDataLoader.ts
- mobile/src/modules/progress/ProgressScreen.tsx
- WP-BE-02 handoff (contract)

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-14 to AC-20, AC-25, AC-26, AC-31 and AC-32 (client behaviour, Section 20)

Dependencies:
- WP-BE-02 handoff

Expected Handoff:
- final event shapes sent
- per screen, which event ends the measurement, and which calls belong to the startup chain with which `source`
- data-handling report: what is sent, what stays on the device (nothing persistent), no identifier created beyond the in-memory session ID
- confirmation that no native module was added (`Mobile Build Impact: None`) or the exact reason if one was
- test, typecheck and `smoke:bundle` results

### WP-FE-02 — Mobile Knowledge Base

Agent: Frontend

Goal: Document the module, the data boundary, the request-ID header and the always-on behaviour (consent `[Planned]`) in `docs/kb/tech/03-mobile.md`.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md

Required Repository Context:
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-11

Dependencies:
- WP-FE-01

Expected Handoff:
- updated 03-mobile.md

## 15. Infrastructure and Configuration

### WP-INFRA-01 — Ingestion cap and retention

Agent: Infrastructure

Goal: Add the daily ingestion cap (0.1 GB per day, PO-2) to `infra/modules/appinsights.bicep`; evaluate and, if the API version supports it, pin the Application Insights data retention to 90 days; `what-if` first (Delete or Recreate is a stop condition); apply to Dev, then Alpha; verify the live cap and retention values, not only the provisioning state. Note in the handoff that backend logs also stop when the cap is reached. Executed only through the Alpha deploy gate.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- infra/modules/appinsights.bicep
- infra/main.bicep
- infra/parameters/alpha-fittrack.bicepparam

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-21

Dependencies:
- None. Runs before the backend deploy.

Expected Handoff:
- what-if result and applied change
- live cap and retention values

### WP-INFRA-02 — Post-release verification

Agent: Infrastructure

Goal: After a separately approved `Deploy to Alpha` and `New Alpha Build`, and after the user has used the installed Preview app on the main screens, run read-only aggregate queries on `appi-fittrack-alpha`: events per day, match rate between client and server events, sampling loss from `received_events`, field allowlist check, volume against the cap. This package is not an approval to deploy or build.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/02-backend.md

Required Repository Context:
- scripts/release-alpha.ps1
- mobile/eas.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12
- AC-22 to AC-24
- AC-29
- AC-36

Dependencies:
- WP-QA-01 with PASS
- explicit user commands for deploy and build
- Normal use of the installed Preview build for about one week. The user does not run a test script; the episodes come from normal use. If after one week fewer than 5 cold-start episodes or 3 resume episodes exist, WP-INFRA-02 reports that and the Orchestrator asks the user for targeted use.

Expected Handoff:
- aggregate counts only, no user values
- result per acceptance criterion

## 16. QA Work Package

### WP-QA-01 — Review before release

Agent: QA

Goal: Verify all acceptance criteria that can be checked without deployment and review the data handling against Section 12. QA does not own implementation. What is verified only on mocks is stated explicitly.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/02-backend.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/09-api-reference.md

Required Repository Context:
- backend/src/functions/clientTelemetry.ts
- backend/src/lib/http.ts
- mobile/src/services/telemetry/
- mobile/src/shared/api/client.ts
- docs/legal/datenschutzerklaerung-alpha.md
- all earlier handoffs

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-11
- AC-13 to AC-21
- AC-25 to AC-28
- AC-30 to AC-32

Dependencies:
- WP-BE-04 and WP-FE-02

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of items verified only on mocks

## 17. Shared Package Changes

None. The wire format is defined by the backend Zod schema and mirrored in the mobile module; adding it to `shared/types/` is an option the Backend agent may take if it fits existing practice.

## 18. Test Strategy

- Backend unit tests (in-memory, no Cosmos): schema accepts valid and rejects unknown keys, oversize bodies, over-long routes, routes not matching the pattern, out-of-range numbers; unauthenticated request gives `401`; rate limit gives `429` after the 11th batch in a minute; the written traces contain exactly the allowed fields; `client_request_id` appears only for valid UUIDs.
- Mobile unit tests (transport mocked): route templating for UUIDs, dates, barcodes, query strings and unknown segments; one event per logical request with the right attempt count and total duration across retries; refresh time captured; buffer limit; flush triggers; failures swallowed; the telemetry call is not itself recorded; existing `client.test.ts` unchanged.
- Cold-start model tests (mobile, mocked clock and transport): milestone order and uniqueness, the four `authPath` values, `source` tagging of the warm-up, sync and ui calls, resume episodes with `backgroundMs`, tab-switch triggers, and that `ready` equals the end of the first Home screen event.
- Gates: typecheck for backend, mobile and tests; the three Vitest suites; `build:verify`; `smoke:bundle`; parity gate; encoding check.
- No Cosmos emulator and no contract test is involved.
- Behaviour on a real device and in Application Insights is `MANUAL VALIDATION REQUIRED` and checked in WP-INFRA-02.

## 19. Documentation Updates

Retention statements and the user-ID statement corrected (WP-BE-04), relay and request ID documented in `02-backend.md` and `09-api-reference.md`, module documented in `03-mobile.md` (WP-FE-02), cap and retention in `07-infrastructure.md` (WP-INFRA-01 and WP-BE-04), policy (WP-BE-04). Documentation work packages precede QA so QA can verify them. Anything not yet deployed is marked `[Planned]`.

## 20. Acceptance Criteria

Backend request ID and relay:

1. AC-1: A request with a valid `x-fittrack-request-id` UUID produces `handler.start` and one terminal event that both contain that value as `client_request_id`.
2. AC-2: A request with a missing or non-UUID header produces events without `client_request_id`, and the response is unchanged.
3. AC-3: `POST /api/telemetry/client` without a valid Bearer token returns `401`.
4. AC-4: A body with an unknown key, more than 100 events, a body above 32 KB, a `route` not matching the pattern, or an out-of-range number returns `400` and writes no event trace.
5. AC-5: A valid batch of N events returns `204` and writes one `client.batch` trace with `received_events = N` and N event traces.
6. AC-6: An 11th batch from one user within one minute on one worker returns `429`; the earlier batches were accepted.
7. AC-7: No written trace contains a query string, a token, a request or response body, or an error message from the client.
8. AC-8: Every event trace written by the relay contains `userId` (PO-6), added through the single function `clientEventActorFields()`; no other personal identifier (email, name, token) is written.
9. AC-9: The new route is registered, the function baseline and the quoted function count are updated, and `registrations.test.ts` passes.
10. AC-10: The events `food-products.search` and `reusableItems.search` are unchanged by this plan (PO-7); no existing test is modified to remove their fields.
11. AC-11: The Knowledge Base states the verified retention (90 days Application Insights data versus 30 days workspace setting), describes the relay, the request ID and the always-on behaviour, and marks the consent step `[Planned]`.
12. AC-12: After release, the share of client `client.api` events that find a server event with the same `client_request_id` is reported; and the difference between events sent and `received_events` shows the sampling loss. If the match share is below 90 %, the cause is documented.
13. AC-13: The policy contains the approved wording, the `Stand:` date is updated and no other section differs.

Mobile:

14. AC-14: A call that succeeds on the first attempt produces exactly one `api` event with `attempts = 1`.
15. AC-15: A GET retried twice produces exactly one event with `attempts = 3` and a duration of at least 4,500 ms with the existing delays.
16. AC-16: A request that triggered a token refresh carries `tokenRefreshMs`; others do not.
17. AC-17: Route templating gives exactly: `/api/weights/<uuid>` to `GET /api/weights/{id}` (method preserved), `/api/diary/day/2026-11-16/meta` to `/api/diary/day/{date}/meta`, `/api/food-search?query=banane` to `/api/food-search`, a barcode or unknown segment to `{id}`.
18. AC-18: No event, header or request contains an `Authorization` value, a body, a query string, a user identifier or a concrete resource ID; a unit test inspects the serialised batch.
19. AC-19: A failing, slow or rejected telemetry call changes no API result, shows nothing to the user, and is not retried; the flush runs only when authenticated. Existing retry, 401 and quota tests pass unchanged.
20. AC-20: The buffer never exceeds 200 events (oldest dropped); a flush occurs at 30 queued events, after 60 s foreground time, and when the app moves to the background.

Infrastructure:

21. AC-21: The live workspace shows the approved daily cap; the live retention matches the documented 90 days; `what-if` showed no Delete or Recreate.
22. AC-22: A query on a sample of event traces shows only allowlisted fields.
23. AC-23: Daily ingested volume after one week of use is reported against the cap (assumption A1).
24. AC-24: Typecheck, all three test suites, `build:verify`, `smoke:bundle`, the parity gate and the encoding check pass, and no existing test was removed or weakened.
25. AC-25: For each of the five tabs, a unit test with a mocked transport shows exactly one `screen` event with the screen name and a `durationMs` that covers the time from opening the screen to the first rendered data, error or empty state; a screen left before it finished loading records no event; the handoff lists the measurement end point per screen. After release, `client.screen` traces exist for all five screens for a test session on the Preview build.
26. AC-26: A screen load of at least 5 s can be broken down from the logs alone. A documented KQL query returns, for one `client.screen` event, the `client.api` events of the same episode whose time window lies inside the screen window, and per call the shares: first attempt, retry wait, further attempts, token refresh, server handler time (via `client_request_id`), and the remainder. The remainder is labelled "network, platform start and device" because those three cannot be separated. A unit test checks that `startedAtMs` of screen and api events share one origin, that `attemptMs`, `attemptStatus` and `retryWaitMs` match the retry sequence of the existing interceptor (for two retries `retryWaitMs` is 4,500), and that `tokenRefreshOk` is false when the refresh failed.
27. AC-27: For a handler that makes two Cosmos requests of 30 ms and 50 ms (fake inner HTTP client), the terminal event contains `cosmos_calls = 2`, `cosmos_ms` of about 80, `cosmos_max_ms` of about 50 and the summed request charge; a handler without Cosmos requests has none of the four fields; a failing request is counted and its error reaches the caller unchanged.
28. AC-28: The HTTP client wrapper adds no network call, no logging and no await other than on the delegated call; a unit test shows that a throwing counter or a missing store does not change the response or the error of a request; no repository file is modified by this work package; the code uses no type assertion for the SDK option; `@azure/core-rest-pipeline` is a direct dependency in `backend/package.json` and `_deploy_staging/package.json` and `npm ls` shows a single copy.
29. AC-29: After release, aggregate handler p50 of `diary-get`, `weights-list` and `favorites-list` on Alpha is compared with the values before the release (before: p50 186 ms for later requests per worker, measured 2026-11-13 to 2026-11-16). An increase of more than 10 % that is not explained by a different request mix is reported to the Orchestrator and the instrumentation is reviewed. The sampling caveat applies: only `Request` telemetry is unsampled, so the comparison uses `requests`, not traces.
30. AC-30: The relay accepts the five event kinds of Section 10 and writes the traces `client.episode`, `client.milestone`, `client.api`, `client.screen` and `client.error` plus `client.batch`, each with exactly the allowlisted fields including `episode_id`; an unknown enumeration value, a missing `episodeId`, or a time outside 0..604800000 returns `400` and writes nothing.
31. AC-31: A mobile unit test with a mocked clock simulates a cold start and shows each of the six milestones exactly once and in order with non-decreasing `atMs`; `auth_ready` carries `authPath` and `authMs` for the four paths `no_token`, `valid`, `refreshed` and `refresh_failed`; `ready` equals the end of the first Home screen event; the startup calls appear as API events with `source` `warmup` for `/health`, `ui` for the profile and Home data calls, and `sync` for the health and nutrition sync calls.
32. AC-32: A return to the foreground starts a new episode with `trigger = resume` and `backgroundMs` equal to the time spent in the background (mocked clock); events after it carry the new `episodeId` and times relative to the new origin; a tab press produces a `screen` event with `trigger = tab_switch`.
33. AC-33: Documented KQL decomposes one cold-start episode and one screen load into the buckets of Section 4a using the critical-path rule; the buckets add up to the measured total within 50 ms; the remainder is classified `platform_start_suspected`, `no_server_event` or `network_or_device`. Verified on real Alpha data after release, not on mocks.
34. AC-34: A wait-time report exists with: p50 and p95 of the cold-start wait, of the first screen load after a resume, and of tab-switch loads; bucket shares at p50 and p95; the three largest buckets, each with its follow-up action from the table in Section 4a; the effect of the warm-up probe; the calibrated probe threshold. Based on all episodes of the first week of normal use; if fewer than 5 cold-start or 3 resume episodes exist, the report says so and marks the numbers as not yet reliable.
35. AC-35: The native start before JavaScript is quantified once by hand on the test device: at least 5 cold starts measured with `adb shell am start -W` (`TotalTime`) or, if `adb` is not available, with a stopwatch from the tap to the first visible screen, with device model and method stated. The result is compared with `jsEntryPerfMs`. If `jsEntryPerfMs` is within 20 % of the manual value it is used from then on; otherwise the manual value is reported as a constant for that device class. Optional but recommended and done by the user (a few stopwatch measurements): without it the report states the native part as an estimate from `jsEntryPerfMs` only and marks it as unverified.
36. AC-36: For at least 95 % of the cold-start episodes of the first week, all six milestones exist (proposed heuristic). Episodes with missing milestones are counted and the likely cause is stated (app ended before a flush, no authentication, old build).

## 21. Risks and Edge Cases

- **Cap side effect:** when the cap is reached, backend logs stop too. Accepted under PO-2; verify headroom in AC-23.
- **Sampling** can drop single client traces (A2); loss is measurable through `received_events`.
- **Per-worker rate limit** is approximate (A3).
- **Telemetry distorting the measurement:** batching, no awaiting, small payload, no retry.
- **Startup contention:** `healthSyncService` and `nutritionSyncService` fire API calls right after authentication and compete with the Home data load and the cold server. They are tagged `source: sync`, so the effect becomes visible in `pre_data_gap` and in the breakdown (Section 4a).
- **Incomplete episodes:** an app that is ended before the last batch is flushed loses events, in particular at long waits. AC-36 measures it; the in-memory design is kept on purpose (no on-device persistence of telemetry).
- **`performance.now()` semantics are unverified (A5)** and the probe threshold is a heuristic; both are calibrated with real data (AC-35, WP-BE-06).
- **Device model** is a new data category in client events. It is not a unique identifier; disclosed in the policy wording (Section 12).
- **Route allowlist drift:** a new endpoint appears as `{id}` until added to the client allowlist. Safe direction.
- **Retries inflate the user-visible total.** Intended; `attempts` separates them.
- **Linkability is intended** (PO-6): the client event, the server events of the same call and the user are joined through the request ID and `userId`.
- **Collecting without consent** is the Product Owner decision PO-4; the legal assessment (OQ1) is not made by this plan.
- **Cosmos timing (WP-BE-05) uses the public `httpClient` option** and adds one direct dependency that is already installed transitively. Risks: a future SDK version could stop honouring the option (guarded by the CI contract test), and wrapping the HTTP client replaces the SDK's cached default client, so connection reuse must be checked in the handoff (the wrapper delegates to a single shared default client created once, not one per request). Concurrent requests make `cosmos_ms` a sum, not wall time; `cosmos_max_ms` is provided for that reason.
- **Server time inside Cosmos is covered by WP-BE-05;** time in the handler outside Cosmos (JSON, rendering, AI calls) is the remainder of `duration_ms`.

## 22. Recommended Execution Order

Sequential, one work package at a time:

1. WP-INFRA-01 (cap and retention). Infrastructure before code, so the cap exists before data flows.
2. WP-BE-01 request ID.
3. WP-BE-02 relay endpoint.
4. WP-BE-05 Cosmos request timing, so that it ships in the same deploy.
5. WP-FE-01 telemetry module and API client.
6. WP-FE-02 mobile Knowledge Base.
7. WP-BE-04 Knowledge Base corrections and privacy policy (also documents WP-BE-05). Documentation before QA.
8. WP-QA-01 review.
9. User commands, each separate: `Deploy to Alpha` (backend and Bicep), then `New Alpha Build` (JS-only change, no native change expected).
10. User uses the Preview app normally for about one week.
11. WP-INFRA-02 post-release verification, including the performance comparison of AC-29 and the milestone completeness of AC-36.
12. Optional: the user reports the native start calibration of AC-35. When the user notices a long wait, he tells the Orchestrator the approximate time and WP-BE-06 analyses that episode.
13. WP-BE-06 wait-time analysis and report. This answers the question of Section 4a and ends with the ranked follow-up actions.

WP-BE-03 is cancelled (PO-7) and not executed.

Follow-up plans, once data exists: token-refresh deduplication, retry-delay strategy, parallel screen loading, Always Ready decision, consent step, review of pseudonymisation before a wider release.
