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
    // H3 now requires mealCount ≥2; use hour=16 to avoid H20 (12-16h) and H18 (<14h)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 20, carbs: 100, fat: 25, fiber: 10 },
      // protein 20/150 = 13.3% < 25%; fiber 10/25=40% (not < 40% → H5 won't fire)
      currentHour: 16,
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

describe('H4 — protein < 35% with ≥3 meals', () => {
  it('fires with 3 meals and protein < 35%', () => {
    // Rule changed: now requires mealCount≥3 and proteinPct<35%; hour=16 avoids H20 (12-16h)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1100, protein: 40, carbs: 140, fat: 40, fiber: 12 },
      // protein 40/150 = 26.7% — above 25% (H3 won't fire) but below 35% (H4 fires)
      currentHour: 16,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H4');
  });

  it('does NOT fire with fewer than 3 meals', () => {
    // H4 now requires mealCount≥3; 2 meals is insufficient
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 40, carbs: 100, fat: 30, fiber: 10 },
      currentHour: 16,
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
    // hour=16 avoids H20 window (12-16h) which fires for 2 meals at 45% calories
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 80, carbs: 100, fat: 30, fiber: 5 },
      // fiber 5/25 = 20% < 40% → H5 fires
      currentHour: 16,
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
    // hour=17: H7 fires (≥17h). hour=18+ triggers H23 (calPct<70%) which comes before H7.
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 120, carbs: 100, fat: 35, fiber: 20 },
      currentHour: 17,
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
    meal.items[0].category = 'Meat';
    const ctx = makeCtx({
      meals: [meal],
      summary: { calories: 500, protein: 40, carbs: 20, fat: 20, fiber: 2 },
      currentHour: 15,
    });
    // protein 40/150 < 50%, has only 1 meal, so H4 won't fire
    // fiber 2/25 = 8% < 40%, so H5 fires first
    // Let's set fiber higher to get to H9; 2 meals required (mealCount ≥ 2), hour=16 avoids H20
    const meal2 = makeMeal('lunch');
    meal2.items[0].category = 'Meat';
    const ctx2 = makeCtx({
      meals: [meal, meal2],
      summary: { calories: 900, protein: 80, carbs: 100, fat: 20, fiber: 12 },
      currentHour: 16,
    });
    // H1: no (has meals), H2: hour=16 no, H3: protein 80/150=53% no, H4: <3 meals no
    // H5: fiber 12/25=48% no, H6: no dinner so no, H7: hour<17 no
    // H8: rest day no, H12: 1 category no, H9: no fruit/veg mealCount=2 YES
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
      { id: 'i1', name: 'apple', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 50, protein: 0, carbs: 13, fat: 0, fiber: 2 }, category: 'Fruits' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 }, category: 'Meat' },
      { id: 'i3', name: 'broccoli', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 34, protein: 3, carbs: 7, fat: 0, fiber: 3 }, category: 'Vegetables' },
      { id: 'i4', name: 'rice', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 130, protein: 3, carbs: 28, fat: 0, fiber: 1 }, category: 'Cereals' },
      { id: 'i5', name: 'yogurt', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 60, protein: 5, carbs: 5, fat: 2, fiber: 0 }, category: 'Milk and yogurt' },
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
      { id: 'i1', name: 'apple', sourceType: 'manual', quantity: 100, unit: 'g', macros: { calories: 50, protein: 1, carbs: 13, fat: 0, fiber: 2 }, category: 'Fruits' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 330, protein: 62, carbs: 0, fat: 8, fiber: 0 }, category: 'Meat' },
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
      { id: 'i1', name: 'broccoli', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 68, protein: 6, carbs: 14, fat: 0, fiber: 6 }, category: 'Vegetables' },
      { id: 'i2', name: 'chicken', sourceType: 'manual', quantity: 200, unit: 'g', macros: { calories: 330, protein: 62, carbs: 0, fat: 8, fiber: 0 }, category: 'Meat' },
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
      currentHour: 18,  // H22 fires at ≥19h — use 18 so H13 fires first
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
        fiber: 15,     // 60% — avoids H21 (fires at ≥80%)
      },
      dayType: 'training',
      currentHour: 16,  // H22 fires at ≥19h; H20 requires <16h
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
      summary: { calories: 1900, protein: 145, carbs: 235, fat: 65, fiber: 15 },
      // protein 145/150 = 96.7%; carbs 235/200=117.5% outside ±10% → H16 won't fire; fiber=15 suppresses H21
      dayType: 'rest',
      currentHour: 18,  // H22 fires at ≥19h
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
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 15 },
      dayType: 'rest',
      currentHour: 18,  // H22 fires at ≥19h; fiber=15 suppresses H21 (<80%)
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
    // hour=18 avoids H22 (≥19h); fiber=15 avoids H21 (<80% threshold)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 15 },
      currentHour: 18,
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
    // hour=18 avoids H22 (≥19h); fiber=15 avoids H21 (<80%)
    const makePureMotivationCtx = () => makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 15 },
      currentHour: 18,
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
    // hour=18 avoids H22 (≥19h); fiber=15 avoids H21 (<80%)
    const makePureMotivationCtx = () => makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 15 },
      currentHour: 18,
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
    // hour=16: avoids H22 (≥19h) and H20 window (<16h); fiber=15 avoids H21 (<80%)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 15 },
      dayType: 'training',
      currentHour: 16,
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

