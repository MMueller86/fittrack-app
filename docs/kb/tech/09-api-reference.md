# API Reference

All endpoints are prefixed with `/api`. Auth level is `anonymous` on the Azure Functions side — JWT validation is enforced in code via `requireUser()`.

## Health

| Method | Route | Auth | Response |
|---|---|---|---|
| GET | `/api/health` | No | `{ status: 'ok', service: 'fittrack-backend' }` |

## Profile

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/profile/me` | Yes | Returns `UserProfile` or `null` |
| POST | `/api/profile` | Yes | Create/replace profile + recalculate targets |
| PUT | `/api/profile` | Yes | Update profile + recalculate targets |
| POST | `/api/profile/calculate-preview` | Yes | Calculate targets without saving |

Request body for POST/PUT: `ProfileInput` — validated with Zod.

## Weights

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/weights` | Yes | `{ entries: WeightEntry[] }` |
| POST | `/api/weights` | Yes | `{ value, unit?, date? }` |
| DELETE | `/api/weights/{id}` | Yes | |

## Diary

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/diary/day/{date}` | Yes | Full day: meals + summary + hint + dayMeta |
| POST | `/api/diary/meals` | Yes | Create meal for a date |
| PUT | `/api/diary/meals/{mealId}` | Yes | Update meal metadata |
| DELETE | `/api/diary/meals/{mealId}` | Yes | |
| POST | `/api/diary/meals/{mealId}/items` | Yes | Add item to meal |
| PUT | `/api/diary/meals/{mealId}/items/{itemId}` | Yes | Update item |
| DELETE | `/api/diary/meals/{mealId}/items/{itemId}` | Yes | |
| PUT | `/api/diary/day/{date}/meta` | Yes | Set dayType / workoutType |
| PUT | `/api/diary/day/{date}/special-activity` | Yes | Record a hiking or cycling activity and calculate activity bonus |
| DELETE | `/api/diary/day/{date}/special-activity` | Yes | Remove the special activity for a day |

### PUT /api/diary/day/{date}/special-activity

Records a hiking or cycling activity, calculates the activity bonus using the appropriate MET model, and persists the result in `DayMeta`. The `type` field determines which model and validation rules apply.

**Request body — Hiking (`type: 'hiking'`):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `'hiking'` | Yes | |
| `movementTimeMinutes` | `number` | Yes | 30–1200 |
| `distanceKm` | `number` | Yes | 0.5–100 |
| `elevationGainM` | `number` | Yes | 0–3000 |
| `elevationLossM` | `number` | No | 0–3000; defaults to 0 |
| `packCategory` | `'none'\|'small'\|'medium'\|'heavy'` | No | Defaults to `'none'` when absent |
| `terrainType` | `'path'\|'trail'\|'alpine'\|'scramble'` | No | Defaults to `'path'` when absent |
| `hasBackpack` | `boolean` | No | **Deprecated** — maps to `packCategory: 'medium'` when true |

**Request body — Cycling (`type: 'cycling'`):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `'cycling'` | Yes | |
| `movementTimeMinutes` | `number` | Yes | 15–1200 |
| `distanceKm` | `number` | Yes | 1–200 |
| `elevationGainM` | `number` | Yes | 0–8000 |
| `elevationLossM` | `number` | No | 0–8000; defaults to 0 |
| `asphaltShare` | `number` | Yes | 0.0–1.0; terrain shares must sum to 1.0 |
| `gravelShare` | `number` | Yes | 0.0–1.0 |
| `trailShare` | `number` | Yes | 0.0–1.0 |
| `ebikeSupport` | `'NONE'\|'LIGHT'\|'HIGH'` | Yes | eBike motor assistance level |

**Response body (200) — both types:**

| Field | Notes |
|---|---|
| `specialActivity` | Full `SpecialActivity` object (persisted; type-discriminated) |
| `activityBonus` | Extra calories added to the day target (rounded to 50 kcal) |
| `effectiveCalorieTarget` | `dailyCalorieTarget + activityBonus` |
| `metBase` | *(hiking only)* Flat-terrain walking MET (V3 intermediate) |
| `metLocomotion` | *(hiking only)* MET after elevation adjustments (V3 intermediate) |
| `terrainFactor` | *(hiking only)* Multiplicative terrain factor applied (V3 intermediate) |
| `deltaPack` | *(hiking only)* Additive pack bonus applied (V3 intermediate) |

Cycling intermediates (`speedMet`, `uphillBonusMet`, `terrainBonusMet`, `effectiveSupport`) are included in the `specialActivity` object.

**Error responses:**
- `400` — invalid or non-calendar `date` route param
- `422` — speed outside plausible range (hiking: < 0.5 or > 10 km/h; cycling: < 3 or > 80 km/h), or no body weight on record

## Reusable Items (Personal Food Library)

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/reusable-items` | Yes | List user's items |
| POST | `/api/reusable-items` | Yes | Create item |
| GET | `/api/reusable-items/{id}` | Yes | |
| PUT | `/api/reusable-items/{id}` | Yes | Update item |
| DELETE | `/api/reusable-items/{id}` | Yes | |
| POST | `/api/reusable-items/{id}/enrich` | Yes | Trigger AI enrichment |

