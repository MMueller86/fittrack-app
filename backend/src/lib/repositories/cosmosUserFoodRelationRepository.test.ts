import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserFoodRelation } from '@fittrack/shared';

const { getCosmosMock } = vi.hoisted(() => ({
  getCosmosMock: vi.fn(),
}));

vi.mock('../cosmos', () => ({
  getCosmos: getCosmosMock,
}));

import { CosmosUserFoodRelationRepository } from './cosmosUserFoodRelationRepository';

const USER = 'cosmos-ufr-user';
const FOOD_REF = 'openFoodFacts:777';
const USAGE_DATE = '2026-05-08';
const NUTRITION = { calories: 250, protein: 15, carbs: 20, fat: 8, fiber: 4 };
const PORTION = { label: 'Portion', weightGrams: 30 };
const IMAGE = 'https://img.invalid/a.jpg';

let stored: UserFoodRelation | undefined;
let upsert: ReturnType<typeof vi.fn>;
let read: ReturnType<typeof vi.fn>;
let queryResults: UserFoodRelation[];

function storedRelation(overrides: Partial<UserFoodRelation> = {}): UserFoodRelation {
  return {
    id: `${USER}:${FOOD_REF}`,
    userId: USER,
    foodRef: FOOD_REF,
    foodRefType: 'catalog',
    displayName: 'Test Food',
    displayBrand: 'Brand A',
    imageUrl: IMAGE,
    isFavorite: true,
    favoritedAt: '2026-05-01T10:00:00.000Z',
    nutritionPer100g: NUTRITION,
    portion: PORTION,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function lastUpserted(): UserFoodRelation {
  return upsert.mock.calls.at(-1)![0] as UserFoodRelation;
}

function usageInput(overrides: Record<string, unknown> = {}) {
  return {
    foodRef: FOOD_REF,
    foodRefType: 'catalog' as const,
    displayName: 'Test Food',
    usageDate: USAGE_DATE,
    mealType: 'lunch' as const,
    ...overrides,
  };
}

beforeEach(() => {
  stored = undefined;
  queryResults = [];
  upsert = vi.fn().mockResolvedValue({});
  read = vi.fn(async () => ({ resource: stored }));
  getCosmosMock.mockResolvedValue({
    containers: {
      userFoodRelations: {
        item: vi.fn(() => ({ read })),
        items: {
          upsert,
          query: vi.fn(() => ({ fetchAll: async () => ({ resources: queryResults }) })),
        },
      },
    },
  });
});

describe('CosmosUserFoodRelationRepository.recordUsage — displayBrand merge', () => {
  it('keeps displayBrand when omitted and updates usage fields only', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput());

    const doc = lastUpserted();
    expect(doc.displayBrand).toBe('Brand A');
    expect(doc.usageCount).toBe(1);
    expect(doc.lastUsedAt).not.toBeNull();
    expect(doc.usageDates).toEqual([{ date: USAGE_DATE, mealType: 'lunch' }]);
    expect(doc).toMatchObject({
      isFavorite: true,
      favoritedAt: '2026-05-01T10:00:00.000Z',
      nutritionPer100g: NUTRITION,
      portion: PORTION,
      imageUrl: IMAGE,
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ])('keeps displayBrand when %s is passed', async (_label, value) => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput({ displayBrand: value }));

    expect(lastUpserted().displayBrand).toBe('Brand A');
  });

  it('overwrites displayBrand with a non-empty value', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput({ displayBrand: 'Brand B' }));

    expect(lastUpserted().displayBrand).toBe('Brand B');
  });

  it('still updates displayName and does not overwrite imageUrl with an empty value', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().recordUsage(
      USER,
      usageInput({ displayName: 'Renamed', imageUrl: undefined }),
    );

    expect(lastUpserted()).toMatchObject({ displayName: 'Renamed', imageUrl: IMAGE });
  });

  it('creates a new relation without a brand when none is provided', async () => {
    await new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput());

    const doc = lastUpserted();
    expect(doc.displayBrand).toBeUndefined();
    expect(doc.usageCount).toBe(1);
  });

  it('strips brand and caches for recipe relations', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().recordUsage(
      USER,
      usageInput({ foodRefType: 'recipe', displayBrand: 'Forged', imageUrl: IMAGE }),
    );

    const doc = lastUpserted();
    expect(doc).toMatchObject({ foodRefType: 'recipe', usageCount: 1 });
    for (const key of ['displayBrand', 'imageUrl', 'nutritionPer100g', 'portion']) {
      expect(doc).not.toHaveProperty(key);
    }
  });
});

