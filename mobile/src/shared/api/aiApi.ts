// AI API — meal parser + food nutrition estimator + label scan + meal estimate
import axios from 'axios';
import { apiClient } from './client';
import type {
  FoodSearchResult,
  AiFoodEstimatePreview,
  NutritionLabelScanResult,
  AiMealEstimatePreview,
  AiMealEstimateRefine,
  AiMealEstimateProgressEvent,
  InsightResponse,
  RecipeScalePreviewRequest,
  RecipeScalePreviewResponse,
  RecipeExportSuggestion,
  InsightFeedbackRequest,
  InsightFeedbackResponse,
  WeeklyNutritionReviewResponse,
} from '@fittrack/shared';
import { getLocalDateContext, getLocalTimezoneOffsetMinutes } from '../date/localDate';

export interface DailyInsightResponse extends InsightResponse {
  /** Explicitly false for legacy Daily documents without feedback provenance. */
  feedbackAvailable?: boolean;
}

const INSIGHT_FEEDBACK_ERROR_CODES = [
  'insight_not_found',
  'insight_generation_changed',
  'feedback_snapshot_unavailable',
  'feedback_submission_conflict',
] as const;

export type InsightFeedbackErrorCode = typeof INSIGHT_FEEDBACK_ERROR_CODES[number];

export interface InsightFeedbackApiError {
  status: number;
  code: InsightFeedbackErrorCode | null;
}

function toInsightFeedbackErrorCode(value: unknown): InsightFeedbackErrorCode | null {
  switch (value) {
    case 'insight_not_found':
    case 'insight_generation_changed':
    case 'feedback_snapshot_unavailable':
    case 'feedback_submission_conflict':
      return value;
    default:
      return null;
  }
}

export function getInsightFeedbackApiError(error: unknown): InsightFeedbackApiError | null {
  if (!axios.isAxiosError(error) || typeof error.response?.status !== 'number') return null;

  const body: unknown = error.response.data;
  const code = typeof body === 'object' && body !== null && 'code' in body
    ? toInsightFeedbackErrorCode(body.code)
    : null;

  return { status: error.response.status, code };
}

type AiMealEstimatePhaseEvent = Extract<
  AiMealEstimateProgressEvent,
  { event: 'photo_check.completed' | 'estimate.started' }
>;

