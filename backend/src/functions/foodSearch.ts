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
import { rankByQuery } from '../lib/searchRanking';

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

    // Fan-out: user library + internal product catalog in parallel
    const [libraryItems, catalogResults] = await Promise.allSettled([
      getReusableItemsRepository().search(userId, query),
      query.trim().length >= 2 ? getFoodProductRepository().search(query) : Promise.resolve([]),
    ]);

    const nq = query.trim().toLowerCase();

    if (nq.length >= 2) {
      // Unified ranking: score library items (with +1.5 bonus) and catalog items,
      // then merge into a single list sorted by score DESC.
      // LIBRARY_BONUS must be large enough so that a library item matching via searchTerms
      // (score 3) outranks a catalog item with an exact name match (score 4): 3 + 1.5 = 4.5 > 4.
      const LIBRARY_BONUS = 1.5;

      const rawLibrary = libraryItems.status === 'fulfilled' ? libraryItems.value : [];
      const catalog: FoodSearchResult[] =
        catalogResults.status === 'fulfilled' ? catalogResults.value : [];

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
        .map((x) => x.result);

      logEvent(ctx, 'info', 'food.search', {
        userId,
        query,
        libraryCount: scoredLibrary.length,
        catalogCount: deduplicatedCatalog.length,
      });

      return { status: 200, jsonBody: { results } };
    }

    // Empty query: library first (by usageCount from Cosmos), then catalog
    const library: FoodSearchResult[] =
      libraryItems.status === 'fulfilled'
        ? libraryItems.value.map(reusableItemToSearchResult)
        : [];

    const catalog: FoodSearchResult[] =
      catalogResults.status === 'fulfilled' ? catalogResults.value : [];

    // De-duplicate: skip catalog results whose name already appears in the library
    const libraryNames = new Set(library.map((r) => r.name.toLowerCase()));
    const deduplicatedCatalog = catalog.filter((r) => !libraryNames.has(r.name.toLowerCase()));

    const results: FoodSearchResult[] = [...library, ...deduplicatedCatalog];

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
