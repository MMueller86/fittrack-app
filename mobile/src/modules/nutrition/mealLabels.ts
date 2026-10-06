import type { MealType } from '@fittrack/shared';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Vor dem Training',
  postworkout: 'Nach dem Training',
};