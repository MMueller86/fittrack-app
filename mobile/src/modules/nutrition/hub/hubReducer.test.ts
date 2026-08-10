import { describe, it, expect } from 'vitest';
import { hubReducer, INITIAL_HUB_STATE, type HubMode } from './hubReducer';

const mockProduct = {
  id: 'test:123',
  name: 'Hähnchenbrust',
  source: 'library' as const,
  nutritionPer100g: { per: '100g' as const, calories: 120, protein: 23, carbs: 0, fat: 2.6 },
};

describe('hubReducer', () => {
  it('starts in idle', () => {
    expect(INITIAL_HUB_STATE.mode).toBe('idle');
  });

  it('OPEN_SEARCH: idle → search', () => {
    const next = hubReducer(INITIAL_HUB_STATE, { type: 'OPEN_SEARCH' });
    expect(next).toEqual({ mode: 'search', query: '' });
  });

  it('OPEN_SEARCH: search → search (idempotent)', () => {
    const search: HubMode = { mode: 'search', query: 'apfel' };
    const next = hubReducer(search, { type: 'OPEN_SEARCH' });
    expect(next).toBe(search); // same reference
  });

  it('SET_QUERY: updates query', () => {
    const search: HubMode = { mode: 'search', query: '' };
    const next = hubReducer(search, { type: 'SET_QUERY', query: 'banane' });
    expect(next).toEqual({ mode: 'search', query: 'banane' });
  });

  it('SET_QUERY: implicitly enters search from idle', () => {
    const next = hubReducer(INITIAL_HUB_STATE, { type: 'SET_QUERY', query: 'toast' });
    expect(next).toEqual({ mode: 'search', query: 'toast' });
  });

  it('SET_QUERY: preserves trailing whitespace (regression: trimEnd removed from handleSearchChange)', () => {
    const search: HubMode = { mode: 'search', query: '' };
    const next = hubReducer(search, { type: 'SET_QUERY', query: 'Magnum ' });
    expect(next).toEqual({ mode: 'search', query: 'Magnum ' });
  });

  it('SELECT_PRODUCT from search: remembers previous query', () => {
    const search: HubMode = { mode: 'search', query: 'hähnchen' };
    const next = hubReducer(search, { type: 'SELECT_PRODUCT', product: mockProduct as never });
    expect(next).toEqual({
      mode: 'product',
      product: mockProduct,
      previousMode: 'search',
      previousQuery: 'hähnchen',
    });
  });

  it('SELECT_PRODUCT from idle: previous query is empty', () => {
    const next = hubReducer(INITIAL_HUB_STATE, { type: 'SELECT_PRODUCT', product: mockProduct as never });
    expect(next).toEqual({
      mode: 'product',
      product: mockProduct,
      previousMode: 'idle',
      previousQuery: '',
    });
  });

  it('CLOSE_PRODUCT: returns to previous search state', () => {
    const product: HubMode = {
      mode: 'product',
      product: mockProduct as never,
      previousMode: 'search',
      previousQuery: 'hähnchen',
    };
    const next = hubReducer(product, { type: 'CLOSE_PRODUCT' });
    expect(next).toEqual({ mode: 'search', query: 'hähnchen' });
  });

  it('CLOSE_PRODUCT: returns to idle when previous was idle', () => {
    const product: HubMode = {
      mode: 'product',
      product: mockProduct as never,
      previousMode: 'idle',
      previousQuery: '',
    };
    const next = hubReducer(product, { type: 'CLOSE_PRODUCT' });
    expect(next).toEqual({ mode: 'idle' });
  });

  it('OPEN_SUBFLOW: always transitions to subflow', () => {
    const next = hubReducer(INITIAL_HUB_STATE, { type: 'OPEN_SUBFLOW', flow: 'barcode' });
    expect(next).toEqual({ mode: 'subflow', flow: 'barcode', previousMode: 'idle', previousQuery: '' });
  });

  it('CLOSE_SUBFLOW: returns to idle when previous was idle', () => {
    const subflow: HubMode = { mode: 'subflow', flow: 'ai', previousMode: 'idle', previousQuery: '' };
    const next = hubReducer(subflow, { type: 'CLOSE_SUBFLOW' });
    expect(next).toEqual({ mode: 'idle' });
  });

  it('CLOSE_SUBFLOW: restores search state when previous was search', () => {
    const subflow: HubMode = { mode: 'subflow', flow: 'barcode', previousMode: 'search', previousQuery: 'hähnchen' };
    const next = hubReducer(subflow, { type: 'CLOSE_SUBFLOW' });
    expect(next).toEqual({ mode: 'search', query: 'hähnchen' });
  });

  it('CLOSE_SUBFLOW: no-op when not in subflow mode', () => {
    expect(hubReducer(INITIAL_HUB_STATE, { type: 'CLOSE_SUBFLOW' })).toBe(INITIAL_HUB_STATE);
    const search: HubMode = { mode: 'search', query: 'banane' };
    expect(hubReducer(search, { type: 'CLOSE_SUBFLOW' })).toBe(search);
  });

  it('OPEN_SUBFLOW from search: remembers previous query', () => {
    const search: HubMode = { mode: 'search', query: 'banane' };
    const next = hubReducer(search, { type: 'OPEN_SUBFLOW', flow: 'ai' });
    expect(next).toEqual({ mode: 'subflow', flow: 'ai', previousMode: 'search', previousQuery: 'banane' });
  });

  it('RESET: always returns to idle from any state', () => {
    const search: HubMode = { mode: 'search', query: 'test' };
    expect(hubReducer(search, { type: 'RESET' })).toEqual({ mode: 'idle' });

    const product: HubMode = { mode: 'product', product: mockProduct as never, previousMode: 'search', previousQuery: 'test' };
    expect(hubReducer(product, { type: 'RESET' })).toEqual({ mode: 'idle' });

    const subflow: HubMode = { mode: 'subflow', flow: 'barcode', previousMode: 'search', previousQuery: 'test' };
    expect(hubReducer(subflow, { type: 'RESET' })).toEqual({ mode: 'idle' });
  });

  // Recipe mode: hub opens with initialQuery → RESET then SET_QUERY
  it('recipe mode init: RESET then SET_QUERY enters search mode with pre-filled query', () => {
    const afterReset = hubReducer(INITIAL_HUB_STATE, { type: 'RESET' });
    const afterSetQuery = hubReducer(afterReset, { type: 'SET_QUERY', query: 'Hähnchenbrust' });
    expect(afterSetQuery).toEqual({ mode: 'search', query: 'Hähnchenbrust' });
  });

  it('recipe mode init: SET_QUERY from idle (single dispatch path) enters search mode', () => {
    const next = hubReducer(INITIAL_HUB_STATE, { type: 'SET_QUERY', query: 'Lachs' });
    expect(next).toEqual({ mode: 'search', query: 'Lachs' });
  });
});
