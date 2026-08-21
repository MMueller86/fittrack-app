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
| Daily Insight Feedback | POST /api/ai/daily-insight/feedback | None | Required-comment Bottom Sheet in `InsightCard` |
| Weekly Insight | GET /api/ai/weekly-insight?date=YYYY-MM-DD | `daily-insight` (shared personal-insight budget) | Backend endpoint; Mobile integration in F-1 |

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

The backend builds a server-owned `InsightInputContext` from the current diary
and DayMeta, the last three completed diary days, profile/goal data, weight
history, and deterministic progress-intelligence signals. A present MealItem
is valid nutrition data even when its calories or macros are `0`; a day without
a MealItem remains missing (`null`) and is not represented as an invented
zero. Historical calorie resolution is snapshot-first:

1. valid `DayMeta.calorieTargetSnapshot.calories`;
2. compatible stored `specialActivity.dailyCalorieTarget` for older activity
  documents;
3. read-only `profile_fallback` using the stored training target for an
  explicitly stored training day, otherwise the rest target;
4. unavailable when a special activity exists without a usable stored target.

The profile fallback is never persisted as historical data or presented as a
historical fact. Historical activity, target source, activity bonus, day type,
and workout type remain attached to their own day context.

### Daily intent and activity status

The backend selects exactly one `InsightIntent` deterministically. The priority
is:

1. `activity_focus` for any present special activity;
2. `weight_signal` for a strong plateau, milestone, or recovered-phase signal;
3. `phase_progress` for `phase_context`;
4. `morning_orientation` before local hour 10 when today has no MealItem;
5. `nutrition_guidance` when current nutrition and targets are available;
6. `general` otherwise.

The AI receives the selected intent but cannot change it. For a present current-
day activity, `localHour` `0..19` yields `planned` and `20..23` yields
`likely_completed`. Missing, invalid, or non-current-day hour data yields
`unknown`; without an activity, status and source are `null`. The source is
`local_time_heuristic` for valid hours and `unavailable` for unknown status.
There is no confirmed `completed` status. `planned` and `unknown` forbid
completed-activity language; `likely_completed` permits only probabilistic or
conditional wording. Long/intensive endurance activity is handled with
qualitative fueling (including carbohydrates or energy), fluids, and recovery
language, without adding unapproved numeric nutrition thresholds.

The current Mobile Daily request also sends `timezoneOffsetMinutes`, interpreted
as local time minus UTC (for example, UTC+2 is `120`). Only integer values in
`[-840,840]` are valid. Missing or invalid values normalize to `null` and use a
tolerant legacy fallback: the date default remains the backend UTC date,
current-day activity evidence remains unknown, and expiry falls back to UTC
midnight. A valid offset compares the requested date with the offset-adjusted
local date, enables the validated `localHour` activity heuristic only for that
current day, and sets new Daily documents to expire at the next local midnight
represented as UTC. The Cosmos `ttl` is the ceiling of the remaining seconds.
The normalized offset is part of the input hash, so a changed normalized offset
follows the normal cache regeneration rules.

### v14 prompt, output, and failure contract

`DAILY_INSIGHT_PROMPT_VERSION = 'v14'`. The selected focused module is combined
with the shared German tone/output contract. The backend stores the exact
`promptSnapshot.system` and serialized `promptSnapshot.user` sent to Azure
OpenAI. Strict Structured Outputs use `json_schema`, `strict: true`, required
properties, nullable optional values, and `additionalProperties: false`.

The active composition root is `backend/src/lib/prompts/dailyInsightPrompt.ts`.
The shared Strict Structured Output schema is defined in
`backend/src/lib/dailyInsightSchema.ts`, and the append-only v14 release lock
is in `backend/src/lib/prompts/dailyInsightPromptManifest.ts`. The computed
global v14 content identity is
`sha256:5e03af4f2175a24d71db49910185ed4384a46eeb4932ff1527c544fb854cbe1a`.
The root relocation kept the v14 provider-facing system and user prompt bytes
unchanged; offline compatibility tests lock the six system-prompt hashes.

The release identity is dual: `promptVersion` is the human-readable release
identifier and `promptFingerprint` is the SHA-256 identity of the canonical
complete prompt bundle, including prompt fragments, guard policy, assembly
version, and Strict Structured Output schema. In addition, each generated
Daily instance stores `systemPromptHash`, the SHA-256 hash of the exact,
intent- and context-dependent `promptSnapshot.system` sent to Azure OpenAI.
This third value distinguishes the concrete provider system prompt even when
the global bundle identity and release version are unchanged.

The server validates the parsed response and rejects provider truncation or
content filtering, empty/invalid/schema-invalid responses, CTA/target
mismatches, budget/protein contradictions, definitive activity claims,
stale-as-current weight claims, and forbidden technical wording. The public contract is
character-based: `title` is at most 40 characters, `summary` at most 600,
`recommendation` at most 240, and `cta` at most 80. There is no server-side
60-120-word summary validator. A failed context read, provider failure,
truncation/content-filter result, or server validation failure returns friendly
`unavailable` as HTTP `200`, is not persisted, and does not consume or track
Daily quota. Quota exhaustion is also a friendly HTTP `200` with
`status: 'quota_exceeded'` and no tracking.

