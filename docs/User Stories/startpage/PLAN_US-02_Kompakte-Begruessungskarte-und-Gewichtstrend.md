# Technical Plan: US-02 Compact Greeting Card and Weight Trend

**Source story:** `docs/User Stories/startpage/US-02_Kompakte-Begruessungskarte-und-Gewichtstrend.md`  
**Status:** Approved for implementation — PO-1 resolved; no other open product decisions identified.  
Infrastructure Impact: None  
Mobile Build Impact: None

## Resolved Product Owner Decision

### PO-1 — Meaning of a small weekly change

**Decision:** APPROVED with adjustment, recorded 2026-10-14.

- Apply the neutral zone to the absolute raw weekly regression slope: `abs(slope) < 0.05 kg/week` displays `0,0 kg/Woche`.
- At `abs(slope) >= 0.05 kg/week`, display the actual signed slope rounded to one decimal with German decimal punctuation. At the boundary, `0.05` displays `0,1 kg/Woche` and `-0.05` displays `−0,1 kg/Woche`.
- Normalize rounded zero so `−0,0` is never displayed. Use a typographic minus for negative values and no red/green or direction-based styling.
- This rule affects only the numeric label. It must not clamp or otherwise change the raw regression slope, fitted values/endpoints, or plotted regression line.

**Resolution:** PO-1 is closed. No other unresolved product decisions or open questions are identified in the source story or current plan. The explicit implementation assumptions in Section 8 remain visible and do not block approval; FE-2 and QA no longer depend on a pending product answer.

## 1. Requirement Assessment

- **User problem:** The Home screen spends too much vertical space on the greeting/weight area and does not present a useful short-term trend beside daily calories.
- **Solution fit:** Reorganizing the existing Home cards and using a deterministic regression addresses the stated scanability and weight-trend needs. No AI, API, or persistence change is warranted.
- **Product alignment:** Reuses existing Home training selection, calorie ring, macro tracks, theme tokens, and weight history. The Home greeting card will contain only the greeting and training-day selector as required by AC-1; its current hint is therefore removed from that card and is not relocated by this story.
- **Domain validity:** Use date-only measurements and normalize every measurement to kg before regression and display. Do not apply goal-relative red/green judgments; the requested display is a descriptive trend, not coaching advice.
- **Classification:** Accept as proposed. PO-1 is resolved as recorded above; the remaining layout and technical work is sufficiently specified.
- **AI necessity:** None. Regression is deterministic and testable offline.

## 2. Feature Summary

Move the training-day selector to the right of a compact greeting. Move the current weight and a 14-calendar-day measurement/trend sparkline into the top area of `DayNutritionCard`, to the right of the calorie ring. Keep macro tracks below that area. Remove the previous-day weight comparison and all direction-based weight coloring.

## 3. Current Behaviour

- `HomeScreen` already loads the authenticated weight list through `listWeights()` on focus and refresh. Both in-memory and Cosmos repositories sort newest date and then newest `createdAt` first; `entries[0]` is the latest recorded measurement.
- `CoachingHeroCard` currently places greeting, hint, and training selector on the left. The right side displays the latest raw entry as kg, a colored comparison with the previous entry labelled `seit gestern`, and a sparkline of the last seven entries. Its x positions are based on entry index and its y bounds tightly fit the observed values. It does not calculate a regression.
- `DayNutritionCard` currently places the calorie ring and calorie totals in its top row, then renders four macro tracks for a non-empty day. Its no-intake branch omits macro tracks. It currently has no weight input.
- `ProgressScreen`'s `TrendStatsRow` uses `shared/lib/weightTrend.ts` for a 30-day linear regression. Backend Daily Insight also uses that shared 30-day result. The active Home hero does not use it. `WeightCoachCard` and `computeWeightTrend.ts` are a separate legacy path; that helper uses at most 14 entries, not 14 calendar days, and requires only three entries.
- The current `WeightChart` draws actual measurements and a trailing seven-measurement average, not the shared regression. Its bounds come from `computeChartBounds`; it snaps to 0.5 kg steps for small ranges and adds one step of padding. The chart reads `WeightEntry.value` directly, so mixed kg/lb entries are not normalized there.

