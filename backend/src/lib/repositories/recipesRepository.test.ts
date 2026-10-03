import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateRecipeInput } from './recipesRepository';
import { __resetRecipesRepositoryForTests, getRecipesRepository } from './recipesRepository';

const zeroNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const input: CreateRecipeInput = {
  name: 'Test recipe',
  portions: 1,
  ingredients: [],
  steps: [],
  tags: [],
  nutritionTotal: zeroNutrition,
  nutritionPerPortion: zeroNutrition,
};

beforeEach(() => {
  vi.stubEnv('COSMOS_ENDPOINT', '');
  vi.stubEnv('COSMOS_KEY', '');
  __resetRecipesRepositoryForTests();
});

afterEach(() => {
  __resetRecipesRepositoryForTests();
  vi.unstubAllEnvs();
});

describe('in-memory recipe revisions', () => {
  it('compares and replaces atomically, rejecting stale revisions without partial writes', async () => {
    const repo = getRecipesRepository();
    const created = await repo.createVersioned('user-1', input);

    expect(created.etag).toMatch(/^".+"$/);

    const committed = await repo.compareAndReplace('user-1', created.recipe.id, created.etag, {
      name: 'Committed name',
    });
    expect(committed?.recipe.name).toBe('Committed name');
    expect(committed?.etag).not.toBe(created.etag);

    const stale = await repo.compareAndReplace('user-1', created.recipe.id, created.etag, {
      name: 'Must not persist',
    });
    expect(stale).toBeNull();

    const current = await repo.getVersioned('user-1', created.recipe.id);
    expect(current?.recipe.name).toBe('Committed name');
    expect(current?.etag).toBe(committed?.etag);
  });
});