## Recipes

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/recipes` | Yes | List user's recipes |
| POST | `/api/recipes` | Yes | Create recipe |
| GET | `/api/recipes/{id}` | Yes | |
| PUT | `/api/recipes/{id}` | Yes | |
| DELETE | `/api/recipes/{id}` | Yes | |
| POST | `/api/recipes/{id}/images` | Yes | Multipart upload; returns one `RecipeImage` |
| PUT | `/api/recipes/{id}/images/order` | Yes | Reorders existing images; returns `{ images: RecipeImage[] }` |
| DELETE | `/api/recipes/{id}/images/{imageId}` | Yes | Deletes the blob and compacts remaining image order; `204` with no body |
| POST | `/api/recipes/{id}/log` | Yes | Logs a portion snapshot into a diary meal |

### Recipe create/update body

`POST /api/recipes` accepts the complete recipe body. `PUT /api/recipes/{id}` accepts a partial recipe body with any subset of `name`, `description`, `portions`, `ingredients`, `steps`, and `tags`; omitted fields keep their stored values. When `ingredients` or `portions` are supplied, nutrition is recalculated server-side from the stored/supplied combination. Both endpoints validate `ingredients` with the same Zod contract and return `400` with an `error` field when validation fails.

The update endpoint always writes recalculated `nutritionTotal` and `nutritionPerPortion` using the effective ingredient list and portion count. This also covers updates that only change metadata: stored nutrition is normalized from the current recipe ingredients/portions before the response is returned.

Each ingredient contains the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID string | Yes | Ingredient identity within the recipe |
| `displayName` | string | Yes | Trimmed, 1-200 characters |
| `inputMode` | `'grams'\| 'portion'` | Yes | Unit used for `inputAmount` |
| `inputAmount` | `number \| null` | Yes | Finite, non-negative entered amount; `null` means indeterminate |
| `amountGrams` | `number \| null` | Yes | Finite, non-negative resolved amount; `food` requires a positive value |
| `unit` | string | Yes | Trimmed, 1-50 characters |
| `linkedProductId` | string \| null | Yes | Catalog product reference |
| `linkedReusableItemId` | string \| null | Yes | Personal library reference |
| `isAiEstimate` | boolean | Yes | Whether the nutrition values were AI-estimated |
| `category` | `'food' \| 'seasoning'` | No | Omitted on legacy payloads; omission is treated as `food` |
| `amountLabel` | string | No | Persistent optional seasoning label, max. 100 characters |
| `portionWeightGrams` | positive number | No | Weight of one source portion |
| `portionLabel` | string | No | Optional portion display label, max. 50 characters |
| `nutritionPer100g` | `RecipeNutrition` | Yes | All values must be finite and non-negative |
| `nutritionContribution` | `RecipeNutrition` | Yes | All values must be finite and non-negative |

For `food` ingredients, and for legacy ingredients without `category`, `amountGrams` must be greater than zero. `seasoning` ingredients may use `amountGrams: null` (or `0`); their nutrition contribution is zero. Negative, non-finite, or otherwise invalid food amounts are rejected on both create and update. Existing Cosmos recipe documents do not require a migration: missing optional ingredient fields remain missing and are read as legacy `food` ingredients.

`amountLabel` is retained by the create/update and GET roundtrip. `kitchenAmountText` belongs exclusively to the AI recipe-analysis response and is not a persistent `RecipeIngredient` field.

### Recipe steps

Each step contains `order` (positive integer), `description` (1-2000 characters), and optional `title` (max. 200 characters). There is no top-level recipe `notes` field and no step-level `notes` field in the shared type, request schema, or API response contract. Historical notes remain readable as raw Cosmos data but are stripped from API responses and removed from the stored document the next time the recipe is updated; no global Cosmos migration is required.

### Recipe images

`RecipeImage` persistence contains `id`, `blobName`, and a 1-based `order`. `url` is response-only: the backend creates a read-only SAS URL with a one-hour TTL for `GET /api/recipes/{id}` (all images) and for the first image in `GET /api/recipes` (thumbnail). The upload response is one image object with a fresh `url`; it is not a complete `Recipe` response.

`POST /api/recipes/{id}/images` accepts multipart field `image`, only `image/jpeg` and `image/png`, up to 8 MB. The new image is appended at `max existing order + 1`. `DELETE /api/recipes/{id}/images/{imageId}` deletes the blob and renumbers remaining images from 1.

`PUT /api/recipes/{id}/images/order` accepts `{ "imageIds": string[] }`. The array must contain every existing image ID exactly once, with no duplicates or unknown IDs. The backend normalizes `order` to `1..n` in the supplied sequence and returns `{ images: RecipeImage[] }`. The endpoint only changes image metadata in the recipe document; it does not move or rewrite blob data.

## Food Search

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/food-search?query=<q>` | Yes | Fan-out: library + catalog, deduped. `{ results: FoodSearchResult[] }` |
| GET | `/api/food-products/search?q=<q>` | Yes | Catalog only. Min 2 chars. |
| GET | `/api/food-products/{id}` | Yes | Single catalog item by id |

