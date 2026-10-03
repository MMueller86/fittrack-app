import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setOpenAiClientForTests, analyzeRecipeText } from './openai';

afterEach(() => {
  __setOpenAiClientForTests(null);
});

describe('analyzeRecipeText structured output schema', () => {
  it('requires positive numeric ingredient amounts while allowing null', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ingredients: [] }) } }],
    });
    __setOpenAiClientForTests({ chat: { completions: { create } } } as never);

    await analyzeRecipeText('Gemüse in der Pfanne garen.');

    const request = create.mock.calls[0]?.[0] as {
      response_format: {
        json_schema: {
          schema: {
            properties: {
              ingredients: {
                items: {
                  properties: {
                    amountGrams: { type: readonly string[]; minimum: number };
                  };
                };
              };
            };
          };
        };
      };
    };
    const amountGramsSchema = request.response_format.json_schema.schema.properties.ingredients.items.properties.amountGrams;

    expect(amountGramsSchema.type).toEqual(['number', 'null']);
    expect(amountGramsSchema.minimum).toBeGreaterThan(0);
  });
});