import type { AiRecipeScaleInput } from '../openai';

export interface RecipeScaleEvalFixture {
  id: string;
  description: string;
  input: AiRecipeScaleInput;
  constraints: {
    expectedStepOrders: number[];
    descriptionMustBeNull?: boolean;
    unchangedTextByStep?: Array<string | undefined>;
  };
}

const tomatoIngredients = {
  originalIngredients: [
    {
      displayName: 'Mehl',
      category: 'food' as const,
      inputMode: 'grams' as const,
      unit: 'g',
      inputAmount: 200,
      amountGrams: 200,
      amountLabel: null,
    },
    {
      displayName: 'Salz',
      category: 'seasoning' as const,
      inputMode: 'grams' as const,
      unit: 'nach Geschmack',
      inputAmount: null,
      amountGrams: null,
      amountLabel: 'nach Geschmack',
    },
  ],
  targetIngredients: [
    {
      displayName: 'Mehl',
      category: 'food' as const,
      inputMode: 'grams' as const,
      unit: 'g',
      inputAmount: 400,
      amountGrams: 400,
      amountLabel: null,
    },
    {
      displayName: 'Salz',
      category: 'seasoning' as const,
      inputMode: 'grams' as const,
      unit: 'nach Geschmack',
      inputAmount: null,
      amountGrams: null,
      amountLabel: 'nach Geschmack',
    },
  ],
};

export const RECIPE_SCALE_EVAL_FIXTURES: RecipeScaleEvalFixture[] = [
  {
    id: 'preserves-step-order-and-unrelated-baking-data',
    description: 'Keeps all original steps and preserves unrelated time and temperature data',
    input: {
      originalPortions: 2,
      targetPortions: 4,
      originalDescription: 'Ein einfacher Teig für zwei Portionen.',
      ...tomatoIngredients,
      originalSteps: [
        {
          order: 1,
          title: 'Teig vorbereiten',
          description: 'Verrühre 200 g Mehl mit den übrigen Zutaten.',
        },
        {
          order: 2,
          title: null,
          description: 'Backe den Teig 20 Minuten bei 180 °C.',
        },
      ],
    },
    constraints: {
      // AC-11: The response is accepted only with the original count/order.
      expectedStepOrders: [1, 2],
      // AC-12: Unrelated temperature and time remain in the step text.
      unchangedTextByStep: [undefined, '180'],
    },
  },
  {
    id: 'missing-description-stays-null',
    description: 'Does not invent a description when the original recipe has none',
    input: {
      originalPortions: 4,
      targetPortions: 1,
      originalDescription: null,
      ...tomatoIngredients,
      originalSteps: [
        {
          order: 1,
          title: null,
          description: 'Vermenge alle Zutaten.',
        },
      ],
    },
    constraints: {
      // The null behaviour is defined by the recipe-scale prompt contract.
      expectedStepOrders: [1],
      descriptionMustBeNull: true,
    },
  },
];
