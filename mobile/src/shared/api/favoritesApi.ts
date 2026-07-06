// favoritesApi — calls /api/favorites and /api/food-relations/recent
import { apiClient } from './client';
import type { UserFoodRelation, UpsertUserFoodRelationInput } from '@fittrack/shared';

export const favoritesApi = {
  /** GET /api/favorites */
  listFavorites(): Promise<UserFoodRelation[]> {
    return apiClient.get<UserFoodRelation[]>('/favorites').then((r) => r.data);
  },

  /** POST /api/favorites */
  addFavorite(input: UpsertUserFoodRelationInput): Promise<UserFoodRelation> {
    return apiClient.post<UserFoodRelation>('/favorites', input).then((r) => r.data);
  },

  /** DELETE /api/favorites/:foodRef */
  removeFavorite(foodRef: string): Promise<void> {
    return apiClient.delete(`/favorites/${encodeURIComponent(foodRef)}`).then(() => undefined);
  },

  /** GET /api/food-relations/recent?limit= */
  listRecent(limit = 10): Promise<UserFoodRelation[]> {
    return apiClient
      .get<UserFoodRelation[]>('/food-relations/recent', { params: { limit } })
      .then((r) => r.data);
  },

  /** GET /api/food-relations/frequent?limit= */
  listFrequent(limit = 10): Promise<UserFoodRelation[]> {
    return apiClient
      .get<UserFoodRelation[]>('/food-relations/frequent', { params: { limit } })
      .then((r) => r.data);
  },
};
