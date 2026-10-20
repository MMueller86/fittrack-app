import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colors, spacing, typography } from '../../app/theme';
import {
  getWeeklyReviewDayChartState,
  getWeeklyReviewDaySlotLayout,
  getWeeklyReviewMissingLegendMarkerGeometry,
  getWeeklyReviewMarkerCells,
  getWeeklyReviewMarkerColor,
  getWeeklyReviewMarkerLegend,
  getWeeklyReviewMetricAccessibilityLabel,
  getWeeklyReviewMetricDisplayValue,
  getWeeklyReviewTargetBandColor,
  getWeeklyReviewVisibleWeekdayLabel,
  hasWeeklyReviewDayMarkers,
  isWeeklyReviewSpecialActivityMarker,
  WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
  WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_BAR_WIDTH,
  WEEKLY_REVIEW_DAY_COUNT,
  WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
  WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
  WEEKLY_REVIEW_MIN_TOUCH_HEIGHT,
  WEEKLY_REVIEW_VALUE_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
  WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
} from './weeklyReviewCardLayout';

const weeklyReviewCardSource = readFileSync(
  fileURLToPath(new URL('./WeeklyReviewCard.tsx', import.meta.url)),
  'utf8',
);

describe('weekly review KPI presentation', () => {
  it('renders the shared calorie unit after the target while preserving zero and missing values', () => {
    expect(getWeeklyReviewMetricDisplayValue('2.185 kcal')).toBe('2.185 kcal');
    expect(
      `${getWeeklyReviewMetricDisplayValue('2.185 kcal', { omitUnit: true })} / ${getWeeklyReviewMetricDisplayValue('2.300 kcal')}`,
    ).toBe('2.185 / 2.300 kcal');
    expect(getWeeklyReviewMetricDisplayValue('0 kcal', { omitUnit: true })).toBe('0');
    expect(getWeeklyReviewMetricDisplayValue(null)).toBe('\u2014');
    expect(getWeeklyReviewMetricDisplayValue(null, { omitUnit: true })).toBe('\u2014');
    expect(getWeeklyReviewMetricAccessibilityLabel('7-Tage-Ziel', '0 kcal', '2.300 kcal'))
      .toBe('7-Tage-Ziel: Gegessen 0 kcal / Ziel 2.300 kcal');
    expect(getWeeklyReviewMetricAccessibilityLabel('Ø Ziel / Tag', null, null))
      .toBe('Ø Ziel / Tag: Gegessen Nicht verfügbar / Ziel Nicht verfügbar');
  });

  it('preserves target-band colors and neutral missing semantics', () => {
    expect(getWeeklyReviewTargetBandColor('in_range')).toBe(colors.primary);
    expect(getWeeklyReviewTargetBandColor('outside_range')).toBe(colors.warning);
    expect(getWeeklyReviewTargetBandColor(null)).toBe(colors.neutral);
    expect(WEEKLY_REVIEW_MIN_TOUCH_HEIGHT).toBe(48);
  });
});

