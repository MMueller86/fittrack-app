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

## Favorites and Recents

`UserFoodRelation` (`shared/types/userFoodRelation.ts`) — tracks a user's relationship with a food item.

- `userId`, `foodRef` (ID), `foodRefType: 'catalog' | 'personal'`
- `isFavorite: boolean`
- `displayName`, `displayBrand` — short names for chips/quick access
- `imageUrl`
- `lastUsedAt`, `usageCount` — for recents ranking
- `shortName` — AI-generated short display name (via `favoriteShortNameService.ts`)

API:
- `GET /api/favorites` — all favorites
- `GET /api/food-relations/recent` — top 10 items sorted by `lastUsedAt` DESC

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
