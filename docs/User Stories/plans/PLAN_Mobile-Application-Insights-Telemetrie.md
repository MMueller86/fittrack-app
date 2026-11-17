# Plan: Mobile Application Insights Telemetry

Status: Superseded by [PLAN_Client-Telemetrie-Backend-Relay.md](PLAN_Client-Telemetrie-Backend-Relay.md) — PO-1 rejected a connection string in the app. Do not implement from this file; it can be deleted.
Infrastructure Impact: Alpha
Mobile Build Impact: Potential Native Impact

Companion to [PLAN_Azure-Functions-Cold-Start-Telemetrie.md](PLAN_Azure-Functions-Cold-Start-Telemetrie.md). That plan instruments the backend; this plan adds the missing client side so that perceived latency can be split into client, network, platform and server time.

## Open Product Owner Decisions

| ID | Decision needed | Planner recommendation | Blocks |
|---|---|---|---|
| PO-1 | The Application Insights connection string is embedded in the mobile binary. The Knowledge Base says "no keys in the mobile app" and the global rules list connection strings as secrets. The string only allows writing telemetry, not reading it, but anyone who extracts it can send arbitrary data into `appi-fittrack-alpha`. Accept this documented deviation? | Accept, with three mitigations: the value comes from an EAS environment variable and never from the repository; a daily ingestion cap (PO-2); telemetry fails closed when the variable is missing. If declined, use fallback Option B (backend relay, see Section 11). | WP-FE-02, WP-INFRA-02 |
| PO-2 | Daily ingestion cap for `log-fittrack-alpha` (today none, `dailyQuotaGb = -1`). A cap also stops backend logs once reached. | Proposed heuristic, not a confirmed rule: 0.1 GB per day. Peak observed since 2026-10-26 was about 7 MB of traces plus 0.4 MB of requests on one day, so this leaves roughly tenfold headroom. | WP-INFRA-01 |
| PO-3 | The privacy policy says Application Insights logs are kept 30 days. The live workspace default is 30 days, but the live tables `AppRequests`, `AppTraces`, `AppExceptions`, `AppDependencies` and `AppEvents` show 90 days (read 2026-11-13). Align the policy to 90 days, or set the tables to 30 days in Bicep? | Decide independently of this feature, but before the policy text is finalised; mobile telemetry lands in the same tables. | WP-FE-04 text, WP-INFRA-01 scope |
| PO-4 | Transparency model for device telemetry in Alpha: always on with policy disclosure, or an in-app switch? The legal basis for processing is not documented in the repository. | Always on for Alpha with policy disclosure and no user-linked identifiers; legal basis stays an `Open question` for legal review. Planner does not invent a legal basis. | WP-FE-02, WP-FE-04 |
| PO-5 | Explicit approval to edit `docs/legal/datenschutzerklaerung-alpha.md` (proposed wording in Section 12). | Approve after PO-3 and PO-4. | WP-FE-04 |

Work that does not depend on these decisions (spike WP-FE-01, instrumentation design, tests against mocks) can proceed.

## 1. Requirement Assessment

**Accept with modifications.** The request is to send client-side performance data to Application Insights. This is the only option that makes the full client-observed duration visible next to the server telemetry.

Modifications to a plain "install the SDK" approach, all driven by privacy and by the measurement goal:

1. Disable the SDK's automatic request tracking. It would record full URLs (query strings contain search terms; paths contain recipe, diary and food IDs) and cannot capture retries or the token-refresh time that precede the real request. Instrument the existing Axios client manually instead.
2. Send route templates, never concrete IDs, query strings, headers, bodies or free text.
3. Send no user ID, no email, no token and no persistent device identifier.
4. Correlate with the backend by sending a W3C `traceparent` header, so a client record and the server `requests` row share one operation ID.
5. Connection string via EAS environment variable, daily cap in infrastructure, telemetry never able to break or slow the app.

Classification of the original request is `Accept with modifications`. The alternative (Option B) is described in Section 11 so the Product Owner can compare; it is not silently substituted.

## 2. Feature Summary

