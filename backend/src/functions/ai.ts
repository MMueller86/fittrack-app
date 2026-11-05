import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import {
  parseMeal,
  assessMealPhoto,
  estimateMeal,
  type AiMealPhotoAssessment,
  type AiParsedItem,
  analyzeRecipeText,
  RecipeAnalysisContractError,
  type AiRecipeRaw,
  type AiRecipeIngredientLine,
  scaleRecipeText,
  type AiRecipeScaleInput,
  type AiRecipeScaleIngredientContext,
} from '../lib/openai';
import { getFoodProductRepository } from '../lib/repositories/foodProductRepository';
import { getReusableItemsRepository } from '../lib/repositories/reusableItemsRepository';
import { getRecipesRepository } from '../lib/repositories/recipesRepository';
import { requireUser } from '../lib/auth';
import { parseBody, withHandler } from '../lib/http';
import { parseRecipeBody, RecipeDependencyError, withRecipeHandler } from '../lib/recipeHttp';
import { enforceQuota, trackUsage } from '../lib/quota';
import { logEvent } from '../lib/log';
import { rankByQuery } from '../lib/searchRanking';
import type {
  FoodSearchResult,
  ReusableItem,
  AiMealEstimatePreview,
  AiMealEstimateRefine,
  AiMealEstimateProgressEvent,
  Recipe,
  RecipeIngredient,
  RecipeScalePreviewResponse,
  RecipeStep,
} from '@fittrack/shared';
import { scaleRecipeIngredients } from '../../../shared/lib/recipeCalculator';
import { RECIPE_PORTION_MAX, RECIPE_PORTION_MIN } from '../../../shared/types/recipeScale';
import { validateRecipeAnalyzeOutput } from '../lib/recipeAnalyzeValidation';
import {
  MEAL_ESTIMATE_PROMPT_VERSION,
  MEAL_PHOTO_ASSESSMENT_PROMPT_VERSION,
} from '../lib/prompts/mealEstimate';
export { validateRecipeAnalyzeOutput };
export type { RecipeAnalyzeValidationResult } from '../lib/recipeAnalyzeValidation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched' | 'seasoning';

export interface MealParserPreviewItem {
  rawText: string;
  displayName: string;
  status: ItemStatus;
  selectedProductId: string | null;
  selectedProductName: string | null;
  candidates: FoodSearchResult[];
  inputMode: 'grams' | 'portion' | 'unknown';
  inputAmount: number | null;
  amountGrams: number | null;
  needsReview: boolean;
  warnings: string[];
  category?: 'food' | 'seasoning';
  kitchenAmountText?: string | null;  // populated by backend for seasoning items
}

