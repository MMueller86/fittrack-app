import type { MealType } from '@fittrack/shared';
import type { MCIName } from '../../shared/components/Icon';

export const MEAL_ICONS: Record<MealType, MCIName> = {
  breakfast: 'coffee',
  lunch: 'food',
  dinner: 'silverware-fork-knife',
  snack: 'food-apple',
  preworkout: 'lightning-bolt',
  postworkout: 'weight-lifter',
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
  preworkout: 'Vor dem Training',
  postworkout: 'Nach dem Training',
};