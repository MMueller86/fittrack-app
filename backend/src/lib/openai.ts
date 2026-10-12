// Azure OpenAI client and prompt builders.
// All AI calls are backend-only. No AI keys are exposed to mobile.
// Uses Structured Outputs (API version >= 2024-07-01, model >= gpt-4o-mini 2024-07-18).

import { AzureOpenAI } from 'openai';
import type { RecipeExportPreparationDiagnostic } from './recipeAnalyzeValidation';
import { importContractViolations } from './recipeAnalyzeValidation';
import { redistributeExportReferences, sortExportStepsBySourceOrder } from './recipePreparationOrder';
import { enforceSourceBackedTotalTime } from './recipeTotalTimeGuard';
import { blockingImportViolations, importCorrectionFeedback, importViolations, stripCookingEssential } from './recipeImportCookingCheck';
import { z } from 'zod';
import { MEAL_PARSER_SYSTEM_PROMPT } from './prompts/mealParser';
import { FOOD_ESTIMATE_SYSTEM_PROMPT } from './prompts/foodEstimate';
import { MEAL_ESTIMATE_SYSTEM_PROMPT } from './prompts/mealEstimate';
import { RECIPE_ANALYZE_SYSTEM_PROMPT, RECIPE_PREPARATION_SYSTEM_PROMPT, RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT, RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT } from './prompts/recipeAnalyze';
import { RECIPE_SCALE_SYSTEM_PROMPT } from './prompts/recipeScale';
import {
  DAILY_INSIGHT_PROMPT_VERSION,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  buildDailyInsightPrompt,
  type DailyInsightPromptSnapshot,
} from './prompts/dailyInsightPrompt';
import { DAILY_INSIGHT_SCHEMA } from './dailyInsightSchema';
import {
  WEEKLY_INSIGHT_SYSTEM_PROMPT,
  WEEKLY_INSIGHT_PROMPT_VERSION,
  WEEKLY_INSIGHT_TEXT_MAX_LENGTH,
  type WeeklyInsightPromptContext,
} from './prompts/weeklyInsightV2';
import type { InsightInputContext, InsightIntent, InsightResponse } from '@fittrack/shared';
import { selectInsightIntent } from './dailyInsightIntent';
import { toInsightResponse, validateDailyInsightResponse } from './dailyInsightValidation';
import { validateWeeklyInsightExceedanceClaims } from './weeklyInsightValidation';
import {
  RECIPE_EXPORT_MAX_STEP_LENGTH,
  RECIPE_EXPORT_MAX_STEPS,
  RECIPE_EXPORT_MIN_STEPS,
  RECIPE_EXPORT_MAX_TEASER_LENGTH,
  RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES,
} from '../../../shared/types/recipeExport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One item as extracted by the AI from free-text meal input. */
export interface AiParsedItem {
  rawText: string;
  displayName: string;
  inputMode: 'grams' | 'portion' | 'unknown';
  inputAmount: number | null;
}

/** Structured output schema returned by the AI (JSON Schema for Structured Outputs). */
const PARSED_MEAL_SCHEMA = {
  type: 'object' as const,
  properties: {
    items: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          rawText: { type: 'string' as const },
          displayName: { type: 'string' as const },
          inputMode: { type: 'string' as const, enum: ['grams', 'portion', 'unknown'] },
          inputAmount: { type: ['number', 'null'] as const },
        },
        required: ['rawText', 'displayName', 'inputMode', 'inputAmount'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Client factory (lazy singleton)
// ---------------------------------------------------------------------------

let _client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!_client) {
    const endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    const apiKey = process.env['AZURE_OPENAI_API_KEY'];
    const apiVersion = process.env['AZURE_OPENAI_API_VERSION'] ?? '2024-07-01';

    if (!endpoint || !apiKey) {
      throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set');
    }

    _client = new AzureOpenAI({ endpoint, apiKey, apiVersion });
  }
  return _client;
}

