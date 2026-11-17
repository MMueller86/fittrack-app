# Plan: US-05 Trainingstag-Verknüpfung

Story: [US-05_Trainingstag-Verknuepfung.md](US-05_Trainingstag-Verknuepfung.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 1, 6)  
Infrastructure Impact: None  
Mobile Build Impact: None

Status: Ready for Orchestrator after Product Owner approval of the story and after US-03. Open Product Owner Decisions: none (PO-3, PO-H decided).

## 1. Requirement Assessment

**Accept as proposed.** No new backend work: the existing endpoint `PUT /api/diary/{date}/day-type` accepts `dayType` (`rest` or `training`) and `workoutType` (`gym`, `bouldering`, `running`, `cycling`, `other`, nullable) and already writes the calorie target snapshot per its documented rules. Health risk: the only effect is the existing Trainingstag target selection the user confirms explicitly with a visible hint; no new calorie rule is introduced.

Assumption to confirm in the implementation: how the effective target combines a Trainingstag with a Besondere Aktivität follows the existing day logic (`docs/kb/domain/01-nutrition-model.md`, `02-diary.md`); the story keeps special activities untouched. If QA finds that setting `training` on a day with a special activity changes the target in a way the existing manual Home toggle would not, report it to the Orchestrator as a plan question.

## 2. Current Behaviour

- `profileApi.setDayType(date, type, workoutType)` calls the day-type route; `useDayTypeStore.setDayType` only writes for today's date and offers `hydrateDayType(type, date, workoutType)` for local hydration.
- `GET /api/diary` returns `dayType` and `workoutType` as `null` when no `DayMeta` exists (`backend/src/functions/diary.ts`). The mobile diary API provides the diary read for a date.
- The finish sheet from US-03 has no day type area and exposes an extension point.

## 3. Desired Behaviour

As in the story. Decision function `resolveFinishDayAction(dayType, workoutType)` in `mobile/src/modules/training/session/finishDayAction.ts` (pure, tested):

| Input | Result |
|---|---|
| `dayType` null or `rest` | `{ kind: 'offer_set_training', defaultOn: true }` |
| `training` and `workoutType` null | `{ kind: 'offer_set_workout', defaultOn: true }` |
| `training` and `bouldering` | `{ kind: 'none' }` |
| `training` and other workout type `X` | `{ kind: 'choose_workout', existing: X, defaultChoice: X }` |

The day state for the session's `localDate` is read with the existing diary read for that date when the finish sheet opens; loading shows no day area (the sheet is usable immediately), failure hides it silently and the session can still be finished. On `Session beenden`: finish the session first; then apply the selected action with `profileApi.setDayType(localDate, 'training', 'bouldering')`; for today also call `hydrateDayType`. A failed day type write after a successful finish shows a snackbar `Tagestyp konnte nicht gesetzt werden` with `Erneut versuchen`. The component takes the date as a parameter so US-06 can reuse it for backfill.

## 4. Scope

Pure decision function, finish sheet day area, writing and hydration, snackbar retry, documentation.

## 5. Out of Scope

Backend changes, calorie calculation from sessions, multi-select workout types, Besondere Aktivität changes.

## 6. Existing Components to Reuse

`profileApi.setDayType`, `useDayTypeStore.hydrateDayType`, the diary API read, the finish sheet extension point (US-03), `ConfirmSheet` styling and snackbar.

## 7. Frontend Work Packages

### WP-FE-01 — Decision function and day area in the finish sheet

Agent: Frontend

Goal: Implement `finishDayAction.ts` and its tests (every row of the table, plus `training` with a null workout type and `rest` with a workout type present). Implement `FinishDayArea` (chip, single choice, nothing) and integrate it into the finish sheet, with loading, silent failure, the retry snackbar and the Home hydration for today's date. Component tests: each state, deselecting the chip makes no write, the write payload for each choice, finish succeeds when the day type write fails, special activity present does not change the rendering or issue any special activity request.

Required Knowledge Base:
- docs/kb/domain/02-diary.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/training/session/ (finish sheet, extension point)
- mobile/src/shared/api/profileApi.ts
- mobile/src/shared/api/diaryApi.ts
- mobile/src/modules/nutrition/useDayTypeStore.ts

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1 to AC-10

Dependencies:
- US-03 complete

Expected Handoff:
- component props (date as parameter)
- the exact API calls made per case

### WP-FE-02 — Documentation

Agent: Frontend

Goal: Update `docs/kb/domain/10-training-bouldering.md` (day type link rules and the table), `docs/kb/product/05-ux-patterns.md` (finish sheet) and `docs/kb/tech/03-mobile.md`.

Required Knowledge Base:
- docs/kb/domain/10-training-bouldering.md

Required Repository Context:
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-11

Dependencies:
- WP-FE-01

Expected Handoff:
- changed KB files

## 8. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria. Check the open assumption in Section 1 against the existing target logic by reading the code and tests (no Cosmos emulator). Manual validation stays open: finish a session on a device for each of the four states and check Home afterwards.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/domain/01-nutrition-model.md

Required Repository Context:
- mobile/src/modules/training/session/
- backend/src/functions/diary.ts
- all handoffs of this plan

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1 to AC-11

Dependencies:
- WP-FE-02

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 9. Test Strategy

Mobile unit tests for the pure function and component tests for the area; no backend change, so no backend tests; commands per epic Section 13.

## 10. Acceptance Criteria

1. `resolveFinishDayAction` returns exactly the results of the table in Section 3 for `(null, null)`, `('rest', null)`, `('rest', 'gym')`, `('training', null)`, `('training', 'bouldering')`, `('training', 'gym')` and `('training', 'running')`.
2. With a null or `rest` day type the finish sheet shows the chip `Heute als Trainingstag (Bouldern) eintragen` selected and the hint `Es gilt dein Trainingstag-Ziel.`; `Session beenden` calls `setDayType(localDate, 'training', 'bouldering')` once.
3. Deselecting the chip results in no `setDayType` call.
4. With `training` and no workout type the sheet shows `Als Bouldern eintragen` selected; confirming calls `setDayType(localDate, 'training', 'bouldering')`.
5. With `training` and `bouldering` the day area is not rendered and no `setDayType` call is made.
6. With `training` and `gym` the sheet shows the single choice `Welches Training gilt für heute?` with `Gym` selected and `Bouldern` as the other option; confirming without change makes no call; choosing `Bouldern` calls `setDayType(localDate, 'training', 'bouldering')`.
7. A special activity on the day does not change the rendered state and no special activity request is sent.
8. For the session date equal to today the Home store is hydrated with the new type and workout type so Home shows the change without restart; for other dates only the API call is made.
9. If the day type write fails the session remains finished and a snackbar with `Erneut versuchen` appears; retrying sends the same request again; if reading the day state fails, the day area is not rendered and the session can be finished.
10. No calorie value is computed or sent by the new code (no import of calorie calculators in the new files).
11. The Knowledge Base documents the table of states, the explicit confirmation and the absence of calorie effects.

## 11. Risks

- `useDayTypeStore` defaults to `rest` and cannot distinguish an explicit rest day from none; both are treated identically by decision, so no information is lost.
- A day with a Besondere Aktivität and a new Trainingstag may produce a target the user did not expect; the hint text states the effect and QA checks the assumption.
- The write happens after the session was finished; the retry snackbar covers failures but not an app kill between both calls.

## 12. Recommended Execution Order

1. WP-FE-01, 2. WP-FE-02, 3. WP-QA-01. Sequential.
