# Backend

## Entry Point

`backend/src/index.ts` — imports all function modules. Each module self-registers routes via `app.http()`. Adding a new function module requires adding an import here.

[Pattern] `backend/src/lib/registrations.test.ts` validates that every `*.ts` file under `functions/` is imported by `index.ts`. This test catches 404 bugs from forgotten registrations.

## Function Modules

Located in `backend/src/functions/`. Each file owns one domain.

| File | Routes | Auth Required | Notes |
|---|---|---|---|
| `profile.ts` | GET/POST/PUT /profile/me, POST /profile/calculate-preview, DELETE /profile | Yes | Authenticated full FitTrack data deletion |
| `nutritionTargets.ts` | nutrition targets endpoints | Yes | |
| `weights.ts` | GET/POST /weights, GET /weights/changes, PUT/DELETE /weights/{id} | Yes | Delta route uses a fixed checkpoint; full export remains unchanged |
| `diary.ts` | GET/POST /diary/day/{date}, meal CRUD, GET /diary/changes/meals | Yes | Delta pages use a fixed checkpoint and stateless tuple cursor; full export remains unchanged |
| `reusableItems.ts` | CRUD /reusable-items | Yes | |
| `reusableItemsEnrich.ts` | POST /reusable-items/{id}/enrich | Yes | AI enrichment |
| `reusableItemsEnrichScheduler.ts` | Timer trigger | — | Background enrichment |
| `recipes.ts` | CRUD /recipes, image upload/crop-update/delete/reorder, recipe logging, export-view preparation | Yes | Image upload appends; crop updates metadata only; delete and reorder normalize image order. |
| `instagramRecipe.ts` | POST /recipes/{id}/instagram-render | Yes | Server-owned recipe data to PNG renderer; no persistence |
| `instagramRecipe.ts` | POST /recipes/{id}/instagram-render, POST /recipes/{id}/share-bundle | Yes | Legacy direct PNG plus atomic bundle from an optional request draft or stored confirmed view, including stale snapshots; no persistence |
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
| `diaryItemUsage.ts` | Best-effort, source-specific usage tracking after a successful diary copy commit |
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
- Structured logging: `handler.start`, `handler.success` (with status + duration ms), and `handler.error`
- Returned 4xx/5xx responses are logged as `handler.response.failure` at warn/error level with status and only stable token-shaped top-level API `code`/`error` identifiers; response bodies and human-readable error text are not logged
- `UnauthorizedError` → 401
- Any other thrown error → 500 (stack never leaked to client)

```ts
export const myHandler = withHandler('domain.action', async (request, ctx) => {
  const { userId } = await requireUser(request);
  // ... business logic ...
  return { status: 200, jsonBody: result };
});
```

