import { describe, it, expect } from 'vitest';
import { evaluateHint } from './hintEngine';
import type { HintContext, HintState } from '../../../shared/types/hint';
import type { Meal, DaySummary } from '../../../shared/types/diary';
import type { DayTargets } from '../../../shared/types/nutrition';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TARGETS: DayTargets = {
  calories: 2000,
  proteinG: 150,
  fatG: 70,
  carbsG: 200,
  fiberG: 25,
};

function makeMeal(type: Meal['type'], items: Meal['items'] = []): Meal {
  return {
    id: `meal-${type}`,
    userId: 'user1',
    date: '2026-07-02',
    type,
    name: type,
    items: items.length > 0 ? items : [{ id: 'item1', name: 'item', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 } }],
    createdAt: new Date().toISOString(),
  };
}

function makeCtx(overrides: Partial<HintContext> = {}): HintContext {
  return {
    meals: [],
    summary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    targets: TARGETS,
    dayType: 'rest',
    currentHour: 12,
    ...overrides,
  };
}

function noState(): null {
  return null;
}

// ---------------------------------------------------------------------------
// H1: No meals logged
// ---------------------------------------------------------------------------

describe('H1 — no meals', () => {
  it('fires when meals array is empty', () => {
    const { hint } = evaluateHint(makeCtx({ meals: [] }), noState());
    expect(hint.id).toBe('H1');
    expect(hint.category).toBe('orientation');
  });

  it('fires when all meals have no items', () => {
    const emptyMeal: Meal = { ...makeMeal('breakfast'), items: [] };
    const { hint } = evaluateHint(makeCtx({ meals: [emptyMeal] }), noState());
    expect(hint.id).toBe('H1');
  });

  it('does NOT fire when at least one meal has items', () => {
    const { hint } = evaluateHint(makeCtx({ meals: [makeMeal('breakfast')] }), noState());
    expect(hint.id).not.toBe('H1');
  });
});

// ---------------------------------------------------------------------------
// H2: No breakfast, time-gated 08:00–12:59
// ---------------------------------------------------------------------------

describe('H2 — no breakfast', () => {
  it('fires between 08:00 and 12:59 when no breakfast', () => {
    const ctx = makeCtx({
      meals: [makeMeal('lunch')],
      summary: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 },
      currentHour: 9,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H2');
  });

  it('does NOT fire before 08:00', () => {
    const ctx = makeCtx({
      meals: [makeMeal('lunch')],
      summary: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 },
      currentHour: 7,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H2');
  });

  it('does NOT fire at 13:00 or later', () => {
    const ctx = makeCtx({
      meals: [makeMeal('lunch')],
      summary: { calories: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 },
      currentHour: 13,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H2');
  });

  it('does NOT fire when breakfast is present', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 800, protein: 60, carbs: 80, fat: 20, fiber: 10 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H2');
  });
});

// ---------------------------------------------------------------------------
// H3: Protein < 25%
// ---------------------------------------------------------------------------

describe('H3 — protein < 25%', () => {
  it('fires when protein is below 25% of target', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 500, protein: 20, carbs: 60, fat: 15, fiber: 5 },
      // protein 20/150 = 13.3%
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H3');
  });

  it('does NOT fire at exactly 25%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 500, protein: 37.5, carbs: 60, fat: 15, fiber: 5 },
      currentHour: 14,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H3');
  });
});

// ---------------------------------------------------------------------------
// H4: Protein < 50%, ≥2 meals
// ---------------------------------------------------------------------------

describe('H4 — protein < 50% with ≥2 meals', () => {
  it('fires with 2 meals and protein < 50%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 60, carbs: 100, fat: 30, fiber: 10 },
      // protein 60/150 = 40%
      currentHour: 14,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H4');
  });

  it('does NOT fire with only 1 meal', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 400, protein: 60, carbs: 40, fat: 15, fiber: 5 },
      currentHour: 14,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H4');
  });
});

// ---------------------------------------------------------------------------
// H5: Fiber < 40%
// ---------------------------------------------------------------------------

describe('H5 — fiber < 40%', () => {
  it('fires when fiber is below 40% of target', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 80, carbs: 100, fat: 30, fiber: 5 },
      // fiber 5/25 = 20%
      currentHour: 14,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H5');
  });
});

