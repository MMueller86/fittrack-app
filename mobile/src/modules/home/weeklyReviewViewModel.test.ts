import { describe, expect, it } from 'vitest';
import type {
  WeeklyNutritionDay,
  WeeklyNutritionReviewResponse,
} from '@fittrack/shared';
import {
  createWeeklyReviewViewModel,
  formatWeeklyReviewDayCalorieSummary,
} from './weeklyReviewViewModel';

function makeDay(overrides: Partial<WeeklyNutritionDay> = {}): WeeklyNutritionDay {
  return {
    date: '2026-08-07',
    consumedCalories: 2185,
    consumedMacros: null,
    baseTargetCalories: 2300,
    effectiveTargetCalories: 2300,
    activityBonusCalories: 0,
    targetPercent: 95,
    targetBand: 'in_range',
    dataStatus: 'available',
    targetSource: 'day_target_snapshot',
    dayType: 'rest',
    workoutType: null,
    activity: null,
    hasMealItem: true,
    mealItemCount: 1,
    ...overrides,
  };
}

function makeReview(days: WeeklyNutritionDay[], overallTargetPercent: number | null = 95): WeeklyNutritionReviewResponse {
  return {
    referenceDate: '2026-08-14',
    periodStart: '2026-08-07',
    periodEnd: '2026-08-13',
    days,
    totals: {
      includedDayCount: 1,
      totalConsumedCalories: 2185,
      totalTargetCalories: 2300,
      averageConsumedCalories: 2185,
      averageTargetCalories: 2300,
      overallTargetPercent,
    },
    evaluation: {
      status: 'fresh',
      text: 'Eine ruhige Woche.',
      generatedAt: '2026-08-14T10:00:00.000Z',
    },
  };
}

