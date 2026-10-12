// Canonical eval fixtures for the recipeAnalyze prompt (recipeAnalyze.ts).
//
// All category classifications are derived from docs/kb/domain/07-ai-features.md:
//   - food:      Fleisch, Fisch, Gemüse, Obst, Hülsenfrüchte, Getreideprodukte,
//                Milchprodukte, Eier, Nüsse, Samen, Öle und Fette, Zucker, Mehl, Sahne.
//                Knoblauch und Zwiebeln are explicitly food.
//   - seasoning: Salz, Pfeffer, Gewürze, Essig, Saucen. Frische und getrocknete
//                Küchenkräuter are seasoning (Petersilie, Basilikum, Thymian, Oregano,
//                Rosmarin, Schnittlauch, etc.) unless nutritionally dominant.
//
// All amountGrams ranges are derived from docs/kb/tech/06-ai-integrations.md:
//   "1 EL → ~15g", "1 TL → ~5g", "1 Prise → ~1g"
// Explicit gram/ml values in the input should pass through unchanged.
// A food item with a genuinely indeterminate amount must remain food with amountGrams = null
// (docs/kb/domain/06-recipes.md); a tiny positive placeholder is not a measurement.
// Explicit quantities must still convert.
//
// Update this file whenever RECIPE_ANALYZE_PROMPT_VERSION changes and re-run evals.

import { expect } from 'vitest';
import type { AiRecipeRaw, RecipePreparationContext, RecipeExportPreparationOutput } from '../openai';

export type AmountGramsConstraint =
  | null                           // must be null
  | 'not-null'                     // must be non-null (estimated when no quantity given)
  | { min: number; max: number };  // must fall within this range

/** null = must be null (food items); 'non-empty' = must be a non-empty string (seasoning items). */
export type KitchenAmountTextConstraint = null | 'non-empty';

export interface IngredientConstraint {
  /** Case-insensitive substring match against ingredient.displayName. */
  displayNameContains: string;
  category: 'food' | 'seasoning';
  /** When absent, amountGrams is not asserted. */
  amountGrams?: AmountGramsConstraint;
  /** When absent, kitchenAmountText is not asserted. */
  kitchenAmountText?: KitchenAmountTextConstraint;
}

export interface ExportStepSemanticAssertion {
  description: string;
  /** The export step must trace this source order; all patterns match its description. */
  sourceStepOrder: number;
  patterns: RegExp[];
  contradictions?: RegExp[];
  sourceBoundWholeIngredientSet?: {
    sourceSteps: Array<{ order: number; description: string }>;
    pattern: RegExp;
  };
}

export interface SourceStepSemanticAssertion {
  description: string;
  sourceStepOrder: number;
  /** All patterns must match the source-step description. */
  patterns: RegExp[];
}

export interface RecipeEvalFixture {
  id: string;
  description: string;
  input: string;
  constraints: {
    /** Exact ingredient count — detects lost or invented items. */
    exactIngredientCount?: number;
    /** Exact count required when explicit numbered source instructions are present. */
    sourceStepCountExact?: number;
    suggestedPortionsMin?: number;
    suggestedPortionsMax?: number;
    ingredients: IngredientConstraint[];
    sourceStepSemanticAssertions?: SourceStepSemanticAssertion[];
    exportStepSemanticAssertions?: ExportStepSemanticAssertion[];
    manualExportReview?: boolean;
    preparationTotalTimeMinutes?: number | null;
  };
}

