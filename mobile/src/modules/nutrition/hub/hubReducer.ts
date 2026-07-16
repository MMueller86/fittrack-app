// hubReducer.ts — pure state machine for FoodEntryHub, no React.
// All invalid state combinations are structurally impossible.

import type { FoodSearchResult } from '@fittrack/shared';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type HubMode =
  | { mode: 'idle' }
  | { mode: 'search'; query: string }
  | { mode: 'product'; product: FoodSearchResult; previousMode: 'idle' | 'search'; previousQuery: string }
  | { mode: 'subflow'; flow: 'barcode' | 'ai' | 'label' | 'manual' };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type HubAction =
  | { type: 'OPEN_SEARCH' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SELECT_PRODUCT'; product: FoodSearchResult }
  | { type: 'CLOSE_PRODUCT' }
  | { type: 'OPEN_SUBFLOW'; flow: 'barcode' | 'ai' | 'label' | 'manual' }
  | { type: 'CLOSE_SUBFLOW' }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_HUB_STATE: HubMode = { mode: 'idle' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function hubReducer(state: HubMode, action: HubAction): HubMode {
  switch (action.type) {
    case 'OPEN_SEARCH': {
      if (state.mode === 'search') return state;
      return { mode: 'search', query: '' };
    }

    case 'SET_QUERY': {
      if (state.mode !== 'search') {
        // Implicitly enter search mode if query typed from idle
        return { mode: 'search', query: action.query };
      }
      return { ...state, query: action.query };
    }

    case 'SELECT_PRODUCT': {
      const previousMode = state.mode === 'search' ? 'search' : 'idle';
      const previousQuery = state.mode === 'search' ? state.query : '';
      return { mode: 'product', product: action.product, previousMode, previousQuery };
    }

    case 'CLOSE_PRODUCT': {
      if (state.mode !== 'product') return state;
      if (state.previousMode === 'search') {
        return { mode: 'search', query: state.previousQuery };
      }
      return { mode: 'idle' };
    }

    case 'OPEN_SUBFLOW': {
      return { mode: 'subflow', flow: action.flow };
    }

    case 'CLOSE_SUBFLOW': {
      return { mode: 'idle' };
    }

    case 'RESET': {
      return { mode: 'idle' };
    }

    default:
      return state;
  }
}
