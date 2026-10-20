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

**Prompt versions:** import `RECIPE_ANALYZE_PROMPT_VERSION = 'v17'`;
saved-recipe preparation `RECIPE_PREPARATION_PROMPT_VERSION = 'v12'`.

**Endpoint:** `POST /api/ai/recipe-analyze`

**Input:** `{ text }`, a free-text recipe with at least 10 and at most 5000 characters.

**Used in:** `RecipeWizardScreen` to speed up recipe creation.

The Recipe Analyzer is separate from the Food Estimator. It parses a complete recipe into metadata, ordered steps, food ingredients, and seasoning ingredients. It does not create reusable foods and it does not save diary data. The Food Estimator (`POST /api/ai/food-estimate`) remains the single-food nutrition-estimation workflow; in recipe-ingredient search it can be invoked explicitly for one unresolved ingredient and its result is returned to `RecipeWizardScreen` for user confirmation.

**AI output (`AiRecipeRaw` / handler preview):**

The structured result contains `suggestedName`, `description`, positive `suggestedPortions`, `tags`, ordered source `steps`, normalized `ingredients`, and one `exportSuggestion`. The analyzer uses Strict Structured Outputs with `additionalProperties: false`. Every ingredient has a unique `analysisKey` within the analysis; export steps and the export ingredient selection reference ingredients only through that key.

Each ingredient is an `AiRecipeIngredientLine`:

```ts
interface AiRecipeIngredientLine {
  analysisKey: string;    // unique within this analysis
  line: string;           // full original text, e.g. "300g Hähnchenbrust"
  displayName: string;    // clean name without quantity, e.g. "Hähnchenbrust"
  category: 'food' | 'seasoning';
  amountGrams: number | null; // positive grams when determinable; null may mark an indeterminate food amount for manual review
  kitchenAmountText: string | null; // kitchen unit for seasoning; null for food
}
```

**Ingredient classification rules:**

- `food`: calorically or nutritionally relevant ingredients used in meaningful amounts (e.g. Hähnchenbrust, Pasta, Tomaten, Käse, Butter, Mehl, Zucker, Sahne).
- `seasoning`: ingredients used in small amounts whose nutritional contribution is negligible (e.g. Salz, Pfeffer, fresh or dried herbs such as Basilikum, Gewürze, Essig, Sojasauce, Worcestersauce, Paprikapulver). Normal kitchen-herb quantities remain `seasoning` even when described as fresh; only an explicitly nutritionally dominant herb quantity becomes `food`. These do not meaningfully affect the recipe's nutrition profile.

**Amount resolution:**

For every `food` ingredient with a determinable quantity, the AI returns a positive total weight in grams. Standard conversions apply (`1 TL` → ~5g, `1 EL` → ~15g, `1 Prise` → ~1g); millilitres are converted to approximate grams, with density-sensitive ingredients such as dried herbs allowed to fall below the generic teaspoon estimate. For piece-based quantities (e.g. "2 Eier"), the AI estimates total weight. When no amount is given but a plausible quantity can be estimated, the AI estimates grams for the specified number of portions. A concrete quantity such as `1 EL Öl` must remain measurable. A genuinely indeterminate food amount such as spray oil used only for coating may return `amountGrams: null` and remains `category: 'food'`; the backend routes it to manual review instead of returning HTTP 502. A `seasoning` with an explicit or reasonably convertible kitchen amount also receives a positive gram estimate; `null` remains valid when its gram amount is genuinely indeterminate.

**Backend routing logic:**

After the AI call, ingredients are split into two groups and processed differently:

1. **`food` items** — the Recipe Analyzer's normalized ingredient names and determinable positive `amountGrams` values are converted directly to gram-mode parser items. Food items with an indeterminate amount become `inputMode: 'unknown'` with `inputAmount: null`, are resolved against the food catalog via `resolveIngredients()`, and are always returned with `needsReview: true`; catalog candidates remain available for the normal search flow. The general `parseMeal()` flow is not called, so kitchen-unit conversions cannot be lost. Each resolved item gets `category: 'food'`.
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

