import { describe, expect, it } from 'vitest';
import { computeChartBounds } from './weightChartUtils';

describe('computeChartBounds', () => {
  it('uses 0.5 kg steps for a small range (≤ 2 kg)', () => {
    const { step, ticks } = computeChartBounds(79.0, 80.5);
    expect(step).toBe(0.5);
    // All ticks must be multiples of 0.5
    for (const t of ticks) {
      expect(Math.round(t * 2) / 2).toBeCloseTo(t, 5);
    }
  });

  it('uses 1.0 kg steps for a medium range (2–10 kg)', () => {
    const { step } = computeChartBounds(75.0, 80.0);
    expect(step).toBe(1.0);
  });

  it('uses 2.0 kg steps for a large range (> 10 kg)', () => {
    const { step } = computeChartBounds(60.0, 85.0);
    expect(step).toBe(2.0);
  });

  it('pads yMin below dataMin by at least one step', () => {
    const { yMin } = computeChartBounds(79.2, 81.0);
    expect(yMin).toBeLessThan(79.2);
  });

  it('pads yMax above dataMax by at least one step', () => {
    const { yMax } = computeChartBounds(79.0, 80.8);
    expect(yMax).toBeGreaterThan(80.8);
  });

  it('ticks are monotonically increasing in 0.5 steps', () => {
    const { ticks, step } = computeChartBounds(79.1, 80.9);
    expect(step).toBe(0.5);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(0.5, 5);
    }
  });

  it('first tick ≤ yMin and last tick ≥ yMax', () => {
    const bounds = computeChartBounds(79.3, 80.7);
    expect(bounds.ticks[0]).toBeCloseTo(bounds.yMin, 5);
    expect(bounds.ticks[bounds.ticks.length - 1]).toBeCloseTo(bounds.yMax, 5);
  });

  it('handles identical min and max (flat line)', () => {
    const { step, ticks } = computeChartBounds(80.0, 80.0);
    expect(step).toBe(0.5);
    expect(ticks.length).toBeGreaterThan(2);
  });
});
