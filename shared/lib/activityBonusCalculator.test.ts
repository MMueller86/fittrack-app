import { describe, it, expect } from 'vitest';
import { calculateActivityBonus } from './activityBonusCalculator';

const W = 83;        // kg
const TARGET = 2200; // kcal/day

function calc(
  min: number, km: number, gainM: number, lossM: number,
  terrain: string, pack: string,
) {
  return calculateActivityBonus(
    {
      movementTimeMinutes: min,
      distanceKm: km,
      elevationGainM: gainM,
      elevationLossM: lossM,
      terrainType: terrain as any,
      packCategory: pack as any,
    },
    W,
    TARGET,
  );
}

// ---------------------------------------------------------------------------
// Suite 1 — 16 Regression cases
// ---------------------------------------------------------------------------
describe('V3 Regression Cases', () => {
  const cases = [
    { id: 'T1', min:150, km:10,    gain:0,    loss:0,    t:'path',    p:'none',   metMin:3.0, metMax:3.6, bonus:500  },
    { id: 'T2', min:150, km:10,    gain:0,    loss:0,    t:'path',    p:'medium', metMin:4.0, metMax:4.8, bonus:700  },
    { id: 'T3', min:180, km:10,    gain:500,  loss:500,  t:'trail',   p:'none',   metMin:4.5, metMax:5.8, bonus:1100 },
    { id: 'T4', min:240, km:12,    gain:1000, loss:1000, t:'alpine',  p:'none',   metMin:6.0, metMax:7.5, bonus:1850 },
    { id: 'T5', min:300, km:11.65, gain:1300, loss:400,  t:'alpine',  p:'medium', metMin:6.8, metMax:7.5, bonus:2650 },
    { id: 'T6', min:240, km:10,    gain:1200, loss:0,    t:'trail',   p:'medium', metMin:6.5, metMax:7.8, bonus:2000 },
    { id: 'T7', min:180, km:8,     gain:0,    loss:800,  t:'trail',   p:'none',   metMin:3.0, metMax:4.5, bonus:550  },
    { id: 'T8', min:240, km:4,     gain:700,  loss:0,    t:'scramble',p:'medium', metMin:7.0, metMax:8.5, bonus:2400 },
    { id: 'R1', min:150, km:5,     gain:50,   loss:50,   t:'path',    p:'none',   metMin:2.3, metMax:3.0, bonus:250  },
    { id: 'R2', min:120, km:10,    gain:0,    loss:0,    t:'path',    p:'none',   metMin:3.8, metMax:4.5, bonus:500  },
    { id: 'R3', min:210, km:12,    gain:400,  loss:400,  t:'trail',   p:'none',   metMin:4.5, metMax:5.8, bonus:1050 },
    { id: 'R4', min:360, km:15,    gain:1200, loss:200,  t:'trail',   p:'medium', metMin:6.4, metMax:7.2, bonus:2650 },
    { id: 'R5', min:180, km:6,     gain:200,  loss:200,  t:'scramble',p:'none',   metMin:4.0, metMax:5.5, bonus:800  },
    { id: 'R6', min:120, km:2,     gain:800,  loss:0,    t:'scramble',p:'medium', metMin:9.5, metMax:9.5, bonus:1400 },
    { id: 'R7', min:270, km:12,    gain:0,    loss:1500, t:'alpine',  p:'medium', metMin:3.5, metMax:5.0, bonus:1300 },
    { id: 'R8', min:180, km:4,     gain:0,    loss:1400, t:'scramble',p:'medium', metMin:4.5, metMax:6.0, bonus:900  },
  ];

  for (const c of cases) {
    it(`${c.id}: MET in [${c.metMin}, ${c.metMax}], bonus=${c.bonus}`, () => {
      const r = calc(c.min, c.km, c.gain, c.loss, c.t, c.p);
      expect(r.estimatedMet).toBeGreaterThanOrEqual(c.metMin);
      expect(r.estimatedMet).toBeLessThanOrEqual(c.metMax);
      expect(r.activityBonus).toBe(c.bonus);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 2 — Invariants
// ---------------------------------------------------------------------------
describe('V3 Invariants', () => {
  it('I1: more gain -> MET non-decreasing', () => {
    const gains = [0, 200, 500, 1000, 1500];
    const mets = gains.map(g => calc(240, 12, g, 0, 'trail', 'medium').estimatedMet);
    for (let i = 1; i < mets.length; i++) {
      expect(mets[i]).toBeGreaterThanOrEqual(mets[i - 1]! - 0.001);
    }
  });

  it('I2: harder terrain -> MET non-decreasing', () => {
    const terrains = ['path', 'trail', 'alpine', 'scramble'] as const;
    const mets = terrains.map(t => calc(240, 12, 500, 0, t, 'none').estimatedMet);
    for (let i = 1; i < mets.length; i++) {
      expect(mets[i]).toBeGreaterThanOrEqual(mets[i - 1]! - 0.001);
    }
  });

  it('I3: heavier pack -> MET non-decreasing', () => {
    const packs = ['none', 'small', 'medium', 'heavy'] as const;
    const mets = packs.map(p => calc(240, 12, 500, 0, 'trail', p).estimatedMet);
    for (let i = 1; i < mets.length; i++) {
      expect(mets[i]).toBeGreaterThanOrEqual(mets[i - 1]! - 0.001);
    }
  });

  it('I4: higher speed (flat) -> MET non-decreasing', () => {
    const speeds = [[60,1],[60,2],[60,3],[60,4],[60,5.5]]; // [min, km]
    const mets = speeds.map(([min,km]) => calc(min!, km!, 0, 0, 'path', 'none').estimatedMet);
    for (let i = 1; i < mets.length; i++) {
      expect(mets[i]).toBeGreaterThanOrEqual(mets[i - 1]! - 0.001);
    }
  });

  it('I5: small gain change -> smooth MET (|DELTA_MET| < 0.5)', () => {
    const bases = [50, 100, 150, 200, 300];
    for (const base of bases) {
      const r1 = calc(240, 10, base * 10, 0, 'trail', 'none');
      const r2 = calc(240, 10, (base + 5) * 10, 0, 'trail', 'none');
      expect(Math.abs(r2.estimatedMet - r1.estimatedMet)).toBeLessThan(0.5);
    }
  });

  it('I6: ascent > descent (same steepness)', () => {
    const ascent  = calc(120, 5, 500, 0, 'trail', 'none');
    const descent = calc(120, 5, 0, 500, 'trail', 'none');
    expect(ascent.estimatedMet).toBeGreaterThan(descent.estimatedMet);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Backward compatibility
// ---------------------------------------------------------------------------
describe('V3 Backward Compatibility', () => {
  it('hasBackpack:true = packCategory:medium', () => {
    const a = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, hasBackpack:true }, W, TARGET);
    const b = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, packCategory:'medium' }, W, TARGET);
    expect(a.estimatedMet).toBeCloseTo(b.estimatedMet, 5);
  });

  it('hasBackpack:false = packCategory:none', () => {
    const a = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, hasBackpack:false }, W, TARGET);
    const b = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, packCategory:'none' }, W, TARGET);
    expect(a.estimatedMet).toBeCloseTo(b.estimatedMet, 5);
  });

  it('missing terrainType = path', () => {
    const a = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300 }, W, TARGET);
    const b = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, terrainType:'path' }, W, TARGET);
    expect(a.estimatedMet).toBeCloseTo(b.estimatedMet, 5);
  });

  it('missing elevationLossM = elevationLossM:0', () => {
    const a = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300 }, W, TARGET);
    const b = calculateActivityBonus({ movementTimeMinutes:180, distanceKm:8, elevationGainM:300, elevationLossM:0 }, W, TARGET);
    expect(a.estimatedMet).toBeCloseTo(b.estimatedMet, 5);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Edge cases
// ---------------------------------------------------------------------------
describe('V3 Edge Cases', () => {
  it('distanceKm=0 -> no throw, activityBonus=0', () => {
    expect(() => {
      const r = calculateActivityBonus({ movementTimeMinutes:60, distanceKm:0, elevationGainM:0 }, W, TARGET);
      expect(r.activityBonus).toBe(0);
    }).not.toThrow();
  });

  it('movementTimeMinutes=0 -> no throw, activityBonus=0', () => {
    expect(() => {
      const r = calculateActivityBonus({ movementTimeMinutes:0, distanceKm:8, elevationGainM:0 }, W, TARGET);
      expect(r.activityBonus).toBe(0);
    }).not.toThrow();
  });
});
