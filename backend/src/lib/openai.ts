// Azure OpenAI client and prompt builders.
// All AI calls are backend-only. No AI keys are exposed to mobile.
// Uses Structured Outputs (API version >= 2024-07-01, model >= gpt-4o-mini 2024-07-18).

import { AzureOpenAI } from 'openai';

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

const SYSTEM_PROMPT = `You are a meal parsing assistant for a nutrition tracking app.
Extract individual food items from the user's free-text meal description.
For each item, identify:
- rawText: the exact text fragment referring to this item
- displayName: a clean, normalized German name for the item that preserves all meaningful type and product qualifiers
  Good examples: "Sandwich Vollkorntoast", "Hähnchenbrust", "Lätta Halbfettmargarine", "Vollmilch 3,5%"
  Bad examples (too stripped): "Toast", "Fleisch", "Margarine" — these lose important information
- inputMode: "grams" if a weight in grams is mentioned, "portion" if a count/piece/portion is mentioned, "unknown" if unclear
- inputAmount: the numeric amount (e.g. 200 for "200g", 2 for "2 Scheiben"), or null if unknown

Rules:
- Do NOT invent or estimate nutrition values.
- Do NOT combine multiple ingredients into one item.
- Preserve product type qualifiers (Sandwich, Vollkorn, Fett-%, brand hints) in displayName — they affect nutrition significantly.
- Respond only with the structured JSON output.`;

/**
 * Parse a free-text meal description into structured items via Azure OpenAI.
 * Uses Structured Outputs for guaranteed schema compliance.
 */
export async function parseMeal(text: string): Promise<AiParsedItem[]> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt4o-mini';

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
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

const FOOD_ESTIMATE_SYSTEM_PROMPT = `You are a nutrition estimation assistant for a German food tracking app.
The user provides a food name and optional context (the original text they typed).
Estimate nutritional values per 100 g and a typical portion size.

## Nutrition per 100 g — two-step process

**Step 1 — Category average:** Recall the typical mid-range values for this food category from the German Bundeslebensmittelschlüssel (BLS) or equivalent European food composition data.

**Step 2 — Specific product:** Identify a well-known, widely available German retail product that fits the user's input (e.g. from Aldi, Lidl, Rewe, Edeka, Ja!, Golden Toast, Weihenstephan, etc.). If you know the product's nutritional values from its packaging, use those values — provided they fall within a plausible range for the category (±30 % of category average). Set "sourceProduct" to the product name (brand + variant), e.g. "Golden Toast Vollkorn" or "Ja! Vollkorntoast".
If no specific product comes to mind or its values seem implausible, fall back to the category average and set "sourceProduct" to null.

## Portion size (estimatedPortion)
Always define estimatedPortion as the **single serving unit** for the food type (one slice, one piece, one cup, etc.).
- "label": name of a single unit in German (e.g. "1 Scheibe", "1 Stück", "1 Portion")
- "weightGrams": weight of that single unit in grams
- "suggestedAmount": if the context text specifies a count (e.g. "2 Scheiben", "3 Stück"), set this to that count; otherwise set to null

Example: "2 Scheiben Vollkorntoast"
→ label: "1 Scheibe", weightGrams: 37.5, suggestedAmount: 2

Example: "Hähnchenbrust" (no count given)
→ label: "1 Portion", weightGrams: 150, suggestedAmount: null

This allows the app to display "2 × 1 Scheibe (37,5 g)" to the user.

## Confidence
- Generic, well-known foods (e.g. "Hähnchenbrust", "Vollmilch"): 0.7–0.9
- Branded or specific products (unknown recipe): 0.3–0.5
- Homemade or very ambiguous items: 0.2–0.4

## Rules
- Be conservative. Never hallucinate precise values.
- Add a warning string for each area of uncertainty.
- All numeric values must be non-negative.
- category: general food category in German (e.g. "Fleisch", "Getreideprodukte", "Milchprodukte").
- searchTerms: 5–10 lowercase German keywords that help users find this product later. Include: food type, category synonyms, brand words (if sourceProduct is set), common alternate names, and relevant qualifiers (e.g. "vollkorn", "toast", "brot", "sandwich", "golden toast"). No duplicates.
- Respond only with the structured JSON output.`;

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
