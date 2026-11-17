# Plan: US-01 Training — Navigation und Hub

Story: [US-01_Training-Navigation-und-Hub.md](US-01_Training-Navigation-und-Hub.md)  
Shared contract: [PLAN_EPIC_Training_Bouldern.md](PLAN_EPIC_Training_Bouldern.md) (Sections 3 and 8)  
Infrastructure Impact: None  
Mobile Build Impact: None

Status: Ready for Orchestrator after Product Owner approval of the story. Open Product Owner Decisions: none (PO-A approved).

## 1. Requirement Assessment

**Accept as proposed.** Replaces the `Recipes` tab by `Training` and moves Recipes into the Nutrition tab. This changes a documented navigation decision (`docs/kb/product/02-navigation.md`), approved as PO-A on 2026-11-16. Cross-feature impact: Recipes lose one level of direct access (one extra tap); mitigated by the remembered segment and the existing FoodEntryHub entry points.

## 2. Current Behaviour

- `RootNavigator.tsx`: five tabs; `Recipes` tab hosts `RecipeStack` (`RecipeList`, `RecipeDetail`, `RecipeWizard`); `Nutrition` tab hosts `NutritionStack` (`DiaryMain`, `HikingInput`, `CyclingInput`).
- Recipe screens type their props with `RecipeStackParamList` (exported from `RootNavigator.tsx`) and are tested with mocked `navigation.navigate('RecipeDetail' | 'RecipeWizard', …)`.
- No other source file navigates to the route `Recipes` (searched `mobile/src`).
- `RecipeListScreen.tsx` and `EditItemSheet.tsx` already contain hand-written segmented-control styles; no shared component exists.
- `TabIcons.tsx` holds the SVG tab icons.

## 3. Desired Behaviour

As in the story. Technical constraints:

- Screen names and parameters of `RecipeList`, `RecipeDetail`, `RecipeWizard` stay unchanged, so recipe screens and their tests need no logic change.
- The segment is one shared component used on `DiaryMain` and `RecipeList`. Switching does not add history entries that make hardware Back leave the tab unexpectedly: Back from either segment root leaves to the previous tab behaviour of the tab navigator, as today.
- The last segment is persisted in AsyncStorage (key `nutrition.lastSegment`, values `diary` or `recipes`) and applied when the tab opens. Mechanism (initial route versus redirect) is left to the Frontend agent; it must not flash the wrong segment.

## 4. Scope

- Tab structure, `TrainingStack` with `TrainingHub`, `TrainingIcon`, segment component, persistence of the last segment, tests, documentation.

## 5. Out of Scope

- Any boulder, gym or session functionality (US-02 and later).
- Changing recipe features, the FoodEntryHub, or the weekly Home cards.

## 6. Existing Components to Reuse

`RootNavigator.tsx`, `TabIcons.tsx`, `RecipeListScreen.tsx` segmented styles, theme tokens in `mobile/src/app/theme/`, Card DNA, `AsyncStorage`.

## 7. Frontend Work Packages

### WP-FE-01 — Tab restructure and Training hub shell

Agent: Frontend

Goal: Replace the `Recipes` tab with a `Training` tab. Add `TrainingStack` (route `TrainingHub` as the only screen) in `RootNavigator.tsx`, `TrainingHubScreen` under `mobile/src/modules/training/hub/`, and `TrainingIcon` in `TabIcons.tsx`. Hub content: title `Training`, one card `Bouldern` with the text `Die Boulder-Erfassung folgt.` Move the three Recipe screens into `NutritionStack`; keep the exported type `RecipeStackParamList` valid for the existing screens (for example as an alias over the moved routes) so recipe screen tests stay valid. Remove the `Recipes` tab and `RecipesIcon` usage there; keep `RecipesIcon` if it is used elsewhere.

Required Knowledge Base:
- docs/kb/product/02-navigation.md
- docs/kb/product/03-design-system.md

Required Repository Context:
- mobile/src/app/navigation/RootNavigator.tsx
- mobile/src/assets/icons/TabIcons.tsx
- mobile/src/modules/recipes/RecipeListScreen.tsx

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-4
- AC-5
- AC-7
- AC-8
- AC-9

Dependencies:
- None

Expected Handoff:
- final route names and param types
- list of changed files
- confirmation that no other file navigated to `Recipes`

### WP-FE-02 — Nutrition segment control and remembered segment

Agent: Frontend

