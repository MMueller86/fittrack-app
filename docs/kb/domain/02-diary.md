# Diary

## Structure

```
Day
└── Meals (multiple)
    └── MealItems (multiple)
        └── NutritionValues (snapshot)
```

## Meal Types

`MealType` — `'breakfast' | 'lunch' | 'dinner' | 'snack' | 'preworkout' | 'postworkout'`

Each day can have multiple meals, including multiple meals of the same type.

## Meal Item

`MealItem` — a single food entry within a meal.

Key fields:
- `id` — UUID
- `foodRef` — reference to the original food item (catalog ID or reusable item ID)
- `sourceType: MealItemSourceType` — how it was logged
- `nutrition: NutritionValues` — **snapshot** at the time of logging
- `amountGrams` — effective amount used for calculation
- `isAiEstimate` — true for AI-estimated items
- `confidence` — AI confidence (0–1), null for non-AI items
- `warnings` — AI-generated warnings (e.g., "unusual calorie density")
- `components` — for compound items (meal estimates), the detected sub-items
- `category: FoodCategory` — used by the hint engine for dietary diversity checks

### Source Types

| `sourceType` | Meaning |
|---|---|
| `manual` | User typed values manually |
| `reusableItem` | From user's personal food library |
| `openFoodFacts` | From Open Food Facts catalog |
| `ai` | From AI food estimator |
| `ai-meal-estimate` | From AI meal image estimate |
| `recipe` | Added from a recipe |

## Day Meta

`DayMeta` — per-day metadata stored as `_docType: 'dayMeta'` in the existing `nutritionDiaryMeals` Cosmos container.

- `dayType: 'rest' | 'training'` — determines which targets apply
- `workoutType` — optional label for training days
- `specialActivity?: SpecialActivity` — persisted result of a special activity calculation (see below)
- `calorieTargetSnapshot?` — optional historical base-target snapshot captured on an explicit day-context write; contains `calories`, `capturedAt`, `source: 'profile'` and an optional `profileUpdatedAt`

The diary GET endpoint assembles `DayMeta` and selects the correct `DayTargets` accordingly.

### Historical target read rules

The weekly read resolves targets snapshot-first. A valid `DayMeta.calorieTargetSnapshot.calories` is used before the existing `specialActivity.dailyCalorieTarget`, which remains a compatible historical source for older activity documents. If neither exists, the read uses the current profile's `trainingDay` target for an explicitly stored training day and `restDay` otherwise, including a day without `DayMeta`. This is a read-only `profile_fallback`, not a historical snapshot, and is never written into the diary. If a special activity exists but has no usable stored target, the activity target remains unavailable rather than being replaced by a profile value.

An absent `calorieTargetSnapshot` is expected on legacy documents and requires no migration. Explicitly setting a historical day type may write or replace that day's snapshot. Profile updates do not touch existing DayMeta documents. Removing a special activity preserves an explicit day snapshot; the special-activity PUT/DELETE contract and its existing `422` cases remain unchanged.

## Special Activity

A **special activity** represents a logged single high-intensity physical
effort (hiking or cycling) that meaningfully exceeds the activity level already
baked into the user's daily calorie target. The stored activity remains a
`SpecialActivity` record; it does not contain a completion-status field.

`SpecialActivity` is a discriminated union: `HikingSpecialActivity | CyclingSpecialActivity`. The `type` field determines which input fields and intermediates are present.

### Daily Insight activity-status boundary

The Daily Insight derives a temporary language context from the requested
current-day `localHour`; it does not change the diary activity contract or
persist a new status:

| Condition with a present `specialActivity` | Daily status | Meaning |
|---|---|---|
| Valid `localHour` `0..19` for the current day | `planned` | Logged/planned, not treated as completed |
| Valid `localHour` `20..23` for the current day | `likely_completed` | Probabilistic or conditional language only |
| Missing, non-integer, or out-of-range hour | `unknown` | No completion statement |
| Requested date is not the current day | `unknown` | Current local time is not applied retrospectively |

