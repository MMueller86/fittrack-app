import { describe, expect, it } from 'vitest';

import { validateRecipeAnalyzeOutput, validateRecipePreparationSource, validateRecipeExportPreparationOutput as validateCompactPreparation } from './recipeAnalyzeValidation';
import { assertRecipeStepSemantics, assertRecipePreparationMetadata, assertRecipePreparationSemantics, RECIPE_PREPARATION_EVAL_FIXTURES, RECIPE_ANALYZE_EVAL_FIXTURES, RECIPE_PREPARATION_EVAL_FIXTURE, RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE } from './prompts/recipeAnalyze.eval.fixtures';
import type { AiRecipeRaw } from './openai';

describe('B-2 source authority and diagnostic indices', () => {
  it('accepts noncontiguous saved orders without sorting or renumbering', () => {
    const source = [{ order: 3, description: 'Mix.' }, { order: 7, description: 'Bake.' }];
    expect(validateRecipePreparationSource(source)).toEqual({ ok: true, data: source });
  });

  it.each([
    [], [{ order: 1, description: ' ' }], [{ order: 1, description: 3 }],
    [{ order: 0, description: 'Mix.' }], [{ order: Infinity, description: 'Mix.' }],
    [{ order: 3, description: 'Mix.' }, { order: 1, description: 'Bake.' }],
    [{ order: 1, description: 'Mix.' }, { order: 1, description: 'Bake.' }],
  ].map((source) => ({ source })))('rejects malformed saved source $source', ({ source }) => {
    expect(validateRecipePreparationSource(source).ok).toBe(false);
  });

  it('identifies both groups implicated in a duplicate reference', () => {
    const result = validateCompactPreparation({ version: 1, teaser: 'Bread', totalTimeMinutes: null, difficulty: null,
      steps: [{ order: 1, description: 'Mix.', sourceStepOrders: [1, 3] },
        { order: 2, description: 'Bake.', sourceStepOrders: [3] }] },
    [1, 3].map((order) => ({ order, description: 'Saved.' })));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid duplicate');
    expect(result.diagnostics.filter(({ code }) => code === 'duplicate_export_source_reference'))
      .toMatchObject([{ path: 'steps[0].sourceStepOrders', stepIndex: 0, offendingReferences: [3] },
        { path: 'steps[1].sourceStepOrders', stepIndex: 1, offendingReferences: [3] }]);
  });

  it('reports finite invalid numeric references without logging unknown payloads', () => {
    const output = { version: 1, teaser: 'Brot', totalTimeMinutes: null, difficulty: null,
      steps: [{ order: 1, description: 'Mische den Teig.', sourceStepOrders: [-1, 'UNKNOWN_REF_PAYLOAD'] }] };
    const result = validateCompactPreparation(output, [{ order: 1, description: 'Saved.' }]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid reference schema');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ phase: 'schema', path: 'steps[0].sourceStepOrders[0]',
      stepIndex: 0, stepOrder: 1, offendingReferences: [-1] }));
    expect(JSON.stringify(result.diagnostics)).not.toContain('UNKNOWN_REF_PAYLOAD');
  });
});

describe('B-19 compact Preparation contract', () => {
  const savedSource = Array.from({ length: 8 }, (_, index) => ({
    order: index + 1, description: `Saved action ${index + 1}.`,
  }));
  const validate = validateCompactPreparation;
  function compact(groups = [[1, 4, 6], [5]]) {
    return {
      version: 1, teaser: 'Saved recipe', totalTimeMinutes: null, difficulty: null,
      steps: groups.map((sourceStepOrders, index) => ({
        order: index + 1, description: 'Cook the saved component.', sourceStepOrders,
      })),
    };
  }

  it('accepts grouped main cooking followed by a separately cooked side without mutation', () => {
    const raw = compact();
    const before = structuredClone({ raw, savedSource });
    expect(validate(raw, savedSource)).toMatchObject({ ok: true, data: raw });
    expect({ raw, savedSource }).toEqual(before);
    const imported = semanticRecipe();
    imported.exportSuggestion.steps = raw.steps.map((step) => ({ ...step, ingredientKeys: [] }));
    expect(validateRecipeAnalyzeOutput(imported).ok).toBe(false);
  });

  it.each([[[5], [1, 4, 6]], [[1, 4, 4]], [[1, 4], [4, 6]], [[4, 1]], [[99]], [[]], [[0]]])(
    'rejects invalid references %j', (...groups) => {
      const raw = compact(groups);
      const before = structuredClone(raw);
      expect(validate(raw, savedSource).ok).toBe(false);
      expect(raw).toEqual(before);
    },
  );

  it.each([1, 5])('accepts %i steps, teaser96, text90 and time10080', (count) => {
    const raw = compact(Array.from({ length: count }, (_, index) => [index + 1]));
    raw.teaser = 'x'.repeat(96);
    raw.steps.forEach((step) => { step.description = 'x'.repeat(90); });
    expect(validate({ ...raw, totalTimeMinutes: 10080 }, savedSource).ok).toBe(true);
  });

  it.each([
    { teaser: 'x'.repeat(97) }, { teaser: ' ' }, { totalTimeMinutes: 0 },
    { totalTimeMinutes: 10081 }, { totalTimeMinutes: 1.5 }, { difficulty: ' ' },
    { difficulty: 'easy\nhard' }, { ingredients: [] }, { steps: [] },
    { steps: Array.from({ length: 6 }, (_, index) => ({ order: index + 1, description: 'Cook.', sourceStepOrders: [index + 1] })) },
    { steps: [{ order: 1, description: 'x'.repeat(91), sourceStepOrders: [1] }] },
    { steps: [{ order: 1, description: ' ', sourceStepOrders: [1] }] },
    { steps: [{ order: 1, description: 'Cook.', sourceStepOrders: [1], ingredientKeys: [] }] },
  ])('rejects invalid small output %j', (invalid) => {
    expect(validate({ ...compact(), ...invalid }, savedSource).ok).toBe(false);
  });

  it('rejects empty saved source without an invented fallback', () => {
    expect(validate(compact(), []).ok).toBe(false);
  });
});

