# AI Integrations

## Principle

All AI calls are backend-only. No AI keys or direct AI calls in the mobile app. Mobile calls FitTrack backend APIs; the backend orchestrates AI.

## Azure Services

| Service | Model / Config | Purpose |
|---|---|---|
| Azure OpenAI | `gpt-4o-mini`, Structured Outputs | Meal parsing, food estimation, recipe analysis, daily insight |
| Azure Document Intelligence | Standard / Free tier | OCR for nutrition label scan |

Azure OpenAI uses **Structured Outputs** (JSON Schema enforcement on model response) for all features that return machine-readable data. API version must be ≥ `2024-07-01`.

## AI Features

### 1. Meal Parser (`POST /api/ai/parse-meal`)

User describes a full meal in natural language (e.g., "200g chicken with rice and salad"). AI extracts individual items with amounts and modes. Backend searches the food catalog for each item and classifies match status.

**Flow:**
1. Enforce quota (`meal-parser`)
2. AI extracts items → `AiParsedItem[]` (rawText, displayName, inputMode, inputAmount)
3. For each item: search food catalog + user library in parallel
4. `classifyItem()` — `matched | needsSelection | unmatched` per item
5. Track usage
6. Return `MealParserPreviewResponse`

Mobile shows `MealParserReviewScreen` — user reviews matches, resolves unmatched, confirms.

### 2. Food Estimator (`POST /api/ai/food-estimate`)

User describes a single food item. AI estimates nutrition per 100g and suggests a portion.

**Returns:** `AiFoodEstimatePreview` — `{ displayName, estimatedNutritionPer100g, estimatedPortion, confidence, warnings }`

Mobile shows `FoodEstimateReviewScreen` — user can edit and re-estimate before saving.

### 3. Food Estimate Batch (`POST /api/ai/food-estimate/batch`)

Batch variant for estimating multiple items at once (used internally by meal parser flow).

### 4. Label Scan (`POST /api/ai/label-scan`)

User photographs a nutrition label. Backend:
1. Sends image to Azure Document Intelligence (OCR)
2. Passes OCR text to Azure OpenAI for structured extraction
3. Runs plausibility validation

**Accepts:** Multipart form-data, JPEG/PNG, max 4MB  
**Returns:** `NutritionLabelScanResult` — includes `ocrConfidence`, `aiConfidence`, `warnings`, `rawOcrText`

Mobile shows `LabelScanReviewScreen` — user reviews and edits before saving.

### 5. Meal Estimate (Image-based)

User photographs a prepared meal. AI estimates nutrition from the image.

**Returns:** `AiMealEstimatePreview`

Mobile shows `MealEstimateReviewScreen`.

### 6. Recipe Analyzer (`POST /api/ai/recipe-analyze`)

User provides a free-text recipe. The AI extracts ingredients and returns positive total gram weights for every `food` ingredient, including conversions such as `2 EL` → approximately `30 g`.

**Used by:** `RecipeWizardScreen` on mobile.

The backend resolves the analyzer's normalized food names directly against the catalog. It does not re-run the general meal parser, so the analyzer's kitchen-unit conversions remain attached to the matching food.

### 7. Reusable Item Enrichment (`POST /api/reusable-items/{id}/enrich`)

After a user creates a reusable item, the backend enriches it asynchronously by generating:
- `searchTerms` — alternative search queries
- `aiKeywords` — keywords for auto-matching in meal parser

A timer trigger (`reusableItemsEnrichScheduler.ts`) processes pending enrichments in batch.

### 8. Daily Insight (`GET /api/ai/daily-insight`)

Once-daily AI-generated personal briefing. Never returns 4xx/5xx to the user — falls back to friendly `quota_exceeded` or `unavailable` responses.

**Cache strategy:**
- One Cosmos document per user per calendar day (`id = ${userId}:${date}`)
- Served from cache when input hash unchanged or min interval not met
- Max 3 regenerations per day (non-admin users)
- Internal users always regenerate