Without a special activity, the status and its source are `null`. The source is
`local_time_heuristic` for valid current-day hours and `unavailable` for an
unknown status. There is deliberately no `completed` value: the activity
entry has no confirmed completion source. `likely_completed` must never be
worded as a confirmed fact, and `planned`/`unknown` must not use completed-
activity language.

The status is used only by the Daily Insight context and prompt. Historical
activity snapshots remain available for their own target and activity data;
the current request hour does not manufacture a historical completion fact.
The current Mobile client sends `timezoneOffsetMinutes` as local time minus UTC.
Integer values from `-840` through `840` are normalized and used to determine
the requested local current day and the safety boundary for this heuristic.
Missing or invalid values normalize to `null`: the request remains usable with
the legacy UTC fallback, but an activity is not treated as current-day evidence
and therefore remains `unknown`; Daily expiry also falls back to UTC midnight.
See [tech/09-api-reference.md](../tech/09-api-reference.md) for the complete
cache, local-midnight, and TTL contract.

The v14 Daily Insight also applies one global stale-weight safety rule across
all intents: day 14 is current, day 15 is stale, stale-as-current wording is
rejected, and explicit markers such as `veraltet` or `nicht aktuell` are
accepted. The full prompt and failure contract is documented in
[domain/07-ai-features.md](07-ai-features.md).

### Activity Bonus

The **activity bonus** is extra calories added on top of the base daily target for the day on which the activity occurred.

Formula: `activityBonus = max(0, activityCalories − alreadyAccountedCalories)`, rounded to the nearest 50 kcal.

- `activityCalories` — estimated energy expenditure: `estimatedMet × weightKg × movementTimeH`
- `alreadyAccountedCalories` — the fraction of the base target that already covers the movement window: `dailyCalorieTarget × (movementTimeH / 24)`

The hint engine uses `dailyCalorieTarget + activityBonus` as the effective calorie target for the day, so hints that compare logged calories against targets remain accurate.

### Hiking Inputs (`type: 'hiking'`)

| Field | Type | Notes |
|---|---|---|
| `movementTimeMinutes` | `number` | Net moving time |
| `distanceKm` | `number` | Horizontal distance |
| `elevationGainM` | `number` | Total ascent in metres |
| `elevationLossM?` | `number` | Total descent in metres; defaults to 0 |
| `packCategory?` | `PackCategory` | `'none'` / `'small'` / `'medium'` / `'heavy'`; defaults to `'none'` when absent |
| `terrainType?` | `TerrainType` | `'path'` / `'trail'` / `'alpine'` / `'scramble'`; defaults to `'path'` when absent |
| `hasBackpack?` | `boolean` | **Deprecated** — maps to `packCategory: 'medium'` when true |

### Cycling Inputs (`type: 'cycling'`)

| Field | Type | Notes |
|---|---|---|
| `movementTimeMinutes` | `number` | Net moving time; 15–1200 |
| `distanceKm` | `number` | Horizontal distance; 1–200 |
| `elevationGainM` | `number` | Total ascent in metres; 0–8000 |
| `elevationLossM?` | `number` | Total descent in metres; defaults to 0 |
| `asphaltShare` | `number` | Fraction of route on asphalt; 0.0–1.0 |
| `gravelShare` | `number` | Fraction of route on gravel/dirt; 0.0–1.0 |
| `trailShare` | `number` | Fraction of route on trail/path; 0.0–1.0 |
| `ebikeSupport` | `EbikeSupport` | `'NONE'` / `'LIGHT'` / `'HIGH'`; reduces effective MET |

The three terrain shares must sum to 1.0. Speed plausibility: 3–80 km/h; outside this range → 422.

### ActivityBonusResult Fields

In addition to `activityBonus`, the calculation returns intermediates for display in the mobile breakdown sheet:

