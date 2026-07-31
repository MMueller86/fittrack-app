// Handler tests for favorites endpoints.
//
// Uses the real in-memory UserFoodRelation repository (no Cosmos env vars set).
// Covers: POST /api/favorites (recipe type, nutritionPer100g, portion),
//         GET  /api/favorites (new fields present),
//         GET  /api/favorites/grouped (shape, grouping, ungrouped logic).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { addFavoriteHandler, listFavoritesHandler, getFavoritesGroupedHandler } from './favorites';
import { __resetUserFoodRelationRepositoryForTests, getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import { makeContext, makeAuthRequest, setupTestAuth, teardownTestAuth, TEST_USER_ID } from '../test-utils/http';

const ctx = makeContext();

beforeAll(async () => {
  await setupTestAuth();
});

afterAll(() => {
  teardownTestAuth();
});

beforeEach(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
  __resetUserFoodRelationRepositoryForTests();
});

// ---------------------------------------------------------------------------
// POST /api/favorites
// ---------------------------------------------------------------------------

describe('POST /api/favorites', () => {
  it('accepts foodRefType "recipe" and returns 201', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'recipe-uuid-1',
          foodRefType: 'recipe',
          displayName: 'Mein Rezept',
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { foodRefType: string };
    expect(body.foodRefType).toBe('recipe');
  });

  it('stores nutritionPer100g when provided', async () => {
    const nutrition = { calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 3 };
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'openFoodFacts:abc',
          foodRefType: 'catalog',
          displayName: 'Testprodukt',
          nutritionPer100g: nutrition,
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { nutritionPer100g: typeof nutrition };
    expect(body.nutritionPer100g).toMatchObject(nutrition);
  });

  it('stores portion when provided', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'openFoodFacts:abc',
          foodRefType: 'catalog',
          displayName: 'Testprodukt',
          portion: { label: '1 Scheibe', weightGrams: 30 },
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { portion: { label: string; weightGrams: number } };
    expect(body.portion?.weightGrams).toBe(30);
  });

  it('stores portion: null when null is sent', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'openFoodFacts:abc',
          foodRefType: 'catalog',
          displayName: 'Testprodukt',
          portion: null,
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
  });

  it('rejects unknown foodRefType with 400', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'some-ref',
          foodRefType: 'unknown-type',
          displayName: 'Test',
        },
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it('does not generate a shortName when adding a favorite', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'openFoodFacts:xyz',
          foodRefType: 'catalog',
          displayName: 'Some Product',
        },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/favorites
// ---------------------------------------------------------------------------

describe('GET /api/favorites', () => {
  it('returns nutritionPer100g, portion, mealTypeCounts, preferredInputMode, preferredInputAmount for a record that has them', async () => {
    // Add favorite with nutrition
    await addFavoriteHandler(
      await makeAuthRequest({
        body: {
          foodRef: 'openFoodFacts:xyz',
          foodRefType: 'catalog',
          displayName: 'Produkt',
          nutritionPer100g: { calories: 300, protein: 15, carbs: 40, fat: 10 },
          portion: { label: '1 Portion', weightGrams: 50 },
        },
      }),
      ctx,
    );

    // Simulate diary adds to populate mealTypeCounts and preferredInputMode
    const repo = getUserFoodRelationRepository();
    await repo.recordUsage(TEST_USER_ID, {
      foodRef: 'openFoodFacts:xyz',
      foodRefType: 'catalog',
      displayName: 'Produkt',
      lastInputMode: 'portion',
      lastInputAmount: 1,
      mealType: 'breakfast',
    });

    const res = await listFavoritesHandler(
      await makeAuthRequest(),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as Array<{
      nutritionPer100g?: unknown;
      portion?: unknown;
      preferredInputMode?: string;
      preferredInputAmount?: number;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]!.nutritionPer100g).toBeDefined();
    expect(body[0]!.portion).toBeDefined();
    expect(body[0]!.preferredInputMode).toBe('portion');
    expect(body[0]!.preferredInputAmount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/favorites/grouped
// ---------------------------------------------------------------------------

describe('GET /api/favorites/grouped', () => {
  it('returns QuickEntryGroupedResponse shape with ungrouped, groups, all', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );

    const res = await getFavoritesGroupedHandler(await makeAuthRequest(), ctx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { ungrouped: unknown[]; groups: unknown[]; all: unknown[] };
    expect(Array.isArray(body.ungrouped)).toBe(true);
    expect(Array.isArray(body.groups)).toBe(true);
    expect(Array.isArray(body.all)).toBe(true);
  });

  it('puts entries with no mealTypeCounts into ungrouped', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );

    const res = await getFavoritesGroupedHandler(await makeAuthRequest(), ctx);
    const body = res.jsonBody as { ungrouped: Array<{ foodRef: string }>; groups: unknown[] };
    expect(body.ungrouped).toHaveLength(1);
    expect(body.ungrouped[0]!.foodRef).toBe('openFoodFacts:a');
    expect(body.groups).toHaveLength(0);
  });

  it('puts entries into ungrouped (mealTypeCounts no longer tracked)', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );

    const repo = getUserFoodRelationRepository();
    await repo.recordUsage(TEST_USER_ID, {
      foodRef: 'openFoodFacts:a',
      foodRefType: 'catalog',
      displayName: 'Apple',
      mealType: 'breakfast',
    });

    const res = await getFavoritesGroupedHandler(await makeAuthRequest(), ctx);
    const body = res.jsonBody as { ungrouped: Array<{ foodRef: string }>; groups: unknown[] };
    expect(body.ungrouped).toHaveLength(1);
    expect(body.ungrouped[0]!.foodRef).toBe('openFoodFacts:a');
    // groups is always empty since mealTypeCounts is no longer tracked
    expect(body.groups).toHaveLength(0);
  });

  it('groups is always empty (mealTypeCounts no longer written)', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );

    const repo = getUserFoodRelationRepository();
    await repo.recordUsage(TEST_USER_ID, {
      foodRef: 'openFoodFacts:a',
      foodRefType: 'catalog',
      displayName: 'Apple',
      mealType: 'breakfast',
    });
    await repo.recordUsage(TEST_USER_ID, {
      foodRef: 'openFoodFacts:a',
      foodRefType: 'catalog',
      displayName: 'Apple',
      mealType: 'snack',
    });

    const res = await getFavoritesGroupedHandler(await makeAuthRequest(), ctx);
    const body = res.jsonBody as { groups: unknown[] };
    expect(body.groups).toHaveLength(0);
  });

  it('all contains every favorite', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:b', foodRefType: 'catalog', displayName: 'Banana' },
      }),
      ctx,
    );

    const repo = getUserFoodRelationRepository();
    await repo.recordUsage(TEST_USER_ID, {
      foodRef: 'openFoodFacts:a',
      foodRefType: 'catalog',
      displayName: 'Apple',
      mealType: 'breakfast',
    });

    const res = await getFavoritesGroupedHandler(await makeAuthRequest(), ctx);
    const body = res.jsonBody as { all: Array<{ foodRef: string }> };
    expect(body.all).toHaveLength(2);
    const refs = body.all.map(e => e.foodRef);
    expect(refs).toContain('openFoodFacts:a');
    expect(refs).toContain('openFoodFacts:b');
  });
});

