# QA Report: KI Meal Estimate Progress Contract

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/PLAN_US_KI-Mahlzeitschaetzung-Wartelayer-Progressvertrag.md`
- Verdict: `PASS`

## Scope

Reviewed the approved plan against the WP-BE-01 and WP-FE-01 COMPLETE handoffs, the specified backend/mobile/shared implementation, focused tests, required Knowledge Base documents, and privacy handling. No production implementation was changed and no deployment was performed.

The plan's status and validation text still contains earlier statements that WP-FE-01 is incomplete and fresh approval is required. This review follows the current task instruction confirming approval of the revised plan and both completed handoffs. Separate worktree edits to `.github/instructions/backend.instructions.md` and `docs/kb/agents/02-agent-boundaries.md` concern Azure diagnostic permissions and are not part of the feature handoffs; they are excluded from this feature verdict.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `backend/src/functions/ai.ts` emits `photo_check.completed` only after `assessMealPhoto()` resolves; `backend/src/lib/openai.ts` constrains supported assessment values. `MealEstimateLoadingOverlay.tsx` labels the state “Foto geprüft” without claiming a positive match or photo use. Backend assessment-failure tests and `MealEstimateLoadingOverlay.test.tsx` cover the boundary. |
| AC-2 | PASS | The backend emits `estimate.started` immediately before the existing `estimateMeal()` call. The overlay starts its indeterminate sweep only for that event; it has no percentage value. Covered by the backend event-order test and overlay phase-transition tests. |
| AC-3 | PASS | `mobile/src/shared/api/aiApi.ts` uses the existing photo POST and unchanged multipart fields, adding the NDJSON `Accept` header, progress callback, and `AbortSignal` configuration. Backend validation, provider order/count, quota and preview construction remain on the existing path. Backend tests cover provider/quota behavior and JSON/no-photo compatibility; `aiApi.test.ts` checks the request fields and JSON path. |
| AC-4 | PASS | Assessment, provider, and validation failures produce terminal errors without a result or false completion; transport failure does not fabricate a phase. Auth and quota checks occur before streaming and retain ordinary HTTP responses. `AISubFlow.tsx` aborts on close/unmount and gates progress/result/error/finally updates on the request signal/current controller. Covered by `ai.test.ts`, `aiApi.test.ts`, and the focused caller test. |
| AC-5 | PASS | `createAiMealEstimateProgressParser()` handles cumulative split response text and multiple records, and suppresses phases when result/error is already buffered. `aiApi.test.ts` covers partial, combined, fully buffered result/error, final result and JSON/no-photo behavior; `MealEstimateLoadingOverlay.test.tsx` covers indeterminate, checked, and estimate states. |
| AC-6 | PASS | Device-independent tests and mobile typecheck passed below. WP-BE-01 handoff records a successful authenticated synthetic local Functions-host check on Node 24.22.1 / Core Tools 4.16.0, returning ordered events with read distribution `[2, 1]`; this proves local host framing only. RN/Axios live delivery remains a post-QA manual check, not a gate. |
| AC-7 | PASS | `docs/kb/tech/09-api-reference.md`, `docs/kb/tech/03-mobile.md`, `docs/kb/domain/07-ai-features.md`, and `docs/kb/product/05-ux-patterns.md` describe the confirmed API/UI behavior and buffering limit. The privacy policy remains unchanged. The new stream-error diagnostic contains only fixed event/stage/error-class metadata, not request text, image, assessment, user ID, or token; no new user-data flow or retention is introduced. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm.cmd exec --workspace=@fittrack/backend -- vitest run src/functions/ai.test.ts` | 0 | 1 file; 171 tests passed. |
| `npm.cmd test --workspace=@fittrack/backend` | 0 | 85 files; 2,802 tests passed. |
| `npm.cmd run build:verify --workspace=@fittrack/backend` | 0 | Backend build and registration verification passed. |
| `npm.cmd exec --workspace=@fittrack/mobile -- vitest run src/shared/api/aiApi.test.ts src/modules/nutrition/hub/MealEstimateLoadingOverlay.test.tsx src/modules/nutrition/nutritionDiaryMutationCallers.test.tsx` | 0 | 3 files; 45 tests passed. |
| `npm.cmd run typecheck --workspace=@fittrack/mobile` | 0 | Mobile TypeScript check passed. |
| `npm.cmd run typecheck` | 0 | Backend, shared, and mobile TypeScript checks passed. |
| WP-BE-01 handoff: authenticated synthetic local Functions-host check (Node 24.22.1, Core Tools 4.16.0) | 0 | HTTP 200 NDJSON; observed `photo_check.completed`, `estimate.started`, `result`; record reads split `[2, 1]`. Evidence was reviewed, not rerun in QA. |

## Verification Notes

- State: `MANUAL VALIDATION REQUIRED` and `UNVERIFIED`
- Reason: The plan reserves React Native/Axios partial-delivery verification for after QA on an Android Expo Dev Build. No device run is required for this verdict. The local Functions-host check does not establish RN/Axios partial delivery or Azure/Flex buffering.
- Manual action: After QA, run an authenticated photo estimate from an Android Expo Dev Build against the local Functions host. Before `photo_check.completed`, neither photo completion nor estimate animation should appear; after it, only “Foto geprüft” should appear; the estimate animation starts only after `estimate.started`. If phases arrive together with the result, the prior indeterminate wait must remain until the result, without replay. Close the flow during a request and confirm no later UI update; also check a no-photo request retains its existing behavior. Result: `NOT RUN - user validation after QA`.
- State: `UNVERIFIED`
- Reason: Azure/Flex buffering is post-release observation under the plan, not a QA gate. The under-100-ms overhead remains an unmeasured engineering estimate, not a benchmark or acceptance threshold.
- Result: No Flex pre-verification, Alpha deployment, performance benchmark, or prompt eval was run; none is required by this change's scope. No prompt or Structured Output schema changed.

## Findings

No actionable findings.