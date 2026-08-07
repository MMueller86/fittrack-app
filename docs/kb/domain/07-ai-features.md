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
| Recipe Analyzer | (via ai.ts) | `recipe-analyze` | `RecipeWizardScreen` |
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

**Prompt version:** `RECIPE_ANALYZE_PROMPT_VERSION = 'v2'`

**Input:** Free-text recipe (ingredients + steps)

**Used in:** `RecipeWizardScreen` to speed up recipe creation.

**AI output (`AiRecipeRaw`):**

The AI returns a fully structured recipe including `suggestedName`, `description`, `suggestedPortions`, `tags`, `steps`, and an `ingredients` array. Each ingredient is an `AiRecipeIngredientLine`:

```ts
interface AiRecipeIngredientLine {
  line: string;           // full original text, e.g. "300g Hähnchenbrust"
  displayName: string;    // clean name without quantity, e.g. "Hähnchenbrust"
  category: 'food' | 'seasoning';
  amountGrams: number | null;
}
```

**Ingredient classification rules:**

- `food`: calorically or nutritionally relevant ingredients used in meaningful amounts (e.g. Hähnchenbrust, Pasta, Tomaten, Käse, Butter, Mehl, Zucker, Sahne).
- `seasoning`: ingredients used in small amounts whose nutritional contribution is negligible (e.g. Salz, Pfeffer, Kräuter, Gewürze, Essig, Sojasauce, Worcestersauce, Paprikapulver). These do not meaningfully affect the recipe's nutrition profile.

**Amount resolution:**

The AI resolves all amounts to grams or millilitres. Standard conversions apply (`1 TL` → ~5g, `1 EL` → ~15g, `1 Prise` → ~1g). For piece-based quantities (e.g. "2 Eier"), the AI estimates total weight. When no amount is given, a plausible amount is estimated for the specified number of portions. `null` is returned only when the amount is truly indeterminate from context.

**Backend routing logic:**

After the AI call, ingredients are split into two groups and processed differently:

1. **`food` items** — joined as a comma-separated string and passed to `parseMeal()`. Results are bundled via `bundleAiItems()`, then resolved against the food catalog via `resolveIngredients()` (catalog search + AI estimation fallback). Each resolved item gets `category: 'food'`.
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

## 6. Daily Insight

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