function validateRecipeExportPreparationOutput(result: AiRecipeRaw) {
  const { includedIngredientKeys: _included, steps, ...fields } = result.exportSuggestion;
  return validateCompactPreparation({
    ...fields, steps: steps.map(({ ingredientKeys: _keys, ...step }) => step),
  }, result.steps.map(({ title, ...step }) => ({ ...step, ...(title !== null ? { title } : {}) })));
}

describe('B-19 three saved-source semantic rubrics', () => {
  it('CORR2 isolates the recorded rice cooking omission from aggregate-time failure', () => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[0]!;
    const output = { version: 1 as const, teaser: 'Hähnchen mit Reis', totalTimeMinutes: null, difficulty: null, steps: [
      { order: 1, description: 'Schneide und würze Hähnchen.', sourceStepOrders: [1, 2] },
      { order: 2, description: 'Erhitze Öl in der Pfanne.', sourceStepOrders: [3] },
      { order: 3, description: 'Brate Hähnchen 4 Minuten pro Seite.', sourceStepOrders: [4] },
      { order: 4, description: 'Gare Hähnchen weitere 6 Minuten fertig.', sourceStepOrders: [6] },
      { order: 5, description: 'Lasse Hähnchen 3 Minuten ruhen.', sourceStepOrders: [7] },
    ] };
    expect(validateCompactPreparation(output, fixture.preparation.steps).ok).toBe(true);
    expect(() => assertRecipePreparationSemantics(output, fixture.preparation.steps, fixture.constraints)).toThrow();
    const complete = structuredClone(output);
    complete.steps[1] = { order: 2, description: 'Brate Hähnchen 4 Minuten pro Seite.', sourceStepOrders: [4] };
    complete.steps[2] = { order: 3, description: 'Koche Reis separat 12 Minuten.', sourceStepOrders: [5] };
    complete.steps.pop();
    expect(validateCompactPreparation(complete, fixture.preparation.steps).ok).toBe(true);
    expect(() => assertRecipePreparationSemantics(complete, fixture.preparation.steps, fixture.constraints)).not.toThrow();
    const reversed = structuredClone(complete);
    [reversed.steps[2], reversed.steps[3]] = [reversed.steps[3]!, reversed.steps[2]!];
    reversed.steps.forEach((step, index) => { step.order = index + 1; });
    expect(validateCompactPreparation(reversed, fixture.preparation.steps).ok).toBe(false);
    expect(fixture.constraints.manualExportReview).not.toBe(true);
  });

  function pastaOutput(description: string) {
    return { totalTimeMinutes: null, steps: [
      { description: 'Schneide die Zwiebel und brate die Zwiebel an.', sourceStepOrders: [1, 3] },
      { description: 'Lasse die Tomatensauce 15 Minuten köcheln.', sourceStepOrders: [4] },
      { description, sourceStepOrders: [5, 7] },
    ] };
  }

  it('QA-R1 accepts the exact recorded separate pasta cooking then sauce mixing sentence', () => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[2]!;
    assertRecipePreparationSemantics(pastaOutput('Koche die Pasta in Salzwasser 10 Minuten und mische sie mit der Sauce.'), fixture.preparation.steps, fixture.constraints);
  });

  it.each([
    'Koche die Pasta in der Sauce 10 Minuten.',
    'Koche die Pasta mit Tomatensauce 10 Minuten.',
    'Koche die Pasta in Salzwasser 15 Minuten und mische sie mit der Sauce.',
    'Koche die Tomatensauce in Salzwasser 10 Minuten und mische sie mit Pasta.',
  ])('QA-R1 rejects actual pasta component/cooking/time contradiction: %s', (description) => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[2]!;
    expect(() => assertRecipePreparationSemantics(pastaOutput(description), fixture.preparation.steps, fixture.constraints)).toThrow();
  });

  it('QA-R1 rejects swapped sauce and pasta durations in their own components', () => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[2]!;
    const output = pastaOutput('Koche Pasta 15 Minuten in Salzwasser.');
    output.steps[1]!.description = 'Lasse Tomatensauce 10 Minuten köcheln.';
    expect(() => assertRecipePreparationSemantics(output, fixture.preparation.steps, fixture.constraints)).toThrow();
  });

  function doughOutput(description: string) {
    return { totalTimeMinutes: null, steps: [
      { description, sourceStepOrders: [1, 2] },
      { description: 'Backe die Brötchen im Ofen bei 180°C für 20 Minuten.', sourceStepOrders: [3] },
    ] };
  }

  it.each([
    'Vermische alle Zutaten zu einem Teig und forme ihn zu Brötchen.',
    'Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig und forme Brötchen.',
  ])('QA-R1 accepts source-bound complete single-stage dough ingredients: %s', (description) => {
    const fixture = RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE;
    assertRecipePreparationSemantics(doughOutput(description), fixture.preparation.steps, fixture.constraints);
  });

  it.each([
    'Vermische Mehl und Quark zu einem Teig und forme ihn zu Brötchen.',
    'Vermische alle Zutaten außer Salz zu einem Teig und forme ihn zu Brötchen.',
    'Vermische alle Zutaten mit Butter zu einem Teig und forme ihn zu Brötchen.',
    'Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne, Salz und Butter zu Teig; forme Brötchen.',
  ])('QA-R1 rejects dough ingredient omission/invention: %s', (description) => {
    const fixture = RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE;
    expect(() => assertRecipePreparationSemantics(doughOutput(description), fixture.preparation.steps, fixture.constraints)).toThrow();
  });

  it.each(['second-mixing-stage', 'different-component'] as const)('QA-R1 rejects generic all-ingredients equivalence for %s source', (kind) => {
    const fixture = RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE;
    const saved = structuredClone(fixture.preparation.steps);
    if (kind === 'second-mixing-stage') saved[3]!.description = 'Mische Quark und Zucker separat als Belag.';
    else saved[0]!.description = 'Vermische Mehl und Ei zu einem Teig; behalte Quark als Füllung zurück.';
    expect(() => assertRecipePreparationSemantics(doughOutput('Vermische alle Zutaten zu einem Teig und forme ihn zu Brötchen.'), saved, fixture.constraints)).toThrow();
  });

  it.each(['time', 'temperature', 'core'] as const)('QA-R1 keeps required dough baking %s negative', (kind) => {
    const fixture = RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE;
    const output = doughOutput('Vermische alle Zutaten zu einem Teig und forme ihn zu Brötchen.');
    output.steps[1]!.description = kind === 'time' ? 'Backe Brötchen bei 180°C für 30 Minuten.'
      : kind === 'temperature' ? 'Backe Brötchen bei 200°C für 20 Minuten.' : 'Serviere die Brötchen.';
    expect(() => assertRecipePreparationSemantics(output, fixture.preparation.steps, fixture.constraints)).toThrow();
  });

  it('allows a single pasta group while keeping independent sauce and pasta actions', () => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[2]!;
    const raw = {
      version: 1 as const, teaser: 'Pasta', totalTimeMinutes: null, difficulty: null,
      steps: [{ order: 1, description: 'Schneide und brate Zwiebel, köchle Tomatensauce und koche Pasta separat.', sourceStepOrders: [1, 3, 4, 5] }],
    };
    expect(validateCompactPreparation(raw, fixture.preparation.steps).ok).toBe(true);
    assertRecipePreparationSemantics(raw, fixture.preparation.steps, fixture.constraints);
  });

  const examples = [
    [
      { order: 1, description: 'Schneide Hähnchen, brate es an und gare Hähnchen fertig.', sourceStepOrders: [1, 4, 6] },
      { order: 2, description: 'Koche Reis separat.', sourceStepOrders: [5] },
    ],
    [
      { order: 1, description: 'Schneide Kartoffeln und schichte Kartoffeln mit Sahne in die Form.', sourceStepOrders: [1, 3] },
      { order: 2, description: 'Backe den Kartoffelauflauf bei 180°C für 40 Minuten im Ofen gar.', sourceStepOrders: [6] },
    ],
    [
      { order: 1, description: 'Schneide die Zwiebel und brate die Zwiebel an.', sourceStepOrders: [1, 3] },
      { order: 2, description: 'Lasse die Tomatensauce köcheln.', sourceStepOrders: [4] },
      { order: 3, description: 'Koche Pasta separat.', sourceStepOrders: [5] },
    ],
  ];
  it.each(RECIPE_PREPARATION_EVAL_FIXTURES.filter((fixture) => !fixture.constraints.manualExportReview))('checks source-backed small output for $id', (fixture) => {
    const index = RECIPE_PREPARATION_EVAL_FIXTURES.indexOf(fixture);
    const raw = { version: 1 as const, teaser: fixture.preparation.recipeContext.name, totalTimeMinutes: null, difficulty: null, steps: examples[index]! };
    const source = fixture.preparation.steps;
    const before = structuredClone({ raw, source });
    expect(validateCompactPreparation(raw, source).ok).toBe(true);
    assertRecipePreparationSemantics(raw, source, fixture.constraints);
    const swapped = structuredClone(raw);
    [swapped.steps[0]!.description, swapped.steps[1]!.description] = [swapped.steps[1]!.description, swapped.steps[0]!.description];
    expect(() => assertRecipePreparationSemantics(swapped, source, fixture.constraints)).toThrow();
    const invented = structuredClone(raw);
    invented.steps[0]!.description += ' Bei 250°C für 99 Minuten.';
    expect(() => assertRecipePreparationSemantics(invented, source, fixture.constraints)).toThrow();
    const missing = structuredClone(raw);
    missing.steps[1]!.description = 'Serviere das Gericht.';
    expect(() => assertRecipePreparationSemantics(missing, source, fixture.constraints)).toThrow();
    expect({ raw, source }).toEqual(before);
  });
});