// ---------------------------------------------------------------------------
// Robustness — malformed Cosmos documents
// ---------------------------------------------------------------------------

describe('Robustness — missing items field', () => {
  it('does not crash when a meal document has no items field (Cosmos legacy doc)', () => {
    // Simulate a meal document read from Cosmos that is missing the items array.
    // This caused a production HTTP 500: "Cannot read properties of undefined (reading 'length')".
    const mealWithoutItems = {
      ...makeMeal('lunch'),
      items: undefined as unknown as Meal['items'],
    };
    expect(() => evaluateHint(makeCtx({ meals: [mealWithoutItems] }), noState())).not.toThrow();
  });

  it('treats a meal with missing items as empty (H1 fires)', () => {
    const mealWithoutItems = {
      ...makeMeal('breakfast'),
      items: undefined as unknown as Meal['items'],
    };
    const { hint } = evaluateHint(makeCtx({ meals: [mealWithoutItems] }), noState());
    expect(hint.id).toBe('H1');
  });
});

// ---------------------------------------------------------------------------
// H17: Training day + protein reached — cooldown regression (Bug B1)
// ---------------------------------------------------------------------------

describe('H17 — training + protein reached (cooldown regression)', () => {
  // hour=16: avoids H22 (fires at ≥19h) and H20 window (<16h); fiber=15 avoids H21 (<80%)
  const trainingProteinCtx = (): HintContext => makeCtx({
    meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
    summary: { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 15 },
    dayType: 'training',
    currentHour: 16,
  });

  it('H16 fires first (all macros balanced) on training day with all macros at target', () => {
    const { hint } = evaluateHint(trainingProteinCtx(), noState());
    expect(hint.id).toBe('H16');
  });

  it('H17 fires on training day when protein >= 95% and H16 + H15 are in cooldown', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H16',
      lastHintDate: today,
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H16: today, H15: today },
      motivationIndex: 0,
    };
    // carbs slightly off to prevent H16 from firing again; hour=16 avoids H22; fiber=15 avoids H21
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 148, carbs: 230, fat: 70, fiber: 15 },
      // protein 148/150 = 98.7% ≥ 95%; carbs 230/200 = 115% → H16 won't fire
      dayType: 'training',
      currentHour: 16,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).toBe('H17');
    expect(hint.category).toBe('positive');
  });

  it('H17 records cooldown date in updatedState (regression: was missing from COOLDOWN_DAYS)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H16',
      lastHintDate: today,
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H16: today, H15: today },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 148, carbs: 230, fat: 70, fiber: 15 },
      dayType: 'training',
      currentHour: 16,  // avoids H22 (≥19h); fiber=15 avoids H21
    });
    const { updatedState } = evaluateHint(ctx, state);
    // H17 must be in cooldownHistory after firing (was undefined before fix)
    expect(updatedState.cooldownHistory.H17).toBe(today);
  });

  it('H17 is suppressed within 2-day cooldown', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: HintState = {
      id: 'hintState',
      userId: 'user1',
      _docType: 'hintState',
      lastHintId: 'H17',
      lastHintDate: today,
      lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H16: today, H15: today, H17: today },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 148, carbs: 230, fat: 70, fiber: 15 },
      dayType: 'training',
      currentHour: 16,  // avoids H22 (≥19h); fiber=15 avoids H21
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).not.toBe('H17');
    // Falls through to motivation
    expect(hint.category).toBe('motivation');
  });
});

// ---------------------------------------------------------------------------
// H3 Fix: Zeitblindheit — nach 1 Mahlzeit mit hohem Protein nicht feuern
// ---------------------------------------------------------------------------