// ---------------------------------------------------------------------------
// H6: All main meals, no snack, remaining cals > 20%
// ---------------------------------------------------------------------------

describe('H6 — snack suggestion', () => {
  it('fires when breakfast+lunch+dinner present, no snack, remaining cal > 20%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1500, protein: 120, carbs: 180, fat: 50, fiber: 20 },
      // remaining = (2000-1500)/2000 = 25%
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H6');
  });

  it('does NOT fire when snack is present', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner'), makeMeal('snack')],
      summary: { calories: 1600, protein: 130, carbs: 200, fat: 55, fiber: 22 },
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H6');
  });

  it('does NOT fire when remaining cals <= 20%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1700, protein: 130, carbs: 200, fat: 55, fiber: 22 },
      // remaining = 15%
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H6');
  });
});

// ---------------------------------------------------------------------------
// H7: No dinner, time-gated from 17:00
// ---------------------------------------------------------------------------

describe('H7 — dinner missing', () => {
  it('fires after 17:00 with breakfast but no dinner', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 120, carbs: 100, fat: 35, fiber: 20 },
      currentHour: 18,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H7');
  });

  it('does NOT fire before 17:00', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 400, protein: 60, carbs: 50, fat: 15, fiber: 10 },
      currentHour: 12,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H7');
  });

  it('does NOT fire when dinner exists', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('dinner')],
      summary: { calories: 1000, protein: 130, carbs: 120, fat: 40, fiber: 18 },
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H7');
  });
});

// ---------------------------------------------------------------------------
// H8: Training day, protein not reached
// ---------------------------------------------------------------------------

describe('H8 — training + protein deficit', () => {
  it('fires on training day when protein < 95%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1800, protein: 130, carbs: 200, fat: 60, fiber: 22 },
      // protein 130/150 = 86.7%
      dayType: 'training',
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H8');
  });

  it('does NOT fire on rest day', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1800, protein: 130, carbs: 200, fat: 60, fiber: 22 },
      dayType: 'rest',
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H8');
  });

  it('does NOT fire when protein >= 95%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 148, carbs: 200, fat: 70, fiber: 25 },
      dayType: 'training',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H8');
  });
});

// ---------------------------------------------------------------------------
// H9: No fruit AND no vegetable (requires category data)
// ---------------------------------------------------------------------------

describe('H9 — no fruit/vegetable', () => {
  it('fires when no fruit or vegetable categories, and category data exists', () => {
    const meal = makeMeal('lunch');
    meal.items[0].category = 'meat';
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 500, protein: 40, carbs: 20, fat: 20, fiber: 2 },
      currentHour: 15,
    });
    // protein 40/150 < 50%, has only 1 meal, so H4 won't fire
    // fiber 2/25 = 8% < 40%, so H5 fires first
    // Let's set fiber higher to get to H9
    const ctx2 = makeCtx({
      meals: [meal],
      summary: { calories: 500, protein: 80, carbs: 100, fat: 20, fiber: 12 },
      currentHour: 15,
    });
    // H1: no (has meal), H2: hour=15 no, H3: protein 80/150=53% no, H4: <2 meals no
    // H5: fiber 12/25=48% no, H6: no dinner present so no, H7: hour<17 no
    // H8: rest day no, H12: only 1 category no, H9: no fruit/veg YES
    const { hint } = evaluateHint(ctx2, noState());
    expect(hint.id).toBe('H9');
  });

  it('does NOT fire when no category data exists at all', () => {
    const meal = makeMeal('lunch');
    // no category set on items
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 500, protein: 80, carbs: 100, fat: 20, fiber: 12 },
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H9');
  });
});

// ---------------------------------------------------------------------------
// H12: ≥5 different categories — fires before H9/H10/H11
// ---------------------------------------------------------------------------

describe('H12 — variety', () => {
  it('fires when 5+ food categories are present', () => {
    const meal = makeMeal('lunch');
    meal.items = [
      { id: 'i1', name: 'apple', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 50, protein: 0, carbs: 13, fat: 0, fiber: 2 }, category: 'fruit' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 }, category: 'meat' },
      { id: 'i3', name: 'broccoli', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3 }, category: 'vegetable' },
      { id: 'i4', name: 'rice', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 130, protein: 3, carbs: 28, fat: 0, fiber: 1 }, category: 'grain' },
      { id: 'i5', name: 'yogurt', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 60, protein: 5, carbs: 5, fat: 2, fiber: 0 }, category: 'dairy' },
    ];
    // fiber set to 12 (>40% of 25) to suppress H5; protein 42/150=28% (>25%) to suppress H3/H4
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 440, protein: 42, carbs: 53, fat: 6, fiber: 12 },
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H12');
  });
});