## Favorites & Recents

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/favorites` | Yes | All favorites for user |
| POST | `/api/favorites` | Yes | Add or update favorite |
| DELETE | `/api/favorites/{foodRef}` | Yes | Remove favorite |
| GET | `/api/food-relations/recent` | Yes | Top 10 recently used items (sorted by `lastUsedAt` DESC) |

## AI Endpoints (Quota Enforced)

| Method | Route | Auth | Quota Feature | Notes |
|---|---|---|---|---|
| POST | `/api/ai/parse-meal` | Yes | `meal-parser` | Free-text meal → structured items |
| POST | `/api/ai/estimate-meal` | Yes | `meal-estimate` | Meal image → nutrition estimate |
| POST | `/api/ai/food-estimate` | Yes | `food-estimate` | Food name → nutrition per 100g |
| POST | `/api/ai/food-estimate/batch` | Yes | `food-estimate` | Batch food estimation |
| POST | `/api/ai/label-scan` | Yes | `label-scan` | Multipart image → nutrition label data |
| POST | `/api/ai/recipe-analyze` | Yes | `recipe-analyze` | Recipe text → structured metadata and ingredient preview |
| GET | `/api/ai/daily-insight` | Yes | (tracked separately) | Once-daily AI briefing; never returns error to user |

AI endpoints return `429` with `QuotaExceededResponse` when quota is exceeded.

## Common Response Patterns

- **200** — success with `jsonBody`
- **400** — validation error: `{ message: 'field: reason' }`
- **401** — missing or invalid Bearer token
- **404** — resource not found
- **422** — AI plausibility check failed (hallucinated values)
- **429** — quota exceeded: `QuotaExceededResponse` with `resetAt` date
- **500** — internal error (stack never leaked to client)
- **501** — not yet implemented
