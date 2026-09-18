# Backend

## Entry Point

`backend/src/index.ts` — imports all function modules. Each module self-registers routes via `app.http()`. Adding a new function module requires adding an import here.

[Pattern] `backend/src/lib/registrations.test.ts` validates that every `*.ts` file under `functions/` is imported by `index.ts`. This test catches 404 bugs from forgotten registrations.

## Function Modules

Located in `backend/src/functions/`. Each file owns one domain.

| File | Routes | Auth Required | Notes |
|---|---|---|---|
| `profile.ts` | GET/POST/PUT /profile/me, POST /profile/calculate-preview | Yes | Full implementation |
| `nutritionTargets.ts` | nutrition targets endpoints | Yes | |
| `weights.ts` | GET/POST/DELETE /weights, /weights/{id} | Yes | |
| `diary.ts` | GET/POST /diary/day/{date}, meal CRUD | Yes | |
| `reusableItems.ts` | CRUD /reusable-items | Yes | |
| `reusableItemsEnrich.ts` | POST /reusable-items/{id}/enrich | Yes | AI enrichment |
| `reusableItemsEnrichScheduler.ts` | Timer trigger | — | Background enrichment |
| `recipes.ts` | CRUD /recipes, image upload/crop-update/delete/reorder, recipe logging | Yes | Image upload appends; crop updates metadata only; delete and reorder normalize image order. |
| `instagramRecipe.ts` | POST /recipes/{id}/instagram-render | Yes | Server-owned recipe data to PNG renderer; no persistence |
| `ai.ts` | POST /ai/parse-meal, /ai/estimate-meal | Yes | Quota enforced |
| `foodEstimate.ts` | POST /ai/food-estimate | Yes | Quota enforced |
| `foodEstimateBatch.ts` | POST /ai/food-estimate/batch | Yes | Quota enforced |
| `labelScan.ts` | POST /ai/label-scan | Yes | Quota enforced |
| `foodSearch.ts` | GET /food-search | Yes | Fan-out search |
| `foodProducts.ts` | GET /food-products/search, /food-products/{id} | Yes | Catalog only |
| `dailyInsight.ts` | GET /ai/daily-insight | Yes | Cached, quota-aware |
| `dailyInsightFeedback.ts` | POST /ai/daily-insight/feedback | Yes | Exact Daily-instance feedback; durable server-owned snapshot; no quota |
| `weeklyInsight.ts` | GET /ai/weekly-insight | Yes | Seven completed days, cached, quota-aware |
| `favorites.ts` | GET/POST/DELETE /favorites, GET /food-relations/recent | Yes | |

Health check: `GET /api/health` — anonymous, always returns `{ status: 'ok' }`.

## Library Layer

`backend/src/lib/` contains reusable modules called by function handlers.

| Module | Purpose |
|---|---|
| `auth.ts` | JWT validation, `requireUser()`, `UserContext` extraction |
| `http.ts` | `withHandler()` wrapper, `parseBody()` with Zod |
| `quota.ts` | `enforceQuota()`, `trackUsage()` |
| `quotaConfig.ts` | Tier limits, `getLimit()`, `getCurrentPeriod()` |
| `openai.ts` | Azure OpenAI client, all AI call functions |
| `cosmos.ts` | Cosmos DB client singleton |
| `documentIntelligence.ts` | Azure Document Intelligence client |
| `storage.ts` | Azure Blob Storage client |
| `hintEngine.ts` | Rule-based hint evaluation (no AI) |
| `progressIntelligence.ts` | Behavioural signal computation for daily insight |
| `labelParser.ts` | Post-processing of OCR + AI label results |
| `nutritionCalculator.ts` | Nutrition scaling per portion/grams |
| `nutritionValidator.ts` | Plausibility checks on AI-generated values |
| `searchRanking.ts` | Ranking logic for food search results |
| `tokenize.ts` | Text tokenization for food product search keywords |
| `log.ts` | `logEvent()` structured logging |
| `instagramRenderer/recipeAdapter.ts` | Maps authenticated `Recipe` data and request presentation options to `RenderInput` |
| `weeklyInsight.ts` | Server-side weekly aggregation, sanitized AI context, and cache decisions |
| `openFoodFactsClient.ts` | (Unused at runtime — kept for reference) |
| `repositories/` | Repository pattern implementations |
| `prompts/` | System prompt strings for each AI feature |

