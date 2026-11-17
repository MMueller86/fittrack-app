# Plan: US-04 Training auf dem Homescreen

Story: [US-04_Home-Integration.md](US-04_Home-Integration.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 6, 7, 8)  
Infrastructure Impact: None  
Mobile Build Impact: None

Status: Ready for Orchestrator after Product Owner approval of the story. Execution order: after US-06 (epic Section 12), because the quick-start rule needs the history route `GET /boulder/sessions` to detect a session of today. PO-L is decided: the quick-start card appears only on a Bouldern training day without a session today.

## 1. Requirement Assessment

**Accept as proposed.** Home stays a read-mostly overview; the new card is one compact slot. Cross-feature impact: Home gains a request on every focus (`GET /boulder/sessions/active`) and a possible start action. Mitigation: the request must not delay the other cards, failure is silent.

## 2. Current Behaviour

`HomeScreen.tsx` renders `CoachingHeroCard`, `DayNutritionCard`, `WeeklyReviewCard` and the activity section in this order; data is loaded in `homeDataLoader.ts` on focus (`useFocusEffect`). Layout rules for card margins are tested in `HomeScreen.layout.test.ts` and documented in `docs/kb/product/03-design-system.md` (Kartenbreite und Außenabstände). Session functions exist from US-03 (`useBoulderSessionStore`, `boulderApi`).

## 3. Desired Behaviour

As in the story. Technical decisions:

- New component `TrainingSessionCard` with two variants (running, quick start) under `mobile/src/modules/home/`, placed directly after `CoachingHeroCard`.
- Data comes from `useBoulderSessionStore.loadActive()`, `recent-gyms` (first entry), `useDayTypeStore` (`dayType`, `workoutType`, `dayTypeDate`, already hydrated by Home) and `GET /boulder/sessions?limit=1` (newest finished session; a session exists today when its `localDate` equals the local date today). Quick start is shown only when no session is active, `dayTypeDate` is today, `dayType === 'training'`, `workoutType === 'bouldering'` and no session exists today. The requests start on Home focus, run in parallel with the existing loader and never block it; loading and error render nothing.
- Quick start uses `startSession(gymId)` from the store; without a recent gym the button reads `Halle wählen`, opens `GymPickerScreen` in `select` mode and starts after the selection; on `409` the running variant appears instead; after success navigate to the Training tab session screen (`navigation.navigate('Training', { screen: 'BoulderSession' })`; route names as delivered by US-03).
- Forgotten-session prompt: component `ForgottenSessionSheet` using the existing sheet pattern. Evaluated on Home focus, Training hub focus and `AppState` change to `active`. It uses `isForgottenSession` and `suggestEndedAt` from `@fittrack/shared`. `Fortsetzen` sets an in-memory flag that is cleared on the next `AppState` change to `active`. `Beenden` calls `finish` with `endedAt = suggestEndedAt(...)`; `Verwerfen` uses the existing discard action with a `ConfirmSheet`.
- The prompt never appears while the capture screen is focused.

## 4. Scope

Home card, quick start, forgotten-session prompt, layout test, documentation.

## 5. Out of Scope

Backend changes (none needed), push notifications, a Home summary after a session.

## 6. Existing Components to Reuse

`CoachingHeroCard` neighbours and card DNA, `homeDataLoader.ts` and `HomeScreen.layout.test.ts`, `ConfirmSheet`, bottom sheets, `useBoulderSessionStore`.

## 7. Frontend Work Packages

### WP-FE-01 — Home card

Agent: Frontend

Goal: Implement `TrainingSessionCard` (running and quick-start variants) and integrate it into `HomeScreen.tsx` after `CoachingHeroCard` with the standard card margins (the layout owner for horizontal margins is decided once and tested). Quick start button starts the session; the text area is not interactive. Add or extend layout tests so the card edges equal the neighbours. Component tests for both variants, every condition of the quick-start rule, hidden states (loading, error), `409` resume, the `Halle wählen` path, navigation target.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/home/HomeScreen.tsx
- mobile/src/modules/home/HomeScreen.layout.test.ts
- mobile/src/modules/home/homeDataLoader.ts
- mobile/src/modules/training/ (store from US-03)

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5

Dependencies:
- US-03 and US-06 complete