**Knowledge Base divergence to correct:** `docs/kb/domain/05-weight-tracking.md` currently describes the mobile chart and Daily Insight as sharing the 30-day slope and says chart/progress data normalize to kg. The implementation instead has a seven-measurement average in `WeightChart`, a separate 30-day regression in `TrendStatsRow`/Daily Insight, and raw values in `WeightChart`. This plan does not expand scope to repair the existing Progress chart; the documentation update must describe current behavior accurately and document the new Home calculation.

## 4. Desired Behaviour

1. The greeting card is a short horizontal row: greeting on the left, existing day-type selector on the right. It has no hint, weight, comparison, or chart.
2. The calorie card's top region has the calorie ring and its existing calorie information on the left, a subtle divider, and current kg, sparkline, and weekly rate on the right. Existing calorie-target/over-target semantics remain unchanged.
3. The sparkline uses all measurements in the last 14 local calendar dates, with calendar-date spacing. It shows the actual measurement series and the regression line. It has no axes, labels, grid, or legend.
4. The weekly rate is the raw regression slope multiplied by seven, in kg/week. The approved PO-1 neutral zone affects only the numeric label; the plotted regression line remains the unmodified mathematical fit. Weight direction does not control text or line color.
5. Macro tracks remain below the top region in the existing populated state. The existing no-intake macro visibility behavior remains unchanged.

## 5. Scope

- Add an additive shared pure calculation for a caller-specified date-only window and its regression series, while preserving existing 30-day Progress/Daily Insight behavior.
- Restructure `CoachingHeroCard` and `DayNutritionCard`, reusing the existing Home data load, training selector, calorie calculations, macro rows, SVG dependency, and theme.
- Add or update focused shared and mobile tests.
- Update the relevant weight-tracking, mobile, and design-system Knowledge Base documents.

## 6. Out of Scope

- Backend HTTP/API, authentication, Cosmos schema, persistence, infrastructure, or AI changes.
- Changing the existing 30-day trend contract, Progress screen, `WeightChart`, plateau detection, or Daily Insight behavior.
- Adding a weight-entry action, navigation flow, trend assessment, goal comparison, or new dependency.
- Modifying the legacy `WeightCoachCard`/`computeWeightTrend.ts` path unless an implementation dependency is discovered and returned to the Orchestrator; it is not the active Home path.

## 7. Confirmed Facts

- `WeightEntry.date` is `YYYY-MM-DD`; units are stored per entry as kg or lbs; multiple measurements on one date are allowed.
- Home already fetches the full weight history, and the API response is newest-first by date and `createdAt`.
- `shared/lib/weightTrend.ts` owns the existing calendar-aware 30-day regression. Its existing callers must retain their current results.
- `getLocalDateContext()` supplies the local date-only reference, and shared date ordinals avoid DST-sensitive elapsed-time calculations.
- `react-native-svg` and theme tokens are already used by the Home calorie ring and weight chart.
- No third-party package or native configuration change is required.
- PO-1 is approved: `abs(raw weekly slope) < 0.05 kg/week` displays `0,0 kg/Woche`; otherwise display the actual signed slope rounded to one decimal. The threshold never changes the plotted regression line.

## 8. Assumptions and Open Questions

