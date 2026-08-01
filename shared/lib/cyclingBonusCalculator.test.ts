import { describe, it, expect } from 'vitest';
import { calculateCyclingActivityBonus } from './cyclingBonusCalculator';
import type { CyclingActivityInputs, EbikeSupport } from '../types/diary';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function calc(
  movingTimeHours: number,
  distanceKm: number,
  uphillMeters: number,
  downhillMeters: number,
  asphaltShare: number,
  gravelShare: number,
  trailShare: number,
  ebikeSupport: EbikeSupport,
  weightKg = 83,
  dailyCalorieTarget = 2400,
) {
  const inputs: CyclingActivityInputs = {
    movementTimeMinutes: movingTimeHours * 60,
    distanceKm,
    elevationGainM: uphillMeters,
    elevationLossM: downhillMeters,
    asphaltShare,
    gravelShare,
    trailShare,
    ebikeSupport,
  };
  return calculateCyclingActivityBonus(inputs, weightKg, dailyCalorieTarget);
}

const TOL = 0.05; // MET tolerance for regression / boundary tests

// ---------------------------------------------------------------------------
// Suite 1 — Regression tests (04-tests-regression.yaml)
// 9 profiles × 3 terrains × 3 eBike = 81 tests
// ---------------------------------------------------------------------------

