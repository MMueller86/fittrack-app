# Plan: Azure Functions Cold-Start-Telemetrie

Status: Revised Draft — requires fresh approval
Infrastructure Impact: Alpha
Mobile Build Impact: None

## 1. Requirement Assessment

**Accept with modification.** Add backend diagnostics to the existing structured Application Insights logs and use the existing unsampled HTTP request telemetry for a baseline. Do not change Always Ready yet: Alpha currently uses Flex Consumption with Always Ready 0, which provides the control condition needed to observe current behaviour before deciding whether a warm instance is worth its cost.

This plan covers implementation and pre-deployment QA only. After the change passes QA and is merged, deploying it to Alpha requires a separate, explicit `Deploy to Alpha` command. Approval of this revised plan is not deployment approval.

The first invocation in a worker process and the process uptime are diagnostic indicators, not proof or an exact measurement of Azure platform cold-start duration. Compare them with request and handler durations; do not label every first invocation as a confirmed cold start.

## 2. Feature Summary

Expose enough non-user-specific telemetry in Alpha Application Insights to compare requests handled shortly after a Node worker starts with requests handled by an older worker. Preserve the existing `withHandler()` and `logEvent()` path. No new telemetry service, package, endpoint, or mobile logging is required.

## 3. Current Behaviour

- HTTP handlers use `withHandler()` from `backend/src/lib/http.ts`.
- The wrapper emits structured `handler.start`, `handler.success`, and failure events. Terminal events include `duration_ms`.
- `backend/src/lib/log.ts` serializes structured events through `InvocationContext` logging.
- `backend/host.json` excludes `Request` telemetry from Application Insights sampling.
- Alpha is Flex Consumption FC1, Node 24, Maximum Instances 5, Always Ready 0. The Function App is connected to `appi-fittrack-alpha`.
- Current structured handler events do not include worker uptime or a per-worker first-invocation marker.

## 4. Desired Behaviour

For every invocation handled by `withHandler()`:

- Include `invocation_id` from the Functions invocation context.
- Include `worker_uptime_ms` from the Node process uptime.
- Include `worker_first_invocation`, true only for the first wrapped invocation observed by that worker process and false thereafter.
- Include the same process fields on the start and terminal handler events so they can be correlated with the request and its existing `duration_ms`.
- Retain Azure's request telemetry and its existing sampling exclusion.

The current `withHandler()` catch branch for profile-deletion conflicts returns HTTP 409 without a terminal event. Add a structured failure event for that path, preserving its response, so it also carries the invocation and worker fields.

The values must appear as structured fields in Application Insights traces. Request duration and handler duration remain distinct measurements. A short worker uptime plus a first invocation and elevated request latency is evidence consistent with cold-start impact, not a platform-provided cold-start guarantee.

## 5. Scope

- Backend instrumentation in the existing `withHandler()` / `logEvent()` path.
- Focused backend tests for the emitted fields and first-invocation state transition.
- Update the backend logging documentation with the new fields, diagnostic caveat, and post-deployment KQL query.
- Complete pre-deployment QA for the code, tests, documentation, and privacy boundary.
- After a later, separately approved Alpha deployment, verify the emitted trace and request records in Alpha Application Insights.

## 6. Out of Scope

- Changing Flex plan, Maximum Instances, Always Ready, memory, or any other Bicep/App Setting.
- Deploying the change to Alpha as part of this plan. The later deployment is a direct operational `Deploy to Alpha` command, gated by QA `PASS`, merge, and a fresh explicit user request.
- Mobile-side duration logging or transmitting mobile telemetry.
- Claiming an exact cold-start duration from process uptime or handler duration.
- Logging user IDs, JWT claims, request bodies, headers, query strings, or free text.
- Changing Application Insights retention or sampling policy.

## 7. Confirmed Facts

- `backend/src/lib/http.ts` already centralizes HTTP handler lifecycle logs and receives `InvocationContext`.
- `backend/src/lib/log.ts` is the established structured logger.
- `backend/host.json` excludes request telemetry from sampling.
- The current Alpha Function App is connected to `appi-fittrack-alpha`; its configured baseline is Always Ready 0.
- The Alpha privacy policy describes Application Insights operating logs with 30-day retention.

## 8. Assumptions and Open Questions

- **Assumption:** the operator can query `AppRequests` and `AppTraces` for `appi-fittrack-alpha` after deployment.
- The first-invocation marker is scoped to the Node worker process that loads the shared HTTP wrapper. Azure may create or recycle workers independently; this marker is an observable proxy, not an Azure cold-start event.
- KQL correlation should use Application Insights `OperationId`; `invocation_id` is an additional diagnostic field, not a substitute for platform correlation.
- If client-perceived latency must later include the device-to-Azure network path, a separate mobile measurement would be needed. It is not part of this backend logging change.