## Core Patterns

### `withHandler(name, fn)`

All HTTP handlers are wrapped with `withHandler()`. It provides:
- Structured logging: `handler.start`, `handler.success` (with status + duration ms), `handler.error`
- `UnauthorizedError` → 401
- Any other thrown error → 500 (stack never leaked to client)

```ts
export const myHandler = withHandler('domain.action', async (request, ctx) => {
  const { userId } = await requireUser(request);
  // ... business logic ...
  return { status: 200, jsonBody: result };
});
```

### `parseBody<T>(request, ZodSchema)`

Parses and validates JSON request body. Returns `ParseSuccess<T> | ParseFailure`. On failure, returns a 400 response with the first failing field name.

```ts
const parsed = await parseBody(request, MySchema);
if (!parsed.ok) return parsed.response;
const body = parsed.data; // typed as T
```

### `requireUser(request)`

Validates the Bearer token and returns `UserContext`. Throws `UnauthorizedError` on failure.

```ts
const { userId, tier } = await requireUser(request);
```

### Repository Pattern

All data access goes through repository interfaces. Each domain has:
- Interface (e.g., `DiaryRepository`)
- Cosmos implementation (e.g., `CosmosDiaryRepository`)
- In-memory implementation (for tests / local dev without Cosmos)
- Factory function (e.g., `getDiaryRepository()`) — selects implementation based on `isCosmosConfigured()`

Available repositories:
- `aiUsageRepository`, `diaryRepository`, `foodProductRepository`
- `profileRepository`, `recipesRepository`, `reusableItemsRepository`
- `weightsRepository`, `dayMetaRepository`, `hintStateRepository`
- `insightRepository`, `userFoodRelationRepository`

`UserFoodRelationRepository.recordUsage()` requires the explicit date-only date of
the diary meal for `usageDates`; it never derives a user date from the server
clock. `lastUsedAt` and `createdAt` remain UTC instants. Missing internal usage
dates fail closed in both repository implementations.

### Recipe image persistence and validation

`cosmosRecipesRepository.ts` stores recipe image metadata as `id`, `blobName`,
`order`, and optional `heroCrop`; transient `url` values are never serialized.
When a legacy document has no `heroCrop`, the repository materializes the
deterministic effective default `{ version: 1, frame: 'instagram-recipe-v1',
focusX: 0.5, focusY: 0.46, zoom: 1 }` on read. This is read compatibility, not
a migration. An upload that omits `heroCrop` keeps the field absent in Cosmos.

`recipes.ts` strictly validates `heroCrop` on multipart upload and on
`PUT /api/recipes/{id}/images/{imageId}/hero-crop`: version and frame are
closed values, `focusX` and `focusY` are finite values in `0..1`, and `zoom` is
finite and at least `1`. Unknown fields and invalid JSON are rejected with
`400`; upload validation happens before the blob is written. The crop update
route is user-scoped and changes only recipe metadata. Upload accepts only
JPEG/PNG images up to 8 MB; delete removes the blob, and reorder preserves
each image's crop metadata while normalizing order.

### Instagram recipe rendering

`functions/instagramRecipe.ts` is a thin orchestration layer for
`POST /api/recipes/{id}/instagram-render`. It authenticates with
`requireUser()`, validates the strict request body, loads the recipe through
`getRecipesRepository().get(userId, recipeId)`, selects the requested image or
the image with the lowest finite order (lowest image ID breaks ties), and maps
controlled renderer errors to the documented HTTP statuses.