describe('Regression tests (04-tests-regression.yaml)', () => {
  // terrain input mappings
  const terrains = {
    ASPHALT: { a: 1.0, g: 0.0, t: 0.0 },
    GRAVEL:  { a: 0.0, g: 1.0, t: 0.0 },
    TRAIL:   { a: 0.0, g: 0.0, t: 1.0 },
  } as const;
  const bikes: EbikeSupport[] = ['NONE', 'LIGHT', 'HIGH'];

  type TerrainKey = keyof typeof terrains;

  interface Profile {
    id: string;
    movingTimeHours: number;
    distanceKm: number;
    uphillMeters: number;
    downhillMeters: number;
    expected: Record<TerrainKey, Record<EbikeSupport, number>>;
  }

  const profiles: Profile[] = [
    {
      id: 'P1',
      movingTimeHours: 2.0, distanceKm: 32.0, uphillMeters: 0, downhillMeters: 0,
      expected: {
        ASPHALT: { NONE: 4.0, LIGHT: 3.4, HIGH: 2.7 },
        GRAVEL:  { NONE: 4.5, LIGHT: 3.9, HIGH: 3.2 },
        TRAIL:   { NONE: 5.5, LIGHT: 4.9, HIGH: 4.2 },
      },
    },
    {
      id: 'P2',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 0,
      expected: {
        ASPHALT: { NONE: 8.0, LIGHT: 6.0, HIGH: 3.7 },
        GRAVEL:  { NONE: 8.5, LIGHT: 6.5, HIGH: 4.2 },
        TRAIL:   { NONE: 9.5, LIGHT: 7.5, HIGH: 5.2 },
      },
    },
    {
      id: 'P3',
      movingTimeHours: 2.0, distanceKm: 51.4, uphillMeters: 0, downhillMeters: 0,
      expected: {
        ASPHALT: { NONE: 10.0, LIGHT: 8.7, HIGH: 7.2 },
        GRAVEL:  { NONE: 10.5, LIGHT: 9.2, HIGH: 7.7 },
        TRAIL:   { NONE: 11.5, LIGHT: 10.2, HIGH: 8.7 },
      },
    },
    {
      id: 'P4',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 400, downhillMeters: 0,
      expected: {
        ASPHALT: { NONE: 9.5, LIGHT: 6.9, HIGH: 4.1 },
        GRAVEL:  { NONE: 10.0, LIGHT: 7.4, HIGH: 4.6 },
        TRAIL:   { NONE: 11.0, LIGHT: 8.4, HIGH: 5.6 },
      },
    },
    {
      id: 'P5',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 1200, downhillMeters: 0,
      expected: {
        ASPHALT: { NONE: 13.0, LIGHT: 9.0, HIGH: 5.0 },
        GRAVEL:  { NONE: 13.5, LIGHT: 9.5, HIGH: 5.5 },
        TRAIL:   { NONE: 14.5, LIGHT: 10.5, HIGH: 6.5 },
      },
    },
    {
      id: 'P6',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 600, downhillMeters: 600,
      expected: {
        ASPHALT: { NONE: 9.0, LIGHT: 6.5, HIGH: 4.0 },
        GRAVEL:  { NONE: 9.5, LIGHT: 7.0, HIGH: 4.5 },
        TRAIL:   { NONE: 10.5, LIGHT: 8.0, HIGH: 5.5 },
      },
    },
    {
      id: 'P7',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 1200, downhillMeters: 1200,
      expected: {
        ASPHALT: { NONE: 11.2, LIGHT: 7.8, HIGH: 4.5 },
        GRAVEL:  { NONE: 11.7, LIGHT: 8.3, HIGH: 5.0 },
        TRAIL:   { NONE: 12.7, LIGHT: 9.3, HIGH: 6.0 },
      },
    },
    {
      id: 'P8',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 1000,
      expected: {
        ASPHALT: { NONE: 4.6, LIGHT: 4.4, HIGH: 4.2 },
        GRAVEL:  { NONE: 5.1, LIGHT: 4.9, HIGH: 4.7 },
        TRAIL:   { NONE: 6.1, LIGHT: 5.9, HIGH: 5.7 },
      },
    },
    {
      id: 'P9',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 1500,
      expected: {
        ASPHALT: { NONE: 4.1, LIGHT: 4.0, HIGH: 3.8 },
        GRAVEL:  { NONE: 4.6, LIGHT: 4.5, HIGH: 4.3 },
        TRAIL:   { NONE: 5.6, LIGHT: 5.5, HIGH: 5.3 },
      },
    },
  ];

  for (const profile of profiles) {
    for (const terrainKey of Object.keys(terrains) as TerrainKey[]) {
      const { a, g, t } = terrains[terrainKey];
      for (const bike of bikes) {
        it(`${profile.id} ${terrainKey} ${bike}`, () => {
          const result = calc(
            profile.movingTimeHours, profile.distanceKm,
            profile.uphillMeters, profile.downhillMeters,
            a, g, t, bike,
          );
          const expected = profile.expected[terrainKey][bike];
          expect(Math.abs(result.estimatedMet - expected)).toBeLessThanOrEqual(TOL);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Suite 2 — Mixed terrain tests (05-tests-mixed-terrain.yaml)
// 9 profiles × 3 mixed terrains × 3 eBike = 81 tests
// ---------------------------------------------------------------------------

describe('Mixed terrain tests (05-tests-mixed-terrain.yaml)', () => {
  const terrains = {
    MIX_ASPHALT_GRAVEL_50_50: { a: 0.5, g: 0.5, t: 0.0 },
    MIX_GRAVEL_TRAIL_50_50:   { a: 0.0, g: 0.5, t: 0.5 },
    MIX_ALL_33_33_34:         { a: 0.33, g: 0.33, t: 0.34 },
  } as const;
  const bikes: EbikeSupport[] = ['NONE', 'LIGHT', 'HIGH'];

  type TerrainKey = keyof typeof terrains;

  interface Profile {
    id: string;
    movingTimeHours: number;
    distanceKm: number;
    uphillMeters: number;
    downhillMeters: number;
    expected: Record<TerrainKey, Record<EbikeSupport, number>>;
  }

  const profiles: Profile[] = [
    {
      id: 'P1',
      movingTimeHours: 2.0, distanceKm: 32.0, uphillMeters: 0, downhillMeters: 0,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 4.3, LIGHT: 3.7, HIGH: 3.0 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 5.0, LIGHT: 4.4, HIGH: 3.7 },
        MIX_ALL_33_33_34:         { NONE: 4.7, LIGHT: 4.1, HIGH: 3.4 },
      },
    },
    {
      id: 'P2',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 0,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 8.3, LIGHT: 6.3, HIGH: 4.0 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 9.0, LIGHT: 7.0, HIGH: 4.7 },
        MIX_ALL_33_33_34:         { NONE: 8.7, LIGHT: 6.7, HIGH: 4.4 },
      },
    },
    {
      id: 'P3',
      movingTimeHours: 2.0, distanceKm: 51.4, uphillMeters: 0, downhillMeters: 0,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 10.3, LIGHT: 8.9, HIGH: 7.4 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 11.0, LIGHT: 9.7, HIGH: 8.2 },
        MIX_ALL_33_33_34:         { NONE: 10.7, LIGHT: 9.4, HIGH: 7.8 },
      },
    },
    {
      id: 'P4',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 400, downhillMeters: 0,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 9.8, LIGHT: 7.2, HIGH: 4.4 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 10.5, LIGHT: 7.9, HIGH: 5.1 },
        MIX_ALL_33_33_34:         { NONE: 10.2, LIGHT: 7.6, HIGH: 4.8 },
      },
    },
    {
      id: 'P5',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 1200, downhillMeters: 0,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 13.3, LIGHT: 9.3, HIGH: 5.2 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 14.0, LIGHT: 10.0, HIGH: 6.0 },
        MIX_ALL_33_33_34:         { NONE: 13.7, LIGHT: 9.7, HIGH: 5.6 },
      },
    },
    {
      id: 'P6',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 600, downhillMeters: 600,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 9.2, LIGHT: 6.8, HIGH: 4.2 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 10.0, LIGHT: 7.5, HIGH: 5.0 },
        MIX_ALL_33_33_34:         { NONE: 9.7, LIGHT: 7.2, HIGH: 4.6 },
      },
    },
    {
      id: 'P7',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 1200, downhillMeters: 1200,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 11.5, LIGHT: 8.1, HIGH: 4.8 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 12.2, LIGHT: 8.8, HIGH: 5.5 },
        MIX_ALL_33_33_34:         { NONE: 11.9, LIGHT: 8.5, HIGH: 5.2 },
      },
    },
    {
      id: 'P8',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 1000,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 4.9, LIGHT: 4.7, HIGH: 4.5 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 5.6, LIGHT: 5.4, HIGH: 5.2 },
        MIX_ALL_33_33_34:         { NONE: 5.3, LIGHT: 5.1, HIGH: 4.9 },
      },
    },
    {
      id: 'P9',
      movingTimeHours: 2.0, distanceKm: 40.0, uphillMeters: 0, downhillMeters: 1500,
      expected: {
        MIX_ASPHALT_GRAVEL_50_50: { NONE: 4.4, LIGHT: 4.2, HIGH: 4.0 },
        MIX_GRAVEL_TRAIL_50_50:   { NONE: 5.1, LIGHT: 5.0, HIGH: 4.8 },
        MIX_ALL_33_33_34:         { NONE: 4.8, LIGHT: 4.6, HIGH: 4.4 },
      },
    },
  ];

  for (const profile of profiles) {
    for (const terrainKey of Object.keys(terrains) as TerrainKey[]) {
      const { a, g, t } = terrains[terrainKey];
      for (const bike of bikes) {
        it(`${profile.id} ${terrainKey} ${bike}`, () => {
          const result = calc(
            profile.movingTimeHours, profile.distanceKm,
            profile.uphillMeters, profile.downhillMeters,
            a, g, t, bike,
          );
          const expected = profile.expected[terrainKey][bike];
          expect(Math.abs(result.estimatedMet - expected)).toBeLessThanOrEqual(TOL);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Suite 3 — Boundary tests (06-tests-boundaries.yaml)
// Speed interpolation: 27 tests
// Uphill interpolation: 19 tests
// Downhill profile: 9 entries × 3 eBike = 27 tests
// Motor factor: 7 tests
// Total: 80 tests
// ---------------------------------------------------------------------------

describe('Boundary tests — speed interpolation (06-tests-boundaries.yaml)', () => {
  // Baseline: flat terrain, pure asphalt, NONE eBike, 2h duration
  // distanceKm = speedKmh * 2 (for 2h)
  const speedTests: Array<{ speedKmh: number; expectedSpeedMet: number; expectedFinalMetDisplayed: number }> = [
    { speedKmh: 0,    expectedSpeedMet: 2.3,        expectedFinalMetDisplayed: 2.3  },
    { speedKmh: 2,    expectedSpeedMet: 2.4,        expectedFinalMetDisplayed: 2.4  },
    { speedKmh: 4,    expectedSpeedMet: 2.5,        expectedFinalMetDisplayed: 2.5  },
    { speedKmh: 6,    expectedSpeedMet: 2.75,       expectedFinalMetDisplayed: 2.8  },
    { speedKmh: 8,    expectedSpeedMet: 3.0,        expectedFinalMetDisplayed: 3.0  },
    { speedKmh: 10,   expectedSpeedMet: 3.25,       expectedFinalMetDisplayed: 3.3  },
    { speedKmh: 12,   expectedSpeedMet: 3.5,        expectedFinalMetDisplayed: 3.5  },
    { speedKmh: 14,   expectedSpeedMet: 3.75,       expectedFinalMetDisplayed: 3.8  },
    { speedKmh: 15.9, expectedSpeedMet: 3.9875,     expectedFinalMetDisplayed: 4.0  },
    { speedKmh: 16,   expectedSpeedMet: 4.0,        expectedFinalMetDisplayed: 4.0  },
    { speedKmh: 17,   expectedSpeedMet: 4.875,      expectedFinalMetDisplayed: 4.9  },
    { speedKmh: 18,   expectedSpeedMet: 5.75,       expectedFinalMetDisplayed: 5.8  },
    { speedKmh: 19.2, expectedSpeedMet: 6.8,        expectedFinalMetDisplayed: 6.8  },
    { speedKmh: 19.6, expectedSpeedMet: 7.4,        expectedFinalMetDisplayed: 7.4  },
    { speedKmh: 20,   expectedSpeedMet: 8.0,        expectedFinalMetDisplayed: 8.0  },
    { speedKmh: 21,   expectedSpeedMet: 8.0,        expectedFinalMetDisplayed: 8.0  },
    { speedKmh: 22.4, expectedSpeedMet: 8.0,        expectedFinalMetDisplayed: 8.0  },
    { speedKmh: 23,   expectedSpeedMet: 8.375,      expectedFinalMetDisplayed: 8.4  },
    { speedKmh: 24,   expectedSpeedMet: 9.0,        expectedFinalMetDisplayed: 9.0  },
    { speedKmh: 25,   expectedSpeedMet: 9.625,      expectedFinalMetDisplayed: 9.6  },
    { speedKmh: 25.6, expectedSpeedMet: 10.0,       expectedFinalMetDisplayed: 10.0 },
    { speedKmh: 26,   expectedSpeedMet: 10.121212,  expectedFinalMetDisplayed: 10.1 },
    { speedKmh: 28,   expectedSpeedMet: 10.727273,  expectedFinalMetDisplayed: 10.7 },
    { speedKmh: 30,   expectedSpeedMet: 11.333333,  expectedFinalMetDisplayed: 11.3 },
    { speedKmh: 32.2, expectedSpeedMet: 12.0,       expectedFinalMetDisplayed: 12.0 },
    { speedKmh: 35,   expectedSpeedMet: 16.8,       expectedFinalMetDisplayed: 16.8 },
    { speedKmh: 40,   expectedSpeedMet: 16.8,       expectedFinalMetDisplayed: 16.8 },
  ];

  for (const tc of speedTests) {
    it(`speed ${tc.speedKmh} km/h → finalMetDisplayed ≈ ${tc.expectedFinalMetDisplayed}`, () => {
      // distanceKm = speedKmh * 2 for 2h, except speedKmh=0 → use tiny distance to avoid guard
      const distanceKm = tc.speedKmh === 0 ? 0.001 : tc.speedKmh * 2;
      const result = calc(2, distanceKm, 0, 0, 1.0, 0.0, 0.0, 'NONE');
      expect(Math.abs(result.estimatedMet - tc.expectedFinalMetDisplayed)).toBeLessThanOrEqual(TOL);
    });
  }
});

describe('Boundary tests — uphill interpolation (06-tests-boundaries.yaml)', () => {
  // Baseline: 20 km/h (40 km in 2h), pure asphalt, NONE eBike, 2h duration
  const uphillTests: Array<{
    uphillMetersPerHour: number;
    inputUphillMeters: number;
    expectedUphillBonusMet: number;
    expectedFinalMetDisplayed: number;
  }> = [
    { uphillMetersPerHour: 0,   inputUphillMeters: 0,    expectedUphillBonusMet: 0.0,  expectedFinalMetDisplayed: 8.0  },
    { uphillMetersPerHour: 25,  inputUphillMeters: 50,   expectedUphillBonusMet: 0.15, expectedFinalMetDisplayed: 8.2  },
    { uphillMetersPerHour: 50,  inputUphillMeters: 100,  expectedUphillBonusMet: 0.3,  expectedFinalMetDisplayed: 8.3  },
    { uphillMetersPerHour: 75,  inputUphillMeters: 150,  expectedUphillBonusMet: 0.5,  expectedFinalMetDisplayed: 8.5  },
    { uphillMetersPerHour: 100, inputUphillMeters: 200,  expectedUphillBonusMet: 0.7,  expectedFinalMetDisplayed: 8.7  },
    { uphillMetersPerHour: 150, inputUphillMeters: 300,  expectedUphillBonusMet: 1.1,  expectedFinalMetDisplayed: 9.1  },
    { uphillMetersPerHour: 200, inputUphillMeters: 400,  expectedUphillBonusMet: 1.5,  expectedFinalMetDisplayed: 9.5  },
    { uphillMetersPerHour: 250, inputUphillMeters: 500,  expectedUphillBonusMet: 1.9,  expectedFinalMetDisplayed: 9.9  },
    { uphillMetersPerHour: 300, inputUphillMeters: 600,  expectedUphillBonusMet: 2.3,  expectedFinalMetDisplayed: 10.3 },
    { uphillMetersPerHour: 350, inputUphillMeters: 700,  expectedUphillBonusMet: 2.75, expectedFinalMetDisplayed: 10.8 },
    { uphillMetersPerHour: 400, inputUphillMeters: 800,  expectedUphillBonusMet: 3.2,  expectedFinalMetDisplayed: 11.2 },
    { uphillMetersPerHour: 450, inputUphillMeters: 900,  expectedUphillBonusMet: 3.65, expectedFinalMetDisplayed: 11.7 },
    { uphillMetersPerHour: 500, inputUphillMeters: 1000, expectedUphillBonusMet: 4.1,  expectedFinalMetDisplayed: 12.1 },
    { uphillMetersPerHour: 550, inputUphillMeters: 1100, expectedUphillBonusMet: 4.55, expectedFinalMetDisplayed: 12.6 },
    { uphillMetersPerHour: 600, inputUphillMeters: 1200, expectedUphillBonusMet: 5.0,  expectedFinalMetDisplayed: 13.0 },
    { uphillMetersPerHour: 650, inputUphillMeters: 1300, expectedUphillBonusMet: 5.5,  expectedFinalMetDisplayed: 13.5 },
    { uphillMetersPerHour: 700, inputUphillMeters: 1400, expectedUphillBonusMet: 6.0,  expectedFinalMetDisplayed: 14.0 },
    { uphillMetersPerHour: 800, inputUphillMeters: 1600, expectedUphillBonusMet: 6.0,  expectedFinalMetDisplayed: 14.0 },
    { uphillMetersPerHour: 900, inputUphillMeters: 1800, expectedUphillBonusMet: 6.0,  expectedFinalMetDisplayed: 14.0 },
  ];

  for (const tc of uphillTests) {
    it(`uphillMetersPerHour ${tc.uphillMetersPerHour} → finalMetDisplayed ≈ ${tc.expectedFinalMetDisplayed}`, () => {
      // 20 km/h speed (40 km in 2h), uphill only (downhill=0)
      const result = calc(2, 40, tc.inputUphillMeters, 0, 1.0, 0.0, 0.0, 'NONE');
      expect(Math.abs(result.estimatedMet - tc.expectedFinalMetDisplayed)).toBeLessThanOrEqual(TOL);
      expect(Math.abs((result.uphillBonusMet ?? 0) - tc.expectedUphillBonusMet)).toBeLessThanOrEqual(0.01);
    });
  }
});

describe('Boundary tests — downhill profiles (06-tests-boundaries.yaml)', () => {
  // Baseline: 20 km/h (40 km in 2h), pure asphalt, 2h
  interface DownhillTest {
    uphillMeters: number;
    downhillMeters: number;
    expected: Record<EbikeSupport, {
      gravityFactor: number;
      downhillDominance: number;
      downhillMotorFactor: number;
      finalMetDisplayed: number;
    }>;
  }

  const downhillTests: DownhillTest[] = [
    {
      uphillMeters: 0, downhillMeters: 100,
      expected: {
        NONE:  { gravityFactor: 0.875,    downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 7.3 },
        LIGHT: { gravityFactor: 0.875,    downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 6.9 },
        HIGH:  { gravityFactor: 0.875,    downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 6.4 },
      },
    },
    {
      uphillMeters: 0, downhillMeters: 300,
      expected: {
        NONE:  { gravityFactor: 0.7,      downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 6.3 },
        LIGHT: { gravityFactor: 0.7,      downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 5.9 },
        HIGH:  { gravityFactor: 0.7,      downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 5.5 },
      },
    },
    {
      uphillMeters: 0, downhillMeters: 500,
      expected: {
        NONE:  { gravityFactor: 0.583333, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 5.6 },
        LIGHT: { gravityFactor: 0.583333, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 5.3 },
        HIGH:  { gravityFactor: 0.583333, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 5.0 },
      },
    },
    {
      uphillMeters: 0, downhillMeters: 1000,
      expected: {
        NONE:  { gravityFactor: 0.411765, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 4.6 },
        LIGHT: { gravityFactor: 0.411765, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 4.4 },
        HIGH:  { gravityFactor: 0.411765, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 4.2 },
      },
    },
    {
      uphillMeters: 0, downhillMeters: 1500,
      expected: {
        NONE:  { gravityFactor: 0.318182, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 4.1 },
        LIGHT: { gravityFactor: 0.318182, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 4.0 },
        HIGH:  { gravityFactor: 0.318182, downhillDominance: 1.0, downhillMotorFactor: 0.25, finalMetDisplayed: 3.8 },
      },
    },
    {
      uphillMeters: 300, downhillMeters: 600,
      expected: {
        NONE:  { gravityFactor: 0.692308, downhillDominance: 0.333333, downhillMotorFactor: 0.75, finalMetDisplayed: 7.3 },
        LIGHT: { gravityFactor: 0.692308, downhillDominance: 0.333333, downhillMotorFactor: 0.75, finalMetDisplayed: 5.9 },
        HIGH:  { gravityFactor: 0.692308, downhillDominance: 0.333333, downhillMotorFactor: 0.75, finalMetDisplayed: 4.3 },
      },
    },
    {
      uphillMeters: 600, downhillMeters: 900,
      expected: {
        NONE:  { gravityFactor: 0.6625,   downhillDominance: 0.2,      downhillMotorFactor: 0.85, finalMetDisplayed: 8.4 },
        LIGHT: { gravityFactor: 0.6625,   downhillDominance: 0.2,      downhillMotorFactor: 0.85, finalMetDisplayed: 6.3 },
        HIGH:  { gravityFactor: 0.6625,   downhillDominance: 0.2,      downhillMotorFactor: 0.85, finalMetDisplayed: 4.2 },
      },
    },
    {
      uphillMeters: 900, downhillMeters: 1200,
      expected: {
        NONE:  { gravityFactor: 0.639098, downhillDominance: 0.142857, downhillMotorFactor: 0.892857, finalMetDisplayed: 9.6 },
        LIGHT: { gravityFactor: 0.639098, downhillDominance: 0.142857, downhillMotorFactor: 0.892857, finalMetDisplayed: 7.0 },
        HIGH:  { gravityFactor: 0.639098, downhillDominance: 0.142857, downhillMotorFactor: 0.892857, finalMetDisplayed: 4.4 },
      },
    },
    {
      uphillMeters: 1200, downhillMeters: 600,
      expected: {
        NONE:  { gravityFactor: 0.846154, downhillDominance: 0, downhillMotorFactor: 1.0, finalMetDisplayed: 12.1 },
        LIGHT: { gravityFactor: 0.846154, downhillDominance: 0, downhillMotorFactor: 1.0, finalMetDisplayed: 8.4  },
        HIGH:  { gravityFactor: 0.846154, downhillDominance: 0, downhillMotorFactor: 1.0, finalMetDisplayed: 4.8  },
      },
    },
  ];

  const bikes: EbikeSupport[] = ['NONE', 'LIGHT', 'HIGH'];

  for (const tc of downhillTests) {
    for (const bike of bikes) {
      it(`uphill=${tc.uphillMeters} downhill=${tc.downhillMeters} ${bike} → finalMetDisplayed ≈ ${tc.expected[bike].finalMetDisplayed}`, () => {
        const result = calc(2, 40, tc.uphillMeters, tc.downhillMeters, 1.0, 0.0, 0.0, bike);
        expect(Math.abs(result.estimatedMet - tc.expected[bike].finalMetDisplayed)).toBeLessThanOrEqual(TOL);
      });
    }
  }
});

describe('Boundary tests — motor factor (06-tests-boundaries.yaml)', () => {
  // All with flat terrain, pure asphalt, 2h duration; only HIGH eBike tested
  const motorTests: Array<{
    speedKmh: number;
    expectedSpeedMotorFactor: number;
    expectedEffectiveSupportHigh: number;
    expectedFinalMetDisplayedHigh: number;
  }> = [
    { speedKmh: 20, expectedSpeedMotorFactor: 1.0,  expectedEffectiveSupportHigh: 0.75,   expectedFinalMetDisplayedHigh: 3.7  },
    { speedKmh: 22, expectedSpeedMotorFactor: 0.9,  expectedEffectiveSupportHigh: 0.675,  expectedFinalMetDisplayedHigh: 4.2  },
    { speedKmh: 24, expectedSpeedMotorFactor: 0.75, expectedEffectiveSupportHigh: 0.5625, expectedFinalMetDisplayedHigh: 5.2  },
    { speedKmh: 25, expectedSpeedMotorFactor: 0.6,  expectedEffectiveSupportHigh: 0.45,   expectedFinalMetDisplayedHigh: 6.3  },
    { speedKmh: 26, expectedSpeedMotorFactor: 0.45, expectedEffectiveSupportHigh: 0.3375, expectedFinalMetDisplayedHigh: 7.5  },
    { speedKmh: 28, expectedSpeedMotorFactor: 0.2,  expectedEffectiveSupportHigh: 0.15,   expectedFinalMetDisplayedHigh: 9.5  },
    { speedKmh: 30, expectedSpeedMotorFactor: 0.1,  expectedEffectiveSupportHigh: 0.075,  expectedFinalMetDisplayedHigh: 10.7 },
  ];

  for (const tc of motorTests) {
    it(`speed=${tc.speedKmh} km/h HIGH → effectiveSupport=${tc.expectedEffectiveSupportHigh}, finalMet≈${tc.expectedFinalMetDisplayedHigh}`, () => {
      const result = calc(2, tc.speedKmh * 2, 0, 0, 1.0, 0.0, 0.0, 'HIGH');
      expect(Math.abs(result.estimatedMet - tc.expectedFinalMetDisplayedHigh)).toBeLessThanOrEqual(TOL);
      expect(Math.abs((result.effectiveSupport ?? 0) - tc.expectedEffectiveSupportHigh)).toBeLessThanOrEqual(0.001);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 4 — Intermediate calculation tests (07-tests-calculations-calories.yaml)
// 5 intermediate + 3 calorie = 8 tests
// ---------------------------------------------------------------------------

describe('Intermediate calculation tests (07-tests-calculations-calories.yaml)', () => {
  it('C1: Flat 20 km/h, asphalt, NONE', () => {
    const result = calc(2, 40, 0, 0, 1.0, 0.0, 0.0, 'NONE');
    expect(result.estimatedMet).toBeCloseTo(8.0, 4);
    expect(result.speedMet).toBeCloseTo(8.0, 4);
    expect(result.uphillBonusMet).toBeCloseTo(0.0, 4);
    expect(result.terrainBonusMet).toBeCloseTo(0.0, 4);
    expect(result.effectiveSupport).toBeCloseTo(0.0, 4);
    expect(result.activityCalories).toBeCloseTo(8.0 * 83 * 2, 2);
  });

  it('C2: Flat 20 km/h, asphalt, HIGH', () => {
    const result = calc(2, 40, 0, 0, 1.0, 0.0, 0.0, 'HIGH');
    expect(result.estimatedMet).toBeCloseTo(3.7, 1);
    expect(result.effectiveSupport).toBeCloseTo(0.75, 4);
    // speedMetWithMotor = 2.3 + (8.0 - 2.3) * (1 - 0.75) = 3.725 → finalMetRaw=3.725
    expect(result.activityCalories).toBeCloseTo(3.725 * 83 * 2, 2);
  });

  it('C3: Mixed climb/descent, mixed terrain, LIGHT', () => {
    const result = calc(2, 40, 600, 600, 0.33, 0.33, 0.34, 'LIGHT');
    expect(result.estimatedMet).toBeCloseTo(7.2, 1);
    expect(result.speedMet).toBeCloseTo(8.0, 4);
    expect(result.uphillBonusMet).toBeCloseTo(2.3, 4);
    expect(result.terrainBonusMet).toBeCloseTo(0.675, 4);
    expect(result.effectiveSupport).toBeCloseTo(0.35, 4);
    // finalMetRaw = 7.205
    expect(result.activityCalories).toBeCloseTo(7.205 * 83 * 2, 1);
  });

  it('C4: Strong descent, trail, HIGH', () => {
    const result = calc(2, 40, 0, 1000, 0.0, 0.0, 1.0, 'HIGH');
    expect(result.estimatedMet).toBeCloseTo(5.7, 1);
    expect(result.speedMet).toBeCloseTo(8.0, 4);
    expect(result.terrainBonusMet).toBeCloseTo(1.5, 4);
    expect(result.effectiveSupport).toBeCloseTo(0.1875, 4);
    // finalMetRaw = 5.706985
    expect(result.activityCalories).toBeCloseTo(5.706985 * 83 * 2, 1);
  });

  it('C5: Low-speed ride, asphalt, NONE', () => {
    const result = calc(2, 16, 0, 0, 1.0, 0.0, 0.0, 'NONE');
    expect(result.estimatedMet).toBeCloseTo(3.0, 4);
    expect(result.speedMet).toBeCloseTo(3.0, 4);
    expect(result.effectiveSupport).toBeCloseTo(0.0, 4);
    expect(result.activityCalories).toBeCloseTo(3.0 * 83 * 2, 2);
  });

  it('K1: Flat 20 km/h, asphalt, NONE — calorie test', () => {
    const result = calc(2, 40, 0, 0, 1.0, 0.0, 0.0, 'NONE', 83, 2400);
    expect(result.activityCalories).toBeCloseTo(1328.0, 1);
    expect(result.alreadyAccountedCalories).toBeCloseTo(200.0, 2);
  });

  it('K2: Mixed climb/descent, mixed terrain, LIGHT — calorie test', () => {
    const result = calc(2, 40, 600, 600, 0.33, 0.33, 0.34, 'LIGHT', 83, 2400);
    expect(result.activityCalories).toBeCloseTo(1196.03, 1);
    expect(result.alreadyAccountedCalories).toBeCloseTo(200.0, 2);
  });

  it('K3: Low-speed, asphalt, HIGH — calorie test', () => {
    const result = calc(2, 16, 0, 0, 1.0, 0.0, 0.0, 'HIGH', 83, 2400);
    // finalMetRaw = 2.475
    expect(result.activityCalories).toBeCloseTo(410.85, 1);
    expect(result.alreadyAccountedCalories).toBeCloseTo(200.0, 2);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Guard / edge cases
// ---------------------------------------------------------------------------

describe('Guard / edge cases', () => {
  it('movementTimeMinutes=0 → guard fires, estimatedMet=2.3, activityBonus=0', () => {
    const inputs: CyclingActivityInputs = {
      movementTimeMinutes: 0,
      distanceKm: 30,
      elevationGainM: 0,
      asphaltShare: 1.0, gravelShare: 0.0, trailShare: 0.0,
      ebikeSupport: 'NONE',
    };
    const result = calculateCyclingActivityBonus(inputs, 80, 2000);
    expect(result.estimatedMet).toBe(2.3);
    expect(result.activityBonus).toBe(0);
    expect(result.activityCalories).toBe(0);
  });

  it('distanceKm=0 → guard fires, activityBonus=0', () => {
    const inputs: CyclingActivityInputs = {
      movementTimeMinutes: 120,
      distanceKm: 0,
      elevationGainM: 0,
      asphaltShare: 1.0, gravelShare: 0.0, trailShare: 0.0,
      ebikeSupport: 'NONE',
    };
    const result = calculateCyclingActivityBonus(inputs, 80, 2000);
    expect(result.activityBonus).toBe(0);
  });

  it('ebikeSupport NONE → effectiveSupport = 0 regardless of speed', () => {
    const speeds = [10, 20, 30, 40];
    for (const s of speeds) {
      const result = calc(2, s * 2, 0, 0, 1.0, 0.0, 0.0, 'NONE');
      expect(result.effectiveSupport).toBe(0);
    }
  });

  it('activityBonus is always >= 0', () => {
    // Very short ride where normalCalories > activityCalories
    const inputs: CyclingActivityInputs = {
      movementTimeMinutes: 15,
      distanceKm: 1,
      elevationGainM: 0,
      asphaltShare: 1.0, gravelShare: 0.0, trailShare: 0.0,
      ebikeSupport: 'HIGH',
    };
    const result = calculateCyclingActivityBonus(inputs, 60, 10000);
    expect(result.activityBonus).toBeGreaterThanOrEqual(0);
  });

  it('speedMotorFactor clamps at 30+ km/h → 0.1', () => {
    // At 35 km/h, speedMotorFactor should be 0.1 (clamped, aboveMaximum)
    const r35 = calc(2, 70, 0, 0, 1.0, 0.0, 0.0, 'HIGH');
    const r30 = calc(2, 60, 0, 0, 1.0, 0.0, 0.0, 'HIGH');
    // Both should have effectiveSupport = 0.75 * 0.1 * 1.0 = 0.075
    expect(r35.effectiveSupport).toBeCloseTo(0.075, 4);
    expect(r30.effectiveSupport).toBeCloseTo(0.075, 4);
  });
});