const semanticFixture = RECIPE_ANALYZE_EVAL_FIXTURES.find((fixture) => fixture.id === 'side-dish-and-serving-actions')!;
describe('Q21 Preparation aggregate-time provenance', () => {
  it.each([
    { fixtureIndex: 0, unsupported: 42 },
    { fixtureIndex: 0, unsupported: 35 },
    { fixtureIndex: 1, unsupported: 50 },
    { fixtureIndex: 1, unsupported: 40 },
    { fixtureIndex: 2, unsupported: 35 },
    { fixtureIndex: 2, unsupported: 25 },
  ])('rejects unsupported total $unsupported for saved fixture $fixtureIndex without inventing preparation or overlap', ({ fixtureIndex, unsupported }) => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[fixtureIndex]!;
    expect(fixture.constraints.preparationTotalTimeMinutes).toBeNull();
    expect(() => assertRecipePreparationMetadata({ totalTimeMinutes: unsupported }, fixture.constraints)).toThrow();
    expect(() => assertRecipePreparationMetadata({ totalTimeMinutes: null }, fixture.constraints)).not.toThrow();
  });

  it.each([
    { description: 'Gesamtzeit: 50 Minuten.', steps: [{ order: 1, description: 'Backe den Auflauf 40 Minuten.' }], expected: 50 },
    { description: 'Führe alle Schritte ausschließlich nacheinander aus; weitere Arbeiten sind nicht nötig.',
      steps: [{ order: 1, description: 'Rühre die Masse 5 Minuten.' }, { order: 2, description: 'Gare sie danach 10 Minuten.' }], expected: 15 },
  ])('retains a reviewed supported total $expected from $description', ({ description, steps, expected }) => {
    const saved = { recipeContext: { name: 'Zeitbeleg', description, portions: 1, tags: [], ingredients: [] }, steps };
    const constraints = { ingredients: [], preparationTotalTimeMinutes: expected };
    expect(saved.recipeContext.description).toBe(description);
    expect(() => assertRecipePreparationMetadata({ totalTimeMinutes: expected }, constraints)).not.toThrow();
    expect(() => assertRecipePreparationMetadata({ totalTimeMinutes: expected + 10 }, constraints)).toThrow();
    expect(() => assertRecipePreparationMetadata({ totalTimeMinutes: null }, constraints)).toThrow();
  });

  it.each([42, 35])('rejects recorded unsupported rice total %i in the independent rubric', (totalTimeMinutes) => {
    const fixture = RECIPE_PREPARATION_EVAL_FIXTURES[0]!;
    const output = { totalTimeMinutes, steps: [
      { description: 'Schneide Hähnchen.', sourceStepOrders: [1] },
      { description: 'Brate Hähnchen an.', sourceStepOrders: [4] },
      { description: 'Koche Reis separat.', sourceStepOrders: [5] },
      { description: 'Gare Hähnchen fertig.', sourceStepOrders: [6] },
    ] };
    expect(() => assertRecipePreparationSemantics(output, fixture.preparation.steps, fixture.constraints)).toThrow();
    expect(() => assertRecipePreparationSemantics({ ...output, totalTimeMinutes: null }, fixture.preparation.steps, fixture.constraints)).not.toThrow();
  });
});

