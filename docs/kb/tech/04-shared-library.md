# Shared Library

Package name: `@fittrack/shared`  
Location: `shared/`

## Purpose

Shared TypeScript definitions and pure calculation functions used by both `backend` and `mobile`. No side effects, no I/O, no HTTP.

## Types (`shared/types/`)

### `auth.ts`
- `TokenResponse` — `{ accessToken, refreshToken }`
- `AccessTokenPayload` — `{ sub, iat, exp }`

### `profile.ts`
- `Gender` — `'male' | 'female' | 'other'`
- `ActivityLevel` — `'sedentary' | 'light' | 'active' | 'very_active'`
- `GoalType` — `'lose_weight' | 'maintain' | 'gain_muscle' | 'recomposition'`
- `GoalIntensity` — `'gentle' | 'moderate' | 'aggressive'`
- `Sports` — `'strength' | 'bouldering' | 'running' | 'cycling' | 'swimming' | 'hiking' | 'teamsport' | 'other'`
- `ProfileInput` — all fields the user provides during onboarding/edit
- `UserProfile` — full stored profile document (includes `targets`, `calculationMeta`)

### `nutrition.ts`
- `DayTargets` — `{ calories, protein, carbs, fat, fiber }` per day type
- `ProfileTargets` — `{ rest: DayTargets, training: DayTargets }`
- `CalculationMeta` — `{ bmr, pal, maintenanceCalories, ... }` stored for audit/reconstruction

### `diary.ts`
- `MealType` — `'breakfast' | 'lunch' | 'dinner' | 'snack' | 'preworkout' | 'postworkout'`
- `MealItemSourceType` — `'manual' | 'reusableItem' | 'openFoodFacts' | 'ai' | 'ai-meal-estimate' | 'recipe'`
- `NutritionValues` — `{ calories, protein, carbs, fat, fiber, sugar?, saturatedFat?, salt? }`
- `PortionInfo` — `{ label, weightGrams?, nutrition }`
- `MealItem` — diary entry for one food item; includes `isAiEstimate`, `confidence`, `warnings`, `components`
- `Meal` — container for multiple `MealItem`s on a date, with a `type`
- `DaySummary` — aggregated macro totals for a day
- `DayMeta` — per-day metadata (`dayType: 'rest' | 'training'`, `workoutType`, `specialActivity?`)
- `ReusableItem` — user's personal food library item; includes AI-generated `searchTerms` and `aiKeywords`
- `FoodSearchResult` — unified search result (library + catalog); includes `source`, `portion`, `isComplete`
- `AiFoodEstimatePreview` — AI food estimation with `confidence`, `warnings`, `estimatedPortion`
- `NutritionLabelScanResult` — OCR + AI label extraction result
- `PackCategory` — `'none' | 'small' | 'medium' | 'heavy'` — pack/backpack weight class for hiking
- `TerrainType` — `'path' | 'trail' | 'alpine' | 'scramble'` — terrain difficulty class for hiking
- `CyclingTerrainType` — `'asphalt' | 'gravel' | 'trail'` — dominant terrain type for cycling (maps to pure share presets)
- `EbikeSupport` — `'NONE' | 'LIGHT' | 'HIGH'` — eBike motor assistance level
- `HikingActivityInputs` — inputs for hiking activity bonus calculation:
  - `movementTimeMinutes`, `distanceKm`, `elevationGainM` — core fields
  - `elevationLossM?` — descent in metres (V3; defaults to 0 when absent)
  - `packCategory?: PackCategory` — replaces deprecated `hasBackpack?`
  - `terrainType?: TerrainType` — defaults to `'path'` when absent
  - `hasBackpack?: boolean` — **@deprecated** — mapped to `packCategory: 'medium'` for backward compatibility
- `CyclingActivityInputs` — inputs for cycling activity bonus calculation:
  - `movementTimeMinutes`, `distanceKm`, `elevationGainM` — core fields
  - `elevationLossM?` — descent in metres; defaults to 0 when absent
  - `asphaltShare`, `gravelShare`, `trailShare` — terrain mix as fractions 0.0–1.0; must sum to 1.0
  - `ebikeSupport: EbikeSupport` — motor assistance level