- **14-day boundary:** interpret “last 14 calendar days” as exactly 14 date keys, local today and the preceding 13 dates, inclusive. Exclude future-dated entries. This avoids the existing `<= days` helper's 15-date inclusive range at a `days = 14` difference.
- **Current weight:** display the newest measurement from the full history, even if it is older than the trend window; only the trend series is limited to 14 dates. Convert that entry to kg before display.
- **Measurement count:** count raw measurement entries toward the seven-measurement minimum. Keep multiple same-date entries as separate observations with the same x coordinate; if all included entries share one date, regression is undefined and no trend value/line is shown.
- **Insufficient history:** with no entry, do not invent a weight or trend. With one entry, show the current weight only; with two to six entries, show actual measurements where a line is possible but no regression line or trend value. A day with no calorie intake retains its existing macro-row behavior.
- **Resolved decision:** PO-1 is closed as recorded above. No other open product decision or question remains. The assumptions above are implementation interpretations retained from the current plan, not additional Product Owner decisions.

## 9. Existing Components to Reuse

- `HomeScreen` / `listWeights()` for existing focus and refresh loading; no duplicate request.
- `CoachingHeroCard`, `WorkoutTypePicker`, `HOME_TRAINING_PRESENTATION`, and `useDayTypeStore` for existing greeting/day-type behavior.
- `DayNutritionCard`'s calorie ring, target calculation, macro rows, and empty state.
- `shared/lib/weightTrend.ts` regression/date-ordinal implementation as the source for the new explicit window variant; preserve the existing 30-day API and classification.
- `mobile/src/shared/components/weightChartUtils.ts` `computeChartBounds()` for a padded, non-tight y scale; include actual and fitted kg values in the bounds and do not include a target weight.
- Existing `react-native-svg` and `mobile/src/app/theme/` tokens. Do not add fixed red/green trend colors or hardcoded palette values.

## 10. Proposed Technical Solution

### Shared calculation

Add a pure helper in `shared/lib/weightTrend.ts` that accepts weight entries, a validated `referenceDate` (`YYYY-MM-DD`), and an explicit calendar-window size. For this story the caller requests 14 dates. It returns the in-window measurements sorted chronologically and normalized to kg, the raw weekly regression slope in kg/week, and regression-line endpoints over the observed date span. Use date-only day ordinals for x values and the same least-squares calculation as the existing helper. Return no slope/line when there are fewer than two distinct measurement dates or the regression denominator is zero.

Keep `calculateWeightTrendPerWeek()` and its 30-day selection/output unchanged for current Progress and Daily Insight callers. The existing wildcard export from `shared/index.ts` already exposes additions from `weightTrend.ts`; verify this rather than adding duplicate exports.

### Home presentation

- In `HomeScreen`, stop passing `hint`, `latest`, `previous`, and `entries` to `CoachingHeroCard`; pass the loaded entries and the same local-date reference to `DayNutritionCard`.
- In `CoachingHeroCard`, retain the same selector callback and presentation catalog, but render the selector at the right. Remove the hint and all weight/delta/sparkline content.
- In `DayNutritionCard`, compose a responsive two-column top region. Preserve the ring's calorie math, calorie totals, activity bonus, and macro target semantics. Keep the weight region visible in the existing empty-calorie branch whenever the card itself is rendered.
- Convert the newest full-history entry from lbs to kg for the current-weight label. Build the sparkline from the helper's 14-day kg measurements, mapping x by calendar day rather than array index. Use the calculated regression line only when at least seven measurements are in the window and regression is defined.
- Use existing `computeChartBounds()` with both observed and fitted values. Actual measurements use a subdued theme/chart token; the regression line uses a stronger neutral token. Neither line changes color based on direction. Hide SVG decoration from accessibility and expose one German accessibility description with current kg and any available weekly trend.
- Format the weekly value with German decimal punctuation, one decimal, and `kg/Woche`: when `abs(rawWeeklySlope) < 0.05`, show neutral `0,0 kg/Woche`; at or above the cutoff, show the actual signed raw slope rounded to one decimal. Use a typographic minus for negative values and do not emit negative zero. The cutoff is presentation-only and must not flatten, clamp, or otherwise alter the plotted regression line or its fitted values.
- Keep the card flexible at narrow widths: preserve readable calorie and weight values, allow labels to wrap where needed, and keep macro tracks in their existing rows below the top region.

