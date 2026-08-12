# Food Catalog

## Two Food Sources

FitTrack food search is a fan-out across two independent sources:

1. **User's Reusable Item Library** — personal items created or saved by this user
2. **Internal Food Product Catalog** — imported from Open Food Facts

Library results are returned first and given higher trust. Catalog results with a name matching an existing library item are deduplicated (case-insensitive).

## Unified Search Result

`FoodSearchResult` — the common type returned by both sources and all search endpoints.

Key fields:
- `id` — unique identifier (library: UUID, catalog: `openFoodFacts:<barcode>`)
- `source: 'library' | 'openFoodFacts'`
- `name` — display name
- `brand` — optional brand name
- `nutritionPer100g: NutritionValues` — macros per 100g
- `portion: PortionInfo | null` — optional portion suggestion
- `isComplete: boolean` — false if nutrition data is incomplete/suspicious
- `imageUrl` — optional product image URL

## Reusable Items (Personal Library)

`ReusableItem` (`shared/types/diary.ts`) — a food item owned by a specific user.

Additional fields beyond `FoodSearchResult`:
- `userId` — owner
- `searchTerms: string[]` — AI-generated alternative queries for meal parser matching
- `aiKeywords: string[]` — auto-match keywords for the meal parser
- `sourceType` — `'manual' | 'label-scan' | 'ai' | 'recipe' | 'openFoodFacts'`

Users save items to their library via:
- Manual creation
- After AI food estimation ("Als Produkt speichern")
- After label scan ("Als Produkt speichern + hinzufügen")

## Food Product Catalog (Open Food Facts)

`FoodProduct` (`shared/types/foodProduct.ts`) — catalog entry imported from Open Food Facts.

- `id` = `openFoodFacts:<barcode>` (also partition key in Cosmos)
- `source` = `'openFoodFacts'`
- `normalizedName` — lowercase, for text matching
- `tokens` — tokenized name words
- `searchKeywords` — union of `autoKeywords` + `manualKeywords` (curated)
- `negativeKeywords` — terms that should suppress this item in searches
- `sourceQualityScore` — 0–100 based on data completeness (more fields = higher score)
- `productType: 'food' | 'beverage' | 'supplement' | 'unknown'`
- `qualityFlags` — optional array (e.g., `'suspiciousNutrition'`)

## Catalog Import

Offline CLI tool: `tools/off-import/import-to-cosmos.ts`

- Reads Open Food Facts data dump
- Upserts documents into the `foodProducts` Cosmos container
- **Idempotent:** preserves `manualKeywords` and `negativeKeywords` on re-import
- Not part of the live application — run manually by administrators

## Search Ranking

`backend/src/lib/searchRanking.ts` — applied to catalog results.

Ranking tiers (highest first):
1. Exact `normalizedName` match (rank 4)
2. `normalizedName` starts with query (rank 3)
3. `normalizedName` contains query (rank 2)
4. Exact match in `searchKeywords` (rank 1)
5. `searchKeywords` entry contains query (rank 0)

Within the same rank, `sourceQualityScore` is the tiebreaker. Higher score = better rank.

Minimum query length: 2 characters for catalog-only endpoints.

## Meal Parser Auto-Assignment

The meal parser may automatically assign a candidate only when its normalized name is an exact or full-name prefix match, or when every query token is represented by the product name, brand, or a stored library search term. A candidate that matches only one token of a multi-word query stays in `needsSelection` so the user can review it.

## Favorites and Quick Entry

`UserFoodRelation` (`shared/types/userFoodRelation.ts`) — tracks a user's relationship with a food item, including favorites and usage patterns.

Core fields:
- `userId`, `foodRef` (item ID), `foodRefType: 'catalog' | 'personal' | 'recipe'`
- `isFavorite: boolean` — marks an item as a Quick Entry
- `displayName`, `displayBrand`, `imageUrl` — denormalized for instant display without API lookups

Nutrition denormalization (stored at time of favoriting, enables instant QuantityView):
- `nutritionPer100g?: NutritionValues` — macros per 100g
- `portion?: PortionInfo` — portion label + weightGrams

Usage tracking:
- `lastUsedAt`, `usageCount` — recency and frequency
- `lastInputMode?: 'grams' | 'portion'` — last used input mode
- `lastInputAmount?: number` — last used amount
- `preferredInputMode?: 'grams' | 'portion'` — EMA-derived preferred mode
- `preferredInputAmount?: number` — EMA-derived preferred amount (α = 0.3)
- `mealTypeCounts?: Partial<Record<MealType, number>>` — per-meal usage counts
- `usageDates?: string[]` — ISO date strings of recent uses, trimmed to 90 days (used for 30-day count)
- `favoritedAt?: string` — ISO timestamp when `isFavorite` was first set to `true`

`@deprecated` fields (kept for backward compat with existing documents):
- `shortName?: string` — no longer generated or used; `displayName` is used everywhere

### Quick Entry Relevance

Favorites (Quick Entries) are sorted for display using `computeRelevanceOrder()` in `mobile/src/modules/nutrition/hub/quickEntryRelevance.ts`. Scoring factors: novelty bonus (favoritedAt within 7 days), contextual usage (mealTypeCounts), global usage (usageCount), recency (lastUsedAt).

### API

- `GET /api/favorites` — all favorites, sorted by displayName
- `GET /api/favorites/grouped` — favorites pre-grouped into `{ ungrouped, groups, all }` (used by legacy IdleState; flat `all` used by current hub)
- `POST /api/favorites` — upsert a favorite; stores `nutritionPer100g`, `portion`, `favoritedAt`
- `DELETE /api/favorites/{foodRef}` — removes favorite (sets `isFavorite: false`)
- `GET /api/food-relations/recent` — top N items sorted by `lastUsedAt` DESC

## Badge Semantics

Search results display a source badge:
- `[OFF]` — Open Food Facts (catalog)
- `[✨ KI]` — AI-estimated item
- `[Eigen]` — User's personal library item

`⚠` alert icon shown when `isComplete: false`.

## Related Documents

- [tech/09-api-reference.md](../tech/09-api-reference.md) — food search endpoints
- [domain/02-diary.md](02-diary.md) — how food items become diary entries
- [product/04-food-entry-hub.md](../product/04-food-entry-hub.md) — food search UX
