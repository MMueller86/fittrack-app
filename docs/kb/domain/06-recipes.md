# Recipes

## Recipe Model

`Recipe` (`shared/types/recipes.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `ownerUserId` | `string` | Owner; Cosmos partition key is stored separately as `userId` |
| `name` | `string` | Recipe name |
| `description` | `string?` | Optional |
| `portions` | `number` | Number of portions |
| `ingredients` | `RecipeIngredient[]` | |
| `steps` | `RecipeStep[]` | Ordered instructions |
| `images` | `RecipeImage[]` | Blob references and hero presentation metadata |
| `nutritionTotal` | `RecipeNutrition` | Aggregate nutrition for the full recipe |
| `nutritionPerPortion` | `RecipeNutrition` | Nutrition for one portion |
| `visibility` | `'private' | 'community'` | New recipes default to private; missing legacy values are read as private |
| `communityPublication?` | `RecipeCommunityPublication` | Content-confirmation timestamp and per-recipe display-name consent |
| `sharedWithUserIds` | `string[]` | Reserved; does not grant access |
| `tags` | `string[]` | Recipe tags |
| `usageCount` | `number` | How many times logged or copied into a diary; a copy increments it only while the recipe resolves as owner or published community content |
| `lastUsedAt` | `string?` | ISO timestamp of last diary log |
| `createdAt`, `updatedAt` | `string` | ISO timestamps |

## Visibility and Community Publication

Only the owner can change visibility. New recipes and legacy documents without
visibility are private. `sharedWithUserIds` is reserved and does not enable
sharing. Publication uses the dedicated `PUT /api/recipes/{id}/visibility`
route; ordinary create/update requests cannot set visibility or publication
metadata.

Publishing requires explicit confirmation that recipe text, ingredients,
preparation steps, and images will be visible to signed-in FitTrack users. The
separate display-name consent is per recipe and starts unchecked in Mobile.
Only when it is true does the community projection read the owner's current
profile `displayName`; otherwise, or when no display name is available, the
author is exactly `Anonymous`. No owner ID or other profile data is included in
the community response. Setting a recipe private removes its publication
record and prevents other users from loading it through community routes or
using an old favorite to open/log it. The owner retains ordinary access.

The authenticated community list is paginated. Community detail uses a safe
`CommunityRecipe` projection: ingredient product/library link IDs and owner
identifiers are omitted; ingredient provenance and derived AI/manual notices
are retained without claiming that FitTrack verified nutrition. Unknown
provenance is not described as manual or verified. Community image URLs point
to the authenticated image-bytes route, not a SAS URL; that route rechecks
current publication access on every request. Owner-only recipe routes continue
to use their existing access rules and image contract. Existing diary logs are
snapshots of the server's current recipe name, logged portions, and scaled
nutrition; later edits, privacy changes, or deletion do not rewrite them.

These publication and provenance fields use the existing `recipes` document
and container. No new container, partition-key change, global backfill,
migration, or Bicep change is part of this feature. The Cosmos-emulator
repository contract gate remains `UNVERIFIED`; this documentation is not a
QA-acceptance or release claim. See [tech/09-api-reference.md](../tech/09-api-reference.md)
for request/response shapes and the owner/community route matrix.

### Nutrition Provenance Compatibility

`RecipeNutritionSource` is `'openFoodFacts' | 'manual' | 'ai' | 'label-scan' | 'unknown'`. `nutritionSource` is backend-resolved response data, not a client-owned write field. The resolver uses linked catalog/reusable-item data and the AI flag where available. If an edit preserves the ingredient ID, source links, AI flag, and nutrition basis, stored provenance is retained, including `unknown`. Legacy unknown provenance is not inferred from current catalog contents or relabeled as manual. Contradictory source links or AI/provenance flags are rejected; unknown provenance does not produce a manual-origin notice.

## Ingredients

`RecipeIngredient`:
- `id` — ingredient identity within the recipe
- `displayName` — human-readable ingredient name (snapshot at time of adding)
- `inputMode: 'grams' | 'portion'` — how the user entered the amount
- `inputAmount` — amount as entered by the user (in grams or portions, depending on `inputMode`); `null` when indeterminate
- `amountGrams` — resolved gram weight used for nutrition calculation; `null` when indeterminate
- `unit` — display unit label such as `g`, `Scheibe`, or `Portion`
- `amountLabel?` — persistent optional display label for a seasoning (for example `1 TL` or `nach Geschmack`)
- `linkedProductId` — reference to a catalog product, or `null`
- `linkedReusableItemId` — reference to a reusable item, or `null`
- `isAiEstimate` — true when nutrition was estimated by AI
- `nutritionSource?` — server-resolved origin (`openFoodFacts`, `manual`, `ai`, `label-scan`, or `unknown`); this is response data, not a client-owned request field
- `category?: 'food' | 'seasoning'` — optional classification; omitted on historical food documents and treated as `food`
- `portionWeightGrams?`, `portionLabel?` — optional source-portion display data
- `nutritionPer100g` — nutrient basis used for recalculation on edit
- `nutritionContribution` — pre-calculated nutrition contribution of this ingredient (`calories, protein, carbs, fat, fiber`)

Nutrition for each ingredient is calculated from `amountGrams / 100 × nutritionPer100g`. A seasoning or any ingredient with `amountGrams: null` contributes zero.

`kitchenAmountText` belongs exclusively to the AI analysis contract; the persistent `RecipeIngredient` field is `amountLabel`.

[Rule] A recipe ingredient links to at most one source: catalog items use `linkedProductId`, reusable library items use `linkedReusableItemId`, and unlinked AI estimates use `isAiEstimate: true`. The backend resolves `nutritionSource` from these references and flags. Legacy ingredients with unknown provenance remain unknown when edited without changing their nutrition origin.

[Rule] During recipe analysis, every `food` ingredient with a determinable quantity must have a positive finite `amountGrams` value. Kitchen units such as tablespoons, teaspoons, millilitres, and pieces are converted before catalog resolution. A genuinely indeterminate food amount, such as unmeasured spray oil, must retain `amountGrams: null`; a tiny positive placeholder is not a measurement. It is routed to manual review and must be resolved or removed before persistence.

[Rule] Recipe analysis preserves preparation order with contiguous 1-based source-step orders. Export grouping may combine only adjacent source steps, and the flattened source-step trace must include every source step exactly once in order.

### Create / Update Compatibility

The backend validates recipe ingredients with the same contract for `POST /api/recipes` and `PUT /api/recipes/{id}`:

- `inputAmount` and `amountGrams` may be `null` in the transport payload.
- `food` requires a finite, positive `amountGrams`; a missing `category` uses this legacy `food` rule.
- `seasoning` may keep an indeterminate `amountGrams: null` (or zero) and contributes zero nutrition.
- `category`, `amountLabel`, `portionWeightGrams`, and `portionLabel` are optional compatibility/display fields. When supplied, they are retained in the recipe ingredient and survive the create/update and GET roundtrip. `kitchenAmountText` belongs exclusively to the AI analysis contract and is not accepted as a persistent recipe ingredient field.
- Negative and non-finite amounts are rejected with HTTP 400. Existing documents without the optional fields remain readable; no Cosmos migration is required.

## Recipe Nutrition

`RecipeNutrition`:
```ts
interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}
```

`Recipe.nutritionTotal` and `Recipe.nutritionPerPortion` are calculated via `shared/lib/recipeCalculator.ts`.

[Rule] `perPortion` = `total / portions`. When `portions` changes, nutrition must be recalculated.

`PUT /api/recipes/{id}` recalculates `nutritionTotal` and `nutritionPerPortion` server-side from the supplied/stored ingredient and portion combination. Clients do not own persisted recipe nutrition after create/update.

## Confirmed Export View and Source Fingerprint

`Recipe.exportView` is an optional, versioned export snapshot stored on the
existing recipe document. Create and update requests accept only the confirmed
`RecipeExportViewInput` fields. The `sourceFingerprint` is server-owned: the
backend rejects a client-supplied value and calculates a `sha256:` fingerprint
from a deterministic canonical representation of the effective recipe source.
That source includes the name, description, portions, ordered steps, stored
ingredients and their nutrition-relevant values, tags, and the server-calculated
`nutritionPerPortion`.

`exportViewStatus` is response-only and is derived on every create, update, GET,
and list projection; it is never persisted as a separate Cosmos field:

- `missing` means that no export snapshot exists. The current API represents
  this state by omitting both `exportView` and `exportViewStatus`.
- `current` means that the stored export snapshot fingerprint equals the
  fingerprint of the current effective recipe source.
- `stale` means that the recipe source changed after the stored export snapshot
  was confirmed. Omitting `exportView` on an update preserves the old snapshot,
  so a relevant source change makes it stale. Only an explicit confirmation
  request replaces the snapshot and computes a new server fingerprint atomically
  with the update.

Legacy Cosmos recipe documents without `exportView` remain readable. This is a
read-compatible additive change: no migration, new container, or partition-key
change is required. The field remains in the existing `recipes` container,
partitioned by `/userId`.

### Confirmation and ETag Contract

Confirmation is explicit and represented in the request body by `exportView`
together with the request-only `exportViewAction: 'confirm'`. A create that
includes an export view requires the marker and has no prior ETag. An ordinary
update omits both fields; sending only one is invalid, and an ordinary update
cannot re-fingerprint the existing snapshot.

`GET /api/recipes/{id}`, successful `POST /api/recipes`, and successful
`PUT /api/recipes/{id}` return the current opaque ETag in the HTTP response
header. Confirmation of an existing recipe does not require a client ETag; an
exact `If-Match` from the recipe GET response is checked when supplied. The
ETag is not a JSON field or a client fingerprint; `sourceFingerprint` is
server-owned. Every PUT uses atomic compare-and-replace against the revision it
read, independently of the optional client precondition.

An incomplete `exportView` / `exportViewAction` pair returns `400` with
`error: 'invalid_export_view_confirmation'`. A supplied stale ETag or an
internal write race returns `412` with `error: 'recipe_revision_conflict'`;
the client should reload and review rather than retrying the confirmation
automatically. The server does not merge a stale client draft or retry a failed
compare-and-replace.

On create or confirmation update, every `includedIngredientIds` entry must
identify exactly one non-seasoning ingredient in the effective recipe. Unknown,
duplicate, or seasoning IDs return `400` with
`error: 'invalid_export_view_ingredient'`.

### Transient Export-View Preparation

`POST /api/recipes/{id}/export-view/prepare` uses the existing Recipe Analyze
call and the shared `recipe-analyze` quota. It does not change the prompt,
persist recipe data, or make an additional AI call. The legacy `{}` request
accepts only the strict `{ "contractVersion": 2 }` request; `{}`, missing or
invalid JSON, unknown fields, and unsupported versions return
`400 invalid_export_preparation_request`. No client ETag is required. If
`If-Match` is supplied, a stale or non-exact ETag returns
`412 recipe_revision_conflict` before quota enforcement or provider work;
omission does not return `428`.

On success, the response retains `sourceEtag` as compatibility metadata and
contains only the teaser, nullable time and difficulty, and ordered plain
`RecipeExportStep` values. `sourceEtag` is not a client acceptance prerequisite.
Preparation reads the current recipe server-side and does not expose AI
ingredient keys, map them to saved recipe ingredient IDs, or return
ingredient-resolution states. Existing saved ingredients remain unchanged and
their IDs are not part of this transient suggestion. Preparation validates the
export text limits, nullable metadata, contiguous export-step order, and complete
ordered source-step coverage. Unused AI ingredient fields and ingredient-key
references do not block this text-only response; full Recipe Analyze validation
continues to enforce them for recipe import. The validated AI result is
tracked exactly once; quota, provider, and validation failures do not track
usage. Preparation does not update the recipe or its confirmed `exportView`;
saving still requires the separate explicit confirmation flow.

### Sharing a Confirmed Export View or Request Draft

`POST /api/recipes/{id}/share-bundle` accepts an optional top-level
`exportViewDraft`. When supplied, this unconfirmed request-only value is used
for that render. Otherwise the endpoint uses the stored confirmed `exportView`,
whether its derived status is `current` or `stale`. If neither exists, it
returns `422 MISSING_EXPORT_VIEW`. This precedence preserves legacy requests
that omit `exportViewDraft`.

The shared request-only type `RecipeShareBundleExportDraft` is supplied
through the top-level `exportViewDraft` property. Its shape is
`{ version, teaser, totalTimeMinutes, difficulty, steps, includedIngredientIds }`.
`version` is `1`; `teaser` is a
trimmed 1-96 character string; `totalTimeMinutes` is `null` or a positive
integer up to 10,080; `difficulty` is `null` or a non-empty trimmed single-line
string. There must be 1-5 export steps with ascending positive integer orders
and trimmed 1-90 character descriptions. `includedIngredientIds` is a unique
array of at most 20 non-empty IDs. Each selected ID must identify exactly one
non-seasoning ingredient in the current authenticated user's recipe. Unknown
fields, including `sourceFingerprint`, are rejected. The request draft has no
confirmation action and is not a persisted `RecipeExportViewInput`.

The request draft never updates a recipe or its fingerprint, even when both a
draft and a stored view are present. Sharing makes no AI call, consumes no
quota, and requires no recipe confirmation or persistence operation.

The handler loads the current recipe and selected image server-side. Canonical
recipe fields, including title, portions, nutrition, tags, and current
ingredient values, come from that recipe. The teaser, time, difficulty, steps,
and included ingredient IDs come from the request draft when present, otherwise
from `exportView`; ingredient values are looked up by those IDs in the current
recipe. There is no mapping by AI key or ingredient name, and export text is
never copied into the normal recipe description or steps. Instagram and detail
PNGs are returned together only after both renders succeed.

The detail PNG keeps the `1080 x 1350` output and supports 1 through 20
displayed ingredients and 1 through 5 preparation steps. Its metadata chips
show portions, total time, and displayed ingredient count. When request-draft
time is `null`, both renderers omit the time chip; Instagram also omits the
difficulty chip when difficulty is `null`. Portions remain visible in both
images, and the detail PNG always shows its displayed ingredient count. The
detail PNG intentionally omits difficulty even when it is known. These are
presentation-only distinctions and do not change confirmed export data or
ordinary recipe fields.

Ingredient amounts retain the complete adapter-formatted label, including
serving labels such as `3 1 portion (10 g)`. There is no fixed 16-character
amount limit, shortening, translation, or parsing/conversion of label strings.
Existing numeric formatting and the grams fallback remain unchanged. Amounts
must still be non-empty and single-line; other field limits, production fonts,
and canvas dimensions are unchanged. Labels longer than 16 characters succeed
only when the existing measured width and height checks pass; genuine overflow
returns `TEMPLATE_FIELD_OVERFLOW` with the ingredient index and affected field.
This is rendering-only and does not change recipe data or nutrition.

Title, teaser, ingredient amount/name, and preparation text wrap at word
boundaries; an overwide word may break only at a valid German hyphenation
point. Candidate breaks are measured with the production font, including any
inserted hyphen, and each text block is checked against its assigned width and
height. If no legal layout fits, detail rendering fails with an error
identifying the affected field or item instead of returning clipped or
overflowing text. The bundle
still returns neither image unless both renders succeed.

### Mobile Share-Review Lifecycle

The Mobile recipe wizard has no export tab, export inputs, or export-confirm
action. Ordinary create and update requests omit `exportViewAction` and
`exportView`; an update therefore preserves any existing snapshot. A new-recipe
analyzer `exportSuggestion` is carried to `RecipeDetailScreen` as an
unconfirmed, serializable local draft. It contains the teaser, nullable time
and difficulty, ordered export steps, and only ingredient IDs uniquely
resolved to user-confirmed, non-seasoning recipe ingredients. It contains no
AI `analysisKey`, candidates, resolution state, or client fingerprint and is
not persisted by recipe creation.

On Share, a request draft being previewed takes precedence for that render. If
there is no such draft, Mobile reuses an existing confirmed `exportView` whether
its status is `current` or `stale`. If neither exists, it reuses an unconfirmed
local draft from new-recipe analysis or V2 preparation while the detail screen
remains mounted; only when neither source is available does it call the V2
preparation endpoint. A draft may be sent as `exportViewDraft` before confirmation
and remains request-only. A stale view does not trigger preparation or
automatic reconfirmation. The Share review is editable. New or changed values
are persisted only through the existing explicit
`exportViewAction: 'confirm'` plus `exportView` request pair. Export text is
not copied into the ordinary recipe description or steps. A defensive
`MISSING_EXPORT_VIEW` response is recovered inside Share rather than sending
the user back to the wizard.

## Recipe Steps

`RecipeStep`:
- `order: number` — step sequence
- `title?: string` — optional step title
- `description: string` — instruction text

There is no top-level recipe notes field and no step-level notes field in the persistent recipe contract. Historical notes are stripped from API responses and cleaned lazily on the next recipe update. No global Cosmos migration is required.

## Recipe Images

Owner-scoped recipe routes return short-lived read-only SAS URLs. Community
DTOs do not expose `blobName` or a SAS token: each image `url` is the
authenticated `GET /api/community-recipes/{recipeId}/images/{imageId}` route,
which streams bounded JPEG/PNG bytes with `Cache-Control: no-store` and
rechecks that the recipe is still published. Switching to private blocks
subsequent community image requests; it cannot revoke copies already
downloaded by another user.

`RecipeImage`:
- `id` — image identity within the recipe
- `blobName` — path in Azure Blob Storage container
- `order` — 1-based display order
- `heroCrop?` — versioned hero presentation metadata (`version`, `frame`, `focusX`, `focusY`, `zoom`)
- `url?` — transient read-only SAS URL, returned by the API but never stored in Cosmos

[Rule] `id`, `blobName`, `order`, and the optional `heroCrop` are stored in Cosmos metadata. Binary image data goes to Blob Storage; SAS URLs are generated per request. Legacy images without `heroCrop` are materialized on repository reads with the deterministic effective default `{ version: 1, frame: 'instagram-recipe-v1', focusX: 0.5, focusY: 0.46, zoom: 1 }`. Uploading without metadata leaves the optional field absent in Cosmos, while read and upload response objects expose the effective default.

`heroCrop` is a closed, versioned contract: `version: 1`, `frame: 'instagram-recipe-v1'`, finite normalized `focusX` and `focusY` values in `0..1`, and finite `zoom >= 1`. The focus coordinates refer to the visually oriented source image. Arbitrary frame dimensions, versions, or frame names are not accepted.

The `instagram-recipe-v1` frame uses a `1080 x 1015` photo/hero area. This intentionally differs from the older `1080 x 880` reference: `1080 x 880` ends before the renderer's tag zone and is not the runtime crop contract. The complete Instagram output remains exactly `1080 x 1350`; `1080 x 1015` is only the photo/hero frame.

Title and detail export images share the same asymmetric ambient background:
green at the lower left, fading into the near-black panel base on the right
around the FitTrack wordmark. Both templates use `ambientBackgroundImage()`;
the detail template's existing gradient is the reference. Logo placement,
footer geometry, photo transition, and output dimensions are unchanged.

The current API supports upload, crop-metadata update, delete, and reorder. Upload appends the image at the next order value. Delete removes the blob and renumbers remaining images. Reorder accepts a complete image-ID permutation and normalizes `order` to `1..n`; it does not move blob data.

Upload accepts optional validated `heroCrop` JSON metadata, and `PUT /api/recipes/{id}/images/{imageId}/hero-crop` updates the metadata for an image owned by the authenticated user. Neither operation modifies the stored image blob.

SAS tokens are generated **per request** by the backend (`backend/src/lib/storage.ts`), read-only, with a **1-hour TTL**. The mobile app never holds permanent storage credentials. If a SAS URL expires between receiving it and displaying it, the client should re-fetch the recipe to get a fresh URL.

## Recipe Wizard

`RecipeWizardScreen` — guided flow for creating a recipe from a text description or by searching for ingredients individually. When opened with `editId`, it loads the existing recipe, maps persisted ingredients and steps into wizard state, and starts at the ingredient confirmation phase.

Uses the AI recipe analyzer (`analyzeRecipeText()`) to extract ingredients from free-text input.

[Rule] The normal recipe wizard accepts `portions` only as whole numbers from `1` through `50`. The preview stepper changes the value in steps of `1` and stops at both boundaries. AI-suggested portions and persisted portions loaded for editing are validated before entering wizard state; invalid external values use the wizard default of `4`. The save path validates the value again, so invalid portions are never sent to recipe create or update.

This wizard validation is the contract prerequisite for recipe scaling. The scale feature does not repair, migrate, or otherwise handle historical recipes whose stored `portions` are outside `1–50`; such values are outside the scale contract.

In the ingredient confirmation phase, the detected recipe ingredient remains the primary row label. If the selected food has a different name, it is shown as an indented, muted secondary label with a subtle relation arrow; identical names are shown only once. Unresolved ingredients remain visible with a status such as `Noch kein Lebensmittel zugeordnet` or `Kein passendes Lebensmittel gefunden`, and the complete row opens the ingredient search hub. No AI estimate starts automatically when the search has no result. The user can change the search query or explicitly start a single-food AI estimate from the hub; a successful estimate closes the hub and is shown as a confirmed ingredient with a KI badge. The open confirmation count and the sticky footer hint can be tapped to explain the green check versus opening a card for food search.

Automatic food matches are suggestions, not user confirmations. The ingredient overview keeps one stable total line with a list icon, such as `17 Zutaten erkannt`; detailed status information stays with the relevant seasoning and `Hauptzutaten` sections instead of being repeated in the overview. Confirmed rows move below open work with a layout transition; the row body still opens the search hub, while the compact outline-check action confirms an unresolved suggestion directly. The progress count and sticky footer hint open the shared FitTrack `InfoOverlay`, which explains the green check versus opening a card for food search. Every main ingredient row can be removed with the same one-sided left swipe as a diary entry; removal is immediately reversible through the undo snackbar. Recipe ingredient rows use a restrained list-card treatment: the recipe ingredient is primary, the assigned food and nutrition are muted, and the amount is a smaller right-side value. Automatically recognized seasonings stay collapsed by default and expand as removable two-line tags with the kitchen amount above the centered name and an upper-right remove action.

The preparation-step review uses the same restrained card hierarchy. Each step has a multiline, content-sized title and instruction editor so longer text remains readable. A left swipe reveals a trash icon and removes the step with undo; a long press anywhere in the step header lifts the step above the list, gives haptic feedback when a new target position is crossed, and shows a compact `Hier einfügen` insertion marker at the live target position so the list does not reserve a full-card gap. Holding the step near the top or bottom edge auto-scrolls the list and continues updating the target position. After release, the step immediately rejoins the normal list flow without leaving a source gap. The vertical arrow handle is a visual affordance, not a precise hit target.

The mobile wizard is composed of separate input, ingredient, step, and preview phase components. `RecipeWizardScreen` remains the state and navigation orchestrator for creating and editing recipes, so phase changes, API calls, Hub callbacks, saving, and undo behaviour stay in one flow. The preview uses the shared `recipePreviewViewModel` and renders ingredients as quiet rows without bullet markers; food ingredients show their resolved amount, while seasonings show their kitchen label such as `1 TL` or `nach Geschmack` and never fall back to `0 g`. The same formatting is used in the recipe detail and edit views.

Recipe tags are generated by the AI analysis for new recipes or loaded from the existing recipe during editing. They are displayed as read-only chips in the preview and are persisted unchanged; the preview does not provide a tag text input.

Recipe ingredient search is handled through the global FoodEntryHub in explicit `recipeIngredient` context. Successful product selection or single-food AI estimation returns the ingredient to `RecipeWizardScreen`; diary mutations remain disabled in this context.

## Recipe Scale Preview

The recipe scale feature is a transient projection of the stored recipe. The backend loads the recipe through the authenticated user's partition and calculates target ingredients with the pure shared function `scaleRecipeIngredients()`. Client-supplied original portions, quantities, ingredients, descriptions, and steps are never used as the calculation basis.

The projection factor is `targetPortions / originalPortions`. Finite `inputAmount` and `amountGrams` values are scaled; `null` and non-finite values remain unchanged. Units, input mode, category, product/library references, source-portion metadata, and stored nutrition metadata are copied unchanged. Nutrition is not recalculated for the target and `nutritionTotal` and `nutritionPerPortion` remain the saved original values.

`amountLabel` is scaled only when it begins with one unambiguous positive decimal number using `.` or `,`. The formatted number keeps the label suffix, for example `1 TL` becomes `2 TL`. Ranges, fractions, negative or non-finite prefixes, and labels such as `nach Geschmack` remain unchanged in full.

`POST /api/ai/recipe-scale/preview` adapts only the description and ordered preparation steps. It returns a flüchtigen preview and does not write the recipe, recipe nutrition, or diary. A successful response must keep the original step count and order. The scale path does not repair or migrate historical recipes whose stored `portions` are outside the wizard contract of `1–50`.

In the mobile recipe detail view, the saved `Portionen` value stays separate from the temporary `Nachkochen für` target. The target starts at the saved portion count, changes in whole-number steps with `−` and `+`, and is bounded by the shared `1–50` constants. The information trigger next to the target opens an `InfoOverlay` explaining that the original recipe remains unchanged.

Mobile projects ingredients immediately from the unchanged recipe with `scaleRecipeIngredients()`, so structured amounts and safe labels such as `1 TL` are visible before the text preview returns; labels such as `nach Geschmack` remain unchanged. During debounce and loading, the old description and steps are hidden while the exact German AI warning is shown. A valid response replaces description and steps atomically. On reset, reload, unmount, or AI failure, pending work is invalidated; failures keep the projected ingredients visible and restore the original texts. The stored nutrition values and the independent `LogRecipeModal` continue to use the original recipe.

## Adding a Recipe to Diary

A recipe can be added as a diary entry. The logging dialog starts at one portion, offers quick values `0.5`, `1`, `1.5`, and `2`, and accepts another positive decimal through `Andere`. The nutrition preview scales `nutritionPerPortion` live with the selected value; nutrition values are snapshotted at logging time.

`MealItemSourceType = 'recipe'` marks items that came from a recipe.

The mobile logging dialog uses six selectable `MealType` tags in this order: `breakfast` (Frühstück), `preworkout` (Pre-Workout), `lunch` (Mittagessen), `dinner` (Abendessen), `postworkout` (Post-Workout), and `snack` (Snack).

Opening the dialog reads the current diary day but does not mutate it. On final submit, the client reads the current day again, filters meals to the selected type, and deterministically uses the oldest matching meal with a valid `createdAt`; equal timestamps or invalid/missing timestamps fall back to the lexicographically smallest meal ID. If no matching meal exists, it lazily creates one for the current date and selected type immediately before posting the recipe log. No meal is created while the dialog is being edited or abandoned. Loading and logging failures are shown with the app-owned `InfoOverlay`, not a system alert. After success, the returned meal is passed to the existing Health Connect nutrition sync and the recipe detail is refreshed.

## API

- `GET /api/recipes` — list the authenticated user's recipes
- `POST /api/recipes` — create a private recipe
- `GET /api/recipes/{id}` — get an owner recipe by ID
- `PUT /api/recipes/{id}` — partial owner update; server recalculates nutrition from ingredients/portions
- `PUT /api/recipes/{id}/visibility` — owner-only explicit private/community transition
- `DELETE /api/recipes/{id}` — delete an owner recipe
- `GET /api/community-recipes?limit=&continuationToken=` — paginated list of currently published recipes for authenticated users
- `GET /api/community-recipes/{id}` — safe community detail projection
- `GET /api/community-recipes/{id}/images/{imageId}` — authenticated image bytes; not a SAS URL
- `POST /api/recipes/{id}/images` — upload one JPEG/PNG image and append it to an owner recipe
- `PUT /api/recipes/{id}/images/order` — reorder owner images by complete unique image-ID permutation
- `DELETE /api/recipes/{id}/images/{imageId}` — delete one owner image and compact order
- `POST /api/recipes/{id}/log` — server-resolved owner/community recipe log with a historical nutrition snapshot
- `POST /api/recipes/{id}/share-bundle` — render an atomic Instagram/detail PNG pair from a confirmed export view, including stale snapshots

## Related Documents

- [domain/03-food-catalog.md](03-food-catalog.md) — ingredient sources
- [tech/06-ai-integrations.md](../tech/06-ai-integrations.md) — recipe AI analyzer
