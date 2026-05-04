import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Stub the Cosmos repositories so unit tests run without a DB connection.
vi.mock('./cosmosDiaryRepository', () => ({
  CosmosDiaryRepository: class {
    async getDay() { return { meals: [], summary: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 } }; }
    async createMeal(i: { userId: string; date: string; type: string; name: string }) {
      return { id: 'mock-id', items: [], createdAt: new Date().toISOString(), ...i };
    }
    async addItem() { return { id: 'mock-id', items: [] }; }
    async deleteItem() { return null; }
    async deleteMeal() { return false; }
  },
}));

import {
  getDiaryRepository,
  computeSummary,
  __resetDiaryRepositoryForTests,
} from './diaryRepository';
import type { Meal } from '@fittrack/shared';

const originalEnv = { ...process.env };

beforeEach(() => {
  __resetDiaryRepositoryForTests();
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
  __resetDiaryRepositoryForTests();
});

// --- Factory selection ---

describe('getDiaryRepository (factory)', () => {
  it('returns in-memory repo when Cosmos is not configured', () => {
    expect(getDiaryRepository().constructor.name).toBe('InMemoryDiaryRepository');
  });

  it('returns Cosmos repo when both env vars are set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';
    process.env.COSMOS_KEY = 'fake-key';
    expect(getDiaryRepository().constructor.name).toBe('CosmosDiaryRepository');
  });

  it('caches the instance', () => {
    const a = getDiaryRepository();
    const b = getDiaryRepository();
    expect(a).toBe(b);
  });
});

// --- computeSummary ---

describe('computeSummary', () => {
  it('returns zero summary for empty meals array', () => {
    const s = computeSummary([]);
    expect(s).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  });

  it('sums macros across all meals and items', () => {
    const meals: Meal[] = [
      {
        id: 'm1', userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast',
        createdAt: '', items: [
          { id: 'i1', name: 'Oats', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 300, proteinG: 10, carbsG: 50, fatG: 5, fiberG: 4 } },
        ],
      },
      {
        id: 'm2', userId: 'u', date: '2026-05-04', type: 'lunch', name: 'Lunch',
        createdAt: '', items: [
          { id: 'i2', name: 'Chicken', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 250, proteinG: 40, carbsG: 0, fatG: 6, fiberG: 0 } },
          { id: 'i3', name: 'Rice', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 200, proteinG: 4, carbsG: 45, fatG: 0.5, fiberG: 1 } },
        ],
      },
    ];
    const s = computeSummary(meals);
    expect(s.calories).toBe(750);
    expect(s.proteinG).toBe(54);
    expect(s.carbsG).toBe(95);
    expect(s.fatG).toBe(11.5);
    expect(s.fiberG).toBe(5);
  });

  it('rounds to 1 decimal to avoid floating-point noise', () => {
    const meals: Meal[] = [
      {
        id: 'm1', userId: 'u', date: '2026-05-04', type: 'snack', name: 'Snack',
        createdAt: '', items: [
          { id: 'i1', name: 'A', sourceType: 'manual', quantity: 1, unit: 'serving',
            macros: { calories: 100.123, proteinG: 10.456, carbsG: 20.789, fatG: 5.111, fiberG: 2.999 } },
        ],
      },
    ];
    const s = computeSummary(meals);
    expect(s.calories).toBe(100.1);
    expect(s.proteinG).toBe(10.5);
    expect(s.carbsG).toBe(20.8);
    expect(s.fatG).toBe(5.1);
    expect(s.fiberG).toBe(3);
  });
});

// --- InMemoryDiaryRepository ---

describe('InMemoryDiaryRepository (via factory)', () => {
  it('returns empty day for new user', async () => {
    const repo = getDiaryRepository();
    const result = await repo.getDay('user-1', '2026-05-04');
    expect(result.meals).toEqual([]);
    expect(result.summary.calories).toBe(0);
  });

  it('createMeal returns meal with correct fields', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({
      userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast',
    });
    expect(meal.id).toBeTruthy();
    expect(meal.type).toBe('breakfast');
    expect(meal.items).toEqual([]);
  });

  it('getDay returns created meals for that date only', async () => {
    const repo = getDiaryRepository();
    await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'Breakfast' });
    await repo.createMeal({ userId: 'u', date: '2026-05-05', type: 'lunch', name: 'Lunch' });
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.meals).toHaveLength(1);
    expect(day.meals[0].date).toBe('2026-05-04');
  });

  it('addItem appends item and updates summary', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'breakfast', name: 'B' });
    const updated = await repo.addItem('u', meal.id, {
      name: 'Egg', calories: 90, proteinG: 6, carbsG: 0, fatG: 6, fiberG: 0,
    });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].name).toBe('Egg');
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.summary.calories).toBe(90);
  });

  it('deleteItem removes item from meal', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'lunch', name: 'L' });
    const withItem = await repo.addItem('u', meal.id, {
      name: 'Bread', calories: 80, proteinG: 3, carbsG: 15, fatG: 1, fiberG: 1,
    });
    const itemId = withItem.items[0].id;
    const after = await repo.deleteItem('u', meal.id, itemId);
    expect(after?.items).toHaveLength(0);
  });

  it('deleteItem returns null for unknown item', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'dinner', name: 'D' });
    const result = await repo.deleteItem('u', meal.id, 'nonexistent');
    expect(result).toBeNull();
  });

  it('deleteMeal removes the meal', async () => {
    const repo = getDiaryRepository();
    const meal = await repo.createMeal({ userId: 'u', date: '2026-05-04', type: 'snack', name: 'S' });
    const deleted = await repo.deleteMeal('u', meal.id);
    expect(deleted).toBe(true);
    const day = await repo.getDay('u', '2026-05-04');
    expect(day.meals).toHaveLength(0);
  });

  it('deleteMeal returns false for unknown id', async () => {
    const repo = getDiaryRepository();
    expect(await repo.deleteMeal('u', 'missing')).toBe(false);
  });

  it('isolates data per user', async () => {
    const repo = getDiaryRepository();
    await repo.createMeal({ userId: 'user-A', date: '2026-05-04', type: 'breakfast', name: 'B' });
    const dayB = await repo.getDay('user-B', '2026-05-04');
    expect(dayB.meals).toHaveLength(0);
  });
});
