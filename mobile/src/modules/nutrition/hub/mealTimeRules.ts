// mealTimeRules.ts — pure function, no React.
// Maps the current hour to the contextually most relevant MealType.
// Configuration table — no magic numbers elsewhere.

import type { MealType } from '@fittrack/shared';

interface TimeRule {
  fromHour: number; // inclusive
  toHour: number;   // exclusive
  mealType: MealType;
}

const RULES: TimeRule[] = [
  { fromHour: 5,    toHour: 10,   mealType: 'breakfast' },
  { fromHour: 10,   toHour: 12,   mealType: 'snack' },
  { fromHour: 12,   toHour: 14.5, mealType: 'lunch' },
  { fromHour: 14.5, toHour: 17.5, mealType: 'snack' },
  { fromHour: 17.5, toHour: 21,   mealType: 'dinner' },
  // 21:00–05:00 → snack (default / fallback)
];

/**
 * Returns the suggested MealType for the given hour (0–23.99).
 * Accepts fractional hours (e.g. 14.5 = 14:30).
 */
export function getMealTypeForHour(hour: number): MealType {
  for (const rule of RULES) {
    if (hour >= rule.fromHour && hour < rule.toHour) {
      return rule.mealType;
    }
  }
  return 'snack'; // 21:00–05:00
}

/**
 * Returns the suggested MealType for the current local time.
 */
export function getSuggestedMealType(): MealType {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  return getMealTypeForHour(hour);
}
