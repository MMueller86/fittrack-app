import type { WeightEntry, WeightUnit } from '../types/weights';

const MILLISECONDS_PER_DAY = 86_400_000;

export const WEIGHT_TREND_WINDOW_DAYS = 30;
export const WEIGHT_TREND_DIRECTION_THRESHOLD_PER_WEEK = 0.01;

export type WeightTrendDirection = 'gaining' | 'losing' | 'stable';
export interface WeightTrendSeriesPoint {
  date: string;
  weightKg: number;
}

export interface WeightTrendRegressionLine {
  start: WeightTrendSeriesPoint;
  end: WeightTrendSeriesPoint;
}

export interface WeightTrendRegressionSeries {
  measurements: WeightTrendSeriesPoint[];
  slopeKgPerWeek: number | null;
  regressionLine: WeightTrendRegressionLine | null;
}

interface LinearRegressionFit {
  slopeKgPerDay: number;
  meanX: number;
  meanY: number;
}


function parseDateDay(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / MILLISECONDS_PER_DAY);
}

function getCurrentDateDay(now: Date): number {
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(date.getTime() / MILLISECONDS_PER_DAY);
}

function toKg(entry: WeightEntry): number {
  return entry.unit === 'lbs' ? entry.value / 2.20462 : entry.value;
}

function toUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kg * 2.20462 : kg;
}
function fitWeightRegression(entries: WeightEntry[]): LinearRegressionFit | null {
  if (entries.length < 2) return null;

  const xs = entries.map((entry) => parseDateDay(entry.date));
  const ys = entries.map(toKg);
  const count = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / count;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / count;
  const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index]! - meanY), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);

  return denominator > 0 ? { slopeKgPerDay: numerator / denominator, meanX, meanY } : null;

}

export function getWeightEntriesInLastDays(
  entries: WeightEntry[],
  days: number,
  now: Date = new Date(),
): WeightEntry[] {
  const currentDay = getCurrentDateDay(now);
  return entries.filter((entry) => currentDay - parseDateDay(entry.date) <= days);
}

/** Returns the chart's linear-regression slope projected to a weekly change. */
export function calculateWeightTrendPerWeek(
  entries: WeightEntry[],
  unit: WeightUnit,
  now: Date = new Date(),
): number | null {
  const last30 = getWeightEntriesInLastDays(entries, WEIGHT_TREND_WINDOW_DAYS, now);
  if (last30.length < 2) return null;

  const sorted = [...last30].sort((a, b) => parseDateDay(a.date) - parseDateDay(b.date));
  const fit = fitWeightRegression(sorted);

  return fit ? toUnit(fit.slopeKgPerDay * 7, unit) : null;
}

export function classifyWeightTrend(weeklyChange: number | null): WeightTrendDirection | null {
  if (weeklyChange == null) return null;
  if (weeklyChange < -WEIGHT_TREND_DIRECTION_THRESHOLD_PER_WEEK) return 'losing';
  if (weeklyChange > WEIGHT_TREND_DIRECTION_THRESHOLD_PER_WEEK) return 'gaining';
  return 'stable';
}
/** Builds a kg-based regression series for exactly `windowDays` local calendar dates, including today. */
export function calculateWeightTrendRegressionSeries(
  entries: WeightEntry[],
  windowDays: number,
  now: Date = new Date(),
): WeightTrendRegressionSeries {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError('windowDays must be a positive integer');
  }

  const currentDay = getCurrentDateDay(now);
  const firstIncludedDay = currentDay - windowDays + 1;
  const sorted = entries
    .filter((entry) => {
      const entryDay = parseDateDay(entry.date);
      return entryDay >= firstIncludedDay && entryDay <= currentDay;
    })
    .sort((a, b) => parseDateDay(a.date) - parseDateDay(b.date));
  const measurements = sorted.map((entry) => ({ date: entry.date, weightKg: toKg(entry) }));
  const fit = fitWeightRegression(sorted);

  if (!fit) {
    return { measurements, slopeKgPerWeek: null, regressionLine: null };
  }

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const firstDay = parseDateDay(first.date);
  const lastDay = parseDateDay(last.date);

  return {
    measurements,
    slopeKgPerWeek: fit.slopeKgPerDay * 7,
    regressionLine: {
      start: {
        date: first.date,
        weightKg: fit.meanY + fit.slopeKgPerDay * (firstDay - fit.meanX),
      },
      end: {
        date: last.date,
        weightKg: fit.meanY + fit.slopeKgPerDay * (lastDay - fit.meanX),
      },
    },
  };
}