Measured, anonymised client telemetry in the existing Application Insights resource: duration of each API call as the app sees it (including retries and token refresh), screen load times, app version and OS, and unhandled JavaScript errors without message text. Result: a single KQL query answers "where did the 8 seconds go" for any slow screen load.

## 3. Current Behaviour

Confirmed from the repository and live Azure (2026-11-13 to 2026-11-16):

- The app sends no telemetry. `mobile/package.json` has no Application Insights or Sentry dependency. `mobile/src/app/ErrorBoundary.tsx` only calls `console.error` (its comment mentions Sentry, but none is connected).
- The only on-device diagnostics are the local Health Connect `syncLogger` (AsyncStorage, 150 entries), visible in the Health Connect screen and cleared on account deletion.
- `mobile/src/shared/api/client.ts`: one Axios instance, 15 s timeout. The request interceptor refreshes an expired access token against CIAM before the request is sent. The response interceptor retries GET requests after 502, 503, 504 or a timeout, up to twice, waiting 1.5 s and then 3 s. None of this time is visible to the backend.
- Server side, Alpha Application Insights `appi-fittrack-alpha`: workspace-based, ingestion mode `LogAnalytics`, IP masking at the default (not disabled), public ingestion enabled, no daily cap. Backend handler logs already carry `worker_first_invocation`, `worker_uptime_ms` and, after the pending deploy, `cosmos_init_ms`.
- Measured on Alpha (2026-11-13 to 2026-11-16): first request on a worker p50 about 2,400 ms versus about 186 ms for later requests. The reported waiting time in the app of up to 8 s is not explained by server-side data; the gap is the reason for this plan.

## 4. Desired Behaviour

- Each API call made through `apiClient` produces one client telemetry record with: HTTP method, route template, final status or error class, total duration from the first attempt to the final result, attempt count, whether a token refresh preceded it and its duration.
- Each of the five tabs and the Progress screen records time from navigation to first rendered data (`screen.load`).
- App start records app version, build variant, OS version and a random per-launch session ID that is not persisted.
- Unhandled JavaScript errors reaching the `ErrorBoundary` are recorded with error name and a truncated stack, without the message.
- Each outgoing API request carries a `traceparent` header; the backend's `requests` row for that call has the same operation ID as the client record.
- Telemetry is created off the critical path, never awaited by UI code, and every failure is swallowed.
- Without the connection string (local development without `.env`, unit tests) telemetry is disabled and nothing throws.

## 5. Scope

- Mobile: SDK integration, manual instrumentation in the existing API client and screens, `ErrorBoundary` hook, tests, Knowledge Base update.
- Infrastructure: workspace ingestion cap (after PO-2), EAS environment variables for Dev and Preview, post-release verification.
- Backend: Knowledge Base query documentation and read-only verification of correlation. No runtime change expected.
- Documentation: `docs/kb/tech/03-mobile.md`, `docs/kb/tech/02-backend.md`, `docs/kb/tech/07-infrastructure.md`, proposed policy text.

## 6. Out of Scope

- User-level analytics, funnels, session replay, screen recording, custom dashboards or alerts.
- Telemetry that includes food names, search terms, recipe text, weights, health values or any request or response content.
- Changing Flex Consumption settings, Always Ready, or the backend `host.json` sampling.
- Fixing the causes found by the telemetry (token-refresh deduplication, retry delays, parallel loading). Those are follow-up plans once the data exists.
- Crash reporting for native crashes (JavaScript errors only).
- Deploying or building. `Deploy to Alpha`, `New Dev Build` and `New Alpha Build` are separate direct commands and each needs its own explicit request.

## 7. Confirmed Facts

