# PLAN — US-01: Intelligente Zutatenklassifizierung

**User Story:** [US-01_Intelligente_Zutatenklassifizierung.md](US-01_Intelligente_Zutatenklassifizierung.md)  
**Status:** Ready for implementation (one open PO decision — does not block WP-1, WP-2, WP-3a; blocks only WP-3b)

---

## Open Product Owner Decisions

### [PO-1] Behaviour when the user uses "Ersetzen" on a seasoning and selects a product

When a user explicitly taps "Ersetzen" on a `seasoning` ingredient in the Recipe Wizard and selects a product from the food catalog, should the item:

- **(A) Be reclassified as `food`** — the selected product's nutrition values are added to the recipe total.
- **(B) Remain `seasoning`** — the product reference is stored (for display), but nutrition contribution stays at zero.

**Recommendation: Option A (reclassify to `food`).** If the user goes to the effort of searching for and selecting a specific product, their intent is almost certainly nutritional inclusion. Option B would be surprising: the user selects a product but the recipe nutrition is unchanged.

→ Work package WP-3b is **Blocked — pending [PO-1]**.

---

## 1. Requirement Assessment

**Classification: Accept as proposed.**

All seven acceptance criteria are feasible without domain rule gaps. The feature extends the existing Recipe Analyzer AI (endpoint `POST /api/ai/recipe-analyze`) rather than introducing a new one.

**AI Necessity Assessment:**

| Question | Answer |
|---|---|
| Is AI necessary? | **Yes.** `food`/`seasoning` classification is inherently contextual. "Parmesan" is seasoning on pasta but a `food` ingredient (e.g. 200g) in a Parmesan schnitzel. A hardcoded keyword list would fail on novel or context-dependent ingredients. |
| Advisory or authoritative? | **Advisory.** The classification is shown in the wizard. The user can always override any seasoning with "Ersetzen" to trigger a product search. |
| Failure contract | AI unavailable → 502 (existing guard). Malformed `category` value → treat as `'food'` (safe default). `parseMeal()` fails for food items → empty food resolution, wizard proceeds, user can add manually. |
| AiFeature key | `'recipe-analyze'` — no new quota feature needed. |
| New prompt? | **Yes.** `RECIPE_ANALYZE_SYSTEM_PROMPT` in `recipeAnalyze.ts` is modified. Version increments `v1 → v2`. |
| Structured Output schema change? | **Yes.** `ingredientLines: string[]` is replaced by `ingredients: AiRecipeIngredientLine[]`. |

---

## 2. Feature Summary

The Recipe Analyzer AI (`analyzeRecipeText()`) is extended to classify each extracted ingredient as either `food` (nutritionally relevant, processed via catalog search) or `seasoning` (negligible nutrition contribution, displayed but skipped during product search). Seasoning items appear in the ingredient list with a visual badge and a "Ersetzen" action that allows the user to manually promote them to a food ingredient.

---

## 3. Current Behaviour

- `analyzeRecipeText()` returns `ingredientLines: string[]` — flat text, no classification.
- `recipeAnalyzeHandler` joins all ingredient lines, calls `parseMeal()`, calls `resolveIngredients()` for every ingredient without exception.
- All ingredients trigger catalog search and auto-batch AI food estimation for unmatched items.
- There is no concept of `food` vs `seasoning` in any type, prompt, or UI.

---

## 4. Desired Behaviour

- The recipe analyzer AI classifies each ingredient as `food` or `seasoning` at extraction time, using full recipe context.
- `food` items follow the existing catalog search path: `parseMeal()` → `bundleAiItems()` → `resolveIngredients()` → auto AI estimation fallback (AC-2, AC-6, AC-7).
- `seasoning` items skip the catalog search and auto-estimation paths entirely. They are included in the response with `status: 'seasoning'` (AC-1, AC-3).
- Ingredient amounts extracted from the recipe text are preserved unchanged (AC-4). Where amounts are absent, the AI estimates plausible kitchen quantities (AC-5). All amounts are resolved to grams or ml (AC-6).
- The wizard displays seasonings in the ingredient list with a visual "Gewürz" badge. Only a "Ersetzen" action is shown (no "KI schätzen"). Via "Ersetzen" the user can still trigger a product search at any time (AC-3).
- Seasonings have zero nutrition contribution. The recipe nutrition total is unaffected by seasoning entries.
- When a user explicitly selects a product for a seasoning via "Ersetzen", the item is reclassified as `food` and contributes its nutrition [pending PO-1].