Expected Handoff:
- component props and states
- how the request avoids blocking other cards

### WP-FE-02 — Forgotten-session prompt

Agent: Frontend

Goal: Implement `ForgottenSessionSheet` and its trigger logic (Home focus, Training hub focus, app foreground) with the in-memory snooze, and wire `Beenden` to `suggestEndedAt`. Tests with fake timers for the boundary (1 h 59 min 59 s no prompt, 2 h prompt), the three actions, the snooze reset on foreground, no prompt while the capture screen is focused, and no `Alert.alert`.

Required Knowledge Base:
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- shared/lib/boulderRules.ts
- mobile/src/modules/training/session/
- WP-FE-01 handoff

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-6
- AC-7
- AC-8

Dependencies:
- WP-FE-01

Expected Handoff:
- trigger points and snooze behaviour

### WP-FE-03 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/03-design-system.md` (training card in the Home layout section), `docs/kb/product/02-navigation.md` (Home to Training), `docs/kb/domain/10-training-bouldering.md` (forgotten-session rule, 2 hours) and `docs/kb/tech/03-mobile.md`.

Required Knowledge Base:
- docs/kb/product/03-design-system.md

Required Repository Context:
- WP-FE-01 and WP-FE-02 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-9

Dependencies:
- WP-FE-02

Expected Handoff:
- changed KB files

## 8. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria, that the existing Home tests and layout tests pass unchanged except for the added card, and that Home load behaviour is not degraded. Manual validation stays open: Home at 320 and 360 dp with font scale 1.3, app foreground and background sequence on a device, quick start with a poor connection.

Required Knowledge Base:
- docs/kb/tech/08-testing.md

Required Repository Context:
- mobile/src/modules/home/
- all handoffs of this plan

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1 to AC-9

Dependencies:
- WP-FE-03

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- list of open manual validations

## 9. Test Strategy

Mobile component, layout and timing tests; commands per epic Section 13; existing `HomeScreen.*` tests must stay green.

## 10. Acceptance Criteria

1. With an active session, Home renders `TrainingSessionCard` (running) directly after `CoachingHeroCard`, showing the elapsed minutes, the gym name and the number of entries; pressing it navigates to the capture screen of the Training tab.
2. With no active session, `dayTypeDate` equal to today, `dayType === 'training'`, `workoutType === 'bouldering'` and no finished session whose `localDate` is today, Home renders the quick-start variant `Bouldern starten · <gym name>` (first `recent-gyms` entry); pressing `Starten` calls the start function with that gym ID and navigates to the capture screen; pressing the card text does nothing.
3. When no recent gym exists the quick-start variant shows the button `Halle wählen`; it opens the gym picker in `select` mode and the session starts after the selection. In every other case (another or no day type, another workout type, a finished or backfilled session today, a day type for another date) no training card is rendered, one test per condition.
4. The card's left and right edges equal those of the neighbouring cards (`spacing.md`), asserted in the layout test; the other Home cards render without waiting for the training request (test with a pending request).
5. When the active-session request fails or is pending, no card and no error text are rendered and the rest of Home is unchanged.
6. A session whose last activity (`max(entry.updatedAt)`, or `startedAt` without entries) is 2 h or more ago triggers the prompt on Home focus, on Training hub focus and on `AppState` active; 1 h 59 min 59 s does not.
7. `Beenden` finishes the session with `endedAt = suggestEndedAt(...)`; `Verwerfen` asks for confirmation in a `ConfirmSheet` and then deletes the session; `Fortsetzen` closes the prompt and no prompt appears again until `AppState` becomes active again.
8. The prompt is rendered with the app's sheet or overlay components and `Alert.alert` is not called anywhere in the new code; it never appears while the capture screen is focused.
9. The Knowledge Base describes the Home training card, the navigation from Home to Training and the 2 hour rule.

## 11. Risks

- A request on every Home focus adds load; acceptable for one small call, watch in telemetry.
- Quick-start accidental taps create a session; discarding costs two taps.
- The Home screen is already dense; the quick-start card appears only on a Bouldern training day without a session (PO-L).

## 12. Recommended Execution Order

1. WP-FE-01, 2. WP-FE-02, 3. WP-FE-03, 4. WP-QA-01. Sequential.
