import { afterAll, describe, expect, it } from 'vitest';
import { estimateMeal } from '../openai';
import {
  MEAL_ESTIMATE_PROMPT_VERSION,
  MEAL_ESTIMATE_SYSTEM_PROMPT,
  MEAL_PHOTO_ASSESSMENT_PROMPT_VERSION,
  MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT,
} from './mealEstimate';
import { MEAL_ESTIMATE_EVAL_FIXTURES } from './mealEstimate.eval.fixtures';

/** Update this constant whenever the prompt version changes and re-review the AC-derived checks. */
const TESTED_PROMPT_VERSION = 'meal-estimate-v6';
const TESTED_PHOTO_ASSESSMENT_PROMPT_VERSION = 'meal-photo-assessment-v1';

it('prompt versions match the reviewed V6 estimator and photo-assessment contracts', () => {
  expect(MEAL_ESTIMATE_PROMPT_VERSION).toBe(TESTED_PROMPT_VERSION);
  expect(MEAL_PHOTO_ASSESSMENT_PROMPT_VERSION).toBe(TESTED_PHOTO_ASSESSMENT_PROMPT_VERSION);
});

it('requires calories to follow from the macros and the components to add up', () => {
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Kalorien und Makros müssen zusammenpassen');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Auch die Kalorien der componentItems müssen zur Gesamtzahl passen.');
});

it('defines confidence as a qualitative self-assessment of the complete estimate', () => {
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Stufe selbst ein');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('keine statistischen Wahrscheinlichkeiten');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('wie verlässlich deine gesamte Schätzung ist');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Nährwerte');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).not.toContain('ausschließlich die Unsicherheit der Portionsmenge');
});

it('prompt has no calorie anchors and keeps the legacy component projection server-owned', () => {
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).not.toMatch(/\b\d+\s*(?:-|–|bis)\s*\d+\s*kcal\b/iu);
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('## Übliche Zubereitung');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('auch wenn sie nicht ausdrücklich genannt oder nicht sichtbar sind');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('nichts, was der Nutzer ausdrücklich ausschließt');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Ein separates Feld "components" wird nicht erzeugt.');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Zusätzliche Zutaten oder Bestandteile');
  expect(MEAL_ESTIMATE_SYSTEM_PROMPT).toContain('Eine frühere Foto-Beziehungsbewertung oder deren Begründung wird dir nicht übergeben.');
});

it('photo assessment prompt encodes only the approved relationship classes and abstains neutrally', () => {
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('consistent');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('complementary');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('contradictory');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('uncertain');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('Eine andere Portionsgröße, eine nicht erwähnte Beilage, Garnitur oder zusätzliche sichtbare Zutat ist allein kein Widerspruch.');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).toContain('Bei Unsicherheit verwende uncertain.');
  expect(MEAL_PHOTO_ASSESSMENT_SYSTEM_PROMPT).not.toMatch(/kcal|Kalorien|Nährwerte|Makros/iu);
});

const hasCredentials =
  !!process.env['AZURE_OPENAI_ENDPOINT'] && !!process.env['AZURE_OPENAI_API_KEY'];

