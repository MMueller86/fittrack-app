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
      `(CONTAINS(c.normalizedName, @q${i}) OR ARRAY_CONTAINS(c.searchKeywords, @q${i}) OR (IS_STRING(c.brand) AND CONTAINS(LOWER(c.brand), @q${i})))`,
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

    // Fast path: rein numerische Anfrage → Barcode-Direktlookup (O(1) Point Read).
    // Deckt alle EAN-8, EAN-13, UPC-A, UPC-E etc. Formate ab.
    if (/^\d+$/.test(nq)) {
      const byId = await this.getById(`openFoodFacts:${nq}`);
      if (byId) return [foodProductToSearchResult(byId)];
      // Kein Treffer → kein Fallback auf Keyword-Suche (Zahlenstrings liefern dort nie sinnvolle Treffer)
      return [];
    }

    const tokens = splitQueryTokens(nq);
    if (tokens.length === 0) return [];

    const { containers } = await getCosmos();
    const { whereClause, parameters } = buildTokenFilter(tokens);

    // Three-pass fetch (parallel): exact match + prefix + contains, merged before JS ranking.
    //
    // Problem: with 1300+ STARTSWITH and 4000+ CONTAINS matches for "tomaten",
    // SELECT TOP N returns arbitrary results — exact matches like "Tomaten" are crowded out.
    //
    // Pass 1 (exact normalizedName): guarantees products whose name exactly equals the query
    //   are always included (e.g. 25 × "Tomaten" for query "tomaten"). Fast index lookup.
    // Pass 2 (STARTSWITH + all tokens): includes prefix matches like "Tomaten Passata".
    //   Uses full token filter so multi-token queries don't return false positives.
    // Pass 3 (CONTAINS, existing logic): broader substring matches.
    // All three run in parallel → no extra latency.
    const [
      { resources: exactResources },
      { resources: prefixResources },
      { resources: containsResources },
    ] = await Promise.all([
      // Pass 1: exact normalizedName match (normalized query as whole string)
      containers.foodProducts.items
        .query<FoodProduct>({
          query: 'SELECT TOP 30 * FROM c WHERE c.normalizedName = @exactQuery',
          parameters: [{ name: '@exactQuery', value: nq }],
        })
        .fetchAll(),
      // Pass 2: STARTSWITH on normalizedName + all tokens must match
      containers.foodProducts.items
        .query<FoodProduct>({
          query: `SELECT TOP @prefixLimit * FROM c WHERE STARTSWITH(c.normalizedName, @q0) AND ${whereClause}`,
          parameters: [
            ...parameters,
            { name: '@prefixLimit', value: 50 },
          ],
        })
        .fetchAll(),
      // Pass 3: full CONTAINS query
      containers.foodProducts.items
        .query<FoodProduct>({
          query: `SELECT TOP @prefetch * FROM c WHERE ${whereClause}`,
          parameters: [
            ...parameters,
            { name: '@prefetch', value: COSMOS_PREFETCH },
          ],
        })
        .fetchAll(),
    ]);

    const seenIds = new Set(exactResources.map((r) => r.id));
    const resources = [
      ...exactResources,
      ...prefixResources.filter((r) => !seenIds.has(r.id) && (seenIds.add(r.id), true)),
      ...containsResources.filter((r) => !seenIds.has(r.id)),
    ];

    return rankAndSort(resources, nq, limit).map(foodProductToSearchResult);
  }

  async getById(id: string): Promise<FoodProduct | null> {
    const { containers } = await getCosmos();
    // Point read: id is both document id and partition key value
    const { resource } = await containers.foodProducts.item(id, id).read<FoodProduct>();
    return resource ?? null;
  }
}
