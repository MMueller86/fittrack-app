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
| PUT | `/api/diary/day/{date}/meta` | Yes | Set dayType / workoutType |
| PUT | `/api/diary/day/{date}/special-activity` | Yes | Record a hiking or cycling activity and calculate activity bonus |
| DELETE | `/api/diary/day/{date}/special-activity` | Yes | Remove the special activity for a day |

For `GET /api/diary`, `date` is the requested diary date and `localDate` is the
current local device date used for local state decisions. Both must be real
`YYYY-MM-DD` calendar dates. `localHour` accepts an integer from `0` through
`23`; a missing, non-integer, or out-of-range value is represented as unknown
and never replaced with a server or UTC hour.

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
| PUT | `/api/recipes/{id}/images/{imageId}/hero-crop` | Yes | Updates validated hero-crop metadata; returns one `RecipeImage` |
| PUT | `/api/recipes/{id}/images/order` | Yes | Reorders existing images; returns `{ images: RecipeImage[] }` |
| DELETE | `/api/recipes/{id}/images/{imageId}` | Yes | Deletes the blob and compacts remaining image order; `204` with no body |
| POST | `/api/recipes/{id}/log` | Yes | Logs a portion snapshot into a diary meal |
| POST | `/api/recipes/{id}/instagram-render` | Yes | Renders the server-owned recipe as a direct `1080 x 1350` PNG; no render result is persisted |

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

## Food Search

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/food-search?query=<q>` | Yes | Fan-out: library + catalog, deduped. `{ results: FoodSearchResult[] }` |
| GET | `/api/food-products/search?q=<q>` | Yes | Catalog only. Min 2 chars. |
| GET | `/api/food-products/{id}` | Yes | Single catalog item by id |

## Favorites & Recents

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/favorites[?context=MealType&localDate=YYYY-MM-DD]` | Yes | All favorites for user; context-ranked requests require a valid local reference date |
| POST | `/api/favorites` | Yes | Add or update favorite |
| DELETE | `/api/favorites/{foodRef}` | Yes | Remove favorite |
| GET | `/api/food-relations/recent` | Yes | Top 10 recently used items (sorted by `lastUsedAt` DESC) |

When `context` is supplied, `localDate` is required and must be a real local
`YYYY-MM-DD` calendar date. The backend uses it as the reference date for the
date-only `usageDates` ranking window; `lastUsedAt`, `favoritedAt`, and
`createdAt` remain UTC timestamps/instants.

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
