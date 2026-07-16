# Nutrition Model

## Nutrient Values

`NutritionValues` (`shared/types/diary.ts`) — the universal macro container used throughout the system.

| Field | Required | Unit | Notes |
|---|---|---|---|
| `calories` | Yes | kcal | |
| `protein` | Yes | g | |
| `carbs` | Yes | g | |
| `fat` | Yes | g | |
| `fiber` | Yes | g | |
| `sugar` | No | g | Optional — not always available |
| `saturatedFat` | No | g | Optional |
| `salt` | No | g | Optional |

[Rule] Macro values are stored and transmitted **per 100g** in catalog items and reusable items. They are scaled to the logged amount at display and diary-entry time.

[Rule] Values are **snapshotted at logging time** into the `MealItem`. No runtime lookup of current catalog values — once logged, the nutrition facts are fixed.

## Day Targets

`DayTargets` — macro targets for one day type (rest or training).

```ts
interface DayTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}
```

`ProfileTargets` — pair of day targets:

```ts
interface ProfileTargets {
  rest: DayTargets;
  training: DayTargets;
}
```

The correct `DayTargets` to use for a given day is determined by the day's `dayType` field in `DayMeta`.

## Day Summary

`DaySummary` — on-the-fly aggregation of all `MealItem.nutrition` values across all meals for the day.

[Rule] Day summaries are **never stored in Cosmos** — they are recalculated from meal items on every diary GET request. This ensures consistency if items are edited or deleted.

## Calculation Meta

`CalculationMeta` — stored alongside `ProfileTargets` for auditability and recalculation.

Key fields:
- `bmr` — Basal Metabolic Rate (kcal/day) from Mifflin-St Jeor
- `pal` — Physical Activity Level multiplier
- `maintenanceCalories` — `bmr × pal`
- Adjustment values for goal-based modifications

See [domain/04-profile-goals.md](04-profile-goals.md) for the full calculation.

## Nutrition Scaling

`calculateNutrition(item, mode, amount)` in `shared/lib/nutritionCalculator.ts`:

- `mode: 'grams'` — `amount` is directly in grams
- `mode: 'portion'` — `amount` is in portions; each portion has a weight in grams
- Result = per-100g values × (effectiveGrams / 100)

[Rule] Never scale nutrition values in UI components. Always call `calculateNutrition()` from the shared library.

## Fiber Goal

Fiber is treated as a goal, not a limit. Progress toward the fiber target is shown like other macros.

## Macro Display Conventions

- Calories: `kcal` (not `cal` or `kJ`)
- Protein: `EW` (Eiweiß) in German UI
- Carbohydrates: `KH` (Kohlenhydrate) in German UI
- Fat: `F` (Fett) in German UI
- Fiber: shown when tracking is complete

[Open] The app UI is in German. No localization/i18n framework has been identified in the codebase.