`instagramRenderer/recipeAdapter.ts` is the boundary between the persistent
recipe model and `RenderInput`. It takes the title, tags, portions, and
nutritionPerPortion only from the server-loaded recipe. It starts presentation
from the selected image's stored/effective `heroCrop`, falls back to the
deterministic legacy default `{ focusX: 0.5, focusY: 0.46, zoom: 1.0 }`, and
applies request presentation fields as independent partial overrides. The
effective priority for each field is request override, stored/effective crop,
then legacy default. The repository normally supplies the default for legacy
images, and the adapter retains the fallback when called without stored
metadata. An omitted request field does not reset the other crop fields. It applies
`nutritionHighlight=null`; optional time and difficulty remain request-level
metadata and are omitted when absent. Layout constants, Satori nodes, icon
resolution, and nutrition rounding remain owned by the renderer.

The versioned `instagram-recipe-v1` frame is the renderer's `1080 x 1015`
photo/hero area, not the complete output. The older `1080 x 880` reference is
not a runtime contract because it ends before the tag zone. The renderer still
returns exactly `1080 x 1350` PNG. Before cover placement, `loadPhoto()` uses
Sharp to normalize non-default EXIF orientation in memory and then uses the
oriented dimensions; the stored Blob is not replaced. The resulting
`PhotoAsset.renderRotation` is explicit: it is `0` after EXIF normalization,
so `createPhotoLayer()` never derives a second rotation from the normalized
dimensions. Unnormalized legacy landscape sources retain their explicit
renderer rotation, while portrait sources remain upright.

The render path calls `downloadRecipeImage()` with only the server-read
`RecipeImage.blobName`. Storage downloads the Blob directly with
`downloadToBuffer()` and enforces the 8 MB limit before the buffer reaches the
renderer. It does not perform a SAS-URL round trip and never accepts a client
blob name or image URL. Successful output is an in-memory PNG response with
`Cache-Control: no-store`; no image or render metadata is persisted.

### Quota Enforcement

For AI features, call `enforceQuota()` before the operation and `trackUsage()` after success.

```ts
const quotaResponse = await enforceQuota(user, 'food-estimate');
if (quotaResponse) return quotaResponse; // 429
// ... perform AI call ...
await trackUsage(user, 'food-estimate');
```

`GET /api/ai/weekly-insight` reuses the existing `daily-insight` feature key as
the shared personal-insight budget. It checks quota before Azure OpenAI and tracks
usage only after a response passes server-side Structured Output validation and the
weekly exceedance-language validation. When no day has `targetPercent > 100`,
generated exceedance language is rejected and the invalid output is not cached. Quota
exhaustion is converted to a `200` weekly response with usable deterministic week
data and `evaluation.text: null`; it is not exposed as a standalone `429`.

The weekly handler reads exactly seven completed date-only days relative to the
validated local `date` query parameter. It calculates nutrition, historical target
snapshots, profile fallbacks for days without an explicit stored target, effective
activity targets, percentages, missing-data states, and totals server-side. A
profile fallback uses the stored training target for an explicitly marked training
day and the stored rest target otherwise; it is read-only and never persisted as a
historical snapshot. The AI receives only the sanitized aggregate context. Meal names,
product text, user IDs, tokens, cache IDs, and raw diary documents are not sent to
the provider or written to weekly handler logs.

Weekly documents use `_docType: 'weeklyInsight'` and the key
`${userId}:weekly:${periodEnd}` in the existing `aiInsights` container. Their hash
includes the seven days' meal/item identities and stored macros, DayMeta/activity
snapshots, profile fallback calorie targets, the reference date, and the prompt
version. A hash change never returns
the previous evaluation text; a short regeneration interval may return a neutral
evaluation until a new generation is allowed. A generated `evaluation.text` is
trimmed and limited to 750 characters at every backend contract boundary. A
provider response with `finish_reason: 'length'` is treated as unavailable, is
stored with `evaluation.text: null`, and does not consume quota.

WeeklyInsight cache reads use `response.status` and `response.generatedAt` as
the canonical fields. The top-level `status` and `generatedAt` remain optional
legacy fields and are dual-written during the compatibility rollout, so old
documents and rollbacks remain readable without a migration or a container or
partition-key change.

## Import Rules

[Rule] Value imports from `@fittrack/shared` compile to `require('@fittrack/shared')` in output JS. At runtime, Node cannot execute `shared/index.ts`, causing `ERR_MODULE_NOT_FOUND`.

