// computeWeightTrend — pure function zur lokalen Gewichtstrendanalyse.
// Nutzt lineare Regression über die letzten N Einträge (max 14).
// Kein Backend, keine KI — vollständig testbar.

import type { WeightEntry } from '@fittrack/shared';

export type TrendAssessment =
  | 'on_track'           // Abnehmen in Richtung Ziel, Rate plausibel
  | 'too_fast'           // Abnehmen zu schnell (> 1 kg/Woche)
  | 'stagnating'         // Kaum Bewegung (< 0,05 kg/Woche)
  | 'wrong_direction'    // Gewichtszunahme trotz Ziel niedriger
  | 'gaining_correctly'  // Gewichtszunahme in Richtung Ziel (Ziel höher)
  | 'no_target'          // Kein Zielgewicht gesetzt
  | 'insufficient';      // Zu wenige Datenpunkte (< 3)

export interface WeightTrendResult {
  ratePerWeek: number | null;   // kg/Woche, negativ = Abnahme
  assessment: TrendAssessment;
  rateLabel: string;            // "−0,3 kg / Woche"
  message: string;              // "Du bist auf Kurs."
  messageColor: 'positive' | 'neutral' | 'negative';
}

const MIN_ENTRIES = 3;
const STAGNATION_THRESHOLD = 0.05; // kg/Woche
const TOO_FAST_THRESHOLD = 1.0;    // kg/Woche

/**
 * Lineare Regression: gibt Steigung in kg/Tag zurück.
 * Input: Array von (dayOffset, value) Paaren.
 */
function linearRegressionSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function formatRate(ratePerWeek: number): string {
  const abs = Math.abs(ratePerWeek);
  const sign = ratePerWeek < 0 ? '−' : '+';
  return `${sign}${abs.toFixed(1)} kg / Woche`;
}

export function computeWeightTrend(
  entries: WeightEntry[],
  targetWeightKg: number | undefined,
): WeightTrendResult {
  // Sortiere chronologisch (älteste zuerst)
  const sorted = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14); // max letzte 14 Einträge

  if (sorted.length < MIN_ENTRIES) {
    return {
      ratePerWeek: null,
      assessment: 'insufficient',
      rateLabel: '',
      message: 'Noch zu wenige Daten für eine Trendanalyse.',
      messageColor: 'neutral',
    };
  }

  // Datumsdifferenz: erster Eintrag = Tag 0
  const baseDate = sorted[0].date;
  const baseDays = dateToDay(baseDate);
  const points = sorted.map((e) => ({
    x: dateToDay(e.date) - baseDays,
    y: e.value,
  }));

  const slopePerDay = linearRegressionSlope(points);
  const ratePerWeek = slopePerDay * 7;

  const rateLabel = formatRate(ratePerWeek);
  const absRate = Math.abs(ratePerWeek);
  const currentWeight = sorted[sorted.length - 1].value;

  // Kein Zielgewicht gesetzt
  if (targetWeightKg === undefined) {
    if (absRate < STAGNATION_THRESHOLD) {
      return { ratePerWeek, assessment: 'no_target', rateLabel, message: 'Gewicht stabil.', messageColor: 'neutral' };
    }
    const dir = ratePerWeek < 0 ? 'Abnehmend' : 'Zunehmend';
    return { ratePerWeek, assessment: 'no_target', rateLabel, message: `${dir} · ${rateLabel}.`, messageColor: 'neutral' };
  }

  const wantsToLose = targetWeightKg < currentWeight;
  const wantsToGain = targetWeightKg > currentWeight;

  // Stagnation
  if (absRate < STAGNATION_THRESHOLD) {
    return {
      ratePerWeek,
      assessment: 'stagnating',
      rateLabel,
      message: 'Gewicht stagniert gerade.',
      messageColor: 'neutral',
    };
  }

  // Zu schnelle Abnahme
  if (wantsToLose && ratePerWeek < -TOO_FAST_THRESHOLD) {
    return {
      ratePerWeek,
      assessment: 'too_fast',
      rateLabel,
      message: 'Abnahme sehr schnell – achte auf ausreichend Protein.',
      messageColor: 'negative',
    };
  }

  // Abnehmen, Ziel niedriger → richtige Richtung
  if (wantsToLose && ratePerWeek < 0) {
    return {
      ratePerWeek,
      assessment: 'on_track',
      rateLabel,
      message: 'Du bist auf Kurs.',
      messageColor: 'positive',
    };
  }

  // Zunehmen, Ziel höher → richtige Richtung
  if (wantsToGain && ratePerWeek > 0) {
    return {
      ratePerWeek,
      assessment: 'gaining_correctly',
      rateLabel,
      message: 'Aufbau läuft – du bist auf Kurs.',
      messageColor: 'positive',
    };
  }

  // Falsche Richtung
  return {
    ratePerWeek,
    assessment: 'wrong_direction',
    rateLabel,
    message: wantsToLose ? 'Gewicht nimmt zu – Ernährung prüfen.' : 'Gewicht nimmt ab – mehr essen.',
    messageColor: 'negative',
  };
}

/** ISO-Datum (YYYY-MM-DD) → Integer-Tag (Tage seit Epoch) */
function dateToDay(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86_400_000);
}
