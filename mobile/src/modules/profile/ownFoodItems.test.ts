import { describe, expect, it } from 'vitest';
import type { ReusableItem } from '@fittrack/shared';
import { deleteFeedbackMessage, filterOwnFoodItems, ownFoodBadges, selectOwnFoodItems } from './ownFoodItems';

function item(overrides: Partial<ReusableItem>): ReusableItem {
  return {
    id: 'item',
    userId: 'user-1',
    name: 'Produkt',
    nutritionBasis: 'per100g',
    isComplete: true,
    sourceType: 'manual',
    usageCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectOwnFoodItems', () => {
  it('excludes Open Food Facts items and sorts newest first without mutating the input', () => {
    const input = [
      item({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' }),
      item({ id: 'off', sourceType: 'openFoodFacts', createdAt: '2026-10-05T00:00:00.000Z' }),
      item({ id: 'new', sourceType: 'ai', createdAt: '2026-10-03T00:00:00.000Z' }),
      item({ id: 'scan', sourceType: 'label-scan', createdAt: '2026-09-15T00:00:00.000Z' }),
    ];

    expect(selectOwnFoodItems(input).map((i) => i.id)).toEqual(['new', 'scan', 'old']);
    expect(input.map((i) => i.id)).toEqual(['old', 'off', 'new', 'scan']);
  });
});

describe('filterOwnFoodItems', () => {
  const items = [
    item({ id: 'a', name: 'Haferflocken', brand: 'Kölln' }),
    item({ id: 'b', name: 'Skyr' }),
  ];

  it('matches name or brand case-insensitively', () => {
    expect(filterOwnFoodItems(items, 'HAFER').map((i) => i.id)).toEqual(['a']);
    expect(filterOwnFoodItems(items, 'kölln').map((i) => i.id)).toEqual(['a']);
    expect(filterOwnFoodItems(items, 'xyz')).toEqual([]);
  });

  it('returns all items for a blank query', () => {
    expect(filterOwnFoodItems(items, '  ')).toHaveLength(2);
  });
});

describe('ownFoodBadges', () => {
  it('labels the origin of self-created items', () => {
    expect(ownFoodBadges(item({ sourceType: 'manual' }))).toEqual([{ label: 'Manuell', tone: 'neutral' }]);
    expect(ownFoodBadges(item({ sourceType: 'label-scan' }))).toEqual([{ label: 'Scan', tone: 'neutral' }]);
    expect(ownFoodBadges(item({ sourceType: 'ai' }))).toEqual([{ label: 'KI', tone: 'accent' }]);
    expect(ownFoodBadges(item({ sourceType: 'openFoodFacts' }))).toEqual([]);
  });
});

describe('deleteFeedbackMessage', () => {
  it('mentions retained diary entries only when the item was used', () => {
    expect(deleteFeedbackMessage('Skyr', 0)).toBe('\u201ESkyr\u201C gelöscht.');
    expect(deleteFeedbackMessage('Skyr', 1)).toBe('Gelöscht. 1 Tagebuch-Eintrag behält die gespeicherten Nährwerte.');
    expect(deleteFeedbackMessage('Skyr', 3)).toBe('Gelöscht. 3 Tagebuch-Einträge behalten die gespeicherten Nährwerte.');
  });
});