- Package versions checked in the npm registry on 2026-11-16: `@microsoft/applicationinsights-react-native` 4.4.2 (modified 2026-11-10), `@microsoft/applicationinsights-web` 3.4.6 (modified 2026-11-13), `react-native-device-info` 15.0.2 (modified 2026-02-21).
- `@microsoft/applicationinsights-react-native` 4.4.2 declares peer dependencies `tslib`, `react-native` and `react-native-device-info >= 5.2.1`. `react-native-device-info` is a native module.
- `mobile/package.json` already contains `expo-crypto ~58.0.8` (random bytes for trace IDs) and `expo-secure-store`. Expo SDK 58, React Native 0.88.1, React 19.3.0.
- Android project `mobile/android/` is gitignored; the native layer is generated by EAS or prebuild.
- Alpha Application Insights resource: `DisableIpMasking` not set, `SamplingPercentage` not set, `publicNetworkAccessForIngestion` Enabled.
- The privacy policy `docs/legal/datenschutzerklaerung-alpha.md` (Stand 2026-10-23) names "Betriebsprotokolle: Application Insights, 30 Tage" and states that operating and error logs are not deleted individually.

## 8. Assumptions and Open Questions

Each item is unverified and is resolved by WP-FE-01 unless noted.

- **Assumption A1:** The React Native plugin or the Web SDK offers options to avoid a persistent device identifier and to avoid cookie and storage use. Registry README text was not retrievable on 2026-11-16, so option names are not stated here. AC-6 defines the required outcome; the spike reports the actual options.
- **Assumption A2:** The Web SDK runs under Hermes in React Native 0.88 with the New Architecture without shims beyond the plugin. If not, fall back to Option B.
- **Assumption A3:** `react-native-device-info` 15.0.2 builds with Expo SDK 58 and passes `npx expo install --check` and `smoke:doctor`. It may need an entry in `expo.doctor.reactNativeDirectoryCheck.exclude`.
- **Assumption A4:** The Azure Functions host sets the request operation ID from an incoming `traceparent` header. Verified only after deployment (WP-INFRA-03); fallback is a custom dimension `trace_id` on the client record and a join on that value.
- **Assumption A5:** The ingestion endpoint for a connection string of a `germanywestcentral` resource is regional (EU). The connection string lists the endpoint; the spike records it so the policy statement "Azure-Dienste in Europa" can be confirmed.
- **Open question OQ1 (legal):** Legal basis for device telemetry and whether any consent step is required. Not decided here (PO-4).
- **Open question OQ2:** Whether the Application Insights IP-derived coarse location is acceptable. Default masking stores no full client IP in the telemetry record; coarse geography may still be derived.

## 9. Existing Components to Reuse

- `mobile/src/shared/api/client.ts` (request and response interceptors) as the single place for API timings, retry counts and traceparent.
- `mobile/src/services/authService.ts` `refreshAccessToken()` for the refresh duration.
- `mobile/src/app/ErrorBoundary.tsx` as the JavaScript error hook.
- `expo-crypto` for random trace and span IDs.
- EAS environment variables and `mobile/eas.json` build profiles (`development`, `preview`).
- Backend structured logging and the KQL conventions in `docs/kb/tech/02-backend.md`.

## 10. Proposed Technical Solution

**Packages** (latest stable as verified on 2026-11-16, re-verify before installing): `@microsoft/applicationinsights-web@^3.4.6`, `@microsoft/applicationinsights-react-native@^4.4.2`, `react-native-device-info@^15.0.2`, and `tslib` if not already present. Install through `npx expo install` where the package is in the Expo registry, otherwise `npm install`; the Frontend agent reports which.

**Module layout** (new, small, UI-independent): `mobile/src/services/telemetry/`

- `telemetryClient.ts`: initialises the SDK once, lazily and without blocking first render. Reads `EXPO_PUBLIC_APPINSIGHTS_CONNECTION_STRING`; if absent, exports a no-op implementation. SDK auto-collection of requests, page views, performance and unload is disabled. No cookies, no web storage, no user ID, no auth context, in-memory buffer only. Every exported method is wrapped so it cannot throw.
- `routeTemplate.ts`: pure function turning a request URL into `METHOD /collection/{id}/action`. Query string removed; any path segment not in an explicit allowlist of literal action names (derived from `docs/kb/tech/09-api-reference.md`) collapses to `{id}`; date segments collapse to `{date}`. Unknown or unparsable URLs yield `unknown`.
- `traceContext.ts`: generates `traceparent` (`00-<32 hex>-<16 hex>-01`) from `expo-crypto` and the matching operation ID for the client record.
- `apiTelemetry.ts`: called from the existing interceptors; measures total duration across retries, attempt count and refresh duration, and emits one dependency record per logical request.
- `screenTelemetry.ts`: a thin hook or helper that records `screen.load` for the six screens.