## 9. Existing Components to Reuse

- `backend/src/lib/http.ts`: common lifecycle and duration instrumentation.
- `backend/src/lib/log.ts`: structured log event serialization.
- Application Insights request telemetry and `backend/host.json` sampling settings.

## 10. Proposed Technical Solution

1. Capture process uptime and a process-scoped first-invocation state in the existing wrapper path. Add `worker_uptime_ms`, `worker_first_invocation`, and `invocation_id` to `handler.start` and its corresponding terminal event, including `handler.unauthorized` and the profile-deletion HTTP 409 path.
2. Keep the fields scalar and bounded. Do not add process identifiers unless the implementation demonstrates that existing `OperationId` and platform instance dimensions are insufficient.
3. Keep `Request` excluded from sampling. Do not add an Application Insights SDK or duplicate request telemetry.
4. Update `docs/kb/tech/02-backend.md` to document the new structured fields, their use, the limitation that they indicate a possible cold-start condition rather than proving one, and the post-deployment KQL query below.
5. Use a query equivalent to the following in the Alpha Application Insights Logs view; adjust only if the workspace exposes different table/column names:

```kusto
let starts = AppTraces
| where TimeGenerated > ago(7d)
| extend eventData = parse_json(Message)
| where tostring(eventData.event) == "handler.start"
| project OperationId,
          handler = tostring(eventData.handler),
          worker_first_invocation = tobool(eventData.worker_first_invocation),
          worker_uptime_ms = tolong(eventData.worker_uptime_ms);
let durations = AppTraces
| where TimeGenerated > ago(7d)
| extend eventData = parse_json(Message)
| where tostring(eventData.event) in ("handler.success", "handler.response.failure", "handler.unauthorized", "handler.error")
| summarize handler_duration_ms = max(tolong(eventData.duration_ms)) by OperationId;
AppRequests
| where TimeGenerated > ago(7d)
| join kind=leftouter starts on OperationId
| join kind=leftouter durations on OperationId
| summarize requests = count(),
            request_p50_ms = percentile(DurationMs, 50),
            request_p95_ms = percentile(DurationMs, 95),
            request_p99_ms = percentile(DurationMs, 99),
            handler_p50_ms = percentile(handler_duration_ms, 50),
            worker_uptime_p50_ms = percentile(worker_uptime_ms, 50)
  by handler, worker_first_invocation
| order by request_p95_ms desc
```

Compare first and subsequent invocations over the same period and by handler. A large request-duration increase with low handler duration on first invocations is consistent with startup/host overhead; elevated handler duration instead points to work inside FitTrack's handler path. Do not infer causation from a single request.

## 11. Backend Work Package

Agent: Backend

**Goal**

Add worker-age and first-invocation diagnostics to the existing structured HTTP lifecycle logs without changing endpoint behaviour or logging user data.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/01-system-overview.md`

**Required Repository Context:**
- `backend/src/lib/http.ts`
- `backend/src/lib/log.ts`
- `backend/src/lib/http.test.ts`
- `backend/host.json`
- `docs/kb/tech/02-backend.md`

**Required Skills:**
- `privacy-impact-review`

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6

**Dependencies:** None.

**Expected Handoff:**
- Backend implementation and focused test results.
- Confirmation of the exact emitted field names and that no user data or request content was added.
- Updated backend logging documentation.

## 12. Post-Plan Operational Follow-Up

This is not a work package in the current plan and is not included in this plan's approval. After implementation has passed QA with `PASS` and has been merged, the user may separately issue the direct operational command `Deploy to Alpha`. The Infrastructure & Release agent then uses the established release workflow; no Bicep apply or EAS build is expected for this change.

As part of that direct command's release verification, confirm the normal Function App health checks and query `appi-fittrack-alpha` for the new `AppTraces` fields and corresponding `AppRequests`. Run repeated requests to `/api/health`; report telemetry field visibility and any lack of observed worker-lifetime variation separately. Do not change Always Ready. The live Alpha check is deliberately not a QA subtask or acceptance gate in this plan because it can only run after deployment.

## 13. QA Work Package

Agent: QA

**Goal**

Review the completed implementation, tests, documentation, and privacy boundary before merge. QA validates only pre-deployment criteria; it does not deploy to Alpha or require live Alpha telemetry.

**Required Knowledge Base:**
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/08-testing.md`

