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

The Daily Insight is a once-per-day AI-generated personal briefing. The
endpoint keeps the user-facing failure contract at HTTP `200`: quota and
context/provider failures return a friendly `quota_exceeded` or `unavailable`
`InsightResponse` instead of exposing a `4xx`/`5xx` AI error. A context read
failure does not call the provider, persist an incomplete insight, or consume
Daily quota.

**Request and local-time boundary:**
- `date` is the cache and context date. If it is absent or does not have the
	`YYYY-MM-DD` shape, the handler falls back to the current backend UTC date;
	the handler does not perform an additional calendar-date validation.
- `localHour` is optional and is accepted only as an integer from `0` through
	`23`. Missing, non-integer, or out-of-range values become `null` and produce
	an unknown activity status when an activity exists.
- `timezoneOffsetMinutes` means local time minus UTC (for example, UTC+2 is
	`120`). Only integer values in `[-840,840]` are valid. Missing or invalid
	values normalize to `null` and retain a tolerant legacy fallback: the date
	default remains the backend UTC date, local-hour activity evidence is not
	treated as current-day evidence, and expiry uses UTC midnight.
- With a valid offset, current-day detection compares the requested date with
	the offset-adjusted local date. This controls whether the validated
	`localHour` may produce `planned` or `likely_completed`; otherwise an
	activity remains `unknown`. A newly persisted Daily insight expires at the
	next local midnight represented as UTC, with Cosmos `ttl` set to the ceiling
	of the remaining seconds. The normalized offset is included in the input
	hash, so a changed normalized offset follows the normal cache regeneration
	rules.

**Input context and deterministic routing:**
- `InsightInputContext` contains the current date/day context, weight and goal
	data, progress-intelligence signals, current nutrition and effective target,
	and the last three completed diary days.
- A present `MealItem` is valid nutrition data even when its calories or macros
	are `0`; a day without a MealItem remains `null` rather than an invented
	zero. Historical days carry their own nutrition, activity and target data.
- Historical calorie targets resolve snapshot-first: a valid
	`DayMeta.calorieTargetSnapshot`, then the compatible stored
	`specialActivity.dailyCalorieTarget`, then a read-only `profile_fallback`
	unless a special activity has no usable stored target. The fallback is never
	persisted or presented as a historical fact.
- The server selects exactly one `InsightIntent` deterministically, in this
	order: `activity_focus` for any present activity; `weight_signal` for a
	strong plateau/milestone/recovered-phase signal; `phase_progress` for
	`phase_context`; `morning_orientation` before 10:00 with no current
	MealItem; `nutrition_guidance` with current nutrition and targets; otherwise
	`general`. The AI cannot change the selected intent.
- With an activity, `activityCompletionStatus` is `planned` for local hours
	`0..19`, `likely_completed` for `20..23`, and `unknown` for missing/invalid
	hours or a non-current requested date. Without an activity the status and
	source are `null`. `likely_completed` is probabilistic, never a confirmed
	completion fact; the persisted `SpecialActivity` type is unchanged.

**v11 prompt and validation contract:**
- `DAILY_INSIGHT_PROMPT_VERSION` is `'v11'`. The selected intent module is
	combined with the shared German tone/output contract and the exact system
	prompt plus serialized user message are persisted as `promptSnapshot`.
- Azure OpenAI uses Strict Structured Outputs with `json_schema`,
	`strict: true`, all properties required, nullable optional values, and
	`additionalProperties: false`. The server additionally validates the
	response and rejects provider truncation/content filtering, empty or invalid
	JSON, CTA/target mismatches, budget/protein contradictions, definitive
	activity claims, stale-as-current weight claims, and forbidden technical wording.
- The public response contains `title` (maximum 40 characters), `summary`
	(maximum 600 characters), optional `recommendation` (maximum 240), optional
	`cta` (maximum 80), optional `ctaTarget`, `generatedAt`, `promptVersion`, and
	`status`. The provider schema uses nullable optional fields; the public
	response omits optional fields whose value is `null`.
- The v11 stale-weight contract is global: the shared tone guard is included
	in every selected intent, including `activity_focus`, `nutrition_guidance`,
	`morning_orientation`, and `general`, not only the weight-focused modules.
	For `daysSinceLastMeasurement > 14`, weight or trend data is stale; day 14
	remains current and day 15 is stale. A stale reference may be omitted or
	must use an explicit marker such as `veraltet` or `nicht aktuell`. A current
	claim such as `Dein Gewicht ist heute klar gesunken.` is rejected, while an
	explicit stale notice such as `Der Trend deines Gewichts ist nicht aktuell.`
	is accepted.
- The runtime root cause was corrected in v11: stale-weight rules had been
	present only in `promptWeight`, while deterministic `nutrition_guidance`
	routing selected `promptNutrition`. The shared guard now covers that path
	and all other intents; server-side validation remains strict and was not
	weakened.
- A context read failure, provider failure, truncation/content-filter result,
	or server validation failure returns HTTP `200` with `status: 'unavailable'`.
	The failed result is not persisted and does not consume or track Daily quota.

**Cache and quota strategy:**
- A Daily document is keyed by `${userId}:${date}` in the existing `aiInsights`
	container and uses `_docType: 'dailyInsight'`. An unchanged input hash is
	served as `cached`; a changed hash is subject to the non-admin 30-minute
	regeneration interval and maximum of three generations per day. Admin
	users bypass these regeneration and quota gates in the current handler.
- The hash includes the active prompt version, selected intent, local-hour
	bucket, activity/status data, current and historical nutrition/target data,
	weight/progress signals, and other prompt inputs. A v11 prompt/version or
	provenance change invalidates an older Daily cache.
- Daily documents retain their existing per-document TTL/expires-at
	behaviour. Feedback documents are separate and have no TTL; see the API and
	domain contracts below.
- Daily quota is checked before Azure OpenAI and tracked only after a valid
	response. Quota exhaustion is returned as HTTP `200` with
	`status: 'quota_exceeded'`; feedback is not an AI call and is not quota
	tracked.

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
`backend/src/lib/prompts/weeklyInsightV2.ts`. It receives only sanitized aggregate
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
- `dailyInsightV10.ts` (current module, exporting prompt version `v11`) plus the intent modules `sharedTone.ts`, `promptWeight.ts`, `promptActivity.ts`, `promptNutrition.ts`, `promptMorning.ts`, and `promptGeneral.ts` — current daily insight system prompt (versioned)
- `dailyInsight.eval.test.ts` and `dailyInsight.eval.fixtures.ts` — live Daily Insight prompt evaluations
- `weeklyInsightV2.ts` — weekly insight system prompt and sanitized context contract (versioned)

[Rule] Prompt files are versioned. When a prompt changes in ways that would alter output format or interpretation, increment the version (e.g., `V6` → `V7`). Store the version constant alongside the prompt.
