// Unit tests for the backend favorites scoring engine.
// Fixed reference time: 2025-06-01T12:00:00.000Z

import { describe, it, expect } from 'vitest';
import type { UserFoodRelation, MealType } from '@fittrack/shared';

import { scoreItem, sortByRelevance } from './favoritesScoring';

const NOW = new Date('2025-06-01T12:00:00.000Z');

function makeItem(overrides: Partial<UserFoodRelation> = {}): UserFoodRelation {
  return {
    id: 'user1:ref1',
    userId: 'user1',
    foodRef: 'ref1',
    foodRefType: 'catalog',
    displayName: 'Test Item',
    isFavorite: true,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeEntry(date: string, mealType: MealType): { date: string; mealType: MealType } {
  return { date, mealType };
}

// ---------------------------------------------------------------------------
// 1. Leere Liste
// ---------------------------------------------------------------------------
describe('sortByRelevance — empty list', () => {
  it('returns empty array for empty input', () => {
    expect(sortByRelevance([], 'lunch', NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Einzelnes Item
// ---------------------------------------------------------------------------
describe('sortByRelevance — single item', () => {
  it('returns the single item', () => {
    const item = makeItem({ usageCount: 5 });
    const result = sortByRelevance([item], 'lunch', NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(item);
  });
});

// ---------------------------------------------------------------------------
// 3. noveltyBonus — favoritedAt within / outside 7 days
// ---------------------------------------------------------------------------
describe('scoreItem — noveltyBonus', () => {
  it('favoritedAt 3 days ago → noveltyBonus > 0', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ favoritedAt: threeDaysAgo });
    expect(scoreItem(item, 'lunch', NOW)).toBeGreaterThan(0);
  });

  it('favoritedAt 8 days ago → noveltyBonus = 0', () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ favoritedAt: eightDaysAgo });
    // No other scores either (usageCount=0, lastUsedAt=null, no usageDates)
    expect(scoreItem(item, 'lunch', NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. noveltyBonus × mealFraction: item only used as snack, context = lunch
// ---------------------------------------------------------------------------
describe('scoreItem — noveltyBonus × mealFraction', () => {
  it('item used only as snack with context lunch → noveltyBonus = 0 (mealFraction = 0)', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      favoritedAt: threeDaysAgo,
      usageDates: [makeEntry(recentDate, 'snack')],
    });
    // mealFraction for 'lunch' = 0/1 = 0 → noveltyBonus = 20 * 0 = 0
    // contextBonus for 'lunch' = 0
    // globalUsage = 0
    // recencyScore = 0 (lastUsedAt = null)
    expect(scoreItem(item, 'lunch', NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. noveltyBonus for new item (no usageDates) → mealFraction = 1 → full bonus
// ---------------------------------------------------------------------------
describe('scoreItem — noveltyBonus with no usageDates', () => {
  it('new item with no usageDates → mealFraction = 1 → full noveltyBonus = 20', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ favoritedAt: threeDaysAgo });
    // noveltyBonus = 20 * 1 = 20; contextBonus = 0; globalUsage = 0; recencyScore = 0
    expect(scoreItem(item, 'lunch', NOW)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 6. contextBonus capped at 20 (5 lunch entries → 5*4 = 20)
// ---------------------------------------------------------------------------
describe('scoreItem — contextBonus cap', () => {
  it('5 lunch entries → contextBonus = 20 (cap)', () => {
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      usageDates: Array.from({ length: 5 }, () => makeEntry(recentDate, 'lunch')),
    });
    // contextBonus = min(5*4, 20) = 20
    // mealFraction = 5/5 = 1
    // globalUsage = 0
    // recencyScore = 0
    expect(scoreItem(item, 'lunch', NOW)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// 7. contextBonus: 2 lunch entries → 8
// ---------------------------------------------------------------------------
describe('scoreItem — contextBonus partial', () => {
  it('2 lunch entries → contextBonus = 8', () => {
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      usageDates: [makeEntry(recentDate, 'lunch'), makeEntry(recentDate, 'lunch')],
    });
    // contextBonus = min(2*4, 20) = 8
    expect(scoreItem(item, 'lunch', NOW)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 8. contextBonus: only snack entries, context = lunch → contextBonus = 0
// ---------------------------------------------------------------------------
describe('scoreItem — contextBonus mismatched meal', () => {
  it('only snack entries with context lunch → contextBonus = 0', () => {
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      usageDates: [makeEntry(recentDate, 'snack'), makeEntry(recentDate, 'snack')],
    });
    // contextUses for 'lunch' = 0 → contextBonus = 0
    // mealFraction = 0/2 = 0 → recencyScore = 0, noveltyBonus = 0
    // globalUsage = 0
    expect(scoreItem(item, 'lunch', NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. globalUsage cap
// ---------------------------------------------------------------------------
describe('scoreItem — globalUsage cap', () => {
  it('usageCount = 100 → globalUsage = 20 (cap)', () => {
    const item = makeItem({ usageCount: 100 });
    // Only globalUsage contributes (no dates, no favoritedAt, no lastUsedAt)
    expect(scoreItem(item, 'lunch', NOW)).toBe(20);
  });

  it('usageCount = 5 → globalUsage = 5', () => {
    const item = makeItem({ usageCount: 5 });
    expect(scoreItem(item, 'lunch', NOW)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 10. recencyScore: lastUsedAt yesterday, mealFraction = 1
// ---------------------------------------------------------------------------
describe('scoreItem — recencyScore', () => {
  it('lastUsedAt yesterday with mealFraction=1 → recencyScore = max(0,(14-1)*1.5) = 19.5', () => {
    const yesterday = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const yesterdayDate = yesterday.substring(0, 10);
    const item = makeItem({
      lastUsedAt: yesterday,
      usageDates: [makeEntry(yesterdayDate, 'lunch')],
    });
    // mealFraction = 1/1 = 1
    // recencyScore = max(0, (14 - 1) * 1.5) * 1 = 13 * 1.5 = 19.5
    // contextBonus = min(1*4, 20) = 4
    // total = 4 + 0 + 19.5 = 23.5
    const score = scoreItem(item, 'lunch', NOW);
    expect(score).toBeCloseTo(23.5);
  });
});

// ---------------------------------------------------------------------------
// 11. recencyScore: lastUsedAt 15 days ago → 0
// ---------------------------------------------------------------------------
describe('scoreItem — recencyScore beyond 14 days', () => {
  it('lastUsedAt 15 days ago → recencyScore = 0', () => {
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const item = makeItem({ lastUsedAt: fifteenDaysAgo });
    // recencyScore = max(0, (14 - 15) * 1.5) = max(0, -1.5) = 0
    // no other contributions
    expect(scoreItem(item, 'lunch', NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 12. recencyScore × mealFraction: item only used as snack, context = lunch
// ---------------------------------------------------------------------------
describe('scoreItem — recencyScore × mealFraction', () => {
  it('item used only as snack with context lunch → recencyScore = 0', () => {
    const yesterday = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const yesterdayDate = yesterday.substring(0, 10);
    const item = makeItem({
      lastUsedAt: yesterday,
      usageDates: [makeEntry(yesterdayDate, 'snack')],
    });
    // mealFraction for 'lunch' = 0/1 = 0
    // recencyScore = 19.5 * 0 = 0
    // contextBonus = 0
    // globalUsage = 0
    expect(scoreItem(item, 'lunch', NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Sortierung: höherer Score zuerst
// ---------------------------------------------------------------------------
describe('sortByRelevance — sort order', () => {
  it('items sorted by score DESC', () => {
    const low = makeItem({ id: 'u:low', foodRef: 'low', displayName: 'Low', usageCount: 1 });
    const high = makeItem({ id: 'u:high', foodRef: 'high', displayName: 'High', usageCount: 10 });
    const result = sortByRelevance([low, high], 'lunch', NOW);
    expect(result[0]).toBe(high);
    expect(result[1]).toBe(low);
  });
});

// ---------------------------------------------------------------------------
// 14. Tie-break: gleicher Score → alphabetisch ASC
// ---------------------------------------------------------------------------
describe('sortByRelevance — tie-break', () => {
  it('same score → sorted alphabetically ASC', () => {
    const itemB = makeItem({ id: 'u:b', foodRef: 'b', displayName: 'Banane', usageCount: 5 });
    const itemA = makeItem({ id: 'u:a', foodRef: 'a', displayName: 'Apfel', usageCount: 5 });
    const result = sortByRelevance([itemB, itemA], 'lunch', NOW);
    expect(result[0]!.displayName).toBe('Apfel');
    expect(result[1]!.displayName).toBe('Banane');
  });
});

// ---------------------------------------------------------------------------
// 15. Zero-Score Items: am Ende, alphabetisch
// ---------------------------------------------------------------------------
describe('sortByRelevance — zero-score items at end', () => {
  it('zero-score items appear after scored items, alphabetically among themselves', () => {
    const scored = makeItem({ id: 'u:s', foodRef: 's', displayName: 'Scored', usageCount: 5 });
    const zeroZ = makeItem({ id: 'u:z', foodRef: 'z', displayName: 'Zwiebel' });
    const zeroA = makeItem({ id: 'u:aa', foodRef: 'aa', displayName: 'Ananas' });
    const result = sortByRelevance([zeroZ, scored, zeroA], 'lunch', NOW);
    expect(result[0]).toBe(scored);
    expect(result[1]!.displayName).toBe('Ananas');
    expect(result[2]!.displayName).toBe('Zwiebel');
  });
});

// ---------------------------------------------------------------------------
// 16. Input-Array nicht mutiert
// ---------------------------------------------------------------------------
describe('sortByRelevance — immutability', () => {
  it('does not mutate the input array', () => {
    const a = makeItem({ id: 'u:a', foodRef: 'a', displayName: 'A', usageCount: 1 });
    const b = makeItem({ id: 'u:b', foodRef: 'b', displayName: 'B', usageCount: 10 });
    const input = [a, b];
    const original = [...input];
    sortByRelevance(input, 'lunch', NOW);
    expect(input).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// 17. Nur usageDates innerhalb 90 Tage zählen
// ---------------------------------------------------------------------------
describe('scoreItem — 90-day window', () => {
  it('entries older than 90 days are not counted', () => {
    const oldDate = new Date(NOW.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      usageDates: [
        makeEntry(oldDate, 'lunch'),  // outside 90 days → ignored
        makeEntry(recentDate, 'lunch'), // inside → counts
      ],
    });
    // Only 1 recent entry: contextBonus = min(1*4,20) = 4
    expect(scoreItem(item, 'lunch', NOW)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 18. String-Einträge in usageDates werden ignoriert
// ---------------------------------------------------------------------------
describe('scoreItem — string entries in usageDates ignored', () => {
  it('legacy string entries are filtered out and not counted', () => {
    const recentDate = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const item = makeItem({
      // Cast to bypass TypeScript — simulates old data in Cosmos
      usageDates: [
        recentDate as unknown as { date: string; mealType: MealType }, // legacy string → ignored
        makeEntry(recentDate, 'lunch'),                                  // structured → counted
      ],
    });
    // Only 1 structured entry: contextBonus = 4
    expect(scoreItem(item, 'lunch', NOW)).toBe(4);
  });
});
