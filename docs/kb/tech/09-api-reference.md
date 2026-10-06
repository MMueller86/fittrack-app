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
| POST | `/api/weights` | Yes | `{ value, unit?, date }`; `date` is a required real `YYYY-MM-DD` calendar date |
| DELETE | `/api/weights/{id}` | Yes | |

## Diary

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/diary?date=YYYY-MM-DD&localDate=YYYY-MM-DD&localHour=0..23` | Yes | Full day: meals + summary + hint + dayMeta; `date` and `localDate` are required, `localHour` is optional |
| POST | `/api/diary/meals` | Yes | Create meal for a date |
| PUT | `/api/diary/meals/{mealId}` | Yes | Update meal metadata |
| DELETE | `/api/diary/meals/{mealId}` | Yes | |
| POST | `/api/diary/meals/{mealId}/items` | Yes | Add item to meal |
| PUT | `/api/diary/meals/{mealId}/items/{itemId}` | Yes | Update item |
| DELETE | `/api/diary/meals/{mealId}/items/{itemId}` | Yes | |
| POST | `/api/diary/items/bulk-delete` | Yes | Atomically remove selected items from one diary date |
| POST | `/api/diary/items/bulk-move` | Yes | Atomically move selected items to another meal on the same date |
| POST | `/api/diary/items/bulk-copy` | Yes | Atomically copy selected item snapshots to one meal on the same or a different date |
| PUT | `/api/diary/day/{date}/meta` | Yes | Set dayType / workoutType |
| PUT | `/api/diary/day/{date}/special-activity` | Yes | Record a hiking or cycling activity and calculate activity bonus |
| DELETE | `/api/diary/day/{date}/special-activity` | Yes | Remove the special activity for a day |

For `GET /api/diary`, `date` is the requested diary date and `localDate` is the
current local device date used for local state decisions. Both must be real
`YYYY-MM-DD` calendar dates. `localHour` accepts an integer from `0` through
`23`; a missing, non-integer, or out-of-range value is represented as unknown
and never replaced with a server or UTC hour.

### Bulk diary item mutations

All three bulk routes require a Bearer token and accept only meal/item references;
the authenticated user's ID and stored meal snapshots are authoritative.
Empty and duplicate reference lists return
`400 { "error": "invalid_diary_bulk_request" }`. Malformed bodies, invalid
dates, and unknown fields also return `400` (schema errors may name the field).

`POST /api/diary/items/bulk-delete` accepts:

```json
{
	"sourceDate": "2026-05-08",
	"items": [
		{ "mealId": "meal-1", "itemId": "item-1" },
		{ "mealId": "meal-2", "itemId": "item-2" }
	]
}
```

Success (`200`) returns
`{ "deletedCount": 2, "deletedItemIds": ["item-1", "item-2"] }`.
Only referenced embedded items are removed; source Meal documents remain,
including when their item arrays become empty.

`POST /api/diary/items/bulk-move` accepts the same `sourceDate` and `items`,
plus exactly one target selector: `{ "mealId": "target-meal" }` for an
existing meal or `{ "newMealType": "dinner" }` to create a meal as part of
the transaction. The target must differ from all source meals and belong to
the authenticated user and same date. Success (`200`) returns
`{ "movedCount": 2, "removedItemIds": ["item-1", "item-2"], "targetMeal": Meal }`;
each moved snapshot is preserved and receives a new item ID in `targetMeal`.

`POST /api/diary/items/bulk-copy` accepts:

```json
{
	"sourceDate": "2026-05-08",
	"targetDate": "2026-05-09",
	"items": [
		{ "mealId": "meal-1", "itemId": "item-1" },
		{ "mealId": "meal-2", "itemId": "item-2" }
	],
	"target": { "mealId": "target-meal" }
}
```

The `target` must contain exactly one selector: an existing meal ID or
`{ "newMealType": "dinner" }` to create the target meal in the same
transaction. `targetDate` may equal `sourceDate`; every source reference must
belong to `sourceDate`, and an existing target must belong to `targetDate` and
the authenticated user. The route clones stored `MealItem` snapshots without
resolving live food or recipe data for the clone, assigns a fresh ID to each
clone, and appends all copies to the one selected target. If the target Meal is
also a source Meal, it is read once and that snapshot and ETag are used for one
ETag-guarded `Replace` in the atomic batch; the original items remain and the
clones are appended. With a different same-date target, the source Meals remain
unchanged. Post-commit tracking may resolve current source state only to apply
the documented counters; it never changes the clone. Success (`200`) returns
`{ "copiedCount": 2, "targetMeal": Meal }`.

Single-item copy uses this same route with one entry in `items`; there is no
separate copy mutation contract.
Repeating an identical request after success performs another copy with new
item IDs; the API has no request idempotency key and does not deduplicate
successful submissions. Duplicate `{ mealId, itemId }` references within one
request remain invalid.

Delete, Move, and Copy are all-or-nothing. The backend validates every
reference before writing and commits all changed Meal documents in one
`nutritionDiaryMeals` partition-scoped Transactional Batch, using read ETags
for existing documents. Copy writes only its target meal; Move writes its
source meals and target; Delete writes only source meals. Requests are never
chunked or retried as partial work. Errors:

- `401` — missing or invalid Bearer token
- `404 { "error": "diary_bulk_reference_not_found" }` — a meal, item, date, or target is unavailable to the authenticated user
- `409 { "error": "diary_bulk_conflict" }` — an ETag/write conflict; no Meal changes are committed
- `413 { "error": "diary_bulk_operation_limit_exceeded" }` — the batch exceeds Cosmos limits (100 operations or 2 MB)

Delete and Move do not write, decrement, or reattribute food-usage relations
or source counters. They do not alter any pre-existing usage history.

After the atomic Diary commit succeeds, Copy records best-effort usage once per
copied referenced item using the target Meal's date and type. Classification is
based on persisted references, not `MealItem.sourceType`: `recipeId` records a
recipe relation for the copying user and increments the owner's recipe counter
only while the recipe resolves for its owner or as published community content;
an unavailable recipe snapshot still copies and records the user relation but
does not increment an owner counter. A `sourceId` with the `openFoodFacts:`
prefix records a catalog relation and has no product counter; any other
`sourceId` records a personal relation and increments `ReusableItem.usageCount`
only if the user's reusable item resolves with `nutritionPer100g`. Items without
either reference create no usage. Each copied item is tracked separately, so
repeated copies of one source add repeated usage. A failed Diary commit creates
no usage, and a later usage failure does not roll back the committed copy. No
schema or migration change is required.

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
| PUT | `/api/recipes/{id}/visibility` | Yes | Owner-only private/community transition; explicit content confirmation required to publish |
| DELETE | `/api/recipes/{id}` | Yes | |
| POST | `/api/recipes/{id}/images` | Yes | Multipart upload; returns one `RecipeImage` |
| PUT | `/api/recipes/{id}/images/{imageId}/hero-crop` | Yes | Updates validated hero-crop metadata; returns one `RecipeImage` |
| PUT | `/api/recipes/{id}/images/order` | Yes | Reorders existing images; returns `{ images: RecipeImage[] }` |
| DELETE | `/api/recipes/{id}/images/{imageId}` | Yes | Deletes the blob and compacts remaining image order; `204` with no body |
| POST | `/api/recipes/{id}/log` | Yes | Logs an owner or currently published community recipe from server-loaded values into a diary meal snapshot |
| POST | `/api/recipes/{id}/export-view/prepare` | Yes | Transient export-view preparation; uses the `recipe-analyze` quota |
| POST | `/api/recipes/{id}/instagram-render` | Yes | Renders the server-owned recipe as a direct `1080 x 1350` PNG; no render result is persisted |
| POST | `/api/recipes/{id}/share-bundle` | Yes | Atomically renders Instagram and recipe-detail PNGs from an optional request draft or confirmed stored view, including stale snapshots; no result is persisted |

### Visibility and authorization

Recipe list, detail, create, update, delete, image-management, export, and scale
operations remain scoped to the authenticated owner's recipe. New recipes are
private. A legacy recipe without a visibility value is read as private;
`sharedWithUserIds` is reserved and does not grant access. Only the dedicated
authenticated community routes below, and server-side recipe-reference reads
for a recipe whose current visibility is `community`, allow another signed-in
user to read that published recipe. This is not a general relaxation of
user-partition access, and it does not grant foreign edit, delete, image
management, export, or AI-scale rights.

`PUT /api/recipes/{id}/visibility` is owner-only. Its strict request body is
one of:

```json
{ "visibility": "private" }
```

```json
{
	"visibility": "community",
	"confirmContentSharing": true,
	"displayNameConsent": false
}
```

Publishing always requires `confirmContentSharing: true` and an explicit
`displayNameConsent` boolean. The Mobile consent starts unchecked; the backend
does not infer consent from a profile field or token. When consent is true, the
community projection resolves the owner's current profile `displayName`; if
consent is false or the name is unavailable, it returns exactly `Anonymous`.
The projection does not expose the owner ID or other profile fields. Switching
to private removes the publication record, so community list, detail, and
image routes stop serving the recipe to other users; foreign
favorite-resolution/log checks return unavailable or not found. The owner
retains normal owner access.

The route returns the updated owner `Recipe` and ETag. `If-Match` is optional;
when supplied it must exactly match the current ETag. The repository also uses
compare-and-replace, so a stale precondition or write race returns `412` with
`{ "error": "recipe_revision_conflict" }`. Visibility/publication fields are
not accepted through ordinary recipe create/update bodies; those return
`400 { "error": "recipe_visibility_requires_dedicated_endpoint" }`.

### Authenticated community recipe routes

| Method | Route | Auth | Contract |
|---|---|---|---|
| GET | `/api/community-recipes?limit=<n>&continuationToken=<token>` | Yes | Paginated published recipes; default limit 20, maximum 50; `{ recipes: CommunityRecipe[], continuationToken? }` |
| GET | `/api/community-recipes/{id}` | Yes | One current community recipe; private, deleted, or unknown IDs return 404 |
| GET | `/api/community-recipes/{id}/images/{imageId}` | Yes | Protected JPEG/PNG bytes; visibility is rechecked on every request; never returns a SAS URL |

An invalid limit returns `400 { "error": "invalid_community_limit" }`; an
empty or invalid continuation token returns
`400 { "error": "invalid_community_continuation_token" }`. The continuation
token is opaque and is passed back unchanged.

`CommunityRecipe` is a safe read projection containing the recipe's name,
description, portions, ingredients, steps, nutrition, tags, image metadata,
timestamps, `authorDisplayName`, `isOwnRecipe`, and
`ingredientNotices: { containsAiEstimates, containsManualIngredients }`.
Ingredient source-link IDs are omitted. Ingredient provenance is projected as
`nutritionSource: 'openFoodFacts' | 'manual' | 'ai' | 'label-scan' | 'unknown'`;
unknown history is not presented as a verified source. The DTO does not expose
`ownerUserId`, `userId`, `sharedWithUserIds`, `communityPublication`, or
`usageCount`.

Each community image's `url` is a relative authenticated API path of the form
`/api/community-recipes/{id}/images/{imageId}`, not a SAS URL. The image route
returns the bytes with the stored JPEG/PNG content type,
`Cache-Control: no-store`, and `X-Content-Type-Options: nosniff`; it returns 404
when the recipe is no longer currently published or the image is unavailable,
415 for an unsupported image type, and 422 when the image exceeds the 8 MB
limit. Owner recipe endpoints continue to use their existing short-lived
read-only SAS URLs; the protected community route is a separate contract.

### Recipe logging and snapshots

`POST /api/recipes/{id}/log` accepts `{ "portions": number, "mealId": string }`.
The meal must belong to the authenticated user. The server resolves the current
recipe as owner or currently published community content, then writes the
recipe's current name, portion count, and scaled `nutritionPerPortion` as a
`MealItem` snapshot (`sourceType: 'recipe'`, recipe reference, and logged
portions). Client-supplied nutrition is not the authority for this route. A
private, deleted, or revoked foreign recipe returns 404; invalid portions
return 400.

The recipe branch of `POST /api/diary/meals/{mealId}/items` uses the same
server-side snapshot/access helper rather than accepting client macros. Mobile
recipe logging and recipe Quick Add use `/api/recipes/{id}/log`. A later recipe
edit, privacy change, or deletion does not rewrite existing diary item names,
portions, or nutrition snapshots. The stored reference may no longer resolve
for a new open or log action, but the historical item remains readable with
its original snapshot.

### Recipe create/update body

`POST /api/recipes` accepts the complete recipe body. `PUT /api/recipes/{id}` accepts a partial recipe body with any subset of `name`, `description`, `portions`, `ingredients`, `steps`, `tags`, and the confirmed `exportView` fields; omitted fields keep their stored values. When `ingredients` or `portions` are supplied, nutrition is recalculated server-side from the stored/supplied combination. Both endpoints validate `ingredients` with the same Zod contract and return `400` with an `error` field when validation fails.

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

### Recipe export view

`exportView` is optional on create and update. The request contains `version`,
`teaser`, `totalTimeMinutes`, `difficulty`, ordered export `steps`, and
`includedIngredientIds`; `sourceFingerprint` is not a client input. The backend
validates the selected ingredient IDs, recalculates nutrition, and adds the
server-owned `sha256:` fingerprint over the effective recipe source before
persisting the export view.

Recipe responses may include the confirmed `exportView` and the derived,
response-only `exportViewStatus`. A missing export view is represented by
omitting both fields and is interpreted as `missing`; a matching fingerprint is
`current`, and a changed source with the old snapshot is `stale`. The status is
never stored in Cosmos. Omitting `exportView` during an update preserves the
stored snapshot, while supplying a new one replaces it with a newly computed
fingerprint. Legacy recipes without an export view remain readable without a
Cosmos migration or a new container.

Confirmation uses a top-level request-body pair: `exportView` with
`exportViewAction: 'confirm'`. A create without an export view omits both; a
create that includes one requires the marker and has no `If-Match`
precondition. Ordinary updates omit both fields, preserve the old snapshot, and
cannot re-fingerprint it. The marker is never persisted, and neither
`If-Match` nor a client-computed `sourceFingerprint` is a JSON field. The server
computes the fingerprint from the effective merged recipe.

`GET /api/recipes/{id}`, successful `POST /api/recipes`, and successful
`PUT /api/recipes/{id}` return the current opaque ETag in the HTTP response
header. An export confirmation update does not require a client ETag; it may
send the exact ETag from the recipe GET response in the HTTP `If-Match` header
as an optional precondition. Every PUT uses atomic compare-and-replace against
the revision it read, independently of the client header.

**Confirmation errors:**

- `400` — incomplete `exportView` / `exportViewAction` pair;
	`{ "error": "invalid_export_view_confirmation" }`
- `400` — an included ingredient ID is unknown, refers to a seasoning, occurs
  more than once in the recipe, or is repeated in `includedIngredientIds`;
  `{ "error": "invalid_export_view_ingredient" }`
- `412` — supplied stale ETag or internal write race;
	`{ "error": "recipe_revision_conflict" }`

### POST /api/recipes/{id}/export-view/prepare

The route loads a versioned recipe from the JWT user's partition and invokes
the existing Recipe Analyze operation with the shared `recipe-analyze` quota.
It does not change the prompt, make an extra AI call, or write to Cosmos. The
AI output is validated before exactly one usage is tracked. Provider, quota,
and validation failures do not track usage.

**Request:** exactly `{ "contractVersion": 2 }`. Missing or invalid JSON,
`{}`, unknown fields, and unsupported versions return
`400 { "error": "invalid_export_preparation_request" }`. No client `If-Match`
header is required. If one is supplied, a stale or non-exact ETag returns
`412 recipe_revision_conflict` before quota or provider work.

**Success response (200):** The suggestion contains only export text fields and
plain steps. `sourceEtag` identifies the loaded revision for compatibility;
clients do not need to send it back or compare it before accepting the text.
The response does not return analyzer ingredient keys, ingredient IDs, or
ingredient-resolution results. `totalTimeMinutes` and `difficulty` may be
`null`. Preparation is transient: it does not update the recipe or its
confirmed `exportView`; saving still uses the separate explicit confirmation
flow above.

```json
{
	"contractVersion": 2,
	"recipeId": "recipe-uuid",
	"sourceEtag": "\"recipe-revision\"",
	"suggestion": {
		"version": 1,
		"teaser": "Goldbraunes Brot",
		"totalTimeMinutes": 90,
		"difficulty": "Einfach",
		"steps": [
			{ "order": 1, "description": "Tomaten schneiden." }
		]
	}
}
```

**Errors:**

- `400` — missing recipe id, or invalid preparation body (`invalid_export_preparation_request`)
- `401` — missing or invalid Bearer token
- `404` — recipe not found for the authenticated user
- `412` — a supplied `If-Match` does not exactly match the loaded recipe revision; rejected before quota/provider work
- `422` — AI output fails server-side recipe/export validation; response includes `details`
- `429` — existing `QuotaExceededResponse` for `recipe-analyze`
- `502` — provider or empty/invalid AI response
- `500` — unexpected backend failure

### Recipe steps

Each step contains `order` (positive integer), `description` (1-2000 characters), and optional `title` (max. 200 characters). There is no top-level recipe `notes` field and no step-level `notes` field in the shared type, request schema, or API response contract. Historical notes remain readable as raw Cosmos data but are stripped from API responses and removed from the stored document the next time the recipe is updated; no global Cosmos migration is required.

### Recipe images

`RecipeImage` persistence contains `id`, `blobName`, a 1-based `order`, and optional `heroCrop` metadata. `url` is response-only: the backend creates a read-only SAS URL with a one-hour TTL for `GET /api/recipes/{id}` (all images) and for the first image in `GET /api/recipes` (thumbnail). The upload response is one image object with a fresh `url`; it is not a complete `Recipe` response.

`heroCrop` has the closed shape `{ version: 1, frame: "instagram-recipe-v1", focusX, focusY, zoom }`. `focusX` and `focusY` are finite normalized coordinates in `0..1` on the visually oriented source image; `zoom` is finite and at least `1`. Width, height, aspect-ratio, unknown frame, unknown version, and unknown extra fields are not part of the contract.

The `instagram-recipe-v1` frame is `1080 x 1015`, matching the current
renderer's photo/hero area. This is the confirmed implementation deviation
from the older `1080 x 880` reference: `1080 x 880` ends before the tag zone
and is not accepted as a runtime frame. The renderer output remains exactly
`1080 x 1350` PNG.

`POST /api/recipes/{id}/images` accepts multipart field `image`, only `image/jpeg` and `image/png`, up to 8 MB, plus the optional `heroCrop` JSON string. The new image is appended at `max existing order + 1`. When omitted, the field remains absent in Cosmos; repository reads and response objects expose the deterministic effective legacy default. When supplied, it must match the strict `RecipeImageHeroCrop` contract; invalid JSON or metadata returns `400` before the blob is uploaded. The crop is metadata only: upload never creates a second or cropped blob. `DELETE /api/recipes/{id}/images/{imageId}` deletes the blob and renumbers remaining images from 1.

### PUT /api/recipes/{id}/images/{imageId}/hero-crop

This authenticated route is scoped to the JWT user's recipe and accepts only an existing image in that recipe.

**Request body:**

```json
{
	"heroCrop": {
		"version": 1,
		"frame": "instagram-recipe-v1",
		"focusX": 0.5,
		"focusY": 0.46,
		"zoom": 1
	}
}
```

`heroCrop` is strict: `focusX` and `focusY` are finite values in `0..1`, `zoom` is finite and at least `1`, and unknown fields, frames, and versions are rejected. The route changes only metadata and returns a fresh URL; it never rewrites the image Blob.

**Responses:**

- `200` — updated `RecipeImage` with a fresh read-only SAS `url`
- `400` — invalid JSON, unknown fields, or invalid `heroCrop`
- `401` — missing or invalid Bearer token
- `404` — recipe not found for the authenticated user, or `imageId` is not part of that recipe
- `500` — unexpected persistence or storage failure

`PUT /api/recipes/{id}/images/order` accepts `{ "imageIds": string[] }`. The array must contain every existing image ID exactly once, with no duplicates or unknown IDs. The backend normalizes `order` to `1..n` in the supplied sequence and returns `{ images: RecipeImage[] }`. The endpoint only changes image metadata in the recipe document; it does not move or rewrite blob data.

### POST /api/recipes/{id}/instagram-render

This authenticated endpoint renders one private recipe with the backend's
Instagram renderer. Azure Functions exposes the trigger with
`authLevel: "anonymous"`, but application authentication is mandatory:
`requireUser()` validates the Bearer token and the recipe repository lookup is
scoped to that JWT user. The endpoint has no AI quota, does not create a
Cosmos document, does not update the recipe, and does not upload the PNG.

**Request body:**

```json
{
	"imageId": "optional-recipe-image-uuid",
	"presentation": {
		"focusX": 0.5,
		"focusY": 0.46,
		"zoom": 1.0
	},
	"selectedTags": ["Schnell", "Salat"],
	"nutritionHighlight": "high-protein",
	"recipeMeta": {
		"totalTimeMinutes": 25,
		"difficulty": "Einfach"
	}
}
```

All request fields are optional, so `{}` is valid. The strict schema accepts
only `imageId`, `presentation`, `selectedTags`, `nutritionHighlight`, and
`recipeMeta`:

| Field | Validation and default |
|---|---|
| `imageId` | Optional UUID. When absent, the image with the lowest finite `order` is selected; ties use the lowest image ID. |
| `presentation.focusX` | Optional finite number in `0..1`; defaults to the selected image's effective crop, or `0.5` for legacy images. |
| `presentation.focusY` | Optional finite number in `0..1`; defaults to the selected image's effective crop, or `0.46` for legacy images. |
| `presentation.zoom` | Optional finite number `>= 1`; defaults to the selected image's effective crop, or `1.0` for legacy images. |
| `selectedTags` | Optional array of at most four exact values from the stored recipe tags. Unknown or duplicate values are invalid. When supplied, the stored recipe-tag order determines the render order; the client array order is ignored. |
| `nutritionHighlight` | `"high-protein"` or `null`; defaults to `null`. There is no automatic nutrition-threshold calculation. |
| `recipeMeta.totalTimeMinutes` | Positive integer. Required together with `difficulty` when `recipeMeta` is present. |
| `recipeMeta.difficulty` | Non-empty, trimmed, single-line string. Required together with `totalTimeMinutes`. |

`title`, `tags`, `portions`, `nutrition`, `blobName`, and `ownerUserId` are
never accepted from the client. The adapter obtains `title`, tags, portions,
and `nutritionPerPortion` from the authenticated user's stored `Recipe`.
`selectedTags` can only select up to four exact stored tags; the adapter
filters the stored tag list so its order and labels remain authoritative.
`recipeMeta.portions` is not a request field; when meta is requested, portions
come from the stored recipe. The selected image's stored `blobName` is passed
directly to the backend storage layer. The render path does not fetch a
client-provided SAS URL.

Presentation precedence is evaluated independently for each field:
`presentation.focusX`, `focusY`, or `zoom` from the request wins when
supplied; otherwise the selected image's stored/effective `heroCrop` is used;
only a missing legacy value reaches the deterministic default. A partial
request therefore preserves the other stored crop fields, and rendering never
persists request overrides.

**Success response (200):**

The response body is the PNG buffer, not JSON or Base64. The renderer owns the
layout and returns exactly `1080 x 1350` pixels in PNG format.

```text
Content-Type: image/png
Content-Length: <buffer.byteLength>
Content-Disposition: inline; filename="fittrack-recipe.png"
Cache-Control: no-store
```

The direct Blob download is bounded by the existing 8 MB recipe-image limit.

**Errors:**

- `400` — missing route id, invalid JSON, unknown request fields, invalid
	`imageId`/presentation/selectedTags/nutritionHighlight values, or incomplete
	`recipeMeta`; the response uses the existing `{ error: string }` shape.
- `401` — missing or invalid Bearer token.
- `404` — recipe not found for the authenticated user, or an explicitly
	requested `imageId` is not part of that recipe.
- `422` — no renderable recipe image, invalid stored image metadata, image over
	8 MB, unreadable image, invalid stored portions for requested meta, or an
	expected renderer input/layout error. Controlled renderer failures include a
	stable `code`, such as `NO_RECIPE_IMAGE`, `IMAGE_BLOB_INVALID`,
	`IMAGE_TOO_LARGE`, `INVALID_RECIPE_META`, `TITLE_OVERFLOW`,
	`TOO_MANY_TAGS`, or `TAG_ROW_OVERFLOW`.
- `500` — unexpected storage, native renderer, missing-asset, or other backend
	failure. The external response is generic; internal causes and asset details
	are logged but never returned.

### POST /api/recipes/{id}/share-bundle

This authenticated endpoint creates an atomic pair of share images from one
server-loaded recipe and one selected stored image. The optional top-level
request-only `exportViewDraft` (shared type `RecipeShareBundleExportDraft`)
takes precedence for this render. Otherwise the endpoint uses the
confirmed stored `exportView`, whether its fingerprint is current or stale. If
neither exists, it returns `422 MISSING_EXPORT_VIEW` before image download or
either renderer call. The current recipe supplies canonical fields, while the
selected draft or view supplies the teaser, time, difficulty, steps, and
included ingredient IDs. Current ingredient values are looked up by ID,
without AI-key or name mapping. The draft is never persisted and does not
refresh a fingerprint. The endpoint has no AI call or quota and returns no
partial pair if either render fails.

**Request body:**

```json
{
	"imageId": "optional-recipe-image-uuid",
	"presentation": {
		"focusX": 0.5,
		"focusY": 0.46,
		"zoom": 1.0
	},
	"selectedTags": ["Schnell", "Salat"],
	"nutritionHighlight": "high-protein",
	"exportViewDraft": {
		"version": 1,
		"teaser": "Goldbraunes Brot",
		"totalTimeMinutes": null,
		"difficulty": null,
		"steps": [
			{ "order": 1, "description": "Tomaten schneiden." }
		],
		"includedIngredientIds": ["ingredient-uuid"]
	}
}
```

All fields are optional, so `{}` is valid. The strict schema accepts only
`imageId`, `presentation`, `selectedTags`, `nutritionHighlight`, and
`exportViewDraft`; unlike the legacy direct Instagram route, `recipeMeta` is
rejected. The draft is strict at every object level and accepts only
`version: 1`, `teaser` (trimmed, 1-96 characters), `totalTimeMinutes` (`null` or
a positive integer up to 10,080), `difficulty` (`null` or non-empty trimmed
single-line text), `steps` (1-5 entries with ascending positive integer orders
and trimmed 1-90 character descriptions), and `includedIngredientIds` (at most
20 unique non-empty IDs). `sourceFingerprint` and all other unknown properties
are rejected. Each included ID must identify exactly one non-seasoning
ingredient in the authenticated recipe; invalid references return
`400 { "error": "invalid_export_view_ingredient" }`.

When `exportViewDraft` is omitted, existing callers retain the stored-view
contract: a present confirmed view is used whether current or stale; when both
the request draft and stored view are absent, the endpoint returns
`422 { "error": "Recipe export view is required for sharing",
"code": "MISSING_EXPORT_VIEW" }`. Image selection, presentation
defaults/overrides, selected-tag validation, and highlight values follow
`POST /api/recipes/{id}/instagram-render`. Recipe title, portions, nutrition,
and current ingredient values come from the authenticated server-side recipe.
The selected draft or stored view supplies export-only text and ingredient IDs.
Neither rendering nor accepting a request draft changes the recipe or its
confirmed fingerprint.

If draft time is `null`, both images omit the time chip. A `null` difficulty
omits only the Instagram difficulty chip; the detail image does not display a
difficulty chip in either case. Portions and the detail image's displayed
ingredient-count chip remain available.

**Success response (200):**

```json
{
	"recipeId": "recipe-uuid",
	"instagram": {
		"mimeType": "image/png",
		"size": 12345,
		"data": "<base64 PNG>"
	},
	"detail": {
		"mimeType": "image/png",
		"size": 12345,
		"data": "<base64 PNG>"
	}
}
```

Each `size` is the corresponding decoded PNG byte length. Both images use the
selected stored Blob and the response shape is unchanged. The response is
emitted only after both renderers succeed; a renderer failure never returns a
partial image pair. A request draft is not persisted.

**Errors:**

- `400` — missing route id, invalid JSON, unknown fields (including
	`recipeMeta`), invalid draft shape or ingredient IDs, invalid
	`imageId`/presentation/selectedTags/nutritionHighlight.
- `401` — missing or invalid Bearer token.
- `404` — recipe not found for the authenticated user, or an explicitly
	requested `imageId` is not part of that recipe.
- When the recipe has no stored image and no explicit `imageId` was requested,
	both image-export endpoints return HTTP `422` with this user-actionable body:

	```json
	{
		"error": "Bitte lade zuerst ein Rezeptfoto hoch, bevor du das Rezept teilst.",
		"code": "NO_RECIPE_IMAGE"
	}
	```

	Clients should branch on `code`, not the message text, and may display `error`
	to the user. This is a missing prerequisite, not a transient render failure;
	retrying without uploading a recipe photo will not resolve it. No Blob
	download, renderer call, or recipe write occurs for this response.
- `422` — missing stored view and omitted draft (`MISSING_EXPORT_VIEW`), no renderable image,
	invalid stored image metadata, image over 8 MB, unreadable image, or a
	controlled renderer/layout failure.
- `500` — unexpected storage, native renderer, missing-asset, or other backend
	failure. Errors never include one rendered image as a partial response.

## Food Search

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/food-search?query=<q>` | Yes | Fan-out: library + catalog, deduped. `{ results: FoodSearchResult[] }` |
| GET | `/api/food-products/search?q=<q>` | Yes | Catalog only. Min 2 chars. |
| GET | `/api/food-products/{id}` | Yes | Single catalog item by id |