const semanticDescriptions = [
  'Koche Kartoffeln 18 Min. in Salzwasser und gieße sie ab.',
  'Gare Bohnen 8 Min. bissfest und gieße sie ab.',
  'Würze Hähnchen mit Salz und Pfeffer.',
  'Erhitze Olivenöl in der Pfanne.',
  'Brate Hähnchen bei mittlerer Hitze 4 Min. je Seite.',
  'Reduziere die Hitze und gare Hähnchen weitere 6 Min. fertig.',
  'Nimm Hähnchen aus der Pfanne und lasse es zugedeckt 3 Min. ruhen.',
  'Schneide Hähnchen auf und serviere es mit Kartoffeln als Beilage und Bohnen.',
];

function semanticRecipe(): AiRecipeRaw {
  return {
    suggestedName: 'Synthetische Hähnchenpfanne',
    description: 'Synthetisches Testrezept.',
    suggestedPortions: 2,
    tags: [],
    ingredients: [],
    steps: semanticDescriptions.map((description, index) => ({ order: index + 1, title: null, description })),
    exportSuggestion: {
      version: 1,
      teaser: 'Synthetisches Testrezept',
      totalTimeMinutes: null,
      difficulty: null,
      includedIngredientKeys: [],
      steps: [
        { order: 1, description: 'Koche Kartoffeln 18 Min. in Salzwasser, gare Bohnen 8 Min. bissfest; gieße beide ab.', sourceStepOrders: [1, 2], ingredientKeys: [] },
        { order: 2, description: 'Würze Hähnchen mit Salz/Pfeffer; erhitze Olivenöl in der Pfanne.', sourceStepOrders: [3, 4], ingredientKeys: [] },
        { order: 3, description: 'Brate Hähnchen bei mittlerer Hitze je Seite 4 Min.; reduziere Hitze, gare weitere 6 Min.', sourceStepOrders: [5, 6], ingredientKeys: [] },
        { order: 4, description: semanticDescriptions[6]!, sourceStepOrders: [7], ingredientKeys: [] },
        { order: 5, description: semanticDescriptions[7]!, sourceStepOrders: [8], ingredientKeys: [] },
      ],
    },
  };
}

function assertStepSemantics(result: AiRecipeRaw): void {
  assertRecipeStepSemantics(result, semanticFixture.constraints);
}

