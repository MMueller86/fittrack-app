import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { logEvent } from '../lib/log';
import { calculate, NutritionCalculationError } from '../lib/nutritionCalculator';
import { getDiaryRepository } from '../lib/repositories/diaryRepository';

// GET    /api/diary?date=YYYY-MM-DD             — meals + day summary
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

const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

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
    const repo = getDiaryRepository();
    const result = await repo.getDay(userId, date);
    logEvent(ctx, 'info', 'diary.get', { userId, date, mealCount: result.meals.length });
    return { status: 200, jsonBody: result };
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

    // Resolve macros: product path > calculated path > flat macros
    let macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    if (d.amountGrams != null && d.calculatedNutrition != null) {
      // Product input — nutrition already calculated on the client from nutritionPer100g
      macros = {
        calories: d.calculatedNutrition.calories,
        protein: d.calculatedNutrition.protein,
        carbs: d.calculatedNutrition.carbs,
        fat: d.calculatedNutrition.fat,
        fiber: d.calculatedNutrition.fiber ?? 0,
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
        ...(d.isAiEstimate ? { isAiEstimate: true } : {}),
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
  handler: async () => ({ status: 501, jsonBody: { message: 'Not implemented' } }),
});

app.http('diary-items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'diary/meals/{id}/items/{itemId}',
  handler: deleteItemHandler,
});
