// Canonical eval fixtures for the recipeAnalyze prompt (recipeAnalyze.ts).
//
// All category classifications are derived from the documented rules in the prompt:
//   - food:      Fleisch, Fisch, Gemüse, Obst, Hülsenfrüchte, Getreideprodukte,
//                Milchprodukte, Eier, Nüsse, Samen, Öle und Fette, Zucker, Mehl, Sahne.
//                Knoblauch und Zwiebeln are explicitly food.
//   - seasoning: Salz, Pfeffer, Gewürze, Essig, Saucen. Frische und getrocknete
//                Küchenkräuter are seasoning (Petersilie, Basilikum, Thymian, Oregano,
//                Rosmarin, Schnittlauch, etc.) unless nutritionally dominant.
//
// All amountGrams ranges are derived from the documented unit conversions:
//   "1 EL → ~15g", "1 TL → ~5g", "1 Prise → ~1g"
// Explicit gram/ml values in the input should pass through unchanged.
//
// Update this file whenever RECIPE_ANALYZE_PROMPT_VERSION changes and re-run evals.

export type AmountGramsConstraint =
  | null                           // must be null
  | 'not-null'                     // must be non-null (estimated when no quantity given)
  | { min: number; max: number };  // must fall within this range

export interface IngredientConstraint {
  /** Case-insensitive substring match against ingredient.displayName. */
  displayNameContains: string;
  category: 'food' | 'seasoning';
  /** When absent, amountGrams is not asserted. */
  amountGrams?: AmountGramsConstraint;
}

export interface RecipeEvalFixture {
  id: string;
  description: string;
  input: string;
  constraints: {
    /** Exact ingredient count — detects lost or invented items. */
    exactIngredientCount?: number;
    suggestedPortionsMin?: number;
    suggestedPortionsMax?: number;
    ingredients: IngredientConstraint[];
  };
}

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
        // 2 EL × ~15g = 30g; prompt: "1 EL → ~15g"; Olivenöl is food (Öle und Fette)
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
        // Prompt: "Knoblauch und Zwiebeln sind ebenfalls food"
        { displayNameContains: 'zwiebel', category: 'food' },
        // Prompt: "Frische und getrocknete Küchenkräuter sind grundsätzlich seasoning"
        { displayNameContains: 'petersilie', category: 'seasoning' },
        { displayNameContains: 'salz', category: 'seasoning' },
        { displayNameContains: 'pfeffer', category: 'seasoning' },
      ],
    },
  },
  {
    id: 'borderline-classification',
    description:
      'Knoblauch and Zwiebeln must be food (explicit prompt rule); Basilikum must be seasoning',
    input:
      '400g Spaghetti, 3 Knoblauchzehen, 2 Zwiebeln, frisches Basilikum, 30ml Olivenöl, Salz',
    constraints: {
      ingredients: [
        { displayNameContains: 'spaghetti', category: 'food', amountGrams: { min: 395, max: 405 } },
        // CRITICAL: prompt explicitly states "Knoblauch und Zwiebeln sind ebenfalls food"
        { displayNameContains: 'knoblauch', category: 'food' },
        { displayNameContains: 'zwiebel', category: 'food' },
        // Basilikum = Küchenkraut = seasoning (not used in nutritionally dominant quantity here)
        { displayNameContains: 'basilikum', category: 'seasoning' },
        // 30ml Olivenöl ≈ 27–30g (oil density ~0.9 g/ml); food (Öle und Fette)
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
        { displayNameContains: 'salz', category: 'seasoning' },
      ],
    },
  },
  {
    id: 'explicit-quantities-with-unit-conversion',
    description: 'Gram values pass through unchanged; EL and TL convert to grams correctly',
    input: '250g Rinderhack, 3 EL Tomatenmark, 400g Dosentomaten, 1 TL getrockneter Oregano',
    constraints: {
      ingredients: [
        // Gram values stated explicitly — must pass through as-is
        { displayNameContains: 'rinderhack', category: 'food', amountGrams: { min: 245, max: 255 } },
        // 3 EL × ~15g = 45g (prompt: "1 EL → ~15g")
        { displayNameContains: 'tomatenmark', category: 'food', amountGrams: { min: 40, max: 50 } },
        { displayNameContains: 'tomate', category: 'food', amountGrams: { min: 395, max: 405 } },
        // 1 TL × ~5g = 5g (prompt: "1 TL → ~5g"); Oregano = Gewürzkraut = seasoning
        { displayNameContains: 'oregano', category: 'seasoning', amountGrams: { min: 4, max: 7 } },
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
        // Prompt: "schätze eine sinnvolle Menge für die angegebenen Portionen"
        // → food items must receive an estimated weight, not null
        { displayNameContains: 'hähnchen', category: 'food', amountGrams: 'not-null' },
        { displayNameContains: 'knoblauch', category: 'food' },
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: 'not-null' },
        // Herbs without quantity: amountGrams is unconstrained (null is acceptable)
        { displayNameContains: 'rosmarin', category: 'seasoning' },
        { displayNameContains: 'thymian', category: 'seasoning' },
      ],
    },
  },
  {
    id: 'no-lost-or-invented-ingredients',
    description: 'All 6 named ingredients appear in output — nothing dropped, nothing invented',
    input: '200g Spaghetti, 100g Speck, 2 Eier, 50g Parmesan, Salz, Pfeffer',
    constraints: {
      // Prompt: "Erfinde keine Zutaten oder Schritte, die der Nutzer nicht erwähnt hat"
      exactIngredientCount: 6,
      ingredients: [
        { displayNameContains: 'spaghetti', category: 'food', amountGrams: { min: 195, max: 205 } },
        { displayNameContains: 'speck', category: 'food', amountGrams: { min: 95, max: 105 } },
        // 2 Eier: Stückangabe → estimated weight; amountGrams not constrained here
        { displayNameContains: 'ei', category: 'food' },
        { displayNameContains: 'parmesan', category: 'food', amountGrams: { min: 45, max: 55 } },
        { displayNameContains: 'salz', category: 'seasoning' },
        { displayNameContains: 'pfeffer', category: 'seasoning' },
      ],
    },
  },
  {
    id: 'schema-valid-structured-output',
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
        { displayNameContains: 'salz', category: 'seasoning' },
        // 2 EL × ~15g = 30g; food (Öle und Fette)
        { displayNameContains: 'olivenöl', category: 'food', amountGrams: { min: 25, max: 35 } },
      ],
    },
  },
];
