import type { UserFoodRelation, MealType } from '@fittrack/shared';

function daysSince(isoDate: string, now: Date): number {
  return (now.getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Sorts a copy of `items` by Quick Entry relevance.
 * Higher score = earlier in the list.
 * Items with score 0 appear last, sorted alphabetically.
 *
 * Scoring:
 *   noveltyBonus  = favoritedAt within 7 days → +30 (else 0)
 *   contextBonus  = min(mealTypeCounts[context] * 4, 20)
 *   globalUsage   = min(usageCount, 20)
 *   recencyScore  = lastUsedAt set → max(0, 14 - daysSince(lastUsedAt)) * 1.5 (else 0)
 *
 * Tie-breaker: alphabetical by displayName ASC.
 * Zero-score items: alphabetical at the end.
 */
export function computeRelevanceOrder(
  items: UserFoodRelation[],
  contextMealType: MealType,
  now: Date = new Date(),
): UserFoodRelation[] {
  const scored = items.map(item => {
    const noveltyBonus =
      item.favoritedAt && daysSince(item.favoritedAt, now) <= 7 ? 30 : 0;
    const contextBonus =
      Math.min((item.mealTypeCounts?.[contextMealType] ?? 0) * 4, 20);
    const globalUsage = Math.min(item.usageCount ?? 0, 20);
    const recencyScore = item.lastUsedAt
      ? Math.max(0, (14 - daysSince(item.lastUsedAt, now)) * 1.5)
      : 0;
    const total = noveltyBonus + contextBonus + globalUsage + recencyScore;
    return { item, total };
  });

  const withScore = scored.filter(s => s.total > 0);
  const withoutScore = scored.filter(s => s.total === 0);

  withScore.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return (a.item.displayName ?? '').localeCompare(b.item.displayName ?? '', 'de');
  });

  withoutScore.sort((a, b) =>
    (a.item.displayName ?? '').localeCompare(b.item.displayName ?? '', 'de'),
  );

  return [...withScore.map(s => s.item), ...withoutScore.map(s => s.item)];
}
