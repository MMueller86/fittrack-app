import { describe, it, expect } from 'vitest';
import type { UserFoodRelation } from '@fittrack/shared';
import { computeRelevanceOrder } from './quickEntryRelevance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRelation(overrides: Partial<UserFoodRelation> = {}): UserFoodRelation {
  return {
    id: 'test-id',
    userId: 'user-1',
    foodRef: 'ref-1',
    foodRefType: 'personal',
    displayName: 'Test Item',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2025-06-01T12:00:00.000Z');

// ---------------------------------------------------------------------------
// computeRelevanceOrder
// ---------------------------------------------------------------------------

describe('computeRelevanceOrder', () => {
  it('1. Empty input returns empty array', () => {
    expect(computeRelevanceOrder([], 'lunch', NOW)).toEqual([]);
  });

  it('2. Single item returned in array of 1', () => {
    const item = makeRelation({ id: 'a', displayName: 'Apfel' });
    const result = computeRelevanceOrder([item], 'lunch', NOW);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('3. Item favoritedAt 3 days ago (noveltyBonus=30) outranks item favoritedAt 8 days ago (noveltyBonus=0)', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const newer = makeRelation({ id: 'newer', displayName: 'Newer', favoritedAt: threeDaysAgo });
    const older = makeRelation({ id: 'older', displayName: 'Older', favoritedAt: eightDaysAgo });
    const result = computeRelevanceOrder([older, newer], 'lunch', NOW);
    expect(result[0]!.id).toBe('newer');
    expect(result[1]!.id).toBe('older');
  });

  it('4. Item with mealTypeCounts.lunch=6 (contextBonus=20 capped) outranks item with mealTypeCounts.lunch=0 when contextMealType=lunch', () => {
    const highContext = makeRelation({ id: 'high', displayName: 'High', mealTypeCounts: { lunch: 6 } });
    const noContext = makeRelation({ id: 'none', displayName: 'None', mealTypeCounts: { lunch: 0 } });
    const result = computeRelevanceOrder([noContext, highContext], 'lunch', NOW);
    expect(result[0]!.id).toBe('high');
  });

  it('5. contextBonus is capped at 20 (mealTypeCounts.lunch=100 same as mealTypeCounts.lunch=5)', () => {
    const overCap = makeRelation({ id: 'over', displayName: 'Over', usageCount: 10, mealTypeCounts: { lunch: 100 } });
    const atCap = makeRelation({ id: 'at', displayName: 'At', usageCount: 10, mealTypeCounts: { lunch: 5 } });
    const result = computeRelevanceOrder([overCap, atCap], 'lunch', NOW);
    // Both have same score: contextBonus=20, globalUsage=10 → tie → alphabetical
    expect(result[0]!.displayName.localeCompare(result[1]!.displayName, 'de')).toBeLessThan(0);
  });

  it('6. Higher usageCount outranks lower when all other factors equal', () => {
    const high = makeRelation({ id: 'high', displayName: 'High', usageCount: 15 });
    const low = makeRelation({ id: 'low', displayName: 'Low', usageCount: 5 });
    const result = computeRelevanceOrder([low, high], 'lunch', NOW);
    expect(result[0]!.id).toBe('high');
  });

  it('7. usageCount is capped at 20 (usageCount=100 same globalUsage as usageCount=20)', () => {
    const over = makeRelation({ id: 'over', displayName: 'Over', usageCount: 100 });
    const atCap = makeRelation({ id: 'at', displayName: 'At', usageCount: 20 });
    const result = computeRelevanceOrder([over, atCap], 'lunch', NOW);
    // Both get globalUsage=20, no other factors → tie → alphabetical
    expect(result[0]!.displayName.localeCompare(result[1]!.displayName, 'de')).toBeLessThan(0);
  });

  it('8. Item with lastUsedAt yesterday scores higher than item with lastUsedAt 20 days ago', () => {
    const yesterday = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const longAgo = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const recent = makeRelation({ id: 'recent', displayName: 'Recent', lastUsedAt: yesterday });
    const old = makeRelation({ id: 'old', displayName: 'Old', lastUsedAt: longAgo });
    const result = computeRelevanceOrder([old, recent], 'lunch', NOW);
    expect(result[0]!.id).toBe('recent');
  });

  it('9. Items with total score 0 appear at end of sorted list', () => {
    const withScore = makeRelation({ id: 'scored', displayName: 'Scored', usageCount: 5 });
    const zeroScore = makeRelation({ id: 'zero', displayName: 'Zero', usageCount: 0 });
    const result = computeRelevanceOrder([zeroScore, withScore], 'lunch', NOW);
    expect(result[0]!.id).toBe('scored');
    expect(result[1]!.id).toBe('zero');
  });

  it('10. Zero-score items are sorted alphabetically at the end ("Apfel" before "Banane")', () => {
    const banane = makeRelation({ id: 'b', displayName: 'Banane', usageCount: 0 });
    const apfel = makeRelation({ id: 'a', displayName: 'Apfel', usageCount: 0 });
    const result = computeRelevanceOrder([banane, apfel], 'lunch', NOW);
    expect(result[0]!.displayName).toBe('Apfel');
    expect(result[1]!.displayName).toBe('Banane');
  });

  it('11. Items with identical total score sorted alphabetically ("Apfel" before "Banane")', () => {
    const banane = makeRelation({ id: 'b', displayName: 'Banane', usageCount: 5 });
    const apfel = makeRelation({ id: 'a', displayName: 'Apfel', usageCount: 5 });
    const result = computeRelevanceOrder([banane, apfel], 'lunch', NOW);
    expect(result[0]!.displayName).toBe('Apfel');
    expect(result[1]!.displayName).toBe('Banane');
  });

  it('12. now parameter respected: favoritedAt 6 days before now gets bonus; 8 days after favoritedAt does not', () => {
    const favoritedAt = new Date('2025-05-20T12:00:00.000Z').toISOString();
    const nowSix = new Date('2025-05-26T12:00:00.000Z'); // 6 days after → noveltyBonus=30
    const nowEight = new Date('2025-05-28T12:00:00.000Z'); // 8 days after → noveltyBonus=0

    const item = makeRelation({ id: 'x', displayName: 'X', favoritedAt });
    const noBonus = makeRelation({ id: 'y', displayName: 'Y', usageCount: 5 }); // score=5

    // With nowSix: item has score 30, noBonus has 5 → item first
    const withSix = computeRelevanceOrder([noBonus, item], 'lunch', nowSix);
    expect(withSix[0]!.id).toBe('x');

    // With nowEight: item has score 0, noBonus has 5 → noBonus first
    const withEight = computeRelevanceOrder([noBonus, item], 'lunch', nowEight);
    expect(withEight[0]!.id).toBe('y');
  });

  it('13. Result is a new array (original input array is not mutated)', () => {
    const items = [
      makeRelation({ id: 'b', displayName: 'Banane', usageCount: 5 }),
      makeRelation({ id: 'a', displayName: 'Apfel', usageCount: 10 }),
    ];
    const original = [...items];
    computeRelevanceOrder(items, 'lunch', NOW);
    expect(items[0]!.id).toBe(original[0]!.id);
    expect(items[1]!.id).toBe(original[1]!.id);
  });
});


