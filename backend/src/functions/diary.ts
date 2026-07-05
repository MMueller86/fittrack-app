import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { calculate, NutritionCalculationError } from '../lib/nutritionCalculator';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';
import { getDayMetaRepository } from '../lib/repositories/dayMetaRepository';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getProfileRepository } from '../lib/repositories/profileRepository';
import { getHintStateRepository } from '../lib/repositories/hintStateRepository';
import { evaluateHint } from '../lib/hintEngine';
import type { DayTargets } from '../../../shared/types/nutrition';

// GET    /api/diary?date=YYYY-MM-DD             — meals + day summary + dayType
// PUT    /api/diary/{date}/day-type             — set rest/training day type
// POST   /api/diary/meals                        — create meal
// DELETE /api/diary/meals/:id                    — delete meal + items
// POST   /api/diary/meals/:id/items              — add item (flat macros OR quantityMode+source)
// DELETE /api/diary/meals/:id/items/:itemId      — remove item

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    const [y, m, day] = v.split('-').map(Number);
    return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
  }, { message: 'must be a real calendar date' });

const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout']);

const CreateMealSchema = z.object({
  date: isoDate,
  type: MealTypeSchema,
  name: z.string().trim().min(1).max(100).optional(),
});

const positiveNumber = z.coerce.number().refine(
  (n) => Number.isFinite(n) && n >= 0,
  { message: 'must be a non-negative number' },
);

const NutritionValuesSchema = z.object({
  calories: positiveNumber,
  protein: positiveNumber,
  carbs: positiveNumber,
  fat: positiveNumber,
  fiber: positiveNumber.optional(),
});

// Two accepted shapes for addItem:
// 1. Flat macros (manual entry): { name, calories, protein, carbs, fat, fiber }
// 2. Calculated (from search): { name, quantityMode, quantity, nutritionPer100g?, portionNutrition? }
// 3. Product input (mobile product picker): { productId, productName, inputMode, inputAmount, amountGrams, calculatedNutrition }
// 4. AI meal estimate (fast path): { name, calories, protein, carbs, fat, fiber, sourceType: 'ai-meal-estimate', aiMealEstimate* }
const AddItemSchema = z
  .object({
    // --- Name: either explicit (manual/calculated) or derived from productName ---
    name: z.string().trim().min(1).max(200).optional(),
    unit: z.string().trim().max(50).optional(),
    // Flat macros (optional for backward compat — required if no quantityMode/calculatedNutrition)
    calories: positiveNumber.optional(),
    protein: positiveNumber.optional(),
    carbs: positiveNumber.optional(),
    fat: positiveNumber.optional(),
    fiber: positiveNumber.optional(),
    // Calculated path (legacy)
    quantityMode: z.enum(['grams', 'portions']).optional(),
    quantity: z.coerce.number().positive().optional(),
    nutritionPer100g: NutritionValuesSchema.optional(),
    portionNutrition: NutritionValuesSchema.optional(),
    // Product input path (mobile product picker)
    productId: z.string().trim().min(1).optional(),
    productName: z.string().trim().min(1).max(200).optional(),
    inputMode: z.enum(['grams', 'portion']).optional(),
    inputAmount: z.coerce.number().positive().optional(),
    amountGrams: z.coerce.number().positive().optional(),
    calculatedNutrition: NutritionValuesSchema.optional(),
    // AI estimate flag
    isAiEstimate: z.boolean().optional(),
    // AI meal estimate metadata (fast path, sourceType === 'ai-meal-estimate')
    sourceType: z.enum(['manual', 'reusableItem', 'openFoodFacts', 'ai', 'ai-meal-estimate', 'recipe']).optional(),
    category: z.string().optional(),
    aiMealEstimateComponents: z.array(z.string()).optional(),
    aiMealEstimateContext: z.string().trim().max(100).optional(),
    aiMealEstimateConfidence: z.enum(['high', 'medium', 'low']).optional(),
    aiMealEstimateAssumptions: z.array(z.string()).optional(),
    aiMealEstimatePhotoUsed: z.boolean().optional(),
  })
  .refine(
    (d) => {
      const hasFlat = d.calories != null && d.protein != null && d.carbs != null && d.fat != null;
      const hasCalculated = d.quantityMode != null && d.quantity != null;
      const hasProduct = d.productName != null && d.amountGrams != null && d.calculatedNutrition != null;
      const hasName = d.name != null || d.productName != null;
      return hasName && (hasFlat || hasCalculated || hasProduct);
    },
    { message: 'Either flat macros, quantityMode+quantity, or productName+amountGrams+calculatedNutrition must be provided' },
  );