// ---------------------------------------------------------------------------
// H10/H11: fruit/vegetable present
// ---------------------------------------------------------------------------

describe('H10/H11 — fruit/vegetable', () => {
  it('H10 fires when fruit is present but not 5+ categories', () => {
    const meal = makeMeal('lunch');
    meal.items = [
      { id: 'i1', name: 'apple', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 50, protein: 1, carbs: 13, fat: 0, fiber: 2 }, category: 'fruit' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 330, protein: 62, carbs: 0, fat: 8, fiber: 0 }, category: 'meat' },
    ];
    // fiber: 12 to suppress H5; protein 63/150=42% (>25%) suppresses H3; only 1 meal suppresses H4
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 380, protein: 63, carbs: 13, fat: 8, fiber: 12 },
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H10');
  });

  it('H11 fires when vegetable is present but not fruit, not 5+ categories', () => {
    const meal = makeMeal('lunch');
    meal.items = [
      { id: 'i1', name: 'broccoli', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 68, protein: 6, carbs: 14, fat: 0, fiber: 6 }, category: 'vegetable' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 330, protein: 62, carbs: 0, fat: 8, fiber: 0 }, category: 'meat' },
    ];
    // fiber: 12 to suppress H5; protein 68/150=45% (>25%) suppresses H3; only 1 meal suppresses H4
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 400, protein: 68, carbs: 14, fat: 8, fiber: 12 },
      currentHour: 15,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H11');
  });
});

// ---------------------------------------------------------------------------
// H13: Rest day (daycontext, 1-day cooldown)
// ---------------------------------------------------------------------------

describe('H13 — rest day', () => {
  it('fires on rest day when no other orientation hint applies', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1850, protein: 145, carbs: 195, fat: 68, fiber: 24 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H13');
    expect(hint.category).toBe('daycontext');
  });

  it('is suppressed within 1-day cooldown', () => {
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H13',
      lastHintDate: new Date().toISOString().slice(0, 10),
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: new Date().toISOString().slice(0, 10) },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1850, protein: 145, carbs: 195, fat: 68, fiber: 24 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).not.toBe('H13');
  });
});

// ---------------------------------------------------------------------------
// H16/H15/H17: Positive hints
// ---------------------------------------------------------------------------

describe('H16 — balanced macros', () => {
  it('fires when all macros are within ±10% of targets', () => {
    // Use training day so H13 (rest day) does not fire; H8 won't fire because protein is at target
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: {
        calories: 2000,
        protein: 150,  // 100%
        carbs: 200,    // 100%
        fat: 70,       // 100%
        fiber: 25,
      },
      dayType: 'training',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H16');
    expect(hint.category).toBe('positive');
  });

  it('does NOT fire when protein is outside ±10%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: {
        calories: 2000,
        protein: 125,  // 83% — outside ±10%
        carbs: 200,
        fat: 70,
        fiber: 25,
      },
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H16');
  });
});

describe('H15 — protein goal reached', () => {
  it('fires when protein >= 95% (rest day with H13 in cooldown)', () => {
    // Rest day: suppress H13 via cooldown so H15 can fire
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H13',
      lastHintDate: new Date().toISOString().slice(0, 10),
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: new Date().toISOString().slice(0, 10) },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 235, fat: 65, fiber: 24 },
      // protein 145/150 = 96.7%; carbs 235/200=117.5% outside ±10% → H16 won't fire
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).toBe('H15');
  });

  it('is suppressed within 2-day cooldown (falls through to motivation)', () => {
    const today = new Date().toISOString().slice(0, 10);
    // Suppress H13, H15, H16, H17 so motivation is the only option
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H15',
      lastHintDate: today,
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: today, H15: today, H16: today, H17: today },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 24 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).not.toBe('H15');
    // Should fall through to motivation
    expect(hint.category).toBe('motivation');
  });
});

