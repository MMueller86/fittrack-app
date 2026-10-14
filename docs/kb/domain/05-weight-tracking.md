# Weight Tracking

## Weight Entry

`WeightEntry` (`shared/types/weights.ts`):

```ts
interface WeightEntry {
  id: string;         // UUID
  userId: string;
  date: string;       // ISO date (YYYY-MM-DD)
  value: number;      // numeric weight
  unit: 'kg' | 'lbs';
  createdAt: string;  // ISO timestamp
}
```

One entry per measurement. Multiple entries per day are allowed (no deduplication enforced).

## Units

The unit `'kg' | 'lbs'` is stored per entry. `WeightChart` plots each `WeightEntry.value` as stored and computes its moving average from those raw values; it does not normalize entries to kg. A series containing both units therefore mixes their numeric scales in the chart. The Progress trend row and Daily Insight use the separate shared regression described below.

## Weight Chart

`mobile/src/shared/components/WeightChart.tsx`

Renders using `react-native-svg` (Polyline, Path, Circle, LinearGradient).

Visual elements:
1. Gradient fill under the actual weight line
2. Solid 3px bright-green polyline (actual weights)
3. 3px dots at each measurement point
4. Dashed 2px overlay line (7-day moving average)
5. Horizontal dashed grid lines
6. Legend: "Actual" (solid) + "7-day avg" (dashed)

Data processing:
- Sorted chronologically by date, then keeps the last `windowDays` measurements (default 30); this is a measurement-count window, not a calendar-day filter
- Requires ≥2 entries to render (shows placeholder otherwise)
- Y-axis bounds: extrema include raw measurements, trailing averages, and the optional target. `computeChartBounds` selects steps documented as 0.5, 1, or 2 kg for numeric ranges ≤2, >2 and ≤10, or >10, respectively; it floors the minimum to a step boundary and subtracts one step, then ceils the maximum and adds one step. The chart passes raw values, so these numeric steps are applied without unit conversion. There is no 10% padding or 0.4 kg minimum-range rule.
- X-axis: first, middle, last entry dates (deduplicated)

### Seven-Measurement Moving Average

Trailing window: for each index `i`, average of values at `max(0, i-6)..i`. The initial values use a partial window until seven measurements are available. This is a measurement-count average, not an average over seven calendar days, despite the chart legend's "7-day avg" label.

### Explicit-Window Regression Series

`calculateWeightTrendRegressionSeries(entries, windowDays, now?)` builds a chronological series over exactly `windowDays` local calendar dates, including the local date of `now`. Future-dated entries are excluded. Each measurement is normalized to kg; `slopeKgPerWeek` is the raw linear-regression slope in kg/week, and `regressionLine.start` / `.end` are the fitted kg values at the first and last included measurement dates. The slope and line are `null` unless measurements span at least two distinct dates. The helper does not apply a display minimum or classify the direction; those presentation rules belong to its caller.

This explicit-window API is additive. Existing 30-day consumers continue to use `calculateWeightTrendPerWeek` and retain their current window and output-unit behavior.

## Plateau Detection

`shared/lib/plateauDetector.ts` — Single Source of Truth for plateau detection.

Algorithm: population standard deviation of weight values over a 28-day window.

Thresholds:
- `PLATEAU_STD_DEV_THRESHOLD_KG` = 0.4 kg — std dev below this = plateau
- `PLATEAU_MIN_MEASUREMENTS` = 6 — minimum measurements in window required
- `PLATEAU_WINDOW_DAYS` = 28 — lookback window
- `PLATEAU_BROKEN_MOVEMENT_KG` = 0.5 kg — minimum movement to consider plateau broken
- `PLATEAU_BROKEN_WINDOW_DAYS` = 7 — recent days for "plateau broken" classification

Output: `PlateauIntelligence` signal — one of: `active`, `broken`, `insufficient_data`

[Rule] This module is the Single Source of Truth. The mobile app's slope-based trend indicator answers "which direction?" — this module answers "has the user stopped moving at all?". These are different questions; both are needed.

## Progress Intelligence

`backend/src/lib/progressIntelligence.ts` — computes behavioural signals from raw weight data. Input to the daily AI insight.

Key signals:
- **Phase:** `gaining | losing | stable` over `PHASE_WINDOW_DAYS` (14 days), min 3 measurements
- **Progress value:** percentage toward goal weight (requires ≥4 weeks, ≥8 measurements)
- **Milestone:** significant weight threshold crossed in the past `MILESTONE_WINDOW_DAYS` (7 days), with `MILESTONE_LOCKOUT_DAYS` (14) between milestones
- **Monthly data points:** average weight per month, lookback 6 months, min 4 measurements/month
- **Plateau:** from `plateauDetector.ts`
- **Freshness signal:** suppresses signals when data is stale (< 60% of expected weekly measurements)

All thresholds are exported constants — easy to tune after launch.

## Outlier Detection

The daily insight weight context includes:
- `isOutlierPrevious` — previous weight is a statistical spike (> 1.5× std dev of 7-day window)
- `isOutlierLatest` — latest weight is a spike

[Rule] The Progress trend row and Daily Insight share `calculateWeightTrendPerWeek` from `shared/lib/weightTrend.ts`: a linear regression over the last 30 calendar days, projected to a weekly change and exposed in the Daily context as `weeklyTrend30d`. `WeightChart` does not use this regression; its dashed overlay is the seven-measurement moving average described above. The explicit-window series helper does not replace or change this 30-day contract. When `isOutlierPrevious` is true, the AI must not use it for short-term progress comparisons; this 30-day regression is the authoritative direction signal.

Existing Daily and durable feedback snapshots are updated by the explicit,
idempotent migration described in [tech/07-infrastructure.md](../tech/07-infrastructure.md).
This is a one-off persistence migration, not a runtime compatibility contract:
normal reads and writes use `weeklyTrend30d` only, while calculation,
stale-weight, and outlier behavior remain unchanged.

## Goal Context

`shared/lib/goalContext.ts`:
- `evaluateWeightDelta(currentKg, targetKg, goalType)` — classifies change as progress or regression
- `progressGrowsOnDecrease(goalType)` — `true` for `lose_weight`, `false` for `gain_muscle`, etc.

Needed because "weight going down = progress" is only true for weight loss goals.

## API

- `GET /api/weights` — `{ entries: WeightEntry[] }`
- `POST /api/weights` — `{ value, unit?, date }`; `date` is a required real `YYYY-MM-DD` calendar date
- `DELETE /api/weights/{id}` — optimistic delete on mobile