// GET /api/diary?date=YYYY-MM-DD
export const getDiaryHandler = withHandler(
  'diary.get',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const date = request.query.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: 400, jsonBody: { error: 'Query param "date" must be YYYY-MM-DD' } };
    }
    const localHour = parseInt(request.query.get('localHour') ?? '12', 10);
    const currentHour = Number.isFinite(localHour) && localHour >= 0 && localHour <= 23 ? localHour : 12;

    const diaryRepo = getDiaryRepository();

    // Load last 3 completed days for multi-day calorie trend (H25/H26)
    const today = new Date(date + 'T00:00:00Z');
    const recentDayDates = [1, 2, 3].map((i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      return d.toISOString().slice(0, 10);
    });

    const [result, dayMeta, profile, hintState, ...recentDays] = await Promise.all([
      diaryRepo.getDay(userId, date),
      getDayMetaRepository().get(userId, date),
      getProfileRepository().get(userId),
      getHintStateRepository().get(userId),
      ...recentDayDates.map((d) => diaryRepo.getDay(userId, d)),
    ]);

    // Resolve targets for the effective day type
    const resolvedDayType = dayMeta?.dayType ?? 'rest';
    const fallbackTargets: DayTargets = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, fiberG: 25 };
    const targets: DayTargets = profile?.targets
      ? (resolvedDayType === 'training' ? profile.targets.trainingDay : profile.targets.restDay)
      : fallbackTargets;

    // Calorie % for each recent day (only include days that have actual entries)
    const recentDaysCaloriesPct = recentDays
      .map((d) => (d.summary.calories > 0 && targets.calories > 0 ? (d.summary.calories / targets.calories) * 100 : null))
      .filter((v): v is number => v !== null);

    // Evaluate hint — pure function, no I/O
    const { hint, updatedState } = evaluateHint(
      {
        meals: result.meals,
        summary: result.summary,
        targets,
        dayType: resolvedDayType,
        currentHour,
        bmr: profile?.calculationMeta?.bmr,
        weightKg: profile?.weightKg,
        recentDaysCaloriesPct,
      },
      hintState,
    );

    // Persist updated state only when hint changed (avoid write amplification)
    const hintChanged =
      hintState === null ||
      hintState.lastHintId !== hint.id ||
      hintState.lastHintDate !== date;
    if (hintChanged) {
      updatedState.userId = userId;
      getHintStateRepository().upsert(userId, updatedState).catch(() => {
        // Non-critical — hint will be re-evaluated on next request
      });
    }

    logEvent(ctx, 'info', 'diary.get', { userId, date, mealCount: result.meals.length, hintId: hint.id });
    return {
      status: 200,
      jsonBody: {
        ...result,
        dayType: dayMeta?.dayType ?? null,
        workoutType: dayMeta?.workoutType ?? null,
        hint,
      },
    };
  },
);