describe('weekly review target marker rendering', () => {
  it('keeps a solid target marker only for comparable days without a duplicate reference line', () => {
    expect(weeklyReviewCardSource).not.toContain('ReferenceLine');
    expect(weeklyReviewCardSource).not.toContain('referenceLine');
    expect(weeklyReviewCardSource.match(/styles\.targetMarker/g)).toHaveLength(1);
    expect(weeklyReviewCardSource).toMatch(
      /\{hasBarData \? \(\s*<View\s+style=\{\[styles\.targetMarker/,
    );
  });

  it.each([
    { hasNutrition: false, hasTarget: true },
    { hasNutrition: true, hasTarget: false },
    { hasNutrition: false, hasTarget: false },
  ])('omits percentages and target markers for missing data: %j', (day) => {
    expect(getWeeklyReviewDayChartState({ ...day, percentLabel: null })).toEqual({
      hasBarData: false,
      percentLabel: null,
    });
    expect(getWeeklyReviewDayChartState({ ...day, percentLabel: '0 %' }).percentLabel).toBeNull();
  });

  it.each(['0 %', '43 %', '100 %'])('preserves real percentages including zero: %s', (percentLabel) => {
    expect(getWeeklyReviewDayChartState({ hasNutrition: true, hasTarget: true, percentLabel }))
      .toEqual({ hasBarData: true, percentLabel });
  });

  it('leaves missing percentage slots empty without collapsing the seven-column layout', () => {
    const valuesSource = weeklyReviewCardSource.slice(
      weeklyReviewCardSource.indexOf('function DayValues'),
      weeklyReviewCardSource.indexOf('function MissingPatternBar'),
    );
    expect(valuesSource).toContain('<View style={styles.valueColumn}>');
    expect(valuesSource).toContain('{percentLabel != null && (');
    expect(valuesSource).not.toContain('\\u2014');
    expect(weeklyReviewCardSource).toContain('height: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT');
    expect(weeklyReviewCardSource).toContain('accessibilityLabel={day.accessibilityLabel}');
  });
});

describe('weekly review evaluation header', () => {
  it('uses the Feather zap icon with the existing German title', () => {
    expect(weeklyReviewCardSource).toContain(
      '<Icon lib="feather" name="zap" size="sm" color={colors.primaryBright} />',
    );
    expect(weeklyReviewCardSource).toContain(
      '<Text style={styles.evaluationTitle}>Deine Wochenbewertung</Text>',
    );
  });
});

describe('weekly review error icon', () => {
  it('uses alert-circle for the initial error and keeps it for refresh errors', () => {
    const initialErrorStart = weeklyReviewCardSource.indexOf('function WeeklyReviewError');
    const refreshErrorStart = weeklyReviewCardSource.indexOf('function WeeklyReviewRefreshError');
    const initialErrorSource = weeklyReviewCardSource.slice(initialErrorStart, refreshErrorStart);

    expect(initialErrorSource).toContain(
      '<Icon lib="feather" name="alert-circle" size="md" color={colors.textMuted} />',
    );
    expect(initialErrorSource).not.toContain('name="info"');
    expect(weeklyReviewCardSource).toContain(
      '<Icon lib="feather" name="alert-circle" size="sm" color={colors.textMuted} />',
    );
  });
});

describe('MissingLegendMarker geometry', () => {
  it('keeps both diagonal segments inside the 2x pattern viewBox', () => {
    const patternSize = spacing.sm;
    const geometry = getWeeklyReviewMissingLegendMarkerGeometry(patternSize);
    const [minX, minY, viewBoxWidth, viewBoxHeight] = geometry.viewBox;
    const maxX = minX + viewBoxWidth;
    const maxY = minY + viewBoxHeight;

    expect(geometry.viewBox).toEqual([0, 0, patternSize * 2, patternSize * 2]);
    expect(geometry.lineSegments).toEqual([
      [0, patternSize, patternSize, 0],
      [0, patternSize * 2, patternSize * 2, 0],
    ]);
    expect(geometry.lineSegments).toHaveLength(2);
    expect(geometry.lineSegments.every(([startX, startY, endX, endY]) => (
      [startX, endX].every((x) => x >= minX && x <= maxX)
      && [startY, endY].every((y) => y >= minY && y <= maxY)
    ))).toBe(true);
  });
});

describe('weekly review day context', () => {
  it('keeps activity icons close to weekdays in one consistent compact row', () => {
    expect(WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN).toBe(spacing.xs);
    expect(WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN).toBe(spacing.xs / 2);
    expect(WEEKLY_REVIEW_MARKER_SLOT_HEIGHT).toBe(spacing.md);
    expect(getWeeklyReviewDaySlotLayout().totalHeight).toBe(124);
    const markerContent = weeklyReviewCardSource.match(/markerContent:\s*\{([^}]*)\}/)?.[1] ?? '';
    const markerBadge = weeklyReviewCardSource.match(/markerBadge:\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(markerContent).not.toContain('flexWrap');
    expect(markerBadge).toContain('width: spacing.md');
    expect(markerBadge).toContain('height: spacing.md');
    expect(markerBadge).not.toContain('backgroundColor');
    expect(spacing.md * 2).toBeLessThan((320 - spacing.md * 4 - 2 - spacing.xs * 6) / 7);
  });

  it('uses a plain header and only three short status legend entries', () => {
    expect(weeklyReviewCardSource).not.toContain('name="bar-chart-2"');
    expect(weeklyReviewCardSource).toContain('>Letzte 7 Tage</Text>');
    expect(weeklyReviewCardSource).not.toContain('<MarkerLegend');
    expect(weeklyReviewCardSource).toContain('<Text style={styles.legendText}>Im Ziel</Text>');
    expect(weeklyReviewCardSource).toContain('<Text style={styles.legendText}>Außerhalb</Text>');
    expect(weeklyReviewCardSource).toContain('<Text style={styles.legendText}>Keine Daten</Text>');
    expect(weeklyReviewCardSource).not.toContain('Nicht im Ziel');
    const legend = weeklyReviewCardSource.match(/legendRow:\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(legend).toContain('marginTop: spacing.xs');
    expect(legend).toContain('paddingTop: spacing.xs');
  });

  it('defines identical explicit slots and y coordinates for all seven day columns', () => {
    const layout = getWeeklyReviewDaySlotLayout();
    const layouts = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT }, () => getWeeklyReviewDaySlotLayout());

    expect(layouts).toHaveLength(7);
    expect(layouts.every((candidate) => candidate != null)).toBe(true);
    expect(layout.value).toEqual({ top: 0, height: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT });
    expect(WEEKLY_REVIEW_VALUE_SLOT_HEIGHT).toBe(typography.body2.fontSize);
    expect(layout.bar).toEqual({
      top: WEEKLY_REVIEW_VALUE_SLOT_HEIGHT + WEEKLY_REVIEW_BAR_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_BAR_SLOT_HEIGHT,
    });
    expect(layout.weekday).toEqual({
      top: layout.bar.top + WEEKLY_REVIEW_BAR_SLOT_HEIGHT + WEEKLY_REVIEW_WEEKDAY_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT,
    });
    expect(layout.marker).toEqual({
      top: layout.weekday.top + WEEKLY_REVIEW_WEEKDAY_SLOT_HEIGHT + WEEKLY_REVIEW_MARKER_SLOT_TOP_MARGIN,
      height: WEEKLY_REVIEW_MARKER_SLOT_HEIGHT,
    });
    expect(layouts.slice(1)).toEqual(Array.from({ length: WEEKLY_REVIEW_DAY_COUNT - 1 }, () => layout));
  });

  it('uses a compact one-line value slot and a short, narrow chart bar', () => {
    expect(WEEKLY_REVIEW_VALUE_SLOT_HEIGHT).toBe(typography.body2.fontSize);
    expect(WEEKLY_REVIEW_BAR_SLOT_HEIGHT).toBe(spacing.xxl * 1.5);
    expect(WEEKLY_REVIEW_BAR_WIDTH).toBe(spacing.md);
    expect(weeklyReviewCardSource).not.toContain('styles.calorieText');

    const barTrackStyle = weeklyReviewCardSource.match(/barTrack:\s*\{([^}]*)\}/)?.[1] ?? '';
    const missingBarStyle = weeklyReviewCardSource.match(/missingBar:\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(barTrackStyle).toContain('width: WEEKLY_REVIEW_BAR_WIDTH');
    expect(barTrackStyle).not.toContain('backgroundColor');
    expect(missingBarStyle).toContain('width: spacing.sm');
    expect(missingBarStyle).toContain('height: spacing.sm');
  });

  it('omits the shared marker row only when every day is marker-free', () => {
    const withMarker = getWeeklyReviewDaySlotLayout(true);
    const withoutMarker = getWeeklyReviewDaySlotLayout(false);

    expect(withMarker.marker).not.toBeNull();
    expect(withoutMarker.marker).toBeNull();
    expect(withoutMarker.totalHeight).toBe(
      withoutMarker.weekday.top + withoutMarker.weekday.height,
    );

    const cells = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      markers: index === 0
        ? [{
            kind: 'training' as const,
            icon: { lib: 'feather' as const, name: 'activity' as const },
            label: 'Training' as const,
          }]
        : [],
    }));

    expect(hasWeeklyReviewDayMarkers(cells)).toBe(true);
    expect(hasWeeklyReviewDayMarkers(cells.map((cell) => ({ ...cell, markers: [] })))).toBe(false);
    expect(weeklyReviewCardSource).toContain('showMarkerRow={showMarkerRow}');
  });

  it('uses the purple accent only for special-activity marker icons', () => {
    const trainingMarker = {
      kind: 'training',
      icon: { lib: 'mci', name: 'run' },
      label: 'Laufen',
    } as const;
    const activityMarker = {
      kind: 'activity',
      icon: { lib: 'mci', name: 'bike' },
      label: 'Radtour',
    } as const;

    expect(getWeeklyReviewMarkerColor(trainingMarker)).toBe(colors.textSecondary);
    expect(getWeeklyReviewMarkerColor(activityMarker)).toBe(colors.chart.specialActivityOutline);
  });

  it('uses only the weekday under the bars and never the date label', () => {
    const day = { weekdayLabel: 'Fr', dateLabel: '7. Aug.' };

    expect(getWeeklyReviewVisibleWeekdayLabel(day)).toBe('Fr');
    expect(getWeeklyReviewVisibleWeekdayLabel(day)).not.toContain(day.dateLabel);
  });
});