// ---------------------------------------------------------------------------
// Motivation: cyclic rotation
// ---------------------------------------------------------------------------

describe('Motivation — cyclic rotation', () => {
  it('returns a motivation hint when no rule applies', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 24 },
      currentHour: 20,
      dayType: 'rest',
    });
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H15',
      lastHintDate: new Date().toISOString().slice(0, 10),
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: new Date().toISOString().slice(0, 10), H15: new Date().toISOString().slice(0, 10), H16: new Date().toISOString().slice(0, 10) },
      motivationIndex: 0,
    };
    const { hint, updatedState } = evaluateHint(ctx, state);
    expect(hint.category).toBe('motivation');
    expect(hint.id).toBe('M0');
    expect(updatedState.motivationIndex).toBe(1);
  });

  it('advances motivationIndex with each call', () => {
    const makePureMotivationCtx = () => makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 24 },
      currentHour: 20,
      dayType: 'rest',
    });

    // Simulate state where all non-motivation hints are cooled down
    let state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H15',
      lastHintDate: new Date().toISOString().slice(0, 10),
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: new Date().toISOString().slice(0, 10), H15: new Date().toISOString().slice(0, 10), H16: new Date().toISOString().slice(0, 10) },
      motivationIndex: 0,
    };

    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = evaluateHint(makePureMotivationCtx(), state);
      seen.push(result.hint.id);
      state = result.updatedState;
    }

    // All 10 motivation hints should appear exactly once
    const uniqueIds = new Set(seen);
    expect(uniqueIds.size).toBe(10);
  });

  it('wraps around after all motivation hints shown', () => {
    const makePureMotivationCtx = () => makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 24 },
      currentHour: 20,
      dayType: 'rest',
    });

    // Start at motivationIndex = 9 (last), all motivation hints have old cooldown dates
    const oldDate = '2025-01-01'; // well past 30 days
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'M9',
      lastHintDate: oldDate,
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: {
        H13: new Date().toISOString().slice(0, 10),
        H15: new Date().toISOString().slice(0, 10),
        H16: new Date().toISOString().slice(0, 10),
        M9: oldDate,
      },
      motivationIndex: 9,
    };

    const { hint, updatedState } = evaluateHint(makePureMotivationCtx(), state);
    expect(hint.id).toBe('M9');
    expect(updatedState.motivationIndex).toBe(0); // wrapped around
  });
});

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

describe('updatedState', () => {
  it('records cooldown date for positive hints', () => {
    // Training day: H13 won't fire; H8 won't fire (protein at target); H16 fires
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 25 },
      dayType: 'training',
      currentHour: 20,
    });
    const { updatedState } = evaluateHint(ctx, noState());
    expect(updatedState.lastHintId).toBe('H16');
    expect(updatedState.cooldownHistory.H16).toBe(new Date().toISOString().slice(0, 10));
  });

  it('does NOT record cooldown for orientation hints (no cooldown)', () => {
    const ctx = makeCtx({ meals: [] });
    const { updatedState } = evaluateHint(ctx, noState());
    expect(updatedState.lastHintId).toBe('H1');
    expect(updatedState.cooldownHistory.H1).toBeUndefined();
  });

  it('preserves existing cooldown history entries', () => {
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H13',
      lastHintDate: '2026-07-01',
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: '2026-07-01' },
      motivationIndex: 3,
    };
    const ctx = makeCtx({ meals: [] });
    const { updatedState } = evaluateHint(ctx, state);
    // H1 fires (no cooldown), H13 history preserved
    expect(updatedState.cooldownHistory.H13).toBe('2026-07-01');
    expect(updatedState.motivationIndex).toBe(3); // unchanged (motivation didn't fire)
  });
});

// ---------------------------------------------------------------------------
// Priority cascade — higher priority suppresses lower
// ---------------------------------------------------------------------------

describe('Priority cascade', () => {
  it('H1 wins over everything when no meals logged', () => {
    const ctx = makeCtx({
      meals: [],
      summary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      dayType: 'training',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H1');
  });

  it('orientation beats positive feedback', () => {
    // Protein reached (H15 would fire) but fiber is very low (H5 fires first)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 148, carbs: 210, fat: 65, fiber: 3 },
      // fiber 3/25 = 12% → H5
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H5');
  });
});