The v14 stale-weight safety contract is global because the shared tone guard is
included in every selected intent, not only the weight-focused modules. For
`daysSinceLastMeasurement > 14`, weight or trend language is allowed only with
an explicit stale marker such as `veraltet` or `nicht aktuell`; day 14 remains
current and day 15 is stale. A stale-as-current sentence such as
`Dein Gewicht ist heute klar gesunken.` is rejected, while explicit stale
wording such as `Der Trend deines Gewichts ist nicht aktuell.` is accepted.
The runtime root cause was that the stale rules had previously existed only in
`promptWeight`, while deterministic `nutrition_guidance` selected
`promptNutrition`; the fix introduced in v11 remains active in v14 and applies the shared guard to that path and all other
intents. Server-side validation remains strict and was not weakened.

Negative calorie budget is authoritative. A `remainingProteinG` value of
`null` is unknown; a value at most 20 is treated as nearly complete. Neither
state creates an additional protein action, and a negative calorie budget
blocks further same-day food recommendations.

The cache hash preserves the prompt's semantic boundaries instead of relying
only on rounded numeric values. `remainingCalories` is bucketed as
`unknown` for `null`, undefined, or non-finite values, `negative` for values
below zero, `zero` for exactly zero, and `positive` for values above zero.
`remainingProteinG` is bucketed as `unknown` for `null`, undefined, or
non-finite values, `nearly_complete_below` for values below 20,
`nearly_complete_at` for exactly 20, and `gap` for values above 20. Therefore
the cache distinguishes `-0.01`, `0`, and `0.01`, as well as `19.99`, `20`,
and `20.01`, while retaining the existing rounding stability outside a
controlling boundary.

### Daily cache and persistence

New Daily documents use `_docType: 'dailyInsight'` and
`id = ${userId}:${date}` in the existing `aiInsights` container. They persist
the input context/hash, selected intent, prompt version, global prompt
fingerprint, concrete system-prompt hash, and exact prompt snapshot, model,
response, token usage, and intelligence version. The hash includes the release
version, both prompt identities, intent, local-hour bucket, activity/status
data, semantic nutrition buckets, current and historical nutrition/targets,
weight/progress signals, and the other prompt inputs. Missing or mismatched
prompt version, `promptFingerprint`, `systemPromptHash`, `intent`, or
`promptSnapshot` is a hard cache invalidation, independent of the regeneration
interval, daily limit, or admin status. An old response is never returned as a
new v14 result.

An unchanged hash returns `cached`. A changed hash is subject to a 30-minute
minimum interval and a maximum of three generations for non-admin users;
admin users bypass these gates in the current handler. Daily documents keep
their per-document `ttl` and `expiresAt` until the existing Daily expiry.

The relevant provenance fields are additive Class 0/read-compatible schema
changes in the existing `aiInsights` container. `promptFingerprint` and
`systemPromptHash` remain optional legacy-compatible fields on both Daily and
Feedback documents. `intent` and `promptSnapshot` are optional on the Daily
document type so documents written before this release remain readable; new
Daily documents set the complete provenance. No global backfill, migration,
new container, or partition-key change is used for this prompt-provenance
change. Legacy Daily documents remain readable through the repository, but
missing or mismatched current provenance makes them ineligible for a cache hit
and for new feedback. Legacy feedback documents remain readable with their
historical fields and are not rewritten or backfilled.

### Negative feedback and traceability

Negative feedback is submitted through
`POST /api/ai/daily-insight/feedback`. The authenticated server accepts only
`date`, canonical UTC `insightGeneratedAt`, UUID `submissionId`, and a trimmed
1-500 character `userComment`. The request is bound to the exact stored Daily
instance; a missing instance returns `404`, a changed generation returns
`409`, and a legacy Daily without required provenance returns
`feedback_snapshot_unavailable`. The idempotency lookup happens before the
Daily read, so an identical retry remains `200 created: false` after Daily
expiry. A changed body with the same ID is rejected.

Each new submission creates one durable `_docType: 'insightFeedback'` document
under the authenticated user's `/userId` partition. The server-owned
traceability contract is:

Feedback processing status is persisted as `Open`, `Done`, or `Rejected`:
`Open` means unhandled and needing triage, `Done` means reviewed and handled,
and `Rejected` means reviewed and not accepted for action. New feedback starts
at `Open`. For backward compatibility, a missing `processingStatus` on a
legacy feedback document is normalized to `Open` on reads and operational
searches. The only allowed transitions are `Open -> Done` and
`Open -> Rejected`; writing the current state again is an idempotent no-op.
`Done` and `Rejected` are terminal and cannot transition to each other or
back to `Open`. Unresolved operational searches include only feedback with a
missing status or `Open`; handled searches include only `Done` or `Rejected`.
Every such search is scoped to `_docType = 'insightFeedback'`.