/** Reset the singleton — used in tests to inject a mock. */
export function __setOpenAiClientForTests(client: AzureOpenAI | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Meal parser
// ---------------------------------------------------------------------------



/**
 * Parse a free-text meal description into structured items via Azure OpenAI.
 * Uses Structured Outputs for guaranteed schema compliance.
 * @param text  The food items to parse (free text or comma-separated component list).
 * @param context  Optional eating context (e.g. "Bäcker", "Restaurant") — used to improve
 *                 portion estimation; it is NOT treated as a food item.
 */
export async function parseMeal(text: string, context?: string): Promise<AiParsedItem[]> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const userContent = context
    ? `Kontext: Diese Mahlzeit wurde in folgendem Umfeld verzehrt: ${context}.\nNutze diesen Kontext zur Portionsschätzung, aber behandle den Kontext NICHT als eigenständigen Lebensmittel-Eintrag.\n\n${text}`
    : text;

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: MEAL_PARSER_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'parsed_meal',
        strict: true,
        schema: PARSED_MEAL_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  const parsed = JSON.parse(raw) as { items: AiParsedItem[] };
  return parsed.items;
}

// ---------------------------------------------------------------------------
// Food nutrition estimator
// ---------------------------------------------------------------------------

/** AI-estimated nutrition for a single food item. */
export interface AiFoodEstimate {
  displayName: string;
  estimatedNutritionPer100g: {
    per: '100g';
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    salt: number | null;
  };
  estimatedPortion: {
    label: string;
    weightGrams: number;
    suggestedAmount: number | null;
  } | null;
  category: string | null;
  /** Specific product used as nutritional reference, or null if only category average. */
  sourceProduct: string | null;
  /** Lowercase German search keywords for findability (synonyms, category, brand words). */
  searchTerms: string[];
  /** 0.0 = very uncertain, 1.0 = highly confident */
  confidence: number;
  warnings: string[];
}

const FOOD_ESTIMATE_SCHEMA = {
  type: 'object' as const,
  properties: {
    displayName: { type: 'string' as const },
    estimatedNutritionPer100g: {
      type: 'object' as const,
      properties: {
        per: { type: 'string' as const, enum: ['100g'] },
        calories: { type: 'number' as const },
        protein: { type: 'number' as const },
        carbs: { type: 'number' as const },
        fat: { type: 'number' as const },
        fiber: { type: ['number', 'null'] as const },
        salt: { type: ['number', 'null'] as const },
      },
      required: ['per', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'salt'],
      additionalProperties: false,
    },
    estimatedPortion: {
      anyOf: [
        {
          type: 'object' as const,
          properties: {
            label: { type: 'string' as const },
            weightGrams: { type: 'number' as const },
            suggestedAmount: { type: ['number', 'null'] as const },
          },
          required: ['label', 'weightGrams', 'suggestedAmount'],
          additionalProperties: false,
        },
        { type: 'null' as const },
      ],
    },
    category: { type: ['string', 'null'] as const },
    sourceProduct: { type: ['string', 'null'] as const },
    searchTerms: { type: 'array' as const, items: { type: 'string' as const } },
    confidence: { type: 'number' as const },
    warnings: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: [
    'displayName',
    'estimatedNutritionPer100g',
    'estimatedPortion',
    'category',
    'sourceProduct',
    'searchTerms',
    'confidence',
    'warnings',
  ],
  additionalProperties: false,
};



/**
 * Estimate the nutritional values of a food item via Azure OpenAI.
 * Returns AI estimate including confidence and warnings.
 * Server-side validator must still verify the output before trusting it.
 */
export async function estimateFood(input: {
  name: string;
  contextText?: string;
}): Promise<AiFoodEstimate> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const userMessage = input.contextText
    ? `Food item: ${input.name}\nUser's original input: "${input.contextText}"`
    : `Food item: ${input.name}`;

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: FOOD_ESTIMATE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'food_estimate',
        strict: true,
        schema: FOOD_ESTIMATE_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  return JSON.parse(raw) as AiFoodEstimate;
}

// ---------------------------------------------------------------------------
// Meal estimator (Fast Path — overall meal nutrition + components)
// ---------------------------------------------------------------------------

/** AI-estimated overall meal nutrition. Values represent the complete meal, NOT per 100g. */
export interface AiMealEstimate {
  mealName: string;
  mealEstimate: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  components: string[];
  contextDetected: string | null;
  portionConfidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  warnings: string[];
}