---

## 5. Scope

- Extending `analyzeRecipeText()` prompt, JSON Schema, and `AiRecipeRaw` type.
- Extending `recipeAnalyzeHandler` to route food vs seasoning items.
- Adding `status: 'seasoning'` to `ItemStatus` (backend + mobile mirror type).
- Adding optional `category?: 'food' | 'seasoning'` to `MealParserPreviewItem` (backend + mobile mirror type).
- Adding optional `category?: 'food' | 'seasoning'` to `RecipeIngredient` (shared type).
- Updating `RecipeWizardScreen` to handle `seasoning` wizard status.

---

## 6. Out of Scope

- Recipe editing (`RecipeCreateScreen`) — classification only applies during wizard-based creation via `analyzeRecipeText()`.
- Saving a `ReusableItem` from a seasoning ingredient.
- Reclassifying existing saved recipe ingredients retroactively.
- Changes to `recipeCalculator.ts` (seasoning ingredients carry zero `nutritionContribution`; the calculator is unaffected).
- Changes to the meal parser endpoint (`POST /api/ai/meal-parser/preview`) — meal parser items are always `food`.

---

## 7. Confirmed Facts

| Fact | Source |
|---|---|
| Recipe analyzer uses `analyzeRecipeText()` (openai.ts) → `parseMeal()` → `bundleAiItems()` → `resolveIngredients()` | `backend/src/functions/ai.ts` lines 472–502 |
| `ingredientLines: string[]` is the current AI output for ingredients | `backend/src/lib/openai.ts` interface `AiRecipeRaw` |
| `ItemStatus = 'matched' \| 'needsSelection' \| 'unmatched'` | `backend/src/functions/ai.ts`, `mobile/src/shared/api/aiApi.ts` |
| `MealParserPreviewItem` is mirrored in `mobile/src/shared/api/aiApi.ts` | `aiApi.ts` line 14 |
| `RecipeIngredient` is in `shared/types/recipes.ts` and has no `category` field today | `shared/types/recipes.ts` |
| Auto-batch AI estimation is triggered in `runAnalysis()` for all `status: 'needs-ai'` items | `RecipeWizardScreen.tsx` lines 267–295 |
| `recipe-analyze` quota feature key already exists in `quotaConfig.ts` | `backend/src/lib/quotaConfig.ts` (confirmed by quota enforcement call in handler) |
| `bundleAiItems()` merges duplicate ingredient entries by normalised display name | `backend/src/functions/ai.ts` lines 422–440 |
| Prompt file has no version constant today | `backend/src/lib/prompts/recipeAnalyze.ts` (verified) |

---

## 8. Proposed Technical Solution

### New type: `AiRecipeIngredientLine`

Replaces the flat `ingredientLines: string[]` in `AiRecipeRaw`:

```ts
interface AiRecipeIngredientLine {
  line: string;              // original text, e.g. "1 TL Salz"
  displayName: string;       // clean ingredient name, e.g. "Salz"
  category: 'food' | 'seasoning';
  amountGrams: number | null; // AI-resolved gram/ml equivalent; null when unknown
}
```

The recipe analyzer AI is explicitly prompted to:
- Classify each ingredient as `food` (calorically/nutritionally relevant) or `seasoning` (typically used in small amounts where nutritional contribution is negligible, e.g., salt, pepper, herbs, spices, vinegar, soy sauce).
- Estimate `amountGrams` for all ingredients (AC-5, AC-6): use the text amount when given; estimate plausible amounts when absent.

### Handler routing

```
recipeAnalyzeHandler:
  food items  → parseMeal(food lines) → bundleAiItems → resolveIngredients → category: 'food'
  seasoning items → direct MealParserPreviewItem construction → category: 'seasoning', status: 'seasoning'
  combined → preserve food items first, then seasoning items
```

Food items follow the unchanged existing resolution path. Seasoning items are constructed directly from the recipe analyzer output without any AI or catalog calls.

### `MealParserPreviewItem` extension

Add optional field: `category?: 'food' | 'seasoning'`  
Default (absent) = `'food'`. Meal parser endpoint is unaffected (never sets `category`).

### `ItemStatus` extension

