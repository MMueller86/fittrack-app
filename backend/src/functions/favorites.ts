import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { getUserFoodRelationRepository } from '../lib/repositories/userFoodRelationRepository';
import type { FoodRefType } from '@fittrack/shared';

// GET    /api/favorites                -- list all favorites for current user
// POST   /api/favorites                -- add favorite (or update displayName)
// DELETE /api/favorites/:foodRef       -- remove favorite
// GET    /api/food-relations/recent    -- list recently used items (top 10)

const AddFavoriteBodySchema = z.object({
  foodRef: z.string().trim().min(1).max(500),
  foodRefType: z.enum(['catalog', 'personal']),
  displayName: z.string().trim().min(1).max(200),
  displayBrand: z.string().trim().max(200).optional(),
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

app.http('food-relations-recent', {
  methods: ['GET'],
  route: 'food-relations/recent',
  authLevel: 'anonymous',
  handler: listRecentHandler,
});