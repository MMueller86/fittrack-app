# Cosmos DB Data Model

Containers:
- users
- nutritionProfiles
- weights
- nutritionDiaryMeals
- reusableMealItems
- recipes
- foodProducts

Partitioning:
- users: /id
- foodProducts: /id  (partition key = document id: `openFoodFacts:<barcode>`)
- all other user-owned domain containers: /userId

### foodProducts container

Holds the internal food product catalog imported from Open Food Facts. Documents conform to the `FoodProduct` type in `shared/types/foodProduct.ts`.

Key fields:
- `id` — `openFoodFacts:<barcode>` (also partition key)
- `source` — always `'openFoodFacts'`
- `normalizedName` — lowercase name used for text search
- `searchKeywords` — union of auto-generated and manually curated keywords
- `productType` — `'food' | 'beverage' | 'supplement' | 'unknown'`
- `qualityFlags` — optional array of flag strings (e.g. `'suspiciousNutrition'`)
- `sourceQualityScore` — 0–100 used for ranking within same relevance tier

Import tool: `tools/off-import/import-to-cosmos.ts`. Idempotent upsert preserves `manualKeywords` and `negativeKeywords` on re-import.

Images:
- store binary images in Blob Storage
- store only metadata/blob paths in Cosmos DB
