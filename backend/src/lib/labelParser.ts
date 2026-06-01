// Label parser: takes raw OCR text from a nutrition label and uses Azure OpenAI
// to map it to structured nutrition data (NutritionLabelScanResult).

import { AzureOpenAI } from 'openai';
import type { NutritionLabelScanResult } from '@fittrack/shared';

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
// System prompt
// ---------------------------------------------------------------------------

const LABEL_SCAN_SYSTEM_PROMPT = `You are a nutrition label parsing assistant.
You receive OCR-extracted text from a food product's nutrition label (may be German or English).

The OCR text is reconstructed from a multi-column nutrition label table into rows.
Within each row, columns are separated by TAB characters (\t).

Two common formats (both occur in the same OCR output):
  Format A — same row:  "Eiweiß (g)\t8,35\t23"     → protein per 100g = 8.35 g
  Format B — next row:  "Salz (g)"                  → salt name on its own line
                        "0,17\t0,46"                → salt values on next line (100g | serving)

IMPORTANT — split nutrient names across two lines:
  Sometimes a long nutrient name wraps onto two consecutive lines before the values appear.
  Example:
    "davon gesättigte"          ← first part of name (no values)
    "Fettsäuren (g)\t0,2\t0,5" ← second part + values → this is saturatedFat per 100g = 0.2
  When you see "Fettsäuren" or "Fettsäuren (g)" preceded by "davon gesättigte" (or similar),
  treat the combined name as "davon gesättigte Fettsäuren" = saturatedFat.
  Apply the same logic for any nutrient name that appears to be split: look one line back.

Columns:
  Column 1: Nutrient name
  Column 2: Value per 100g (or per 100ml)  ← ALWAYS USE THIS
  Column 3: Value per serving              ← IGNORE (unless column 2 is absent)

  The column header row (e.g. "Durchschnittliche Nährwerte\tPro 100g\tPro 270g") tells you
  the column order AND the serving size weight (e.g. "Pro 270g" → servingSize.weightGrams = 270).

Rules:
- Always use Column 2 (per 100g/ml) values. Never use Column 3 for nutrition values.
- If only one numeric column exists, use that column.
- German decimal separator is comma: "8,35" = 8.35, "0,5" = 0.5.
- Nutrient name mappings (German → field):
  • "Energie" / "Energy"                         → calories (kcal only — see below)
  • "Fett" / "Fat"                               → fat
  • "davon gesättigte Fettsäuren" / "saturates"  → saturatedFat
  • "Kohlenhydrate" / "Carbohydrate"             → carbs
  • "davon Zucker" / "of which sugars"           → sugar
  • "Eiweiß" / "Protein"                        → protein
  • "Ballaststoffe" / "Fibre"                    → fiber
  • "Salz" / "Salt"                              → salt
- "calories" = kcal value only.
  • "kJ/kcal" format like "252/60": SECOND number = kcal → calories = 60.
  • "681/161": SECOND number 161 = kcal per serving → ignore (use per-100g column).
  • Only kJ given: convert kcal = kJ ÷ 4.184.
- OCR errors to watch for:
  • "0,5" may be read as "05" or "5" → if fat/salt/saturatedFat seems implausibly high, halve it
  • Trailing period "5." means truncated decimal → treat as unknown decimal (e.g. 5.x)
  • Garbled values (non-numeric like "の6Mろ") → set to null
- Extract product name and brand if visible on the label.
- Set confidence 0.0–1.0 based on completeness and clarity.
- Add warnings for missing values, OCR errors, or unit ambiguity.
- If the text is not a nutrition label, set all values to null, confidence to 0, and add a warning.`;

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
