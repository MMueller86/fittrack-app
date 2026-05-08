# API Design

Domains:
- Auth/session
- Profile/onboarding
- Nutrition targets
- Weights
- Nutrition diary
- Recipes
- Dashboard

Key rule:
- Analysis/calculation and persistence are separate.
- AI outputs require review before final save.

## Food Search & Catalog Endpoints

### `GET /api/food-search?query=<q>`
Combined search across user's reusable item library and internal food product catalog. Library results come first. Catalog results with a name that exactly matches a library result (case-insensitive) are deduplicated. Catalog is not queried for queries shorter than 2 characters.

Response: `{ results: FoodSearchResult[] }`

### `GET /api/food-products/search?q=<q>`
Search the internal food product catalog only. Requires `q` ≥ 2 characters.

Ranking tiers (highest first):
1. Exact `normalizedName` match (rank 4)
2. `normalizedName` starts with query (rank 3)
3. `normalizedName` contains query (rank 2)
4. Exact match in `searchKeywords` (rank 1)
5. `searchKeywords` entry contains query (rank 0)

Within the same rank, `sourceQualityScore` (0–100) is the tiebreaker.

Response: `{ results: FoodSearchResult[] }`

### `GET /api/food-products/{id}`
Point read of a single catalog document by its id (`openFoodFacts:<barcode>`). Returns the full `FoodProduct` document or `404`.