Recipe HTTP routes use `withRecipeHandler()` around the same handler boundary.
It preserves successful and binary responses and normalizes every returned
4xx/5xx response to the Recipe error envelope documented in
[`tech/09-api-reference.md`](09-api-reference.md#recipe-error-contract-and-frontend-actions).
Unexpected exceptions return a generic `INTERNAL_ERROR`; classified upstream
failures return `UPSTREAM_UNAVAILABLE`. Logs contain stable codes, stages,
correlation IDs, route recipe/image IDs when present, quota counters and
allowlisted diagnostic metadata, never exception messages, stacks, or
unbounded request/provider values.

Community recipe handlers emit targeted events for rejected list inputs,
invalid continuation tokens, unavailable recipe/image IDs, and image download
rejections or failures. Image events include recipe/image IDs and safe stage,
reason, size/type, or allowlisted storage error metadata. Continuation token
values, exception messages, and image contents are not logged.

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
- `profileDeletionRepository` — TTL concurrency lease and full Cosmos user-partition sweep

`WeightsRepository.updateValue(userId, id, value)` uses `userId` as the Cosmos
partition key and patches `/value` plus `/updatedAt`. The entry's ID, owner,
date, unit, and creation timestamp remain unchanged; a missing or
foreign-partition ID returns `null` for the handler to expose as 404. New
entries initialize `updatedAt` from `createdAt`; changing a value stamps a new
UTC `updatedAt`. `listUpdatedSince(userId, since)` is an inclusive,
single-partition delta read; legacy entries without `updatedAt` use `createdAt`
for the comparison. The optional field is a Class 0 change: old documents remain
valid, reads handle the absent field, and no migration or backfill is required.

`DiaryRepository.listMealsUpdatedSince(userId, since)` uses the existing
`nutritionDiaryMeals` `/userId` partition and returns meals with an inclusive
UTC ISO timestamp comparison. Legacy meals without `updatedAt` use
`createdAt`; DayMeta documents are excluded. Meal creates initialize both
timestamps, and every persisted Meal replacement stamps `updatedAt`. Hard
deletes have no delta tombstone and therefore are not represented by this
repository query. Optional Meal `updatedAt` is also Class 0: legacy documents
remain readable through the `createdAt` fallback, with no migration or
backfill.

The registered `GET /api/weights/changes` and
`GET /api/diary/changes/meals` handlers authenticate each request and derive
the only repository partition identity from the verified JWT `sub`. Both use a
canonical UTC `since` and a fixed server UTC `checkpointAt`; the meal cursor
keeps that checkpoint and resumes after a stable `(updatedAt ?? createdAt,
id)` tuple. These are queries over current documents, not change journals or
database snapshots. The backend stores no device checkpoint, transfer status,
deletion history, or deletion-ID list. The local ID-only Health Connect delete
retry described by the unapproved [HC-4 draft](../../User%20Stories/HealthConnect/HC-4_Health-Connect-Synchronisation-vereinfachen.md)
is Mobile-owned and is not implemented by these backend changes; the current
Mobile sync services still persist snapshot-based `pendingOperations`.

`ProfileRepository.get()` resolves missing legacy `macroRanges` in memory from
the profile weight and each day's stored calorie and fat targets. This read
compatibility does not write the derived values back; a later profile
recalculation persists the new ranges.

`UserFoodRelationRepository.recordUsage()` requires the explicit date-only date of
the diary meal for `usageDates`; it never derives a user date from the server
clock. `lastUsedAt` and `createdAt` remain UTC instants. Missing internal usage
dates fail closed in both repository implementations. For existing non-recipe
relations, `recordUsage()` and `setFavorite()` update `displayBrand` only when a
non-empty string is supplied (merge semantics in both implementations), so the
brand-less diary add path no longer erases a favorite's brand.

`UserFoodRelationRepository.getByFoodRef()` returns `null` only for "not found"
(Cosmos `code` 404 or no resource). Any other read error is rethrown so
`setFavorite()` (reported to the client as an error) and the other read-modify-write
paths never overwrite an existing relation based on a failed read; `recordUsage()`
stays fire-and-forget and swallows the error without writing.
The recipe guard in `POST /api/diary/meals/:id/items` (runs for every add with a
`productId`) is fail-open: if `getByFoodRef()` throws, the handler logs the
`diary.item.recipeGuardReadFailed` warning (error class only, no user data) and
treats it as "no relation found", so ordinary foods can still be logged. The
residual risk is limited to an own recipe id being logged as a free entry; a
found recipe relation still returns 404.
`updateDisplayDenormalized()` (called from `PATCH /api/reusable-items/:id` next to
`updateNutritionDenormalized()`) syncs `displayName`/`displayBrand` into existing
non-recipe relations only; it never creates relations and skips unchanged values.

### Daily Insight feedback status boundary

The admin-only feedback status operation is intentionally separate from
feedback submission and source-snapshot reads. `updateFeedbackProcessingStatus`
queries only `id`, `userId`, `_docType`, and `processingStatus` within the
requested user partition, then conditionally patches only `/processingStatus`.
It does not load the feedback comment, prompt/context snapshot, or source Daily
document. The Cosmos contract test locks both the metadata projection and the
single-field patch; feedback submission retains its separate exact-Daily read.

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

### Ownerless community recipe preservation

Owner recipes remain in `recipes` partitioned by `/userId`; owner CRUD is
unchanged. `communityRecipes` is a separate `/id`-partitioned container for
ownerless copies retained when a user keeps published recipes during the
implemented account-deletion workflow. Its
document keeps recipe content and neutral community image paths, but has no
`userId`, `ownerUserId`, author-consent/profile mapping, `sharedWithUserIds`,
usage counters, or personal `linkedReusableItemId` ingredient references.
The repository serializes an allowlist of fields before every upsert.

`preservePublishedCommunityRecipe()` copies each bounded JPEG/PNG image to the
stable `community/{recipeId}/{imageId}.{jpg|png}` path and only then upserts the
ownerless document under its recipe ID. Repeating the operation overwrites the
same blob names and upserts the same document ID; a partial image-copy failure
does not publish the document and is safe to retry. The helper does not delete
the owner-path images or owner recipe. Account deletion must call it before
removing those personal records, then use the normal recipe/blob delete
operations. The authenticated profile-deletion flow performs this transfer;
Blob Soft Delete configuration is unchanged.

Community reads prefer the ownerless copy when present and otherwise retain
the existing owner-backed publication read path. Community listing merges and
deduplicates both forms. Each source query is ordered by `updatedAt DESC, id
ASC` and capped at `offset + pageSize + 1` before the merged page is sliced.
Both `recipes` and `communityRecipes` therefore require that composite index.
Ownerless projections return `Anonymous`, do not read a profile, and do not
increment an absent owner's recipe usage counter.

### Profile deletion

`DELETE /api/profile` deletes active FitTrack data for the verified JWT `sub`
only. Its strict request is exactly:

```json
{
  "confirmation": "DELETE",
  "deleteCommunityRecipes": false
}
```

Both fields are required, confirmation is case-sensitive, and unknown fields
are rejected. The five-minute renewable per-user TTL lease is stored in
`aiInsights` as `_docType: 'profileDeletionLock'`; its lock token, expiry, and
TTL are concurrency metadata only, with no journal, progress, or resume state.
The verified JWT `sub` is the only deletion target and scopes the Cosmos user
partition and exact legacy `users` ID. The Bearer token is used for
authentication only; it is not persisted or forwarded. The lease stores the
`sub` as `userId`, a random lock token, expiry, and TTL. Deletion-specific
success logs contain no user fields; failure events contain only stage and
error class, not the user ID or token.
New protected HTTP requests receive retryable `409` while the lease is active.
The scheduler checks before enqueueing, and the queue worker checks before
processing. Work admitted before lock acquisition is not cancelled, drained,
awaited, or rechecked and may write after `204` or lock release. `204` confirms
only this request's selected cleanup steps; this late-write possibility is
accepted.

The Cosmos sweep is scoped to the verified user's partition in `profiles`,
`weights`, `nutritionDiaryMeals` (including DayMeta and HintState),
`reusableMealItems`, `recipes`, `aiUsage`, `aiInsights`, and
`userFoodRelations`. It also attempts the exact `/id` legacy `users` document
and the legacy `nutritionProfiles` user partition if present; this does not
assert that those records exist in a deployed account. Their contents are
unknown; no remote inventory was performed. It does not touch `foodProducts`,
friendship data, or another user's data.

With `deleteCommunityRecipes: false`, published recipes selected for retention
are copied to ownerless `communityRecipes` documents and stable
`community/{recipeId}/{imageId}.{jpg|png}` image paths before personal records
are removed. They remain usable through community routes and display author
`Anonymous`. With `true`, only ownerless copies for this user's recipe IDs and
their community image blobs are removed. Both choices remove the user's
personal images under their prefix in `recipe-images` and `product-images`;
the personal prefixes are re-inventoried until empty.

The user-data cleanup removes Cosmos documents and Blob Storage images; the
handler also emits operational Application Insights events. It does not call
Microsoft Graph or send deletion data to Azure OpenAI or Document Intelligence.
Foreign favorites, saved diary snapshots, friendships, and Health Connect
exports are unchanged. Application Insights entries and Cosmos/Storage backups
are not targeted; logs use the configured 30-day retention and Blob Soft Delete
may retain recovery copies for up to seven days. Retries repeat the complete
idempotent request from the beginning. See the full
[DELETE API contract](09-api-reference.md#delete-apiprofile) and
[recipe retention behavior](../domain/06-recipes.md#account-deletion).
Any Microsoft Entra identity follow-up is outside the endpoint and is an
internal manual Product Owner task, not an end-user action.

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
metadata and are omitted when absent. Layout constants, element trees, icon
resolution, and nutrition rounding remain owned by the renderer.

The versioned `instagram-recipe-v1` frame is the renderer's `1080 x 1015`
photo/hero area, not the complete output. The older `1080 x 880` reference is
not a runtime contract because it ends before the tag zone. The renderer still
returns exactly `1080 x 1350` PNG. Before cover placement, `loadPhoto()` uses
Sharp to normalize non-default EXIF orientation in memory and then uses the
oriented dimensions; the stored Blob is not replaced. The resulting
`createPhotoLayer()` uses those oriented dimensions directly and never applies
an additional landscape rotation, so normal portrait and landscape sources
remain upright and EXIF orientation is handled exactly once.

The nutrition image keeps the existing 62 px, single-line title layout when its
measured width fits. On overflow, rendering retries at 58 px and then at 50 px
with up to three lines anchored to the bottom of a fixed title region; the tag
row retains its original vertical position. The short-title composition is
unchanged. The detail image independently adapts title size and wrapping above
the teaser; both images are validated against their measured text bounds before
PNG output is returned.

The render path calls `downloadRecipeImage()` with only the server-read
`RecipeImage.blobName`. Storage downloads the Blob directly with
`downloadToBuffer()` and enforces the 8 MB limit before the buffer reaches the
renderer. It does not perform a SAS-URL round trip and never accepts a client
blob name or image URL. Successful output is an in-memory PNG response with
`Cache-Control: no-store`; no image or render metadata is persisted.

`POST /api/recipes/{id}/share-bundle` uses a strict request schema that excludes
client `recipeMeta` and loads the authenticated recipe once. Its optional
top-level `exportViewDraft` uses the shared request-only
`RecipeShareBundleExportDraft` type: version `1`, a trimmed teaser (1-96 characters), nullable
time (positive integer, at most 10,080) and difficulty (non-empty single-line
text), 1-5 ascending ordered steps (1-90 character descriptions), and at most
20 unique included ingredient IDs. Unknown fields, including
`sourceFingerprint`, are rejected. Every included ID must identify exactly one
non-seasoning ingredient in the current user-scoped recipe.

The handler uses the request draft for that render when present; otherwise it
uses the stored `exportView`, including a stale snapshot. If neither exists,
it returns `422 MISSING_EXPORT_VIEW`. The current recipe supplies canonical
fields, while the selected draft or view supplies teaser, time, difficulty,
steps, and included ingredient IDs. IDs select current ingredient values
without AI-key or name mapping. The draft is never persisted, does not refresh a
fingerprint, and triggers neither AI nor quota work. Both PNGs are encoded into
the unchanged JSON response only after both renders succeed; any renderer
failure returns an error without a partial image pair.

For a request draft with `null` time, both renderers omit the time chip; the
Instagram renderer also omits a `null` difficulty chip. Portions remain visible
in both, and the detail template keeps its displayed-ingredient-count chip.
Difficulty remains omitted from the detail image even when present.
The legacy direct Instagram route retains its request-level `recipeMeta`
compatibility.

The detail-template renderer keeps the `1080 x 1350` canvas and supports 1
through 20 displayed ingredients and 1 through 5 steps. The adapter supplies
the confirmed time and difficulty, but the detail image renders only portions,
time, and displayed ingredient count as metadata chips. Difficulty remains in
the persisted `exportView` and in the existing Instagram metadata input; its
omission is limited to the detail PNG.

Before composition, `renderInstagramRecipeDetailsTemplate()` applies
`addMeasuredGermanBreaks()` to the title, teaser, ingredient amount/name text,
and steps. Normal wrapping stays at whitespace; an overwide word may split
only at positions returned by the German `hyphen/de` patterns. Candidate
segments are measured with the production fonts, including each inserted
hyphen. The `@napi-rs/canvas` renderer then lays out the element tree
(`flexLayout.ts`, `canvasRenderer.ts`), measures the title, teaser, ingredient,
and step text nodes against their assigned width and height with the bundled
fonts (`fontBook.ts`), and paints the PNG (`canvasPaint.ts`). A
non-fitting legal break or measured overflow returns `TEMPLATE_FIELD_OVERFLOW`
with the field and, for list content, the item index and field; no detail PNG is
returned. A bundle with any render failure withholds both images. The template
uses normal word breaking throughout and has no `break-all` fallback. The teaser
has no additional heading and uses bundled Inter Medium Italic with a lime accent
line. A final full stop is omitted from the displayed teaser. It starts at 22 px,
matching regular preparation text, and retries in 1 px steps down to 18 px only
if its measured layout does not fit. A 12 px clearance separates it from the
metadata chips. Text is never truncated; an overflow at 18 px remains an error.
Recipe title, ingredient rows, and preparation text keep their existing sizes.

`probeInstagramRecipeDetailsGeneratedText({ savedTitle, teaser, steps })` is a
backend-internal text-only entry point in `instagramRenderer/render.ts` and its
existing barrel. It shares the production title/teaser subtree, preparation
panel and parent constraints, German breaks, font cache, node collection and
0.5 px bounds tolerance with the full renderer. It loads only the layout engine
and the bundled fonts, not photos, Blob data, design assets or Sharp.
The complete 1-5 step candidate determines the existing large/compact layout;
the saved title remains context, not an editable generated field. The teaser
keeps the existing italic font, terminal-period display rule and 22/21/20/19/18
selection. Existing input length and single-line constraints remain unchanged.

The discriminated result has `status: success | generated-text-failure |
technical-failure`, per-field diagnostics and the evaluated `teaserFontSize`.
Measured diagnostics include actual width/height and assigned bounds; German
width-only failures have width and its limit but no invented multiline height.
Invalid/skipped fields are never reported as fitting. Missing or non-finite
measurements, unavailable/corrupt fonts, layout/render engine errors and invalid/non-fitting
saved-title context are technical failures, not AI-correctable failures. The public
error code for such failures is still `FONT_OR_SATORI_FAILED`, and some internal
types keep the `Satori*` prefix; both are kept for API/error-contract stability.
Success establishes only generated teaser/step fit in that title context; it
does not certify the saved title, ingredients, chips, images or share bundle.
The full renderer retains its existing first-failure public contract, including
the legacy height value on German width-break errors. B-1 supplied the probe;
B-2 now integrates it into the Preparation loop described below.

### Recipe export preparation and confirmation concurrency

`POST /api/recipes/{id}/export-view/prepare` accepts only the strict V2 body
`{ "contractVersion": 2 }`; it has no empty-body or V1 fallback. It does not
require client `If-Match`. A supplied header is checked against the
server-loaded recipe and a mismatch returns `412` before quota or provider work.
The response keeps `sourceEtag` for compatibility, but it is not a client-side
acceptance prerequisite. Preparation is transient and does not change the
recipe, confirmed export view, ingredient IDs, or ingredient values.

The handler calls `prepareValidatedRecipeExport(context)` from `recipePreparation.ts`,
which uses `prepareRecipeExport(context, options)` with Preparation v12;
`analyzeRecipeText(text)` is import-only (v17, full `AiRecipeRaw`, unchanged
normalization and globally ascending flattened references). Preparation sends
the complete ID-free saved metadata/ingredient projection and all original
`order`/optional `title`/`description` steps as untrusted JSON user data.
The separate Strict `recipe_export_preparation` schema returns backend-only
`RecipeExportPreparationOutput`: `{ version: 1, teaser, totalTimeMinutes,
difficulty, steps }`, where steps contain only `{ order, description,
sourceStepOrders }`. Every field is required and every object is closed; no
ingredients, keys or model-returned source steps are accepted. The same lazy
client, deployment/API version, temperature 0.2 and max_tokens 2048 are used for
each of at most three logical calls (initial plus two corrections). SDK
`maxRetries: 0`, AbortSignal and at most 20000 ms per call apply only to
Preparation. The monotonic 75000 ms generation/validation/probe deadline is
not reset by corrections. Provider/probe awaits are bounded, timers cleaned
up, pending provider work aborted and late results discarded. A deadline check
precedes usage booking; booking itself is awaited once, never raced or retried.
No fallback, wrapper, truncation, padding, sorting or identity repair is added.

Corrections receive immutable original ID-free context, exact latest whole
draft and structured validation/probe diagnostics. The whole new output and
complete teaser/step array are revalidated/reprobed, including after count
changes; technical failures take precedence over content failures. Geometry
uses the unchanged production fonts, large/compact bounds and 0.5 px tolerance,
with width-only diagnostics never inventing height. Missing, duplicate or
non-finite measurements are terminal. Generated-text fit in saved-title context
does not certify ingredients, title, chips, image or Share. Existing teaser
22..18 selection remains; no new font/layout fallback, 23/11 cap, three-line
product rule or ingredient-omission strategy is introduced.

`validateRecipeExportPreparationOutput(output, recipe.steps)` receives the saved
source separately and checks positive unique ascending source orders, export
orders 1..K, Shared min1/max5/text90/teaser96/time10080 limits and nullable trimmed
non-empty single-line difficulty. Known reference groups are non-empty and
locally ascending, globally unique, and ordered by FIRST reference, not by the
flattened trace: `[1,4,6],[5]` is allowed only here; `[5],[1,4,6]` is rejected.
Gaps and non-contiguous source orders are valid. Empty saved steps or exclusively
blank source descriptions returns 422 before quota/provider work; other
shape/reference/limit failures can request correction and exhausted invalid
drafts return 422 without usage. Auth, owner lookup
and optional ETag remain before quota; valid success alone tracks
`recipe-analyze` exactly once. Internal references are stripped from the
unchanged plain V2 App response. Cooking-core preservation, component fit and
metadata derivation are prompt/fixture/review concerns, not a general runtime
semantic check. The v11 prompt requests a complete compact detail-image workflow
by grouping actions after reading the full recipe.

Initial creation and full-draft correction use separate v11 prompts; pure
measured overflow uses the strict text-only path and merges only target strings.
All three explicitly preserve source cooking endpoints. Total time must be
explicitly stated or fully derivable from an entirely timed, explicitly
sequential source; untimed work/unclear overlap requires `null`. Runtime has
no new semantic validation. V11 decides time before compression from the full
source and prioritizes essential separate cooking/endpoints over optional
details. Free grouping and FIRST-order validation remain unchanged. Q-21's
second and final correction awaits independent F/R/G and human oven review;
no deploy is authorized. CORR1 failed; dated evidence remains historical.

QA-R1 font metadata comes from `getRecipeDetailsTextLayoutFields`: large steps
22/1.25, compact steps 18/1.17 and teaser italic/1.25. Actual geometry is unchanged.
Unknown-key-only (`unrecognized_keys`) diagnoses and nonstring affected values
remain metadata-only; eligible known-string failures retain exact latest text
only on exhaustion. These local corrections are tested, pending independent QA.

[Partial] B-2 r3 / QA-R1 is implemented, NOT ACCEPTED / release CLOSED:
focused519/full1600 passed, typecheck/build exit0; required F exit1 (5 executed /
2 passed / 3 failed / 9 skipped); R/G NOT_RUN_REQUIRED_LIVE_FAILURE.
Version guard and pasta pass. Rice has FIRST 6 before 5 and overflows (422);
oven fits/200 but source-3 cream action moves into the source-4 group (semantic
FAIL); forced dough repeats the overflow (422, semantics NOT_REACHED).
QA established r2 pasta/dough lexical rubric defects, not proven cooking loss;
narrow test-only repairs do not reclassify old FAIL or close findings.
No loop Alpha deployment or QA acceptance is established; the historical
14:12 Alpha release is logging-only. See
[current r3 evidence](06-ai-integrations.md#preparation-feedback-loop-current-r3-qa-r1)
and the [D-1-R1 handoff](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Handoff_2026-10-09-r1.md).

[Partial] Historical B-19 v4/v16 is implemented, not accepted: upstream offline gates passed
(1437 units, typecheck/build); all F/R/G live gates exited 1. All three Preparation
fixtures executed in each; rice/oven were rejected with 422/usage0/writes0/
unchanged=true, pasta completed success assertions. Complete all-three
cooking-core/success-path proof and independent QA remain open. No repair retry,
deployment, acceptance or release is established; see the
[B-19 handoff](../../User%20Stories/Reciepe/B-19_Recipe-Preparation_Handoff_2026-10-09.md).

An explicit `PUT /api/recipes/{id}` export confirmation also does not require a
client `If-Match`; a supplied header remains an optional precondition. The
handler reads a versioned recipe and passes that server-read ETag to repository
`compareAndReplace`. The in-memory implementation compares the expected ETag,
and Cosmos uses `IfMatch` on replace. A lost write race returns
`412 recipe_revision_conflict` without a merge or retry. This internal
compare-and-replace remains the write-race guard even when the client sends no
ETag. No recipe document, Cosmos container, or infrastructure schema changes
are required.

Recipe share failures are logged with a stage and stable reason where the
handler can classify them. Export preparation records Azure OpenAI error name,
sanitized provider code/status/request ID, and duration. Server-validation
failures record up to eight phase/code/field-path diagnostics plus a truncation
flag; validation messages are not logged. With ordered partial traces, the
coverage-only payload/helpers are removed: no `sourceStepTrace`, expected/actual
order lists, or first-mismatch fields. Genuine unknown, duplicate, or reordered
references still produce bounded phase/code/path diagnostics; generic request
and provider diagnostics remain.
Preparation logs otherwise exclude recipe/context text, generated source/export
text, raw provider payloads and ingredient values. The sole new exception is
`recipes.prepareExportView.correctionsExhausted`, only after the initial draft
and two completed parsed corrections remain invalid. It records exact latest
affected known step descriptions, teaser or difficulty, not old/intermediate
drafts, source/context, arbitrary fields or unaffected text. `affected_fields`
is JSON escaped; each field includes path/index/order when available, exact
text/length and up to eight safe diagnoses with a truncation flag. The summary
is bounded to eight phase/code/path entries; structured diagnoses retain
constraints, reference values and available measured bounds/font/layout.
Exact affected text is not truncated; diagnostic limits do not imply a blanket
provider-payload size bound. This correction-exhaustion exception does not
extend to terminal provider, technical, timeout or booking failures, success
logs, other flows or HTTP. Separately, a
`recipes.prepareExportView.analysisFailed` event with
`failure_code=TITLE_LAYOUT_FAILED` records `recipeId`, the saved `recipe_title`,
probe step count/layout, font size, and measured title width/height with their
allowed bounds when available. It does not log generated teaser/step text or
expose title or measurements over HTTP. This title-layout failure returns the
actionable 422 `TITLE_OVERFLOW` response. Provider/timeout
errors return generic 502, other technical probe/lookup/quota-backend/booking
errors generic 500, and exhausted invalid drafts the existing 422
validation envelope with bounded phase/code/path details, never raw text,
measurements or private Error.message. Booking is once after validation and
deadline check, with no automatic save or late-timeout booking.
The completion event records source/export step counts. These diagnostics
describe structural/reference failures against saved `recipe.steps`, not
general cooking quality, guaranteed preservation, or historical replay. Privacy
checks cover every log/warn/error argument, including nested values. See
[Preparation V2 evidence boundary](06-ai-integrations.md#preparation-v2-evidence-boundary).
Strict request-body failures across preparation and rendering record bounded
Zod issue codes, sanitized schema paths, and up to eight identifier-shaped
unknown field names, with issue/key truncation indicated; request values are
never included.
Recipe create/update events include `export_view_confirmed` so confirmation
requests can be distinguished from ordinary edits.

Render failures include the render stage, selected image ID, error code,
bounded single-line message/cause, and available field or layout measurements.
For `TITLE_OVERFLOW` only, the renderer warning also includes the exact
`recipe_title` that was measured; successful logs and unrelated failures never
include the title.
Detail-template failures retain `item_index` and `item_field` but never log
`item_value`. For `recipes.shareBundle.unrenderableDetail` with a measured
step overflow, targeted recipe-text diagnostics additionally include the exact
affected `step_text`, `step_count`, `step_layout` (large/compact),
`step_text_length`, `step_longest_word_length`, and `step_explicit_line_breaks`.
These values come from the actual adapted renderer input, including request
drafts, not from a potentially different stored export. JSON preserves the
text and escapes line breaks; only the failing step is logged, not the whole
recipe, other steps, request, image data or credentials. The HTTP error remains
unchanged and does not contain the step text. The existing Preparation and
request-validation content exclusions above are unchanged.
Bundle render events also identify whether they used a request
draft or stored confirmed view. Storage-download failures record only safe
error name/code/status metadata. Successful render events record output byte
counts, not image data. Early failures use
`recipes.instagramRender.preconditionFailed` or
`recipes.shareBundle.preconditionFailed`; renderer failures use the existing
`.unrenderable`/`.failed`, `.unrenderableDetail`, and `.detailFailed` events.
Classified precondition failures use
`recipes.instagramRender.preconditionFailed` or
`recipes.shareBundle.preconditionFailed`; invalid image metadata, oversized
images, and storage download errors use their dedicated events. Renderer
failures use the existing `.unrenderable`/`.failed`, `.unrenderableDetail`,
and `.detailFailed` events. Diagnostic details are never included in HTTP
error responses.

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
| `AZURE_OPENAI_API_VERSION` | azureOpenAiConfig.ts | API version (default: `2024-10-21`) |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | azureOpenAiConfig.ts | Model deployment name (default: `gpt-4.1-mini`) |
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

## Runtime and Production Dependencies

Source of truth: `backend/package.json` and `_deploy_staging/package.json` (identical production dependency ranges, one lockfile resolution each). Full version matrix: [01-system-overview.md](01-system-overview.md#version-pins-and-support-matrix).

- Node `>=24.22.1 <25`, npm `12.2.1` (`engines`); `.nvmrc` = `24.22.1`; TypeScript `^7.0.2` (native compiler).
- `openai ^7.45.1` (resolved 7.45.1), `zod ^4.6.7` (resolved 4.6.7), `@azure/cosmos ^4.10.1`, `@azure/functions ^4.17.0`, `@azure/storage-blob ^12.34.0`, `@azure/storage-queue ^12.32.0`, `@azure/ai-form-recognizer ^5.1.0`, `jose ^6.2.14`, `sharp ^0.35.5`.
- Azure OpenAI deployment name and API version come only from `backend/src/lib/azureOpenAiConfig.ts` (see [06-ai-integrations.md](06-ai-integrations.md#configuration-single-source)).
- [Rule] Zod 4 changed default error texts and issue codes. They are part of the HTTP error contract, so `backend/src/lib/zodCompat.ts` restores the Zod 3 texts and codes and `http.ts`, `recipeHttp.ts` and `recipeAnalyzeValidation.ts` use it. Do not remove it without a contract decision. UUID-shaped ID fields (`ai.ts`, `recipes.ts`, `instagramRecipe.ts`, `dailyInsightFeedback.ts`) use `z.guid()` rather than `z.uuid()`; the reason is not documented in the repository ([Open], presumably preserves the lenient Zod 3 UUID check).
- TypeScript 7 specifics: `backend/tsconfig.json` uses `moduleResolution: bundler` with `module: commonjs` (`node10` was removed) and no `baseUrl`; `tsconfig.base.json` sets `types: ["node"]` because `@types/*` are no longer auto-included. The classic compiler JS API (`require('typescript')`) does not exist in TypeScript 7: `backend/scripts/functions-baseline.mjs` and the mobile AST test import `@typescript/typescript6 ~6.0.2` (a devDependency of `backend` and `mobile`) for `createSourceFile`.
- Local-only dev dependency `azurite ^3.37.0` carries a time-limited audit exception, see [08-testing.md](08-testing.md#dependency-policy-and-update-process).

## Build and Deploy

- Local dev: `npm run dev` from `backend/`; the launcher checks port 7071, builds, starts Azurite, waits until its Blob, Queue, and Table services answer over HTTP, provisions the `reusable-items-enrich` queue, and only then starts Azure Functions. It fails early with an actionable message if another Functions host already owns port 7071. Azurite data is stored in the OS temp directory by default to avoid sync-folder file locks; `FITTRACK_AZURITE_LOCATION` can override it. `npm run start` assumes Azurite is already running.
- Build: `npm run build` (TypeScript -> `dist/`, then deterministic Instagram renderer asset copy)
- Verify: `npm run build:verify` — builds, copies the renderer assets, then runs `scripts/verify-build.mjs`, which checks that `require('@fittrack/shared')` does not appear in the output
- Deploy: always from `_deploy_staging/` with `--build remote --javascript`; the remote Linux build installs production dependencies and native packages for the Azure Functions runtime
- Before deploy: delete `dist/` and `tsconfig.tsbuildinfo` for a clean build

### Instagram renderer package contract

The renderer is `@napi-rs/canvas` (Skia). Satori, `@resvg/resvg-js` and the
`fflate` override were removed (Technology Refresh, WP-BE-02). The backend
runtime dependencies (manifest ranges in `backend/package.json` and
`_deploy_staging/package.json`) are `@napi-rs/canvas ~1.1.0`, `lucide-static
~1.65.0`, `@tabler/icons ~3.50.0`, `sharp ^0.35.5` and `hyphen ^1.14.1`.
`pixelmatch ~8.0.0`, TypeScript, Vitest, and type packages remain backend
development or test dependencies and are not part of `_deploy_staging`.
`@napi-rs/canvas` ships prebuilt platform packages; the root `allowScripts`
entry for it is `false` (no install script needed), so a missing binary for the
platform is not rebuilt at install time. `pixelmatch` 8 measures colour
distance in OKLab instead of YIQ, which raised the historical diagnostic ratio
in `golden.test.ts` (see `backend/src/lib/instagramRenderer/docs/golden-metrics.md`);
the pixel gate thresholds were not changed.

`npm run copy:instagram-assets` validates and copies the complete ten-file
manifest from `backend/src/lib/instagramRenderer/assets/` to
`backend/dist/backend/src/lib/instagramRenderer/assets/`. The manifest is:

- `branding/fittrack-wordmark.png` (legacy fallback)
- `branding/micha-logo-writing.svg`
- `fonts/Inter-Medium.ttf`, `fonts/Inter-MediumItalic.ttf`,
  `fonts/Inter-SemiBold.ttf`, `fonts/InterDisplay-Bold.ttf`, and
  `fonts/LICENSE.txt`
- `nutrition/barbell-header-frame.svg`
- `nutrition-highlights/high-protein.png` and `nutrition-highlights/low-fat.png`

The script removes the target asset directory before copying, rejects missing
or unexpected source files, and is included in `build` and `build:verify`.
The compiled renderer therefore resolves `__dirname/assets` without reading
from `backend/src`.

See [tech/07-infrastructure.md](07-infrastructure.md) for full deploy workflow.