Add `'seasoning'` to `ItemStatus` union: `'matched' | 'needsSelection' | 'unmatched' | 'seasoning'`

### `RecipeIngredient` extension

Add optional field: `category?: 'food' | 'seasoning'`  
Absence on existing documents = treat as `'food'`.

### Seasoning `RecipeIngredient` at save time

Built by new function `buildIngFromSeasoning()` in `RecipeWizardScreen`:
- `displayName` from `MealParserPreviewItem.displayName`
- `amountGrams` from `MealParserPreviewItem.amountGrams` (or `0` if null)
- `inputMode: 'grams'`, `unit: 'g'`
- `nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }`
- `nutritionContribution: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }`
- `linkedProductId: null`, `linkedReusableItemId: null`, `isAiEstimate: false`
- `category: 'seasoning'`

Because `nutritionContribution` is zero, `recipeCalculator.ts` is unaffected.

---

## 9. Persistence Impact

**Additive optional field on `RecipeIngredient` (nested within `Recipe` documents in Cosmos).  
Class 0 — no migration required.**

Existing `Recipe` documents in Dev and Alpha do not contain `category` on their ingredient entries. The application reads `category` as `undefined`, treating it as `'food'`. No observable difference in behaviour for existing recipes. No infrastructure changes needed.

---

## 10. Infrastructure Impact

**None.** No new Azure resources, no new Cosmos containers, no Bicep changes.

---

## 11. Mobile Build Impact

**None.** JS-only changes. No new native modules, no config plugin changes, no `app.config.js` modifications.

---

## 12. Shared Package Changes

**Agent: Backend** (performed alongside WP-2, before WP-3)

### Change: `shared/types/recipes.ts`

Add to `RecipeIngredient`:
```ts
/** Classification set by AI during recipe wizard. Absent on pre-classification documents → treat as 'food'. */
category?: 'food' | 'seasoning';
```

This is the only change to the shared package.

**Expected Handoff:**
- `shared/types/recipes.ts` updated with `category` field
- No other shared changes

---

## 13. Backend Work Package

**Agent: Backend**

### Subtask B-1: Extend Recipe Analyzer AI (prompt + schema + openai.ts)

**Goal:** Change `analyzeRecipeText()` to return structured ingredient objects with `category` and `amountGrams` instead of flat strings.

Required Knowledge Base:
- docs/kb/tech/06-ai-integrations.md
- docs/kb/domain/07-ai-features.md

Required Repository Context:
- backend/src/lib/prompts/recipeAnalyze.ts
- backend/src/lib/openai.ts (AiRecipeRaw interface, RECIPE_ANALYZE_SCHEMA, analyzeRecipeText function)

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-1, AC-2, AC-4, AC-5, AC-6

**Changes:**

**`backend/src/lib/prompts/recipeAnalyze.ts`:**
- Add `export const RECIPE_ANALYZE_PROMPT_VERSION = 'v2'`
- Update `RECIPE_ANALYZE_SYSTEM_PROMPT` (prompt changes that affect output interpretation → version increment is mandatory):
  - Replace the `ingredientLines` section with an `ingredients` array of objects
  - Add classification rules:
    - `food`: calorically or nutritionally relevant quantities (e.g., Hähnchenbrust, Pasta, Tomaten, Käse, Butter, Ei, Mehl, Zucker, Sahne). Includes any ingredient used in meaningful nutritional amounts.
    - `seasoning`: ingredients typically used in small amounts where nutritional contribution is negligible (e.g., Salz, Pfeffer, Kräuter, Gewürze, Essig, Sojasauce, Worcestersauce, Knoblauchpulver, Paprikapulver). Includes condiments and flavourings where the volume used does not meaningfully affect the recipe's nutritional profile.
  - Add `amountGrams` instruction: resolve all amounts to a gram/ml equivalent. For amounts given as "1 TL" → ~5g, "1 EL" → ~15g, "1 Prise" → ~1g. For counts (e.g. "2 Eier"), estimate total grams. Return `null` only when no amount is determinable from context.
  - Add `displayName` instruction: clean ingredient name without quantity.

**`backend/src/lib/openai.ts`:**
- Replace `ingredientLines: string[]` in `AiRecipeRaw` with `ingredients: AiRecipeIngredientLine[]`
- Define interface (or inline type) `AiRecipeIngredientLine`:
  ```ts
  interface AiRecipeIngredientLine {
    line: string;
    displayName: string;
    category: 'food' | 'seasoning';
    amountGrams: number | null;
  }
  ```
