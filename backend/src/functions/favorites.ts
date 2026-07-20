import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import type { FoodRefType, MealType, UserFoodRelation } from '@fittrack/shared';

// GET    /api/favorites                -- list all favorites for current user
// POST   /api/favorites                -- add favorite (or update displayName)
// DELETE /api/favorites/:foodRef       -- remove favorite
// GET    /api/favorites/grouped        -- grouped favorites for Quick Entry
// GET    /api/food-relations/recent    -- list recently used items (top 10)

const AddFavoriteBodySchema = z.object({
  foodRef: z.string().trim().min(1).max(500),
  foodRefType: z.enum(['catalog', 'personal', 'recipe']),
  displayName: z.string().trim().min(1).max(200),
  displayBrand: z.string().trim().max(200).optional(),
  imageUrl: z.string().url().max(1000).optional().nullable(),
  nutritionPer100g: z.object({
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    fiber: z.number().nonnegative().optional(),
    salt: z.number().nonnegative().optional(),
    sugar: z.number().nonnegative().optional(),
    saturatedFat: z.number().nonnegative().optional(),
  }).optional(),
  portion: z.object({
    label: z.string().trim().min(1).max(100).optional(),
    weightGrams: z.number().positive(),
  }).optional().nullable(),
});

// GET /api/favorites
export const listFavoritesHandler = withHandler(
  'favorites.list',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const repo = getUserFoodRelationRepository();
    const favorites = await repo.listFavorites(userId);
    logEvent(ctx, 'info', 'favorites.list', { count: favorites.length });
    return { status: 200, jsonBody: favorites };
  },
);

// POST /api/favorites
export const addFavoriteHandler = withHandler(
  'favorites.add',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, AddFavoriteBodySchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const repo = getUserFoodRelationRepository();
    const relation = await repo.setFavorite(
      userId,
      body.foodRef,
      body.foodRefType as FoodRefType,
      body.displayName,
      body.displayBrand,
      true,
      body.imageUrl ?? undefined,
      body.nutritionPer100g,
      body.portion ? { label: body.portion.label ?? '', weightGrams: body.portion.weightGrams } : body.portion,
    );
    logEvent(ctx, 'info', 'favorites.add', { foodRef: body.foodRef });

    return { status: 201, jsonBody: relation };
  },
);

// DELETE /api/favorites/:foodRef
export const removeFavoriteHandler = withHandler(
  'favorites.remove',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const rawFoodRef = request.params.foodRef;
    if (!rawFoodRef) {
      return { status: 400, jsonBody: { error: 'foodRef is required' } };
    }
    const repo = getUserFoodRelationRepository();
    const existing = await repo.getByFoodRef(userId, rawFoodRef);
    if (!existing) {
      return { status: 404, jsonBody: { error: 'Relation not found' } };
    }
    await repo.setFavorite(userId, rawFoodRef, existing.foodRefType, existing.displayName, existing.displayBrand, false);
    logEvent(ctx, 'info', 'favorites.remove', { foodRef: rawFoodRef });
    return { status: 204 };
  },
);

// GET /api/food-relations/recent
export const listRecentHandler = withHandler(
  'foodRelations.recent',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const limitParam = request.query.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;
    const repo = getUserFoodRelationRepository();
    const recent = await repo.listRecent(userId, limit);
    logEvent(ctx, 'info', 'foodRelations.recent', { count: recent.length });
    return { status: 200, jsonBody: recent };
  },
);

// GET /api/food-relations/frequent
export const listFrequentHandler = withHandler(
  'foodRelations.frequent',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const limitParam = request.query.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;
    const repo = getUserFoodRelationRepository();
    const frequent = await repo.listFrequent(userId, limit);
    logEvent(ctx, 'info', 'foodRelations.frequent', { count: frequent.length });
    return { status: 200, jsonBody: frequent };
  },
);

// Sorts favorites: usageCount DESC → lastUsedAt DESC → displayName ASC (German locale)
function sortFavorites(favorites: UserFoodRelation[]): UserFoodRelation[] {
  return [...favorites].sort((a, b) => {
    const usageDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    if (usageDiff !== 0) return usageDiff;
    const lastUsedDiff = (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '');
    if (lastUsedDiff !== 0) return lastUsedDiff;
    return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de');
  });
}

// GET /api/favorites/grouped
export const getFavoritesGroupedHandler = withHandler(
  'favorites.grouped',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const repo = getUserFoodRelationRepository();
    const favorites = await repo.listFavorites(userId);

    const all = sortFavorites(favorites);

    const hasAnyMealCounts = (rel: UserFoodRelation): boolean => {
      if (!rel.mealTypeCounts) return false;
      return Object.values(rel.mealTypeCounts).some(v => (v ?? 0) > 0);
    };

    const ungrouped = all.filter(r => !hasAnyMealCounts(r));
    const withMealCounts = all.filter(hasAnyMealCounts);

    const mealTypeLabels: Record<MealType, string> = {
      breakfast: 'Frühstück',
      lunch: 'Mittagessen',
      dinner: 'Abendessen',
      snack: 'Snack',
      preworkout: 'Pre-Workout',
      postworkout: 'Post-Workout',
    };

    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'];

    const groups = mealTypes
      .map(mealType => ({
        mealType,
        label: mealTypeLabels[mealType],
        entries: withMealCounts
          .filter(r => (r.mealTypeCounts?.[mealType] ?? 0) > 0)
          .sort((a, b) => {
            const countDiff = (b.mealTypeCounts?.[mealType] ?? 0) - (a.mealTypeCounts?.[mealType] ?? 0);
            if (countDiff !== 0) return countDiff;
            const usageDiff = (b.usageCount ?? 0) - (a.usageCount ?? 0);
            if (usageDiff !== 0) return usageDiff;
            return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'de');
          }),
      }))
      .filter(g => g.entries.length > 0);

    logEvent(ctx, 'info', 'favorites.grouped', { userId, total: all.length, groups: groups.length });
    return { status: 200, jsonBody: { ungrouped, groups, all } };
  },
);

// Azure Functions registrations

app.http('favorites-list', {
  methods: ['GET'],
  route: 'favorites',
  authLevel: 'anonymous',
  handler: listFavoritesHandler,
});

app.http('favorites-add', {
  methods: ['POST'],
  route: 'favorites',
  authLevel: 'anonymous',
  handler: addFavoriteHandler,
});

app.http('favorites-remove', {
  methods: ['DELETE'],
  route: 'favorites/{foodRef}',
  authLevel: 'anonymous',
  handler: removeFavoriteHandler,
});

app.http('favorites-grouped', {
  methods: ['GET'],
  route: 'favorites/grouped',
  authLevel: 'anonymous',
  handler: getFavoritesGroupedHandler,
});

app.http('food-relations-recent', {
  methods: ['GET'],
  route: 'food-relations/recent',
  authLevel: 'anonymous',
  handler: listRecentHandler,
});

app.http('food-relations-frequent', {
  methods: ['GET'],
  route: 'food-relations/frequent',
  authLevel: 'anonymous',
  handler: listFrequentHandler,
});