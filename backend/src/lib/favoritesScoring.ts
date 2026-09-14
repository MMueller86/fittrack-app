import type { UserFoodRelation, MealType } from '@fittrack/shared';

function daysSince(isoDate: string, now: Date): number {
  return (now.getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

function dateOnlyFromInstant(instant: Date): string {
  return instant.toISOString().substring(0, 10);
}

function dateOnlyWindowStart(referenceDate: string): string {
  const windowStart = new Date(`${referenceDate}T00:00:00.000Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 90);
  return windowStart.toISOString().substring(0, 10);
}

/**
 * Computes the relevance score for a single favorite item given a meal context.
 *
 * mealFraction = usageDates[context] / usageDates[total] (last 90 days, only {date,mealType} entries)
 *             = 1 if no structured entries exist (neutral: item has no history)
 *
 * noveltyBonus  = favoritedAt within 7 days → 20 * mealFraction
 * contextBonus  = min(contextUses * 4, 20)
 * globalUsage   = min(usageCount, 20)
 * recencyScore  = max(0, (14 - daysSince(lastUsedAt)) * 1.5) * mealFraction
 */
export function scoreItem(
  item: UserFoodRelation,
  context: MealType,
  referenceDateOrNow: string | Date = new Date(),
  now: Date = new Date(),
): number {
  const referenceDate = typeof referenceDateOrNow === 'string'
    ? referenceDateOrNow
    : dateOnlyFromInstant(referenceDateOrNow);
  const elapsedTimeNow = referenceDateOrNow instanceof Date ? referenceDateOrNow : now;
  const ninetyDaysAgo = dateOnlyWindowStart(referenceDate);

  const recentEntries = (item.usageDates ?? []).filter(
    (e): e is { date: string; mealType: MealType } =>
      typeof e === 'object'
      && e !== null
      && 'date' in e
      && e.date >= ninetyDaysAgo
      && e.date <= referenceDate,
  );

  const contextUses = recentEntries.filter(e => e.mealType === context).length;
  const totalUses = recentEntries.length;
  const mealFraction = totalUses > 0 ? contextUses / totalUses : 1;

  const noveltyBonus =
    item.favoritedAt && daysSince(item.favoritedAt, elapsedTimeNow) <= 7 ? 20 * mealFraction : 0;
  const contextBonus = Math.min(contextUses * 4, 20);
  const globalUsage = Math.min(item.usageCount ?? 0, 20);
  const recencyScore = item.lastUsedAt
    ? Math.max(0, (14 - daysSince(item.lastUsedAt, elapsedTimeNow)) * 1.5) * mealFraction
    : 0;

  return noveltyBonus + contextBonus + globalUsage + recencyScore;
}

/**
 * Sorts favorites by relevance for the given meal context.
 * Items with score > 0: sorted DESC, tie-break displayName ASC (de).
 * Items with score = 0: alphabetical at the end.
 */
export function sortByRelevance(
  items: UserFoodRelation[],
  context: MealType,
  referenceDateOrNow: string | Date = new Date(),
  now: Date = new Date(),
): UserFoodRelation[] {
  const scored = items.map(item => ({
    item,
    score: scoreItem(item, context, referenceDateOrNow, now),
  }));
  const withScore = scored.filter(s => s.score > 0);
  const withoutScore = scored.filter(s => s.score === 0);

  withScore.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.item.displayName ?? '').localeCompare(b.item.displayName ?? '', 'de');
  });
  withoutScore.sort((a, b) =>
    (a.item.displayName ?? '').localeCompare(b.item.displayName ?? '', 'de'),
  );
  return [...withScore.map(s => s.item), ...withoutScore.map(s => s.item)];
}