export function assertRecipeStepSemantics(result: Pick<AiRecipeRaw, 'steps'> & {
  exportSuggestion: { steps: Array<{ description: string; sourceStepOrders: number[] }> };
}, constraints: RecipeEvalFixture['constraints']): void {
  for (const assertion of constraints.sourceStepSemanticAssertions ?? []) {
    const step = result.steps.find((candidate) => candidate.order === assertion.sourceStepOrder);
    expect(step, `Missing source step ${assertion.sourceStepOrder}: ${assertion.description}`).toBeDefined();
    for (const pattern of assertion.patterns) {
      expect(step!.description, `Source ${assertion.sourceStepOrder}: ${assertion.description}`).toMatch(pattern);
    }
    expect(step!.description, 'Do not invent a numeric temperature').not.toMatch(/\d+\s*(?:°\s*[CF]|Grad|Celsius|Fahrenheit)/iu);
  }
  for (const assertion of constraints.exportStepSemanticAssertions ?? []) {
    const step = result.exportSuggestion.steps.find((candidate) => candidate.sourceStepOrders.includes(assertion.sourceStepOrder));
    expect(step, `Missing export reference ${assertion.sourceStepOrder}: ${assertion.description}`).toBeDefined();
    const equivalence = assertion.sourceBoundWholeIngredientSet;
    const wholeSetEquivalent = equivalence && equivalence.sourceSteps.length === result.steps.length &&
      equivalence.sourceSteps.every((source, index) => source.order === result.steps[index]!.order && source.description === result.steps[index]!.description) &&
      equivalence.pattern.test(step!.description);
    for (const pattern of wholeSetEquivalent ? [] : assertion.patterns) {
      expect(step!.description, `Export source ${assertion.sourceStepOrder}: ${assertion.description}`).toMatch(pattern);
    }
    for (const pattern of assertion.contradictions ?? []) {
      expect(step!.description, `Contradiction at export source ${assertion.sourceStepOrder}`).not.toMatch(pattern);
    }
  }
  for (const step of result.exportSuggestion.steps) {
    const sourceText = result.steps.filter((source) => step.sourceStepOrders.includes(source.order))
      .map((source) => source.description).join(' ');
    const temperatures = /\d+\s*(?:°\s*[CF]|Grad|Celsius|Fahrenheit)/giu;
    const sourceTemperatures = (sourceText.match(temperatures) ?? []).map((value) => value.replace(/\s/gu, '').toLowerCase());
    for (const temperature of step.description.match(temperatures) ?? []) {
      expect(sourceTemperatures, 'Retained numeric temperature must occur in referenced source')
        .toContain(temperature.replace(/\s/gu, '').toLowerCase());
    }
  }
}

const numberedInstructionSemantics: SourceStepSemanticAssertion[] = [
  {
    sourceStepOrder: 1,
    description: 'cook potatoes in salted water for 18 minutes, then drain them',
    patterns: [
      /(?:koch\w*[^;,]*kartoffel|kartoffel[^;,]*(?:koch\w*|gar\w*|sied\w*))/iu,
      /kartoffel[^;,]*\b18\s*min(?:uten)?/iu,
      /salzwasser/iu,
      /(?:\b(?:gieß\w*|giess\w*)[^;]*\bab\b|\bab(?:gieß\w*|giess\w*)|\babtropf\w*)/iu,
    ],
  },
  {
    sourceStepOrder: 2,
    description: 'cook beans for 8 minutes until al dente, then drain them',
    patterns: [
      /(?:gar\w*[^;,]*bohn|koch\w*[^;,]*bohn|bohn\w*[^;,]*(?:gar\w*|koch\w*))/iu,
      /bohn\w*[^;,]*\b8\s*min(?:uten)?/iu,
      /bissfest/iu,
      /(?:\b(?:gieß\w*|giess\w*)[^;]*\bab\b|\bab(?:gieß\w*|giess\w*)|\babtropf\w*)/iu,
    ],
  },
  {
    sourceStepOrder: 3,
    description: 'season the chicken with salt and pepper',
    patterns: [
      /(?:(?:würz\w*|salze|salzen)[^;]*hähnchen|hähnchen[^;]*(?:würz\w*|salze|salzen))/iu,
      /hähnchen[^;]*salz/iu,
      /hähnchen[^;]*pfeffer/iu,
    ],
  },
  {
    sourceStepOrder: 4,
    description: 'heat olive oil in the pan',
    patterns: [
      /(?:erhitz\w*[^;]*olivenöl|olivenöl[^;]*erhitz\w*)/iu,
      /olivenöl[^;]*pfanne/iu,
    ],
  },
  {
    sourceStepOrder: 5,
    description: 'fry chicken at medium heat for 4 minutes per side, not 4 minutes total',
    patterns: [
      /(?:brat\w*[^;]*hähnchen|hähnchen[^;]*brat\w*)/iu,
      /hähnchen[^;]*mittler\w*\s+hitze/iu,
      /(?:\b4\s*min(?:uten)?\.?\s*(?:pro|je|auf jeder)\s+seite|(?:pro|je)\s+seite\s*4\s*min(?:uten)?)/iu,
    ],
  },
  {
    sourceStepOrder: 6,
    description: 'reduce heat after frying and continue cooking chicken for another 6 minutes',
    patterns: [
      /hähnchen/iu,
      /(?:reduzier\w*|senk\w*|verringer\w*)[^;]*hitze|hitze[^;]*(?:reduzier\w*|senk\w*|verringer\w*)/iu,
      /(?:gar\w*[^;]*weitere\s+6\s*min(?:uten)?|weitere\s+6\s*min(?:uten)?[^;]*gar\w*)/iu,
    ],
  },
  {
    sourceStepOrder: 7,
    description: 'remove chicken from the pan and rest it covered for 3 minutes',
    patterns: [
      /(?:nimm[^;]*hähnchen[^;]*aus[^;]*pfanne|(?:entnimm|entnehm\w*|hol\w*)[^;]*hähnchen[^;]*pfanne|hähnchen[^;]*pfanne[^;]*(?:nehm\w*|nimm))/iu,
      /(?:zugedeckt|abgedeckt)/iu,
      /(?:\b3\s*min(?:uten)?[^;]*ruh\w*|ruh\w*[^;]*\b3\s*min(?:uten)?)/iu,
    ],
  },
  {
    sourceStepOrder: 8,
    description: 'slice chicken and serve it with potatoes as a side dish and beans',
    patterns: [
      /(?:schneid\w*[^;]*hähnchen[^;]*\bauf\b|hähnchen[^;]*aufschneid\w*|schneid\w*[^;]*hähnchen[^;]*(?:scheiben|stücke))/iu,
      /(?:servier\w*[^;]*(?:hähnchen|\bes\b)|hähnchen[^;]*servier\w*)/iu,
      /(?:mit|dazu|zusammen)[^;]*kartoffel[^;]*beilage/iu,
      /(?:mit|dazu|zusammen)[^;]*bohn/iu,
    ],
  },
];