// PUT /api/diary/{date}/day-type
export const setDayTypeHandler = withHandler(
  'diary.dayType.set',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const date = request.params.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: 400, jsonBody: { error: 'Route param "date" must be YYYY-MM-DD' } };
    }
    const parsed = await parseBody(request, z.object({
      dayType: z.enum(['rest', 'training']),
      workoutType: z.enum(['gym', 'bouldering', 'running', 'cycling', 'other']).nullable().optional(),
    }));
    if (!parsed.ok) return parsed.response;

    const { dayType, workoutType } = parsed.data;
    // When switching to rest, clear workoutType
    const resolvedWorkoutType = dayType === 'rest' ? null : (workoutType ?? undefined);
    const dayMeta = await getDayMetaRepository().upsert(userId, date, dayType, resolvedWorkoutType);
    logEvent(ctx, 'info', 'diary.dayType.set', { userId, date, dayType, workoutType: resolvedWorkoutType ?? null });
    return { status: 200, jsonBody: { dayMeta } };
  },
);

// POST /api/diary/meals
export const createMealHandler = withHandler(
  'diary.meals.create',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const parsed = await parseBody(request, CreateMealSchema);
    if (!parsed.ok) return parsed.response;

    const mealTypeName = parsed.data.type.charAt(0).toUpperCase() + parsed.data.type.slice(1);
    const meal = await getDiaryRepository().createMeal({
      userId,
      date: parsed.data.date,
      type: parsed.data.type,
      name: parsed.data.name ?? mealTypeName,
    });
    logEvent(ctx, 'info', 'diary.meal.created', { userId, mealId: meal.id, type: meal.type });
    return { status: 201, jsonBody: { meal } };
  },
);

// DELETE /api/diary/meals/:id
export const deleteMealHandler = withHandler(
  'diary.meals.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const mealId = request.params['id'];
    if (!mealId) return { status: 400, jsonBody: { error: 'Missing meal id' } };

    const deleted = await getDiaryRepository().deleteMeal(userId, mealId);
    if (!deleted) return { status: 404, jsonBody: { error: 'Meal not found' } };
    logEvent(ctx, 'info', 'diary.meal.deleted', { userId, mealId });
    return { status: 204 };
  },
);