describe('Recipe Analyze fixture semantics offline', () => {
  it('keeps full source assertions separate from selective export cooking core', () => {
    const orders = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(semanticFixture.constraints.sourceStepSemanticAssertions?.map((assertion) => assertion.sourceStepOrder)).toEqual(orders);
    expect(semanticFixture.constraints.exportStepSemanticAssertions?.map((assertion) => assertion.sourceStepOrder)).toEqual([1, 2, 5, 6]);
  });

  it('accepts a valid adjacent grouping without fixed group boundaries', () => {
    const result = semanticRecipe();
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    assertStepSemantics(result);
  });

  it('accepts different adjacent group boundaries with all semantics intact', () => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = [
      { ...result.exportSuggestion.steps[0]! },
      { order: 2, description: semanticDescriptions[2]!, sourceStepOrders: [3], ingredientKeys: [] },
      { order: 3, description: 'Erhitze Olivenöl in Pfanne; brate Hähnchen bei mittlerer Hitze je Seite 4 Min.', sourceStepOrders: [4, 5], ingredientKeys: [] },
      { order: 4, description: 'Reduziere Hitze, gare weitere 6 Min.; nimm Hähnchen aus Pfanne, ruhe zugedeckt 3 Min.', sourceStepOrders: [6, 7], ingredientKeys: [] },
      { order: 5, description: semanticDescriptions[7]!, sourceStepOrders: [8], ingredientKeys: [] },
    ];
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    assertStepSemantics(result);
  });

  it.each(['source', 'export'] as const)('rejects invented numeric temperature in %s text', (layer) => {
    const result = semanticRecipe();
    const step = layer === 'source' ? result.steps[3]! : result.exportSuggestion.steps[1]!;
    step.description = step.description.replace('Pfanne', 'Pfanne bei 180°C');
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(() => assertStepSemantics(result)).toThrow();
  });

  const losses = [
    [1, '18', '8'], [1, 'gieße', 'stelle'], [1, 'Kartoffeln', 'Bohnen'],
    [2, '8', '18'], [2, 'gieße', 'stelle'], [2, 'bissfest', 'weich'], [2, 'Bohnen', 'Kartoffeln'],
    [3, 'Würze', 'Wasche'], [3, 'Hähnchen', 'Bohnen'], [3, 'Salz', 'Zucker'], [3, 'Pfeffer', 'Zucker'],
    [4, 'Erhitze', 'Lagere'], [4, 'Olivenöl', 'Wasser'], [4, 'Pfanne', 'Schüssel'],
    [5, 'Brate', 'Wasche'], [5, 'mittlerer', 'hoher'], [5, '4', '6'], [5, 'je Seite', 'insgesamt'], [5, 'Hähnchen', 'Bohnen'],
    [6, 'Reduziere', 'Erhöhe'], [6, 'weitere', 'insgesamt'], [6, '6', '4'], [6, 'gare', 'wasche'], [6, 'Hähnchen', 'Bohnen'],
    [7, 'Nimm', 'Lege'], [7, 'zugedeckt', 'offen'], [7, '3', '6'], [7, 'ruhen', 'braten'], [7, 'Hähnchen', 'Bohnen'],
    [8, 'Schneide', 'Wasche'], [8, 'serviere', 'lagere'], [8, 'Beilage', 'Dekoration'], [8, 'Bohnen', 'Reis'],
    [8, 'Hähnchen', 'Bohnen'], [8, 'Kartoffeln', 'Reis'],
  ] as const;

  it.each(losses)('rejects source %i loss: %s -> %s with valid counts and trace', (order, original, replacement) => {
    const result = semanticRecipe();
    result.steps[order - 1]!.description = result.steps[order - 1]!.description.replace(original, replacement);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(() => assertStepSemantics(result)).toThrow();
  });

  it.each([
    [1, 'Koche', 'Lagere'], [2, 'Bohnen', 'Reis'], [5, 'Brate', 'Wasche'],
    [6, 'gare', 'wasche'], [1, '18', '8'], [5, '4', '6'],
  ] as const)('rejects export core/contradiction %i: %s -> %s in its referenced group', (order, original, replacement) => {
    const result = semanticRecipe();
    const step = result.exportSuggestion.steps.find((candidate) => candidate.sourceStepOrders.includes(order))!;
    const exportOriginal = original;
    expect(step.description).toContain(exportOriginal);
    step.description = step.description.replace(exportOriginal, replacement);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(() => assertStepSemantics(result)).toThrow();
  });

  it.each(['source', 'export'] as const)('rejects swapped potato/bean times in %s text', (layer) => {
    const result = semanticRecipe();
    if (layer === 'source') {
      result.steps[0]!.description = semanticDescriptions[1]!;
      result.steps[1]!.description = semanticDescriptions[0]!;
    } else {
      result.exportSuggestion.steps[0]!.description = 'Koche Kartoffeln 8 Min. in Salzwasser, gare Bohnen 18 Min. bissfest; gieße beide ab.';
    }
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(() => assertStepSemantics(result)).toThrow();
  });

  it('does not accept details moved to an unrelated export group', () => {
    const result = semanticRecipe();
    const first = result.exportSuggestion.steps[0]!;
    const second = result.exportSuggestion.steps[1]!;
    [first.description, second.description] = [second.description, first.description];
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(() => assertStepSemantics(result)).toThrow();
  });

  it('accepts omitted optional details and serving without losing independent cooking', () => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = [
      { order: 1, description: 'Koche Kartoffeln und gare Bohnen.', sourceStepOrders: [1, 2], ingredientKeys: [] },
      { order: 2, description: 'Brate Hähnchen an und gare Hähnchen bei reduzierter Hitze fertig.', sourceStepOrders: [5, 6], ingredientKeys: [] },
    ];
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    assertStepSemantics(result);
  });

  it('allows a source-backed numeric temperature in an export assertion', () => {
    const result = semanticRecipe();
    result.steps[4]!.description += ' Bei 180°C.';
    result.exportSuggestion.steps = [{ order: 1, description: 'Brate Hähnchen bei 180°C.', sourceStepOrders: [5], ingredientKeys: [] }];
    assertRecipeStepSemantics(result, { ingredients: [], exportStepSemanticAssertions: [
      { sourceStepOrder: 5, description: 'source-backed numeric temperature', patterns: [/180°C/u] },
    ] });
  });
});

