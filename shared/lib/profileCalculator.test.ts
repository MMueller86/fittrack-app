import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  stepsTopal,
  activityLevelToPAL,
  trainingBonusKcal,
  goalAdjustmentKcal,
  calculateMacros,
  applyGuardrails,
  roundToNearest,
  calculateProfileTargets,
} from './profileCalculator';
import type { ProfileInput } from '../types/profile';

// ---------------------------------------------------------------------------
// BMR
// ---------------------------------------------------------------------------

describe('calculateBMR', () => {
  it('calculates male BMR correctly', () => {
    // 10×81 + 6.25×173 - 5×39 + 5 = 810 + 1081.25 - 195 + 5 = 1701.25
    expect(calculateBMR(81, 173, 39, 'male')).toBeCloseTo(1701.25, 1);
  });

  it('calculates female BMR correctly', () => {
    // same base but -161 instead of +5 → 1701.25 - 5 - 161 = 1535.25
    expect(calculateBMR(81, 173, 39, 'female')).toBeCloseTo(1535.25, 1);
  });

  it('calculates other/divers BMR as average of male and female', () => {
    const male = calculateBMR(81, 173, 39, 'male');
    const female = calculateBMR(81, 173, 39, 'female');
    const other = calculateBMR(81, 173, 39, 'other');
    expect(other).toBeCloseTo((male + female) / 2, 1);
  });
});

// ---------------------------------------------------------------------------
// stepsTopal
// ---------------------------------------------------------------------------

describe('stepsTopal', () => {
  it('clamps at minimum for very low steps', () => {
    expect(stepsTopal(0)).toBe(1.35);
    expect(stepsTopal(3000)).toBe(1.35);
  });

  it('returns 1.40 at 5,000 steps', () => {
    expect(stepsTopal(5000)).toBeCloseTo(1.40, 2);
  });

  it('returns 1.50 at 7,500 steps', () => {
    expect(stepsTopal(7500)).toBeCloseTo(1.50, 2);
  });

  it('returns 1.60 at 10,000 steps', () => {
    expect(stepsTopal(10000)).toBeCloseTo(1.60, 2);
  });

  it('interpolates 8,750 steps → ~1.55', () => {
    // Between 7500 (1.50) and 10000 (1.60): 8750 is halfway → 1.55
    expect(stepsTopal(8750)).toBeCloseTo(1.55, 2);
  });

  it('returns 1.70 at 12,500 steps', () => {
    expect(stepsTopal(12500)).toBeCloseTo(1.70, 2);
  });

  it('clamps at maximum for very high steps', () => {
    expect(stepsTopal(20000)).toBe(1.90);
    expect(stepsTopal(17500)).toBeCloseTo(1.90, 2);
  });
});

// ---------------------------------------------------------------------------
// activityLevelToPAL
// ---------------------------------------------------------------------------

describe('activityLevelToPAL', () => {
  it('maps sedentary → 1.40', () => {
    expect(activityLevelToPAL('sedentary')).toBe(1.40);
  });

  it('maps light → 1.55', () => {
    expect(activityLevelToPAL('light')).toBe(1.55);
  });

  it('maps active → 1.70', () => {
    expect(activityLevelToPAL('active')).toBe(1.70);
  });

  it('maps very_active → 1.90', () => {
    expect(activityLevelToPAL('very_active')).toBe(1.90);
  });
});

// ---------------------------------------------------------------------------
// trainingBonusKcal
// ---------------------------------------------------------------------------

describe('trainingBonusKcal', () => {
  it('returns 0 for no training', () => {
    expect(trainingBonusKcal(0)).toBe(0);
  });

  it('returns 150 for 30 min', () => {
    expect(trainingBonusKcal(30)).toBe(150);
  });

  it('returns 250 for 60 min', () => {
    expect(trainingBonusKcal(60)).toBe(250);
  });

  it('returns 350 for 90 min', () => {
    expect(trainingBonusKcal(90)).toBe(350);
  });

  it('returns 450 for 120 min', () => {
    expect(trainingBonusKcal(120)).toBe(450);
  });

  it('returns 550 for 150+ min', () => {
    expect(trainingBonusKcal(150)).toBe(550);
    expect(trainingBonusKcal(200)).toBe(550);
  });

  it('interpolates between 30 and 60 min', () => {
    // 45 min is halfway → 200 kcal
    expect(trainingBonusKcal(45)).toBeCloseTo(200, 0);
  });
});

