# QA Report: Azure Functions Cold-Start-Telemetrie

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/plans/PLAN_Azure-Functions-Cold-Start-Telemetrie.md`
- Verdict: `PASS`

## Scope

Correction re-review of approved plan AC-1 through AC-6. Reviewed `backend/src/lib/http.ts`, `backend/src/lib/http.test.ts`, `backend/host.json`, `docs/kb/tech/02-backend.md`, `docs/legal/datenschutzerklaerung-alpha.md`, and the completed Backend handoff at `docs/handoffs/PLAN_Azure-Functions-Cold-Start-Telemetrie/01-backend.md`. This is pre-deployment QA; no Alpha deployment or live query was performed.

The re-review addresses finding `FT-QA-2026-164` / `COLDSTART-QA-001`. The handoff records that the KQL correction changed no runtime code. The current runtime diff is the approved implementation instrumentation; no runtime edit is attributed to the correction. The central findings register was not edited.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | MET | `backend/src/lib/http.ts` captures one metadata object and includes it on `handler.start` and all terminal paths, including unauthorized and profile-deletion 409 responses. `backend/src/lib/http.test.ts` covers field types/values and start/terminal events for success, 401, and 409; the recorded focused suite passed (17 tests). |
| AC-2 | MET | `backend/src/lib/http.ts` uses process-scoped `hasSeenWrappedInvocation`, marking only the first wrapped invocation true; there is no uptime threshold. The recorded lifecycle tests passed. |
| AC-3 | MET | The added diagnostics are the bounded uptime, first-invocation boolean, and Functions invocation ID. Tests check that body, authorization header, query values, and a user ID are not added. Existing exception logging fields are unchanged; response status/body and duration behavior remain unchanged. The privacy review confirms the plan data flow matches the handoff and implementation; the policy already describes Application Insights operating logs and 30-day retention, so no policy edit is needed. |
| AC-4 | MET | `backend/host.json` continues to exclude `Request` telemetry from sampling. The handoff and reviewed worktree scope show no new package, endpoint, Application Insights resource, or mobile code. Previously recorded backend tests and build verification passed. |
| AC-5 | MET | `docs/kb/tech/02-backend.md` documents `worker_uptime_ms`, `worker_first_invocation`, and `invocation_id`, describes them as possible cold-start indicators, and states they do not prove exact platform cold-start duration. |
| AC-6 | MET | The corrected KQL correlates by `operation_Id`, begins with `requests` as the retained outer input, uses `join kind=leftouter`, exposes unmatched requests under `<unmatched handler.start>` with a null marker, and groups latency by both `handler` and `worker_first_invocation`. The focused assertions below passed; no handlers are pooled and no unmatched requests are silently dropped. |

## Tests

Focused correction assertion, run from the workspace root:

```powershell
$d=Get-Content 'docs/kb/tech/02-backend.md' -Raw; $k=[regex]::Match($d,'(?s)```kusto\s*(.*?)\s*```').Groups[1].Value; $a=[regex]::IsMatch($k,'(?is)requests\s*\|.*?join\s+kind\s*=\s*leftouter\s+HandlerStarts\s+on\s+operation_Id'); $b=$k.Contains('<unmatched handler.start>'); $c=[regex]::IsMatch($k,'(?is)by\s+handler\s*,\s*worker_first_invocation'); $e=-not [regex]::IsMatch($k,'(?i)join\s+kind\s*=\s*inner'); Write-Output "requests_outer=$a unmatched_bucket=$b handler_grouping=$c no_inner=$e"; if(-not($a -and $b -and $c -and $e)){exit 1}; Write-Output 'EXIT_CODE=0'
```

Result: `requests_outer=True unmatched_bucket=True handler_grouping=True no_inner=True`; exit code `0`.

| Command | Exit code | Result |
|---|---:|---|
| `cd backend && npx vitest run src/lib/http.test.ts` | 0 (recorded) | 1 file, 17 tests passed; not rerun for this documentation-only correction. |
| `cd backend && npx vitest run` | 0 (recorded) | 85 files, 2,807 tests passed; not rerun for this documentation-only correction. |
| `cd backend && npm run typecheck:tests` | 0 (recorded) | Backend test type-check passed; not rerun for this documentation-only correction. |
| `cd backend && npm run build` | 0 (recorded) | Backend build passed; not rerun for this documentation-only correction. |
| `cd backend && npm run build:verify` | 0 (recorded in prior QA report) | Backend build verification passed; not rerun for this documentation-only correction. |

## Verification Notes

- State: `UNVERIFIED` (post-deployment operational check only; not an acceptance gate for this review)
- Reason: No Alpha deployment or live Application Insights query was run; both remain outside this pre-deployment work package.
- Manual action: Only after merge and a separate explicit `Deploy to Alpha` request, query `appi-fittrack-alpha` alongside repeated `/api/health` requests. Expected: structured traces expose the three diagnostic fields and request telemetry remains available for comparison. Result: `NOT RUN - deployment not authorized in this work package`.
- Cosmos contract tests: CI-only; not run locally.

## Findings

No actionable findings remain. The correction for `FT-QA-2026-164` / `COLDSTART-QA-001` is verified. No change to the central findings register was made.