describe('Recipe Analyze exact trace regressions', () => {
  it.each([[[1, 3], [6]], [[2, 4, 7]], [[1]], [[1], [2], [3], [4]]])('accepts gaps within and between groups: %j', (...groups) => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = groups.map((sourceStepOrders, index) => ({
      order: index + 1, description: 'Synthetischer Schritt.', sourceStepOrders, ingredientKeys: [],
    }));
    const before = structuredClone(result);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(result).toEqual(before);
  });

  it.each([1, 4, 5])('accepts %i export texts and the 90-character boundary', (count) => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = Array.from({ length: count }, (_, index) => ({
      order: index + 1, description: 'x'.repeat(90), sourceStepOrders: [index + 1], ingredientKeys: [],
    }));
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
  });

  it.each([0, 6])('rejects %i export texts without inventing a fallback', (count) => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = Array.from({ length: count }, (_, index) => ({
      order: index + 1, description: 'Schritt.', sourceStepOrders: [index + 1], ingredientKeys: [],
    }));
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(false);
  });

  it.each([false, true])('rejects absent cooking source with empty export=%j', (emptyExport) => {
    const result = semanticRecipe();
    result.steps = [];
    if (emptyExport) result.exportSuggestion.steps = [];
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(false);
  });

  it.each(['source-duplicate', 'source-reorder', 'export-duplicate', 'export-gap', 'overlong'] as const)('rejects %s without mutation', (kind) => {
    const result = semanticRecipe();
    if (kind === 'source-duplicate') result.steps[1]!.order = 1;
    if (kind === 'source-reorder') [result.steps[0], result.steps[1]] = [result.steps[1]!, result.steps[0]!];
    if (kind === 'export-duplicate') result.exportSuggestion.steps[1]!.order = 1;
    if (kind === 'export-gap') result.exportSuggestion.steps[1]!.order = 3;
    if (kind === 'overlong') result.exportSuggestion.steps[0]!.description = 'x'.repeat(91);
    const before = structuredClone(result);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(false);
    expect(result).toEqual(before);
  });

  it.each([
    { groups: [[1, 1]], code: 'duplicate_export_source_reference' },
    { groups: [[1], [1]], code: 'duplicate_export_source_reference' },
    { groups: [[2], [1]], code: 'export_source_trace_not_ascending' },
    { groups: [[2, 1]], code: 'source_step_references_not_ascending' },
    { groups: [[99]], code: 'unknown_source_step_reference' },
  ])('keeps stable diagnostic $code for $groups', ({ groups, code }) => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = groups.map((sourceStepOrders, index) => ({
      order: index + 1, description: 'Schritt.', sourceStepOrders, ingredientKeys: [],
    }));
    const validation = validateRecipeExportPreparationOutput(result);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.diagnostics).toContainEqual(expect.objectContaining({ phase: 'semantic', code }));
  });
  it('accepts the ordered eight-step partial trace without repair in both validators', () => {
    const result = semanticRecipe();
    result.exportSuggestion.steps = [[1], [2], [3], [4], [6, 7]].map((sourceStepOrders, index) => ({
      order: index + 1, description: 'Synthetischer Schritt.', sourceStepOrders, ingredientKeys: [],
    }));
    const before = structuredClone(result);
    const validation = validateRecipeExportPreparationOutput(result);
    expect(validation.ok).toBe(true);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(result).toEqual(before);
  });

  it('reports the exact QA duplicate trace without repairing it', () => {
    const result = semanticRecipe();
    result.steps = result.steps.slice(0, 5);
    result.exportSuggestion.steps = [[1, 2], [3], [4], [5], [5]].map((sourceStepOrders, index) => ({
      order: index + 1, description: 'Synthetischer Schritt.', sourceStepOrders, ingredientKeys: [],
    }));
    const before = structuredClone(result);
    const validation = validateRecipeExportPreparationOutput(result);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.diagnostics.filter(({ code }) => code === 'duplicate_export_source_reference'))
      .toMatchObject([
        { phase: 'semantic', code: 'duplicate_export_source_reference', path: 'steps[3].sourceStepOrders', stepIndex: 3, offendingReferences: [5] },
        { phase: 'semantic', code: 'duplicate_export_source_reference', path: 'steps[4].sourceStepOrders', stepIndex: 4, offendingReferences: [5] },
      ]);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(result).toEqual(before);
  });

  it.each([
    [[1], [2], [3], [4], [5, 5]],
    [[1, 2], [3], [4], [5], [5]],
    [[1], [2], [3], [4], [6]],
    [[1], [3], [2], [4], [5]],
    [[2, 1]],
    [[]],
    [[0]],
    [[-1]],
  ])('rejects duplicate, unknown, reordered or empty references: %j', (...groups) => {
    const result = semanticRecipe();
    result.steps = result.steps.slice(0, 5);
    result.exportSuggestion.steps = groups.map((sourceStepOrders, index) => ({ order: index + 1, description: 'Synthetischer Schritt.', sourceStepOrders, ingredientKeys: [] }));
    const before = structuredClone(result);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(false);
    expect(result).toEqual(before);
  });

  it.each(['', '   '])('rejects empty export text: %j', (description) => {
    const result = semanticRecipe();
    result.exportSuggestion.steps[0]!.description = description;
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(false);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(false);
  });
});

