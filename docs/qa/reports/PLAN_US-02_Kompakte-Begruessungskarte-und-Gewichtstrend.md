# QA Report: US-02 Compact Greeting Card and Weight Trend

- Format: `fittrack-qa-v1`
- Plan reference: `docs/User Stories/startpage/PLAN_US-02_Kompakte-Begruessungskarte-und-Gewichtstrend.md`
- Story reference: `docs/User Stories/startpage/US-02_Kompakte-Begruessungskarte-und-Gewichtstrend.md`
- Verdict: PASS

## Scope

Fresh independent review of the complete approved plan, original story, all ten acceptance criteria, Home/shared implementation, focused tests, and relevant Knowledge Base documentation. The prior frontend findings `FT-QA-2026-125` and `FT-QA-2026-126` were retested. Infrastructure was out of scope per the plan; no infrastructure work was reviewed or changed.

## Documentation Recheck

`FT-QA-2026-124` remains accurate for the corrected chart behavior. `docs/kb/domain/05-weight-tracking.md` distinguishes the Progress `WeightChart` measurement-count window, raw stored values and seven-measurement average from the separate shared 30-day regression used by `TrendStatsRow` and Daily Insight. Its numeric chart-bound steps and one-step padding match `mobile/src/shared/components/weightChartUtils.ts`; raw-value plotting and averaging match `mobile/src/shared/components/WeightChart.tsx`. `backend/src/lib/dailyInsightContext.ts` and `mobile/src/shared/components/TrendStatsRow.tsx` confirm the separate 30-day consumers. The new explicit-window helper and Home display behavior are consistent with `docs/kb/tech/04-shared-library.md`, `docs/kb/tech/03-mobile.md`, and `docs/kb/product/03-design-system.md`.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `mobile/src/modules/home/CoachingHeroCard.tsx` renders only greeting/name and selector. `CoachingHeroCard.test.tsx` checks the rendered content and absence of hint, weight, comparison, and SVG. |
| AC-2 | PASS | `HomeScreen.tsx` keeps the selector callback and maps selection to the existing rest/training `setDayType` calls. The focused card test invokes the selector callback. |
| AC-3 | PASS | `HomeScreen.tsx` passes the full `listWeights()` result; in-memory and Cosmos weight repositories sort newest date/`createdAt` first. `DayNutritionCard.tsx` converts the latest lbs entry to kg; its test verifies 150 lbs displays as 68,04 kg while calorie information remains present. |
| AC-4 | PASS | `shared/lib/weightTrend.ts` selects exactly the inclusive 14-date local window, excludes future dates, normalizes measurements to kg, and returns the raw kg/week slope. Shared tests cover boundaries, DST, mixed units, repeated dates, slope, and endpoints; the Home test checks calendar-day x spacing. Existing 30-day tests pass. |
| AC-5 | PASS | `formatWeeklyTrendLabel` emits no leading plus, uses `0,0 kg/Woche` below the absolute 0.05 threshold, and uses U+2212 for negative rates. Focused tests cover +/-0.049, +/-0.05, and +/-0.16; the boundary labels are `0,1 kg/Woche` and `−0,1 kg/Woche`. The label policy is separate from the raw shared regression endpoints consumed by the chart; the tests confirm eligible lines remain non-flat. |
| AC-6 | PASS | `DayNutritionCard.tsx` plots calendar-spaced actual measurements and raw fitted endpoints, passes both sets of kg values to `computeChartBounds`, uses subdued/stronger neutral theme tokens, and renders no axes, labels, grid, or legend. The SVG is hidden from accessibility. |
| AC-7 | PASS | The previous-measurement comparison, arrow, and directional red/green treatment are absent from `CoachingHeroCard.tsx` and `DayNutritionCard.tsx`; the greeting test checks that comparison content is absent. |
| AC-8 | PASS | The exact one-in-window test asserts current weight only with no sparkline, marker, or trend label. The zero-window test retains current full-history weight without a chart; the six-in-window test preserves actual measurements without trend/fit; a same-date case has no defined trend. |
| AC-9 | PASS | Focused tests verify macro tracks follow the populated calorie/weight overview and that the existing no-intake branch still omits macro rows. |
| AC-10 | PASS (automated assertions); UNVERIFIED (device visual/accessibility) | Tests cover stacked layout at 320/360 dp, side-by-side layout at 390 dp, macro ordering, the combined weight accessibility label, and hidden SVG descendants. Device text-fit and screen-reader behavior remain unverified as recorded below. |

## Tests

| Command | Exit code | Result |
|---|---:|---|
| `mobile/: npx vitest run src/modules/home/DayNutritionCard.test.tsx src/modules/home/CoachingHeroCard.test.tsx` | 0 | 32 tests passed across 2 files; includes the exact one-in-window case, zero-window and 2-6 cases, and trend-format boundaries. |
| `shared/: npx vitest run lib/weightTrend.test.ts` | 0 | 12 tests passed; includes explicit-window cases and existing 30-day regression/classification behavior. |
| `mobile/: npx vitest run --reporter=dot --silent` | 0 | 801 tests passed across 81 files. |
| `shared/: npx vitest run --reporter=dot --silent` | 0 | 466 tests passed across 10 files. |
| `mobile/: npx tsc --noEmit` | 0 | Type check passed. |
| `shared/: npx tsc --noEmit` | 0 | Type check passed. |

## Verification Notes

- State: `UNVERIFIED`
- Reason: `adb` is unavailable; no Android emulator or physical device could be inspected.
- Manual action: On a device/emulator, inspect 320, 360, and 390 dp widths with default and enlarged system text. Confirm greeting/selector, calorie values, weight/unit, trend text, and macro rows do not clip or overlap, and the sparkline remains legible. Result: `[ ]`.
- State: `MANUAL VALIDATION REQUIRED`
- Reason: TalkBack/VoiceOver was unavailable.
- Manual action: Focus the weight summary and confirm current kg plus any available trend is announced as one meaningful value, while SVG parts are not separate accessibility targets. Result: `[ ]`.

## Findings

No actionable findings.