**API client change** (`client.ts`): the request interceptor adds `traceparent` and starts a timer on the first attempt only (retries reuse the same logical request and increment the attempt count). The response and error paths finish the record. Retry delays stay in the total, because they are exactly the waiting time the user experiences. Behaviour of retries, 401 handling and quota handling must not change.

**Error hook** (`ErrorBoundary.tsx`): additionally records `error.name` and a stack truncated to a fixed length. The error message is excluded by design.

**Session:** a random ID created per app launch, held in memory only.

**Infrastructure:** `infra/modules/appinsights.bicep` gains `workspaceCapping.dailyQuotaGb` (value from PO-2). EAS environment variables for the `development` profile (pointing to `appi-fittrack-dev`) and the `preview` profile (pointing to `appi-fittrack-alpha`), created with the EAS CLI so the value never enters Git.

**Post-deploy KQL** (proposed; validates AC-9):

```kusto
let ClientCalls = dependencies
| where timestamp > ago(1d) and cloud_RoleName != "func-fittrack-alpha-wcobsd"
| project operation_Id, route = name, client_ms = duration / 1ms,
  attempts = toint(customDimensions.attempts),
  refresh_ms = toreal(customDimensions.token_refresh_ms);
requests
| where timestamp > ago(1d)
| join kind=inner ClientCalls on operation_Id
| extend server_ms = duration / 1ms
| summarize calls = count(),
  p50_client_ms = percentile(client_ms, 50), p95_client_ms = percentile(client_ms, 95),
  p50_server_ms = percentile(server_ms, 50), p95_server_ms = percentile(server_ms, 95),
  p95_gap_ms = percentile(client_ms - server_ms, 95)
  by route
| order by p95_gap_ms desc
```

The role-name filter and the `customDimensions` field names are proposals; the Frontend agent states the final names in its handoff and the query is corrected accordingly. Column name `route` avoids the reserved KQL word issue seen earlier with `first`.

## 11. Option B: Backend Relay (fallback, not the requested path)

The app collects the same measurements itself and sends them in batches to a new authenticated backend endpoint, which writes them with the existing `logEvent()` as structured traces. No new SDK, no native module, no connection string in the binary, schema fully allowlisted server-side, no device identifier possible. Disadvantages: new API contract and quota or rate limit, custom batching code, no automatic correlation (client IDs travel as fields), and no standard SDK tooling. Use it if the spike fails (A2, A3) or PO-1 is declined. Switching requires a revised plan; it is not implemented in this one.

## 12. Privacy Impact

Privacy Impact: Policy update proposed

Data flow: from the device directly to the Application Insights ingestion endpoint of `appi-fittrack-alpha` (Dev build: `appi-fittrack-dev`), stored in the linked Log Analytics workspace. Categories: HTTP method and route template (no IDs, no query), status or error class, durations, retry count, token-refresh yes/no and duration, screen name and load time, app version, build variant, OS version, a random in-memory per-launch session ID, JavaScript error name and truncated stack. No user ID, token, email, free text, health value or request or response content. The Azure ingestion service receives the device IP address as part of the connection; with default IP masking the telemetry record does not keep it (Assumption, confirm after deploy with a query on `client_IP`). Visible only to operators with access to the Azure resources. Retention equals the table retention (30 or 90 days, see PO-3). The data cannot be linked to an account, so per-user deletion is neither possible nor needed; this matches the existing policy sentence that operating logs are not deleted individually.

Policy sections affected: "Wo und womit werden die Daten verarbeitet?" (bullet Betriebsprotokolle), "Speicherdauer und Löschen". Not affected: "Welche Daten verarbeiten wir?", Health Connect, "Wer sieht meine Daten?". The deletion flow clears no new on-device data because nothing persistent is added.