- `ActivityBonusResult` — result of activity bonus calculation (shared by hiking and cycling):
  - `estimatedMet`, `activityCalories`, `alreadyAccountedCalories`, `activityBonus` — core outputs
  - `metBase?`, `metLocomotion?`, `terrainFactor?`, `deltaPack?` — hiking V3 intermediates (optional)
  - `speedMet?`, `uphillBonusMet?`, `terrainBonusMet?`, `effectiveSupport?` — cycling V1.1 intermediates (optional)
- `HikingSpecialActivity` — `HikingActivityInputs & ActivityBonusResult & { type: 'hiking', bodyWeightKg, dailyCalorieTarget, calculatedAt }`
- `CyclingSpecialActivity` — `CyclingActivityInputs & ActivityBonusResult & { type: 'cycling', bodyWeightKg, dailyCalorieTarget, calculatedAt }`
- `SpecialActivity` — discriminated union: `HikingSpecialActivity | CyclingSpecialActivity`

### `recipes.ts`
- `RecipeIngredient` — linked food catalog or reusable item with optional `category?: 'food' | 'seasoning'` and persistent `amountLabel?: string`; `inputAmount` and `amountGrams` are `number | null` for indeterminate amounts. A missing category is the legacy-food fallback.
- `RecipeStep` — ordered instruction
- `RecipeImage` — blob reference + SAS URL
- `RecipeNutrition` — `{ calories, protein, carbs, fat, fiber }` totals + per-portion; the recipe calculator gives seasonings and indeterminate amounts a zero contribution
- `Recipe` — owner, ingredients, steps, images, nutrition, usage count

### `foodProduct.ts`
- `FoodProduct` — Open Food Facts catalog entry
  - `id` = `openFoodFacts:<barcode>`
  - `normalizedName`, `tokens`, `searchKeywords` (union of auto + manual)
  - `sourceQualityScore` — 0–100
  - `productType` — `'food' | 'beverage' | 'supplement' | 'unknown'`
  - `qualityFlags` — optional quality annotations

### `quota.ts`
- `AiFeature` — `'meal-parser' | 'food-estimate' | 'label-scan' | 'meal-estimate' | 'recipe-analyze'`
- `UserTier` — `'free' | 'premium' | 'internal'`
- `AiUsageCounter` — Cosmos document tracking monthly AI usage per user/feature
- `QuotaCheckResult` — `{ allowed, used, limit, remaining, feature, period }`
- `QuotaExceededResponse` — 429 body with reset date

### `weights.ts`
- `WeightUnit` — `'kg' | 'lbs'`
- `WeightEntry` — date-stamped weight measurement

### `hint.ts`
- `HintId` — `H1`–`H28` situational hints + `M0`–`M9` motivational hints
- `HintCategory` — `'orientation' | 'daycontext' | 'positive' | 'motivation'`
- `HintResult` — `{ id, text, emoji, category }`
- `HintContext` — input to the rule engine (meals, summary, targets, dayType, currentHour, bmr)

### `insight.ts`
- `InsightStatus` — `'fresh' | 'cached' | 'quota_exceeded' | 'unavailable'`
- `InsightResponse` — daily AI briefing payload
- `InsightWeightContext` — weight data sent to the AI; includes `latestKg`, `previousKg`, `targetKg`, `trend7d`, `last7Values`, `isOutlierPrevious`, `isOutlierLatest`, `daysSinceLastMeasurement`, `lastMeasurementDate: string | null` (ISO date of last measurement)
- `InsightNutritionDay`, `InsightInputContext` — AI input context

### `aiMealEstimate.ts`
- `AiMealEstimatePreview` — meal image estimate result

### `userFoodRelation.ts`
- `FoodRefType` — `'catalog' | 'personal'`
- `UserFoodRelation` — favorite / recent usage tracking per user + food item

### `foodCategory.ts`
- `FoodCategory` — food classification used by hint engine

## Calculation Library (`shared/lib/`)

All functions are pure (no I/O, no state).

| File | Exports | Purpose |
|---|---|---|
| `profileCalculator.ts` | `calculateProfileTargets(input)` | Mifflin-St Jeor BMR, PAL from steps/activity, training bonus, macro targets |
| `nutritionCalculator.ts` | `calculateNutrition(item, mode, amount)` | Scales per-100g values to portion/grams |
| `goalContext.ts` | `evaluateWeightDelta()`, `progressGrowsOnDecrease()` | Goal-relative progress direction |
| `plateauDetector.ts` | `computePlateauSignal(entries)` | Std-dev plateau detection over 28-day window |
| `recipeCalculator.ts` | `calculateRecipeNutrition(ingredients)` | Recipe totals + per-portion |
| `activityBonusCalculator.ts` | `calculateActivityBonus(inputs, weightKg, dailyCalorieTarget)` | V3 piecewise-linear MET model for hiking; returns `ActivityBonusResult` including V3 intermediates |
| `cyclingBonusCalculator.ts` | `calculateCyclingActivityBonus(inputs, weightKg, dailyCalorieTarget)` | `cycling-met-estimator@1.1.0` — speed + elevation + terrain + eBike MET model for cycling; 250 spec test cases |