// ---------------------------------------------------------------------------
// favoritedAt timestamp behaviour
// ---------------------------------------------------------------------------

describe('favoritedAt', () => {
  it('is set to a valid ISO-8601 string when a new relation is favorited', async () => {
    const res = await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:fav-new', foodRefType: 'catalog', displayName: 'New Item' },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = res.jsonBody as { favoritedAt?: string };
    expect(typeof body.favoritedAt).toBe('string');
    expect(Number.isNaN(new Date(body.favoritedAt!).getTime())).toBe(false);
  });

  it('is not overwritten when setFavorite is called a second time', async () => {
    const repo = getUserFoodRelationRepository();
    const first = await repo.setFavorite(TEST_USER_ID, 'openFoodFacts:fav-twice', 'catalog', 'Twice Item', undefined, true);
    const second = await repo.setFavorite(TEST_USER_ID, 'openFoodFacts:fav-twice', 'catalog', 'Twice Item', undefined, true);
    expect(first.favoritedAt).toBeDefined();
    expect(second.favoritedAt).toBe(first.favoritedAt);
  });

  it('is preserved when isFavorite is set to false', async () => {
    const repo = getUserFoodRelationRepository();
    const favorited = await repo.setFavorite(TEST_USER_ID, 'openFoodFacts:fav-unset', 'catalog', 'Unfav Item', undefined, true);
    expect(favorited.favoritedAt).toBeDefined();
    const unfavorited = await repo.setFavorite(TEST_USER_ID, 'openFoodFacts:fav-unset', 'catalog', 'Unfav Item', undefined, false);
    expect(unfavorited.favoritedAt).toBe(favorited.favoritedAt);
  });
});

// ---------------------------------------------------------------------------
// GET /api/favorites?context=<mealType>
// ---------------------------------------------------------------------------

describe('GET /api/favorites — context param', () => {
  it('without context → returns UserFoodRelation[] directly (backward compat)', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );
    const res = await listFavoritesHandler(await makeAuthRequest(), ctx);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('GET /api/favorites?context=lunch → returns { items, context: "lunch" }', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:a', foodRefType: 'catalog', displayName: 'Apple' },
      }),
      ctx,
    );
    const res = await listFavoritesHandler(
      await makeAuthRequest({ query: { context: 'lunch' } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { items: unknown[]; context: string };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.context).toBe('lunch');
  });

  it('GET /api/favorites?context=invalid → 400', async () => {
    const res = await listFavoritesHandler(
      await makeAuthRequest({ query: { context: 'invalid' } }),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = res.jsonBody as { error: string };
    expect(body.error).toMatch(/invalid context/i);
  });

  it('GET /api/favorites?context=breakfast → correct response shape', async () => {
    await addFavoriteHandler(
      await makeAuthRequest({
        body: { foodRef: 'openFoodFacts:b', foodRefType: 'catalog', displayName: 'Banana' },
      }),
      ctx,
    );
    const res = await listFavoritesHandler(
      await makeAuthRequest({ query: { context: 'breakfast' } }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = res.jsonBody as { items: Array<{ foodRef: string }>; context: string };
    expect(body.context).toBe('breakfast');
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.foodRef).toBe('openFoodFacts:b');
  });
});
