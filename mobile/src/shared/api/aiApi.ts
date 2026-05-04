// AI API — stub endpoint
import { apiClient } from './client';

export interface AiAnalyzeResponse {
  message: string;
}

export const aiApi = {
  /** POST /api/ai/meal-analyze */
  analyzeMeal(text: string): Promise<AiAnalyzeResponse> {
    return apiClient
      .post<AiAnalyzeResponse>('/ai/meal-analyze', { text })
      .then((r) => r.data);
  },
};