### Current Analyzer and Export Suggestion Contract

Import v17 keeps full source extraction and its export suggestion in one
`analyzeRecipeText(text)` analysis (re-sent for at most two directed corrections). Saved-recipe Preparation v12 uses the separate
small-output `prepareRecipeExport(context)` path below, without source
re-extraction. Prompt intent, runtime validation, fixture quality, and user
review are distinct; none is a general cooking/safety guarantee.

Explicitly numbered input instructions remain one-to-one in the complete ordered source `steps` array; the five-export-step limit never applies to it. `exportSuggestion.steps` contains 1..5 non-empty German texts of at most 90 characters, with orders 1..K. Compression is allowed even when the source has at most five steps. There is no exact-min count, padding, first-five truncation, full partition, or full-detail packing requirement. Each non-empty reference list names actions contained in the export text. Flattened references must be positive, present in the source, globally unique, and strictly ascending; gaps within and between groups are allowed. Genuine structural/reference failures remain HTTP `422`, but omission alone is not a failure.

`exportSuggestion` is generated in the same AI analysis and is only a user-review proposal. Since v17 the provider schema carries an internal per-source-step `cookingEssential` planning flag that the server strips before returning `AiRecipeRaw`. If the response omits a flagged cooking step, merges numbered input steps (enforced only below a "Zubereitung"-style heading), names a temperature that the referenced source steps do not contain, or violates the server contract, `analyzeRecipeText` re-asks with a directed correction (at most two corrections; no extra usage is tracked). If violations remain after the last correction, an invalid reference trace is repaired by moving `sourceStepOrders` only (the references are server-side anchors, not part of any client contract; steps, texts and step count never change). Any other remaining violation fails in a controlled way with HTTP `422` and no usage; a missing `cookingEssential` reference only blocks when the input has numbered instructions. The server never drops or rewrites export steps to hide a violation. Export steps are always sorted by first source reference and food amounts below 0.1 g become `null` server-side. Preparation additionally nulls `totalTimeMinutes` unless the source states the total (including "1 Std. 30 Min."), the durations of all saved steps add up to it, or two or more durations stated in the recipe description add up to it. It has the following fields:

```ts
{
  version: 1;
  teaser: string;                 // 1-96 characters
  totalTimeMinutes: number | null; // positive integer, at most 10080
  difficulty: string | null;       // non-empty, single-line value when known
  steps: Array<{
    order: number;                 // contiguous export order, starting at 1
    description: string;           // 1-90 characters
    sourceStepOrders: number[];    // non-empty ordered subset of source actions
    ingredientKeys: string[];      // existing analysisKey values only
  }>;                              // 1..5 entries
  includedIngredientKeys: string[]; // unique, source order, at most 20
}
```

`totalTimeMinutes` and `difficulty` use the same field names as the persisted export view. During analysis both are nullable because no default may be invented; persistence has its own required-field validation. `includedIngredientKeys` excludes `seasoning`. The backend requires positive, unique, ascending source orders, contiguous export orders, valid ingredient references, and the ordered unique subset trace above. It rejects empty exports, blank descriptions, more than five steps, descriptions above 90 characters, and unknown/duplicate/reordered references with `422`; it does not sort, renumber, or repair identities.

The prompt requests the recipe-specific cooking core: central preparation and cooking, essential separate sides or sauces, and necessary transitions. Merely naming a side does not replace cooking it. Details and serving may be omitted when the core remains understandable; retained statements must fit their source/component without invention or contradiction. Full source-extraction checks remain separate from small, fixture-specific export-core rubrics. The chicken/rice preparation fixture requires chicken preparation, frying, independent rice cooking, and finish-cooking, not every seasoning/heat/resting/serving detail. These test-only checks are not a universal runtime semantic validator or a fixed wording/grouping requirement.