**Hiking intermediates (V3):**
- `metBase` — flat-terrain walking MET derived from speed
- `metLocomotion` — MET after adding ascent/descent deltas
- `terrainFactor` — multiplicative terrain multiplier applied
- `deltaPack` — additive pack bonus applied after terrain multiplication

**Cycling intermediates (V1.1):**
- `speedMet` — base MET from average speed (lookup table)
- `uphillBonusMet` — MET bonus from elevation rate (lookup table)
- `terrainBonusMet` — MET bonus from terrain mix (ASPHALT=0, GRAVEL=0.5, TRAIL=1.5 per share)
- `effectiveSupport` — combined eBike reduction factor (0.0 when `ebikeSupport: 'NONE'`)

## Day Summary

Computed on every diary GET — never stored. Sum of all `MealItem.nutrition` values across all meals for the day.

## Weekly nutrition review data

The shared weekly DTO contains exactly seven completed days, `consumedCalories`, `consumedMacros`, the resolved base and effective targets, `targetPercent`, a target-band classification, a missing-data status, the day type and a special-activity label. An explicitly stored `DayMeta` keeps its `dayType` and optional `workoutType` in the weekly result even when the calorie target comes from the read-only `profile_fallback`; target resolution must not erase the day context. The activity label and activity bonus remain available from the stored special activity. A `rest` context synthesized only because a special activity was stored without an explicit day context remains implicit and is not exposed as a historical day type. `consumedMacros` has the shape `{ protein, carbs, fat } | null` and sums the authoritative `MealItem.macros` snapshots across all Meals and Items for the day. A day with an empty Meal or no Items has `consumedMacros: null`; a present MealItem whose calories or macro values are `0` has valid nutrition and valid zero values. The raw sums are not rounded. Missing days remain visible but are excluded from totals and averages. No historical protein, carbohydrate, or fat targets are reconstructed.

## Hint System

On every diary GET, the backend evaluates the `hintEngine` and returns one `HintResult`:

```ts
interface HintResult {
  id: HintId;     // e.g. 'H5' or 'M3'
  text: string;
  emoji: string;
  category: HintCategory;
}
```

Rules run in priority order:
1. Warning / Orientation — no cooldown (e.g., under 1200 kcal warning, under-BMR warning)
2. Day context — 1-day cooldown (e.g., first meal of the day, late-night logging)
3. Positive feedback — 2-day cooldown (e.g., fiber goal reached, protein goal reached)
4. Motivational fallback — 30-day cooldown per message, cyclic across M0–M9

The `currentHour` query parameter (local device time 0–23) enables time-gated rules like breakfast hints and late-evening hints.

`HintState` — persisted in Cosmos to track last-shown timestamps for each `HintId` per user.

## Diary GET Response

`DiaryDayResponse` (assembled by the diary function handler):
- `date` — ISO date
- `meals: Meal[]`
- `summary: DaySummary`
- `targets: DayTargets` — resolved for current day type
- `dayType: 'rest' | 'training'`
- `hint: HintResult`
- `specialActivity?: SpecialActivity | null` — persisted special activity for the day, or null
- `activityBonus?: number` — extra calories from the special activity (0 when none)
- `previousDayHasActivity?: boolean` — true when the previous day had a special activity logged

## Business Rules

- [Rule] Nutrition values in `MealItem` are a **snapshot**. They do not update if the original food item changes later.
- [Rule] Day summaries are recalculated on every GET — never stored.
- [Rule] AI-estimated items must be reviewed by the user before saving. The review screens (`MealParserReviewScreen`, `FoodEstimateReviewScreen`, `LabelScanReviewScreen`, `MealEstimateReviewScreen`) enforce this.
- [Rule] `isAiEstimate: true` must be preserved on all diary items that originated from AI.
- [Rule] The hint engine must never be an AI call — it is a pure rule evaluation.

## Related Documents

- [domain/03-food-catalog.md](03-food-catalog.md) — food sources used to populate diary items
- [domain/07-ai-features.md](07-ai-features.md) — AI-assisted diary entry workflows
- [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) — UX for adding food to diary
