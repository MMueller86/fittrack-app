// Cosmos-backed implementation of ReusableItemsRepository.
// Container: reusableMealItems, partition key: /userId

import { randomUUID } from 'node:crypto';
import type { ReusableItem } from '@fittrack/shared';
import { getCosmos } from '../cosmos';
import type { CreateReusableItemInput, ReusableItemsRepository, UpdateReusableItemInput } from './reusableItemsRepository';

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

interface TokenFilter {
  whereClause: string;
  parameters: { name: string; value: string }[];
}

/**
 * Builds a Cosmos SQL WHERE clause that requires ALL tokens to appear in
 * the item name (STARTSWITH) or any searchTerms element (EXISTS + STARTSWITH).
 * Uses prefix matching so partial tokens (e.g. "voll" → "vollkorn") still match.
 *
 * Example for tokens ["vollkorn", "reis"]:
 *   (STARTSWITH(LOWER(c.name), @q0) OR EXISTS(...WHERE STARTSWITH(t, @q0)))
 *   AND
 *   (STARTSWITH(LOWER(c.name), @q1) OR EXISTS(...WHERE STARTSWITH(t, @q1)))
 */
function buildTokenFilter(tokens: string[]): TokenFilter {
  const clauses = tokens.map(
    (_, i) =>
      `(STARTSWITH(LOWER(c.name), @q${i}) OR CONTAINS(LOWER(c.name), @q${i}) OR EXISTS(SELECT VALUE t FROM t IN c.searchTerms WHERE STARTSWITH(t, @q${i})))`,
  );
  return {
    whereClause: clauses.join(' AND '),
    parameters: tokens.map((t, i) => ({ name: `@q${i}`, value: t })),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CosmosReusableItemsRepository implements ReusableItemsRepository {
  async search(userId: string, query: string): Promise<ReusableItem[]> {
    const { containers } = await getCosmos();
    let cosmosQuery: string;
    let parameters: { name: string; value: string }[];

    if (!query.trim()) {
      cosmosQuery =
        'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.usageCount DESC OFFSET 0 LIMIT 20';
      parameters = [{ name: '@userId', value: userId }];
    } else {
      // Split query into tokens on whitespace. Min length 1 — STARTSWITH prefix search
      // intentionally allows single characters (e.g. "o" matches "Oats").
      // Note: splitQueryTokens from searchRanking enforces min length 2 for CONTAINS-based
      // food-product search — that stricter rule does NOT apply here.
      const tokens = query.toLowerCase().trim().split(/\s+/).filter((t) => t.length >= 1);
      if (tokens.length === 0) return [];
      const { whereClause, parameters: tokenParams } = buildTokenFilter(tokens);
      cosmosQuery = `SELECT * FROM c WHERE c.userId = @userId AND ${whereClause} ORDER BY c.usageCount DESC OFFSET 0 LIMIT 20`;
      parameters = [
        { name: '@userId', value: userId },
        ...tokenParams,
      ];
    }

    const { resources } = await containers.reusableMealItems.items
      .query<ReusableItem>({ query: cosmosQuery, parameters }, { partitionKey: userId })
      .fetchAll();
    return resources;
  }

  async create(input: CreateReusableItemInput): Promise<ReusableItem> {
    const { containers } = await getCosmos();
    const item: ReusableItem = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      brand: input.brand,
      nutritionBasis: input.nutritionBasis,
      nutritionPer100g: input.nutritionPer100g,
      portion: input.portion,
      isComplete: input.isComplete,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      ...(input.aiConfidence != null && { aiConfidence: input.aiConfidence }),
      ...(input.aiWarnings != null && { aiWarnings: input.aiWarnings }),
      ...(input.searchTerms != null && input.searchTerms.length > 0 && { searchTerms: input.searchTerms }),
    };
    const { resource } = await containers.reusableMealItems.items.create<ReusableItem>(item);
    return resource ?? item;
  }

  async getById(userId: string, id: string): Promise<ReusableItem | null> {
    const { containers } = await getCosmos();
    const { resource } = await containers.reusableMealItems.item(id, userId).read<ReusableItem>();
    return resource ?? null;
  }

  async update(userId: string, id: string, input: UpdateReusableItemInput): Promise<ReusableItem | null> {
    const { containers } = await getCosmos();
    const { resource: existing } = await containers.reusableMealItems.item(id, userId).read<ReusableItem>();
    if (!existing) return null;

    if (input.name !== undefined) existing.name = input.name;
    if (input.brand !== undefined) existing.brand = input.brand ?? undefined;
    if (input.nutritionPer100g !== undefined) {
      existing.nutritionPer100g = input.nutritionPer100g;
      existing.nutritionBasis = existing.portion ? 'both' : 'per100g';
    }
    if (input.portion !== undefined) {
      existing.portion = input.portion ?? undefined;
      existing.nutritionBasis = input.portion
        ? (existing.nutritionPer100g ? 'both' : 'perPortion')
        : (existing.nutritionPer100g ? 'per100g' : 'perPortion');
    }
    if (input.searchTerms !== undefined) existing.searchTerms = input.searchTerms;
    if (input.aiKeywords !== undefined) existing.aiKeywords = input.aiKeywords;
    if (input.searchTermsEnriched !== undefined) (existing as ReusableItem & { searchTermsEnriched?: boolean }).searchTermsEnriched = input.searchTermsEnriched;
    (existing as ReusableItem & { updatedAt?: string }).updatedAt = new Date().toISOString();

    const { resource: updated } = await containers.reusableMealItems.item(id, userId).replace<ReusableItem>(existing);
    return updated ?? existing;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const { containers } = await getCosmos();
    try {
      await containers.reusableMealItems.item(id, userId).delete();
      return true;
    } catch (e) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: number }).code === 404) {
        return false;
      }
      throw e;
    }
  }

  async incrementUsageCount(userId: string, id: string): Promise<void> {
    const { containers } = await getCosmos();
    try {
      // Cosmos patch operation: atomic increment without a full read-replace cycle
      await containers.reusableMealItems.item(id, userId).patch([
        { op: 'incr', path: '/usageCount', value: 1 },
      ]);
    } catch {
      // Silently ignore — usageCount is best-effort for ordering, not critical
    }
  }
}
