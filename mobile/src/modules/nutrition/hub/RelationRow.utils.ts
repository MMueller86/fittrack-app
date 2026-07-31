import type { MealType } from '@fittrack/shared';

export function thumbnailBorderWidth(usageDates?: Array<{ date: string; mealType: MealType }>): 0 | 1 | 2 | 3 {
  if (!usageDates || usageDates.length === 0) return 0;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().substring(0, 10);
  const count = usageDates.filter(e => e.date >= cutoff).length;
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 9) return 2;
  return 3;
}