**Required Repository Context:**
- `backend/src/lib/http.ts`
- `backend/src/lib/log.ts`
- `backend/src/lib/http.test.ts`
- `backend/host.json`
- `docs/kb/tech/02-backend.md`
- `docs/legal/datenschutzerklaerung-alpha.md`

**Required Skills:**
- `privacy-impact-review`

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6

**Dependencies:** Backend handoff.

**Expected Handoff:**
- QA report at `docs/qa/reports/PLAN_Azure-Functions-Cold-Start-Telemetrie.md` with criteria matrix, commands, results, and one verdict.
- Explicit QA `PASS` is the plan's pre-merge gate. It is necessary, but not sufficient, for a later Alpha deployment; the separate deploy gate still requires a direct user request.

## 14. Privacy Impact

Privacy Impact: Policy covered
Data flow: Function worker uptime, first-invocation boolean, handler/method, invocation correlation ID, and existing request/handler durations → Application Insights; existing 30-day operating-log retention; no user IDs, JWT claims, request content, or new visibility.
Policy sections affected: Wo und womit werden die Daten verarbeitet?; Speicherdauer und Löschen.
Proposed text: N/A. The policy already states that operating logs are held in Application Insights for 30 days.
Open questions: None for the planned fields. If implementation requires user identifiers or request content, stop and return for a revised privacy assessment.

Required Skills: `privacy-impact-review` applies to Backend and both QA subtasks. No policy edit is planned.

## 15. Test Strategy

- Backend unit tests verify that invocation metadata is emitted on start and terminal events, process uptime is a non-negative number, and the first-invocation marker transitions from true to false within a worker process.
- Tests verify existing response status, duration, and handler behavior remain unchanged.
- Run `cd backend && npx vitest run` and `cd backend && npm run build:verify`.
- Pre-deployment QA verifies the implementation and documentation against all acceptance criteria. It does not query Alpha or gate on a deployment.
- After a later direct `Deploy to Alpha` command, Infrastructure & Release verifies health, field visibility in `AppTraces`, and corresponding `AppRequests`. Do not force a restart or change Always Ready. If no new worker lifetime occurs during the observation window, report the comparison as `MANUAL VALIDATION REQUIRED`, not as an implementation failure.

## 16. Acceptance Criteria

- **AC-1:** Every `withHandler()` invocation emits `worker_uptime_ms` as a non-negative number, `worker_first_invocation` as a boolean, and the current `invocation_id` on its start event and corresponding terminal event, including unauthorized and profile-deletion HTTP 409 responses.
- **AC-2:** Within one worker process, the first wrapped invocation is marked `worker_first_invocation: true`; later invocations in that process are marked false. The implementation does not use a fixed uptime threshold to claim a confirmed cold start.
- **AC-3:** The change adds no user ID, JWT claim, request body, header, query string, or free-text value to these diagnostics. Existing handler response and duration behaviour remains unchanged.
- **AC-4:** `Request` telemetry remains excluded from sampling, and tests/build pass. No new package, endpoint, Application Insights resource, or mobile code is added.
- **AC-5:** `docs/kb/tech/02-backend.md` documents the diagnostic fields, their interpretation as a possible cold-start indicator, and the limitation that they do not prove exact platform cold-start duration.
- **AC-6:** The backend logging documentation includes a KQL query that correlates request and handler telemetry by `OperationId` and groups request latency by `worker_first_invocation`. QA can verify the query and its documented purpose before deployment; live query results are verified only during a later, explicitly requested Alpha deployment.

## 17. Risks and Edge Cases

- A worker's first function invocation can be a health check or another route; use both the first-invocation flag and uptime, and inspect handler names.
- Scale-out can create multiple workers, each with its own first invocation. A first invocation is not necessarily a user-visible cold start.
- Application Insights table schemas may differ between the resource Logs view and a linked Log Analytics workspace; adapt table names while preserving the same fields and correlation.
- If request telemetry lacks a matching handler trace, retain the request row via a left join and report it rather than silently dropping it.
- Keeping Always Ready at 0 preserves the baseline and avoids changing recurring cost before evidence is collected.

## 18. Recommended Execution Order

1. Backend implements the structured fields, focused tests, backend documentation, and KQL query.
2. QA reviews all acceptance criteria and privacy boundaries after the Backend handoff. A QA `PASS` completes this plan's pre-deployment gate.
3. After the change is merged, Alpha deployment remains a separate direct operational command. It proceeds only when the user explicitly requests `Deploy to Alpha`; the plan approval does not authorize it. Infrastructure & Release performs the standard deployment and release verification, including telemetry visibility in Alpha Application Insights. No Bicep apply or EAS build is needed.
4. Use the post-deployment baseline to decide separately whether to trial one Always Ready HTTP instance; that decision is not part of this plan.