- **Type imports:** use `@fittrack/shared` path alias freely (`import type { X } from '@fittrack/shared'`)
- **Value imports:** use relative paths (`import { fn } from '../../../shared/lib/profileCalculator'`)
- Verify with `npm run build:verify` after changing shared imports

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | openai.ts | Azure OpenAI base URL |
| `AZURE_OPENAI_API_KEY` | openai.ts | API key |
| `AZURE_OPENAI_API_VERSION` | openai.ts | API version (default: `2024-07-01`) |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | openai.ts | Model deployment name |
| `COSMOS_ENDPOINT` | cosmos.ts | Cosmos DB endpoint |
| `COSMOS_KEY` | cosmos.ts | Cosmos DB key |
| `COSMOS_DATABASE` | cosmos.ts | Database name (`fittrack-db`) |
| `AUTH_JWKS_URI` | auth.ts | JWKS endpoint for token validation |
| `AUTH_ISSUER` | auth.ts | Expected JWT issuer |
| `AUTH_AUDIENCE` | auth.ts | Expected JWT audience |
| `INTERNAL_USER_IDS` | auth.ts | Comma-separated user IDs with `internal` tier |
| `AZURE_DOC_INTELLIGENCE_ENDPOINT` | documentIntelligence.ts | DI endpoint |
| `AZURE_DOC_INTELLIGENCE_KEY` | documentIntelligence.ts | DI key |
| `AZURE_STORAGE_CONNECTION_STRING` | storage.ts | Blob storage |

Local values are in `backend/local.settings.json` (gitignored) — this is the **only** source of credentials for local development. See [tech/07-infrastructure.md](07-infrastructure.md#application-settings--local-dev-credentials) for the agent rule on handling missing keys.

## Build and Deploy

- Local dev: `npm run dev` from `backend/`; the launcher checks port 7071, builds, starts Azurite, waits until its Blob, Queue, and Table services answer over HTTP, provisions the `reusable-items-enrich` queue, and only then starts Azure Functions. It fails early with an actionable message if another Functions host already owns port 7071. Azurite data is stored in the OS temp directory by default to avoid sync-folder file locks; `FITTRACK_AZURITE_LOCATION` can override it. `npm run start` assumes Azurite is already running.
- Build: `npm run build` (TypeScript -> `dist/`, then deterministic Instagram renderer asset copy)
- Verify: `npm run build:verify` — builds, copies the renderer assets, then runs `scripts/verify-build.mjs`, which checks that `require('@fittrack/shared')` does not appear in the output
- Deploy: always from `_deploy_staging/` with `--no-build` flag (used for all environments, not just staging)
- Before deploy: delete `dist/` and `tsconfig.tsbuildinfo` for a clean build

### Instagram renderer package contract

The backend runtime dependencies contain the renderer packages at the verified
POC ranges: `satori ~0.33.4`, `@resvg/resvg-js ~2.6.2`, `lucide-static
~1.46.0`, `@tabler/icons ~3.46.0`, and `sharp ^0.34.5`. `pixelmatch
~7.2.0`, TypeScript, Vitest, and type packages remain backend development or
test dependencies and are not part of `_deploy_staging`.

`npm run copy:instagram-assets` validates and copies the complete nine-file
manifest from `backend/src/lib/instagramRenderer/assets/` to
`backend/dist/backend/src/lib/instagramRenderer/assets/`. The manifest is:

- `branding/fittrack-wordmark.png` (legacy fallback)
- `branding/micha-logo-writing.svg`
- `fonts/Inter-Medium.ttf`, `fonts/Inter-SemiBold.ttf`,
  `fonts/InterDisplay-Bold.ttf`, and `fonts/LICENSE.txt`
- `nutrition/barbell-header-frame.svg`
- `nutrition-highlights/high-protein.png` and `nutrition-highlights/low-fat.png`

The script removes the target asset directory before copying, rejects missing
or unexpected source files, and is included in `build` and `build:verify`.
The compiled renderer therefore resolves `__dirname/assets` without reading
from `backend/src`.

See [tech/07-infrastructure.md](07-infrastructure.md) for full deploy workflow.