const MEAL_ESTIMATE_SCHEMA = {
  type: 'object' as const,
  properties: {
    mealName: { type: 'string' as const },
    mealEstimate: {
      type: 'object' as const,
      properties: {
        calories: { type: 'number' as const },
        protein: { type: 'number' as const },
        carbs: { type: 'number' as const },
        fat: { type: 'number' as const },
        fiber: { type: 'number' as const },
      },
      required: ['calories', 'protein', 'carbs', 'fat', 'fiber'],
      additionalProperties: false,
    },
    components: { type: 'array' as const, items: { type: 'string' as const } },
    contextDetected: { type: ['string', 'null'] as const },
    portionConfidence: { type: 'string' as const, enum: ['high', 'medium', 'low'] },
    assumptions: { type: 'array' as const, items: { type: 'string' as const } },
    warnings: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['mealName', 'mealEstimate', 'components', 'contextDetected', 'portionConfidence', 'assumptions', 'warnings'],
  additionalProperties: false,
};



/**
 * Estimate the total nutrition of a described meal via Azure OpenAI.
 * Optionally accepts a base64-encoded image to improve accuracy.
 * Returns overall meal macros (NOT per 100g) plus component list and context.
 */
export async function estimateMeal(input: {
  text: string;
  imageBase64?: string;
  imageMimeType?: 'image/jpeg' | 'image/png';
}): Promise<AiMealEstimate> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } };

  const userContent: ContentPart[] = [{ type: 'text', text: input.text }];

  if (input.imageBase64 && input.imageMimeType) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${input.imageMimeType};base64,${input.imageBase64}`,
        detail: 'low', // 'low' is sufficient for portion estimation; saves tokens
      },
    });
  }

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: MEAL_ESTIMATE_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'meal_estimate',
        strict: true,
        schema: MEAL_ESTIMATE_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  return JSON.parse(raw) as AiMealEstimate;
}

// ---------------------------------------------------------------------------
// Recipe text analyzer
// ---------------------------------------------------------------------------

/** One ingredient line extracted and classified by the recipe analyzer. */
export interface AiRecipeIngredientLine {
  /** Stable key used by the export suggestion to reference this ingredient. */
  analysisKey: string;
  line: string;
  displayName: string;
  category: 'food' | 'seasoning';
  amountGrams: number | null;
  kitchenAmountText: string | null;  // populated for seasoning; null for food
}

/** One export step with source anchors retained for server-side validation. */
export interface AiRecipeExportStep {
  order: number;
  description: string;
  sourceStepOrders: number[];
  ingredientKeys: string[];
}

/** Transient export suggestion returned with recipe analysis for user review. */
export interface AiRecipeExportSuggestion {
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: AiRecipeExportStep[];
  includedIngredientKeys: string[];
}

/**
 * Raw recipe data extracted by the AI from free-text input.
 * ingredients (food items) are passed to catalog search afterward.
 */
export interface AiRecipeRaw {
  suggestedName: string;
  description: string;
  suggestedPortions: number;
  tags: string[];
  ingredients: AiRecipeIngredientLine[];
  steps: Array<{
    order: number;
    title: string | null;
    description: string;
  }>;
  exportSuggestion: AiRecipeExportSuggestion;
}

const RECIPE_ANALYZE_SCHEMA = {
  type: 'object' as const,
  properties: {
    suggestedName: { type: 'string' as const },
    description: { type: 'string' as const },
    suggestedPortions: { type: 'number' as const },
    tags: { type: 'array' as const, items: { type: 'string' as const } },
    ingredients: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          analysisKey: { type: 'string' as const },
          line: { type: 'string' as const },
          displayName: { type: 'string' as const },
          category: { type: 'string' as const, enum: ['food', 'seasoning'] },
          amountGrams: { type: ['number', 'null'] as const, minimum: 0.000001 },
          kitchenAmountText: { type: ['string', 'null'] as const },
        },
        required: ['analysisKey', 'line', 'displayName', 'category', 'amountGrams', 'kitchenAmountText'],
        additionalProperties: false,
      },
    },
    steps: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          order: { type: 'number' as const },
          title: { type: ['string', 'null'] as const },
          description: { type: 'string' as const },
          cookingEssential: { type: 'boolean' as const },
        },
        required: ['order', 'title', 'description', 'cookingEssential'],
        additionalProperties: false,
      },
    },
    exportSuggestion: {
    type: 'object' as const,
    properties: {
      version: { type: 'integer' as const, enum: [1] },
      teaser: { type: 'string' as const },
      totalTimeMinutes: { type: ['integer', 'null'] as const },
      difficulty: { type: ['string', 'null'] as const },
      steps: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            order: { type: 'integer' as const },
            description: {
              type: 'string' as const,
              maxLength: RECIPE_EXPORT_MAX_STEP_LENGTH,
            },
            sourceStepOrders: {
              type: 'array' as const,
              items: { type: 'integer' as const },
            },
            ingredientKeys: {
              type: 'array' as const,
              items: { type: 'string' as const },
            },
          },
          required: ['order', 'description', 'sourceStepOrders', 'ingredientKeys'],
          additionalProperties: false,
        },
        maxItems: RECIPE_EXPORT_MAX_STEPS,
      },
      includedIngredientKeys: {
        type: 'array' as const,
        items: { type: 'string' as const },
      },
    },
    required: ['version', 'teaser', 'totalTimeMinutes', 'difficulty', 'steps', 'includedIngredientKeys'],
    additionalProperties: false,
    },
  },
  required: ['suggestedName', 'description', 'suggestedPortions', 'tags', 'ingredients', 'steps', 'exportSuggestion'],
  additionalProperties: false,
};



/**
 * Analyze a free-text recipe description via Azure OpenAI.
 * Returns structured recipe metadata + raw ingredient lines for further catalog matching.
 */
export interface RecipePreparationContext {
  recipeContext: {
    name: string;
    description?: string;
    portions: number;
    tags: string[];
    ingredients: Array<{
      displayName: string;
      amountGrams: number | null;
      inputAmount: number | null;
      unit: string;
    }>;
  };
  steps: Array<{ order: number; title?: string; description: string }>;
}

export interface RecipeExportPreparationOutput {
  version: 1;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: string | null;
  steps: Array<{ order: number; description: string; sourceStepOrders: number[] }>;
}

const RECIPE_EXPORT_PREPARATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    version: { type: 'integer' as const, enum: [1] },
    teaser: { type: 'string' as const, minLength: 1, maxLength: RECIPE_EXPORT_MAX_TEASER_LENGTH },
    totalTimeMinutes: { type: ['integer', 'null'] as const, minimum: 1, maximum: RECIPE_EXPORT_MAX_TOTAL_TIME_MINUTES },
    difficulty: { type: ['string', 'null'] as const, minLength: 1 },
    steps: {
      type: 'array' as const, minItems: RECIPE_EXPORT_MIN_STEPS, maxItems: RECIPE_EXPORT_MAX_STEPS,
      items: {
        type: 'object' as const,
        properties: {
          order: { type: 'integer' as const, minimum: 1 },
          description: { type: 'string' as const, minLength: 1, maxLength: RECIPE_EXPORT_MAX_STEP_LENGTH },
          sourceStepOrders: { type: 'array' as const, minItems: 1, items: { type: 'integer' as const, minimum: 1 } },
        },
        required: ['order', 'description', 'sourceStepOrders'],
        additionalProperties: false,
      },
    },
  },
  required: ['version', 'teaser', 'totalTimeMinutes', 'difficulty', 'steps'],
  additionalProperties: false,
};

export interface RecipePreparationProviderOptions {
  correction?: { latestDraft: unknown; validationErrors: RecipeExportPreparationDiagnostic[] };
  signal?: AbortSignal;
  timeout?: number;
}

/** Character budget for a text that measured actual vs bounds; 25 % below the proportional fit so a rewrite cannot repeat the overflowing text. */
export function textCorrectionLimit(text: string, actual: { width: number; height?: number }, bounds: { width: number; height?: number }): number {
  const ratios = [bounds.width / actual.width, actual.height && bounds.height !== undefined ? bounds.height / actual.height : 1]
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0);
  return Math.max(10, Math.floor(text.length * Math.min(1, ...ratios) * 0.75));
}

export async function prepareRecipeExport(preparation: RecipePreparationContext, options: RecipePreparationProviderOptions = {}): Promise<RecipeExportPreparationOutput> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';
  const correction = options.correction;
  const textOnly = correction && correction.validationErrors.length > 0 && correction.validationErrors.every((error) =>
    error.phase === 'template' && error.code === 'TEMPLATE_FIELD_OVERFLOW');
  const correctedDraft = textOnly ? structuredClone(correction.latestDraft) as RecipeExportPreparationOutput : undefined;
  const fields = correctedDraft ? [...new Map(correction!.validationErrors.map((error) => [error.path, error])).values()].map((error) => {
    const match = /^steps\[(\d+)\]\.description$/u.exec(error.path);
    const stepIndex = match ? Number(match[1]) : undefined;
    const text = error.path === 'teaser' ? correctedDraft.teaser : stepIndex !== undefined ? correctedDraft.steps[stepIndex]?.description : undefined;
    if (typeof text !== 'string' || !error.actual || !error.bounds) throw new Error('Invalid text correction target');
    return { stepIndex, text, actual: error.actual,
      bounds: { width: error.bounds.width, ...(error.bounds.height !== undefined ? { height: error.bounds.height } : {}) } };
  }) : undefined;
  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: fields ? RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT : correction ? RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT : RECIPE_PREPARATION_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(fields ? { texts: fields.map(({ text, actual, bounds }) => ({ text, actual, bounds, maxCharacters: textCorrectionLimit(text, actual, bounds) })) } : options.correction ? {
        originalPreparation: preparation,
        latestDraft: options.correction.latestDraft,
        validationErrors: options.correction.validationErrors,
      } : preparation) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: fields ? { name: 'recipe_text_correction', strict: true, schema: {
        type: 'object', properties: { texts: { type: 'array', minItems: fields.length, maxItems: fields.length,
          items: { type: 'string', minLength: 1, maxLength: RECIPE_EXPORT_MAX_TEASER_LENGTH } } },
        required: ['texts'], additionalProperties: false,
      } } : { name: 'recipe_export_preparation', strict: true, schema: RECIPE_EXPORT_PREPARATION_SCHEMA },
    },
    temperature: 0.2,
    max_tokens: 2048,
  }, { maxRetries: 0, timeout: Math.min(20_000, options.timeout ?? 20_000), signal: options.signal });
  const choice = response.choices[0];
  if (choice?.message?.refusal || (choice?.finish_reason && choice.finish_reason !== 'stop')) {
    throw new Error('Azure OpenAI preparation response was refused or incomplete');
  }
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');
  if (fields && correctedDraft) {
    const parsed = z.object({ texts: z.array(z.string().trim().min(1).max(RECIPE_EXPORT_MAX_TEASER_LENGTH)).length(fields.length) }).strict().parse(JSON.parse(raw));
    fields.forEach((field, index) => {
      if (field.stepIndex === undefined) correctedDraft.teaser = parsed.texts[index]!;
      else correctedDraft.steps[field.stepIndex]!.description = parsed.texts[index]!;
    });
    return correctedDraft;
  }
  return enforceSourceBackedTotalTime(sortExportStepsBySourceOrder(JSON.parse(raw) as RecipeExportPreparationOutput), preparation);
}

const IMPORT_CALL_TIMEOUT_MS = 30_000;
// No further correction is started once this much time is spent, bounding the worst case of three calls.
const IMPORT_CORRECTION_DEADLINE_MS = 45_000;

/** Import analysis still violates the server contract after the allowed corrections; details contain no recipe text. */
export class RecipeAnalysisContractError extends Error {
  constructor(readonly details: string[]) {
    super('AI recipe analysis failed server-side validation');
  }
}

export async function analyzeRecipeText(text: string): Promise<AiRecipeRaw> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: RECIPE_ANALYZE_SYSTEM_PROMPT },
    { role: 'user', content: text },
  ];
  let parsed!: AiRecipeRaw;
  const startedAt = Date.now();
  // Up to two directed corrections when the response breaks a deterministic import contract rule.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [...messages],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'recipe_analyze',
          strict: true,
          schema: RECIPE_ANALYZE_SCHEMA,
        },
      },
      temperature: 0.2,
      max_tokens: 2048,
    }, { timeout: IMPORT_CALL_TIMEOUT_MS, maxRetries: 1 });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from Azure OpenAI');

    const candidate = JSON.parse(raw) as AiRecipeRaw;
    parsed = stripCookingEssential(candidate);
    if (candidate.exportSuggestion) parsed = { ...parsed, exportSuggestion: sortExportStepsBySourceOrder(parsed.exportSuggestion) };
    const violations = importViolations(text, { ...candidate, exportSuggestion: parsed.exportSuggestion }, importContractViolations(parsed));
    if (violations.length === 0) break;
    if (attempt === 2 || Date.now() - startedAt > IMPORT_CORRECTION_DEADLINE_MS) {
      // Corrections exhausted. Soft violations are served; an invalid reference trace is repaired by moving references only
      // (steps and texts untouched); anything else fails in a controlled way (422, no usage).
      let blocking = blockingImportViolations(text, violations);
      if (blocking.length > 0 && blocking.every((violation) => violation.kind === 'trace') && parsed.exportSuggestion) {
        const repaired = { ...parsed, exportSuggestion: redistributeExportReferences(parsed.exportSuggestion) };
        if (importContractViolations(repaired).length === 0) {
          parsed = repaired;
          blocking = [];
        }
      }
      if (blocking.length > 0) throw new RecipeAnalysisContractError(blocking.map((violation) => violation.message));
      break;
    }
    messages.push({ role: 'assistant', content: raw }, { role: 'user', content: importCorrectionFeedback(violations) });
  }

  // Structured Outputs cannot express the category-dependent null rule for this field.
  return {
    ...parsed,
    ingredients: parsed.ingredients.map((ingredient) => {
      // Keep the historical runtime guard for malformed provider payloads:
      // only the explicit seasoning value takes the seasoning path.
      const category = ingredient.category === 'seasoning' ? 'seasoning' : 'food';
      return {
        ...ingredient,
        category,
        // The schema forbids 0, so the model sometimes emits a tiny placeholder for unmeasurable food such as spray oil.
        amountGrams: category === 'food' && typeof ingredient.amountGrams === 'number' && ingredient.amountGrams < 0.1 ? null : ingredient.amountGrams,
        kitchenAmountText: category === 'food' ? null : ingredient.kitchenAmountText ?? null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Recipe scale text preview
// ---------------------------------------------------------------------------

export interface AiRecipeScaleIngredientContext {
  displayName: string;
  category: 'food' | 'seasoning';
  inputMode: 'grams' | 'portion';
  unit: string;
  inputAmount: number | null;
  amountGrams: number | null;
  amountLabel: string | null;
}

export interface AiRecipeScaleInput {
  originalPortions: number;
  targetPortions: number;
  originalDescription: string | null;
  originalIngredients: AiRecipeScaleIngredientContext[];
  targetIngredients: AiRecipeScaleIngredientContext[];
  originalSteps: Array<{
    order: number;
    title: string | null;
    description: string;
  }>;
}

export interface AiRecipeScaleRaw {
  description: string | null;
  steps: Array<{
    order: number;
    title: string | null;
    description: string;
  }>;
}

const RECIPE_SCALE_SCHEMA = {
  type: 'object' as const,
  properties: {
    description: { type: ['string', 'null'] as const },
    steps: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          order: { type: 'number' as const },
          title: { type: ['string', 'null'] as const },
          description: { type: 'string' as const },
        },
        required: ['order', 'title', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['description', 'steps'],
  additionalProperties: false,
};

/**
 * Adapt recipe description and steps for a target portion count.
 * Ingredient quantities are calculated by the server and are included only
 * as context; they are never taken from the AI response.
 */
export async function scaleRecipeText(input: AiRecipeScaleInput): Promise<AiRecipeScaleRaw> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: RECIPE_SCALE_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'recipe_scale_preview',
        strict: true,
        schema: RECIPE_SCALE_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 2048,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  return JSON.parse(raw) as AiRecipeScaleRaw;
}

// ---------------------------------------------------------------------------
// Food nutrition batch estimator
// ---------------------------------------------------------------------------

const FOOD_ESTIMATE_BATCH_SCHEMA = {
  type: 'object' as const,
  properties: {
    items: {
      type: 'array' as const,
      items: FOOD_ESTIMATE_SCHEMA,
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const WEEKLY_INSIGHT_SCHEMA = {
  type: 'object' as const,
  properties: {
    text: { type: 'string' as const, minLength: 1, maxLength: WEEKLY_INSIGHT_TEXT_MAX_LENGTH },
  },
  required: ['text'],
  additionalProperties: false,
};

const WEEKLY_INSIGHT_RESPONSE_SCHEMA = z.object({
  text: z.string().trim().min(1).max(WEEKLY_INSIGHT_TEXT_MAX_LENGTH),
}).strict();

/**
 * Estimate the nutritional values of multiple food items in a single AI call.
 * Returns results in the same order as the input names array.
 */
export async function estimateFoodBatch(names: string[]): Promise<AiFoodEstimate[]> {
  if (names.length === 0) return [];

  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const userMessage = names.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: 'system',
        content:
          FOOD_ESTIMATE_SYSTEM_PROMPT +
          '\n\nDu erhältst eine nummerierte Liste von Lebensmitteln. Gib für jedes Lebensmittel einen Eintrag in "items" zurück – in derselben Reihenfolge wie die Eingabe.',
      },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'food_estimate_batch',
        strict: true,
        schema: FOOD_ESTIMATE_BATCH_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 4096,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  const parsed = JSON.parse(raw) as { items: AiFoodEstimate[] };
  return parsed.items;
}

// ---------------------------------------------------------------------------
// Weekly Insight generator
// ---------------------------------------------------------------------------

export interface GenerateWeeklyInsightResult {
  text: string;
  tokensUsed: number;
}

/**
 * Generate a weekly AI evaluation from server-calculated, sanitized data.
 * The caller owns caching, quota enforcement, and persistence.
 */
export async function generateWeeklyInsight(
  context: WeeklyInsightPromptContext,
): Promise<GenerateWeeklyInsightResult> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: WEEKLY_INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(context) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'weekly_insight',
        strict: true,
        schema: WEEKLY_INSIGHT_SCHEMA,
      },
    },
    temperature: 0.3,
    max_tokens: 1024,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('Weekly insight response was truncated by the provider');
  }

  const raw = choice?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI (weekly-insight)');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON response from Azure OpenAI (weekly-insight)');
  }

  const parsedResponse = WEEKLY_INSIGHT_RESPONSE_SCHEMA.safeParse(parsed);
  if (!parsedResponse.success) {
    throw new Error('Weekly insight response has an invalid schema');
  }

  const text = parsedResponse.data.text;
  const validation = validateWeeklyInsightExceedanceClaims(text, context.days);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Weekly insight response failed semantic validation');
  }

  return {
    text,
    tokensUsed: completion.usage?.total_tokens ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Daily Insight generator
// ---------------------------------------------------------------------------

export interface GenerateInsightResult {
  response: Omit<InsightResponse, 'generatedAt' | 'promptVersion' | 'status'>;
  tokensUsed: number;
  intent: InsightIntent;
  promptSnapshot: DailyInsightPromptSnapshot;
}

/**
 * Generate a daily AI insight from a structured input context.
 * Returns structured JSON parsed and validated by Zod.
 * Caller is responsible for caching and quota tracking.
 */
export async function generateDailyInsight(
  context: InsightInputContext,
  intent: InsightIntent = selectInsightIntent(context),
  promptSnapshot: DailyInsightPromptSnapshot = buildDailyInsightPrompt(intent, context),
): Promise<GenerateInsightResult> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: promptSnapshot.system },
      { role: 'user', content: promptSnapshot.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'daily_insight',
        strict: true,
        schema: DAILY_INSIGHT_SCHEMA,
      },
    },
    temperature: 0.4,
    max_tokens: 400,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length' || choice?.finish_reason === 'content_filter') {
    throw new Error(`Daily insight response rejected by provider: ${choice.finish_reason}`);
  }

  const raw = choice?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI (daily-insight)');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON response from Azure OpenAI (daily-insight)');
  }

  const validated = validateDailyInsightResponse(parsed, context, intent);

  const tokensUsed = completion.usage?.total_tokens ?? 0;

  return {
    response: toInsightResponse(validated),
    tokensUsed,
    intent,
    promptSnapshot,
  };
}

/** Exposed for mocking in tests. */
export {
  DAILY_INSIGHT_PROMPT_VERSION,
  DAILY_INSIGHT_PROMPT_FINGERPRINT,
  DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION,
  WEEKLY_INSIGHT_PROMPT_VERSION,
  WEEKLY_INSIGHT_TEXT_MAX_LENGTH,
};

export { DAILY_INSIGHT_SCHEMA } from './dailyInsightSchema';
