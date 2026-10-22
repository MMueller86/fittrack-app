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
- `sourceId?` — source item ID for catalog/reusable foods; recipe entries use `recipeId`
- `sourceType: MealItemSourceType` — how it was logged
- `macros: MealItemMacros` — **snapshot** at the time of logging (`calories`, `protein`, `carbs`, `fat`, `fiber`)
- `recipeId?` — source recipe ID when `sourceType: 'recipe'`
- `recipePortions?` — logged recipe portion count, including fractional portions
- `amountGrams` — effective amount used for calculation
- `quantity` and `unit` — diary amount and its unit. Portion-based entries use the canonical `unit: 'portion'`; Mobile formats singular/plural from `quantity`. Legacy `Portion` and `Portionen` values remain readable.
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

### Recipe Log Snapshots

`POST /api/recipes/{id}/log` resolves the recipe on the server at write time.
The authenticated owner may log a private or published recipe; another signed-in
user may log it only while its visibility is currently `community`. The
recipe-specific branch of `POST /api/diary/meals/{mealId}/items` uses the same
access and snapshot helper and does not trust client-supplied recipe macros.
Both paths snapshot the current recipe name, logged portion count, and scaled
per-portion macros into the new `MealItem` with `sourceType: 'recipe'`.

The recipe reference is not a live nutrition join. Editing, making private, or
deleting the source recipe does not rewrite a previously stored diary item's
name, `recipePortions`, or `macros`. A revoked/deleted foreign recipe cannot
be opened or logged again through the reference, while the historical meal
entry remains readable from its saved snapshot. See
[tech/09-api-reference.md](../tech/09-api-reference.md#recipe-logging-and-snapshots)
for the route request contract.

## Day Meta
### Account deletion and diary snapshots

Account deletion sweeps every Diary meal and its embedded snapshots in the
deleting user's partition. It does not search or rewrite another user's diary:
foreign favorites and already-saved diary snapshots that reference a deleted
recipe remain stored. A foreign favorite no longer resolves to an available
recipe after that recipe is deleted. Work admitted before the deletion lease is
not drained and may write after `204`; this accepted late-write residual means
the response does not guarantee older Diary operations cannot recreate data.

## Day Meta

`DayMeta` — per-day metadata stored as `_docType: 'dayMeta'` in the existing `nutritionDiaryMeals` Cosmos container.

Diary reads return meal documents only. They retain legacy meals without a
`_docType` and accept explicit `_docType: 'meal'`, while excluding `DayMeta`
and other document types stored in the shared container.

- `dayType: 'rest' | 'training'` — determines which targets apply
- `workoutType` — optional label for training days
- `specialActivity?: SpecialActivity` — persisted result of a special activity calculation (see below)
- `calorieTargetSnapshot?` — optional historical base-target snapshot captured on an explicit day-context write; contains `calories`, `capturedAt`, `source: 'profile'` and an optional `profileUpdatedAt`

The diary GET handler selects the profile `DayTargets` internally for hint
evaluation. An explicit `dayType: 'training'` selects `trainingDay`; otherwise
the handler selects `restDay`, or its fixed calorie-only fallback when no
profile exists. The current GET response does not include `targets` or
`macroRanges`.

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

The user-facing Daily Insight activity rule and its local-time exceptions are
maintained in the [central Daily Insight rulebook](09-daily-insight.md). The
diary model itself stores no completion-status field; the backend derives a
temporary status for the request.

The Daily Insight derives a temporary language context for a present activity;
it does not change the diary activity contract or persist a new status:

| Condition with a present `specialActivity` | Daily status | Meaning |
|---|---|---|
| Requested date is before the current local date | `completed` | A past-day activity is treated as completed under the server rule |
| Current day and valid `localHour` `22..23` | `completed` | Server-confirmed completion window |
| Otherwise, including missing/invalid hour or non-current future date | `unknown` | Do not claim planned or completed |

Without a special activity, the status is `null`. The status values are only
`completed` and `unknown`; the provider must not infer a planned or likely-
completed state from the activity entry or time of day.

The status is used only by the Daily Insight context and prompt. Historical
activity snapshots remain available for their own target and activity data;
the current request hour does not manufacture a historical completion fact.
The current Mobile client sends `timezoneOffsetMinutes` as local time minus UTC.
Integer values from `-840` through `840` are normalized and used to determine
the requested local current day and the safety boundary for this heuristic. The
Daily request requires a real `date` and an integer offset in that range;
missing, malformed, or out-of-range values are rejected with HTTP `400` at the
handler boundary. There is no UTC date, hour, or expiry fallback. With a valid
offset, the server resolves the requested date against the offset-adjusted
local date before applying the completion rule.
See [tech/09-api-reference.md](../tech/09-api-reference.md) for the complete
cache, local-midnight, and TTL contract.

The active Daily Insight prompt also applies one global stale-weight rule across
all intents: day 14 is current, day 15 is stale, and stale weight is omitted or
marked with an explicit marker such as `veraltet` or `nicht aktuell`. Since
2026-10-20 this is a prompt rule only; the runtime validator no longer checks it
(see the [rulebook](09-daily-insight.md#server-validation-scope-2026-10-20)). The full prompt
and failure contract is documented in
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

The `localDate` query parameter carries the current local device date separately
from the requested diary date. The optional `localHour` query parameter
(local device time 0–23) enables time-gated rules like breakfast hints and
late-evening hints; missing, non-integer, or out-of-range values remain
unknown rather than being replaced with a default hour.

`HintState.lastHintDate` is compared with `localDate`, not with the requested
diary date. Reading a historical diary day therefore does not rewrite hint
state solely because the requested date differs from the current local date.

`HintState` — persisted in Cosmos to track last-shown timestamps for each `HintId` per user.

### Macro-range hint behavior

When a profile is available, the hint engine receives the selected profile-day
`macroRanges`. A special-activity bonus is added only to the calorie target
passed to hint evaluation; it does not change the selected protein or
carbohydrate ranges. The no-profile fallback has no ranges, so macro-range
checks do not invent bounds.

Protein classification uses actual protein grams per kilogram when usable body
weight is available: below `1.5 g/kg` is `below_range`, `1.5–2.0 g/kg`
inclusive is `in_range`, above `2.0` through `2.2 g/kg` inclusive is
`above_range`, and above `2.2 g/kg` is `above_coaching_threshold`. Without
usable weight, the classifier falls back to the rounded range bounds; without
a valid range it returns `unknown`. H3/H4 retain their low-intake fractions of
the range minimum, H8 requires a training day and `below_range`, H15/H17 use
`in_range`, and H28 requires the high coaching band after dinner and retains
its seven-day cooldown.

H16 is positive only when protein is in range, carbohydrates are within their
inclusive range, and fat is within 10% of its scalar target. Carbohydrates
outside their range do not create a negative hint; they only prevent H16.

## Diary GET Response

`GET /api/diary` currently returns:
- `meals: Meal[]`
- `summary: DaySummary`
- `dayType: 'rest' | 'training' | null` — null when no day metadata exists
- `workoutType: WorkoutType | null` — null when absent
- `hint: HintResult`
- `specialActivity: SpecialActivity | null`
- `activityBonus: number` — zero when there is no special activity
- `previousDayHasActivity: boolean`

The current response does not include `date` or `targets`; in particular,
`macroRanges` are not part of `DiaryDayResponse`. Clients obtain profile-day
ranges through the Profile API.

## Business Rules

- [Rule] Nutrition values in `MealItem` are a **snapshot**. They do not update if the original food item changes later.
- [Rule] Day summaries are recalculated on every GET — never stored.
- [Rule] Food-relation usage tracking receives the explicit `Meal.date` as its date-only value; technical usage timestamps remain UTC instants, and no historical usage-date migration is performed.
- [Rule] AI-estimated items must be reviewed by the user before saving. The review screens (`MealParserReviewScreen`, `FoodEstimateReviewScreen`, `LabelScanReviewScreen`, `MealEstimateReviewScreen`) enforce this.
- [Rule] `isAiEstimate: true` must be preserved on all diary items that originated from AI.
- [Rule] The hint engine must never be an AI call — it is a pure rule evaluation.

### Bulk item mutations

Bulk delete, move, and copy operate on explicit `{ mealId, itemId }`
references and are all-or-nothing. Delete removes only selected items from
the source date and keeps the Meal documents, even when a meal becomes empty.
Move directly removes the selected items from their source Meals and appends
snapshot-preserving copies with new item IDs to one different meal on the same
date. A newly selected move target is created in the same transaction.

Copy targets exactly one explicitly selected meal on the same or a different
date. The target may already exist or be created in the same transaction. Each
stored MealItem snapshot is cloned with a fresh ID, preserving all item fields
and nutrition values; snapshot cloning does not resolve current reusable-item
or recipe data. When the target is the same Meal as a source, its original
items remain and the clones are appended to that Meal. When the target is a
different Meal, the source Meals remain unchanged. A repeated request after a
successful copy is a new mutation: it appends new clones with fresh IDs and is
not deduplicated. A single-item copy uses the same bulk-copy request with one
reference.

When the target is also a source Meal, Copy updates only that target by
appending clones; the all-or-nothing behavior is unchanged.

Delete and Move do not create or compensate food-usage history, change
`UserFoodRelation` fields, or change `ReusableItem.usageCount` /
`Recipe.usageCount`. Existing usage data remains untouched; no historical
correction or migration is performed.

After the successful atomic Diary commit, Copy records best-effort usage once
per copied item with a persisted source reference, using the target Meal's date
and type (also for same-day copies). Repeating a successful request records
usage for each new copy. The stored references, not `MealItem.sourceType`,
determine the source class because existing add paths do not consistently
persist `sourceType`:

- `recipeId` records a `recipe` relation for the copying user. The recipe
  owner's `usageCount` is incremented only when `resolveRecipeForRead()` still
  resolves an owner or currently published community recipe. A deleted,
  private, or otherwise unavailable recipe snapshot remains copyable and still
  records the copying user's relation, but does not increment an owner counter.
- A `sourceId` beginning with `openFoodFacts:` records a `catalog` relation;
  there is no catalog product counter.
- Any other `sourceId` records a `personal` relation. The ReusableItem's
  `usageCount` is incremented only when that user's item resolves with
  `nutritionPer100g`.
- Items without `recipeId` or `sourceId` create no usage relation or source
  counter.

Repeated copies of the same source are tracked once per copied item. Tracking
failures do not roll back the committed Diary mutation. This uses existing
documents and repository operations; no schema change or migration is needed.
The API error and transaction contract is documented in
[tech/09-api-reference.md](../tech/09-api-reference.md#bulk-diary-item-mutations).

## Related Documents

- [domain/03-food-catalog.md](03-food-catalog.md) — food sources used to populate diary items
- [domain/07-ai-features.md](07-ai-features.md) — AI-assisted diary entry workflows
- [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) — UX for adding food to diary
