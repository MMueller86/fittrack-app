import { describe, it, expect } from 'vitest';
import { MockOpenFoodFactsClient } from './openFoodFactsClient';
import type { FoodSearchResult } from '@fittrack/shared';

// Fixtures for mock client
const APPLE: FoodSearchResult = {
  id: 'off-apple',
  source: 'openFoodFacts',
  name: 'Apple',
  displayLabel: '100g · 52 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts', barcode: '1234567890' },
};

const BANANA: FoodSearchResult = {
  id: 'off-banana',
  source: 'openFoodFacts',
  name: 'Banana',
  displayLabel: '100g · 89 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts' },
};

const APPLE_JUICE: FoodSearchResult = {
  id: 'off-applejuice',
  source: 'openFoodFacts',
  name: 'Apple Juice',
  displayLabel: '100g · 46 kcal',
  nutritionBasis: 'per100g',
  nutritionPer100g: { calories: 46, protein: 0.1, carbs: 11.4, fat: 0.1, fiber: 0.2 },
  isComplete: true,
  sourceRef: { provider: 'openFoodFacts' },
};

describe('MockOpenFoodFactsClient', () => {
  it('returns all fixtures for empty-ish query match', async () => {
    const client = new MockOpenFoodFactsClient([APPLE, BANANA]);
    const results = await client.searchProducts('apple');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Apple');
  });

  it('matches case-insensitively', async () => {
    const client = new MockOpenFoodFactsClient([APPLE, BANANA]);
    const results = await client.searchProducts('BANANA');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Banana');
  });

  it('returns multiple matching results', async () => {
    const client = new MockOpenFoodFactsClient([APPLE, BANANA, APPLE_JUICE]);
    const results = await client.searchProducts('apple');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name)).toEqual(expect.arrayContaining(['Apple', 'Apple Juice']));
  });

  it('returns empty array when no match', async () => {
    const client = new MockOpenFoodFactsClient([APPLE, BANANA]);
    const results = await client.searchProducts('carrot');
    expect(results).toHaveLength(0);
  });

  it('returns empty array when initialized with no fixtures', async () => {
    const client = new MockOpenFoodFactsClient();
    const results = await client.searchProducts('apple');
    expect(results).toHaveLength(0);
  });
});

describe('FoodSearchResult shape', () => {
  it('isComplete is true when nutritionPer100g is present', () => {
    expect(APPLE.isComplete).toBe(true);
    expect(APPLE.nutritionPer100g).toBeDefined();
  });

  it('source is openFoodFacts for OFF results', () => {
    expect(APPLE.source).toBe('openFoodFacts');
  });

  it('sourceRef has correct provider', () => {
    expect(APPLE.sourceRef?.provider).toBe('openFoodFacts');
    expect(APPLE.sourceRef?.barcode).toBe('1234567890');
  });
});