## 11. Backend Work Package

**Agent:** Backend  
**Goal:** Add and test the explicit-window shared regression-series helper without changing existing 30-day consumers; update the weight-tracking Knowledge Base contract.

**Required Knowledge Base:**
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/tech/04-shared-library.md`

**Required Repository Context:**
- `shared/lib/weightTrend.ts`
- `shared/lib/weightTrend.test.ts`
- `shared/types/weights.ts`
- `shared/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-4
- AC-5 (raw slope and unit contract only)
- AC-6 (regression-series contract)
- AC-8

**Dependencies:** None. The helper returns the raw regression result and is independent of the mobile display threshold.

**Expected Handoff:** Exported helper contract, raw kg/week slope and regression endpoints, boundary/unit/DST tests, proof existing 30-day tests remain unchanged, and updated `docs/kb/domain/05-weight-tracking.md`.

## 12. Frontend Work Package

**Agent:** Frontend  
**Goal:** Restructure the Home greeting and calorie cards and present the 14-day weight series without changing calorie, macro, or training-selection behavior.

### Subtask FE-1 — Card layout and trend-series integration

**Agent:** Frontend

**Goal:** Move the selector right, remove the old Home weight comparison, and integrate current kg plus the shared 14-day actual/regression series into the calorie card. Keep the shared slope and plotted series raw; provide one isolated presentation-policy point for FE-2 to apply the approved numeric display rule without changing the calculation or layout.

**Required Knowledge Base:**
- `docs/kb/product/03-design-system.md`
- `docs/kb/tech/03-mobile.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/CoachingHeroCard.tsx`
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/modules/home/DayNutritionCard.test.tsx`
- `mobile/src/modules/home/homeTrainingPresentation.ts`
- `mobile/src/shared/components/WeightChart.tsx`
- `mobile/src/shared/components/weightChartUtils.ts`
- `mobile/src/services/weightsService.ts`
- `mobile/src/app/theme/index.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-1
- AC-2
- AC-3
- AC-4
- AC-6
- AC-7
- AC-8
- AC-9
- AC-10

**Dependencies:** Backend work package handoff.

**Expected Handoff:** Updated Home components, tests for selection/layout/unit conversion/series states, and an isolated numeric trend-formatting policy point for FE-2; the chart consumes the unmodified regression series.

### Subtask FE-2 — Apply the approved small-change display rule

**Agent:** Frontend

**Goal:** Apply the approved absolute-rate threshold to the displayed value only: `abs(rawWeeklySlope) < 0.05 kg/week` displays `0,0 kg/Woche`; at or above the boundary display the actual signed slope rounded to one decimal with German decimal punctuation. Normalize rounded zero and use a typographic minus for negative values. Do not clamp the raw slope or flatten, alter, or suppress an otherwise eligible mathematical regression line because of this threshold.

**Required Knowledge Base:**
- `docs/kb/product/03-design-system.md`
- `docs/kb/domain/05-weight-tracking.md`