export interface MealParserPreviewResponse {
  items: MealParserPreviewItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Classification logic (pure function — easy to unit test)
// ---------------------------------------------------------------------------

/**
 * Classify search results into a status and derive selected product if unambiguous.
 *
 * matched:        exactly one candidate AND its name closely matches the displayName
 * needsSelection: multiple candidates, or one candidate with weak name similarity
 * unmatched:      no candidates
 */
export function classifyItem(
  parsed: AiParsedItem,
  candidates: FoodSearchResult[],
  libraryItems: ReusableItem[] = [],
): Pick<MealParserPreviewItem, 'status' | 'selectedProductId' | 'selectedProductName' | 'needsReview' | 'warnings'> {
  const warnings: string[] = [];

  if (candidates.length === 0) {
    return { status: 'unmatched', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
  }

  if (candidates.length === 1) {
    const c = candidates[0]!;
    // Look up searchTerms for this candidate from the library (if it's a library item)
    const libItem = libraryItems.find((li) => li.id === c.id);
    const nameMatch = isStrongNameMatch(parsed.displayName, c.name, libItem?.searchTerms, c.brand);
    if (nameMatch) {
      return { status: 'matched', selectedProductId: c.id, selectedProductName: c.name, needsReview: false, warnings };
    }
    return { status: 'needsSelection', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
  }

  // Multiple candidates — check if any library item is a strong match and auto-select it
  for (const c of candidates) {
    const libItem = libraryItems.find((li) => li.id === c.id);
    if (libItem && isStrongNameMatch(parsed.displayName, c.name, libItem.searchTerms, c.brand)) {
      return { status: 'matched', selectedProductId: c.id, selectedProductName: c.name, needsReview: false, warnings };
    }
  }

  // Multiple candidates — let user pick
  return { status: 'needsSelection', selectedProductId: null, selectedProductName: null, needsReview: true, warnings };
}

/**
 * Returns true if the AI display name and the product name are similar enough
 * to auto-select without user confirmation.
 * Checks that every display-name token matches the product name, brand, or a stored search term.
 */
function isStrongNameMatch(
  displayName: string,
  productName: string,
  searchTerms?: string[],
  brand?: string,
): boolean {
  const normalizedDisplayName = displayName.toLowerCase().trim();
  const normalizedProductName = productName.toLowerCase().trim();
  if (
    normalizedProductName === normalizedDisplayName ||
    normalizedProductName.startsWith(normalizedDisplayName) ||
    normalizedDisplayName.startsWith(normalizedProductName)
  ) {
    return true;
  }
  return rankByQuery(productName, searchTerms ?? [], displayName, brand) >= 0;
}

/**
 * Resolve amountGrams from AI-parsed item.
 * If inputMode is 'grams', amountGrams = inputAmount.
 * For 'portion' or 'unknown', we leave it null (user/save step resolves via product portion data).
 */
export function resolveAmountGrams(parsed: AiParsedItem): number | null {
  if (parsed.inputMode === 'grams' && parsed.inputAmount !== null) {
    return parsed.inputAmount;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Preview endpoint
// ---------------------------------------------------------------------------

const PreviewBodySchema = z.object({
  text: z.string().min(1, 'text must not be empty').max(500, 'text must be at most 500 characters'),
  /** Optional eating context (e.g. "Bäcker", "Restaurant") forwarded to the AI prompt. */
  context: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Shared helper — resolve AI-parsed items against catalog + user library
// Used by both mealParserPreviewHandler and recipeAnalyzeHandler
// ---------------------------------------------------------------------------

export async function resolveIngredients(userId: string, aiItems: AiParsedItem[]): Promise<MealParserPreviewItem[]> {
  const catalogRepo = getFoodProductRepository();
  const libraryRepo = getReusableItemsRepository();

  return Promise.all(
    aiItems.map(async (aiItem): Promise<MealParserPreviewItem> => {
      // Split displayName into significant words (3+ chars) for multi-word library search
      const searchWords = [
        ...new Set(
          aiItem.displayName
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length >= 3),
        ),
      ];

      const [libraryItemSets, catalogResults] = await Promise.all([
        Promise.all(searchWords.map((word) => libraryRepo.search(userId, word))),
        catalogRepo.search(aiItem.displayName, 5),
      ]);

      // Merge library results from all word-searches, deduplicated by id
      const seenLibIds = new Set<string>();
      const libraryItems: ReusableItem[] = [];
      for (const resultSet of libraryItemSets) {
        for (const item of resultSet) {
          if (!seenLibIds.has(item.id)) {
            seenLibIds.add(item.id);
            libraryItems.push(item);
          }
        }
      }

      // Map library items to FoodSearchResult — library comes first
      const libraryResults: FoodSearchResult[] = libraryItems.map((li) => ({
        id: li.id,
        source: 'library' as const,
        name: li.name,
        brand: li.brand,
        displayLabel: li.nutritionPer100g
          ? `100g · ${Math.round(li.nutritionPer100g.calories)} kcal`
          : li.portion?.nutrition
            ? `${li.portion.label} · ${Math.round(li.portion.nutrition.calories)} kcal`
            : 'Keine Nährwerte',
        nutritionBasis: li.nutritionBasis,
        nutritionPer100g: li.nutritionPer100g,
        portion: li.portion,
        isComplete: li.isComplete,
        sourceRef: li.sourceRef,
        ...(li.sourceType === 'ai' && { isAiEstimate: true }),
        ...(li.sourceType === 'ai' && li.aiConfidence != null && { aiConfidence: li.aiConfidence }),
      }));

      // De-duplicate: skip catalog entries whose name already in library
      const libraryNames = new Set(libraryResults.map((r) => r.name.toLowerCase()));
      const dedupedCatalog = catalogResults.filter((r) => !libraryNames.has(r.name.toLowerCase()));

      const candidates = [...libraryResults, ...dedupedCatalog];
      const classification = classifyItem(aiItem, candidates, libraryItems);
      return {
        rawText: aiItem.rawText,
        displayName: aiItem.displayName,
        inputMode: aiItem.inputMode,
        inputAmount: aiItem.inputAmount,
        amountGrams: resolveAmountGrams(aiItem),
        candidates,
        ...classification,
      };
    }),
  );
}

export const mealParserPreviewHandler = withHandler(
  'ai.meal-parser.preview',
  async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const { userId } = userContext;

    // Quota enforcement — check before expensive AI call
    const quotaBlock = await enforceQuota(userContext, 'meal-parser');
    if (quotaBlock) return quotaBlock;

    const body = await request.json();
    const parsed = PreviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Invalid request' } };
    }

    const { text, context } = parsed.data;

    // 1. AI parsing
    let aiItems: AiParsedItem[];
    try {
      aiItems = await parseMeal(text, context);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 502, jsonBody: { error: `AI parsing failed: ${msg}` } };
    }

    // Track usage AFTER successful AI call
    await trackUsage(userContext, 'meal-parser');

    // 2. Resolve each item against catalog + library
    const items = await resolveIngredients(userId, aiItems);

    const globalWarnings: string[] = [];
    const unmatchedCount = items.filter((i) => i.status === 'unmatched').length;
    if (unmatchedCount > 0) {
      globalWarnings.push(
        `${unmatchedCount} Produkt${unmatchedCount > 1 ? 'e' : ''} konnten nicht in der Datenbank gefunden werden.`,
      );
    }

    const response: MealParserPreviewResponse = { items, warnings: globalWarnings };
    return { status: 200, jsonBody: response };
  },
);

app.http('ai-meal-parser-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-parser/preview',
  handler: mealParserPreviewHandler,
});

// ---------------------------------------------------------------------------
// Meal estimate endpoint — Fast Path: whole-meal nutrition + components in one call
// ---------------------------------------------------------------------------

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

const AiMealEstimateComponentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  estimatedGrams: z.number().finite().gt(0).max(5000),
  calories: z.number().finite().min(0).max(3000),
}).strict();