- Update `RECIPE_ANALYZE_SCHEMA`:
  - Replace the `ingredientLines` property with `ingredients` as an array of objects
  - Object schema: `{ line: string, displayName: string, category: enum['food','seasoning'], amountGrams: number | null }`
  - `additionalProperties: false` on the ingredient object
  - Rename `required` entry from `ingredientLines` to `ingredients`

**Expected Handoff:**
- `analyzeRecipeText()` returns updated `AiRecipeRaw` with `ingredients: AiRecipeIngredientLine[]`
- Prompt version constant exported
- TypeScript compiles without errors (existing usages of `recipeRaw.ingredientLines` in ai.ts will break — fixed in B-2)

---

### Subtask B-2: Update Recipe Analyzer Handler

**Goal:** Route `food` items through existing `parseMeal()` resolution path; construct `MealParserPreviewItem[]` for `seasoning` items directly without catalog search.

Required Repository Context:
- backend/src/functions/ai.ts (recipeAnalyzeHandler, MealParserPreviewItem, ItemStatus, AiRecipeAnalysisResponse, bundleAiItems, resolveIngredients, resolveAmountGrams)
- backend/src/lib/openai.ts (AiRecipeIngredientLine — from B-1 handoff)

Required Skills:
- azure-openai-feature-integration

Relevant Acceptance Criteria:
- AC-1, AC-2, AC-3, AC-6, AC-7

Dependencies:
- Subtask B-1 (updated `AiRecipeRaw.ingredients`)
- Shared package change (`RecipeIngredient.category`)

**Changes:**

**`backend/src/functions/ai.ts`:**

1. **`ItemStatus`**: add `'seasoning'` to the union:
   ```ts
   export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched' | 'seasoning';
   ```

2. **`MealParserPreviewItem`**: add optional field:
   ```ts
   category?: 'food' | 'seasoning';
   ```

3. **`recipeAnalyzeHandler`**: replace the ingredient resolution block:
   - Separate `recipeRaw.ingredients` into `foodItems` (category === 'food') and `seasoningItems` (category === 'seasoning')
   - **Food path** (unchanged from current, scoped to food items only):
     ```ts
     const foodLines = foodIngredients.map(i => i.line);
     const joinedFood = foodLines.join(', ');
     aiItems = await parseMeal(joinedFood);
     const bundled = bundleAiItems(aiItems);
     resolvedFood = await resolveIngredients(userId, bundled);
     // tag each item with category: 'food'
     ```
   - **Seasoning path** (new — no AI or catalog calls):
     ```ts
     resolvedSeasonings = seasoningIngredients.map(s => ({
       rawText: s.line,
       displayName: s.displayName,
       status: 'seasoning' as ItemStatus,
       selectedProductId: null,
       selectedProductName: null,
       candidates: [],
       inputMode: 'grams' as const,
       inputAmount: s.amountGrams,
       amountGrams: s.amountGrams,
       needsReview: false,
       warnings: [],
       category: 'seasoning' as const,
     }));
     ```
   - **Combine**: `ingredients = [...resolvedFood, ...resolvedSeasonings]`
   - Malformed `category` guard: unknown values default to `'food'` (safe cast)

4. No changes to `AiRecipeAnalysisResponse` — `ingredients: MealParserPreviewItem[]` already accommodates the new `category` field.

**Unit tests** (new test file or additions to existing ai.ts tests):
- Verify `status: 'seasoning'` items are present in the response when the AI classifies an ingredient as `seasoning`
- Verify `status: 'seasoning'` items have `candidates: []` and `needsReview: false`
- Verify `food` items still go through `resolveIngredients()` (mock catalog search returns expected results)
- Test the malformed-category guard (unknown value → 'food')

Expected Handoff:
- `POST /api/ai/recipe-analyze` returns `AiRecipeAnalysisResponse` where seasonings have `status: 'seasoning'`, `category: 'seasoning'`, `candidates: []`, and food items follow the existing resolution path
- `ItemStatus` and `MealParserPreviewItem` in `ai.ts` updated
- TypeScript compiles without errors
- Unit tests added and passing

---

## 14. Frontend Work Package

**Agent: Frontend**

### Subtask WP-3a: Extend wizard types and seasoning ingredient building

