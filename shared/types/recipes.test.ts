import { describe, expect, it } from 'vitest';
import type {
  Recipe,
  RecipeExportDifficulty,
  PrepareRecipeExportViewRequestV2,
  PrepareRecipeExportViewResponseV2,
  RecipeExportSuggestion,
  RecipeExportViewAction,
  RecipeExportView,
  RecipeExportViewInput,
  RecipeExportViewPersistence,
  RecipeExportViewRequest,
  RecipeExportViewResponse,
  RecipeExportViewStatus,
} from '../index';

type Assert<T extends true> = T;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
  ? true
  : false;

const persistedExportView: RecipeExportView = {
  version: 1,
  teaser: 'Crispy oven potatoes',
  totalTimeMinutes: 45,
  difficulty: 'Easy',
  steps: [{ order: 1, description: 'Season the potatoes and bake.' }],
  includedIngredientIds: ['ingredient-1'],
  sourceFingerprint: 'server-fingerprint',
};

const clientExportViewInput: RecipeExportViewInput = {
  version: 1,
  teaser: 'Crispy oven potatoes',
  totalTimeMinutes: 45,
  difficulty: 'Easy',
  steps: [{ order: 1, description: 'Season the potatoes and bake.' }],
  includedIngredientIds: ['ingredient-1'],
};

const clientExportViewRequest: RecipeExportViewRequest = {
  exportView: clientExportViewInput,
  exportViewAction: 'confirm',
};

const responseExportView: RecipeExportViewResponse = {
  exportView: persistedExportView,
  exportViewStatus: 'current',
};

const v2PreparationRequest: PrepareRecipeExportViewRequestV2 = { contractVersion: 2 };
const v2PreparationResponse: PrepareRecipeExportViewResponseV2 = {
  contractVersion: 2,
  recipeId: 'recipe-1',
  sourceEtag: '"recipe-revision"',
  suggestion: {
    version: 1,
    teaser: 'Crispy oven potatoes',
    totalTimeMinutes: 45,
    difficulty: 'Easy',
    steps: [{
      order: 1,
      description: 'Season the potatoes and bake.',
    }],
  },
};

type InputHasNoServerFingerprint = 'sourceFingerprint' extends keyof RecipeExportViewInput
  ? false
  : true;
const inputHasNoServerFingerprint: InputHasNoServerFingerprint = true;
const actionIsRequestOnlyConfirm: Assert<Equal<RecipeExportViewAction, 'confirm'>> = true;
const difficultyRemainsFreeForm: Assert<Equal<RecipeExportDifficulty, string>> = true;
const requestContainsOnlyBodyFields: Assert<
  Equal<keyof RecipeExportViewRequest, 'exportView' | 'exportViewAction'>
> = true;
const requestDoesNotAcceptFingerprint: Assert<
  'sourceFingerprint' extends keyof RecipeExportViewRequest ? false : true
> = true;
const persistenceContainsFingerprint: Assert<
  'sourceFingerprint' extends keyof RecipeExportViewPersistence ? true : false
> = true;
const persistenceDoesNotContainAction: Assert<
  'exportViewAction' extends keyof RecipeExportViewPersistence ? false : true
> = true;
const responseContainsStatus: Assert<
  'exportViewStatus' extends keyof RecipeExportViewResponse ? true : false
> = true;
const responseViewContainsFingerprint: Assert<
  'sourceFingerprint' extends keyof NonNullable<RecipeExportViewResponse['exportView']> ? true : false
> = true;
const responseDoesNotContainAction: Assert<
  'exportViewAction' extends keyof RecipeExportViewResponse ? false : true
> = true;

describe('recipe export shared contract', () => {
  it('exposes the version and pure structural boundaries', () => {
    expect(persistedExportView.version).toBe(1);
    expect(persistedExportView.steps).toHaveLength(1);
    expect(persistedExportView.includedIngredientIds).toHaveLength(1);
    expect(clientExportViewInput.teaser.length).toBeLessThanOrEqual(96);
    expect(clientExportViewInput.steps[0].description.length).toBeLessThanOrEqual(90);
    expect(clientExportViewInput.totalTimeMinutes).toBeGreaterThan(0);
    expect(clientExportViewInput.totalTimeMinutes).toBeLessThanOrEqual(10_080);
  });

  it('keeps the server fingerprint out of the client input boundary', () => {
    expect(clientExportViewInput).toEqual({
      version: 1,
      teaser: 'Crispy oven potatoes',
      totalTimeMinutes: 45,
      difficulty: 'Easy',
      steps: [{ order: 1, description: 'Season the potatoes and bake.' }],
      includedIngredientIds: ['ingredient-1'],
    });
    expect(inputHasNoServerFingerprint).toBe(true);
    expect(persistedExportView.sourceFingerprint).toBe('server-fingerprint');
  });

  it('separates confirmation request, persistence, and response shapes', () => {
    expect(clientExportViewRequest).toEqual({
      exportView: clientExportViewInput,
      exportViewAction: 'confirm',
    });
    expect(responseExportView).toEqual({
      exportView: persistedExportView,
      exportViewStatus: 'current',
    });
    expect([
      actionIsRequestOnlyConfirm,
      difficultyRemainsFreeForm,
      requestContainsOnlyBodyFields,
      requestDoesNotAcceptFingerprint,
      persistenceContainsFingerprint,
      persistenceDoesNotContainAction,
      responseContainsStatus,
      responseViewContainsFingerprint,
      responseDoesNotContainAction,
    ]).toEqual([true, true, true, true, true, true, true, true, true]);
  });

  it('models nullable analysis suggestions with ingredient keys', () => {
    const suggestion: RecipeExportSuggestion = {
      version: 1,
      teaser: 'Needs review',
      totalTimeMinutes: null,
      difficulty: null,
      steps: [],
      includedIngredientKeys: ['potato'],
      sourceFingerprint: 'server-fingerprint',
    };

    expect(suggestion.totalTimeMinutes).toBeNull();
    expect(suggestion.difficulty).toBeNull();
    expect(suggestion.includedIngredientKeys).toEqual(['potato']);
  });

  it('defines a single ETag-bound text-only preparation contract', () => {
    expect(v2PreparationRequest).toEqual({ contractVersion: 2 });
    expect(v2PreparationResponse.suggestion).not.toHaveProperty('includedIngredientIds');
    expect(v2PreparationResponse.suggestion).not.toHaveProperty('ingredientResolutions');
  });

  it('allows an optional export view and derived response status on Recipe', () => {
    const recipeProjection: Pick<Recipe, 'exportView' | 'exportViewStatus'> = {
      exportView: persistedExportView,
      exportViewStatus: 'current',
    };
    const statuses: RecipeExportViewStatus[] = ['missing', 'current', 'stale'];

    expect(recipeProjection.exportView).toEqual(persistedExportView);
    expect(statuses).toEqual(['missing', 'current', 'stale']);
  });
});