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
| `images` | `RecipeImage[]` | Blob references |
| `nutritionTotal` | `RecipeNutrition` | Aggregate nutrition for the full recipe |
| `nutritionPerPortion` | `RecipeNutrition` | Nutrition for one portion |
| `visibility` | `'private'` | Current recipes are private |
| `sharedWithUserIds` | `string[]` | Reserved for future sharing; currently empty |
| `tags` | `string[]` | Recipe tags |
| `usageCount` | `number` | How many times added to diary |
| `lastUsedAt` | `string?` | ISO timestamp of last diary log |
| `createdAt`, `updatedAt` | `string` | ISO timestamps |

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
- `category?: 'food' | 'seasoning'` — optional classification; omitted on historical food documents and treated as `food`
- `portionWeightGrams?`, `portionLabel?` — optional source-portion display data
- `nutritionPer100g` — nutrient basis used for recalculation on edit
- `nutritionContribution` — pre-calculated nutrition contribution of this ingredient (`calories, protein, carbs, fat, fiber`)

Nutrition for each ingredient is calculated from `amountGrams / 100 × nutritionPer100g`. A seasoning or any ingredient with `amountGrams: null` contributes zero.

`kitchenAmountText` belongs exclusively to the AI analysis contract; the persistent `RecipeIngredient` field is `amountLabel`.

[Rule] For recipe analysis, every `food` ingredient must have a positive finite `amountGrams` value. Kitchen units such as tablespoons, teaspoons, millilitres, and pieces are converted before catalog resolution; an indeterminate `seasoning` may retain `amountGrams: null`.

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

## Recipe Steps

`RecipeStep`:
- `order: number` — step sequence
- `title?: string` — optional step title
- `description: string` — instruction text

There is no top-level recipe notes field and no step-level notes field in the persistent recipe contract. Historical notes are stripped from API responses and cleaned lazily on the next recipe update. No global Cosmos migration is required.

## Recipe Images

`RecipeImage`:
- `id` — image identity within the recipe
- `blobName` — path in Azure Blob Storage container
- `order` — 1-based display order
- `url?` — transient read-only SAS URL, returned by the API but never stored in Cosmos

[Rule] Only `blobName` and `order` are stored in Cosmos metadata. Binary image data goes to Blob Storage; SAS URLs are generated per request.

The current API supports upload, delete, and reorder. Upload appends the image at the next order value. Delete removes the blob and renumbers remaining images. Reorder accepts a complete image-ID permutation and normalizes `order` to `1..n`; it does not move blob data.

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

- `GET /api/recipes` — list all user recipes
- `POST /api/recipes` — create recipe
- `GET /api/recipes/{id}` — get by ID
- `PUT /api/recipes/{id}` — partial update; server recalculates nutrition from ingredients/portions
- `DELETE /api/recipes/{id}` — delete
- `POST /api/recipes/{id}/images` — upload one JPEG/PNG image and append it
- `PUT /api/recipes/{id}/images/order` — reorder existing images by complete unique image-ID permutation
- `DELETE /api/recipes/{id}/images/{imageId}` — delete one image and compact order
- `POST /api/recipes/{id}/log` — log one or more recipe portions into a diary meal

## Related Documents

- [domain/03-food-catalog.md](03-food-catalog.md) — ingredient sources
- [tech/06-ai-integrations.md](../tech/06-ai-integrations.md) — recipe AI analyzer