The analyzer is a review workflow. Quota `recipe-analyze` is enforced before the AI call; quota exhaustion returns `429`. Provider, empty-response, or JSON-parse failures return `502`. An AI result failing server shape/reference/ingredient validation returns `422` before usage is tracked; this does not test general cooking semantics. Usage is tracked only after server validation. The response, including `exportSuggestion`, is transient: no reusable food, diary entry, or recipe is saved without a later explicit user-confirmed write. Indeterminate food amounts remain visible with `needsReview: true`; seasonings bypass catalog search and remain visible for review.

`POST /api/recipes/{id}/export-view/prepare` calls backend-only
`prepareValidatedRecipeExport(context)` with the exclusive v12 system prompt, not
import v17. `analyzeRecipeText(text)` is import-only and retains its full
contract, normalization and globally monotone trace validation. Preparation
sends the complete ID-free saved metadata/ingredient projection in
`recipeContext` and all unchanged stored `steps` as untrusted JSON user data.
The Strict `recipe_export_preparation` output is only
`{ version: 1, teaser, totalTimeMinutes, difficulty, steps }`, with step fields
`{ order, description, sourceStepOrders }`. Every field is required and every
object has `additionalProperties: false`; no name, portions, tags, ingredients,
keys or source steps are returned. The lazy client, deployment/API version,
temperature 0.2 and 2048-token budget are unchanged. The loop permits an initial
draft and at most two corrections through `prepareRecipeExport(context, options)`;
each receives immutable original context, the exact latest whole draft and
current diagnostics. Preparation-only SDK retries are disabled. Preparation
validates against separately supplied saved `recipe.steps` and uses the same
`recipe-analyze` quota. It accepts only
`{ "contractVersion": 2 }`. A client ETag is not required; if `If-Match` is
supplied, a stale or non-exact value returns `412 recipe_revision_conflict`
before quota or provider work. The transient response contains only the
teaser, nullable time and difficulty, and plain ordered export steps.
`sourceEtag` is compatibility metadata, not a client acceptance prerequisite.
The endpoint does not map analyzer ingredient keys to saved recipe ingredient
IDs or expose resolution states. It does not run the import analyzer or
persist the suggestion, and tracks usage once only after a valid AI result.
The analyzer's `includedIngredientKeys` remain part of the separate
new-recipe analysis contract.

Preparation V2 remains text-only at the App API boundary; the small provider
schema rejects extra fields rather than accepting unused ingredient data.
Runtime enforces Shared min1/max5/text90/teaser96/time10080 limits and nullable,
trimmed non-empty single-line difficulty. Saved source orders are positive,
unique and ascending; export orders are 1..K. Reference groups are non-empty,
known, locally ascending and globally unique, ordered by their FIRST reference.
`[1,4,6],[5]` is valid only for Preparation; `[5],[1,4,6]` fails. Gaps and
non-contiguous saved source orders are allowed; full coverage is not required.
Empty saved steps or exclusively blank source descriptions returns 422 before
quota/provider work. There is no sorting, padding, truncation, fallback, identity
repair or full-recipe wrapper. The v11 prompt requests a complete understandable compact
detail-image workflow by grouping actions, not selecting five original steps;
retained claims/metadata must be source-backed. Runtime does not independently
prove cooking-core preservation, component fit or metadata derivation; test-only
fixture rubrics and explicit user review remain separate.

Initial and full-draft correction have separate v11 system prompts; pure
measured overflow keeps the strict text-only correction path. All three retain
source cooking endpoints as well as durations. Aggregate time requires an
explicit total or a fully timed, explicitly sequential source workflow;
untimed work or unclear overlap requires `null`, without estimated additions.
Independent metadata fixture assertions also run for the manually reviewed
oven, but do not constitute an automated oven cooking-content assertion.
Q-21 correction attempt 1 (v10) failed independent F/R/G. The second and final
candidate v11 decides time before compression from the complete source and
prioritizes essential separate cooking/endpoints over optional details.
FIRST-reference checks remain unchanged, including free non-adjacent grouping.
New F/R/G and human oven review remain pending. No deployment is authorized;
dated evidence below is historical.

