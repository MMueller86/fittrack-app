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
- `DayMeta` — per-day metadata (`dayType: 'rest' | 'training'`, `workoutType`)
- `ReusableItem` — user's personal food library item; includes AI-generated `searchTerms` and `aiKeywords`
- `FoodSearchResult` — unified search result (library + catalog); includes `source`, `portion`, `isComplete`
- `AiFoodEstimatePreview` — AI food estimation with `confidence`, `warnings`, `estimatedPortion`
- `NutritionLabelScanResult` — OCR + AI label extraction result

### `recipes.ts`
- `RecipeIngredient` — amount in grams, linked to food catalog or reusable item
- `RecipeStep` — ordered instruction
- `RecipeImage` — blob reference + SAS URL
- `RecipeNutrition` — `{ calories, protein, carbs, fat, fiber }` totals + per-portion
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
- `InsightWeightContext`, `InsightNutritionDay`, `InsightInputContext` — AI input context

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

## Import Pattern for Backend

```ts
// TYPE imports — use alias freely
import type { UserProfile, MealType } from '@fittrack/shared';

// VALUE imports — use relative paths only
import { calculateProfileTargets } from '../../../shared/lib/profileCalculator';
import { PROGRESS_INTELLIGENCE_VERSION } from '../../../shared/types/insight';
```

See [tech/02-backend.md](02-backend.md#import-rules) for full explanation.