## Favorites & Recents

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/favorites[?context=MealType&localDate=YYYY-MM-DD]` | Yes | All favorites for user; recipe references include current `recipeAccess` and no stale recipe caches; context-ranked requests require a valid local reference date |
| POST | `/api/favorites` | Yes | Add/update favorite; recipe references must currently resolve as owner or community and are stored without recipe nutrition/image caches |
| DELETE | `/api/favorites/{foodRef}` | Yes | Remove the user's favorite, including an unavailable recipe reference |
| GET | `/api/food-relations/recent` | Yes | Recently used items; recipe references include current access projection |
| GET | `/api/food-relations/frequent` | Yes | Frequently used items; recipe references include current access projection |

When `context` is supplied, `localDate` is required and must be a real local
`YYYY-MM-DD` calendar date. The backend uses it as the reference date for the
date-only `usageDates` ranking window; `lastUsedAt`, `favoritedAt`, and
`createdAt` remain UTC timestamps/instants.

For `foodRefType: 'recipe'`, relation reads resolve access against the current
recipe and return `recipeAccess: 'owner' | 'community' | 'unavailable'` as a
response projection. Adding a recipe favorite resolves its current recipe and
uses the server's recipe name; supplied display, nutrition, portion, or image
caches do not grant access or create a recipe/food copy. When access is
unavailable the relation can still be removed, but it cannot open or authorize
a new diary log.

## AI Endpoints (Quota Enforced)

| Method | Route | Auth | Quota Feature | Notes |
|---|---|---|---|---|
| POST | `/api/ai/parse-meal` | Yes | `meal-parser` | Free-text meal → structured items |
| POST | `/api/ai/estimate-meal` | Yes | `meal-estimate` | Meal image → nutrition estimate |
| POST | `/api/ai/food-estimate` | Yes | `food-estimate` | Food name → nutrition per 100g |
| POST | `/api/ai/food-estimate/batch` | Yes | `food-estimate` | Batch food estimation |
| POST | `/api/ai/label-scan` | Yes | `label-scan` | Multipart image → nutrition label data |
| POST | `/api/ai/recipe-analyze` | Yes | `recipe-analyze` | Recipe text → structured metadata and ingredient preview |
| POST | `/api/ai/recipe-scale/preview` | Yes | `recipe-scale` | Stored recipe → transient scaled description and steps |
| GET | `/api/ai/daily-insight?date=YYYY-MM-DD&timezoneOffsetMinutes=-840..840[&localHour=0..23]` | Yes | (tracked separately) | Once-daily AI briefing; never returns AI/quota error to user |
| POST | `/api/ai/daily-insight/feedback` | Yes | None | Negative feedback for one exact Daily instance; no snapshot is returned |
| GET | `/api/ai/weekly-insight?date=YYYY-MM-DD` | Yes | `daily-insight` | Seven completed days plus optional AI evaluation; deterministic data remains usable on AI failure |

AI endpoints generally return `429` with `QuotaExceededResponse` when quota is exceeded.

The Daily and Weekly insight endpoints are exceptions and keep their deterministic
contracts available with HTTP `200`:
- Daily Insight returns `status: "quota_exceeded"`.
- Weekly Insight returns `evaluation.status: "quota_exceeded"` and `evaluation.text: null`.

### GET /api/ai/daily-insight

The endpoint requires a valid Bearer token and normally returns HTTP `200`,
including when the Daily quota or the AI/context build is unavailable. The
current handler uses the following query parameters:

| Parameter | Type | Required | Implemented behaviour |
|---|---|---|---|
| `date` | `YYYY-MM-DD` string | Yes | Explicit real local calendar date used for cache and context. Missing, malformed, or calendar-invalid values return HTTP `400` before context, cache, quota, or AI work. |
| `localHour` | integer `0..23` | No | Used for the current-day activity-language heuristic. Missing, non-integer, or out-of-range values become unknown. |
| `timezoneOffsetMinutes` | integer | Yes | Explicit local-minus-UTC offset in `[-840,840]`. Missing, fractional, or out-of-range values return HTTP `400` before context, cache, quota, or AI work. A valid offset drives local current-day/activity safety, local-midnight expiry/TTL, and cache hashing. |

The current Mobile service sends its local date, `localHour`, and
`timezoneOffsetMinutes`. The offset means local time minus UTC (for example,
UTC+2 is `120`) and only integer values from `-840` through `840` are valid.
The handler requires both the real `date` and this valid offset and returns
HTTP `400` for missing or invalid values; it never substitutes a backend UTC
date, UTC hour, or UTC expiry. With a valid offset, current-day detection
compares the requested date with the offset-adjusted local date; a present
activity may then use the validated `localHour` heuristic. A newly generated
Daily document expires at the next local midnight represented as UTC, and its
Cosmos `ttl` is the ceiling of the remaining seconds. The normalized offset is
included in the input hash, so a changed normalized offset follows the normal
cache regeneration rules.

This request-boundary validation does not change the Daily v14 prompt, the
Structured Output or public AI response contract, or the existing quota and
failure semantics. For valid requests, quota is still checked before Azure
OpenAI, successful usage is tracked only after persistence, and context/provider
failures plus quota exhaustion remain friendly HTTP `200` responses.

**Response body (200):**

```json
{
	"title": "Dein Tagesfokus",
	"summary": "Eine kurze, serverseitig validierte Tagesanalyse.",
	"recommendation": "Eine optionale nächste Handlung.",
	"cta": "Ernährung öffnen",
	"ctaTarget": "Nutrition",
	"generatedAt": "2026-08-20T08:30:00.000Z",
	"promptVersion": "v14",
	"status": "fresh",
	"feedbackAvailable": true
}
```

`title` is limited to 40 characters and `summary` to 600 characters.
`recommendation`, `cta`, and `ctaTarget` are optional and are omitted when the
server-side structured response contains `null`. `status` is `fresh`,
`cached`, `quota_exceeded`, or `unavailable`. The Daily response emits the
server-owned boolean `feedbackAvailable`. It is `true` only when the
stored Daily instance contains complete feedback provenance and `false` for a
legacy or incomplete instance, including friendly quota/unavailable responses.
The POST guard remains authoritative and rejects incomplete provenance with
`feedback_snapshot_unavailable`.

Daily documents are stored as `_docType: "dailyInsight"` under the existing
`aiInsights` container with `id = ${userId}:${date}`. The selected v14 intent,
input context, input hash, exact system/user prompt snapshot, model, token
usage, and intelligence version are server-owned persistence fields. Daily
quota is checked before Azure OpenAI and tracked only after a valid response;
quota exhaustion remains a friendly HTTP `200` response and is not tracked.
The active v14 prompt and server validator apply the stale-weight guard to all
intents: day 14 remains current, day 15 is stale, stale-as-current wording is
rejected, and explicit markers such as `veraltet` or `nicht aktuell` are
accepted. Context, provider, truncation/content-filter, or validation failures
return HTTP `200` with `status: "unavailable"`; the failed result is not
persisted and does not consume or track Daily quota.

The server-owned `inputContext.weight.weeklyTrend30d` is not exposed in the
public response. It is the `gaining | losing | stable | null` direction
classification from a linear regression over the last 30 calendar days,
projected to a weekly change, and remains the authoritative weight direction
signal. Existing Daily and durable feedback snapshots are handled by the
explicit, idempotent `backend/scripts/migrate-insight-weight-trend.mjs`
migration, which updates the nested context key in place, preserves document
identity, Daily TTL/expiry, and feedback traceability, excludes Weekly
documents, and reports conflicts without overwriting them. Request handling
uses `weeklyTrend30d` only; there is no legacy alias, fallback, dual-read, or
dual-write compatibility path.

### POST /api/ai/daily-insight/feedback

The endpoint requires a Bearer token and accepts only the authenticated user's
Daily identity plus a required comment. `date` must be a real `YYYY-MM-DD`
calendar date, `insightGeneratedAt` must be the exact canonical UTC timestamp
stored on the displayed Daily document, `submissionId` must be a UUID, and the
server trims `userComment` to 1–500 characters. Client-provided user IDs,
responses, prompts, contexts, hashes, models, and version fields are rejected.

**Request body:**

```json
{
	"date": "2026-08-20",
	"insightGeneratedAt": "2026-08-20T08:30:00.000Z",
	"submissionId": "11111111-1111-4111-8111-111111111111",
	"userComment": "Die Aktivität war nur geplant."
}
```

**Responses:**

- `201` — `{ "feedbackId": "...", "created": true }` for a new feedback document
- `200` — `{ "feedbackId": "...", "created": false }` for an identical retry, including after Daily expiry
- `400` — invalid JSON, unknown fields, invalid date/timestamp/UUID, or a trimmed comment outside 1–500 characters
- `401` — missing or invalid Bearer token
- `404` — `{ "code": "insight_not_found" }`
- `409` — `{ "code": "insight_generation_changed" }`, `{ "code": "feedback_snapshot_unavailable" }`, or `{ "code": "feedback_submission_conflict" }`
- `500` — unexpected backend or persistence failure

Each new submission is stored as `_docType: "insightFeedback"` in the existing
`aiInsights` container, partitioned by the JWT `userId`. The document copies the
complete server-owned Daily response, prompt snapshot, input context, intent,
versions, hash, model, token usage, exact Insight identity, trimmed comment,
and server-side `submittedAt`. Feedback performs no quota check or tracking,
has neither `ttl` nor `expiresAt`, returns no snapshot to Mobile, and adds no
read or cleanup endpoint.

The idempotency lookup happens before the Daily read. Therefore an identical
retry returns `200 created: false` even after the Daily document has expired;
the same `submissionId` with a different normalized request returns
`feedback_submission_conflict` without changing either document. For a new
submission, the compatibility `feedbackScore` marker is patched only on the
matching Daily identity and the patch preserves the Daily document's original
TTL/expiry.

**Feedback traceability matrix:**

| Persisted field | Authoritative source and meaning |
|---|---|
| `insightId` | Exact `InsightDocument.id` of the matched Daily instance |
| `date` | Exact Daily date selected by the authenticated request |
| `insightGeneratedAt` | Exact stored Daily `generatedAt`; no rebinding to a later generation |
| `userComment` | Server-trimmed request comment, 1-500 characters |
| `response` | Complete server-generated/displayed Daily response |
| `promptSnapshot.system` | Exact selected v14 system prompt sent to Azure OpenAI |
| `promptSnapshot.user` | Exact serialized user message sent to Azure OpenAI |
| `promptVersion` | Stored Daily prompt version, currently `v14` |
| `intent` | Deterministic server-selected `InsightIntent` |
| `inputContext` | Complete server-built `InsightInputContext` used for generation |
| `inputHash` | Server-computed hash for the Daily input and active prompt |
| `model` | Server-side Azure OpenAI deployment identifier |
| `intelligenceVersion` | Server-side progress-intelligence schema version |
| `tokensUsed` | Provider-reported token usage from the Daily generation |
| `submittedAt` | Server-generated canonical submission timestamp |

The existing authorized administrative/operational direct-read access may read
these documents directly in the existing `aiInsights` container. This feature
introduces no new application role, permission model, Admin UI, read endpoint,
or cleanup endpoint. Normal users and arbitrary JWT admins receive no implicit
database access from this persistence contract. Feedback is not automatically
deleted; a later manual database cleanup is an operational follow-up outside
this feature.

### PATCH /api/ai/daily-insight/feedback/status

The endpoint is a dedicated authenticated operational write path for updating
Daily Insight feedback `processingStatus`. It requires a valid Bearer token and
explicit backend admin authorization (`isAdmin === true` from the validated
Entra role claim).

Input must contain the exact `userId` partition key and exact `feedbackId`
document id for an existing feedback document. The repository enforces exact
partition/id access plus `_docType = "insightFeedback"` before writing.

**Request body:**

```json
{
	"userId": "test-user-abc-123",
	"feedbackId": "test-user-abc-123:feedback:11111111-1111-4111-8111-111111111111",
	"processingStatus": "Done"
}
```

`processingStatus` accepts only `Open`, `Done`, or `Rejected`.

**Responses:**

- `200` — successful change: `{ "userId": "...", "feedbackId": "...", "processingStatus": "Done", "changed": true }`
- `200` — idempotent same-state no-op: `{ "userId": "...", "feedbackId": "...", "processingStatus": "Done", "changed": false }`
- `400` — invalid JSON, unknown fields, empty ids, or invalid status value
- `401` — missing or invalid Bearer token
- `403` — authenticated but not admin
- `404` — `{ "code": "feedback_not_found" }` when the exact `userId` + `feedbackId` feedback document is missing
- `409` — `{ "code": "feedback_status_transition_forbidden", "processingStatus": "<current>" }` for forbidden terminal transitions
- `500` — unexpected backend or persistence failure

Terminal-state semantics:

- Allowed transitions: `Open -> Done`, `Open -> Rejected`
- Idempotent no-op transitions: `Open -> Open`, `Done -> Done`, `Rejected -> Rejected`
- Forbidden transitions: `Done -> Rejected`, `Rejected -> Done`, `Done -> Open`, `Rejected -> Open`

### GET /api/ai/weekly-insight?date=YYYY-MM-DD

The endpoint requires a valid Bearer token and a required real local calendar date.
The server loads data only for the authenticated user and returns the seven
completed dates `date - 7` through `date - 1` in ascending order. The current day
is never included, and missing days are retained in the response.

**Response body (200):**

```json
{
	"referenceDate": "2026-08-14",
	"periodStart": "2026-08-07",
	"periodEnd": "2026-08-13",
	"days": [
		{
			"date": "2026-08-07",
			"consumedCalories": 2185,
			"consumedMacros": { "protein": 132.5, "carbs": 245.25, "fat": 78.75 },
			"baseTargetCalories": 2300,
			"effectiveTargetCalories": 2300,
			"activityBonusCalories": 0,
			"targetPercent": 95,
			"targetBand": "in_range",
			"dataStatus": "available",
			"targetSource": "day_target_snapshot",
			"dayType": "rest",
			"workoutType": null,
			"activity": null,
			"hasMealItem": true,
			"mealItemCount": 2
		}
	],
	"totals": {
		"includedDayCount": 6,
		"totalConsumedCalories": 16890,
		"totalTargetCalories": 17620,
		"averageConsumedCalories": 2815,
		"averageTargetCalories": 2936.6666666667,
		"overallTargetPercent": 95.857
	},
	"evaluation": {
		"status": "fresh",
		"text": "Deine Woche zeigt ...",
		"generatedAt": "2026-08-14T10:00:00.000Z"
	}
}
```

`days` always contains exactly seven entries. `dataStatus` distinguishes
`available`, `missing_nutrition`, `missing_target`, and
`missing_nutrition_and_target`. A day with an existing MealItem and `0` kcal is
valid nutrition data. `consumedMacros` is `null` when no MealItem exists; otherwise
it contains the unrounded sums of `protein`, `carbs`, and `fat` from all
`MealItem.macros` snapshots across all meals. Present `0` kcal or `0` g values
remain valid data and are not converted to missing values. Missing values are
`null`, not invented zeros. No historical macro targets are added. Totals include
only days with both nutrition data and a valid positive effective target; the total
percentage is `sum(consumed) / sum(target) * 100`, not an average of daily
percentages. Target resolution is snapshot-first: the API uses a valid DayMeta
snapshot, then a compatible stored special-activity target, and finally the current
 profile's rest target by default or training target for an explicitly stored
 training day. The final case is reported as `targetSource: "profile_fallback"` and
 is read-only; it is not persisted as historical data. An explicitly stored
 `DayMeta` still supplies `dayType` and optional `workoutType` in the response when
 this fallback is used. A stored snapshot remains authoritative after later profile
 changes. The activity label and bonus remain in the response when a stored special
 activity exists; the default `rest` context created only for an activity-only day
 remains implicit.

`evaluation.status` is `fresh`, `cached`, `quota_exceeded`, or `unavailable`.
Quota, provider, parse, and Structured Output failures return `200` with
`evaluation.text: null`; they do not create a deterministic replacement text.
When present, `evaluation.text` is the trimmed AI response and is limited to
750 characters. Exactly 750 characters remain unchanged through a fresh response
and a cache hit; a provider response truncated with `finish_reason: 'length'` is
returned as `unavailable` with `text: null` and is not quota-tracked.
Identical weekly input is served from the weekly cache without an AI call. Meal,
macro, DayMeta, activity, target-snapshot, or prompt-version changes invalidate the
hash, and old evaluation text is not returned after invalidation.

**Errors:**

- `400` — missing, malformed, or non-calendar `date`
- `401` — missing or invalid Bearer token
- `500` — unexpected backend or persistence failure outside the neutral AI failure contract

### POST /api/ai/recipe-scale/preview

Authenticated preview endpoint. The backend loads the recipe by the authenticated `userId` and `recipeId`; the request contains no trusted original recipe data.

**Request body:**

```json
{
	"recipeId": "uuid",
	"targetPortions": 2
}
```

`targetPortions` must be a whole number from `1` through `50`. The endpoint calculates target ingredients server-side with the shared projection and sends the original and target context to Azure OpenAI. Ingredient quantities are not included in the response.

**Response body (200):**

```json
{
	"targetPortions": 2,
	"description": "...",
	"steps": [
		{ "order": 1, "title": "...", "description": "..." }
	]
}
```

`description` is `string | null`. `steps` preserve the stored step count and order. The response is transient: the endpoint does not update the recipe, its nutrition, or diary data.

**Error responses:**

- `400` — invalid JSON, invalid UUID, or `targetPortions` outside the whole-number range `1–50`
- `401` — missing or invalid Bearer token
- `404` — recipe does not exist for the authenticated user
- `422` — provider response is parseable but violates the response or step contract
- `429` — `QuotaExceededResponse` with `feature: "recipe-scale"`, limit `30` for `free` and `premium`, and `resetsAt`
- `502` — Azure OpenAI unavailable, empty output, or non-parseable provider output
- `500` — unexpected backend error

## Common Response Patterns

- **200** — success with `jsonBody`
- **400** — validation error: `{ message: 'field: reason' }`
- **401** — missing or invalid Bearer token
- **404** — resource not found
- **422** — AI plausibility check failed (hallucinated values)
- **429** — quota exceeded: `QuotaExceededResponse` with `resetsAt` date
- **500** — internal error (stack never leaked to client)
- **501** — not yet implemented
