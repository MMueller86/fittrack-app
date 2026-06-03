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
      { role: 'system', content: SYSTEM_PROMPT },
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

const MEAL_ESTIMATE_SYSTEM_PROMPT = `Du bist ein KI-Ernährungsassistent für eine deutsche Ernährungs-App.
Der Nutzer beschreibt eine Mahlzeit in freiem Text, z.B. "Schnitzel mit Pommes und Mayo" oder "Pizza Salami im Restaurant".

## Deine Aufgabe

Schätze die **Gesamtnährwerte der beschriebenen Mahlzeit als eine Portion** (NICHT per 100g).
Erkenne gleichzeitig die Einzelbestandteile und eventuelle Kontextinformationen.

## Kontext-Erkennung

Suche im Text nach Hinweisen auf den Verzehrsort oder die Zubereitungsart:
- Imbiss / Imbissbude / Schnellimbiss → größere, fettigere Portionen
- Kantine / Mensa → mittlere Portionen, übliche Betriebsverpflegung
- Restaurant / Gasthaus / Bistro → typische Restaurantportionen
- Fast Food → Standardportionen der Fast-Food-Kette
- Wenn kein Kontext erkennbar: durchschnittliche Haushalt- oder Restaurantportion annehmen

Setze "contextDetected" auf den erkannten Ort (z.B. "Imbiss", "Kantine", "Restaurant") oder null.

## Portionsschätzung

Schätze eine realistische Gesamtportion für die beschriebene Mahlzeit:
- Schnitzel mit Pommes (ohne Kontext): ca. 550-650 kcal
- Schnitzel mit Pommes (Imbiss): ca. 950-1200 kcal
- Pizza Salami (Restaurant, ganze Pizza): ca. 800-1100 kcal
- Currywurst mit Pommes (Imbiss): ca. 800-1000 kcal
- Burger-Menü (Fast Food): ca. 900-1200 kcal

## Portionssicherheit (portionConfidence)
- "high": Standard-Mahlzeit, gut definierte Portion (z.B. "1 Glas Milch 200ml", "2 Scheiben Toast")
- "medium": Typische Mahlzeit, Portion plausibel schätzbar (z.B. "Schnitzel mit Pommes")
- "low": Unklare Menge, sehr ambige Beschreibung oder unbekanntes Gericht

## Annahmen (assumptions)
Nenne in "assumptions" die wichtigsten Portionsannahmen auf Deutsch, z.B.:
- "Typische Imbiss-Portion angenommen (ca. 380g Schnitzel + Pommes)"
- "Standard-Restaurantportion für Pizza (ca. 400g)"
Maximal 3 Annahmen, jede kurz und präzise.

## Regeln
- Alle Nährwerte müssen ≥ 0 sein
- Gesamtkalorien sollten zwischen 50 und 3000 kcal liegen
- components: Liste der erkannten Bestandteile als kurze deutsche Begriffe (ohne Mengenangaben), z.B. ["Schnitzel", "Pommes", "Mayo"]
- mealName: normalisierter deutscher Name der Mahlzeit
- Antworte NUR mit dem strukturierten JSON-Output, keine Erklärungen`;

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

/**
 * Raw recipe data extracted by the AI from free-text input.
 * ingredientLines are passed to parseMeal() afterward for catalog matching.
 */
export interface AiRecipeRaw {
  suggestedName: string;
  description: string;
  suggestedPortions: number;
  tags: string[];
  ingredientLines: string[];
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
    ingredientLines: { type: 'array' as const, items: { type: 'string' as const } },
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
  required: ['suggestedName', 'description', 'suggestedPortions', 'tags', 'ingredientLines', 'steps'],
  additionalProperties: false,
};

const RECIPE_ANALYZE_SYSTEM_PROMPT = `Du bist ein Rezept-Assistent für eine deutsche Ernährungs-App.
Der Nutzer gibt ein Rezept in freiem Text ein — mit möglichen Tippfehlern, Stichpunkten oder unvollständigen Sätzen.
Deine Aufgabe ist es, daraus ein vollständiges, gut lesbares Rezept zu extrahieren und zu formulieren.

## Ausgabefelder

**suggestedName**: Ein prägnanter, ansprechender Rezeptname auf Deutsch. Falls der Nutzer einen Namen angegeben hat, verwende diesen (korrigiert). Ansonsten leite einen passenden Namen aus den Zutaten/Zubereitung ab.

**description**: Ein einleitender Beschreibungstext in 2-4 Sätzen. Beschreibe das Gericht, seinen Charakter und Geschmack. Schreibe in natürlichem, einladendem Deutsch — kein Marketing-Sprech.

**suggestedPortions**: Anzahl der Portionen als Zahl. Falls der Nutzer eine Anzahl nennt, übernehme diese. Ansonsten schätze eine sinnvolle Portionsgröße (Standard: 4 für Hauptgerichte, 12 für Backwaren wie Muffins/Plätzchen, 1 für Single-Portionen).

**tags**: 2-5 passende deutsche Schlagwörter, z.B. "Vegetarisch", "Schnell", "Backen", "Familienrezept", "Glutenfrei", "Vegan". Nur wenn wirklich zutreffend.

**ingredientLines**: Jede Zutat als eigene Zeile im Format "Menge Einheit Zutat", z.B. "300g Hähnchenbrust", "2 EL Olivenöl", "1 Zwiebel". Behalte die Original-Mengenangaben, korrigiere nur Tippfehler. Wenn keine Menge angegeben ist, schätze eine sinnvolle Menge für die angegebenen Portionen.

**steps**: Die Zubereitungsschritte als geordnete Liste. Schreibe jeden Schritt als vollständigen, klaren Satz oder kurzen Absatz auf Deutsch. Konvertiere Stichpunkte in lesbare Anleitungen. Schätze bei Bedarf realistische Zeitangaben (durationMinutes). title ist ein optionaler kurzer Überschrift pro Schritt (z.B. "Teig vorbereiten", "Anbraten"), null wenn kein sinnvoller Titel passt.

## Regeln
- Korrigiere Rechtschreibfehler und Grammatik
- Formuliere Schritte in aktivem, imperativen Stil ("Zwiebeln würfeln und in Öl anbraten.")
- Erfinde keine Zutaten oder Schritte, die der Nutzer nicht erwähnt hat
- suggestedPortions muss eine positive Zahl > 0 sein
- Antworte NUR mit dem strukturierten JSON-Output`;

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