describe('H3 fix — protein context awareness', () => {
  it('does NOT fire after a single high-protein breakfast (regression for reported bug)', () => {
    // 35g protein / 451 kcal breakfast = 31% kcal from protein — qualitatively excellent.
    // But 35/150 = 23% of daily protein target → H3 USED TO fire. Must no longer.
    const breakfastItems = [{
      id: 'item1', name: 'Frühstück', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 451, protein: 35, carbs: 40, fat: 15, fiber: 4 },
    }];
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', breakfastItems)],
      summary: { calories: 451, protein: 35, carbs: 40, fat: 15, fiber: 4 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H3');
  });

  it('fires after 2+ meals when protein is genuinely low (<25%)', () => {
    // 2 meals, total protein 35g / 150g target = 23%; hour=16 avoids H20 (12-15h window)
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 800, protein: 35, carbs: 100, fat: 25, fiber: 11 },
      currentHour: 16,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H3');
  });
});

// ---------------------------------------------------------------------------
// H18: High-protein breakfast (≥30% kcal from protein)
// ---------------------------------------------------------------------------

describe('H18 — high-protein breakfast', () => {
  it('fires when breakfast has ≥30% calories from protein, before 12h, no lunch', () => {
    const items = [{
      id: 'i1', name: 'Eggs + Quark', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      // protein kcal: 36*4=144 / 451 = 31.9% ≥ 30% ✓
    }];
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', items)],
      summary: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H18');
    expect(hint.category).toBe('positive');
  });

  it('does NOT fire when protein share is below 30%', () => {
    const items = [{
      id: 'i1', name: 'Brot', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 400, protein: 15, carbs: 60, fat: 10, fiber: 3 },
      // 15*4=60 / 400 = 15% < 30%
    }];
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', items)],
      summary: { calories: 400, protein: 15, carbs: 60, fat: 10, fiber: 3 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H18');
  });

  it('does NOT fire at or after 12h', () => {
    const items = [{
      id: 'i1', name: 'Latebreakfast', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 400, protein: 33, carbs: 20, fat: 15, fiber: 3 },
    }];
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', items)],
      summary: { calories: 400, protein: 33, carbs: 20, fat: 15, fiber: 3 },
      currentHour: 12,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H18');
  });

  it('does NOT fire when lunch is already logged', () => {
    const bkItems = [{
      id: 'i1', name: 'Eggs + Quark', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
    }];
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', bkItems), makeMeal('lunch')],
      summary: { calories: 851, protein: 66, carbs: 70, fat: 25, fiber: 8 },
      currentHour: 11,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H18');
  });
});

// ---------------------------------------------------------------------------
// H19: Good calorie pace — morning
// ---------------------------------------------------------------------------

describe('H19 — morning calorie pace', () => {
  it('fires with 1 meal, 15–40% of calorie target, before 13h', () => {
    // Use low-protein breakfast items (15% kcal from protein) to avoid H18 (fires at ≥30%)
    const bkItems = [{
      id: 'bk1', name: 'Müsli', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 400, protein: 15, carbs: 70, fat: 8, fiber: 5 },
    }];
    // summary 500/2000 = 25% ✓; protein 80/150=53% → H3 won't fire
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', bkItems)],
      summary: { calories: 500, protein: 80, carbs: 50, fat: 15, fiber: 5 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H19');
  });

  it('does NOT fire after 13h', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 500, protein: 80, carbs: 50, fat: 15, fiber: 5 },
      currentHour: 13,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H19');
  });

  it('does NOT fire when calorie % is outside 15–40 range', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 1400, protein: 80, carbs: 150, fat: 50, fiber: 5 },
      currentHour: 10,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H19');
  });
});

// ---------------------------------------------------------------------------
// H20: Good calorie pace — midday
// ---------------------------------------------------------------------------

describe('H20 — midday calorie pace', () => {
  it('fires with 2+ meals, 35–65% of calorie target, 12–15h', () => {
    // Use low-protein breakfast items (15% kcal from protein) to avoid H18 (fires at ≥30%)
    const bkItems = [{
      id: 'bk1', name: 'Müsli', sourceType: 'manual' as const,
      quantity: 1, unit: 'Portion',
      macros: { calories: 400, protein: 15, carbs: 70, fat: 8, fiber: 5 },
    }];
    // 1100/2000 = 55% ✓; hour=13: not < 13 → H19 won't fire; IS in 12-16 → H20 fires
    const ctx = makeCtx({
      meals: [makeMeal('breakfast', bkItems), makeMeal('lunch')],
      summary: { calories: 1100, protein: 80, carbs: 120, fat: 40, fiber: 11 },
      currentHour: 13,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H20');
  });

  it('does NOT fire before 12h', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1100, protein: 80, carbs: 120, fat: 40, fiber: 11 },
      currentHour: 11,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H20');
  });
});

