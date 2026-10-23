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
  updatedAt?: string; // last change; absent on legacy documents
}
```

One entry per measurement. Multiple entries per day are allowed (no deduplication enforced).

New entries initialize `updatedAt` from `createdAt`; changing a value updates
`updatedAt` without changing the measurement date or creation time. The
repository-only `listUpdatedSince(userId, since)` query is inclusive and stays
within the existing `/userId` partition. Legacy entries without `updatedAt`
use `createdAt` for the comparison. Optional `updatedAt` is a Class 0 change:
legacy documents remain valid and readable, with no migration or backfill.
Deleting an entry physically removes it; no server deletion tombstone or
deletion history is introduced. The [weight delta API](../tech/09-api-reference.md#weights)
returns only current entries in its UTC checkpoint window.

The local ID-only Health Connect delete retry described in the unapproved
[HC-4 draft](../../User%20Stories/HealthConnect/HC-4_Health-Connect-Synchronisation-vereinfachen.md)
is Mobile-owned and is not provided by the weights API. The backend does not
store a device checkpoint, transfer status, or deleted Weight IDs.

## Units

The shared unit contract stores `'kg' | 'lbs'` per entry. The current product data is kg-only. `WeightChart` plots each `WeightEntry.value` as stored and computes its moving average from those raw values; it does not normalize entries to kg. A series containing both units would mix their numeric scales in the chart. Progress' weekly comparison uses arithmetic means; its fallback uses the explicit seven-calendar-day regression described below. Daily Insight retains its separate 30-day regression contract.

The mobile Progress screen accepts new entries and edits in kg only and sends `unit: 'kg'` for new entries. It does not convert non-kg measurements; if one is returned, Progress blocks editing it. The shared `WeightEntry` and API contracts still permit `'lbs'`; removing that support requires a separate cross-layer change. The current product data has no lbs values.

## Weight Chart

`mobile/src/shared/components/WeightChart.tsx`

Renders using `react-native-svg` (Polyline, Path, Circle, LinearGradient).

Visual elements:
1. Gradient fill under the actual weight line
2. Solid 3px bright-green polyline (actual weights)
3. 3px dots at each measurement point
4. Dashed overlay line (Progress: rolling calendar average for the selected 7T/30T/90T range; `Alle` uses a 90-day window)
5. Horizontal dashed grid lines
6. Legend: "Gewicht" (solid) + selected rolling-average period (dashed)

Data processing:
- Sorted chronologically by date, then keeps the last `windowDays` measurements (default 30); this is a measurement-count window, not a calendar-day filter
- Requires ≥2 entries to render (shows placeholder otherwise)
- Y-axis bounds: extrema include raw measurements, trailing averages, and the optional target. `computeChartBounds` selects steps documented as 0.5, 1, or 2 kg for numeric ranges ≤2, >2 and ≤10, or >10, respectively; it floors the minimum to a step boundary and subtracts one step, then ceils the maximum and adds one step. The chart passes raw values, so these numeric steps are applied without unit conversion. There is no 10% padding or 0.4 kg minimum-range rule.
- X-axis: first, middle, last entry dates (deduplicated)

### Progress Windows and Moving Average

The mobile Progress screen initially selects `7T`, with `30T`, `90T` and `Alle` also available. Its chart-header shows only the selected local-calendar-window mean as a kg value at the right of the period controls; the accessible label identifies the window. It includes today and excludes future entries; `Alle` displays the mean of all non-future entries. The dashed blue line is a trailing calendar-day average matching 7T, 30T or 90T; `Alle` uses a 90-day average and the legend calls it `Gleitender Ø 90T`. It may use earlier history outside the visible chart window to provide complete context for the first plotted points. When a goal weight is available, Progress passes it to `WeightChart` in every period; the chart includes it in the y-axis bounds and displays its dashed target line, value badge, and `Ziel` legend entry. Other `WeightChart` callers that do not provide a calendar-average window retain the trailing seven-measurement moving average, with partial averages until seven measurements exist.

The weekly comparison shows the arithmetic mean for today minus six days through today against the most recently completed Monday–Sunday calendar week. Both averages and measurement counts match their corresponding `HistoryList` sections; windows may overlap and multiple measurements on a date count individually. The comparison is displayed once as `Letzte 7 Tage`, `Letzte Woche`, and their neutral change. If either mean is unavailable, Progress falls back to `calculateWeightTrendRegressionSeries(entries, 7)`, when measurements span at least two distinct dates. Missing comparisons are not replaced with older calendar weeks. The latest non-future weight appears once with relative date labels `Heute`, `Vor 1 Tag`, or `Vor 2 Tagen`, then a neutral absolute date. The full history remains visible while creating or editing. The API and data model still allow multiple measurements per day, but Progress has no add-another action and updates an existing selected-day entry by exact ID.

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

`backend/src/lib/progressIntelligence.ts` — computes behavioural signals from raw weight data. The full result remains in the internal Daily context; only an available milestone is sent to the provider prompt and used as a weight-specific intent.

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

These remain internal snapshot fields and are not included in the provider prompt.

[Rule] The Daily Insight provider prompt uses the Home-compatible weight direction: `calculateWeightTrendRegressionSeries` over 14 local calendar dates, excluding future measurements, with at least 7 measurements and a neutral threshold of 0.05 kg/week. It receives the latest weight and this direction, but not point-to-point comparisons, the internal `weeklyTrend30d`, or phase/plateau/monthly progress signals. A milestone remains available as a separate, non-directional fact. Progress screen comparisons and the backend's internal progress calculations retain their own contracts.

Existing Daily and durable feedback snapshots are updated by the explicit,
idempotent migration described in [tech/07-infrastructure.md](../tech/07-infrastructure.md).
This is a one-off persistence migration, not a runtime compatibility contract:
`weeklyTrend30d` remains in internal snapshots for compatibility, while the
provider prompt uses `homeTrend14d`; calculation, stale-weight, and outlier
behavior remain unchanged.

## Goal Context

`shared/lib/goalContext.ts`:
- `evaluateWeightDelta(currentKg, targetKg, goalType)` — classifies change as progress or regression
- `progressGrowsOnDecrease(goalType)` — `true` for `lose_weight`, `false` for `gain_muscle`, etc.

Needed because "weight going down = progress" is only true for weight loss goals.

## API

- `GET /api/weights` — `{ entries: WeightEntry[] }`
- `POST /api/weights` — `{ value, unit?, date }`; `date` is a required real `YYYY-MM-DD` calendar date
- `PUT /api/weights/{id}` — accepts `{ value }` and changes only the value on the authenticated user's entry; returns the updated `WeightEntry`, or 404 when the ID is not owned by that user
- `DELETE /api/weights/{id}` — optimistic delete on mobile
