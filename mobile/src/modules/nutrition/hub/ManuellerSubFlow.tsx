// ManuellerSubFlow — Manuelle Lebensmitteleingabe via LabelScanReviewScreen (isManual=true).
// KEIN eigenes <Modal> — LabelScanReviewScreen bringt sein eigenes Modal mit.
// Doppeltes Modal-Nesting würde eine weiße Seite zeigen (outer Modal ohne sichtbaren Inhalt).

import React from 'react';
import LabelScanReviewScreen from '../LabelScanReviewScreen';
import type { FoodEntryHubContext } from './useFoodEntryHubStore';
import { nutritionDiaryService as diaryApi } from '../../../services/nutritionDiaryService';
import type { MealType } from '@fittrack/shared';

interface Props {
  visible: boolean;
  context: FoodEntryHubContext;
  onClose: () => void;
  onSaved: (productName: string) => void;
}

async function resolveOrCreateMealId(
  date: string,
  mealType: MealType,
  mealId?: string,
): Promise<string> {
  // Temp IDs are optimistic placeholders — not real backend IDs
  if (mealId && !mealId.startsWith('temp-')) return mealId;
  const dayData = await diaryApi.getDay(date);
  const existing = dayData.meals.find((m) => m.type === mealType);
  if (existing) return existing.id;
  const { meal } = await diaryApi.createMeal(date, mealType);
  return meal.id;
}

export function ManuellerSubFlow({ visible, context, onClose, onSaved }: Props) {
  const [resolvedMealId, setResolvedMealId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setResolvedMealId(null);
      return;
    }
    if (context.purpose !== 'diary') return;
    resolveOrCreateMealId(context.date, context.mealType, context.mealId)
      .then(setResolvedMealId)
      .catch(() => onClose());
  }, [visible, context.purpose, context.date, context.mealType, context.mealId, onClose]);

  // LabelScanReviewScreen verwaltet sein eigenes Modal (visible-Prop steuert es direkt)
  return (
    <LabelScanReviewScreen
      visible={visible && !!resolvedMealId}
      isManual
      mealId={resolvedMealId ?? ''}
      onClose={onClose}
      onSaved={() => onSaved('Manueller Eintrag')}
    />
  );
}