Proposed text (German, requires PO-3 for the retention figure and PO-5 for approval; `Stand:` date is updated at that time):

> **Betriebsprotokolle:** Application Insights, N Tage. Dazu gehören technische Protokolle des Servers und anonyme Leistungs- und Fehlerdaten der App: welche Funktion aufgerufen wurde (ohne Inhalte und ohne Kennungen), wie lange sie gedauert hat, wie oft sie wiederholt werden musste, App- und Android-Version sowie technische Fehlernamen. Diese Daten enthalten keine Nutzer-ID, keine Anmelde-Tokens und keine eingegebenen Inhalte und werden nicht mit deinem Konto verknüpft.

Open questions: legal basis and any consent requirement (OQ1); coarse geography derived from IP (OQ2); N days (PO-3). The existing statement "30 Tage" may already be inaccurate for the live tables; per the privacy skill, a policy statement that is false is at least a finding, independent of this feature.

## 13. Backend Work Package

### WP-BE-01 — Knowledge Base and correlation documentation

Agent: Backend

Goal: After WP-INFRA-03 confirms correlation, document the client-to-server join in `docs/kb/tech/02-backend.md`: the confirmed field names, the final KQL, the diagnostic caveats, and that client records are anonymous. No runtime change. If WP-INFRA-03 shows correlation does not work (A4), document the `trace_id` fallback join instead.

Required Knowledge Base:
- docs/kb/tech/02-backend.md

Required Repository Context:
- backend/src/lib/http.ts
- docs/User Stories/plans/PLAN_Mobile-Application-Insights-Telemetrie.md (Section 10 query)

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-9
- AC-12

Dependencies:
- WP-INFRA-03 handoff

Expected Handoff:
- updated 02-backend.md section
- final KQL query verified by a read-only run against `appi-fittrack-alpha`

## 14. Frontend Work Packages

### WP-FE-01 — Feasibility spike

Agent: Frontend

Goal: Prove or disprove A1 to A3 with the smallest possible change, against `appi-fittrack-dev` only. Install the three packages, initialise the SDK with all automatic collection disabled, send one test dependency record and one exception record, and report. Runtime verification requires a `New Dev Build` that the user triggers; static checks (`smoke:bundle`, `smoke:manifest`, `smoke:doctor`, `npx expo install --check`) run in the agent's environment. The runtime part is `MANUAL VALIDATION REQUIRED` and is not claimed as verified until the user reports it. The spike is not merged as a product change unless it is also the base of WP-FE-02; the handoff states which.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md
- docs/kb/tech/01-system-overview.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/package.json
- mobile/app.config.js
- mobile/eas.json
- mobile/src/shared/api/client.ts
- mobile/src/app/ErrorBoundary.tsx

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-6
- AC-10
- AC-11

Dependencies:
- None

Expected Handoff:
- actual SDK and plugin options used to disable cookies, web storage, device ID and automatic tracking
- list of fields observed in the sent test records
- ingestion endpoint host region (A5)
- result of the static checks and bundle size delta
- go or no-go for Option A, with reasons
- `Mobile Build Impact` confirmation and whether a new Dev Build is required

### WP-FE-02 — Instrumentation

Agent: Frontend

Status: Blocked — pending PO-1 and PO-4

Goal: Implement the module layout and API-client change from Section 10, the six `screen.load` records, the `ErrorBoundary` hook and the session ID. Telemetry is disabled when the connection string is absent. All new logic is unit tested without the real SDK (the telemetry client is injected or mocked).

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
- mobile/src/modules/progress/ProgressScreen.tsx
- WP-FE-01 handoff

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-8
- AC-10
- AC-11

Dependencies:
- WP-FE-01 handoff with go decision
- WP-INFRA-02 (EAS variables exist)

Expected Handoff:
- final field and event names (name, customDimensions keys) for the KQL in Section 10
- actual data handling report for the privacy review: what is sent, what is stored on device, whether any identifier is included
- test results (mobile suite, typecheck, `smoke:bundle`)

### WP-FE-03 — Mobile Knowledge Base update

Agent: Frontend

Status: Blocked — pending WP-FE-02