| Persisted field | Source / meaning |
|---|---|
| `insightId` | Exact matched Daily document ID |
| `date` / `insightGeneratedAt` | Exact Daily date and stored generation timestamp |
| `userComment` | Exact server-trimmed negative comment |
| `response` | Complete generated/displayed Daily response |
| `promptSnapshot.system` / `.user` | Exact provider system prompt and serialized user message |
| `promptVersion` / `intent` | Stored v14 version and deterministic server intent |
| `promptFingerprint` | Global content identity copied from the exact Daily instance |
| `systemPromptHash` | SHA-256 identity of the exact context-specific system prompt |
| `inputContext` / `inputHash` | Complete server input and its cache hash |
| `model` / `intelligenceVersion` / `tokensUsed` | Server deployment, intelligence schema, provider token usage |
| `submittedAt` | Server-generated submission timestamp |

Feedback is not quota-tracked, has neither `ttl` nor `expiresAt`, and is not
automatically deleted. The existing authorized administrative/operational
direct-read access may read these documents directly in `aiInsights` for later
analysis. PO-6A is resolved at this boundary: this feature introduces no new
application role, permission model, Admin UI, read endpoint, or cleanup
endpoint, and it gives no implicit database access to normal users or arbitrary
admins. Any later manual database cleanup remains an operational follow-up
outside the feature. Updating the compatibility `feedbackScore` marker is
conditional on the same Daily identity and does not extend the Daily
document's existing TTL or expiry.

The backend Daily GET emits the server-owned boolean `feedbackAvailable`.
It is `true` only for a stored Daily with complete feedback provenance,
including both prompt identities and the exact snapshot, and `false` for
legacy or incomplete instances. The Mobile type keeps the field optional for
compatibility; the feedback POST remains authoritative and returns
`feedback_snapshot_unavailable` when the stored Daily lacks the required
snapshot or identity.

## 8. Weekly Insight

**Trigger:** `GET /api/ai/weekly-insight?date=YYYY-MM-DD`

The authenticated endpoint returns seven completed local calendar days,
`date - 7` through `date - 1`, with deterministic server-side nutrition and
target metrics. The current day is excluded. Each day reports consumed calories,
historical base/effective target, target percentage, target-band state, data
availability, day type, and a neutral label for a known hiking or cycling activity.

The backend never reconstructs an old target from the current profile. It uses a
stored `DayMeta.calorieTargetSnapshot` first and a valid stored
`specialActivity.dailyCalorieTarget` as a compatible legacy source. Missing
nutrition and missing targets are independent states. A present MealItem is valid
nutrition even when its stored calories are `0`; an empty Meal is missing nutrition.
Only days with both nutrition and a positive effective target contribute to totals.

The AI receives only sanitized aggregate values for these seven days and the
calculated totals. Meal names, product text, user IDs, tokens, and cache details
are excluded. The prompt is versioned (`WEEKLY_INSIGHT_PROMPT_VERSION = 'v2'`)
and uses Strict Structured Outputs with one validated `text` field. The generated
text is trimmed and limited to exactly 750 characters at most; it is advisory and
interpretive and must not invent missing data or make medical, deficit, or diagnosis
claims. A length-truncated provider response is unavailable and is not counted
toward the shared insight quota.

Weekly results are cached separately from daily insights in the existing
`aiInsights` container under `_docType: 'weeklyInsight'`. The cache is invalidated
when meal/item macros or identities, DayMeta/activity/target snapshots, or the
prompt version changes. The old text is never returned after a hash change,
including the v1-to-v2 prompt bump.
Quota is checked with the shared `daily-insight` key before AI and usage is tracked
only after a fully valid AI response. Quota, provider, parse, and schema failures
keep the deterministic chart data available and return `evaluation.text: null`.

## Confidence & Warnings Pattern

All AI-generated nutrition values carry:
- `confidence: number` — 0.0 (unreliable) to 1.0 (high confidence)
- `warnings: string[]` — natural language alerts (e.g., "unusually high calorie density")

[Rule] Confidence and warnings must be displayed to users before they confirm. They must not be silently discarded.

## Structured Outputs

Azure OpenAI Structured Outputs are used for all features that return machine-readable data. This enforces JSON schema compliance at the model level, eliminating parsing failures.

Required: API version ≥ `2024-07-01`, model ≥ `gpt-4o-mini 2024-07-18`.

## Prompt Versioning

Each prompt has a version constant (e.g., `DAILY_INSIGHT_PROMPT_VERSION = 'v14'`). This readable version and the computed global `promptFingerprint` are stored with each new generated Daily document in Cosmos. The concrete `systemPromptHash` is stored for the exact composed system prompt used by that instance. When a provider-visible prompt, guard, assembly, or schema change affects output interpretation, the version must be incremented and the append-only release manifest updated.
