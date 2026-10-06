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
- `sourceType` — `ReusableItemSourceType`: `'manual' | 'openFoodFacts' | 'ai' | 'label-scan'`; `'recipe'` is not a `ReusableItem` source type

Recipes are represented separately: `UserFoodRelation.foodRefType` may be
`'recipe'`, and diary `MealItemSourceType` may be `'recipe'`. Neither adds
`'recipe'` to `ReusableItemSourceType`.

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
- `recipeAccess?` — response-only current access for recipe references: `'owner' | 'community' | 'unavailable'`
- `isFavorite: boolean` — marks an item as a Quick Entry
- `displayName`, `displayBrand`, `imageUrl` — denormalized for instant display without API lookups

Nutrition denormalization (stored at time of favoriting, enables instant QuantityView):
- `nutritionPer100g?: NutritionValues` — macros per 100g
- `portion?: PortionInfo` — portion label + weightGrams

Recipe relations are references, not cached food products. Favorites,
grouped favorites, recent, and frequent-item reads project the current
`recipeAccess: 'owner' | 'community' | 'unavailable'` and strip stale recipe
nutrition/image caches. Mobile loads the current owner or community recipe
before showing a portion preview and logs it through
`POST /api/recipes/{id}/log`; an unavailable reference cannot be opened or
logged again, but the user's favorite relation can still be removed. Adding a
recipe favorite validates current access and stores only that user's
reference; client-supplied recipe metadata does not grant access or create a
recipe/food copy.

Usage tracking:
- `lastUsedAt`, `usageCount` — recency and frequency
- `lastInputMode?: 'grams' | 'portion'` — last used input mode
- `lastInputAmount?: number` — last used amount
- `preferredInputMode?: 'grams' | 'portion'` — EMA-derived preferred mode
- `preferredInputAmount?: number` — EMA-derived preferred amount (α = 0.3)
- `mealTypeCounts?: Partial<Record<MealType, number>>` — per-meal usage counts
- `usageDates?: Array<{ date: string; mealType: MealType }>` — date-only diary dates with meal context, trimmed to the 90-day window relative to the recorded diary date
- `favoritedAt?: string` — ISO timestamp when `isFavorite` was first set to `true`

The internal `recordUsage` contract requires the explicit diary meal date for
`usageDates`; a missing date fails closed instead of falling back to the server
UTC date. Existing usage dates are not rewritten or migrated.

Bulk diary Copy records one relation use per copied referenced item only after
the Diary commit. It classifies catalog references from the `openFoodFacts:`
`sourceId` prefix and other personal references from `sourceId`, independently
of the legacy `MealItem.sourceType` value. Delete and Move leave usage history
and source counters unchanged; see [domain/02-diary.md](02-diary.md#bulk-item-mutations).

`@deprecated` fields (kept for backward compat with existing documents):
- `shortName?: string` — no longer generated or used; `displayName` is used everywhere

### Quick Entry Relevance

Favorites (Quick Entries) are sorted for display using `computeRelevanceOrder()` in `mobile/src/modules/nutrition/hub/quickEntryRelevance.ts` or the backend-ranked favorites endpoint. Backend ranking uses the local request reference date for the date-only `usageDates` window; `favoritedAt` and `lastUsedAt` remain elapsed-time UTC instants. Scoring factors: novelty bonus (favoritedAt within 7 days), contextual usage, global usage (usageCount), and recency (lastUsedAt).

### API

- `GET /api/favorites` — all favorites, sorted by displayName; recipe references include current `recipeAccess` and no stale recipe caches
- `GET /api/favorites?context=MealType&localDate=YYYY-MM-DD` — favorites ranked for a meal context; `localDate` is a required real local reference date
- `GET /api/favorites/grouped` — favorites pre-grouped into `{ ungrouped, groups, all }` (used by legacy IdleState; flat `all` used by current hub)
- `POST /api/favorites` — upsert a favorite; food references store nutrition/portion caches, while a recipe reference must currently resolve as owner or community and stores no recipe caches
- `DELETE /api/favorites/{foodRef}` — removes the user's favorite even when a recipe reference is unavailable
- `GET /api/food-relations/recent` — top N items sorted by `lastUsedAt` DESC
- `GET /api/food-relations/frequent` — top N items by usage; recipe references include current access projection

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
