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

`DayMeta` — per-day metadata stored in a separate Cosmos container.

- `dayType: 'rest' | 'training'` — determines which targets apply
- `workoutType` — optional label for training days

The diary GET endpoint assembles `DayMeta` and selects the correct `DayTargets` accordingly.

## Day Summary

Computed on every diary GET — never stored. Sum of all `MealItem.nutrition` values across all meals for the day.

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