export const RECIPE_PREPARATION_EVAL_FIXTURE: {
  id: string;
  preparation: RecipePreparationContext;
  constraints: RecipeEvalFixture['constraints'];
} = {
  id: 'synthetic-saved-eight-steps-rice-serving',
  preparation: {
    recipeContext: {
      name: 'Synthetische Hähnchenpfanne mit Reis',
      description: 'Synthetische Preparationfixture für v15 B-2 AC-3/4, kein historisches Rezept.',
      portions: 2,
      tags: [],
      ingredients: [
        { displayName: 'Hähnchen', amountGrams: 350, inputAmount: 350, unit: 'g' },
        { displayName: 'Reis', amountGrams: 150, inputAmount: 150, unit: 'g' },
        { displayName: 'Olivenöl', amountGrams: 15, inputAmount: 15, unit: 'g' },
        { displayName: 'Salz', amountGrams: null, inputAmount: null, unit: 'nach Geschmack' },
        { displayName: 'Pfeffer', amountGrams: null, inputAmount: null, unit: 'nach Geschmack' },
      ],
    },
    steps: [
      { order: 1, title: 'Schneiden', description: 'Schneide das Hähnchen in Würfel.' },
      { order: 2, description: 'Würze das Hähnchen mit Salz und Pfeffer.' },
      { order: 3, description: 'Erhitze Olivenöl in der Pfanne.' },
      { order: 4, description: 'Brate Hähnchen bei mittlerer Hitze 4 Minuten je Seite.' },
      { order: 5, title: 'Separate Beilage', description: 'Koche Reis separat 12 Minuten in Salzwasser und gieße ihn ab.' },
      { order: 6, description: 'Senke die Hitze und gare Hähnchen weitere 6 Minuten.' },
      { order: 7, description: 'Nimm Hähnchen aus der Pfanne und lasse es zugedeckt 3 Minuten ruhen.' },
      { order: 8, title: 'Servieren', description: 'Serviere Hähnchen mit Reis als Beilage.' },
    ],
  },
  constraints: {
    sourceStepCountExact: 8,
    preparationTotalTimeMinutes: null,
    ingredients: [],
    sourceStepSemanticAssertions: [
      { sourceStepOrder: 1, description: 'cut chicken into cubes', patterns: [/schneid\w*/iu, /hähnchen/iu, /würfel/iu] },
      { sourceStepOrder: 2, description: 'season chicken with salt and pepper', patterns: [/würz\w*/iu, /hähnchen/iu, /salz/iu, /pfeffer/iu] },
      { sourceStepOrder: 3, description: 'heat olive oil in the pan', patterns: [/erhitz\w*/iu, /olivenöl/iu, /pfanne/iu] },
      { sourceStepOrder: 4, description: 'fry chicken at medium heat 4 minutes per side', patterns: [/brat\w*/iu, /hähnchen/iu, /mittler\w*\s+hitze/iu, /(?:4\s*min(?:uten)?\.?\s*(?:je|pro)\s+seite|(?:je|pro)\s+seite\s*4\s*min)/iu] },
      { sourceStepOrder: 5, description: 'cook rice separately 12 minutes in salted water and drain', patterns: [/(?:koch\w*[^;]*reis|reis[^;]*(?:koch\w*|gar\w*))/iu, /(?:separat|getrennt|extra)/iu, /12\s*min/iu, /salzwasser/iu, /(?:gieß\w*[^;]*ab|giess\w*[^;]*ab|abgieß\w*|abgiess\w*|abtropf\w*)/iu] },
      { sourceStepOrder: 6, description: 'lower heat and cook chicken another 6 minutes', patterns: [/(?:senk\w*|reduzier\w*|verringer\w*)[^;]*hitze/iu, /hähnchen/iu, /gar\w*/iu, /weitere\s+6\s*min/iu] },
      { sourceStepOrder: 7, description: 'remove chicken from pan and rest covered 3 minutes', patterns: [/(?:nimm|nehm\w*)[^;]*hähnchen[^;]*aus[^;]*pfanne/iu, /(?:zugedeckt|abgedeckt)/iu, /3\s*min/iu, /ruh\w*/iu] },
      { sourceStepOrder: 8, description: 'serve chicken with rice as a side dish', patterns: [/servier\w*[^;]*hähnchen/iu, /(?:mit|dazu|zusammen)[^;]*reis[^;]*beilage/iu] },
    ],
  },
};
RECIPE_PREPARATION_EVAL_FIXTURE.constraints.exportStepSemanticAssertions = [
  { sourceStepOrder: 1, description: 'prepare chicken by cutting', patterns: [/(?:schneid\w*[^;,.]*hähnchen|hähnchen[^;,.]*schneid\w*)/iu] },
  { sourceStepOrder: 4, description: 'fry chicken', patterns: [/(?:brat\w*[^;.]*hähnchen|hähnchen[^;.]*brat\w*)/iu], contradictions: [/hähnchen[^;,.]*(?:\b6\s*min(?:uten)?\.?\s*(?:je|pro)\s+seite|(?:je|pro)\s+seite\s*6\s*min)/iu] },
  { sourceStepOrder: 5, description: 'cook rice independently, not just mention it', patterns: [/(?:koch\w*[^;,.]*reis|reis[^;,.]*(?:koch\w*|gar\w*))/iu], contradictions: [/reis[^;,.]*\b(?:8|18)\s*min/iu, /(?:gemeinsam|zusammen)[^;,.]*hähnchen/iu] },
  { sourceStepOrder: 6, description: 'finish cooking chicken after frying', patterns: [/(?:gar\w*[\s\S]*hähnchen|hähnchen[\s\S]*gar\w*)/iu], contradictions: [/(?:gar\w*[^;,.]*weitere\s+4\s*min|weitere\s+4\s*min[^;,.]*gar\w*)/iu, /erhöh\w*[^;,.]*hitze/iu, /gar\w*(?:(?!\bservier\w*)[^;,.])*(?:reis|bohn)/iu] },
];

