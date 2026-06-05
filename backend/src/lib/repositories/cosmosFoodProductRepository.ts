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
import { splitQueryTokens } from '../searchRanking';

// Fetch up to this many candidates from Cosmos before JS ranking
const COSMOS_PREFETCH = 100;

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

interface TokenFilter {
  whereClause: string;
  parameters: { name: string; value: string | number }[];
}

/**
 * Builds a Cosmos SQL WHERE clause that requires ALL tokens to match
 * at least one of: normalizedName (CONTAINS) or searchKeywords (ARRAY_CONTAINS).
 *
 * Example for tokens ["vollkorn", "reis"]:
 *   (CONTAINS(c.normalizedName, @q0) OR ARRAY_CONTAINS(c.searchKeywords, @q0))
 *   AND
 *   (CONTAINS(c.normalizedName, @q1) OR ARRAY_CONTAINS(c.searchKeywords, @q1))
 */
function buildTokenFilter(tokens: string[]): TokenFilter {
  const clauses = tokens.map(
    (_, i) =>
      `(CONTAINS(c.normalizedName, @q${i}) OR ARRAY_CONTAINS(c.searchKeywords, @q${i}))`,
  );
  return {
    whereClause: clauses.join(' AND '),
    parameters: tokens.map((t, i) => ({ name: `@q${i}`, value: t })),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CosmosFoodProductRepository implements FoodProductRepository {
  async search(q: string, limit = 20): Promise<FoodSearchResult[]> {
    const nq = q.toLowerCase().trim();
    if (nq.length < 2) return [];

    const tokens = splitQueryTokens(nq);
    if (tokens.length === 0) return [];

    const { containers } = await getCosmos();
    const { whereClause, parameters } = buildTokenFilter(tokens);

    // Cosmos SQL: all tokens must appear in normalizedName or searchKeywords (AND across tokens).
    // We over-fetch (COSMOS_PREFETCH) and rank in JS so all scoring tiers are applied.
    const { resources } = await containers.foodProducts.items
      .query<FoodProduct>({
        query: `SELECT TOP @prefetch * FROM c WHERE ${whereClause}`,
        parameters: [
          ...parameters,
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