const AiMealEstimateNutritionSchema = z.object({
  calories: z.number().finite().min(0).max(3000),
  protein: z.number().finite().min(0),
  carbs: z.number().finite().min(0),
  fat: z.number().finite().min(0),
  fiber: z.number().finite().min(0),
}).strict();

const AiMealEstimateRefineSchema = z.object({
  previous: z.object({
    mealName: z.string().trim().min(1).max(200),
    estimatedTotalGrams: z.number().finite().min(20).max(5000),
    mealEstimate: AiMealEstimateNutritionSchema,
    componentItems: z.array(AiMealEstimateComponentSchema).max(20),
  }).strict(),
  hints: z.array(z.enum(['larger', 'smaller'])).max(1).optional(),
  note: z.string()
    .transform((note) => note.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim())
    .pipe(z.string().min(3).max(200))
    .optional(),
}).strict().superRefine((refine, ctx) => {
  if ((refine.hints?.length ?? 0) === 0 && refine.note === undefined) {
    ctx.addIssue({ code: 'custom', path: ['hints'], message: 'A hint or a valid note is required' });
  }
});

const MealEstimateRequestSchema = z.object({
  text: z.string().trim().min(1, 'text ist erforderlich').max(500, 'text darf maximal 500 Zeichen lang sein'),
  refine: AiMealEstimateRefineSchema.optional(),
});

const AiMealEstimateOutputSchema = z.object({
  mealName: z.string(),
  mealEstimate: AiMealEstimateNutritionSchema,
  componentItems: z.array(AiMealEstimateComponentSchema).max(20),
  estimatedTotalGrams: z.number().finite().min(20).max(5000),
  contextDetected: z.string().nullable(),
  portionConfidence: z.enum(['high', 'medium', 'low']),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
}).strict();

const MEAL_ESTIMATE_MACRO_WARNING = 'Die geschätzten Kalorien weichen deutlich von der Makro-Konsistenzschätzung ab.';
const MEAL_ESTIMATE_COMPONENT_WARNING = 'Die Summe der Komponenten-Kalorien weicht deutlich von der Gesamt-Kalorienschätzung ab.';
const MEAL_PHOTO_MISMATCH_WARNING = 'Beschreibung und Foto scheinen nicht zusammenzupassen. Die Schätzung basiert nur auf deiner Beschreibung. Prüfe bitte, ob du das richtige Foto ausgewählt hast.';
const MEAL_PHOTO_UNCERTAIN_WARNING = 'Das Foto ließ sich nicht sicher zuordnen und wurde für die Schätzung nicht verwendet. Bitte prüfe, ob es zur Beschreibung passt.';