describe('createWeeklyReviewViewModel', () => {
  it('formats local date-only values and German whole-number values', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ date: '2026-08-07', consumedCalories: 2185, targetPercent: 95 }),
    ]));

    expect(viewModel.periodLabel).toBe('7. Aug. - 13. Aug.');
    expect(viewModel.days[0]).toMatchObject({
      weekdayLabel: 'Fr',
      dateLabel: '7. Aug.',
      consumedLabel: '2.185 kcal',
      percentLabel: '95 %',
      targetLabel: 'Ziel 2.300 kcal',
      effectiveTargetLabel: '2.300 kcal',
    });
    expect(viewModel.averageConsumedLabel).toBe('2.185 kcal');
    expect(viewModel).toMatchObject({
      totalConsumedLabel: '2.185 kcal',
      totalTargetLabel: '2.300 kcal',
      averageTargetLabel: '2.300 kcal',
      overallPercentLabel: '95 %',
      overallTargetBand: 'in_range',
    });
    expect(viewModel.days[0]?.overlayDetails).toEqual({
      title: 'Fr 7. Aug.',
      body: '',
      detailGroups: [],
      calorieSummary: {
        isAvailable: true,
        consumedLabel: '2.185 kcal',
        targetLabel: '2.300 kcal',
        percentLabel: '95 %',
        progressRatio: 0.95,
        targetBand: 'in_range',
        accessibilityLabel: 'Kalorien: 2.185 kcal von 2.300 kcal, Zielerreichung 95 %',
      },
      macroSummary: {
        isAvailable: false,
        proteinLabel: null,
        carbsLabel: null,
        fatLabel: null,
        accessibilityLabel: 'Makrodaten nicht verfügbar',
      },
    });
    expect(viewModel.days[0]?.accessibilityLabel).toContain(
      'Kalorien: 2.185 kcal von 2.300 kcal, Zielerreichung 95 %',
    );
  });

  it('formats consumed macros without inventing targets and keeps zero values visible', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({
        consumedMacros: { protein: 132.5, carbs: 245.25, fat: 0 },
      }),
    ]));

    expect(viewModel.days[0]?.macroSummary).toEqual({
      isAvailable: true,
      proteinLabel: '132,5 g',
      carbsLabel: '245,3 g',
      fatLabel: '0 g',
      accessibilityLabel: 'Makros: Eiweiß 132,5 g, Kohlenhydrate 245,3 g, Fett 0 g',
    });
    expect(viewModel.days[0]?.overlayDetails.macroSummary.isAvailable).toBe(true);
    expect(viewModel.days[0]?.calorieSummary).toMatchObject({
      isAvailable: true,
      consumedLabel: '2.185 kcal',
      targetLabel: '2.300 kcal',
      percentLabel: '95 %',
      progressRatio: 0.95,
    });
  });

  it('keeps calorie details out of the overlay body while retaining them in structured summaries', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({
        consumedMacros: { protein: 120, carbs: 240, fat: 80 },
        activity: { type: 'cycling', label: 'Radtour' },
        activityBonusCalories: 500,
        effectiveTargetCalories: 2800,
        targetPercent: 100,
      }),
    ]));
    const overlay = viewModel.days[0]?.overlayDetails;

    expect(overlay?.body).toBe('');
    expect(overlay?.detailGroups).toEqual([
      { label: 'Basisziel', value: '2.300 kcal' },
      { label: 'Aktivitätsbonus', value: '500 kcal' },
      { label: 'Effektives Ziel', value: '2.800 kcal' },
      { label: 'Sonderaktivität', value: 'Radtour' },
    ]);
    expect(overlay?.calorieSummary).toMatchObject({
      isAvailable: true,
      consumedLabel: '2.185 kcal',
      targetLabel: '2.800 kcal',
      percentLabel: '100 %',
    });
    expect(overlay?.macroSummary).toMatchObject({
      isAvailable: true,
      proteinLabel: '120 g',
      carbsLabel: '240 g',
      fatLabel: '80 g',
    });
  });

  it('formats the calorie visualization against the effective target without a macro target', () => {
    const summary = formatWeeklyReviewDayCalorieSummary(makeDay({
      consumedCalories: 3200,
      effectiveTargetCalories: 2500,
      targetPercent: 128,
      targetBand: 'outside_range',
      consumedMacros: { protein: 0, carbs: 0, fat: 0 },
    }));

    expect(summary).toEqual({
      isAvailable: true,
      consumedLabel: '3.200 kcal',
      targetLabel: '2.500 kcal',
      percentLabel: '128 %',
      progressRatio: 1,
      targetBand: 'outside_range',
      accessibilityLabel: 'Kalorien: 3.200 kcal von 2.500 kcal, Zielerreichung 128 %',
    });
  });

  it('exposes a neutral macro state when nutrition data has no consumed macro aggregate', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ hasMealItem: false, consumedCalories: null, consumedMacros: null }),
    ]));

    expect(viewModel.days[0]?.macroSummary).toMatchObject({
      isAvailable: false,
      proteinLabel: null,
      carbsLabel: null,
      fatLabel: null,
    });
    expect(viewModel.days[0]?.calorieSummary).toMatchObject({
      isAvailable: false,
      consumedLabel: null,
      percentLabel: null,
      progressRatio: null,
      accessibilityLabel: 'Kalorienvergleich nicht verfügbar',
    });
  });

  it('keeps all seven fixed day slots and scales above-target values without changing layout height', () => {
    const days = Array.from({ length: 7 }, (_, index) => makeDay({
      date: `2026-08-${String(index + 7).padStart(2, '0')}`,
      targetPercent: index === 5 ? 129 : 100,
    }));

    const viewModel = createWeeklyReviewViewModel(makeReview(days));

    expect(viewModel.days).toHaveLength(7);
    expect(viewModel.chartScaleMaxPercent).toBe(140);
  });

  it('does not invent consumption, targets, or day labels for missing data', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({
        consumedCalories: null,
        targetPercent: null,
        dataStatus: 'missing_nutrition',
        hasMealItem: false,
      }),
      makeDay({
        consumedCalories: 0,
        targetPercent: 0,
        dataStatus: 'available',
        hasMealItem: true,
      }),
      makeDay({
        consumedCalories: 1800,
        effectiveTargetCalories: null,
        targetPercent: null,
        targetBand: null,
        targetSource: 'unavailable',
        dataStatus: 'missing_target',
        dayType: null,
        workoutType: null,
        hasMealItem: true,
      }),
      makeDay({
        consumedCalories: null,
        effectiveTargetCalories: null,
        targetPercent: null,
        targetBand: null,
        targetSource: 'unavailable',
        dataStatus: 'missing_nutrition_and_target',
        dayType: null,
        workoutType: null,
        hasMealItem: false,
      }),
    ]));

    expect(viewModel.days[0]).toMatchObject({
      consumedLabel: null,
      percentLabel: null,
      targetLabel: 'Ziel 2.300 kcal',
      contextLabel: 'Ruhetag',
      statusLabel: 'Keine Einträge',
      missingState: 'missing_nutrition',
    });
    expect(viewModel.days[1]).toMatchObject({
      consumedLabel: '0 kcal',
      percentLabel: '0 %',
      missingState: null,
    });
    expect(viewModel.days[1]?.overlayDetails.detailGroups).toEqual([]);
    expect(viewModel.days[1]?.accessibilityLabel).toContain(
      'Kalorien: 0 kcal von 2.300 kcal, Zielerreichung 0 %',
    );
    expect(viewModel.days[2]).toMatchObject({
      consumedLabel: '1.800 kcal',
      percentLabel: null,
      targetLabel: null,
      contextLabel: null,
      statusLabel: 'Ziel nicht verfügbar',
      missingState: 'missing_target',
    });
    expect(viewModel.days[2]?.overlayDetails.detailGroups).toEqual([]);
    expect(viewModel.days[2]?.overlayDetails.detailGroups).not.toContainEqual(
      { label: 'Tagestyp', value: 'Ruhetag' },
    );
    expect(viewModel.days[3]).toMatchObject({
      statusLabel: 'Keine Daten',
      missingState: 'missing_nutrition_and_target',
    });
    expect(viewModel.days[3]?.overlayDetails.detailGroups).toEqual([]);
  });

  it('exposes adjusted activity targets and the server-provided band', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({
        consumedCalories: 4650,
        baseTargetCalories: 2300,
        effectiveTargetCalories: 3600,
        activityBonusCalories: 1300,
        targetPercent: 129.166,
        targetBand: 'outside_range',
        activity: { type: 'cycling', label: 'Radtour' },
        dayType: 'rest',
      }),
    ]));

    expect(viewModel.days[0]).toMatchObject({
      targetLabel: 'Ziel 3.600 kcal',
      activityBonusLabel: '+1.300 kcal Aktivitätsbonus',
      activityBonusValueLabel: '1.300 kcal',
      contextLabel: 'Radtour',
    });
    expect(viewModel.days[0]?.overlayDetails.detailGroups).toEqual([
      { label: 'Basisziel', value: '2.300 kcal' },
      { label: 'Aktivitätsbonus', value: '1.300 kcal' },
      { label: 'Effektives Ziel', value: '3.600 kcal' },
      { label: 'Sonderaktivität', value: 'Radtour' },
    ]);
    expect(viewModel.days[0]?.accessibilityLabel).toContain(
      'Kalorien: 4.650 kcal von 3.600 kcal, Zielerreichung 129 %',
    );
    expect(viewModel.days[0]?.accessibilityLabel).toContain('Basisziel: 2.300 kcal');
    expect(viewModel.days[0]?.accessibilityLabel).toContain('Sonderaktivität: Radtour');
    expect(viewModel.days[0]?.accessibilityLabel).not.toContain('Aktivität: Radtour');
  });

  it('renders training day type and workout type separately, including the neutral missing workout state', () => {
    const withWorkout = createWeeklyReviewViewModel(makeReview([
      makeDay({
        dayType: 'training',
        workoutType: 'gym',
        targetSource: 'profile_fallback',
        baseTargetCalories: 2400,
        effectiveTargetCalories: 2400,
      }),
    ])).days[0];
    const withoutWorkout = createWeeklyReviewViewModel(makeReview([
      makeDay({
        dayType: 'training',
        workoutType: null,
        targetSource: 'profile_fallback',
        baseTargetCalories: 2400,
        effectiveTargetCalories: 2400,
      }),
    ])).days[0];

    expect(withWorkout).toMatchObject({
      dayTypeLabel: 'Training',
      workoutTypeLabel: 'Gym',
      effectiveTargetLabel: '2.400 kcal',
    });
    expect(withWorkout?.overlayDetails.detailGroups).toEqual([
      { label: 'Basisziel', value: '2.400 kcal' },
      { label: 'Aktivitätsbonus', value: '0 kcal' },
      { label: 'Effektives Ziel', value: '2.400 kcal' },
      { label: 'Aktivität', value: 'Nicht verfügbar' },
    ]);
    expect(withoutWorkout).toMatchObject({
      dayTypeLabel: 'Training',
      workoutTypeLabel: null,
    });
    expect(withoutWorkout?.overlayDetails.detailGroups).toEqual([
      { label: 'Basisziel', value: '2.400 kcal' },
      { label: 'Aktivitätsbonus', value: '0 kcal' },
      { label: 'Effektives Ziel', value: '2.400 kcal' },
      { label: 'Aktivität', value: 'Nicht verfügbar' },
    ]);
  });

  it('uses the shared home presentation label for the other workout type', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ dayType: 'training', workoutType: 'other' }),
    ]));

    expect(viewModel.days[0]).toMatchObject({
      contextLabel: 'Sonstiges',
      workoutTypeLabel: 'Sonstiges',
    });
  });

  it('provides exactly two ordered markers for training plus a special activity', () => {
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({
        dayType: 'training',
        workoutType: 'cycling',
        activity: { type: 'cycling', label: '' },
      }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'training',
        icon: { lib: 'mci', name: 'bike' },
        label: 'Radfahren',
      },
      {
        kind: 'activity',
        icon: { lib: 'mci', name: 'bike' },
        label: 'Radtour',
      },
    ]);
    expect(day?.accessibilityLabel).toContain('Sonderaktivität: Radtour');
  });

  it('uses the shared catalog icon and label for every known workout type', () => {
    const expected = [
      ['gym', 'weight-lifter', 'Gym'],
      ['bouldering', 'human-handsup', 'Bouldern / Klettern'],
      ['running', 'run', 'Laufen'],
      ['cycling', 'bike', 'Radfahren'],
      ['other', 'dots-horizontal', 'Sonstiges'],
    ] as const;

    for (const [workoutType, icon, label] of expected) {
      const day = createWeeklyReviewViewModel(makeReview([
        makeDay({ dayType: 'training', workoutType }),
      ])).days[0];

      expect(day?.markers).toEqual([
        {
          kind: 'training',
          icon: { lib: 'mci', name: icon },
          label,
        },
      ]);
    }
  });

  it('uses the neutral training fallback when workout type is missing', () => {
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ dayType: 'training', workoutType: null }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'training',
        icon: { lib: 'feather', name: 'activity' },
        label: 'Training',
      },
    ]);
  });

  it('uses the neutral training fallback for an unknown workout value', () => {
    const unknownWorkoutType = 'swimming' as unknown as WeeklyNutritionDay['workoutType'];
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ dayType: 'training', workoutType: unknownWorkoutType }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'training',
        icon: { lib: 'feather', name: 'activity' },
        label: 'Training',
      },
    ]);
    expect(day?.workoutTypeLabel).toBeNull();
    expect(day?.contextLabel).toBe('Training');
  });

  it('creates a cycling marker with a stable German label', () => {
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ activity: { type: 'cycling', label: 'Radfahren' } }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'activity',
        icon: { lib: 'mci', name: 'bike' },
        label: 'Radtour',
      },
    ]);
  });

  it('creates a hiking marker with a stable German label', () => {
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ activity: { type: 'hiking', label: 'Bergtour' } }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'activity',
        icon: { lib: 'mci', name: 'hiking' },
        label: 'Wanderung',
      },
    ]);
  });

  it('uses a neutral info marker for an unknown special activity value', () => {
    const unknownActivity = {
      type: 'swimming',
      label: '',
    } as unknown as WeeklyNutritionDay['activity'];
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ activity: unknownActivity }),
    ])).days[0];

    expect(day?.markers).toEqual([
      {
        kind: 'activity',
        icon: { lib: 'feather', name: 'info' },
        label: 'Sonderaktivität',
      },
    ]);
    expect(day?.activityLabel).toBe('Sonderaktivität');
  });

  it('does not create markers for a day without training or supported activity', () => {
    const day = createWeeklyReviewViewModel(makeReview([
      makeDay({ dayType: 'rest', activity: null }),
    ])).days[0];

    expect(day?.markers).toEqual([]);
  });

  it('keeps calorie accessibility data while allowing a context-free overlay body to stay empty', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({
        dayType: null,
        workoutType: null,
        activity: null,
        activityBonusCalories: 0,
      }),
    ]));

    expect(viewModel.days[0]?.overlayDetails.body).toBe('');
    expect(viewModel.days[0]?.accessibilityLabel).toContain(
      'Kalorien: 2.185 kcal von 2.300 kcal, Zielerreichung 95 %',
    );
  });

  it('derives the target band when a compatible response omits it', () => {
    const viewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ targetPercent: 129, targetBand: null }),
    ]));

    expect(viewModel.days[0]?.targetBand).toBe('outside_range');
  });

  it('derives the aggregate target band from the total percentage, including valid zero and missing values', () => {
    const zeroViewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ consumedCalories: 0, targetPercent: 0 }),
    ], 0));
    const missingViewModel = createWeeklyReviewViewModel(makeReview([
      makeDay({ consumedCalories: null, targetPercent: null, hasMealItem: false }),
    ], null));

    expect(zeroViewModel.overallTargetBand).toBe('outside_range');
    expect(missingViewModel.overallTargetBand).toBeNull();
  });
});