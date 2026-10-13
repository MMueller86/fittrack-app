// Reine Logik für "Eigene Lebensmittel": nur selbst angelegte Items, Suche, Herkunfts-Badges, Löschfeedback.

import type { ReusableItem } from '@fittrack/shared';
import type { FoodProductBadge } from '../../shared/components/FoodProductSummary';

// Open-Food-Facts-Produkte sind Katalogdaten und gehören nicht zu den eigenen Lebensmitteln.
export function selectOwnFoodItems(items: readonly ReusableItem[]): ReusableItem[] {
  return items
    .filter((item) => item.sourceType !== 'openFoodFacts')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function filterOwnFoodItems(items: readonly ReusableItem[], query: string): ReusableItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) || (item.brand ?? '').toLowerCase().includes(needle),
  );
}

const SOURCE_BADGES: Partial<Record<ReusableItem['sourceType'], FoodProductBadge>> = {
  manual: { label: 'Manuell', tone: 'neutral' },
  'label-scan': { label: 'Scan', tone: 'neutral' },
  ai: { label: 'KI', tone: 'accent' },
};

export function ownFoodBadges(item: ReusableItem): FoodProductBadge[] {
  const badge = SOURCE_BADGES[item.sourceType];
  return badge ? [badge] : [];
}

export function deleteFeedbackMessage(name: string, diaryUsageCount: number): string {
  if (diaryUsageCount <= 0) return `\u201E${name}\u201C gelöscht.`;
  const entries = diaryUsageCount === 1 ? 'Tagebuch-Eintrag behält' : 'Tagebuch-Einträge behalten';
  return `Gelöscht. ${diaryUsageCount} ${entries} die gespeicherten Nährwerte.`;
}