describe.skipIf(!hasCredentials)('mealEstimate: live prompt evaluation', () => {
  const observations: Array<{
    id: string;
    calories: number;
    totalGrams: number;
    atwaterDeviationKcal: number;
    atwaterDeviationPct: number;
    componentDeviationKcal: number;
    componentDeviationPct: number | null;
    warnings: string[];
    tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    directionDeltaPct?: number;
  }> = [];

  it.each(MEAL_ESTIMATE_EVAL_FIXTURES)('[$id] $description', async (fixture) => {
    let tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } = {};
    const result = await estimateMeal({
      ...fixture.input,
      onUsage: (usage) => { tokenUsage = usage; },
    });

    expect(typeof result.mealName).toBe('string');
    if (fixture.expectedPortionConfidence) {
      expect(result.portionConfidence).toBe(fixture.expectedPortionConfidence);
    }
    expect(Number.isFinite(result.mealEstimate.calories)).toBe(true);
    expect(result.mealEstimate.calories).toBeGreaterThanOrEqual(0);
    expect(result.mealEstimate.calories).toBeLessThanOrEqual(3000);
    for (const value of [
      result.mealEstimate.protein,
      result.mealEstimate.carbs,
      result.mealEstimate.fat,
      result.mealEstimate.fiber,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }

    expect(Number.isFinite(result.estimatedTotalGrams)).toBe(true);
    expect(result.estimatedTotalGrams).toBeGreaterThanOrEqual(20);
    expect(result.estimatedTotalGrams).toBeLessThanOrEqual(5000);
    expect(result.componentItems.length).toBeLessThanOrEqual(20);
    for (const item of result.componentItems) {
      expect(item.name).toBe(item.name.trim());
      expect(item.name.length).toBeGreaterThanOrEqual(1);
      expect(item.name.length).toBeLessThanOrEqual(100);
      expect(Number.isFinite(item.estimatedGrams)).toBe(true);
      expect(item.estimatedGrams).toBeGreaterThan(0);
      expect(item.estimatedGrams).toBeLessThanOrEqual(5000);
      expect(Number.isFinite(item.calories)).toBe(true);
      expect(item.calories).toBeGreaterThanOrEqual(0);
      expect(item.calories).toBeLessThanOrEqual(3000);
    }

    let directionDeltaPct: number | undefined;
    if (fixture.expectedCaloriesDirection && fixture.input.refine) {
      const previousCalories = fixture.input.refine.previous.mealEstimate.calories;
      directionDeltaPct = ((result.mealEstimate.calories - previousCalories) / previousCalories) * 100;
      if (fixture.expectedCaloriesDirection === 'larger') {
        expect(result.mealEstimate.calories).toBeGreaterThanOrEqual(previousCalories * 1.05);
      } else {
        expect(result.mealEstimate.calories).toBeLessThanOrEqual(previousCalories * 0.95);
      }
    }

    if (fixture.calorieReference) {
      expect(fixture.calorieReference.reviewStatus).toBe('validated');
      expect(result.mealEstimate.calories).toBeGreaterThanOrEqual(fixture.calorieReference.minKcal * 0.8);
      expect(result.mealEstimate.calories).toBeLessThanOrEqual(fixture.calorieReference.maxKcal * 1.2);
    }

    const macroCalories = 4 * result.mealEstimate.protein + 4 * result.mealEstimate.carbs + 9 * result.mealEstimate.fat;
    const componentCalories = result.componentItems.reduce((sum, item) => sum + item.calories, 0);
    const atwaterDeviationKcal = Math.abs(result.mealEstimate.calories - macroCalories);
    const componentDeviationKcal = Math.abs(result.mealEstimate.calories - componentCalories);

    // Same level as the app's inconsistency warning; the server aligns smaller remaining gaps.
    expect(atwaterDeviationKcal).toBeLessThanOrEqual(Math.max(50, macroCalories * 0.1));
    if (result.componentItems.length > 0) {
      expect(componentDeviationKcal).toBeLessThanOrEqual(result.mealEstimate.calories * 0.2);
    }
    if (fixture.implicitAddition) {
      // An added ingredient may be listed as a component or named in the assumptions; an exclusion may be
      // mentioned in the assumptions, so absence is checked on components only.
      const names = result.componentItems.map((item) => item.name);
      const haystack = (fixture.implicitAddition.present ? [...names, ...result.assumptions] : names).join(' ');
      expect(fixture.implicitAddition.pattern.test(haystack)).toBe(fixture.implicitAddition.present);
    }
    observations.push({
      id: fixture.id,
      calories: result.mealEstimate.calories,
      totalGrams: result.estimatedTotalGrams,
      atwaterDeviationKcal,
      atwaterDeviationPct: result.mealEstimate.calories === 0 ? 0 : atwaterDeviationKcal / result.mealEstimate.calories * 100,
      componentDeviationKcal,
      componentDeviationPct: result.mealEstimate.calories === 0 || result.componentItems.length === 0
        ? null
        : componentDeviationKcal / result.mealEstimate.calories * 100,
      warnings: result.warnings,
      tokenUsage,
      ...(directionDeltaPct === undefined ? {} : { directionDeltaPct }),
    });
  });

  afterAll(() => {
    const calibrationFixtures = MEAL_ESTIMATE_EVAL_FIXTURES.filter((fixture) => fixture.calorieReference);
    const expectedCalibrationCount = MEAL_ESTIMATE_EVAL_FIXTURES.filter((fixture) => !fixture.input.refine).length;
    const calibrationComplete = expectedCalibrationCount > 0 && calibrationFixtures.length === expectedCalibrationCount;
    const deviations = calibrationComplete
      ? calibrationFixtures.map((fixture) => {
          const observation = observations.find((item) => item.id === fixture.id);
          const reference = fixture.calorieReference!;
          const midpoint = (reference.minKcal + reference.maxKcal) / 2;
          return ((observation!.calories - midpoint) / midpoint) * 100;
        })
      : [];
    const withinRangeCount = calibrationComplete
      ? calibrationFixtures.filter((fixture) => {
          const calories = observations.find((item) => item.id === fixture.id)!.calories;
          return calories >= fixture.calorieReference!.minKcal * 0.8 &&
            calories <= fixture.calorieReference!.maxKcal * 1.2;
        }).length
      : 0;
    const sortedDeviations = [...deviations].sort((a, b) => a - b);
    const medianBiasPct = sortedDeviations.length === 0
      ? null
      : sortedDeviations.length % 2 === 1
        ? sortedDeviations[Math.floor(sortedDeviations.length / 2)]!
        : (sortedDeviations[sortedDeviations.length / 2 - 1]! + sortedDeviations[sortedDeviations.length / 2]!) / 2;
    const maxPositiveDeviationPct = deviations.length === 0 ? null : Math.max(...deviations);

    console.info('Meal-estimate eval evidence', JSON.stringify({
      promptVersion: MEAL_ESTIMATE_PROMPT_VERSION,
      fixtureCount: observations.length,
      calibrationStatus: calibrationComplete ? 'MEASURED' : 'UNVERIFIED_DV-1_REFERENCE_RANGES_MISSING',
      medianSignedBiasPct: medianBiasPct,
      within20PercentRate: calibrationComplete ? withinRangeCount / calibrationFixtures.length : null,
      maxPositiveDeviationPct,
      deviationMetrics: observations.map(({
        id, calories, totalGrams, atwaterDeviationKcal, atwaterDeviationPct,
        componentDeviationKcal, componentDeviationPct, directionDeltaPct, tokenUsage,
      }) => ({
        id, calories, totalGrams, kcalPerGram: calories / totalGrams,
        atwaterDeviationKcal, atwaterDeviationPct,
        componentDeviationKcal, componentDeviationPct, directionDeltaPct, tokenUsage,
      })),
      warningTexts: observations.map(({ id, warnings }) => ({ id, warnings })),
    }));

    if (calibrationComplete) {
      expect(medianBiasPct).toBeGreaterThanOrEqual(-5);
      expect(withinRangeCount / calibrationFixtures.length).toBeGreaterThanOrEqual(0.8);
      expect(maxPositiveDeviationPct).toBeLessThanOrEqual(40);
    }
  });
});