export const RECIPE_PREPARATION_EVAL_FIXTURES = [
  {
    ...RECIPE_PREPARATION_EVAL_FIXTURE,
    basis: 'B-19 AC5: unchanged synthetic saved eight-step source; core refs 1,4,5,6.',
    allowedOptional: ['seasoning', 'oil heating', 'medium heat', 'draining', 'resting', 'serving'],
  },
  {
    id: 'synthetic-saved-oven-seven-steps',
    basis: 'B-19 AC6: synthetic seven-step oven source; cutting, assembly and source-backed baking are essential.',
    allowedOptional: ['greasing', 'preheating detail', 'resting', 'serving'],
    preparation: {
      recipeContext: {
        name: 'Synthetischer Kartoffelauflauf', description: 'Gespeicherter synthetischer Ofenablauf.',
        portions: 2, tags: [],
        ingredients: [
          { displayName: 'Kartoffeln', amountGrams: 400, inputAmount: 400, unit: 'g' },
          { displayName: 'Sahne', amountGrams: 150, inputAmount: 150, unit: 'g' },
          { displayName: 'Käse', amountGrams: 80, inputAmount: 80, unit: 'g' },
        ],
      },
      steps: [
        { order: 1, description: 'Schneide Kartoffeln in dünne Scheiben.' },
        { order: 2, description: 'Fette die Auflaufform ein.' },
        { order: 3, description: 'Schichte Kartoffeln in die Form und gieße Sahne darüber.' },
        { order: 4, description: 'Streue Käse über die Kartoffeln.' },
        { order: 5, description: 'Heize den Ofen auf 180°C vor.' },
        { order: 6, description: 'Backe den Kartoffelauflauf im Ofen bei 180°C für 40 Minuten, bis die Kartoffeln gar sind.' },
        { order: 7, description: 'Lasse den Auflauf kurz ruhen und serviere ihn.' },
      ],
    },
    constraints: {
      ingredients: [],
      manualExportReview: true,
      preparationTotalTimeMinutes: null,
    },
  },
  {
    id: 'synthetic-saved-pasta-essential-sauce',
    basis: 'B-19 AC6: synthetic seven-step source; onion prep/frying, tomato sauce simmering and separate pasta cooking are essential.',
    allowedOptional: ['oil heating', 'salting water', 'draining', 'serving garnish'],
    preparation: {
      recipeContext: {
        name: 'Synthetische Pasta mit Tomatensauce', description: 'Gespeicherter synthetischer Pastaablauf.',
        portions: 2, tags: [],
        ingredients: [
          { displayName: 'Pasta', amountGrams: 200, inputAmount: 200, unit: 'g' },
          { displayName: 'Tomaten', amountGrams: 400, inputAmount: 400, unit: 'g' },
          { displayName: 'Zwiebel', amountGrams: 100, inputAmount: 100, unit: 'g' },
          { displayName: 'Olivenöl', amountGrams: 15, inputAmount: 15, unit: 'g' },
        ],
      },
      steps: [
        { order: 1, description: 'Schneide die Zwiebel klein.' },
        { order: 2, description: 'Erhitze Olivenöl in einer Pfanne.' },
        { order: 3, description: 'Brate die Zwiebel in der Pfanne an.' },
        { order: 4, description: 'Gib Tomaten zur Zwiebel und lasse die Sauce 15 Minuten köcheln.' },
        { order: 5, description: 'Koche Pasta separat in einem Topf mit Salzwasser 10 Minuten.' },
        { order: 6, description: 'Gieße die Pasta ab.' },
        { order: 7, description: 'Mische Pasta mit der Tomatensauce und serviere sie.' },
      ],
    },
    constraints: {
      ingredients: [],
      preparationTotalTimeMinutes: null,
      exportStepSemanticAssertions: [
        { sourceStepOrder: 1, description: 'cut onion', patterns: [/(?:schneid\w*[^;,.]*zwiebel|zwiebel[^;,.]*schneid\w*)/iu] },
        { sourceStepOrder: 3, description: 'fry onion', patterns: [/(?:brat\w*[^;,.]*zwiebel|zwiebel[^;,.]*brat\w*)/iu], contradictions: [/brat\w*[^;,.]*pasta/iu] },
        { sourceStepOrder: 4, description: 'cook the essential tomato sauce', patterns: [/(?:(?:köchel\w*|koch\w*|gar\w*)[^;,.]*(?:tomat|sauce)|(?:tomat|sauce)[^;,.]*(?:köchel\w*|koch\w*|gar\w*))/iu], contradictions: [/(?:tomat|sauce)(?:(?!\bund\b)[^;,.])*\b10\s*min/iu] },
        { sourceStepOrder: 5, description: 'cook pasta independently', patterns: [/(?:koch\w*(?:(?!\bund\b)[^;,.])*pasta|pasta(?:(?!\bund\b)[^;,.])*(?:koch\w*|gar\w*))/iu], contradictions: [/pasta(?:(?!\bund\b)[^;,.])*(?:in|mit)(?:(?!\bund\b)[^;,.])*(?:sauce|tomat)/iu, /pasta(?:(?!\bund\b)[^;,.])*\b15\s*min/iu] },
      ],
    },
  },
] satisfies Array<{
  id: string; basis: string; allowedOptional: string[];
  preparation: RecipePreparationContext; constraints: RecipeEvalFixture['constraints'];
}>;

