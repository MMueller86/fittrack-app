// Azure OpenAI client and prompt builders.
// All AI calls are backend-only. No AI keys are exposed to mobile.
// Uses Structured Outputs (API version >= 2024-07-01, model >= gpt-4o-mini 2024-07-18).

import { AzureOpenAI } from 'openai';
import { MEAL_PARSER_SYSTEM_PROMPT } from './prompts/mealParser';
import { FOOD_ESTIMATE_SYSTEM_PROMPT } from './prompts/foodEstimate';
import { MEAL_ESTIMATE_SYSTEM_PROMPT } from './prompts/mealEstimate';
import { RECIPE_ANALYZE_SYSTEM_PROMPT } from './prompts/recipeAnalyze';
import { DAILY_INSIGHT_SYSTEM_PROMPT, DAILY_INSIGHT_PROMPT_VERSION } from './prompts/dailyInsightV9';
import type { InsightInputContext, InsightResponse } from '@fittrack/shared';

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
  line: string;
  displayName: string;
  category: 'food' | 'seasoning';
  amountGrams: number | null;
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
          line: { type: 'string' as const },
          displayName: { type: 'string' as const },
          category: { type: 'string' as const, enum: ['food', 'seasoning'] },
          amountGrams: { type: ['number', 'null'] as const },
        },
        required: ['line', 'displayName', 'category', 'amountGrams'],
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
        },
        required: ['order', 'title', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestedName', 'description', 'suggestedPortions', 'tags', 'ingredients', 'steps'],
  additionalProperties: false,
};



/**
 * Analyze a free-text recipe description via Azure OpenAI.
 * Returns structured recipe metadata + raw ingredient lines for further catalog matching.
 */
export async function analyzeRecipeText(text: string): Promise<AiRecipeRaw> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: RECIPE_ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
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
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI');

  return JSON.parse(raw) as AiRecipeRaw;
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
// Daily Insight generator
// ---------------------------------------------------------------------------

export interface GenerateInsightResult {
  response: Omit<InsightResponse, 'generatedAt' | 'promptVersion' | 'status'>;
  tokensUsed: number;
}

/**
 * Generate a daily AI insight from a structured input context.
 * Returns structured JSON parsed and validated by Zod.
 * Caller is responsible for caching and quota tracking.
 */
export async function generateDailyInsight(
  context: InsightInputContext,
): Promise<GenerateInsightResult> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const userMessage = JSON.stringify(context);

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: DAILY_INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,   // slight creativity for natural phrasing, but still predictable
    max_tokens: 400,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI (daily-insight)');

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Validate required fields
  if (typeof parsed['title'] !== 'string' || typeof parsed['summary'] !== 'string') {
    throw new Error('Daily insight response missing required fields: title, summary');
  }

  const response: Omit<InsightResponse, 'generatedAt' | 'promptVersion' | 'status'> = {
    title: String(parsed['title']).slice(0, 80),
    summary: String(parsed['summary']).slice(0, 600),
    recommendation:
      typeof parsed['recommendation'] === 'string' && parsed['recommendation'].length > 0
        ? parsed['recommendation']
        : undefined,
    cta:
      typeof parsed['cta'] === 'string' && parsed['cta'].length > 0
        ? parsed['cta']
        : undefined,
    ctaTarget:
      parsed['ctaTarget'] === 'Nutrition' ||
      parsed['ctaTarget'] === 'Weight' ||
      parsed['ctaTarget'] === 'Training' ||
      parsed['ctaTarget'] === 'Recipe'
        ? parsed['ctaTarget']
        : undefined,
  };

  const tokensUsed = completion.usage?.total_tokens ?? 0;

  return { response, tokensUsed };
}

/** Exposed for mocking in tests. */
export { DAILY_INSIGHT_PROMPT_VERSION };
