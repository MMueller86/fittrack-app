// Label parser: takes raw OCR text from a nutrition label and uses Azure OpenAI
// to map it to structured nutrition data (NutritionLabelScanResult).

import { AzureOpenAI } from 'openai';
import type { NutritionLabelScanResult } from '@fittrack/shared';
import { LABEL_SCAN_SYSTEM_PROMPT } from './prompts/labelScan';

// ---------------------------------------------------------------------------
// Client reuse — shares the singleton from openai.ts via the same env vars.
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
export function __setLabelParserClientForTests(client: AzureOpenAI | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// JSON Schema for Structured Outputs
// ---------------------------------------------------------------------------

const LABEL_SCAN_SCHEMA = {
  type: 'object' as const,
  properties: {
    productName: { type: ['string', 'null'] as const },
    brand: { type: ['string', 'null'] as const },
    baseUnit: { type: 'string' as const, enum: ['100g', '100ml', 'serving'] },
    servingSize: {
      anyOf: [
        {
          type: 'object' as const,
          properties: {
            label: { type: 'string' as const },
            weightGrams: { type: 'number' as const },
          },
          required: ['label', 'weightGrams'],
          additionalProperties: false,
        },
        { type: 'null' as const },
      ],
    },
    nutrition: {
      type: 'object' as const,
      properties: {
        calories: { type: ['number', 'null'] as const },
        protein: { type: ['number', 'null'] as const },
        carbs: { type: ['number', 'null'] as const },
        sugar: { type: ['number', 'null'] as const },
        fat: { type: ['number', 'null'] as const },
        saturatedFat: { type: ['number', 'null'] as const },
        fiber: { type: ['number', 'null'] as const },
        salt: { type: ['number', 'null'] as const },
      },
      required: ['calories', 'protein', 'carbs', 'sugar', 'fat', 'saturatedFat', 'fiber', 'salt'],
      additionalProperties: false,
    },
    confidence: { type: 'number' as const },
    warnings: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['productName', 'brand', 'baseUnit', 'servingSize', 'nutrition', 'confidence', 'warnings'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Parse raw OCR text into structured nutrition data using Azure OpenAI.
 */
export async function parseNutritionLabel(rawOcrText: string): Promise<Omit<NutritionLabelScanResult, 'rawOcrText' | 'ocrConfidence'>> {
  const client = getClient();
  const deployment = process.env['AZURE_OPENAI_DEPLOYMENT_NAME'] ?? 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: LABEL_SCAN_SYSTEM_PROMPT },
      { role: 'user', content: rawOcrText },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'nutrition_label_scan',
        strict: true,
        schema: LABEL_SCAN_SCHEMA,
      },
    },
    temperature: 0,
    max_tokens: 1024,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Azure OpenAI during label parsing');

  const parsed = JSON.parse(raw) as {
    productName: string | null;
    brand: string | null;
    baseUnit: '100g' | '100ml' | 'serving';
    servingSize: { label: string; weightGrams: number } | null;
    nutrition: NutritionLabelScanResult['nutrition'];
    confidence: number;
    warnings: string[];
  };

  return {
    productName: parsed.productName,
    brand: parsed.brand,
    baseUnit: parsed.baseUnit,
    servingSize: parsed.servingSize,
    nutrition: parsed.nutrition,
    aiConfidence: parsed.confidence,
    warnings: parsed.warnings,
  };
}