export function assertRecipePreparationMetadata(
  output: { totalTimeMinutes?: number | null },
  constraints: RecipeEvalFixture['constraints'],
): void {
  if (constraints.preparationTotalTimeMinutes !== undefined) {
    expect(output.totalTimeMinutes, 'Preparation total time must match independently reviewed source provenance')
      .toBe(constraints.preparationTotalTimeMinutes);
  }
}

export function assertRecipePreparationSemantics(
  output: { totalTimeMinutes?: number | null; steps: Array<{ description: string; sourceStepOrders: number[] }> },
  savedSource: RecipePreparationContext['steps'],
  constraints: RecipeEvalFixture['constraints'],
): void {
  assertRecipePreparationMetadata(output, constraints);
  assertRecipeStepSemantics({
    steps: savedSource.map((step) => ({ ...step, title: step.title ?? null })),
    exportSuggestion: output,
  }, { ...constraints, sourceStepSemanticAssertions: undefined });
  for (const step of output.steps) {
    const sourceText = savedSource.filter((source) => step.sourceStepOrders.includes(source.order))
      .map((source) => source.description).join(' ');
    for (const duration of step.description.matchAll(/\b(\d+)\s*min(?:uten)?/giu)) {
      expect(sourceText, 'Retained time must occur in referenced saved source')
        .toMatch(new RegExp(`\\b${duration[1]}\\s*min(?:uten)?`, 'iu'));
    }
  }
}

