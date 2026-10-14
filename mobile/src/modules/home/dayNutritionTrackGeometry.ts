import type { MacroRange } from '@fittrack/shared';

export const MACRO_TRACK_SCALE = 1.5;
export const MACRO_TRACK_REFERENCE_POSITION = 1 / MACRO_TRACK_SCALE;
export const MACRO_TRACK_VIEWBOX_WIDTH = 100;
export const MACRO_TRACK_HEIGHT = 6;

const MACRO_TRACK_HATCH_SPACING = 6;

export interface MacroTrackRangePosition {
  start: number;
  end: number;
}

export interface MacroTrackGeometry {
  fillRatio: number;
  referencePosition: number | null;
  rangePosition: MacroTrackRangePosition | null;
}

export interface MacroTrackHatchSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ActivityBonusTrackValues {
  valueKcal: number;
  targetKcal: number;
  fillRatio: number;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

export function formatMacroAmount(value: number): string {
  return String(value).replace('.', ',');
}

export function getMacroTrackGeometry(
  value: number,
  target: number | MacroRange | null,
): MacroTrackGeometry {
  const emptyGeometry: MacroTrackGeometry = {
    fillRatio: 0,
    referencePosition: null,
    rangePosition: null,
  };
  if (target == null) return emptyGeometry;

  const referenceTarget = typeof target === 'number' ? target : target.maxG;

  if (referenceTarget == null || !Number.isFinite(referenceTarget) || referenceTarget <= 0) {
    return emptyGeometry;
  }

  const fillRatio = clampRatio(value / referenceTarget / MACRO_TRACK_SCALE);
  const referencePosition = MACRO_TRACK_REFERENCE_POSITION;

  if (typeof target === 'number') {
    return { fillRatio, referencePosition, rangePosition: null };
  }

  if (!Number.isFinite(target.minG) || target.minG < 0 || target.minG > referenceTarget) {
    return { fillRatio, referencePosition, rangePosition: null };
  }

  return {
    fillRatio,
    referencePosition,
    rangePosition: {
      start: clampRatio(target.minG / referenceTarget / MACRO_TRACK_SCALE),
      end: referencePosition,
    },
  };
}

export function getMacroRangeHatchSegments(
  range: MacroTrackRangePosition,
): MacroTrackHatchSegment[] {
  const start = clampRatio(range.start) * MACRO_TRACK_VIEWBOX_WIDTH;
  const end = clampRatio(range.end) * MACRO_TRACK_VIEWBOX_WIDTH;

  if (end <= start) return [];

  const segments: MacroTrackHatchSegment[] = [];
  for (
    let diagonalStartX = start - MACRO_TRACK_HEIGHT;
    diagonalStartX < end;
    diagonalStartX += MACRO_TRACK_HATCH_SPACING
  ) {
    const x1 = Math.max(start, diagonalStartX);
    const x2 = Math.min(end, diagonalStartX + MACRO_TRACK_HEIGHT);
    if (x2 <= x1) continue;

    segments.push({
      x1,
      y1: MACRO_TRACK_HEIGHT - (x1 - diagonalStartX),
      x2,
      y2: MACRO_TRACK_HEIGHT - (x2 - diagonalStartX),
    });
  }

  return segments;
}

export function getActivityBonusTrackValues(
  consumedCalories: number,
  baseTargetCalories: number,
  activityBonus: number,
): ActivityBonusTrackValues {
  const valueKcal = Math.max(0, consumedCalories - baseTargetCalories);
  const targetKcal = Math.round(activityBonus);

  return {
    valueKcal,
    targetKcal,
    fillRatio: targetKcal > 0 ? clampRatio(valueKcal / targetKcal) : 0,
  };
}