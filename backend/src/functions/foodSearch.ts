// Food Search endpoint — searches the internal food product catalog + user's reusable-item library.
//
// GET /api/food-search?query=
//
// Response: { results: FoodSearchResult[] }
// - User library items come first (sorted by usageCount desc).
// - Internal food product catalog results follow, de-duplicated by name.
//
// NOTE: The live Open Food Facts API is NOT called at runtime.
//       All product data comes from the internal Cosmos foodProducts container.

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import type { FoodSearchResult, ReusableItem } from '@fittrack/shared';

import { requireUser } from '../lib/auth';
import { withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import { rankByQuery } from '../lib/searchRanking';

// Build a Set of favorited foodRefs for O(1) lookup during result enrichment.
async function loadFavoriteRefs(userId: string): Promise<Set<string>> {
  try {
    const favorites = await getUserFoodRelationRepository().listFavorites(userId);
    return new Set(favorites.map((f) => f.foodRef));
  } catch {
    // Non-critical — favorites enrichment must not break search
    return new Set();
  }
}

// Map a user's ReusableItem to the unified FoodSearchResult shape.
function reusableItemToSearchResult(item: ReusableItem): FoodSearchResult {
  let displayLabel: string;
  if (item.portion?.nutrition) {
    displayLabel = `${item.portion.label} · ${Math.round(item.portion.nutrition.calories)} kcal`;
  } else if (item.nutritionPer100g) {
    displayLabel = `100g · ${Math.round(item.nutritionPer100g.calories)} kcal`;
  } else {
    displayLabel = 'No nutrition data';
  }

  return {
    id: item.id,
    source: 'library',
    name: item.name,
    brand: item.brand,
    displayLabel,
    nutritionBasis: item.nutritionBasis,
    nutritionPer100g: item.nutritionPer100g,
    portion: item.portion,
    isComplete: item.isComplete,
    sourceRef: item.sourceRef,
    ...(item.sourceType === 'ai' && { isAiEstimate: true }),
    ...(item.sourceType === 'ai' && item.aiConfidence != null && { aiConfidence: item.aiConfidence }),
  };
}

// GET /api/food-search?query=
export const foodSearchHandler = withHandler(
  'food.search',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const query = request.query.get('query') ?? '';

    // Fan-out: user library + internal product catalog + favorites in parallel
    const [libraryItems, catalogResults, favoriteRefs] = await Promise.all([
      getReusableItemsRepository().search(userId, query).catch(() => [] as ReusableItem[]),
      query.trim().length >= 2 ? getFoodProductRepository().search(query).catch(() => [] as FoodSearchResult[]) : Promise.resolve([] as FoodSearchResult[]),
      loadFavoriteRefs(userId),
    ]);

    // Enrich a result with isFavorite flag.
    // Library items: favoriteRef = item.id. Catalog items: favoriteRef = item.id (= 'openFoodFacts:<barcode>').
    const enrich = (r: FoodSearchResult): FoodSearchResult =>
      favoriteRefs.has(r.id) ? { ...r, isFavorite: true } : r;

    const nq = query.trim().toLowerCase();

    if (nq.length >= 2) {
      const LIBRARY_BONUS = 1.5;

      const rawLibrary = libraryItems;
      const catalog: FoodSearchResult[] = catalogResults;

      const scoredLibrary = rawLibrary
        .map((item) => ({
          result: reusableItemToSearchResult(item),
          score: rankByQuery(item.name, item.searchTerms ?? [], nq) + LIBRARY_BONUS,
        }))
        .filter((x) => x.score > LIBRARY_BONUS - 1); // exclude score=-1 (no match at all)

      const scoredCatalog = catalog
        .map((result) => ({
          result,
          score: rankByQuery(result.name, [], nq),
        }))
        .filter((x) => x.score >= 0);

      // Dedup: skip catalog entries whose name already appears in library
      const libraryNames = new Set(scoredLibrary.map((x) => x.result.name.toLowerCase()));
      const deduplicatedCatalog = scoredCatalog.filter(
        (x) => !libraryNames.has(x.result.name.toLowerCase()),
      );

      const results: FoodSearchResult[] = [...scoredLibrary, ...deduplicatedCatalog]
        .sort((a, b) => b.score - a.score)
        .map((x) => enrich(x.result));

      logEvent(ctx, 'info', 'food.search', {
        userId,
        query,
        libraryCount: scoredLibrary.length,
        catalogCount: deduplicatedCatalog.length,
      });

      return { status: 200, jsonBody: { results } };
    }

    // Empty query: library first (by usageCount from Cosmos), then catalog
    const library: FoodSearchResult[] = libraryItems.map((item) => enrich(reusableItemToSearchResult(item)));

    const catalog: FoodSearchResult[] = catalogResults;

    // De-duplicate: skip catalog results whose name already appears in the library
    const libraryNames = new Set(library.map((r) => r.name.toLowerCase()));
    const deduplicatedCatalog = catalog.filter((r) => !libraryNames.has(r.name.toLowerCase()));

    const results: FoodSearchResult[] = [...library, ...deduplicatedCatalog.map(enrich)];

    logEvent(ctx, 'info', 'food.search', {
      userId,
      query,
      libraryCount: library.length,
      catalogCount: deduplicatedCatalog.length,
    });

    return { status: 200, jsonBody: { results } };
  },
);

app.http('food-search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'food-search',
  handler: foodSearchHandler,
});