Goal: Document the telemetry module, its data boundary, the disabled-when-unconfigured behaviour, the new environment variable and the API-client behaviour in `docs/kb/tech/03-mobile.md`. Correct the stale `reusableItemsApi.ts` duplicate in the typed-client list only if it is in the edited section.

Required Knowledge Base:
- docs/kb/tech/03-mobile.md

Required Repository Context:
- WP-FE-02 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-12

Dependencies:
- WP-FE-02

Expected Handoff:
- updated 03-mobile.md

### WP-FE-04 — Privacy policy update

Agent: Frontend

Status: Blocked — pending PO-3, PO-4 and PO-5 (explicit approval required for any edit under `docs/legal/`)

Goal: Apply the approved wording from Section 12 to `docs/legal/datenschutzerklaerung-alpha.md`, update the `Stand:` date, and change nothing else in the file.

Required Knowledge Base:
- docs/kb/tech/01-system-overview.md

Required Repository Context:
- docs/legal/datenschutzerklaerung-alpha.md

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-13

Dependencies:
- PO-3, PO-4, PO-5 resolved
- WP-FE-02 handoff (actual data handling)

Expected Handoff:
- policy diff limited to the approved sections

## 15. Infrastructure and Configuration

Both Development and Alpha are affected. No Cosmos change.

### WP-INFRA-01 — Ingestion cap and retention alignment

Agent: Infrastructure

Status: Blocked — pending PO-2 and PO-3

Goal: Add `workspaceCapping.dailyQuotaGb` to `infra/modules/appinsights.bicep` with the approved value, and apply the PO-3 outcome for table retention if tables are to be set to 30 days. Run `what-if` first; Delete or Recreate is a stop condition. Apply to Dev, then Alpha, then verify the live values (cap and per-table retention), not only the provisioning state. This is a Bicep change and therefore needs the Alpha deploy gate.

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
- AC-14

Dependencies:
- PO-2, PO-3

Expected Handoff:
- applied template diff and what-if result
- live cap and table retention values
- note that backend logs also stop when the cap is reached

### WP-INFRA-02 — EAS environment variables

Agent: Infrastructure

Status: Blocked — pending PO-1

Goal: Create `EXPO_PUBLIC_APPINSIGHTS_CONNECTION_STRING` as EAS environment variables for the `development` profile (Dev resource) and the `preview` profile (Alpha resource) using the EAS CLI, without writing the value into any file, log or chat. Report only the variable names and scopes. Retrieve the connection string with a read-only Azure command and pass it straight to the EAS CLI.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md

Required Repository Context:
- mobile/eas.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-7

Dependencies:
- PO-1

Expected Handoff:
- variable names and environments created
- confirmation that no file in the repository contains the value

### WP-INFRA-03 — Post-release verification

Agent: Infrastructure

Goal: After a separately approved `Deploy to Alpha` (only needed for WP-INFRA-01) and a separately approved `New Alpha Build`, verify with read-only queries on `appi-fittrack-alpha` that client records arrive, correlate with `requests` by operation ID, and contain no user data. This work package is not an approval to deploy or build.

Required Knowledge Base:
- docs/kb/tech/07-infrastructure.md
- docs/kb/tech/02-backend.md

Required Repository Context:
- scripts/release-alpha.ps1
- mobile/eas.json

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-9
- AC-15

Dependencies:
- WP-QA-01 with PASS
- explicit user commands for deploy and build
- MANUAL VALIDATION by the user: open the app and visit the six screens on the installed Preview build

Expected Handoff:
- query results as aggregate counts only (records per day, matched fraction, p50 and p95 client versus server)
- result of the `client_IP`, `customDimensions` and header-content checks
- whether A4 held or the fallback join is required

## 16. QA Work Package

### WP-QA-01 — Review before release

Agent: QA

Goal: Verify the implementation against all acceptance criteria that can be checked without deployment, and review the privacy handling against the declared data flow. QA does not own implementation.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/tech/03-mobile.md
- docs/kb/tech/02-backend.md

