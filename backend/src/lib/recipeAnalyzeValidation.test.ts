import { describe, expect, it } from 'vitest';

import { validateRecipeExportPreparationOutput } from './recipeAnalyzeValidation';

function validExportPreparation() {
  return {
    steps: [{ order: 1, title: null, description: 'Zutaten mischen.' }],
    exportSuggestion: {
      version: 1,
      teaser: 'Einfaches Brot',
      totalTimeMinutes: 45,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mischen.', sourceStepOrders: [1] }],
    },
  };
}

describe('validateRecipeExportPreparationOutput diagnostics', () => {
  it('returns schema code and field path without including the invalid value', () => {
    const invalidValue = { privateText: 'private recipe text' };
    const raw: unknown = validExportPreparation();
    (raw as { exportSuggestion: { teaser: unknown } }).exportSuggestion.teaser = invalidValue;

    const result = validateRecipeExportPreparationOutput(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual({
      phase: 'schema',
      code: 'invalid_type',
      path: 'exportSuggestion.teaser',
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain(invalidValue.privateText);
  });

  it('identifies semantic source-step trace failures with stable codes', () => {
    const raw = validExportPreparation();
    raw.steps.push({ order: 1, title: null, description: 'Weitere Schritte.' });

    const result = validateRecipeExportPreparationOutput(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('steps.order must be unique');
    expect(result.diagnostics).toContainEqual({
      phase: 'semantic',
      code: 'duplicate_source_step_order',
      path: 'steps.order',
    });
  });
});