describe('getWeeklyReviewMarkerCells', () => {
  it('keeps exactly seven marker cells aligned with the chart days', () => {
    const days = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      markers: index === 0
        ? [{
            kind: 'training' as const,
            icon: { lib: 'feather' as const, name: 'activity' as const },
            label: 'Training' as const,
          }]
        : [],
    }));

    const cells = getWeeklyReviewMarkerCells(days);

    expect(cells).toHaveLength(WEEKLY_REVIEW_DAY_COUNT);
    expect(cells.map((cell) => cell.date)).toEqual(days.map((day) => day.date));
    expect(cells.map((cell) => cell.markers)).toEqual(days.map((day) => day.markers));
  });

  it('does not create a marker cell outside the seven chart columns', () => {
    const days = Array.from({ length: WEEKLY_REVIEW_DAY_COUNT + 1 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      markers: [],
    }));

    expect(getWeeklyReviewMarkerCells(days)).toHaveLength(WEEKLY_REVIEW_DAY_COUNT);
  });
});

describe('getWeeklyReviewMarkerLegend', () => {
  it('returns one deduplicated special-activity explanation without training entries', () => {
    const legend = getWeeklyReviewMarkerLegend([
      {
        markers: [
          {
            kind: 'activity',
            icon: { lib: 'mci', name: 'hiking' },
            label: 'Wanderung',
          },
          {
            kind: 'training',
            icon: { lib: 'mci', name: 'weight-lifter' },
            label: 'Gym',
          },
        ],
      },
      {
        markers: [
          {
            kind: 'training',
            icon: { lib: 'mci', name: 'run' },
            label: 'Laufen',
          },
          {
            kind: 'activity',
            icon: { lib: 'mci', name: 'bike' },
            label: 'Radtour',
          },
        ],
      },
    ]);

    expect(legend).toEqual([
      {
        kind: 'activity',
        icon: { lib: 'mci', name: 'hiking' },
        label: 'Sonderaktivität',
      },
    ]);
  });

  it('keeps outline semantics limited to special-activity markers', () => {
    const trainingMarker = {
      kind: 'training',
      icon: { lib: 'mci', name: 'weight-lifter' },
      label: 'Gym',
    } as const;
    const activityMarker = {
      kind: 'activity',
      icon: { lib: 'mci', name: 'bike' },
      label: 'Radtour',
    } as const;

    expect(isWeeklyReviewSpecialActivityMarker(trainingMarker)).toBe(false);
    expect(isWeeklyReviewSpecialActivityMarker(activityMarker)).toBe(true);
  });

  it('keeps the marker legend empty when all seven days are marker-free', () => {
    expect(getWeeklyReviewMarkerLegend(
      Array.from({ length: 7 }, () => ({ markers: [] })),
    )).toEqual([]);
  });
});