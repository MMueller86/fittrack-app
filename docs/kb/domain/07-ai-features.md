# AI Features

## Core Principle

All AI features are **guided workflows** — the AI assists, the user confirms. No AI output is saved directly to user data without an explicit review + confirmation step.

[Rule] AI-estimated values must never be silently persisted. The user must always see the estimate and explicitly choose to save it.

## Feature Overview

| Feature | Endpoint | Quota Feature | Review Screen |
|---|---|---|---|
| Meal Parser | POST /api/ai/parse-meal | `meal-parser` | `MealParserReviewScreen` |
| Food Estimator | POST /api/ai/food-estimate | `food-estimate` | `FoodEstimateReviewScreen` |
| Label Scan | POST /api/ai/label-scan | `label-scan` | `LabelScanReviewScreen` |
| Meal Estimator | POST /api/ai/estimate-meal | `meal-estimate` | `MealEstimateReviewScreen` |
| Recipe Analyzer | POST /api/ai/recipe-analyze | `recipe-analyze` | `RecipeWizardScreen` |
| Recipe Scale Preview | POST /api/ai/recipe-scale/preview | `recipe-scale` | Transient recipe detail preview |
| Daily Insight | GET /api/ai/daily-insight | (special) | Inline on `HomeScreen` |

## 1. Meal Parser

**Input:** Free-text meal description (e.g., "200g Hähnchenbrust mit Reis und Salat")

**AI output:** `AiParsedItem[]` — each item has `rawText`, `displayName`, `inputMode`, `inputAmount`

**Backend processing:**
1. For each item: search food catalog + user library in parallel
2. `classifyItem()` assigns status: `matched | needsSelection | unmatched`
   - `matched`: one candidate whose name closely matches → auto-selected
   - `needsSelection`: multiple candidates or weak name match → user picks
   - `unmatched`: no candidates found → user can switch to food estimator
3. Returns `MealParserPreviewResponse` with all items + statuses

**Review screen:** User sees each item with its match status. Can confirm matches, select alternatives, or request AI estimation for unmatched items.

**Key function:** `classifyItem()` in `backend/src/functions/ai.ts` — pure, unit-tested.

## 2. Food Estimator

**Input:** Food name (string)

**AI output:** Nutrition per 100g + optional portion suggestion

**Returns:** `AiFoodEstimatePreview`:
```ts
{
  displayName: string
  estimatedNutritionPer100g: { per: '100g', calories, protein, carbs, fat, fiber }
  estimatedPortion: { label, weightGrams, suggestedAmount? } | null
  confidence: number  // 0.0–1.0
  warnings: string[]
  category: string | null
  searchTerms: string[]
}
```

**Backend validation:** Server-side plausibility checks on nutrition values. Returns 422 if values are outside realistic ranges (hallucination guard).

**Re-estimation:** User can edit the food name and trigger a new estimate from the review screen.

**Save options:** "Als Produkt speichern" (creates `ReusableItem`) or "Einmalig hinzufügen" (flat macros to diary only).

## 3. Label Scan

**Input:** Nutrition label image (JPEG/PNG, max 4MB, multipart form-data)

**Pipeline:**
1. Azure Document Intelligence — extracts raw text from image (OCR)
2. Azure OpenAI — parses OCR text into structured nutrition data
3. `nutritionValidator.ts` — plausibility checks
4. `labelParser.ts` — post-processing and unit normalization

**Returns:** `NutritionLabelScanResult`:
```ts
{
  productName: string | null
  brand: string | null
  baseUnit: '100g' | '100ml' | 'serving'
  servingSize: { label, weightGrams } | null
  nutrition: { calories, protein, carbs, sugar, fat, saturatedFat, fiber, salt }
  ocrConfidence: number   // 0–1
  aiConfidence: number    // 0–1
  warnings: string[]
  rawOcrText: string
}
```

**Timeout:** Up to 60s total (OCR can take 20–30s).

[Rule] Quota is enforced *before* the OCR call (expensive operation).

## 4. Meal Estimator (Image-Based)

**Input:** Photo of a prepared meal

**AI output:** `AiMealEstimatePreview` — detected food items with estimated nutrition

**Review screen:** `MealEstimateReviewScreen`

## 5. Recipe Analyzer

**Prompt version:** `RECIPE_ANALYZE_PROMPT_VERSION = 'v8'`

**Input:** Free-text recipe (ingredients + steps)

**Used in:** `RecipeWizardScreen` to speed up recipe creation.

The Recipe Analyzer is separate from the Food Estimator. It parses a complete recipe into metadata, ordered steps, food ingredients, and seasoning ingredients. It does not create reusable foods and it does not save diary data. The Food Estimator (`POST /api/ai/food-estimate`) remains the single-food nutrition-estimation workflow; in recipe-ingredient search it can be invoked explicitly for one unresolved ingredient and its result is returned to `RecipeWizardScreen` for user confirmation.

**AI output (`AiRecipeRaw`):**

The AI returns a fully structured recipe including `suggestedName`, `description`, `suggestedPortions`, `tags`, `steps`, and an `ingredients` array. Each ingredient is an `AiRecipeIngredientLine`:

```ts
interface AiRecipeIngredientLine {
  line: string;           // full original text, e.g. "300g Hähnchenbrust"
  displayName: string;    // clean name without quantity, e.g. "Hähnchenbrust"
  category: 'food' | 'seasoning';
  amountGrams: number | null; // positive grams for food; null only allowed for indeterminate seasoning
}
```

**Ingredient classification rules:**