Goal: Create the segment component (`Tagebuch | Rezepte`, min 48 dp touch height, `surfaceMuted` track, `primarySoft` active) and render it at the top of `DiaryMain` and `RecipeList`. Persist and apply the last segment as described in Section 3. Add tests for the component, the persistence, and the switching behaviour.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/nutrition/DiaryScreen.tsx
- mobile/src/modules/recipes/RecipeListScreen.tsx
- mobile/src/modules/recipes/RecipeListScreen.test.tsx

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-3
- AC-4
- AC-5
- AC-6
- AC-8
- AC-9

Dependencies:
- WP-FE-01

Expected Handoff:
- segment component path and props
- storage key and values
- test list

### WP-FE-03 — Documentation

Agent: Frontend

Goal: Update `docs/kb/product/02-navigation.md` (structure tree, tab list, parameter types, the new decision with its reason and the "Neubewertung" note for the tab count) and `docs/kb/tech/03-mobile.md` (module `training`). Mark the Training hub as `[Planned]` for everything beyond the shell.

Required Knowledge Base:
- docs/kb/product/02-navigation.md
- docs/kb/tech/03-mobile.md

Required Repository Context:
- WP-FE-01 and WP-FE-02 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-10

Dependencies:
- WP-FE-02

Expected Handoff:
- changed KB files

## 8. QA Work Package

### WP-QA-01 — Review

Agent: QA

Goal: Verify all acceptance criteria and the unchanged recipe behaviour. Device checks are listed as `MANUAL VALIDATION REQUIRED`: Android hardware Back from `RecipeList`, from a recipe detail, and from the Training hub; tab bar at 320 and 360 dp; remembered segment after killing and reopening the app.

Required Knowledge Base:
- docs/kb/tech/08-testing.md
- docs/kb/product/02-navigation.md

Required Repository Context:
- mobile/src/app/navigation/RootNavigator.tsx
- WP-FE-01 to WP-FE-03 handoffs

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1 to AC-10

Dependencies:
- WP-FE-03

Expected Handoff:
- PASS or findings list with `Blocking` and `Non-blocking`
- explicit list of manual validations still open

## 9. Test Strategy

Mobile unit and component tests (Vitest): segment rendering and switching, persistence read and write with an in-memory storage mock, navigation structure test (tab names and order), all existing recipe tests. Commands: mobile typecheck and test, `smoke:bundle`, `node scripts/check-test-parity.mjs`, `node scripts/check-encoding.mjs`. No backend, no Cosmos.

## 10. Acceptance Criteria

1. The tab navigator registers exactly the routes `Home`, `Nutrition`, `Training`, `Weight`, `Profile` in this order; the labels are `Home`, `Ernährung`, `Training`, `Progress`, `Profil`.
2. No route named `Recipes` exists in the tab navigator and no tab label `Rezepte` is rendered.
3. `DiaryMain` and `RecipeList` each render the segment with the entries `Tagebuch` and `Rezepte`; the entry of the current screen has the active style and `accessibilityState.selected = true`.
4. Pressing `Rezepte` on `DiaryMain` shows `RecipeList`; pressing `Tagebuch` on `RecipeList` shows `DiaryMain`.
5. After selecting `Rezepte`, leaving the Nutrition tab and returning, `RecipeList` is shown; after selecting `Tagebuch`, `DiaryMain` is shown; with no stored value `DiaryMain` is shown.
6. From `RecipeList`, opening a recipe and pressing Back returns to `RecipeList`; `RecipeWizard` can be opened and left to `RecipeList`.
7. The Training tab renders `TrainingHub` with the text `Training` as title and a card containing `Bouldern` and `Die Boulder-Erfassung folgt.`.
8. New styles use only theme tokens (no hardcoded hex values or font sizes); segment touch targets are at least 48 dp high.
9. `npm test --workspace=mobile`, the mobile typecheck, `smoke:bundle` and the parity gate pass; no existing test was removed or weakened.
10. `02-navigation.md` shows five tabs including `Training`, states that Recipes are a Nutrition segment, and marks Training content beyond the shell as `[Planned]`.

## 11. Risks

- Hardware Back semantics differ between a stack inside a tab and a segment toggle; covered by manual validation.
- Moving screens between navigators can break `navigation.getParent()` or `navigate` calls in recipe tests; covered by AC-6 and AC-9.
- The hub shell is user-visible without function; recommend not releasing US-01 alone (release scope is a Product Owner decision).

## 12. Recommended Execution Order

1. WP-FE-01, 2. WP-FE-02, 3. WP-FE-03, 4. WP-QA-01. Sequential.