function syntheticPreparationRecipe(): AiRecipeRaw {
  const result = semanticRecipe();
  result.steps = RECIPE_PREPARATION_EVAL_FIXTURE.preparation.steps.map((step) => ({ ...step, title: step.title ?? null }));
  result.exportSuggestion.steps = [
    { order: 1, description: 'Schneide Hähnchen in Würfel; würze Hähnchen mit Salz/Pfeffer.', sourceStepOrders: [1, 2], ingredientKeys: [] },
    { order: 2, description: 'Erhitze Olivenöl in Pfanne; brate Hähnchen bei mittlerer Hitze 4 Min. je Seite.', sourceStepOrders: [3, 4], ingredientKeys: [] },
    { order: 3, description: 'Koche Reis separat 12 Min. in Salzwasser; gieße ihn ab.', sourceStepOrders: [5], ingredientKeys: [] },
    { order: 4, description: 'Senke Hitze, gare Hähnchen weitere 6 Min; nimm Hähnchen aus Pfanne, ruhe zugedeckt 3 Min', sourceStepOrders: [6, 7], ingredientKeys: [] },
    { order: 5, description: 'Serviere Hähnchen mit Reis als Beilage.', sourceStepOrders: [8], ingredientKeys: [] },
  ];
  return result;
}

describe('synthetic saved Preparation semantics offline', () => {
  it.each([
    { label: 'minimal finish cooking', description: 'Gare Hähnchen fertig.', references: [6], accepted: true },
    { label: 'finish cooking combined with serving', description: 'Gare Hähnchen fertig und serviere es mit Reis.', references: [6, 8], accepted: true },
    { label: 'missing finish-cooking reference', description: 'Gare Hähnchen fertig.', references: [7], accepted: false },
    { label: 'missing finish-cooking action', description: 'Serviere Hähnchen mit Reis.', references: [6, 8], accepted: false },
    { label: 'wrong component', description: 'Gare Reis fertig.', references: [6], accepted: false },
    { label: 'wrong component despite chicken mention', description: 'Gare Reis fertig und serviere Hähnchen.', references: [6, 8], accepted: false },
    { label: 'wrong component alongside correct cooking', description: 'Gare Hähnchen und Reis fertig.', references: [6], accepted: false },
    { label: 'wrong additional time', description: 'Gare Hähnchen weitere 4 Minuten.', references: [6], accepted: false },
    { label: 'invented temperature', description: 'Gare Hähnchen bei 180°C fertig.', references: [6], accepted: false },
    { label: 'swapped rice and finish-cooking texts', description: 'Koche Reis separat.', references: [6], accepted: false },
  ])('checks source 6 rubric with valid structure: $label', ({ label, description, references, accepted }) => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps = [
      { order: 1, description: 'Schneide Hähnchen.', sourceStepOrders: [1], ingredientKeys: [] },
      { order: 2, description: 'Brate Hähnchen an.', sourceStepOrders: [4], ingredientKeys: [] },
      { order: 3, description: label === 'swapped rice and finish-cooking texts' ? 'Gare Hähnchen fertig.' : 'Koche Reis separat.', sourceStepOrders: [5], ingredientKeys: [] },
      { order: 4, description, sourceStepOrders: references, ingredientKeys: [] },
    ];
    const before = structuredClone(result);
    expect(validateRecipeAnalyzeOutput(result).ok).toBe(true);
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    if (accepted) {
      assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints);
    } else {
      expect(() => assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints)).toThrow();
    }
    expect(result).toEqual(before);
  });

  it('accepts the documented synthetic v15 texts under the approved selective core contract', () => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps = [
      { order: 1, sourceStepOrders: [1, 2, 3, 4], description: 'Schneide das Hähnchen, würze es und brate es in Olivenöl.', ingredientKeys: ['ingredient-1', 'ingredient-4', 'ingredient-5', 'ingredient-3'] },
      { order: 2, sourceStepOrders: [5], description: 'Koche den Reis separat 12 Minuten in Salzwasser und gieße ihn ab.', ingredientKeys: ['ingredient-2'] },
      { order: 3, sourceStepOrders: [6], description: 'Senke die Hitze und gare das Hähnchen weitere 6 Minuten.', ingredientKeys: ['ingredient-1'] },
      { order: 4, sourceStepOrders: [7], description: 'Lasse das Hähnchen zugedeckt 3 Minuten ruhen.', ingredientKeys: ['ingredient-1'] },
      { order: 5, sourceStepOrders: [8], description: 'Serviere das Hähnchen mit Reis als Beilage.', ingredientKeys: ['ingredient-1', 'ingredient-2'] },
    ];
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(result.exportSuggestion.steps).toHaveLength(5);
    expect(result.exportSuggestion.steps.map((step) => step.description.length)).toEqual([57, 65, 56, 45, 43]);
    expect(result.exportSuggestion.steps.flatMap((step) => step.sourceStepOrders)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints);
  });

  it('covers all eight saved actions with a structurally valid trace', () => {
    const result = syntheticPreparationRecipe();
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(result.exportSuggestion.steps).toHaveLength(5);
    expect(result.exportSuggestion.steps.flatMap((step) => step.sourceStepOrders)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints);
  });

  it('accepts alternative adjacent groups without prescribing boundaries', () => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps[0]!.description += ' Erhitze Olivenöl in Pfanne.';
    result.exportSuggestion.steps[0]!.sourceStepOrders = [1, 2, 3];
    result.exportSuggestion.steps[1]!.description = 'Brate Hähnchen bei mittlerer Hitze 4 Min. je Seite.';
    result.exportSuggestion.steps[1]!.sourceStepOrders = [4];
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints);
  });

  it.each([
    [1, 'Schneide', 'Wasche'], [2, 'brate', 'wasche'],
    [3, 'Koche', 'Lagere'], [3, 'Reis', 'Bohnen'], [3, '12', '8'],
    [4, 'gare', 'wasche'], [4, '6', '4'], [2, 'Pfanne', 'Pfanne bei 180°C'],
  ])('rejects export group %i core loss or contradiction %s -> %s despite valid structure', (group, original, replacement) => {
    const result = syntheticPreparationRecipe();
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    const step = result.exportSuggestion.steps[Number(group) - 1]!;
    expect(step.description).toContain(original);
    step.description = step.description.replace(String(original), String(replacement));
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(result.exportSuggestion.steps.flatMap((candidate) => candidate.sourceStepOrders)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints)).toThrow();
  });

  it('rejects rice/serving text swapped into unrelated valid references', () => {
    const result = syntheticPreparationRecipe();
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    const rice = result.exportSuggestion.steps[2]!;
    const serving = result.exportSuggestion.steps[4]!;
    [rice.description, serving.description] = [serving.description, rice.description];
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(() => assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints)).toThrow();
  });

  it('accepts a four-step core summary omitting details and serving', () => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps = [
      { order: 1, description: 'Schneide Hähnchen.', sourceStepOrders: [1], ingredientKeys: [] },
      { order: 2, description: 'Brate Hähnchen an.', sourceStepOrders: [4], ingredientKeys: [] },
      { order: 3, description: 'Koche Reis separat.', sourceStepOrders: [5], ingredientKeys: [] },
      { order: 4, description: 'Senke die Hitze und gare Hähnchen fertig.', sourceStepOrders: [6], ingredientKeys: [] },
    ];
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints);
  });

  it('rejects missing rice cooking qualitatively even when the partial trace is valid', () => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps = [[1], [2], [3], [4], [6, 7]].map((sourceStepOrders, index) => ({
      order: index + 1, description: ['Schneide Hähnchen.', 'Würze Hähnchen.', 'Erhitze Olivenöl.', 'Brate Hähnchen an.', 'Gare Hähnchen fertig.'][index]!, sourceStepOrders, ingredientKeys: [],
    }));
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(() => assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints)).toThrow();
  });

  it('does not count rice mentioned with chicken as independent rice cooking', () => {
    const result = syntheticPreparationRecipe();
    result.exportSuggestion.steps[2]!.description = 'Serviere Hähnchen mit Reis.';
    expect(validateRecipeExportPreparationOutput(result).ok).toBe(true);
    expect(() => assertRecipeStepSemantics(result, RECIPE_PREPARATION_EVAL_FIXTURE.constraints)).toThrow();
  });
});