describe('CosmosUserFoodRelationRepository.setFavorite — displayBrand merge', () => {
  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['null', null as unknown as undefined],
  ])('keeps displayBrand when %s is passed for an existing relation', async (_label, value) => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().setFavorite(USER, FOOD_REF, 'catalog', 'Test Food', value, true);

    expect(lastUpserted().displayBrand).toBe('Brand A');
  });

  it('updates displayBrand with a non-empty value', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().setFavorite(USER, FOOD_REF, 'catalog', 'Test Food', 'Brand B', true);

    expect(lastUpserted().displayBrand).toBe('Brand B');
  });

  it('keeps displayBrand when unfavoriting', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().setFavorite(
      USER, FOOD_REF, 'catalog', 'Test Food', undefined, false,
    );

    expect(lastUpserted()).toMatchObject({ isFavorite: false, displayBrand: 'Brand A' });
  });

  it('stores the brand on a new relation', async () => {
    await new CosmosUserFoodRelationRepository().setFavorite(
      USER, FOOD_REF, 'catalog', 'Test Food', 'Brand A', true,
    );

    expect(lastUpserted()).toMatchObject({ displayBrand: 'Brand A', isFavorite: true, usageCount: 0 });
  });

  it('strips brand and caches for recipe relations', async () => {
    stored = storedRelation();

    await new CosmosUserFoodRelationRepository().setFavorite(
      USER, FOOD_REF, 'recipe', 'Recipe', 'Forged', true, IMAGE, NUTRITION, PORTION,
    );

    const doc = lastUpserted();
    expect(doc.foodRefType).toBe('recipe');
    for (const key of ['displayBrand', 'imageUrl', 'nutritionPer100g', 'portion']) {
      expect(doc).not.toHaveProperty(key);
    }
  });
});

describe('CosmosUserFoodRelationRepository.getByFoodRef — read errors', () => {
  const notFound = () => Object.assign(new Error('Entity not found'), { code: 404 });

  it('returns null when the SDK reports no resource', async () => {
    expect(await new CosmosUserFoodRelationRepository().getByFoodRef(USER, FOOD_REF)).toBeNull();
  });

  it('returns null when the read throws 404', async () => {
    read.mockRejectedValue(notFound());
    expect(await new CosmosUserFoodRelationRepository().getByFoodRef(USER, FOOD_REF)).toBeNull();
  });

  it.each([
    ['5xx', Object.assign(new Error('Service unavailable'), { code: 503 })],
    ['429', Object.assign(new Error('Too many requests'), { code: 429 })],
    ['network error', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })],
    ['plain error', new Error('boom')],
  ])('rethrows %s instead of treating it as missing', async (_label, error) => {
    read.mockRejectedValue(error);
    await expect(new CosmosUserFoodRelationRepository().getByFoodRef(USER, FOOD_REF)).rejects.toBe(error);
  });

  it('setFavorite creates a new relation on 404', async () => {
    read.mockRejectedValue(notFound());

    await new CosmosUserFoodRelationRepository().setFavorite(USER, FOOD_REF, 'catalog', 'Test Food', 'Brand A', true);

    expect(lastUpserted()).toMatchObject({ isFavorite: true, displayBrand: 'Brand A', usageCount: 0 });
  });

  it('setFavorite propagates a transient read error and never upserts', async () => {
    read.mockRejectedValue(Object.assign(new Error('Service unavailable'), { code: 503 }));

    await expect(
      new CosmosUserFoodRelationRepository().setFavorite(USER, FOOD_REF, 'catalog', 'Test Food', undefined, true),
    ).rejects.toThrow('Service unavailable');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('recordUsage creates a new relation on 404', async () => {
    read.mockRejectedValue(notFound());

    await new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput());

    expect(lastUpserted()).toMatchObject({ usageCount: 1, isFavorite: false });
  });

  it('recordUsage stays fire-and-forget on a transient read error and never overwrites the relation', async () => {
    read.mockRejectedValue(Object.assign(new Error('Service unavailable'), { code: 503 }));

    await expect(new CosmosUserFoodRelationRepository().recordUsage(USER, usageInput())).resolves.toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('CosmosUserFoodRelationRepository.updateDisplayDenormalized', () => {
  it('updates brand and name on an existing non-recipe relation and keeps other fields', async () => {
    queryResults = [storedRelation({ foodRefType: 'personal', usageCount: 4 })];

    await new CosmosUserFoodRelationRepository().updateDisplayDenormalized(USER, FOOD_REF, {
      displayName: 'Renamed',
      displayBrand: 'Brand B',
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(lastUpserted()).toMatchObject({
      displayName: 'Renamed',
      displayBrand: 'Brand B',
      isFavorite: true,
      usageCount: 4,
      nutritionPer100g: NUTRITION,
    });
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
  ])('does not clear the brand when %s is passed', async (_label, value) => {
    queryResults = [storedRelation({ foodRefType: 'personal' })];

    await new CosmosUserFoodRelationRepository().updateDisplayDenormalized(USER, FOOD_REF, {
      displayName: 'Renamed',
      displayBrand: value,
    });

    expect(lastUpserted()).toMatchObject({ displayName: 'Renamed', displayBrand: 'Brand A' });
  });

  it('does not write when name and brand are unchanged', async () => {
    queryResults = [storedRelation({ foodRefType: 'personal' })];

    await new CosmosUserFoodRelationRepository().updateDisplayDenormalized(USER, FOOD_REF, {
      displayName: 'Test Food',
      displayBrand: 'Brand A',
    });

    expect(upsert).not.toHaveBeenCalled();
  });

  it('does not create a relation when none exists', async () => {
    await new CosmosUserFoodRelationRepository().updateDisplayDenormalized(USER, FOOD_REF, { displayBrand: 'Brand B' });

    expect(upsert).not.toHaveBeenCalled();
  });

  it('leaves recipe relations untouched', async () => {
    queryResults = [{ ...storedRelation({ foodRefType: 'recipe' }), displayBrand: undefined }];

    await new CosmosUserFoodRelationRepository().updateDisplayDenormalized(USER, FOOD_REF, {
      displayName: 'Renamed',
      displayBrand: 'Forged',
    });

    expect(upsert).not.toHaveBeenCalled();
  });
});