**Goal:** Add `'seasoning'` to `IngStatus`, add `buildIngFromSeasoning()`, and handle `status: 'seasoning'` in `initWizardIngredient()` and `runAnalysis()`.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/shared/api/aiApi.ts
- shared/types/recipes.ts (RecipeIngredient.category — from shared package change)

Relevant Acceptance Criteria:
- AC-1, AC-3, AC-4, AC-5, AC-7

Dependencies:
- Backend work package complete (API contract: `status: 'seasoning'`, `category: 'seasoning'` on MealParserPreviewItem)
- Shared package change (`RecipeIngredient.category`)

**Changes:**

**`mobile/src/shared/api/aiApi.ts`:**
- Add `'seasoning'` to `ItemStatus`:
  ```ts
  export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched' | 'seasoning';
  ```
- Add optional `category?: 'food' | 'seasoning'` to `MealParserPreviewItem`

**`mobile/src/modules/recipes/RecipeWizardScreen.tsx`:**

1. Add `'seasoning'` to `IngStatus`:
   ```ts
   type IngStatus = 'auto-matched' | 'needs-selection' | 'needs-ai' | 'ai-estimating' | 'confirmed' | 'seasoning';
   ```

2. Add `buildIngFromSeasoning()`:
   ```ts
   function buildIngFromSeasoning(id: string, item: MealParserPreviewItem): RecipeIngredient {
     const amountGrams = item.amountGrams ?? 0;
     const zero: RecipeNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
     return {
       id,
       displayName: item.displayName,
       inputMode: 'grams',
       inputAmount: amountGrams,
       amountGrams,
       unit: 'g',
       linkedProductId: null,
       linkedReusableItemId: null,
       isAiEstimate: false,
       category: 'seasoning',
       nutritionPer100g: zero,
       nutritionContribution: zero,
     };
   }
   ```