/** Makes calories consistent with the 4/4/9 macro energy so the user never sees contradicting values. */
function reconcileMealEnergy(
  estimate: z.infer<typeof AiMealEstimateOutputSchema>,
): z.infer<typeof AiMealEstimateOutputSchema> {
  const { calories, protein, carbs, fat } = estimate.mealEstimate;
  const macroCalories = Math.round(4 * protein + 4 * carbs + 9 * fat);
  if (macroCalories <= 0 || Math.abs(calories - macroCalories) <= Math.max(25, macroCalories * 0.05)) {
    return estimate;
  }

  const scale = calories > 0 ? macroCalories / calories : 1;
  return {
    ...estimate,
    mealEstimate: { ...estimate.mealEstimate, calories: macroCalories },
    componentItems: estimate.componentItems.map((item) => ({ ...item, calories: Math.round(item.calories * scale) })),
  };
}

function getMealEstimatePlausibilityWarnings(estimate: z.infer<typeof AiMealEstimateOutputSchema>): string[] {
  const { calories, protein, carbs, fat } = estimate.mealEstimate;
  const macroCalories = 4 * protein + 4 * carbs + 9 * fat;
  const warnings: string[] = [];

  if (Math.abs(calories - macroCalories) > Math.max(50, calories * 0.15)) {
    warnings.push(MEAL_ESTIMATE_MACRO_WARNING);
  }

  if (estimate.componentItems.length > 0) {
    const componentCalories = estimate.componentItems.reduce((sum, item) => sum + item.calories, 0);
    if (Math.abs(componentCalories - calories) > calories * 0.2) {
      warnings.push(MEAL_ESTIMATE_COMPONENT_WARNING);
    }
  }

  return warnings;
}

