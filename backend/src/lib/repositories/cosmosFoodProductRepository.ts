// Cosmos DB-backed implementation of FoodProductRepository.
// Container: foodProducts, partition key: /id
//
// Search strategy:
//   - Cosmos SQL: CONTAINS on normalizedName + ARRAY_CONTAINS on searchKeywords
//   - Post-query JS ranking: exact > prefix > substring > keyword > keyword-substring
//   - Top 20 results returned (configurable via limit arg)
//
// Point reads use container.item(id, id) — O(1), single partition lookup.

import type { FoodProduct, FoodSearchResult } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { FoodProductRepository } from './foodProductRepository';
import { foodProductToSearchResult, rankAndSort } from './foodProductRepository';

// Fetch up to this many candidates from Cosmos before JS ranking
const COSMOS_PREFETCH = 100;

export class CosmosFoodProductRepository implements FoodProductRepository {
  async search(q: string, limit = 20): Promise<FoodSearchResult[]> {
    const nq = q.toLowerCase().trim();
    if (nq.length < 2) return [];

    const { containers } = await getCosmos();

    // Cosmos SQL: filter by name substring OR exact keyword match.
    // ARRAY_CONTAINS does exact-element matching — sufficient for MVP.
    // We over-fetch (COSMOS_PREFETCH) and rank in JS so all tiers are covered.
    const { resources } = await containers.foodProducts.items
      .query<FoodProduct>({
        query: `
          SELECT TOP @prefetch *
          FROM c
          WHERE
            CONTAINS(c.normalizedName, @q)
            OR ARRAY_CONTAINS(c.searchKeywords, @q)
        `,
        parameters: [
          { name: '@q', value: nq },
          { name: '@prefetch', value: COSMOS_PREFETCH },
        ],
      })
      .fetchAll();

    return rankAndSort(resources, nq, limit).map(foodProductToSearchResult);
  }

  async getById(id: string): Promise<FoodProduct | null> {
    const { containers } = await getCosmos();
    // Point read: id is both document id and partition key value
    const { resource } = await containers.foodProducts.item(id, id).read<FoodProduct>();
    return resource ?? null;
  }
}