**Input:** `InsightInputContext` — weight context, nutrition days, profile, progress intelligence signals

**Output:** `InsightResponse` — title (max ~40 chars), summary (60–120 words), optional recommendation + CTA

**Prompt versioning:** `DAILY_INSIGHT_PROMPT_VERSION` constant (e.g., `'v6'`). Version is stored with each generated insight for reproducibility.

### 9. Weekly Insight (`GET /api/ai/weekly-insight?date=YYYY-MM-DD`)

The authenticated weekly endpoint returns exactly the seven completed local
calendar days from `date - 7` through `date - 1`. The current day is excluded.
The backend reads meals and DayMeta documents for the authenticated user and
calculates consumed calories, historical base/effective targets, target
percentages, target-band state, missing-data state, activity labels, and totals.
The current profile is never used to reconstruct a historical target.

The deterministic review remains available when AI is unavailable. The
`evaluation` object has status `fresh`, `cached`, `quota_exceeded`, or
`unavailable`; quota, provider, parse, and Structured Output failures return
`text: null` rather than a deterministic replacement assessment.

Weekly evaluations are cached in the existing `aiInsights` container as
`_docType: 'weeklyInsight'`, keyed by `${userId}:weekly:${periodEnd}`. The cache
input hash covers meal/item identities and stored macros, DayMeta/activity and
target snapshots, the reference date, and the prompt version. Identical input is
served without an AI call. After a hash change, the old text is never shown; a
30-minute regeneration interval may produce a neutral response while the chart
remains usable.

The weekly prompt is `WEEKLY_INSIGHT_PROMPT_VERSION = 'v2'` in
`backend/src/lib/prompts/weeklyInsightV1.ts`. It receives only sanitized aggregate
data for the seven days and totals: no meal/product raw text, user IDs, tokens, or
technical cache data. The generator uses Strict Structured Outputs with
`strict: true`, `additionalProperties: false`, and a single `text` property
(1–750 characters). The canonical backend limit is
`WEEKLY_INSIGHT_TEXT_MAX_LENGTH = 750`; the generated text is trimmed before the
server-side length check. The request allows `max_tokens: 1024` output tokens,
which is a token budget rather than a character limit. A provider response with
`finish_reason: 'length'` is rejected before any valid text is persisted or
`daily-insight` usage is tracked; the handler may persist only a neutral
`unavailable` cache entry with `text: null`.

## Hint Engine (Rule-Based, Not AI)

`backend/src/lib/hintEngine.ts` — evaluates a declarative rule array against the current diary state. No AI calls. Returns the first matching `HintResult`.

- H1–H28: situational rules (orientation, day context, positive feedback)
- M0–M9: motivational fallback hints (cyclic rotation, 30-day cooldown each)
- Cooldown system: hints remember last shown date and suppress repetition

**Called from:** diary GET handler, after assembling the day context.

## Progress Intelligence Engine

`backend/src/lib/progressIntelligence.ts` — computes behavioural signals from raw weight + nutrition data. Pure module. Feeds the daily insight prompt.

Signals include: trend, phase (gaining/losing/stable), plateau detection, milestones, monthly data points.

## Quota System

All AI features enforce monthly quotas per user per feature. See [domain/08-quota-system.md](../domain/08-quota-system.md).

## Prompt Files

Located in `backend/src/lib/prompts/`:
- `mealParser.ts` — system prompt for meal text parsing
- `foodEstimate.ts` — system prompt for food estimation
- `mealEstimate.ts` — system prompt for meal image estimation
- `recipeAnalyze.ts` — system prompt for recipe text analysis
- `dailyInsightV9.ts` — current daily insight system prompt (versioned)
- `weeklyInsightV1.ts` — weekly insight system prompt and sanitized context contract (versioned)

[Rule] Prompt files are versioned. When a prompt changes in ways that would alter output format or interpretation, increment the version (e.g., `V6` → `V7`). Store the version constant alongside the prompt.