export const RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE: {
  id: string;
  preparation: RecipePreparationContext;
  constraints: RecipeEvalFixture['constraints'];
  forcedInitial: RecipeExportPreparationOutput;
} = {
  id: 'synthetic-dough-forced-initial-overflow-real-correction',
  preparation: {
    recipeContext: { name: 'Quarkbroetchen', portions: 2, tags: [], ingredients: [
      { displayName: 'Mehl', amountGrams: 100, inputAmount: 100, unit: 'g' },
      { displayName: 'Quark', amountGrams: 100, inputAmount: 100, unit: 'g' },
      { displayName: 'Zucker', amountGrams: 10, inputAmount: 10, unit: 'g' },
      { displayName: 'Backpulver', amountGrams: 5, inputAmount: 5, unit: 'g' },
      { displayName: 'Ei', amountGrams: 50, inputAmount: 50, unit: 'g' },
      { displayName: 'Kerne', amountGrams: 10, inputAmount: 10, unit: 'g' },
      { displayName: 'Salz', amountGrams: null, inputAmount: null, unit: 'nach Geschmack' },
    ] },
    steps: [
      { order: 1, description: 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.' },
      { order: 2, description: 'Forme den Teig zu Broetchen.' },
      { order: 3, description: 'Backe die Broetchen im vorgeheizten Ofen bei 180°C fuer 20 Minuten.' },
      { order: 4, description: 'Lasse die Broetchen abkuehlen.' },
    ],
  },
  constraints: { ingredients: [], preparationTotalTimeMinutes: null, exportStepSemanticAssertions: [
    { sourceStepOrder: 1, description: 'mix all original dough ingredients without omission',
      patterns: [/(?:misch\w*|vermenge|ruehr\w*|rühr\w*)/iu, /mehl/iu, /quark/iu, /zucker/iu, /backpulver/iu, /\bei\b/iu, /kern/iu, /salz/iu],
      contradictions: [/\b(?:butter|hefe|milch|wasser)\b/iu] },
    { sourceStepOrder: 2, description: 'form the dough into rolls', patterns: [/form\w*/iu, /br(?:oe|ö)tchen/iu] },
    { sourceStepOrder: 3, description: 'bake rolls at source-backed temperature and duration', patterns: [/back\w*/iu, /180\s*°\s*C/iu, /20\s*min/iu], contradictions: [/pfanne|anbrat|\b(?:10|30|40)\s*min/iu] },
  ] },
  forcedInitial: { version: 1, teaser: 'Goldbraune Broetchen', totalTimeMinutes: null, difficulty: null, steps: [
    { order: 1, description: 'Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.', sourceStepOrders: [1] },
    { order: 2, description: 'Forme den Teig zu Broetchen.', sourceStepOrders: [2] },
    { order: 3, description: 'Backe die Broetchen im Ofen bei 180°C fuer 20 Minuten.', sourceStepOrders: [3] },
    { order: 4, description: 'Lasse die Broetchen abkuehlen.', sourceStepOrders: [4] },
  ] },
};

RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE.constraints.exportStepSemanticAssertions![0]!.sourceBoundWholeIngredientSet = {
  sourceSteps: RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE.preparation.steps.map(({ order, description }) => ({ order, description })),
  pattern: /^(?:vermisch\w*|misch\w*|vermenge|rühr\w*|ruehr\w*)\s+(?:alle|sämtliche|saemtliche)\s+(?:zutaten|teigzutaten)\s+zu\s+(?:einem\s+)?teig(?:\s+und\s+form\w*\s+(?:ihn|(?:den\s+)?teig)\s+zu\s+br(?:ö|oe)tchen)?[.!]?$/iu,
};

export const RECIPE_ANALYZE_EVAL_FIXTURES: RecipeEvalFixture[] = [
  {
    id: 'mixed-food-seasoning',
    description: 'Oils, protein, and vegetables are food; herbs and spices are seasoning',
    input:
      '300g Hähnchenbrust, 200g Basmatireis, 2 EL Olivenöl, 1 Zwiebel, Petersilie, Salz, Pfeffer',
    constraints: {
      ingredients: [
        // Exact gram values stated in input — pass through unchanged
        { displayNameContains: 'hähnchen', category: 'food', amountGrams: { min: 295, max: 305 } },
        { displayNameContains: 'reis', category: 'food', amountGrams: { min: 195, max: 205 } },
        // KB tech/06: 2 EL × ~15g = 30g; Olivenöl is food (Öle und Fette).
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
        // KB domain/07: nutritionally relevant vegetables remain food.
        { displayNameContains: 'zwiebel', category: 'food' },
        // KB domain/07: ordinary fresh and dried kitchen herbs are seasoning.
        { displayNameContains: 'petersilie', category: 'seasoning', kitchenAmountText: 'non-empty' },
        { displayNameContains: 'salz', category: 'seasoning', kitchenAmountText: 'non-empty' },
        { displayNameContains: 'pfeffer', category: 'seasoning', kitchenAmountText: 'non-empty' },
      ],
    },
  },
  {
    id: 'borderline-classification',
    description:
      'Knoblauch and Zwiebeln must be food; Basilikum must be seasoning per KB domain/07',
    input:
      '400g Spaghetti, 3 Knoblauchzehen, 2 Zwiebeln, frisches Basilikum, 30ml Olivenöl, Salz',
    constraints: {
      ingredients: [
        { displayNameContains: 'spaghetti', category: 'food', amountGrams: { min: 395, max: 405 } },
        // KB domain/07: vegetables remain food; kitchen herbs below are seasoning.
        { displayNameContains: 'knoblauch', category: 'food' },
        { displayNameContains: 'zwiebel', category: 'food' },
        // Basilikum = Küchenkraut = seasoning (not used in nutritionally dominant quantity here)
        { displayNameContains: 'basilikum', category: 'seasoning', kitchenAmountText: 'non-empty' },
        // 30ml Olivenöl ≈ 27–30g (oil density ~0.9 g/ml); food (Öle und Fette)
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
        { displayNameContains: 'salz', category: 'seasoning', kitchenAmountText: 'non-empty' },
      ],
    },
  },
  {
    id: 'explicit-quantities-with-unit-conversion',
    description: 'Gram values pass through unchanged; EL and TL convert to grams correctly',
    input: '250g Rinderhack, 3 EL Tomatenmark, 400g Dosentomaten, 2 EL Frischkäse, 1 TL getrockneter Oregano',
    constraints: {
      ingredients: [
        // Gram values stated explicitly — must pass through as-is
        { displayNameContains: 'rinderhack', category: 'food', amountGrams: { min: 245, max: 255 } },
        // KB tech/06: 3 EL × ~15g = 45g.
        { displayNameContains: 'tomatenmark', category: 'food', amountGrams: { min: 40, max: 50 } },
        { displayNameContains: 'dosentomaten', category: 'food', amountGrams: { min: 395, max: 405 } },
        // 2 EL × ~15g = 30g; dairy remains a food ingredient
        { displayNameContains: 'frischkäse', category: 'food', amountGrams: { min: 25, max: 35 } },
        // Explicit seasoning amount must become a positive estimate; dried-herb density can be well below 5g/TL.
        { displayNameContains: 'oregano', category: 'seasoning', amountGrams: 'not-null', kitchenAmountText: 'non-empty' },
      ],
    },
  },
  {
    id: 'missing-quantities-food-gets-estimated',
    description:
      'Food items without stated amounts receive an estimated amountGrams (not null); seasoning amountGrams is unconstrained',
    input: 'Hähnchenbrust, Knoblauch, Olivenöl, Rosmarin, Thymian',
    constraints: {
      ingredients: [
        // KB domain/07: estimate a plausible quantity when no amount is given.
        // → food items must receive an estimated weight, not null
        { displayNameContains: 'hähnchen', category: 'food', amountGrams: 'not-null' },
        { displayNameContains: 'knoblauch', category: 'food' },
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: 'not-null' },
        // Herbs without quantity: amountGrams is unconstrained (null is acceptable)
        { displayNameContains: 'rosmarin', category: 'seasoning', kitchenAmountText: 'non-empty' },
        { displayNameContains: 'thymian', category: 'seasoning', kitchenAmountText: 'non-empty' },
      ],
    },
  },
  {
    id: 'indeterminate-spray-oil-stays-food',
    description: 'Unmeasurable spray oil stays food with null grams, not a tiny positive placeholder; explicit oil quantity remains measurable',
    input: 'Sprühöl zum Anbraten, 1 EL Olivenöl, 300g Hähnchenbrust',
    constraints: {
      exactIngredientCount: 3,
      ingredients: [
        { displayNameContains: 'sprühöl', category: 'food', amountGrams: null },
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 10, max: 20 } },
        { displayNameContains: 'hähnchen', category: 'food', amountGrams: { min: 295, max: 305 } },
      ],
    },
  },
  {
    id: 'no-lost-or-invented-ingredients',
    description: 'All 6 named ingredients appear in output — nothing dropped, nothing invented',
    input: '200g Spaghetti, 100g Speck, 2 Eier, 50g Parmesan, Salz, Pfeffer',
    constraints: {
      // Input and US-10: preserve all named ingredients without inventing others.
      exactIngredientCount: 6,
      ingredients: [
        { displayNameContains: 'spaghetti', category: 'food', amountGrams: { min: 195, max: 205 } },
        { displayNameContains: 'speck', category: 'food', amountGrams: { min: 95, max: 105 } },
        // 2 Eier: Stückangabe → estimated weight; amountGrams not constrained here
        { displayNameContains: 'ei', category: 'food' },
        { displayNameContains: 'parmesan', category: 'food', amountGrams: { min: 45, max: 55 } },
        { displayNameContains: 'salz', category: 'seasoning', kitchenAmountText: 'non-empty' },
        { displayNameContains: 'pfeffer', category: 'seasoning', kitchenAmountText: 'non-empty' },
      ],
    },
  },
  {
    id: 'full-recipe-output-fields',
    description:
      'All required fields present, suggestedPortions positive, amountGrams non-negative',
    input:
      '500g Mehl, 300ml Wasser, 7g Trockenhefe, 1 TL Salz, 2 EL Olivenöl — einfaches Fladenbrot für 4 Personen',
    constraints: {
      suggestedPortionsMin: 1,
      suggestedPortionsMax: 8,
      ingredients: [
        { displayNameContains: 'mehl', category: 'food', amountGrams: { min: 495, max: 505 } },
        // 300ml Wasser ≈ 300g (density ≈ 1 g/ml)
        { displayNameContains: 'wasser', category: 'food', amountGrams: { min: 290, max: 310 } },
        // 7g stated explicitly; Hefe has non-trivial macronutrients → food
        { displayNameContains: 'hefe', category: 'food', amountGrams: { min: 6, max: 8 } },
        // 1 TL Salz ≈ 5g but category is seasoning; amountGrams unconstrained here
        { displayNameContains: 'salz', category: 'seasoning', kitchenAmountText: 'non-empty' },
        // 2 EL × ~15g = 30g; food (Öle und Fette)
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
      ],
    },
  },
  {
    id: 'side-dish-and-serving-actions',
    description: 'Full source extraction and selective main/side-dish cooking summary',
    input: `Hähnchenbrust mit Kartoffeln und grünen Bohnen für 2 Portionen.
  Zutaten: 350g Hähnchenbrust, 400g Kartoffeln, 200g grüne Bohnen, 1 EL Olivenöl, Salz, Pfeffer.
  Zubereitung:
  1. Koche die Kartoffeln 18 Minuten in Salzwasser und gieße sie ab.
  2. Gare die grünen Bohnen 8 Minuten bissfest und gieße sie ab.
  3. Würze die Hähnchenbrust mit Salz und Pfeffer.
  4. Erhitze das Olivenöl in einer Pfanne.
  5. Brate die Hähnchenbrust bei mittlerer Hitze 4 Minuten pro Seite an.
  6. Reduziere die Hitze und gare das Hähnchen weitere 6 Minuten fertig.
  7. Nimm das Hähnchen aus der Pfanne und lasse es zugedeckt 3 Minuten ruhen.
  8. Schneide das Hähnchen auf und serviere es mit den Kartoffeln als Beilage und den Bohnen.`,
    constraints: {
      sourceStepCountExact: 8,
      ingredients: [],
      // US-10 AC-15/16 and unchanged numbered input: reviewed semantic matrix 1..8.
      sourceStepSemanticAssertions: numberedInstructionSemantics,
      exportStepSemanticAssertions: [
        { sourceStepOrder: 1, description: 'cook potatoes', patterns: [/(?:koch\w*[^;,.]*kartoffel|kartoffel[^;,.]*(?:koch\w*|gar\w*))/iu], contradictions: [/kartoffel[^;,.]*\b8\s*min/iu] },
        { sourceStepOrder: 2, description: 'cook beans independently', patterns: [/(?:gar\w*[^;,.]*bohn|koch\w*[^;,.]*bohn|bohn\w*[^;,.]*(?:gar\w*|koch\w*))/iu], contradictions: [/bohn\w*[^;,.]*\b18\s*min/iu] },
        { sourceStepOrder: 5, description: 'fry chicken', patterns: [/(?:brat\w*[^;.]*hähnchen|hähnchen[^;.]*brat\w*)/iu], contradictions: [/hähnchen[^;,.]*(?:\b6\s*min(?:uten)?\.?\s*(?:je|pro)\s+seite|(?:je|pro)\s+seite\s*6\s*min)/iu] },
        { sourceStepOrder: 6, description: 'finish cooking chicken after frying', patterns: [/(?:gar\w*[\s\S]*hähnchen|hähnchen[\s\S]*gar\w*)/iu], contradictions: [/(?:gar\w*[^;,.]*weitere\s+4\s*min|weitere\s+4\s*min[^;,.]*gar\w*)/iu, /gar\w*[^;,.]*(?:kartoffel|bohn)/iu] },
      ],
    },
  },
];