Every measurable whole draft is probed for teaser and all step geometry using
the production fonts/layout, including count changes. Technical measurement
failures terminate, rather than request a correction. Fit is not semantic
preservation or whole-image/Share approval. No ingredient-omission strategy,
23/11 universal cap, three-line product rule or new font fallback is introduced.
The 75000 ms aggregate deadline and 20000 ms per-call ceiling are terminal;
quota is enforced once and usage booked once only after validated success.
Nothing is automatically saved. Only exhausted two completed corrections may
log exact latest affected known text; see the
[current loop, error and logging boundaries](../tech/06-ai-integrations.md#preparation-feedback-loop-current-r3-qa-r1).

[Partial] Current B-2 r3 / QA-R1 is implemented, NOT ACCEPTED / release CLOSED.
Recorded focused519/full1600 pass, typecheck/build exit0; F exit1 (5 executed /
2 passed / 3 failed / 9 skipped), only version guard and pasta pass.
Rice returns 422 (FIRST 6 before 5 plus overflows); oven fits/200 but moves
source-3 cream action into the source-4 group and fails independent semantics.
Forced dough repeats the overflow/422; semantics are NOT_REACHED. R/G remain
NOT_RUN_REQUIRED_LIVE_FAILURE. QA identified r2 pasta/dough lexical rubric
defects, not demonstrated cooking loss; narrow source-backed test corrections
are locally tested, pending independent QA, without historical PASS or register
closure. Q-19 FAIL and older failures remain unresolved. Alpha has only the
historical 14:12 logging release, not this loop. See the
[D-1-R1 handoff](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Handoff_2026-10-09-r1.md).

[Partial] Historical B-19 v4/v16 (2026-10-09) is implemented, not accepted. Upstream offline
gates passed (1437 units, typecheck/build); F/R/G all exited 1 with all three
Preparation fixtures executed each time. Rice group starts 6 before 5 and oven
duplicate reference 3 fail with 422/usage0/writes0/unchanged=true; pasta passes
with 200/usage1/writes0/unchanged=true. Later V2-success-body/usage-order/final
semantic assertions are not reached for rice/oven. Complete all-three
success-path proof and independent QA remain open; no release or Share-success
claim follows. See the [B-19 handoff](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Handoff_2026-10-09.md).

Historical v2 FAIL/stopped-run UNVERIFIED
remain historical. B-18 evidence from 2026-10-09 for v16/v3 has a fully skipped focused
gate (UNVERIFIED) and Preparation FAIL in both Recipe and overall gates: missing
finish-cooking despite observed 200/one call/usage1/no writes/unchanged source.
Later V2-body/usage-order assertions were not reached. The subsequent B-18C
test-only correction accepts finish-cooking combined with serving across
references [6,8], with gap7; real core losses and contradictions remain negative.
Its executed F/R/G gates still FAIL, without a production version change or
general runtime semantic validation. Preparation is not a
private/Alpha replay or Share-success proof. See the
[current evidence and open gates](../tech/06-ai-integrations.md#preparation-v2-evidence-boundary).

### Share-Triggered Recipe Export Review

For a newly created recipe, Mobile keeps the analyzer's `exportSuggestion` as
an unconfirmed local draft rather than including a confirmed `exportView` in
the ordinary recipe create request. The draft carries export text and only
uniquely resolved, user-confirmed non-seasoning ingredient IDs; analyzer keys,
candidates, resolution state, and a client fingerprint are not carried into
the saved recipe.

On an explicit Share action, Mobile reuses a stored confirmed export view,
including a stale one, without calling AI. If no confirmed view exists, it
reuses an unconfirmed export draft already held locally from new-recipe
analysis or an earlier V2 preparation while the detail screen remains mounted.
Only when neither is available does Share call the existing preparation
endpoint above. The suggestion remains transient while the user reviews it and
may be sent to `share-bundle` as an optional request-only `exportViewDraft`
(shared type `RecipeShareBundleExportDraft`) to render a preview without
confirming or saving it. Without a request draft, the
endpoint uses the stored confirmed view, including a stale one, or returns
`MISSING_EXPORT_VIEW` when neither source exists. A new or edited export is
persisted only through the existing explicit recipe confirmation request. The
share-bundle endpoint does not call AI or use quota.

`RecipeStep` persistence contains only `order`, optional `title`, and `description`. Step-level `notes` are not part of the shared recipe type or API contract; historical notes are cleaned lazily on recipe update rather than by a Cosmos migration.

## 6. Recipe Scale Preview

**Prompt version:** `RECIPE_SCALE_PROMPT_VERSION = 'v1'`

**Input:** `{ recipeId, targetPortions }`, where `targetPortions` is a whole number from `1` through `50`.

The authenticated backend loads the recipe by `userId` and `recipeId`, verifies ownership through the repository, and calculates original and target ingredient contexts with the shared deterministic projection. The client cannot supply the original quantities used for the AI context. The AI receives the original description, ordered steps, original ingredient snapshot, server-calculated target ingredient snapshot, and both portion counts.

**Output:** `{ targetPortions, description, steps }`, where `description` is a string or `null` and `steps` contain only `order`, optional `title`, and `description`. The AI response contains no ingredient quantities. Strict Structured Output is used with `additionalProperties: false` at every object level. The backend validates the response shape and rejects any response whose step count or order differs from the stored recipe with `422`.

The preview is advisory and transient. Per the US-05 product decision, this workflow has no additional manual confirmation screen; the mobile view keeps the warning `Die KI kann Fehler machen.` visible. No recipe, nutrition, or diary document is written. Quota is enforced before the AI call and tracked only after a fully valid response. Provider/parse failures return `502`; invalid structured responses return `422`; quota exhaustion returns `429`.

## 7. Daily Insight

[Current] Daily Insight release v30 / prompt v29 / assembly v13 uses the B1.1 context as
authoritative and describes only the current moment. Prior-day diary entries,
targets, and activities are omitted from provider input. Meal, snack, and food
advice eligibility is supplied as `mealAdviceAllowed` and protein status as
`dailyInsightProteinStatus`; both are instructions in the prompt, no longer
runtime wording checks. The former 20-g protein lock and its deterministic safety
fallback are removed. The selected intent prioritizes its topic but does not
suppress other relevant supplied current signals. Activity status is
`completed` or `unknown`; no `likely_completed` compatibility state is
inferred. Summary text has no word-count minimum and is limited to 5,000
characters. The runtime validator enforces only the strict schema, the greeting
and one-sentence `shortInsight` structure, and that every
calorie number in the output was supplied in the context (see the
[Server Validation Scope](09-daily-insight.md#server-validation-scope-2026-10-20)).
The earlier keyword rules (prohibited terms, open-day completion phrases, target
relation direction, unknown-activity completion, stale-weight markers, energy
balance, historical days) and the one-shot safety fallbacks were removed on
2026-10-20 and exist only as prompt guidance. Calorie differences do not prove
physiological energy balance. The central
[Daily Insight rulebook](09-daily-insight.md) owns the product rules. Weekly
Insight diagnostics are separate and do not count as US-03 Daily failures.

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

The AI receives the selected intent but cannot change it. For a present
activity, `dailyActivityStatus` is `completed` for a requested past local date
or a current-day local hour of `22..23`; otherwise it is `unknown`. Without an
activity, status is `null`. The provider cannot infer planned or likely-
completed states. Long/intensive endurance activity is handled with qualitative fueling (including
carbohydrates or energy), fluids, and recovery language, without adding
unapproved numeric nutrition thresholds.

### Effective calorie budget

`nutrition.targets.calories` is the server-resolved effective target. An
explicit training day uses its profile `trainingDay` target; the default/rest
day uses `restDay`. A Special Activity's effective target includes its
recorded activity bonus exactly once. `nutrition.today.calories` is logged
intake and `nutrition.remainingCalories` is the exact target-minus-intake
difference. `activity_focus` may state these supplied values and the exact
named bonus. It must not add the bonus again, substitute the Special Activity's
base target for the effective target, estimate activity calories burned, or
claim an achieved energy deficit/surplus. The activity-focus provider
projection retains qualitative activity signals and the supplied target/bonus
but omits `activityCalories`, `estimatedMet`, and `alreadyAccountedCalories`.
The bonus changes calories only; it does not change the selected profile-day
macro ranges.

### Daily request boundary

The current Mobile Daily request also sends `timezoneOffsetMinutes`, interpreted
as local time minus UTC (for example, UTC+2 is `120`). Only integer values in
`[-840,840]` are valid. The request also requires a real `date`; missing,
malformed, calendar-invalid, fractional, or out-of-range date/offset values
return HTTP `400` at the handler boundary, before context construction, cache
reads, quota checks, or AI calls. The handler never substitutes a backend UTC
date or UTC expiry. A valid offset compares the requested date with the
offset-adjusted local date before resolving `dailyActivityStatus`; for the
current day, only local hours `22..23` produce `completed`. New Daily documents expire at the next
local midnight represented as UTC. The Cosmos `ttl` is the ceiling of the
remaining seconds. The normalized offset is part of the input hash, so a
changed normalized offset follows the normal cache regeneration rules.

This boundary change leaves the Daily prompt, Structured Output, public AI
response, quota ordering, quota response, persistence, and usage tracking
unchanged for valid requests. Context/provider and server-validation failures
remain friendly HTTP `200` `unavailable` responses, and quota exhaustion remains
friendly HTTP `200` `quota_exceeded` without usage tracking.

### Prompt, output, and failure contract

`DAILY_INSIGHT_PROMPT_VERSION = 'v29'` (release v30). The selected focused module is combined
with the shared German tone/output contract. The backend stores the exact
`promptSnapshot.system` and serialized `promptSnapshot.user` sent to Azure
OpenAI. Strict Structured Outputs use `json_schema`, `strict: true`, required
properties, nullable optional values, and `additionalProperties: false`.

The active composition root is `backend/src/lib/prompts/dailyInsightPrompt.ts`.
The shared Strict Structured Output schema is defined in
`backend/src/lib/dailyInsightSchema.ts`, and the append-only release manifest
is in `backend/src/lib/prompts/dailyInsightPromptManifest.ts`. It preserves the
v14 fingerprint and every later release record (v15 through v29) unchanged. The
active release is v30 / prompt v29 / assembly v13 with fingerprint
`sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb`.
Earlier fingerprints and their evidence are in the
[Daily Insight history archive](../archive/daily-insight-history-2026-10.md).

The active activity-focus contract allows exact current intake, effective target,
and remaining calories. A named Special Activity bonus is already included in
the effective target and may be stated only as that bonus, never as activity
calorie expenditure. The provider projection withholds the expenditure fields
`activityCalories`, `estimatedMet`, and `alreadyAccountedCalories` while retaining
qualitative context. Unknown activity status is not to be described as planned.

The release identity is dual: `promptVersion` is the human-readable release
identifier and `promptFingerprint` is the SHA-256 identity of the canonical
complete prompt bundle, including prompt fragments, guard policy, assembly
version, and Strict Structured Output schema. In addition, each generated
Daily instance stores `systemPromptHash`, the SHA-256 hash of the exact,
intent- and context-dependent `promptSnapshot.system` sent to Azure OpenAI.
This third value distinguishes the concrete provider system prompt even when
the global bundle identity and release version are unchanged.

A positive or negative `remainingCalories` value is only a target-relative
intake difference, not a measured energy balance. The prompt forbids
affirmative achieved deficit/surplus claims across all user-visible text fields
while allowing explicit denials and supported above/below-target comparisons;
since 2026-10-20 this is no longer a runtime validator rule.
For an open-day `phase_progress` insight, weight signals remain the progress
basis; remaining calories are not presented as an eating budget and do not
justify increasing intake or an eating recommendation. Independent
non-nutrition guidance remains possible.

The same single provider call now also requires `greeting` (max 120 JavaScript
string units) and `shortInsight` (max 240). PO-1 greeting is exactly
`Hallo, <server displayName>! <one context-appropriate friendly emoji>`, without
time-of-day language; the existing missing-name fallback remains `Sportler`.
The short insight must be one self-contained complete German sentence,
consistent with the full text and derived only from server FitTrack context.
It cannot invent missing data, add a new recommendation or bypass activity,
macro, budget, protein or stale-weight rules (prompt rules). Runtime checks the
name/emoji prefix and the length/plain-single-sentence structure; these
heuristics do not prove grammatical or semantic quality. The live eval asserts
structure and supplied numbers only; wording is reviewed manually from the saved
artifacts (see the Server Validation Scope in the rulebook). Generation uses
temperature `0`, the unchanged 400-token budget and one call; there is no second
production summary. Earlier judge-based and emulator-gate evidence is in the
[Daily Insight history archive](../archive/daily-insight-history-2026-10.md).

The server validates the parsed response and rejects provider truncation or
content filtering, empty/invalid/schema-invalid responses, an invalid greeting
or short-insight structure, and calorie numbers
that were not supplied in the context. It does not validate wording. The public contract is
character-based:
`greeting` is at most 120, `shortInsight` at most 240,
`title` is at most 40 characters, `summary` at most 5,000,
`recommendation` at most 240. There is no server-side
60-120-word summary validator. A failed context read, provider failure,
truncation/content-filter result, or server validation failure returns friendly
`unavailable` as HTTP `200`, is not persisted, and does not consume or track
Daily quota. Quota exhaustion is also a friendly HTTP `200` with
`status: 'quota_exceeded'` and no tracking.

The stale-weight rule introduced in v15 is global because the shared tone guard is
included in every selected intent. For `daysSinceLastMeasurement > 14` (day 14
remains current, day 15 is stale), weight or trend is omitted or marked with an
explicit stale marker such as `veraltet` or `nicht aktuell`, and since v28 the
`title` does not mention weight, trend, or kg. This is a prompt rule; the runtime
validator no longer checks it (see the Server Validation Scope in the rulebook).

A negative calorie budget (`remainingCalories < 0`) is authoritative: the prompt
forbids further same-day food recommendations, and `recommendation` stays
`null`. The response has no CTA/navigation fields. Protein interpretation follows the server-derived
`dailyInsightProteinStatus`; there is no protein-gap threshold or lock.

The cache hash preserves the prompt's semantic boundaries instead of relying
only on rounded numeric values. `remainingCalories` is bucketed as
`unknown` for `null`, undefined, or non-finite values, `negative` for values
below zero, `zero` for exactly zero, and `positive` for values above zero.
Therefore the cache distinguishes `-0.01`, `0`, and `0.01`, while retaining the
existing rounding stability elsewhere. The hash also includes
`dailyInsightProteinStatus`, `mealAdviceAllowed`, and the profile-day
`macroRanges` with exact bounds.

### Daily cache and persistence

New Daily documents use `_docType: 'dailyInsight'` and
`id = ${userId}:${date}` in the existing `aiInsights` container. They persist
the input context/hash, selected intent, prompt version, global prompt
fingerprint, concrete system-prompt hash, and exact prompt snapshot, model,
response, token usage, and intelligence version. The hash includes the release
version, both prompt identities, intent, local-hour bucket, activity/status
data, semantic nutrition buckets, current and historical nutrition/targets,
the exact current profile-day `macroRanges`, `proteinCoachingBand`, and
protein-gap signal, weight/progress signals, and the other prompt inputs.
Missing or mismatched
prompt version, `promptFingerprint`, `systemPromptHash`, `intent`, or
`promptSnapshot` is a hard cache invalidation, independent of the regeneration
interval, daily limit, or admin status. The existing complete unexpired v14
same-date preservation exception remains restricted to active v15-v18. It is
not extended to v19 or later, including v29: all follow normal identity invalidation, including for
v14. A missing compact pair alone is never an invalidation/refresh trigger.

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
Missing or mismatched current provenance makes them ineligible for a cache hit
and for new feedback. Legacy feedback documents remain readable with their
historical fields and are not rewritten or backfilled.

The compact pair is likewise optional Class 0 data inside Daily and Feedback
`response`. New validated generations persist both, and exact-instance
feedback copies them unchanged. Old responses remain readable without fields;
there is no migration, backfill, deletion, new container/index or rewrite.
Caching this advisory text does not write nutrition, training or profile data.
[Planned F-1] Without a successful available Insight and a valid complete pair,
Home uses the existing static greeting without short text or detail action,
including loading/network/AI/validation/quota failures. There is no special
legacy display or forced generation, and opening details/selecting day type
must not trigger AI. The B-1 backend does not implement this UI.

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
Every such search is scoped to `_docType = 'insightFeedback'`. The admin-only
status operation reads only status metadata in the requested user partition
and patches only `processingStatus`; it does not read feedback content or the
source Daily snapshot. Feedback submission retains its separate exact-Daily
snapshot read.

| Persisted field | Source / meaning |
|---|---|
| `insightId` | Exact matched Daily document ID |
| `date` / `insightGeneratedAt` | Exact Daily date and stored generation timestamp |
| `userComment` | Exact server-trimmed negative comment |
| `response` | Complete generated/displayed Daily response |
| `promptSnapshot.system` / `.user` | Exact provider system prompt and serialized user message |
| `promptVersion` / `intent` | Stored Daily prompt version and deterministic server intent |
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
are excluded. The prompt is versioned (`WEEKLY_INSIGHT_PROMPT_VERSION = 'v3'`)
and uses Strict Structured Outputs with one validated `text` field. Its field
contract treats `baseTargetCalories` as informational context, uses
`effectiveTargetCalories` as the sole target denominator, and uses `targetPercent`
as the sole measure of daily target attainment. `activityBonusCalories` is already
included in the effective target and must not be counted as additional consumption.
Exceedance language is allowed only when `targetPercent > 100`; a base target may
not be used as the exceedance reference when an effective target is present. The
generated text is trimmed and limited to exactly 750 characters at most; it is
advisory and interpretive and must not invent missing data or make medical, deficit,
or diagnosis claims. A length-truncated provider response is unavailable and is not
counted toward the shared insight quota.

Weekly results are cached separately from daily insights in the existing
`aiInsights` container under `_docType: 'weeklyInsight'`. The cache is invalidated
when meal/item macros or identities, DayMeta/activity/target snapshots, or the
prompt version changes. The old text is never returned after a hash change,
including the v2-to-v3 prompt bump.
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

Each prompt has a version constant (e.g., `DAILY_INSIGHT_PROMPT_VERSION = 'v20'`). This readable version and the computed global `promptFingerprint` are stored with each new generated Daily document in Cosmos. The concrete `systemPromptHash` is stored for the exact composed system prompt used by that instance. When a provider-visible prompt, guard, assembly, or schema change affects output interpretation, the version must be incremented and the append-only release manifest updated.