export const mealEstimatePreviewHandler = withHandler(
  'ai.meal-estimate.preview',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);

    let text: string;
    let imageBase64: string | undefined;
    let imageMimeType: 'image/jpeg' | 'image/png' | undefined;
    let refine: AiMealEstimateRefine | undefined;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      // Multipart: text + optional image
      const formData = await request.formData();
      const textField = formData.get('text');
      if (!textField || typeof textField !== 'string') {
        return { status: 400, jsonBody: { error: 'Pflichtfeld "text" fehlt im Formular' } };
      }
      text = textField.trim();

      const refineField = formData.get('refine');
      if (refineField !== null) {
        if (typeof refineField !== 'string') {
          return { status: 400, jsonBody: { error: 'refine muss ein gültiges JSON-Objekt sein' } };
        }
        let refineValue: unknown;
        try {
          refineValue = JSON.parse(refineField);
        } catch {
          return { status: 400, jsonBody: { error: 'refine muss ein gültiges JSON-Objekt sein' } };
        }
        const parsedRefine = AiMealEstimateRefineSchema.safeParse(refineValue);
        if (!parsedRefine.success) {
          return { status: 400, jsonBody: { error: parsedRefine.error.issues[0]?.message ?? 'refine ist ungültig' } };
        }
        refine = parsedRefine.data;
      }

      const imageField = formData.get('image');
      if (imageField && imageField instanceof Blob) {
        const mimeType = imageField.type;
        if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
          return {
            status: 400,
            jsonBody: { error: `Nicht unterstützter Bildtyp: ${mimeType}. Erlaubt: ${ALLOWED_IMAGE_TYPES.join(', ')}` },
          };
        }
        const arrayBuffer = await imageField.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
          return { status: 400, jsonBody: { error: 'Bild überschreitet die maximale Größe von 4 MB' } };
        }
        imageBase64 = Buffer.from(arrayBuffer).toString('base64');
        imageMimeType = mimeType as 'image/jpeg' | 'image/png';
      }
    } else {
      // JSON: text only
      const body = await request.json() as unknown;
      const parsed = MealEstimateRequestSchema.safeParse(body);
      if (!parsed.success) {
        return { status: 400, jsonBody: { error: parsed.error.issues[0]?.message ?? 'Ungültige Anfrage' } };
      }
      text = parsed.data.text;
      refine = parsed.data.refine;
    }

    if (text.length < 1) {
      return { status: 400, jsonBody: { error: 'text ist erforderlich' } };
    }
    if (text.length > 500) {
      return { status: 400, jsonBody: { error: 'text darf maximal 500 Zeichen lang sein' } };
    }

    // Validate the request before quota checks; still enforce quota before AI.
    const quotaBlock = await enforceQuota(userContext, 'meal-estimate');
    if (quotaBlock) return quotaBlock;

    const wantsProgress = imageBase64 !== undefined && imageMimeType !== undefined &&
      request.headers.get('accept')?.split(',').some((value) => value.split(';')[0]?.trim().toLowerCase() === 'application/x-ndjson') === true;

    const runEstimate = async (
      emit?: (event: AiMealEstimateProgressEvent) => void,
    ): Promise<HttpResponseInit> => {
      const startedAt = Date.now();
      let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let providerCalls = 0;
      let assessmentDurationMs = 0;
      let estimationDurationMs = 0;
      const recordUsage = (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): void => {
        tokenUsage = {
          promptTokens: tokenUsage.promptTokens + (usage.promptTokens ?? 0),
          completionTokens: tokenUsage.completionTokens + (usage.completionTokens ?? 0),
          totalTokens: tokenUsage.totalTokens + (usage.totalTokens ?? 0),
        };
      };
      const logResult = (validationResult: string, warningCount?: number, providerStage?: string): void => {
        logEvent(ctx, validationResult === 'valid' || validationResult === 'valid_with_warnings' ? 'info' : 'warn', 'ai.meal-estimate.result', {
          promptVersion: MEAL_ESTIMATE_PROMPT_VERSION,
          assessmentPromptVersion: MEAL_PHOTO_ASSESSMENT_PROMPT_VERSION,
          mode: refine ? 'refine' : 'initial',
          hintIds: refine?.hints?.join(',') ?? '',
          hasPhoto: imageBase64 !== undefined,
          providerCalls,
          assessmentDurationMs,
          estimationDurationMs,
          textLength: text.length,
          noteLength: refine?.note?.length ?? 0,
          promptTokens: tokenUsage.promptTokens,
          completionTokens: tokenUsage.completionTokens,
          totalTokens: tokenUsage.totalTokens,
          durationMs: Date.now() - startedAt,
          validationResult,
          warningCount,
          providerStage,
        });
      };

      let photoAssessment: AiMealPhotoAssessment | 'no_photo' = 'no_photo';
      if (imageBase64 !== undefined && imageMimeType !== undefined) {
        providerCalls += 1;
        const assessmentStartedAt = Date.now();
        try {
          photoAssessment = await assessMealPhoto({
            text,
            imageBase64,
            imageMimeType,
            onUsage: recordUsage,
          });
        } catch {
          assessmentDurationMs = Date.now() - assessmentStartedAt;
          logResult('provider_error', undefined, 'photo_assessment');
          return { status: 502, jsonBody: { error: 'KI-Schätzung fehlgeschlagen' } };
        }
        assessmentDurationMs = Date.now() - assessmentStartedAt;
        emit?.({ event: 'photo_check.completed' });
      }

      const photoUse = photoAssessment === 'consistent' || photoAssessment === 'complementary'
        ? 'included'
        : photoAssessment === 'contradictory'
          ? 'excluded_mismatch'
          : photoAssessment === 'uncertain'
            ? 'excluded_uncertain'
            : 'no_photo';
      const includePhotoInEstimate = photoUse === 'included';
      const excludedPhoto = photoUse === 'excluded_mismatch' || photoUse === 'excluded_uncertain';

      let estimate;
      providerCalls += 1;
      const estimationStartedAt = Date.now();
      emit?.({ event: 'estimate.started' });
      try {
        estimate = await estimateMeal({
          text,
          imageBase64: includePhotoInEstimate ? imageBase64 : undefined,
          imageMimeType: includePhotoInEstimate ? imageMimeType : undefined,
          refine,
          suppressPreviousEstimate: excludedPhoto,
          onUsage: recordUsage,
        });
      } catch {
        estimationDurationMs = Date.now() - estimationStartedAt;
        logResult('provider_error', undefined, 'nutrition_estimate');
        return { status: 502, jsonBody: { error: 'KI-Schätzung fehlgeschlagen' } };
      }
      estimationDurationMs = Date.now() - estimationStartedAt;

      const validation = AiMealEstimateOutputSchema.safeParse(estimate);
      if (!validation.success) {
        logResult('schema_invalid');
        return {
          status: 422,
          jsonBody: {
            error: 'KI-Schätzung hat Plausibilitätsprüfung nicht bestanden',
            details: validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
          },
        };
      }

      const validEstimate = reconcileMealEnergy(validation.data);
      const maxPlausibleCalories = validation.data.estimatedTotalGrams * 9 * 1.05;
      if (validation.data.mealEstimate.calories > maxPlausibleCalories) {
        logResult('energy_density_invalid');
        return {
          status: 422,
          jsonBody: {
            error: 'KI-Schätzung hat Plausibilitätsprüfung nicht bestanden',
            details: ['mealEstimate.calories: exceeds weight-based energy limit'],
          },
        };
      }

      const warnings = [...validEstimate.warnings];
      if (photoUse === 'excluded_mismatch') warnings.push(MEAL_PHOTO_MISMATCH_WARNING);
      if (photoUse === 'excluded_uncertain') warnings.push(MEAL_PHOTO_UNCERTAIN_WARNING);
      for (const warning of getMealEstimatePlausibilityWarnings(validEstimate)) {
        if (!warnings.includes(warning)) warnings.push(warning);
      }

      // Track usage only after server-side validation succeeds.
      await trackUsage(userContext, 'meal-estimate');
      logResult(warnings.length > 0 ? 'valid_with_warnings' : 'valid', warnings.length);

      const preview: AiMealEstimatePreview = {
        mealName: validEstimate.mealName,
        mealEstimate: validEstimate.mealEstimate,
        components: validEstimate.componentItems.map((item) => item.name),
        componentItems: validEstimate.componentItems,
        estimatedTotalGrams: validEstimate.estimatedTotalGrams,
        promptVersion: MEAL_ESTIMATE_PROMPT_VERSION,
        contextDetected: validEstimate.contextDetected,
        portionConfidence: validEstimate.portionConfidence,
        photoProvided: imageBase64 !== undefined,
        photoAssessment,
        photoUse,
        photoUsed: includePhotoInEstimate,
        assumptions: validEstimate.assumptions,
        warnings,
      };

      return { status: 200, jsonBody: preview };
    };

    if (!wantsProgress) return runEstimate();

    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: AiMealEstimateProgressEvent): void => {
          if (!cancelled) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
        };
        const close = (): void => {
          if (!cancelled) controller.close();
        };

        void runEstimate(send).then((response) => {
          if (response.status === 200) {
            send({ event: 'result', data: response.jsonBody as AiMealEstimatePreview });
          } else {
            send({ event: 'error', code: 'processing_failed' });
          }
          close();
        }).catch(() => {
          logEvent(ctx, 'error', 'ai.meal-estimate.progress.error', {
            stage: 'stream_processing',
            errorClass: 'operation_failed',
          });
          send({ event: 'error', code: 'processing_failed' });
          close();
        });
      },
      cancel() {
        cancelled = true;
      },
    });

    return {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
      body,
    };
  },
);