// POST /api/diary/meals/:id/items
export const addItemHandler = withHandler(
  'diary.items.add',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const mealId = request.params['id'];
    if (!mealId) return { status: 400, jsonBody: { error: 'Missing meal id' } };

    const parsed = await parseBody(request, AddItemSchema);
    if (!parsed.ok) return parsed.response;

    const d = parsed.data;

    // Resolve the display name: explicit > productName
    const itemName = d.name ?? d.productName!;

    // Resolve macros — priority:
    // 1. productId → load ReusableItem from DB → server-side calculation (authoritative)
    // 2. calculatedNutrition from client (fallback: OpenFoodFacts items, legacy clients)
    // 3. quantityMode + nutritionPer100g (legacy calculated path)
    // 4. Flat macros (manual one-off entry)
    let macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number };

    if (d.productId && d.amountGrams != null) {
      // Priority 1: Try to resolve nutrition server-side from stored ReusableItem
      const product = await getReusableItemsRepository().getById(userId, d.productId);
      if (product?.nutritionPer100g) {
        const n = product.nutritionPer100g;
        const scale = d.amountGrams / 100;
        macros = {
          calories: Math.round(n.calories * scale * 10) / 10,
          protein:  Math.round((n.protein  ?? 0) * scale * 10) / 10,
          carbs:    Math.round((n.carbs    ?? 0) * scale * 10) / 10,
          fat:      Math.round((n.fat      ?? 0) * scale * 10) / 10,
          fiber:    Math.round((n.fiber    ?? 0) * scale * 10) / 10,
        };
        logEvent(ctx, 'info', 'diary.item.macrosFromProduct', { productId: d.productId });
        // Increment usageCount so the item floats to the top of the "recently used" list.
        // Fire-and-forget — errors are swallowed inside incrementUsageCount.
        void getReusableItemsRepository().incrementUsageCount(userId, d.productId);
      } else if (d.calculatedNutrition != null) {
        // Fallback: productId given but not a stored ReusableItem (e.g. OpenFoodFacts)
        macros = {
          calories: d.calculatedNutrition.calories,
          protein:  d.calculatedNutrition.protein,
          carbs:    d.calculatedNutrition.carbs,
          fat:      d.calculatedNutrition.fat,
          fiber:    d.calculatedNutrition.fiber ?? 0,
        };
      } else {
        return { status: 400, jsonBody: { error: 'Product not found and no calculatedNutrition provided' } };
      }
    } else if (d.amountGrams != null && d.calculatedNutrition != null) {
      // Priority 2: Client-provided nutrition (no productId — e.g. direct OpenFoodFacts add)
      macros = {
        calories: d.calculatedNutrition.calories,
        protein:  d.calculatedNutrition.protein,
        carbs:    d.calculatedNutrition.carbs,
        fat:      d.calculatedNutrition.fat,
        fiber:    d.calculatedNutrition.fiber ?? 0,
      };
    } else if (d.quantityMode != null && d.quantity != null) {
      try {
        macros = calculate({
          quantityMode: d.quantityMode,
          quantity: d.quantity,
          nutritionPer100g: d.nutritionPer100g,
          portionNutrition: d.portionNutrition,
        });
      } catch (e) {
        if (e instanceof NutritionCalculationError) {
          return { status: 422, jsonBody: { error: e.message } };
        }
        throw e;
      }
    } else {
      macros = {
        calories: d.calories!,
        protein: d.protein!,
        carbs: d.carbs!,
        fat: d.fat!,
        fiber: d.fiber ?? 0,
      };
    }

    try {
      const meal = await getDiaryRepository().addItem(userId, mealId, {
        name: itemName,
        ...macros,
        quantity: d.inputMode === 'portion' ? d.inputAmount! : (d.amountGrams ?? d.quantity ?? 1),
        unit: d.inputMode === 'portion' ? 'portion' : d.quantityMode === 'portions' ? 'portion' : (d.unit ?? 'g'),
        ...(d.productId ? { sourceId: d.productId } : {}),
        ...(d.isAiEstimate ? { isAiEstimate: true } : {}),
        ...(d.sourceType === 'ai-meal-estimate' ? { sourceType: 'ai-meal-estimate' } : {}),
        ...(d.aiMealEstimateComponents ? { aiMealEstimateComponents: d.aiMealEstimateComponents } : {}),
        ...(d.aiMealEstimateContext ? { aiMealEstimateContext: d.aiMealEstimateContext } : {}),
        ...(d.aiMealEstimateConfidence ? { aiMealEstimateConfidence: d.aiMealEstimateConfidence } : {}),
        ...(d.aiMealEstimateAssumptions ? { aiMealEstimateAssumptions: d.aiMealEstimateAssumptions } : {}),
        ...(d.aiMealEstimatePhotoUsed ? { aiMealEstimatePhotoUsed: d.aiMealEstimatePhotoUsed } : {}),
        ...(d.category ? { category: d.category as import('@fittrack/shared').FoodCategory } : {}),
      });
      logEvent(ctx, 'info', 'diary.item.added', { userId, mealId });
      return { status: 201, jsonBody: { meal } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('not found')) return { status: 404, jsonBody: { error: msg } };
      throw e;
    }
  },
);

const UpdateItemSchema = z.object({
  amountGrams: z.number().positive().optional(),
  portionCount: z.number().positive().optional(),
  inputMode: z.enum(['grams', 'portion']),
}).refine(
  (d) => (d.inputMode === 'grams' ? d.amountGrams != null : d.portionCount != null),
  { message: 'amountGrams required for grams mode, portionCount for portion mode' },
);