export interface AiMealEstimateRequestOptions {
  signal?: AbortSignal;
  onProgress?: (event: AiMealEstimatePhaseEvent) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAiMealEstimatePreview(value: unknown): value is AiMealEstimatePreview {
  if (!isRecord(value) || !isRecord(value.mealEstimate)) return false;
  const nutrition = value.mealEstimate;
  return typeof value.mealName === 'string'
    && ['calories', 'protein', 'carbs', 'fat', 'fiber'].every((key) => typeof nutrition[key] === 'number')
    && Array.isArray(value.components)
    && value.components.every((component) => typeof component === 'string')
    && (value.contextDetected === null || typeof value.contextDetected === 'string')
    && ['high', 'medium', 'low'].includes(String(value.portionConfidence))
    && typeof value.photoUsed === 'boolean'
    && Array.isArray(value.assumptions)
    && value.assumptions.every((assumption) => typeof assumption === 'string')
    && Array.isArray(value.warnings)
    && value.warnings.every((warning) => typeof warning === 'string');
}

function parseAiMealEstimateProgressEvent(value: unknown): AiMealEstimateProgressEvent | null {
  if (!isRecord(value)) return null;
  switch (value.event) {
    case 'photo_check.completed':
      return value.photoUse === 'included'
        || value.photoUse === 'excluded_mismatch'
        || value.photoUse === 'excluded_uncertain'
        ? { event: 'photo_check.completed', photoUse: value.photoUse }
        : null;
    case 'estimate.started':
      return { event: 'estimate.started' };
    case 'result':
      return isAiMealEstimatePreview(value.data) ? { event: 'result', data: value.data } : null;
    case 'error':
      return value.code === 'processing_failed'
        ? { event: 'error', code: 'processing_failed' }
        : null;
    default:
      return null;
  }
}

/** Parses complete NDJSON records from Axios' cumulative XHR responseText. */
export function createAiMealEstimateProgressParser(
  onProgress: (event: AiMealEstimatePhaseEvent) => void,
): (responseText: string) => void {
  let observedText = '';
  let pendingText = '';

  return (responseText) => {
    const newText = responseText.startsWith(observedText)
      ? responseText.slice(observedText.length)
      : responseText;
    observedText = responseText;
    pendingText += newText;

    const records = pendingText.split('\n');
    pendingText = records.pop() ?? '';
    const events = records
      .map((record) => {
        try {
          return parseAiMealEstimateProgressEvent(JSON.parse(record.trim()));
        } catch {
          return null;
        }
      })
      .filter((event): event is AiMealEstimateProgressEvent => event !== null);

    const pendingRecord = pendingText.trim();
    if (pendingRecord.length > 0) {
      try {
        const pendingEvent = parseAiMealEstimateProgressEvent(JSON.parse(pendingRecord));
        if (pendingEvent?.event === 'result' || pendingEvent?.event === 'error') return;
      } catch {
        // The last record may still be arriving in another progress update.
      }
    }
    if (events.some((event) => event.event === 'result' || event.event === 'error')) return;
    events.forEach((event) => {
      if (event.event === 'photo_check.completed' || event.event === 'estimate.started') {
        onProgress(event);
      }
    });
  };
}

function parseAiMealEstimateProgressResponse(responseText: string): AiMealEstimatePreview {
  let result: AiMealEstimatePreview | null = null;
  for (const record of responseText.split(/\r?\n/)) {
    if (record.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(record);
    } catch {
      throw new Error('Die KI-Schätzung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    }
    const event = parseAiMealEstimateProgressEvent(parsed);
    if (event?.event === 'error') {
      throw new Error('Die KI-Schätzung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    }
    if (event?.event === 'result') result = event.data;
  }
  if (result) return result;
  throw new Error('Die KI-Schätzung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
}

function getProgressResponseText(event: import('axios').AxiosProgressEvent): string | null {
  const responseText: unknown = event.event?.target?.responseText;
  return typeof responseText === 'string' ? responseText : null;
}

// Re-export for convenience so callers don't need to import from @fittrack/shared directly
export type {
  AiFoodEstimatePreview,
  NutritionLabelScanResult,
  AiMealEstimatePreview,
  RecipeScalePreviewResponse,
};

// ---------------------------------------------------------------------------
// Types — mirror backend MealParserPreviewItem
// ---------------------------------------------------------------------------

export type ItemStatus = 'matched' | 'needsSelection' | 'unmatched' | 'seasoning';

export interface MealParserPreviewItem {
  rawText: string;
  displayName: string;
  status: ItemStatus;
  category?: 'food' | 'seasoning';
  selectedProductId: string | null;
  selectedProductName: string | null;
  candidates: FoodSearchResult[];
  inputMode: 'grams' | 'portion' | 'unknown';
  inputAmount: number | null;
  amountGrams: number | null;
  needsReview: boolean;
  warnings: string[];
  kitchenAmountText?: string | null;  // populated for seasoning items only
}

export interface MealParserPreviewResponse {
  items: MealParserPreviewItem[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Types — mirror backend AiRecipeAnalysisResponse
// ---------------------------------------------------------------------------

export interface AiRecipeStep {
  order: number;
  title: string | null;
  description: string;
}

export interface AiRecipeAnalysisIngredient extends MealParserPreviewItem {
  analysisKey: string;
}

export interface AiRecipeAnalysis {
  suggestedName: string;
  description: string;
  suggestedPortions: number;
  tags: string[];
  steps: AiRecipeStep[];
  ingredients: AiRecipeAnalysisIngredient[];
  exportSuggestion?: RecipeExportSuggestion;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const aiApi = {
  /**
   * POST /api/ai/meal-parser/preview — parse free-text meal and match against internal DB.
   * @param text     Food items as free text or comma-separated list.
   * @param context  Optional eating context (e.g. "Bäcker") — improves portion estimation.
   */
  previewMeal(text: string, context?: string): Promise<MealParserPreviewResponse> {
    return apiClient
      .post<MealParserPreviewResponse>('/ai/meal-parser/preview', { text, context }, { timeout: 60_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/food-estimate/preview — estimate nutrition for an unmatched food item */
  estimateFood(input: { name: string; contextText?: string }): Promise<AiFoodEstimatePreview> {
    return apiClient
      .post<AiFoodEstimatePreview>('/ai/food-estimate/preview', input, { timeout: 60_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/label-scan — OCR + AI parse a nutrition label image */
  scanLabel(imageUri: string, mimeType: 'image/jpeg' | 'image/png'): Promise<NutritionLabelScanResult> {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: mimeType,
      name: `label.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
    } as unknown as Blob);

    return apiClient
      .post<NutritionLabelScanResult>('/ai/label-scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000, // OCR + AI can take 20-30s
      })
      .then((r) => r.data);
  },

  /**
   * POST /api/ai/meal-estimate/preview
   * Fast Path: estimate total meal nutrition + components in a single AI call.
   * When imageUri is provided, the request is sent as multipart/form-data
   * including the photo so the AI can use it to improve portion estimation.
   */
  estimateMeal(
    text: string,
    imageUri?: string,
    imageMimeType?: 'image/jpeg' | 'image/png',
    refine?: AiMealEstimateRefine,
    options?: AiMealEstimateRequestOptions,
  ): Promise<AiMealEstimatePreview> {
    if (imageUri && imageMimeType) {
      const formData = new FormData();
      formData.append('text', text);
      if (refine) formData.append('refine', JSON.stringify(refine));
      formData.append('image', {
        uri: imageUri,
        type: imageMimeType,
        name: `meal.${imageMimeType === 'image/png' ? 'png' : 'jpg'}`,
      } as unknown as Blob);
      const progressParser = options?.onProgress
        ? createAiMealEstimateProgressParser(options.onProgress)
        : null;
      return apiClient
        .post<AiMealEstimatePreview | string>('/ai/meal-estimate/preview', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Accept: 'application/x-ndjson',
          },
          timeout: 60_000,
          ...(options?.signal ? { signal: options.signal } : {}),
          ...(progressParser ? {
            onDownloadProgress: (event) => {
              const responseText = getProgressResponseText(event);
              if (responseText !== null) progressParser(responseText);
            },
          } : {}),
        })
        .then((r) => typeof r.data === 'string'
          ? parseAiMealEstimateProgressResponse(r.data)
          : r.data);
    }
    return apiClient
      .post<AiMealEstimatePreview>('/ai/meal-estimate/preview', {
        text,
        ...(refine ? { refine } : {}),
      }, {
        timeout: 60_000,
        ...(options?.signal ? { signal: options.signal } : {}),
      })
      .then((r) => r.data);
  },

  /** POST /api/ai/recipe-analyze — parse freetext recipe into name, description, steps, and resolved ingredients */
  analyzeRecipe(text: string): Promise<AiRecipeAnalysis> {
    return apiClient
      .post<AiRecipeAnalysis>('/ai/recipe-analyze', { text }, { timeout: 90_000 })
      .then((r) => r.data);
  },

  /** POST /api/ai/recipe-scale/preview — adapt recipe text for a temporary target portion count */
  previewRecipeScale(
    request: RecipeScalePreviewRequest,
    signal?: AbortSignal,
  ): Promise<RecipeScalePreviewResponse> {
    return apiClient
      .post<RecipeScalePreviewResponse>(
        '/ai/recipe-scale/preview',
        request,
        { timeout: 90_000, signal },
      )
      .then((r) => r.data);
  },

  /** GET /api/ai/daily-insight — explicit local date plus local time context */
  getDailyInsight(referenceDate?: string): Promise<DailyInsightResponse> {
    const now = new Date();
    const { currentLocalDate, currentHour } = getLocalDateContext(now);
    const timezoneOffsetMinutes = getLocalTimezoneOffsetMinutes(now);

    return apiClient
      .get<DailyInsightResponse>('/ai/daily-insight', {
        params: {
          date: referenceDate ?? currentLocalDate,
          ...(currentHour === null ? {} : { localHour: currentHour }),
          ...(timezoneOffsetMinutes === null ? {} : { timezoneOffsetMinutes }),
        },
      })
      .then((r) => r.data);
  },

  /** POST /api/ai/food-estimate/batch — estimate nutrition for up to 10 items in one AI call */
  estimateFoodBatch(items: Array<{ name: string }>): Promise<AiFoodEstimatePreview[]> {
    return apiClient
      .post<{ results: AiFoodEstimatePreview[] }>('/ai/food-estimate/batch', { items }, { timeout: 60_000 })
      .then((r) => r.data.results);
  },

  /** POST /api/ai/daily-insight/feedback — submit feedback for one exact Daily instance */
  submitDailyInsightFeedback(request: InsightFeedbackRequest): Promise<InsightFeedbackResponse> {
    return apiClient
      .post<InsightFeedbackResponse>('/ai/daily-insight/feedback', request)
      .then((r) => r.data);
  },

  /** GET /api/ai/weekly-insight?date=YYYY-MM-DD */
  getWeeklyInsight(referenceDate: string): Promise<WeeklyNutritionReviewResponse> {
    return apiClient
      .get<WeeklyNutritionReviewResponse>('/ai/weekly-insight', { params: { date: referenceDate } })
      .then((r) => r.data);
  },
};

