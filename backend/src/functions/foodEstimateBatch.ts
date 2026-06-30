// Food Estimate Batch endpoint — AI-driven nutrition estimation for multiple unmatched food items.
//
// POST /api/ai/food-estimate/batch
//   Body: { items: Array<{ name: string }> }  (1–10 items)
//   Returns: { results: AiFoodEstimatePreview[] } — same order as input; confidence=0 marks failed items

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { estimateFoodBatch } from '../lib/openai';
import { validateNutritionEstimate } from '../lib/nutritionValidator';
import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { enforceQuota, trackUsage } from '../lib/quota';
import type { AiFoodEstimatePreview } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const FoodEstimateBatchSchema = z.object({
  items: z
    .array(z.object({ name: z.string().trim().min(1, 'name is required').max(200) }))
    .min(1, 'at least one item required')
    .max(10, 'maximum 10 items per batch'),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const foodEstimateBatchHandler = withHandler(
  'ai.food-estimate.batch',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);

    // One quota check for the whole batch
    const quotaBlock = await enforceQuota(userContext, 'food-estimate');
    if (quotaBlock) return quotaBlock;

    const parsed = await parseBody(request, FoodEstimateBatchSchema);
    if (!parsed.ok) return parsed.response;

    const names = parsed.data.items.map((i) => i.name);
    const estimates = await estimateFoodBatch(names);

    const results: AiFoodEstimatePreview[] = [];
    let successCount = 0;

    for (const estimate of estimates) {
      const validation = validateNutritionEstimate({
        calories: estimate.estimatedNutritionPer100g.calories,
        protein: estimate.estimatedNutritionPer100g.protein,
        carbs: estimate.estimatedNutritionPer100g.carbs,
        fat: estimate.estimatedNutritionPer100g.fat,
        fiber: estimate.estimatedNutritionPer100g.fiber ?? undefined,
        salt: estimate.estimatedNutritionPer100g.salt ?? undefined,
      });

      const allWarnings = [...estimate.warnings, ...validation.warnings];

      if (!validation.valid) {
        // Return placeholder with confidence=0 so mobile can identify failed items
        results.push({
          displayName: estimate.displayName,
          estimatedNutritionPer100g: { per: '100g', calories: 0, protein: 0, carbs: 0, fat: 0 },
          estimatedPortion: null,
          category: null,
          sourceProduct: null,
          searchTerms: [],
          confidence: 0,
          warnings: ['KI-Schätzung unplausibel: ' + validation.errors.join(', '), ...allWarnings],
        });
        continue;
      }

      results.push({
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
      });
      successCount++;
    }

    // Track usage once per successfully validated item
    const trackPromises: Promise<void>[] = [];
    for (let i = 0; i < successCount; i++) {
      trackPromises.push(trackUsage(userContext, 'food-estimate'));
    }
    await Promise.all(trackPromises);

    return { status: 200, jsonBody: { results } };
  },
);

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

app.http('ai-food-estimate-batch', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/food-estimate/batch',
  handler: foodEstimateBatchHandler,
});