3. Update `initWizardIngredient()`: add case before the default fallback:
   ```ts
   if (item.status === 'seasoning') {
     return { id, parserItem: item, status: 'seasoning', resolvedIngredient: buildIngFromSeasoning(id, item) };
   }
   ```
   This ensures seasonings are `confirmed` immediately (they don't need user action to be saveable).

4. `runAnalysis()` auto-batch block: the existing filter `wi.status === 'needs-ai'` already excludes `'seasoning'` items — **no change needed** here.

5. Amount editor initialisation in `runAnalysis()`: include `'seasoning'` items (so the amount field is pre-populated):
   ```ts
   if (wi.resolvedIngredient) {
     initialEdits[wi.id] = { mode: wi.resolvedIngredient.inputMode, value: String(wi.resolvedIngredient.inputAmount) };
   }
   ```
   This already covers seasonings since `buildIngFromSeasoning` produces a `resolvedIngredient`.

Expected Handoff:
- `IngStatus` extended
- `buildIngFromSeasoning()` implemented
- `initWizardIngredient()` handles `'seasoning'`
- Seasoning items initialised with zero-nutrition `RecipeIngredient` and `amountEdits` pre-populated
- TypeScript compiles without errors

---

### Subtask WP-3b: Seasoning visual treatment and "Ersetzen" UX

**Status: Blocked — pending [PO-1]**

The visual behaviour when a user selects a product for a seasoning via "Ersetzen" depends on [PO-1]. The rest of this subtask can be implemented regardless, with only the `handleSelectCandidate`/reclassification behaviour left as a stub pending the PO decision.

**Goal:** Display seasonings with a visual badge, show "Ersetzen" action only (no "KI schätzen"), and wire "Ersetzen" to the existing product search flow.

Required Knowledge Base:
- docs/kb/product/03-design-system.md
- docs/kb/product/05-ux-patterns.md

Required Repository Context:
- mobile/src/modules/recipes/RecipeWizardScreen.tsx (full rendering section, ingredient row rendering)
- mobile/src/app/theme.ts (color tokens)

Relevant Acceptance Criteria:
- AC-1, AC-3

Dependencies:
- WP-3a (seasoning status and ingredient building)
- PO-1 decision (for the "Ersetzen" completion behaviour)

**Changes:**

In the ingredient list rendering block of `RecipeWizardScreen`:

1. **Seasoning badge:** For items with `wi.status === 'seasoning'`, render a small label chip (e.g. `"Gewürz"`) using `colors.textMuted` background and the design system chip/badge pattern from `docs/kb/product/03-design-system.md`. Position next to the ingredient display name.

2. **Action buttons for seasonings:** Show only the "Ersetzen" button. Do not show:
   - "KI schätzen" (food estimation)
   - Product candidate list
   - Amount input with portion toggle (seasoning amount is informational only)

3. **"Ersetzen" for seasonings:** Tap sets `replacingIngId = wi.id` and opens `AddIngredientModal` (existing mechanism — `setReplacingIngId` / `setAddIngredientVisible`). No new code path needed.

4. **"Ersetzen" completion for seasonings** [depends on PO-1]:
   - **If PO-1 → Option A (reclassify to food):** In `handleSelectCandidate`, detect that the replaced item had `wi.status === 'seasoning'` and set the resulting ingredient's `category: 'food'` (calling `buildIngFromCandidate` which already produces a food-style `RecipeIngredient`).
   - **If PO-1 → Option B (keep as seasoning):** In `handleSelectCandidate`, produce the ingredient with `category: 'seasoning'` and zero nutrition contribution (keep `nutritionPer100g` and `nutritionContribution` at zeros, but store `linkedProductId`).

5. **Save validation:** `handleNext` / save guard: `status: 'seasoning'` items are always considered resolved (they always have a `resolvedIngredient`). No blocking state.

Expected Handoff:
- Seasoning items rendered with "Gewürz" badge and "Ersetzen"-only action
- "Ersetzen" opens the product search modal
- Product selection on a seasoning behaves per [PO-1] decision
- Seasonings do not block the wizard save flow

---

## 15. QA Work Package

**Agent: QA**

Required Knowledge Base:
- docs/kb/domain/07-ai-features.md
- docs/kb/domain/06-recipes.md
- docs/kb/tech/08-testing.md

Required Repository Context:
- backend/src/functions/ai.ts (recipeAnalyzeHandler, MealParserPreviewItem, ItemStatus)
- backend/src/lib/openai.ts (AiRecipeRaw, RECIPE_ANALYZE_SCHEMA)
- backend/src/lib/prompts/recipeAnalyze.ts
- mobile/src/modules/recipes/RecipeWizardScreen.tsx
- mobile/src/shared/api/aiApi.ts
- shared/types/recipes.ts

Required Skills:
- azure-openai-feature-integration
- cosmos-data-model-and-migration

Dependencies:
- All work packages complete

**Verification Scope:**

Backend:
- `RECIPE_ANALYZE_PROMPT_VERSION = 'v2'` is exported from `recipeAnalyze.ts`
- `AiRecipeRaw.ingredients` schema includes `line`, `displayName`, `category`, `amountGrams` with `additionalProperties: false` on the ingredient object
- `RECIPE_ANALYZE_SCHEMA` uses `strict: true` at the top level
- `enforceQuota` is called **before** `analyzeRecipeText()` — quota ordering is preserved
- `trackUsage` is called **after** a successful AI response only — not before, not in the seasoning path
- `status: 'seasoning'` items in the response have `candidates: []` and `needsReview: false`
- `status: 'seasoning'` items do not trigger `resolveIngredients()` (catalog search)
- `parseMeal()` is called only for `food`-classified ingredient lines
- Malformed `category` (neither `'food'` nor `'seasoning'`) defaults to `'food'` safely
- Unit tests cover: food/seasoning split, seasoning construction, food resolution path, malformed-category guard

Shared:
- `RecipeIngredient.category` is optional (TypeScript `?:`)
- Existing `RecipeIngredient` usages without `category` compile without errors

Frontend (`RecipeWizardScreen`):
- `IngStatus` includes `'seasoning'`
- `initWizardIngredient` with `item.status === 'seasoning'` returns `status: 'seasoning'` and a zero-nutrition `resolvedIngredient`
- Auto-batch AI estimation (`estimateFoodBatch`) is **not** called for `seasoning` items
- Seasoning items do not block the wizard save flow (save button enabled when all `food` items are confirmed)
- "Gewürz" badge renders for `status: 'seasoning'` items
- "KI schätzen" button does **not** render for seasonings
- "Ersetzen" button renders for seasonings and opens `AddIngredientModal`
- `buildIngFromSeasoning()` produces `nutritionContribution` with all zeros
- Saved recipe with seasoning ingredients: recipe nutrition total reflects only `food` ingredients

Integration (manual / contract):
- End-to-end: submit a recipe text containing both foods and seasonings → wizard shows food items for confirmation and seasoning items with "Gewürz" badge
- Seasoning with known amount (e.g. "1 TL Salz") → `amountGrams` is non-null in the response
- Seasoning with no amount (e.g. "etwas Pfeffer") → `amountGrams` may be null; wizard displays `0g`
- Food item with no product match → auto AI estimation batch fires → estimate appears in wizard
- "Ersetzen" on a seasoning → product search opens → product selection follows [PO-1] decision
- Recipe saved with seasoning: `RecipeIngredient.category === 'seasoning'` present in Cosmos document
- Reload recipe: ingredients with `category: 'seasoning'` display correctly; ingredients without `category` (existing recipes) display as food (no regression)

Acceptance Criteria: all AC-1 through AC-7.

---

## 16. Acceptance Criteria

| # | Criterion | Testable outcome |
|---|---|---|
| AC-1 | Each extracted ingredient is classified as `food` or `seasoning` | `MealParserPreviewItem.category` is `'food'` or `'seasoning'` for every ingredient in the API response |
| AC-2 | `food` ingredients are passed to catalog search | Items with `category: 'food'` have a non-empty `candidates` array or `status: 'unmatched'`; items with `category: 'seasoning'` always have `candidates: []` |
| AC-3 | `seasoning` ingredients appear in the wizard with a "Gewürz" badge and "Ersetzen" action; no catalog search is triggered automatically | Seasoning rows visible in wizard with badge; no "KI schätzen" button; "Ersetzen" opens product search modal |
| AC-4 | Amounts from the recipe text are preserved unchanged | A recipe text with "300g Hähnchenbrust" → `amountGrams: 300` for that ingredient in the API response |
| AC-5 | Where amounts are absent, the AI estimates plausible kitchen quantities | An ingredient line with no amount (e.g. "Zwiebel") → `amountGrams` is non-null and represents a reasonable single-serving quantity |
| AC-6 | All amounts are resolved to grams or ml | `amountGrams` on all items (food and seasoning) is a number (or null only when truly indeterminate); no fractional unit (EL, TL) left unresolved in the gram value |
| AC-7 | For `food` items with no catalog match, AI food estimation runs automatically | Items with `status: 'unmatched'` receive auto-batch estimation in the wizard; estimation result appears as `status: 'confirmed'` |

---

## 17. Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| AI misclassifies a borderline ingredient (e.g. 30g Parmesan classified as `seasoning`) | Classification is advisory. The user sees all items and can use "Ersetzen" to search for a product on any seasoning. |
| Recipe analyzer schema change breaks `analyzeRecipeText()` for callers other than `recipeAnalyzeHandler` | The function is only called from `recipeAnalyzeHandler`. Confirm with `grep` before implementation. |
| `parseMeal()` parses food lines differently with fewer inputs (previously joined with all ingredients) | For food classification, the line pool is smaller. The prompt context is unchanged. Risk is low. Test with a recipe that has ≥5 food items. |
| `amountGrams: null` for a seasoning appears as "0g" in the wizard | Display `amountGrams` rounded or omit the unit if zero. UX decision for Frontend — flag if needed. |
| Existing saved recipes have no `category` field | Handled by optional field + `undefined` → treat as `'food'` default. No regression. |
| New `'seasoning'` status in `ItemStatus` breaks exhaustive switch in meal parser review screen | Check `MealParserReviewScreen` for exhaustive switch/case on `ItemStatus`. If present, add a `'seasoning'` case (fallback: treat as `'unmatched'`). |

---

## 18. Recommended Execution Order

1. **Shared package change** — Add `category?` to `RecipeIngredient` (Backend performs as part of WP-2 prep)
2. **B-1** — Extend `analyzeRecipeText()` prompt, schema, `AiRecipeRaw` type
3. **B-2** — Update `recipeAnalyzeHandler` handler routing + unit tests
4. **WP-3a** — Extend wizard types, add `buildIngFromSeasoning`, update `initWizardIngredient`
5. **[PO-1 decision]**
6. **WP-3b** — Seasoning visual treatment + "Ersetzen" UX (unblocked portion first; [PO-1]-dependent handler after decision)
7. **QA** — Full verification against all ACs