function validExportPreparation() {
  return {
      version: 1,
      teaser: 'Einfaches Brot',
      totalTimeMinutes: 45,
      difficulty: 'Einfach',
      steps: [{ order: 1, description: 'Mischen.', sourceStepOrders: [1] }],
  };
}

describe('validateRecipeExportPreparationOutput diagnostics', () => {
  it('returns schema code and field path without including the invalid value', () => {
    const invalidValue = { privateText: 'private recipe text' };
    const raw: unknown = validExportPreparation();
    (raw as { teaser: unknown }).teaser = invalidValue;

    const result = validateCompactPreparation(raw, [{ order: 1, description: 'Zutaten mischen.' }]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics).toContainEqual({
      phase: 'schema',
      code: 'invalid_type',
      path: 'teaser',
      constraint: 'invalid_type',
      explanation: 'The field must satisfy the strict Preparation schema.',
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain(invalidValue.privateText);
  });

  it('identifies semantic source-step trace failures with stable codes', () => {
    const raw = validExportPreparation();
    const result = validateCompactPreparation(raw, [
      { order: 1, description: 'Zutaten mischen.' }, { order: 1, description: 'Weitere Schritte.' },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('duplicate_source_step_order@sourceSteps[0].order');
    expect(result.errors).toContain('duplicate_source_step_order@sourceSteps[1].order');
    expect(result.diagnostics.filter(({ code }) => code === 'duplicate_source_step_order')).toEqual([
      { phase: 'semantic', code: 'duplicate_source_step_order', path: 'sourceSteps[0].order' },
      { phase: 'semantic', code: 'duplicate_source_step_order', path: 'sourceSteps[1].order' },
    ]);
  });

  it('accepts a gap between source orders without requiring coverage', () => {
    const raw = validExportPreparation();
    const result = validateCompactPreparation(raw, [
      { order: 1, description: 'Zutaten mischen.' }, { order: 3, description: 'Weiterkochen.' },
    ]);

    expect(result.ok).toBe(true);
  });
});