Required Repository Context:
- mobile/src/services/telemetry/
- mobile/src/shared/api/client.ts
- mobile/src/shared/api/client.test.ts
- mobile/src/app/ErrorBoundary.tsx
- docs/legal/datenschutzerklaerung-alpha.md
- WP-FE-01, WP-FE-02, WP-FE-03 handoffs

Required Skills:
- privacy-impact-review

Relevant Acceptance Criteria:
- AC-1 to AC-8
- AC-10 to AC-14

Dependencies:
- WP-FE-03
- WP-FE-04 when PO-5 is given, otherwise QA records the policy as an open finding

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking` classification
- explicit statement of what was verified only on mocks

## 17. Shared Package Changes

None.

## 18. Documentation Updates

- `docs/kb/tech/03-mobile.md`: telemetry module and data boundary (WP-FE-03).
- `docs/kb/tech/02-backend.md`: client-to-server join and caveats (WP-BE-01).
- `docs/kb/tech/07-infrastructure.md`: ingestion cap and, if changed, table retention (done by the Infrastructure agent with WP-INFRA-01).
- `docs/legal/datenschutzerklaerung-alpha.md`: only through WP-FE-04 after approval.
- Documentation work packages precede the QA work package so that QA can verify documentation accuracy.

## 19. Test Strategy

- Mobile unit tests (Vitest, SDK mocked): route templating including UUIDs, dates, barcodes and query strings; the allowlist behaviour for unknown segments; one record per logical request across retries with correct attempt count; refresh duration captured; `traceparent` format; no `Authorization` or body content in any record; telemetry disabled without the connection string; a throwing SDK does not affect the API call or the UI.
- Existing `client.test.ts` cases (401 refresh, retry delays, quota flag) must pass unchanged.
- Static checks: `npm run typecheck --workspace=mobile`, `npm test --workspace=mobile`, `smoke:bundle`, `smoke:manifest`, `smoke:doctor`, `node scripts/check-test-parity.mjs`, `node scripts/check-encoding.mjs`.
- No local Cosmos emulator is involved and no contract test is planned.
- Device behaviour (SDK under Hermes, records actually arriving, app start impact) is `MANUAL VALIDATION REQUIRED` and is verified in WP-INFRA-03, not by QA locally.

## 20. Acceptance Criteria

1. AC-1: A call through `apiClient` that succeeds on the first attempt produces exactly one client record with method, route template, status, total duration and `attempts = 1`.
2. AC-2: A GET that is retried twice produces exactly one record with `attempts = 3` whose duration includes both retry waits (at least 4,500 ms with the existing delays).
3. AC-3: A request that triggers a token refresh produces a record with the refresh duration; a request without refresh has none.
4. AC-4: For these inputs the route template output is exactly: `/api/weights/3f2a…` (UUID) gives `/api/weights/{id}`; `/api/diary/day/2026-11-16/meta` gives `/api/diary/day/{date}/meta`; `/api/food-search?query=banane` gives `/api/food-search` with no query; a barcode segment gives `{id}`; an unknown segment gives `{id}`.
5. AC-5: No telemetry record contains an `Authorization` value, a request or response body, a query string, a user ID, an email, or a concrete resource ID. A unit test inspects the serialised record for each of these.
6. AC-6: The spike handoff names the actual SDK options that disable automatic request tracking, cookies, web storage and device-identifier collection, and shows that the observed test record contains no persistent device identifier. If a persistent identifier cannot be avoided, WP-FE-01 reports `no-go` for Option A.
7. AC-7: With no `EXPO_PUBLIC_APPINSIGHTS_CONNECTION_STRING`, the app starts, all API calls work, and no telemetry code throws; a unit test covers this. No file in the repository contains a connection string (search for `InstrumentationKey=` and `IngestionEndpoint=` finds nothing).
8. AC-8: SDK initialisation does not delay the first render: initialisation runs after the root component mounts and its promise is not awaited by UI code. A unit test asserts that a telemetry failure does not change any API result.
9. AC-9: After release, a KQL query joining client records and `requests` by operation ID returns rows for at least the Diary, Weights and Food search routes for a test session on the Preview build, and the share of client records that find a matching server row is reported. If that share is below 90 %, the fallback join is documented and the criterion is met only when the fallback matches at least 90 %.
10. AC-10: The bundle size increase from the SDK is reported in the handoff (output of `smoke:bundle`); no existing smoke check regresses.
11. AC-11: Typecheck, the full mobile suite and the parity gate pass; no existing test is removed or weakened.
12. AC-12: `docs/kb/tech/03-mobile.md` and `docs/kb/tech/02-backend.md` describe the implemented behaviour, mark anything not yet deployed as `[Planned]`, and contain the final KQL.
13. AC-13: The policy change contains only the approved wording, the `Stand:` date is updated, and no other section differs.
14. AC-14: The live Log Analytics workspace shows the approved `dailyQuotaGb`; the live table retention matches the PO-3 outcome; `what-if` showed no Delete or Recreate.
15. AC-15: A query on `client_IP` for client records shows no full IP address, and `customDimensions` for a sample of client records contains no key outside the documented allowlist.

## 21. Risks and Edge Cases

- **SDK compatibility with RN 0.88, Hermes and the New Architecture (A2, A3).** Mitigation: WP-FE-01 as a gate, Option B as fallback.
- **Extra native module** (`react-native-device-info`) forces a new Dev Build and Preview Build and a maintenance dependency. `Mobile Build Impact: Potential Native Impact`; Infrastructure & Release makes the final `Dev Build Required` decision.
- **Telemetry distorts what it measures.** Mitigation: lazy initialisation, in-memory buffering, no awaiting; AC-8 and AC-10.
- **Ingestion abuse or cost** because the connection string sits in the binary. Mitigation: daily cap (PO-2), Alpha is distributed only to invited testers. Residual risk: a reached cap also silences backend logs. This is a trade-off the Product Owner accepts with PO-2.
- **Privacy:** route templates are only as good as the allowlist. A new endpoint with a new literal segment is shown as `{id}` until added, which is the safe direction. Error stacks may reveal code paths, not user data; messages are excluded.
- **Policy accuracy:** the live table retention (90 days) already differs from the policy (30 days). Fixed through PO-3, not by this feature.
- **Correlation may not hold** (A4). Fallback join on a custom dimension.
- **Retries inflate the user-visible total.** This is intended: the total includes retry waits because that is the waiting time; `attempts` lets analysis separate it.
- **Background and foreground sync calls** (`healthSyncService`, `nutritionSyncService`) also use `apiClient` and will appear in the data. They carry the same route templates; analysis may need to filter by screen context if they distort the numbers. A `source` property (`ui` or `sync`) is a small addition the Frontend agent may add if the spike shows a need; not required by the criteria.
- **Existing telemetry gap not solved here:** the backend does not record Cosmos call durations per request, so the server share is the handler duration only.

## 22. Recommended Execution Order

Sequential, one work package at a time:

1. Resolve PO-1 to PO-5 (PO-3 and PO-5 only gate the policy and infra retention work).
2. WP-FE-01 feasibility spike (Dev resource only). Go or no-go for Option A.
3. WP-INFRA-01 ingestion cap and retention (after PO-2 and PO-3). Infrastructure before code, because the cap should exist before any device sends data.
4. WP-INFRA-02 EAS environment variables (after PO-1).
5. WP-FE-02 instrumentation.
6. WP-FE-03 mobile Knowledge Base update.
7. WP-FE-04 privacy policy update (after PO-5; otherwise skipped and recorded as an open QA finding).
8. WP-QA-01 review. Documentation precedes QA so QA can verify it.
9. User commands, each separate: `Deploy to Alpha` (only if WP-INFRA-01 changed Bicep), `New Dev Build` as needed for the spike, `New Alpha Build` for the Preview build.
10. User opens the installed Preview app and visits the six screens (manual validation).
11. WP-INFRA-03 post-release verification.
12. WP-BE-01 documentation of the confirmed join.

Follow-up plans, once data exists and not part of this plan: token-refresh deduplication, retry-delay strategy, parallel screen loading, Always Ready decision, `getCosmos()` verification via `cosmos_init_ms`.