app.http('ai-meal-estimate-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-estimate/preview',
  handler: mealEstimatePreviewHandler,
});

// ---------------------------------------------------------------------------
// Legacy stub — kept for backwards compatibility
// ---------------------------------------------------------------------------

app.http('ai-analyze-meal-item', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/meal-analyze',
  handler: async () => ({
    status: 501,
    jsonBody: { message: 'Replaced by POST /api/ai/meal-parser/preview' },
  }),
});

// ---------------------------------------------------------------------------
// Recipe analyzer — freetext → name + description + steps + ingredients (resolved)
// ---------------------------------------------------------------------------

/**
 * Merge AiParsedItems that refer to the same ingredient (case-insensitive display name).
 * Amounts are summed so the user sees a single entry per ingredient instead of one per step.
 */
function bundleAiItems(items: AiParsedItem[]): AiParsedItem[] {
  const map = new Map<string, AiParsedItem>();
  for (const item of items) {
    const key = item.displayName.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
    } else {
      // Sum amounts when both sides have a value
      const summedAmount =
        existing.inputAmount != null && item.inputAmount != null
          ? existing.inputAmount + item.inputAmount
          : (existing.inputAmount ?? item.inputAmount);
      map.set(key, { ...existing, inputAmount: summedAmount });
    }
  }
  return Array.from(map.values());
}

function mapRecipeFoodIngredientsToParsedItems(items: AiRecipeIngredientLine[]): AiParsedItem[] {
  const parsedItems = items.map((item): AiParsedItem => {
    const hasValidAmount =
      typeof item.amountGrams === 'number' && Number.isFinite(item.amountGrams) && item.amountGrams > 0;
    return {
      rawText: item.line,
      displayName: item.displayName,
      inputMode: hasValidAmount ? 'grams' : 'unknown',
      inputAmount: hasValidAmount ? item.amountGrams : null,
    };
  });
  return bundleAiItems(parsedItems);
}