// ---------------------------------------------------------------------------
// H21: Great fiber intake (≥80%)
// ---------------------------------------------------------------------------

describe('H21 — great fiber intake', () => {
  it('fires when fiber >= 80% of target', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: HintState = {
      id: 'hintState', userId: 'u1', _docType: 'hintState',
      lastHintId: 'H13', lastHintDate: today, lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: today, H16: today, H15: today, H17: today, H22: today },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 21 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).toBe('H21');
    expect(hint.category).toBe('positive');
  });

  it('does NOT fire when fiber < 80% of target', () => {
    const today = new Date().toISOString().slice(0, 10);
    const state: HintState = {
      id: 'hintState', userId: 'u1', _docType: 'hintState',
      lastHintId: 'H13', lastHintDate: today, lastHintGeneratedAt: new Date().toISOString(),
      cooldownHistory: { H13: today, H16: today, H15: today, H17: today },
      motivationIndex: 0,
    };
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 145, carbs: 210, fat: 65, fiber: 15 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, state);
    expect(hint.id).not.toBe('H21');
  });
});

// ---------------------------------------------------------------------------
// H22: Evening calorie target hit
// ---------------------------------------------------------------------------

describe('H22 — evening calorie goal', () => {
  it('fires when hour ≥ 19, calories 85–110%, dinner present', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1820, protein: 145, carbs: 230, fat: 65, fiber: 24 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H22');
    expect(hint.category).toBe('daycontext');
  });

  it('does NOT fire before 19h', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1820, protein: 145, carbs: 230, fat: 65, fiber: 24 },
      dayType: 'rest',
      currentHour: 18,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H22');
  });

  it('does NOT fire without dinner', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1820, protein: 145, carbs: 230, fat: 65, fiber: 24 },
      dayType: 'rest',
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H22');
  });
});

// ---------------------------------------------------------------------------
// H23: Significantly under calorie target in the evening
// ---------------------------------------------------------------------------

describe('H23 — evening calorie deficit', () => {
  it('fires when hour ≥ 18, <70% calories, 2+ meals', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1200, protein: 120, carbs: 130, fat: 40, fiber: 20 },
      currentHour: 19,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H23');
  });

  it('does NOT fire before 18h', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1200, protein: 120, carbs: 130, fat: 40, fiber: 20 },
      currentHour: 17,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H23');
  });

  it('does NOT fire when calories are >= 70%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1500, protein: 120, carbs: 160, fat: 50, fiber: 20 },
      currentHour: 19,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H23');
  });
});

// ---------------------------------------------------------------------------
// H24: Over calorie target
// ---------------------------------------------------------------------------

describe('H24 — over calorie target', () => {
  it('fires when calories > 115% with 3+ meals', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2400, protein: 150, carbs: 250, fat: 90, fiber: 25 },
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H24');
  });

  it('does NOT fire when calories are at or below 115%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2200, protein: 150, carbs: 230, fat: 80, fiber: 25 },
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H24');
  });
});

// ---------------------------------------------------------------------------
// H25/H26: Multi-day calorie trend
// ---------------------------------------------------------------------------

describe('H25/H26 — multi-day calorie overage', () => {
  it('H26 fires when all 3 recent days are over 115%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      currentHour: 10,
      recentDaysCaloriesPct: [120, 120, 120],
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H26');
  });

  it('H25 fires when exactly 2 of the last 3 days are over 115%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      currentHour: 10,
      recentDaysCaloriesPct: [120, 90, 125],
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H25');
  });

  it('H26 fires before H25 when 3 days over', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      currentHour: 10,
      recentDaysCaloriesPct: [120, 120, 120],
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H26');
    expect(hint.id).not.toBe('H25');
  });

  it('neither fires when only 1 of 3 days is over 115%', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast')],
      summary: { calories: 451, protein: 36, carbs: 30, fat: 15, fiber: 3 },
      currentHour: 10,
      recentDaysCaloriesPct: [120, 90, 90],
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H25');
    expect(hint.id).not.toBe('H26');
  });
});

// ---------------------------------------------------------------------------
// H27: Under basal metabolic rate — only after dinner
// ---------------------------------------------------------------------------

describe('H27 — under BMR after dinner', () => {
  it('fires when dinner is logged and calories < 90% of BMR', () => {
    // BMR=1800, calories=1200 → 1200 < 1800*0.9=1620 ✓
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1200, protein: 80, carbs: 120, fat: 40, fiber: 20 },
      currentHour: 20,
      bmr: 1800,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H27');
  });

  it('does NOT fire when dinner is not logged', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1200, protein: 80, carbs: 120, fat: 40, fiber: 20 },
      currentHour: 20,
      bmr: 1800,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H27');
  });

  it('does NOT fire when calories are above 90% of BMR', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1700, protein: 100, carbs: 170, fat: 60, fiber: 20 },
      currentHour: 20,
      bmr: 1800,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H27');
  });

  it('does NOT fire when bmr is undefined (no profile)', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1200, protein: 80, carbs: 120, fat: 40, fiber: 20 },
      currentHour: 20,
      bmr: undefined,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H27');
  });
});

