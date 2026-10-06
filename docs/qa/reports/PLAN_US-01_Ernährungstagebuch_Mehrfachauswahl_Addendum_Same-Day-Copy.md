# QA Report: US-01 Addendum - Copy from Yesterday to Today

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/startpage/PLAN_US-01_Ernährungstagebuch_Mehrfachauswahl_Addendum_Same-Day-Copy.md`
- Verdict: `PASS`

## Scope

Reviewed the focused Q4 picker flow: offering the local current date only when it differs from the source date, loading the selected target day, forwarding the selected references and one target through the existing copy flow, and preserving equal-date rejection. The original US-01 results other than the specifically included copy criterion remain closed and were not reopened. Same-day copy as a feature, same-day meal-ID policy, broader date-range changes, and Move/Delete behavior remain out of scope.

The F4 handoff reports no API, shared, backend, Cosmos, infrastructure, or Knowledge Base changes. The reviewed picker continues to use the existing DiaryScreen callback and bulk-copy request shape. The workspace contains other pending US-01 changes outside this addendum; they were not treated as F4 changes or modified for Q4. The required Knowledge Base documents describe copying to a different day and do not restrict targets to past dates; no documentation/API conflict was found.

## Acceptance Criteria

| ID | Acceptance Criterion | Result | Evidence |
|---|---|---|---|
| Original AC-7 | After successful copy source items remain unchanged and all copies are in exactly one target meal on the other day explicitly chosen by the user. | PASS | `CopyItemSheet.test.tsx` and `DiaryScreen.f2.test.tsx` verify all selected references go through one callback/request with one explicit target. The existing snapshot-copy unit case in `backend/src/functions/diary.test.ts` verifies the copy receives a new item ID in the selected target and the source meal remains unchanged. |
| AC-T-1 | If sourceDate is not the local current date, the copy date dialog shows an explicit selectable Today option with exactly the value from getLocalIsoDate(). | PASS | `CopyItemSheet.tsx` derives `today` from `getLocalIsoDate()` and renders the selectable option only when `today !== sourceDate`; `CopyItemSheet.test.tsx` selects it and verifies the exact local date is loaded. |
| AC-T-2 | For source yesterday and target today, choosing today loads today's diary. Selecting an existing or newly created target meal calls the existing copy callback exactly once with sourceDate=yesterday, targetDate=today, all selected item references, and exactly one target selector. | PASS | `CopyItemSheet.test.tsx` verifies today's diary load and one existing-meal callback with the exact target date and selector. `DiaryScreen.f2.test.tsx` verifies a two-item yesterday-to-today selection reaches the existing bulk endpoint once with both references and one target selector. The new-meal branch uses the same guarded callback with a single `newMealType` selector; its target-selection test also passes. |
| AC-T-3 | If sourceDate is already today, today is not offered as a selectable target; existing mobile and backend rejection of equal source/target dates remains. | PASS | `CopyItemSheet.test.tsx` verifies Today is absent when sourceDate is today. `CopyItemSheet.tsx` and `DiaryScreen.tsx` retain equal-date guards; `DiaryRepository.bulkCopyItems` rejects equal dates, and the existing backend handler unit test asserts HTTP 400 `invalid_diary_bulk_request`. |
| AC-T-4 | Existing date history, target-meal selection and success/error handling remain unchanged. No API route/request/response shape or backend behavior changes. | PASS | The 14-day past-date strip and past quick picks remain in `CopyItemSheet.tsx`; existing/new target selection and success/conflict handling are covered by the focused mobile tests. The screen sends the existing `bulkCopyItems` request unchanged. The F4 handoff reports no backend/API contract changes; current validation rejects only equal dates and imposes no current-date upper bound. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `npm --prefix mobile run test -- src/modules/nutrition/CopyItemSheet.test.tsx src/modules/nutrition/DiaryScreen.f2.test.tsx` | 0 | 2 test files passed; 19 tests passed. |
| `npm --prefix mobile run typecheck` | 0 | TypeScript check passed. |

Backend unit and Cosmos contract suites were not rerun: the approved follow-up does not change the backend/API contract, and the existing equal-date guard and unit assertion were inspected. Cosmos contract tests were not indicated by the approved scope.

## Verification Notes

No environment-limited checks remain. F4 did not report device/manual validation; device execution was not needed to verify these picker date, loading, callback-payload, and rejection criteria, which are covered by the focused component/screen tests and existing contract code.

## Findings

No actionable findings.