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
- `amountGrams` — amount used in the recipe

Nutrition for each ingredient is calculated from `amountGrams / 100 × nutritionPer100g`.

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

## Recipe Create / Edit

`RecipeCreateScreen` — form-based creation with ingredient search and step management.

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