// ---------------------------------------------------------------------------
// goalAdjustmentKcal
// ---------------------------------------------------------------------------

describe('goalAdjustmentKcal', () => {
  it('lose_weight / gentle → -250', () => {
    expect(goalAdjustmentKcal('lose_weight', 'gentle')).toBe(-250);
  });

  it('lose_weight / moderate → -500', () => {
    expect(goalAdjustmentKcal('lose_weight', 'moderate')).toBe(-500);
  });

  it('lose_weight / aggressive → -750', () => {
    expect(goalAdjustmentKcal('lose_weight', 'aggressive')).toBe(-750);
  });

  it('maintain → 0 regardless of intensity', () => {
    expect(goalAdjustmentKcal('maintain', null)).toBe(0);
    expect(goalAdjustmentKcal('maintain', 'gentle')).toBe(0);
  });

  it('gain_muscle / gentle → +200', () => {
    expect(goalAdjustmentKcal('gain_muscle', 'gentle')).toBe(200);
  });

  it('gain_muscle / moderate → +350', () => {
    expect(goalAdjustmentKcal('gain_muscle', 'moderate')).toBe(350);
  });

  it('gain_muscle / aggressive → +500', () => {
    expect(goalAdjustmentKcal('gain_muscle', 'aggressive')).toBe(500);
  });

  it('recomposition → -100', () => {
    expect(goalAdjustmentKcal('recomposition', null)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// applyGuardrails
// ---------------------------------------------------------------------------

describe('applyGuardrails', () => {
  it('does not cap when above minimum (male)', () => {
    const result = applyGuardrails(2000, 'male');
    expect(result).toEqual({ calories: 2000, capped: false });
  });

  it('caps male to 1800 when below minimum', () => {
    const result = applyGuardrails(1200, 'male');
    expect(result).toEqual({ calories: 1800, capped: true });
  });

  it('caps female to 1500 when below minimum', () => {
    const result = applyGuardrails(1200, 'female');
    expect(result).toEqual({ calories: 1500, capped: true });
  });

  it('caps other/divers to 1650 when below minimum', () => {
    const result = applyGuardrails(1200, 'other');
    expect(result).toEqual({ calories: 1650, capped: true });
  });
});

// ---------------------------------------------------------------------------
// roundToNearest
// ---------------------------------------------------------------------------

describe('roundToNearest', () => {
  it('rounds to nearest 50', () => {
    expect(roundToNearest(2218, 50)).toBe(2200);
    expect(roundToNearest(2376, 50)).toBe(2400);
    expect(roundToNearest(2475, 50)).toBe(2500);
  });

  it('rounds to nearest 5', () => {
    expect(roundToNearest(162, 5)).toBe(160);
    expect(roundToNearest(73, 5)).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// calculateMacros
// ---------------------------------------------------------------------------

describe('calculateMacros', () => {
  it('calculates macros for lose_weight goal at 2450 kcal, 81 kg', () => {
    const result = calculateMacros(2450, 81, 'lose_weight');
    // protein: 2.0 × 81 = 162 → rounded to 160g
    expect(result.proteinG).toBe(160);
    // fat: 0.9 × 81 = 72.9 → rounded to 75g
    expect(result.fatG).toBe(75);
    // carbs: (2450 - 160×4 - 75×9) / 4 = (2450 - 640 - 675) / 4 = 1135/4 = 283.75 → 285g
    expect(result.carbsG).toBe(285);
    // fiber: (2450/1000) × 14 = 34.3 → 34g
    expect(result.fiberG).toBe(34);
  });

  it('uses lower protein (1.8 g/kg) for maintain goal', () => {
    const result = calculateMacros(2200, 80, 'maintain');
    expect(result.proteinG).toBe(roundToNearest(1.8 * 80, 5));
  });
});

// ---------------------------------------------------------------------------
// calculateProfileTargets — full end-to-end (spec example)
// ---------------------------------------------------------------------------

describe('calculateProfileTargets (spec example)', () => {
  const specInput: ProfileInput = {
    gender: 'male',
    age: 39,
    heightCm: 173,
    weightKg: 81,
    targetWeightKg: 75,
    stepsPerDay: 10000,
    activityLevel: null,
    trainingFrequencyPerWeek: 4,
    trainingDurationMinutes: 60,
    sports: [],
    goal: 'lose_weight',
    goalIntensity: 'gentle',
  };

  it('produces correct BMR in meta (~1701)', () => {
    const { meta } = calculateProfileTargets(specInput);
    expect(meta.bmr).toBeCloseTo(1701, 0);
  });

  it('uses PAL 1.60 for 10,000 steps', () => {
    const { meta } = calculateProfileTargets(specInput);
    expect(meta.pal).toBeCloseTo(1.60, 2);
  });

  it('rest day calories are ~2450 or 2500 (rounded to 50, after -250 goal adj)', () => {
    const { targets } = calculateProfileTargets(specInput);
    // maintenance ≈ 2722, -250 = 2472, rounded to 50 → 2450 or 2500
    expect([2450, 2500]).toContain(targets.restDay.calories);
  });

  it('training day calories are ~2700 (maintenance rounded to 50)', () => {
    const { targets } = calculateProfileTargets(specInput);
    // maintenance 2722 + 250 bonus - 250 goal = 2722, rounded → 2700 or 2750
    expect([2700, 2750]).toContain(targets.trainingDay.calories);
  });

  it('training day is higher than rest day', () => {
    const { targets } = calculateProfileTargets(specInput);
    expect(targets.trainingDay.calories).toBeGreaterThan(targets.restDay.calories);
  });

  it('does not cap (healthy range)', () => {
    const { restDayCapped, trainingDayCapped } = calculateProfileTargets(specInput);
    expect(restDayCapped).toBe(false);
    expect(trainingDayCapped).toBe(false);
  });

  it('stores formula version in meta', () => {
    const { meta } = calculateProfileTargets(specInput);
    expect(meta.formulaVersion).toBe('profile-targets-v1-pal');
  });
});

describe('calculateProfileTargets (activity level fallback)', () => {
  it('uses activityLevel when stepsPerDay is null', () => {
    const input: ProfileInput = {
      gender: 'female',
      age: 30,
      heightCm: 165,
      weightKg: 65,
      targetWeightKg: 60,
      stepsPerDay: null,
      activityLevel: 'light',
      trainingFrequencyPerWeek: 3,
      trainingDurationMinutes: 60,
      sports: [],
      goal: 'maintain',
      goalIntensity: null,
    };
    const { meta } = calculateProfileTargets(input);
    expect(meta.pal).toBeCloseTo(1.55, 2);
    expect(meta.goalAdjustment).toBe(0);
  });
});

describe('calculateProfileTargets (guardrail)', () => {
  it('caps an extreme deficit to minimum female calories', () => {
    const input: ProfileInput = {
      gender: 'female',
      age: 25,
      heightCm: 155,
      weightKg: 45,
      targetWeightKg: 42,
      stepsPerDay: 3000, // very sedentary
      activityLevel: null,
      trainingFrequencyPerWeek: 0,
      trainingDurationMinutes: 0,
      sports: [],
      goal: 'lose_weight',
      goalIntensity: 'aggressive', // -750 kcal
    };
    const { targets, restDayCapped } = calculateProfileTargets(input);
    expect(targets.restDay.calories).toBeGreaterThanOrEqual(1500);
    expect(restDayCapped).toBe(true);
  });
});