// ---------------------------------------------------------------------------
// H28: Protein < 1.5g per kg body weight after dinner
// ---------------------------------------------------------------------------

describe('H28 — protein per kg bodyweight', () => {
  it('fires after dinner when protein < 1.5g/kg, includes personalized target in text', () => {
    // weightKg=80, 1.5*80=120g threshold; total protein=95 < 120 ✓
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 95, carbs: 220, fat: 65, fiber: 24 },
      currentHour: 20,
      weightKg: 80,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).toBe('H28');
    expect(hint.text).toContain('120 g');
  });

  it('does NOT fire when dinner is not logged', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 1200, protein: 80, carbs: 120, fat: 40, fiber: 20 },
      currentHour: 20,
      weightKg: 80,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H28');
  });

  it('does NOT fire when protein meets the 1.5g/kg threshold', () => {
    // 80kg * 1.5 = 120g; protein=125 ≥ 120 → H28 must not fire
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 2000, protein: 125, carbs: 220, fat: 70, fiber: 25 },
      currentHour: 20,
      weightKg: 80,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H28');
  });

  it('does NOT fire when weightKg is undefined (no profile)', () => {
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 1900, protein: 50, carbs: 220, fat: 65, fiber: 24 },
      currentHour: 20,
      weightKg: undefined,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H28');
  });
});

// ---------------------------------------------------------------------------
// isHighProteinCalShare gate: H3, H4, H8, H28 must NOT fire when ≥30% of
// total calories already come from protein
// ---------------------------------------------------------------------------

describe('isHighProteinCalShare gate', () => {
  // High-protein summary: 900 kcal total, protein=75g → 75*4=300 kcal = 33% ≥ 30%
  const highProteinSummary = { calories: 900, protein: 75, carbs: 80, fat: 20, fiber: 8 };

  it('H3 does NOT fire when protein-cal share ≥30%', () => {
    // proteinPct: 75/150 = 50% — normally H3 requires < 25%, won't fire anyway.
    // Use a context where proteinPct < 25% but isHighProteinCalShare is true.
    // protein=25g on 900 kcal target → 25/150=16.7% < 25%, but 25*4=100/900=11% < 30%
    // We need proteinPct < 25% AND calorie-share ≥ 30%:
    // protein=70g, calories=800 kcal → proteinPct=70/150=46% — nope.
    // Let's use targets.proteinG=400 → proteinPct=75/400=18.75% < 25%, and 75*4/900=33% ≥ 30%
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 75, carbs: 80, fat: 20, fiber: 8 },
      targets: { ...TARGETS, proteinG: 400 }, // artificial high target → proteinPct < 25%
      currentHour: 16,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H3');
  });

  it('H4 does NOT fire when protein-cal share ≥30%', () => {
    // 3+ meals, proteinPct < 35%, but calorie-share ≥ 30%
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 900, protein: 75, carbs: 80, fat: 20, fiber: 8 },
      targets: { ...TARGETS, proteinG: 400 }, // proteinPct=18.75% < 35%, but 33% kcal from protein
      currentHour: 20,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H4');
  });

  it('H8 does NOT fire on training day when protein-cal share ≥30%', () => {
    // training + proteinPct < 95% + 2+ meals — but isHighProteinCalShare blocks it
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch')],
      summary: { calories: 900, protein: 75, carbs: 80, fat: 20, fiber: 8 },
      targets: { ...TARGETS, proteinG: 400 }, // proteinPct=18.75% < 95%
      dayType: 'training',
      currentHour: 16,
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H8');
  });

  it('H28 does NOT fire when protein-cal share ≥30%', () => {
    // After dinner, protein < 1.5g/kg (75 < 80*1.5=120), but calorie-share ≥ 30%
    const ctx = makeCtx({
      meals: [makeMeal('breakfast'), makeMeal('lunch'), makeMeal('dinner')],
      summary: { calories: 900, protein: 75, carbs: 80, fat: 20, fiber: 8 },
      currentHour: 20,
      weightKg: 80, // 80*1.5=120g; protein=75 < 120 would normally trigger H28
    });
    const { hint } = evaluateHint(ctx, noState());
    expect(hint.id).not.toBe('H28');
  });
});
