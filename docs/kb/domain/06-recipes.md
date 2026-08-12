# Recipes

## Recipe Model

`Recipe` (`shared/types/recipes.ts`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `userId` | `string` | Owner |
| `name` | `string` | Recipe name |
| `description` | `string?` | Optional |
| `servings` | `number` | Number of portions |
| `ingredients` | `RecipeIngredient[]` | |
| `steps` | `RecipeStep[]` | Ordered instructions |
| `images` | `RecipeImage[]` | Blob references |
| `nutrition` | `RecipeNutrition` | Totals + per-portion |
| `usageCount` | `number` | How many times added to diary |
| `createdAt`, `updatedAt` | `string` | ISO timestamps |

## Ingredients

`RecipeIngredient`:
- `foodRef` — reference to a `FoodProduct` (catalog) or `ReusableItem` (library) by ID
- `foodRefType: 'catalog' | 'personal'`
- `name` — display name (snapshot at time of adding)
- `inputMode: 'grams' | 'portion'` — how the user entered the amount
- `inputAmount` — amount as entered by the user (in grams or portions, depending on `inputMode`); `null` when indeterminate
- `amountGrams` — resolved gram weight used for nutrition calculation; `null` when indeterminate
- `amountLabel?` — persistent optional display label for a seasoning (for example `1 TL` or `nach Geschmack`)
- `category?: 'food' | 'seasoning'` — optional classification; omitted on historical food documents and treated as `food`
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
  total: { calories, protein, carbs, fat, fiber };
  perPortion: { calories, protein, carbs, fat, fiber };
}
```

Calculated via `shared/lib/recipeCalculator.ts`.

[Rule] `perPortion` = `total / servings`. When `servings` changes, nutrition must be recalculated.

## Recipe Steps

`RecipeStep`:
- `order: number` — step sequence
- `instruction: string` — description

## Recipe Images

`RecipeImage`:
- `blobPath` — path in Azure Blob Storage container
- `sasUrl` — time-limited SAS URL for display
- `uploadedAt` — ISO timestamp

[Rule] Only SAS URLs are stored in Cosmos metadata. Binary image data goes to Blob Storage.

SAS tokens are generated **per request** by the backend (`backend/src/lib/storage.ts`), read-only, with a **1-hour TTL**. The mobile app never holds permanent storage credentials. If a SAS URL expires between receiving it and displaying it, the client should re-fetch the recipe to get a fresh URL.

## Recipe Wizard

`RecipeWizardScreen` — guided flow for creating a recipe from a text description or by searching for ingredients individually.

Uses the AI recipe analyzer (`analyzeRecipeText()`) to extract ingredients from free-text input.

In the ingredient confirmation phase, the detected recipe ingredient remains the primary row label. If the selected food has a different name, it is shown as an indented, muted secondary label with a subtle relation arrow; identical names are shown only once. Unresolved ingredients remain visible with a status such as `Noch kein Lebensmittel zugeordnet` or `Kein passendes Lebensmittel gefunden`, and the complete row opens the ingredient search hub. No AI estimate starts automatically when the search has no result. The user can change the search query or explicitly start a single-food AI estimate from the hub; a successful estimate closes the hub and is shown as a confirmed ingredient with a KI badge. The open confirmation count and the sticky footer hint can be tapped to explain the green check versus opening a card for food search.

Automatic food matches are suggestions, not user confirmations. The ingredient overview keeps one stable total line with a list icon, such as `17 Zutaten erkannt`; detailed status information stays with the relevant seasoning and `Hauptzutaten` sections instead of being repeated in the overview. Confirmed rows move below open work with a layout transition; the row body still opens the search hub, while the compact outline-check action confirms an unresolved suggestion directly. The progress count and sticky footer hint open the shared FitTrack `InfoOverlay`, which explains the green check versus opening a card for food search. Every main ingredient row can be removed with the same one-sided left swipe as a diary entry; removal is immediately reversible through the undo snackbar. Recipe ingredient rows use a restrained list-card treatment: the recipe ingredient is primary, the assigned food and nutrition are muted, and the amount is a smaller right-side value. Automatically recognized seasonings stay collapsed by default and expand as removable two-line tags with the kitchen amount above the centered name and an upper-right remove action.

The preparation-step review uses the same restrained card hierarchy. Each step has a multiline, content-sized title and instruction editor so longer text remains readable. A left swipe reveals a trash icon and removes the step with undo; a long press anywhere in the step header lifts the step above the list, gives haptic feedback when a new target position is crossed, and shows a compact `Hier einfügen` insertion marker at the live target position so the list does not reserve a full-card gap. Holding the step near the top or bottom edge auto-scrolls the list and continues updating the target position. After release, the step immediately rejoins the normal list flow without leaving a source gap. The vertical arrow handle is a visual affordance, not a precise hit target.

The mobile wizard is composed of separate input, ingredient, step, and preview phase components. `RecipeWizardScreen` remains the state and navigation orchestrator, so phase changes, API calls, Hub callbacks, saving, and undo behaviour stay in one flow. The preview uses the shared `recipePreviewViewModel` and renders ingredients as quiet rows without bullet markers; food ingredients show their resolved amount, while seasonings show their kitchen label such as `1 TL` or `nach Geschmack` and never fall back to `0 g`. The same formatting is used in the recipe detail and edit views.

## Recipe Create / Edit

`RecipeCreateScreen` — form-based creation with ingredient search and step management.

Food ingredients keep the gram/portion quantity editor in the edit view. Seasonings are shown with a `Gewürz` label and their kitchen amount, when available, without a nutrition amount editor because they do not contribute nutrition.

## Ingredient Picker (AddIngredientModal)

`AddIngredientModal` is a `BottomSheetModal` (not a React Native `Modal`). It provides a search-first ingredient picking flow for `RecipeCreateScreen` and `RecipeWizardScreen`.

Internal state machine (`SheetMode`): `'search' | 'amount' | 'ai' | 'label' | 'manual'`.

- **search** — default view; uses `SearchState` (from the Food Entry Hub) for product search, including the bottom fallback section (KI · Scan · Manuell)
- **amount** — `RecipeIngredientAmountView`; gram / portion toggle, live nutrition preview
- **ai** — free-text AI estimate sub-flow
- **label** — nutrition label scan sub-flow
- **manual** — manual entry form

Snap points: `['85%', '90%']`.

## Adding a Recipe to Diary

A recipe can be added as a diary entry. The `servings` count determines how many portions are logged. Nutrition values are snapshotted at logging time.

`MealItemSourceType = 'recipe'` marks items that came from a recipe.

## API

- `GET /api/recipes` — list all user recipes
- `POST /api/recipes` — create recipe
- `GET /api/recipes/{id}` — get by ID
- `PUT /api/recipes/{id}` — update
- `DELETE /api/recipes/{id}` — delete

## Related Documents

- [domain/03-food-catalog.md](03-food-catalog.md) — ingredient sources
- [tech/06-ai-integrations.md](../tech/06-ai-integrations.md) — recipe AI analyzer
