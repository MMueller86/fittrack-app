// Food Estimate endpoint — AI-driven nutrition estimation for unmatched food items.
//
// POST /api/ai/food-estimate/preview
//   Body: { name: string, contextText?: string }
//   Returns: AiFoodEstimatePreview (estimate + confidence + warnings)
//   No data is persisted by this endpoint. User must confirm before saving.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { estimateFood } from '../lib/openai';
import { validateNutritionEstimate } from '../lib/nutritionValidator';
import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { enforceQuota, trackUsage } from '../lib/quota';
import type { AiFoodEstimatePreview } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const FoodEstimateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  contextText: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Handler — exported for tests
// ---------------------------------------------------------------------------

export const foodEstimatePreviewHandler = withHandler(
  'ai.food-estimate.preview',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);

    // Quota enforcement — check before expensive AI call
    const quotaBlock = await enforceQuota(userContext, 'food-estimate');
    if (quotaBlock) return quotaBlock;

    const parsed = await parseBody(request, FoodEstimateSchema);
    if (!parsed.ok) return parsed.response;

    const { name, contextText } = parsed.data;

    // Call Azure OpenAI
    const estimate = await estimateFood({ name, contextText });

    // Server-side plausibility validation — hard gate for hallucinated values
    const validation = validateNutritionEstimate({
      calories: estimate.estimatedNutritionPer100g.calories,
      protein: estimate.estimatedNutritionPer100g.protein,
      carbs: estimate.estimatedNutritionPer100g.carbs,
      fat: estimate.estimatedNutritionPer100g.fat,
      fiber: estimate.estimatedNutritionPer100g.fiber ?? undefined,
      salt: estimate.estimatedNutritionPer100g.salt ?? undefined,
    });

    if (!validation.valid) {
      // AI returned implausible values — reject rather than passing garbage to client
      return {
        status: 422,
        jsonBody: {
          error: 'AI estimate failed plausibility checks',
          details: validation.errors,
        },
      };
    }

    // Merge validator soft warnings into AI warnings
    const allWarnings = [...estimate.warnings, ...validation.warnings];

    const preview: AiFoodEstimatePreview = {
      displayName: estimate.displayName,
      estimatedNutritionPer100g: {
        per: '100g',
        calories: estimate.estimatedNutritionPer100g.calories,
        protein: estimate.estimatedNutritionPer100g.protein,
        carbs: estimate.estimatedNutritionPer100g.carbs,
        fat: estimate.estimatedNutritionPer100g.fat,
        ...(estimate.estimatedNutritionPer100g.fiber != null && {
          fiber: estimate.estimatedNutritionPer100g.fiber,
        }),
        ...(estimate.estimatedNutritionPer100g.salt != null && {
          salt: estimate.estimatedNutritionPer100g.salt,
        }),
      },
      estimatedPortion: estimate.estimatedPortion
        ? {
            label: estimate.estimatedPortion.label,
            weightGrams: estimate.estimatedPortion.weightGrams,
            ...(estimate.estimatedPortion.suggestedAmount != null && {
              suggestedAmount: estimate.estimatedPortion.suggestedAmount,
            }),
          }
        : null,
      category: estimate.category,
      sourceProduct: estimate.sourceProduct ?? null,
      searchTerms: estimate.searchTerms ?? [],
      confidence: Math.min(1, Math.max(0, estimate.confidence)),
      warnings: allWarnings,
    };

    // Track usage AFTER successful AI call
    await trackUsage(userContext, 'food-estimate');

    return { status: 200, jsonBody: preview };
  },
);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

app.http('ai-food-estimate-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/food-estimate/preview',
  handler: foodEstimatePreviewHandler,
});