**Required Repository Context:**
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/modules/home/DayNutritionCard.test.tsx`
- `shared/lib/weightTrend.ts`

**Required Skills:** None

**Relevant Acceptance Criteria:**
- AC-5
- AC-6
- AC-8

**Dependencies:** FE-1; PO-1 is resolved and recorded in this plan.

**Expected Handoff:** Final numeric trend presentation matching PO-1, unchanged raw trend-line predictions, and focused tests below, at, and above the boundary for positive and negative slopes.

## 13. QA Work Package

**Agent:** QA  
**Goal:** Verify all acceptance criteria, shared regression compatibility, responsive card composition, and documentation accuracy after implementation.

**Required Knowledge Base:**
- `docs/kb/tech/08-testing.md`
- `docs/kb/domain/05-weight-tracking.md`
- `docs/kb/product/03-design-system.md`

**Required Repository Context:**
- `shared/lib/weightTrend.ts`
- `shared/lib/weightTrend.test.ts`
- `mobile/src/modules/home/HomeScreen.tsx`
- `mobile/src/modules/home/CoachingHeroCard.tsx`
- `mobile/src/modules/home/DayNutritionCard.tsx`
- `mobile/src/modules/home/DayNutritionCard.test.tsx`
- `mobile/src/shared/components/weightChartUtils.ts`
- `docs/kb/tech/03-mobile.md`

**Required Skills:** None

**Relevant Acceptance Criteria:** AC-1 through AC-10

**Dependencies:** Backend and Frontend work packages complete; Knowledge Base updates present. PO-1 is already resolved.

**Expected Handoff:** QA report at the path supplied by the Orchestrator, complete AC/evidence matrix, test command results, and any small-device or accessibility checks that remain manual/unverified.

## 14. Shared Package Changes

- Add only a pure calculation helper/result shape in `shared/lib/weightTrend.ts`; no persisted type or API contract change.
- Preserve the existing 30-day helper's window, units, classification threshold, and outputs for Progress and Daily Insight.
- Return raw kg/week slope and regression predictions; do not apply the Home display threshold in the shared calculation or alter its plotted line.
- Keep all date membership, kg conversion, regression slope, and line predictions deterministic and covered by `shared/lib/weightTrend.test.ts`.
- No Cosmos migration or backward-compatibility work is required.

## 15. Infrastructure and Configuration (Development + Alpha)

- **Infrastructure Impact:** None. No Azure resource, deployment, endpoint, or configuration change.
- **Mobile Build Impact:** None. JavaScript/TypeScript-only work; no native module, config plugin, or `app.config.js` change.
- Development and Alpha continue to use the existing weight API. No Infrastructure & Release work package is needed. Infrastructure & Release retains responsibility for any separate build/release decision.

## 16. Documentation Updates

- Backend work package updates `docs/kb/domain/05-weight-tracking.md` to distinguish the 14-day Home regression from the existing 30-day Progress/Daily Insight result, document the selected minimum-data and approved PO-1 numeric display rule (including that the regression line remains mathematical), and correct the current chart/helper description noted above.
- Frontend work package updates `docs/kb/tech/03-mobile.md` and `docs/kb/product/03-design-system.md` with the compact Home-card layout, selector placement, sparkline semantics, PO-1 numeric display rule, unchanged regression line, no-color rule, empty state, and macro placement.
- QA validates these documentation changes before its report.

## 17. Test Strategy

- **Shared unit tests:** exact 14-date lower/upper boundaries; exclude older and future dates; local-date/DST behavior; irregular measurement spacing; mixed kg/lbs converted to kg; repeated same-day values; fewer than two distinct dates; regression slope and endpoints; preserve existing 30-day regression/classification cases.
- **Mobile component tests:** greeting card contains only greeting and selector; selector callback remains functional; current weight converts mixed-unit latest entries to kg; actual and fitted lines use the same 14-day data; no previous-day comparison or sign-based color; fewer than seven measurements hides the trend number/line; test positive and negative slopes below, exactly at, and above `0.05 kg/week`, including German one-decimal formatting and negative-zero normalization; verify a below-threshold displayed `0,0 kg/Woche` does not change or flatten the plotted raw regression line; macro rows remain below the top area in the populated state; existing no-intake behavior remains intact.
- **Automated commands for implementation/QA:**
  - From `shared/`: `npx vitest run lib/weightTrend.test.ts` and `npx tsc --noEmit`.
  - From `mobile/`: `npx vitest run src/modules/home/DayNutritionCard.test.tsx` plus the new `CoachingHeroCard` test, then `npx tsc --noEmit`.
- **Manual visual/accessibility check:** verify at 320, 360, and 390 dp widths with typical and enlarged system text; confirm calorie details and weight units do not clip, graph remains legible without axes, macro tracks stay below, and TalkBack/VoiceOver reads the weight/trend as one meaningful value. Record unavailable device checks as unverified, not as a failed automated test.

## 18. Acceptance Criteria

1. The greeting card contains only the personal greeting and training-day selector; it contains no hint, current weight, day comparison, or chart.
2. The selector is on the right and opens the existing selection flow; rest/training changes continue to update the existing day-type state and workout selection.
3. The calorie card shows the latest recorded weight in kg, converting an lbs entry before display; calorie values and target semantics remain present.
4. The trend series contains only the 14 local calendar dates from reference date minus 13 days through reference date, and its least-squares x values represent calendar days. The raw slope is multiplied by seven and expressed in kg/week.
5. When at least seven in-window measurements and a defined regression are available, the displayed rate follows PO-1: if `abs(rawWeeklySlope) < 0.05 kg/week`, show neutral `0,0 kg/Woche`; if `abs(rawWeeklySlope) >= 0.05 kg/week`, show the actual signed slope rounded to one decimal with German decimal punctuation. At exactly `0.05`/`−0.05`, show `0,1`/`−0,1 kg/Woche`. Never display negative zero or use red/green directional judgment.
6. The sparkline draws actual measurements with a subdued line and the raw mathematical regression line more clearly; it has no axes, labels, grid, or legend. Calendar gaps affect x spacing, and y bounds use padded shared chart bounds containing both actual and fitted values. The PO-1 numeric threshold does not flatten, clamp, or otherwise alter the fitted line.
7. The previous-measurement/day comparison, arrow, and direction-based green/red styling are absent from the Home greeting and weight display.
8. With fewer than seven in-window measurements, no trend number or regression line is shown. The current weight remains visible when any history exists; a regression with no date variance also produces no trend.
9. In the populated calorie-card state, existing macro progress tracks remain below the combined calorie/weight region. Existing no-intake macro-row behavior is unchanged.
10. At 320, 360, and 390 dp, the greeting selector, calorie information, current weight, trend text, and macro rows remain legible and non-overlapping; accessibility exposes the current kg and available trend without making SVG parts separate actions.

## 19. Risks and Edge Cases

- A tiny dynamic y range would exaggerate day-to-day noise; use the existing padded chart-bounds helper and include fitted points in its input.
- Applying the `<0.05 kg/week` neutral zone to the regression itself would make the graph contradict the approved policy. Keep the raw calculation/line separate from value formatting and test that the displayed `0,0 kg/Woche` leaves eligible fitted points unchanged.
- Values at the exact `±0.05 kg/week` boundary are outside the neutral zone; test both signs so rounding and negative-zero handling remain consistent.
- A mixed-unit history must be normalized before both trend calculation and graph rendering; the existing Home hero currently prints raw values as kg.
- Multiple entries on one date count as measurements but share an x value. A series with no date variance cannot produce a regression even if it has seven entries.
- The newest full-history value can be older than 14 days. Preserve it as the latest recorded value while showing no 14-day trend if there are insufficient recent observations; do not label it as measured today.
- The current calorie card returns no card when the calorie target is absent. This story does not change profile/target loading or error behavior.
- Removing the Home hint is required by AC-1 even though it is currently shown in the hero; do not relocate it without a separate product request.
- Existing `WeightChart` unit normalization and Knowledge Base statements diverge. Correct the documentation and keep repair of the existing Progress chart out of this scope.

## 20. Recommended Execution Order

1. PO-1 is resolved as approved with adjustment; no other open product questions remain. This plan is approved for implementation.
2. Backend adds the raw explicit-window shared trend-series helper, its tests, and the weight-tracking Knowledge Base correction. Confirm existing 30-day tests remain green.
3. Frontend completes FE-1 using the shared handoff, updating Home card layout and tests.
4. Frontend completes FE-2 using the recorded PO-1 display rule, verifies the mathematical regression line is unchanged, and updates mobile/design documentation.
5. QA validates AC-1 through AC-10, documentation, automated checks, and small-device/accessibility results.