// PUT /api/diary/meals/:id/items/:itemId
export const updateItemHandler = withHandler(
  'diary.items.update',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const mealId = request.params['id'];
    const itemId = request.params['itemId'];
    if (!mealId || !itemId) return { status: 400, jsonBody: { error: 'Missing meal or item id' } };

    const parsed = await parseBody(request, UpdateItemSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const repo = getDiaryRepository();
    const meal = await repo.getMealById(userId, mealId);
    if (!meal) return { status: 404, jsonBody: { error: 'Meal not found' } };
    const existingItem = meal.items.find((i) => i.id === itemId);
    if (!existingItem) return { status: 404, jsonBody: { error: 'Item not found' } };

    let newQuantity: number;
    let newUnit: string;
    let newMacros: import('@fittrack/shared').MealItemMacros;

    if (existingItem.sourceId) {
      // Item from a ReusableItem — recalculate from source product nutrition
      const product = await getReusableItemsRepository().getById(userId, existingItem.sourceId);
      if (!product?.nutritionPer100g) {
        return { status: 422, jsonBody: { error: 'Source product not found — cannot recalculate macros' } };
      }
      const n = product.nutritionPer100g;
      const grams = d.inputMode === 'portion'
        ? (d.portionCount! * (product.portion?.weightGrams ?? 100))
        : d.amountGrams!;
      const scale = grams / 100;
      newMacros = {
        calories: Math.round(n.calories * scale * 10) / 10,
        protein:  Math.round((n.protein  ?? 0) * scale * 10) / 10,
        carbs:    Math.round((n.carbs    ?? 0) * scale * 10) / 10,
        fat:      Math.round((n.fat      ?? 0) * scale * 10) / 10,
        fiber:    Math.round((n.fiber    ?? 0) * scale * 10) / 10,
      };
      newQuantity = d.inputMode === 'portion' ? d.portionCount! : d.amountGrams!;
      newUnit = d.inputMode === 'portion' ? 'portion' : 'g';
    } else {
      // Manual item — scale proportionally
      const oldQuantity = existingItem.quantity;
      if (!oldQuantity) return { status: 422, jsonBody: { error: 'Cannot rescale item with zero quantity' } };
      const newAmount = d.inputMode === 'portion' ? d.portionCount! : d.amountGrams!;
      const ratio = newAmount / oldQuantity;
      const m = existingItem.macros;
      newMacros = {
        calories: Math.round(m.calories * ratio * 10) / 10,
        protein:  Math.round(m.protein  * ratio * 10) / 10,
        carbs:    Math.round(m.carbs    * ratio * 10) / 10,
        fat:      Math.round(m.fat      * ratio * 10) / 10,
        fiber:    Math.round((m.fiber ?? 0) * ratio * 10) / 10,
      };
      newQuantity = newAmount;
      newUnit = d.inputMode === 'portion' ? 'portion' : (existingItem.unit ?? 'g');
    }

    const updatedMeal = await repo.updateItem(userId, mealId, itemId, { macros: newMacros, quantity: newQuantity, unit: newUnit });
    if (!updatedMeal) return { status: 404, jsonBody: { error: 'Item not found' } };
    logEvent(ctx, 'info', 'diary.item.updated', { userId, mealId, itemId });
    return { status: 200, jsonBody: { meal: updatedMeal } };
  },
);

// DELETE /api/diary/meals/:id/items/:itemId
export const deleteItemHandler = withHandler(
  'diary.items.delete',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { userId } = await requireUser(request);
    const mealId = request.params['id'];
    const itemId = request.params['itemId'];
    if (!mealId || !itemId) return { status: 400, jsonBody: { error: 'Missing meal or item id' } };

    const meal = await getDiaryRepository().deleteItem(userId, mealId, itemId);
    if (!meal) return { status: 404, jsonBody: { error: 'Item not found' } };
    logEvent(ctx, 'info', 'diary.item.deleted', { userId, mealId, itemId });
    return { status: 200, jsonBody: { meal } };
  },
);

// --- Route registrations ---

app.http('diary-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'diary',
  handler: getDiaryHandler,
});

app.http('diary-day-type-set', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/{date}/day-type',
  handler: setDayTypeHandler,
});

app.http('diary-meals-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals',
  handler: createMealHandler,
});

app.http('diary-meals-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented' } }),
});

app.http('diary-meals-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}',
  handler: deleteMealHandler,
});

app.http('diary-items-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items',
  handler: addItemHandler,
});

app.http('diary-items-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: updateItemHandler,
});

app.http('diary-items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: deleteItemHandler,
});