### `activityBonusCalculator.ts` — V3 Algorithm (Hiking)

Implements a piecewise-linear MET model based on Ainsworth Compendium 2024, Pandolf et al. (1977), and Minetti et al. (2002).

**Calculation steps:**

1. **Guard** — if `distanceKm = 0` or `movementTimeMinutes = 0`, returns `activityBonus = 0`.
2. **Backward compatibility** — `hasBackpack: true` maps to `packCategory: 'medium'`; absent `terrainType` defaults to `'path'`.
3. **Speed → `metBase`** — flat-terrain walking MET via `SPEED_ANCHORS` lerp (floor 2.0, cap 4.5).
4. **Elevation deltas** — ascent/descent distance split proportionally; `gainPerKm` → `Δ_asc` via `ASCENT_ANCHORS`; `lossPerKm` → `Δ_desc` via `DESCENT_ANCHORS` (non-monotone, minimum at 100 m/km).
5. **`metLocomotion`** — `metBase + Δ_asc·f_asc + Δ_desc·f_desc` (Naismith-weighted phase fractions).
6. **Terrain** — `metLocomotion × terrainFactor` (`path=1.00`, `trail=1.35`, `alpine=1.45`, `scramble=1.60`).
7. **Pack** — `deltaPack` added after terrain multiplication (`none=0.0`, `small=0.5`, `medium=1.0`, `heavy=1.5`).
8. **`estimatedMet`** — clamped to `[2.0, 9.5]`.
9. **`activityCalories`** — `estimatedMet × weightKg × movementTimeH`.
10. **`activityBonus`** — `max(0, activityCalories − alreadyAccountedCalories)`, rounded to nearest 50 kcal. `alreadyAccountedCalories = dailyCalorieTarget × (movementTimeH / 24)`.

### `cyclingBonusCalculator.ts` — V1.1 Algorithm (Cycling)

Implements the `cycling-met-estimator@1.1.0` model. Spec source: `docs/kb/Specs/specialActivityBike/`. 250 test cases, all verified.

**Inputs:** `distanceKm`, `movementTimeMinutes`, `elevationGainM`, `elevationLossM?`, `asphaltShare`, `gravelShare`, `trailShare`, `ebikeSupport`.

**Key formula chain:**
1. `averageSpeedKmh = distanceKm / (movementTimeMinutes / 60)`
2. `speedMet` — piecewise interpolation from speed lookup table (floor 2.3 at 0 km/h, peaks at 35 km/h)
3. `uphillBonusMet` — piecewise interpolation from elevation rate lookup table
4. `terrainBonusMet = asphaltShare×0 + gravelShare×0.5 + trailShare×1.5`
5. `gravityFactor` — reduces speed contribution when descent dominates
6. `effectiveSupport` — eBike reduction: `supportReduction × speedMotorFactor × downhillMotorFactor` (0.0 for NONE, up to 0.75 for HIGH at low speeds)
7. `finalMetRaw = speedMetWithMotor + uphillBonusWithMotor + terrainBonusMet`
8. `estimatedMet = roundHalfUp(finalMetRaw, 1)`
9. `activityCalories = finalMetRaw × weightKg × movingTimeHours` (uses unrounded MET)
10. `activityBonus = max(0, activityCalories − normalCalories)`, rounded to nearest 50 kcal

**eBike support levels:** NONE=0%, LIGHT=35% speed / 40% uphill reduction, HIGH=75% / 75%.

## Import Pattern for Backend

```ts
// TYPE imports — use alias freely
import type { UserProfile, MealType } from '@fittrack/shared';

// VALUE imports — use relative paths only
import { calculateProfileTargets } from '../../../shared/lib/profileCalculator';
import { PROGRESS_INTELLIGENCE_VERSION } from '../../../shared/types/insight';
```

See [tech/02-backend.md](02-backend.md#import-rules) for full explanation.