const UNKNOWN_FOOD_AMOUNT_WARNING = 'Menge konnte nicht automatisch bestimmt werden. Bitte Produkt und Menge auswählen.';

function markUnknownFoodAmountsForReview(items: MealParserPreviewItem[]): MealParserPreviewItem[] {
  return items.map((item) => {
    if (item.inputMode !== 'unknown') return item;

    return {
      ...item,
      status: item.candidates.length === 0 ? 'unmatched' : 'needsSelection',
      selectedProductId: null,
      selectedProductName: null,
      needsReview: true,
      warnings: [...item.warnings, UNKNOWN_FOOD_AMOUNT_WARNING],
    };
  });
}

export interface AiRecipeAnalysisResponse {
  suggestedName: string;
  description: string;
  suggestedPortions: number;
  tags: string[];
  steps: AiRecipeRaw['steps'];
  exportSuggestion: AiRecipeRaw['exportSuggestion'];
  ingredients: MealParserPreviewItem[];
}

const RecipeAnalyzeBodySchema = z.object({
  text: z.string().min(10, 'Bitte beschreibe das Rezept mit mindestens 10 Zeichen.').max(5000, 'Text darf maximal 5000 Zeichen lang sein.'),
});

export const recipeAnalyzeHandler = withRecipeHandler(
  'ai.recipe-analyze',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const { userId } = userContext;

    const quotaBlock = await enforceQuota(userContext, 'recipe-analyze');
    if (quotaBlock) return quotaBlock;

    const parsed = await parseRecipeBody(request, RecipeAnalyzeBodySchema, ctx);
    if (!parsed.ok) return parsed.response;

    const { text } = parsed.data;

    // 1. Extract recipe structure via AI
    let recipeRaw: AiRecipeRaw;
    try {
      recipeRaw = await analyzeRecipeText(text);
    } catch (e) {
      if (e instanceof RecipeAnalysisContractError) {
        return { status: 422, jsonBody: { error: e.message, details: e.details } };
      }
      throw new RecipeDependencyError('azure_openai_analysis', e);
    }

    const validation = validateRecipeAnalyzeOutput(recipeRaw);
    if (!validation.ok) {
      return {
        status: 422,
        jsonBody: {
          error: 'AI recipe analysis failed server-side validation',
          details: validation.errors,
        },
      };
    }
    recipeRaw = validation.data;

    // 2. Route ingredients: food → catalog; seasoning → direct construction
    const foodIngredients = recipeRaw.ingredients.filter((i) => i.category !== 'seasoning');
    const seasoningIngredients = recipeRaw.ingredients.filter((i) => i.category === 'seasoning');
    const parsedFoodIngredients = mapRecipeFoodIngredientsToParsedItems(foodIngredients);

    // Track usage after a successful AI call.
    await trackUsage(userContext, 'recipe-analyze');

    let ingredients: MealParserPreviewItem[] = [];
    if (recipeRaw.ingredients.length > 0) {
      let resolvedFood: MealParserPreviewItem[] = [];
      if (parsedFoodIngredients.length > 0) {
        const resolved = await resolveIngredients(userId, parsedFoodIngredients);
        resolvedFood = markUnknownFoodAmountsForReview(
          resolved.map((item) => ({ ...item, category: 'food' as const })),
        );
      }

      const resolvedSeasonings: MealParserPreviewItem[] = seasoningIngredients.map((s) => ({
        rawText: s.line,
        displayName: s.displayName,
        status: 'seasoning' as ItemStatus,
        selectedProductId: null,
        selectedProductName: null,
        candidates: [],
        inputMode: 'grams' as const,
        inputAmount: s.amountGrams,
        amountGrams: s.amountGrams,
        needsReview: false,
        warnings: [],
        category: 'seasoning' as const,
        kitchenAmountText: s.kitchenAmountText ?? null,
      }));

      ingredients = [...resolvedFood, ...resolvedSeasonings];
    }

    const response: AiRecipeAnalysisResponse = {
      suggestedName: recipeRaw.suggestedName,
      description: recipeRaw.description,
      suggestedPortions: recipeRaw.suggestedPortions,
      tags: recipeRaw.tags,
      steps: recipeRaw.steps,
      exportSuggestion: recipeRaw.exportSuggestion,
      ingredients,
    };

    return { status: 200, jsonBody: response };
  },
);

app.http('recipe-analyze', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/recipe-analyze',
  handler: recipeAnalyzeHandler,
});