- `food`: calorically or nutritionally relevant ingredients used in meaningful amounts (e.g. Hähnchenbrust, Pasta, Tomaten, Käse, Butter, Mehl, Zucker, Sahne).
- `seasoning`: ingredients used in small amounts whose nutritional contribution is negligible (e.g. Salz, Pfeffer, fresh or dried herbs such as Basilikum, Gewürze, Essig, Sojasauce, Worcestersauce, Paprikapulver). Normal kitchen-herb quantities remain `seasoning` even when described as fresh; only an explicitly nutritionally dominant herb quantity becomes `food`. These do not meaningfully affect the recipe's nutrition profile.

**Amount resolution:**

For every `food` ingredient, the AI returns a positive total weight in grams. Standard conversions apply (`1 TL` → ~5g, `1 EL` → ~15g, `1 Prise` → ~1g); millilitres are converted to approximate grams, with density-sensitive ingredients such as dried herbs allowed to fall below the generic teaspoon estimate. For piece-based quantities (e.g. "2 Eier"), the AI estimates total weight. When no amount is given, a plausible gram amount is estimated for the specified number of portions. A `seasoning` with an explicit or reasonably convertible kitchen amount also receives a positive gram estimate; `null` is allowed only when its gram amount is genuinely indeterminate.

**Backend routing logic:**

After the AI call, ingredients are split into two groups and processed differently:

1. **`food` items** — the Recipe Analyzer's normalized ingredient names and positive `amountGrams` values are converted directly to gram-mode parser items, bundled via `bundleAiItems()`, then resolved against the food catalog via `resolveIngredients()`. The general `parseMeal()` flow is not called, so kitchen-unit conversions cannot be lost. Each resolved item gets `category: 'food'`.
2. **`seasoning` items** — constructed directly as `MealParserPreviewItem` with `candidates: []`, `needsReview: false`, and `status: 'seasoning'`. No catalog search is performed.
3. **Unknown/malformed category** — defaults to `'food'` (safe guard: `filter(i => i.category !== 'seasoning')`).

The final `ingredients` array preserves the original order: food items first (as resolved), seasoning items appended.

**`ItemStatus`** (`backend/src/functions/ai.ts`):

```ts
type ItemStatus = 'matched' | 'needsSelection' | 'unmatched' | 'seasoning';
```

- `seasoning` — assigned exclusively to seasoning-classified ingredients; bypasses catalog search.

**`MealParserPreviewItem`** now carries an optional field:

```ts
category?: 'food' | 'seasoning';
```

This allows the review screen (`RecipeWizardScreen`) to render seasoning items differently from food items.

`RecipeStep` persistence contains only `order`, optional `title`, and `description`. Step-level `notes` are not part of the shared recipe type or API contract; historical notes are cleaned lazily on recipe update rather than by a Cosmos migration.

## 6. Recipe Scale Preview

**Prompt version:** `RECIPE_SCALE_PROMPT_VERSION = 'v1'`

**Input:** `{ recipeId, targetPortions }`, where `targetPortions` is a whole number from `1` through `50`.

The authenticated backend loads the recipe by `userId` and `recipeId`, verifies ownership through the repository, and calculates original and target ingredient contexts with the shared deterministic projection. The client cannot supply the original quantities used for the AI context. The AI receives the original description, ordered steps, original ingredient snapshot, server-calculated target ingredient snapshot, and both portion counts.

**Output:** `{ targetPortions, description, steps }`, where `description` is a string or `null` and `steps` contain only `order`, optional `title`, and `description`. The AI response contains no ingredient quantities. Strict Structured Output is used with `additionalProperties: false` at every object level. The backend validates the response shape and rejects any response whose step count or order differs from the stored recipe with `422`.

The preview is advisory and transient. Per the US-05 product decision, this workflow has no additional manual confirmation screen; the mobile view keeps the warning `Die KI kann Fehler machen.` visible. No recipe, nutrition, or diary document is written. Quota is enforced before the AI call and tracked only after a fully valid response. Provider/parse failures return `502`; invalid structured responses return `422`; quota exhaustion returns `429`.

## 7. Daily Insight

**Trigger:** `GET /api/ai/daily-insight` (once per day per user)

**Input context (`InsightInputContext`):**
- Last 7 days of nutrition diary summaries
- Weight history + progress intelligence signals (plateau, trend, milestones)
- User profile (goal type, target weight)
- Current quota usage

**Cache strategy:**
- Cosmos document: `id = ${userId}:${date}` (date in user's local timezone)
- Served from cache when input hash matches or min regeneration interval not elapsed
- Max 3 regenerations/day for normal users; always regenerates for `internal` tier
- Input hash stored alongside document for change detection

**Failure modes (never shows error to user):**
- Quota exceeded → `status: 'quota_exceeded'` with friendly German copy
- AI unavailable → `status: 'unavailable'` with friendly German copy

**Output:** `InsightResponse` — title + summary (60–120 words) + optional recommendation/CTA

## Confidence & Warnings Pattern

All AI-generated nutrition values carry:
- `confidence: number` — 0.0 (unreliable) to 1.0 (high confidence)
- `warnings: string[]` — natural language alerts (e.g., "unusually high calorie density")

[Rule] Confidence and warnings must be displayed to users before they confirm. They must not be silently discarded.

## Structured Outputs

Azure OpenAI Structured Outputs are used for all features that return machine-readable data. This enforces JSON schema compliance at the model level, eliminating parsing failures.

Required: API version ≥ `2024-07-01`, model ≥ `gpt-4o-mini 2024-07-18`.

## Prompt Versioning

Each prompt has a version constant (e.g., `DAILY_INSIGHT_PROMPT_VERSION = 'v6'`). This version is stored with each generated insight document in Cosmos. When prompts change in ways affecting output interpretation, the version must be incremented.
