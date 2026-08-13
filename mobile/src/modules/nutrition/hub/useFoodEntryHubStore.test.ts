import { describe, expect, it } from 'vitest';
import { useFoodEntryHubStore } from './useFoodEntryHubStore';

describe('useFoodEntryHubStore recipe context', () => {
  it('defaults regular hub sessions to diary context', () => {
    useFoodEntryHubStore.getState().open();

    const state = useFoodEntryHubStore.getState();
    expect(state.context.purpose).toBe('diary');
    expect(state.initialSubflow).toBeNull();
  });

  it('infers recipe ingredient context from ingredient callbacks', () => {
    useFoodEntryHubStore.getState().open({
      onSelectIngredient: () => undefined,
    });

    const state = useFoodEntryHubStore.getState();
    expect(state.context.purpose).toBe('recipeIngredient');
  });

  it('keeps Food-AI available but blocks diary-only initial subflows in recipe context', () => {
    useFoodEntryHubStore.getState().open({
      purpose: 'recipeIngredient',
      initialSubflow: 'barcode',
      onEstimateIngredient: () => undefined,
    });

    expect(useFoodEntryHubStore.getState().initialSubflow).toBeNull();

    useFoodEntryHubStore.getState().open({
      purpose: 'recipeIngredient',
      initialSubflow: 'ai',
      onEstimateIngredient: () => undefined,
    });

    expect(useFoodEntryHubStore.getState().initialSubflow).toBe('ai');
  });
});