// ---------------------------------------------------------------------------
// Recipe scale text preview — server-owned recipe projection
// ---------------------------------------------------------------------------

const RecipeScaleBodySchema = z.object({
  recipeId: z.guid('recipeId must be a valid UUID'),
  targetPortions: z.number()
    .int('targetPortions must be a whole number')
    .min(RECIPE_PORTION_MIN, `targetPortions must be at least ${RECIPE_PORTION_MIN}`)
    .max(RECIPE_PORTION_MAX, `targetPortions must be at most ${RECIPE_PORTION_MAX}`),
});

const RecipeScaleResponseSchema = z.object({
  description: z.string().max(2000).nullable(),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    title: z.string().max(200).nullable(),
    description: z.string().min(1).max(2000),
  }).strict()).max(50),
}).strict();

function toRecipeScaleIngredientContext(ingredient: RecipeIngredient): AiRecipeScaleIngredientContext {
  return {
    displayName: ingredient.displayName,
    category: ingredient.category ?? 'food',
    inputMode: ingredient.inputMode,
    unit: ingredient.unit,
    inputAmount: ingredient.inputAmount,
    amountGrams: ingredient.amountGrams,
    amountLabel: ingredient.amountLabel ?? null,
  };
}

function buildRecipeScaleInput(recipe: Recipe, targetPortions: number): AiRecipeScaleInput {
  const targetIngredients = scaleRecipeIngredients(
    recipe.ingredients,
    recipe.portions,
    targetPortions,
  );

  return {
    originalPortions: recipe.portions,
    targetPortions,
    originalDescription: recipe.description ?? null,
    originalIngredients: recipe.ingredients.map(toRecipeScaleIngredientContext),
    targetIngredients: targetIngredients.map(toRecipeScaleIngredientContext),
    originalSteps: recipe.steps.map((step) => ({
      order: step.order,
      title: step.title ?? null,
      description: step.description,
    })),
  };
}

/**
 * Validate the provider response against both the JSON contract and the
 * server-owned recipe structure before returning it to the client.
 */
export function validateRecipeScaleResponse(
  raw: unknown,
  originalDescription: string | null,
  originalSteps: RecipeStep[],
  targetPortions: number,
): RecipeScalePreviewResponse | null {
  const parsed = RecipeScaleResponseSchema.safeParse(raw);
  if (!parsed.success) return null;

  if ((parsed.data.description === null) !== (originalDescription === null)) {
    return null;
  }

  if (parsed.data.steps.length !== originalSteps.length) {
    return null;
  }

  const hasExpectedOrder = parsed.data.steps.every(
    (step, index) => step.order === originalSteps[index]?.order,
  );
  if (!hasExpectedOrder) return null;

  return {
    targetPortions,
    description: parsed.data.description,
    steps: parsed.data.steps.map(({ order, title, description }) => ({
      order,
      ...(title !== null ? { title } : {}),
      description,
    })),
  };
}

export const recipeScalePreviewHandler = withRecipeHandler(
  'ai.recipe-scale.preview',
  async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const userContext = await requireUser(request);
    const parsed = await parseRecipeBody(request, RecipeScaleBodySchema, ctx);
    if (!parsed.ok) return parsed.response;

    const { userId } = userContext;
    const { recipeId, targetPortions } = parsed.data;
    const recipeRepository = getRecipesRepository();
    const recipe = await recipeRepository.get(userId, recipeId);
    if (!recipe) return { status: 404, jsonBody: { error: 'Recipe not found' } };

    const quotaBlock = await enforceQuota(userContext, 'recipe-scale');
    if (quotaBlock) return quotaBlock;

    let rawResponse: unknown;
    try {
      rawResponse = await scaleRecipeText(buildRecipeScaleInput(recipe, targetPortions));
    } catch (error) {
      throw new RecipeDependencyError('azure_openai_scale', error);
    }

    const preview = validateRecipeScaleResponse(
      rawResponse,
      recipe.description ?? null,
      recipe.steps,
      targetPortions,
    );
    if (!preview) {
      return { status: 422, jsonBody: { error: 'KI-Antwort für die Rezeptskalierung ist ungültig', code: 'AI_OUTPUT_INVALID' } };
    }

    await trackUsage(userContext, 'recipe-scale');
    return { status: 200, jsonBody: preview };
  },
);

app.http('ai-recipe-scale-preview', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'ai/recipe-scale/preview',
  handler: recipeScalePreviewHandler,
});

