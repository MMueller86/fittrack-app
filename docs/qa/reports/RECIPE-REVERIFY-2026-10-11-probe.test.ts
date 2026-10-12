// QA-only probe (no provider calls): real prepareRecipeExport + validation + renderer probe with a mocked SDK client.
import { describe, expect, it } from 'vitest';
import { __setOpenAiClientForTests, type RecipePreparationContext } from '../../../backend/src/lib/openai';
import { prepareValidatedRecipeExport } from '../../../backend/src/lib/recipePreparation';

const context: RecipePreparationContext = {
  recipeContext: { name: 'Reispfanne', portions: 2, tags: [], ingredients: [] },
  steps: [
    'Haehnchen schneiden.', 'Wuerzen.', 'Oel erhitzen.', 'Haehnchen braten, 4 Minuten pro Seite.',
    'Reis separat 12 Minuten kochen.', 'Haehnchen weitere 6 Minuten fertig garen.', 'Ruhen lassen.', 'Servieren.',
  ].map((description, index) => ({ order: index + 1, description })),
};
const step = (order: number, description: string, refs: number[]) => ({ order, description, sourceStepOrders: refs });
const draft = (steps: ReturnType<typeof step>[], totalTimeMinutes: number | null = null) => ({ version: 1, teaser: 'Reispfanne', totalTimeMinutes, difficulty: null, steps });
const client = (values: unknown[]) => {
  const calls: unknown[] = [];
  let index = 0;
  const create = async (request: unknown) => { calls.push(request); return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(values[Math.min(index++, values.length - 1)]) } }] }; };
  __setOpenAiClientForTests({ chat: { completions: { create } } } as never);
  return calls;
};

describe('QA probe FT-090', () => {
  it('rice FIRST inversion (1,3,6,5,8) is repaired mechanically in one call and keeps text/ref pairing', async () => {
    const calls = client([draft([step(1, 'Haehnchen schneiden und wuerzen.', [1, 2]), step(2, 'Haehnchen braten.', [3, 4]), step(3, 'Haehnchen fertig garen.', [6]), step(4, 'Reis kochen.', [5]), step(5, 'Servieren.', [8])])]);
    const result = await prepareValidatedRecipeExport(context);
    expect(calls).toHaveLength(1);
    expect(result.status).toBe('success');
    if (result.status === 'success') console.log('RICE_RESULT ' + JSON.stringify(result.data.steps));
  });
  it.each([
    ['duplicate across groups', draft([step(1, 'A.', [1, 2]), step(2, 'B.', [2, 3]), step(3, 'C.', [4])])],
    ['duplicate within group', draft([step(1, 'A.', [1, 1]), step(2, 'B.', [4])])],
    ['unknown reference', draft([step(1, 'A.', [1]), step(2, 'B.', [99])])],
    ['empty references', draft([step(1, 'A.', []), step(2, 'B.', [4])])],
    ['zero steps', draft([])],
    ['six steps', draft([1, 2, 3, 4, 5, 6].map((n) => step(n, 'X.', [n])))],
  ])('genuinely invalid draft stays invalid (%s) and is exhausted, not silently repaired', async (_name, invalid) => {
    const calls = client([invalid]);
    const result = await prepareValidatedRecipeExport(context);
    console.log('INVALID ' + _name + ' => ' + result.status + ' calls=' + calls.length + (result.status === 'exhausted' ? ' codes=' + [...new Set(result.diagnostics.map((d) => d.code))].join('|') : ''));
    expect(result.status).toBe('exhausted');
    expect(calls).toHaveLength(3);
  });
  it('time guard: unsupported 40 is nulled before validation; explicit total kept', async () => {
    client([draft([step(1, 'A.', [1]), step(2, 'B.', [4])], 40)]);
    const unsupported = await prepareValidatedRecipeExport(context);
    expect(unsupported.status === 'success' && unsupported.data.totalTimeMinutes).toBe(null);
    client([draft([step(1, 'A.', [1]), step(2, 'B.', [4])], 40)]);
    const explicit = await prepareValidatedRecipeExport({ ...context, recipeContext: { ...context.recipeContext, description: 'Gesamtzeit: 40 Minuten' } });
    expect(explicit.status === 'success' && explicit.data.totalTimeMinutes).toBe(40);
  });
});
