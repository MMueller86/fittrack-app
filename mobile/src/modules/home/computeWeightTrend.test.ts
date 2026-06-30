import { describe, it, expect } from 'vitest';
import { computeWeightTrend } from './computeWeightTrend';
import type { WeightEntry } from '@fittrack/shared';

function makeEntries(values: number[], startDate = '2026-06-01'): WeightEntry[] {
  return values.map((value, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 2); // alle 2 Tage ein Eintrag
    return {
      id: `e${i}`,
      userId: 'u1',
      date: d.toISOString().split('T')[0],
      value,
      unit: 'kg' as const,
      createdAt: d.toISOString(),
    };
  });
}

describe('computeWeightTrend', () => {
  describe('insufficient data', () => {
    it('gibt insufficient zurück bei 0 Einträgen', () => {
      const result = computeWeightTrend([], 72);
      expect(result.assessment).toBe('insufficient');
      expect(result.ratePerWeek).toBeNull();
    });

    it('gibt insufficient zurück bei 2 Einträgen', () => {
      const result = computeWeightTrend(makeEntries([75, 74.8]), 72);
      expect(result.assessment).toBe('insufficient');
    });

    it('gibt kein insufficient mehr bei 3 Einträgen', () => {
      const result = computeWeightTrend(makeEntries([75, 74.8, 74.6]), 72);
      expect(result.assessment).not.toBe('insufficient');
    });
  });

  describe('on_track (Abnahme in Richtung Ziel)', () => {
    it('erkennt konstante Abnahme als on_track', () => {
      // -0.3 kg alle 2 Tage = ca. -1.05 kg/Woche → too_fast
      // Nehmen wir kleiner: -0.1 kg alle 2 Tage = -0.35 kg/Woche
      const entries = makeEntries([76, 75.9, 75.8, 75.7, 75.6, 75.5]);
      const result = computeWeightTrend(entries, 72);
      expect(result.assessment).toBe('on_track');
      expect(result.messageColor).toBe('positive');
      expect(result.ratePerWeek).not.toBeNull();
      expect(result.ratePerWeek!).toBeLessThan(0);
    });
  });

  describe('too_fast (zu schnelle Abnahme)', () => {
    it('erkennt Abnahme > 1 kg/Woche als too_fast', () => {
      // -0.5 kg alle 2 Tage = -1.75 kg/Woche
      const entries = makeEntries([80, 79.5, 79.0, 78.5, 78.0, 77.5]);
      const result = computeWeightTrend(entries, 70);
      expect(result.assessment).toBe('too_fast');
      expect(result.messageColor).toBe('negative');
    });
  });

  describe('stagnating', () => {
    it('erkennt flache Kurve als stagnating', () => {
      // Weniger als 0.05 kg/Woche Veränderung
      const entries = makeEntries([75.0, 75.0, 75.1, 75.0, 75.0, 75.1]);
      const result = computeWeightTrend(entries, 72);
      expect(result.assessment).toBe('stagnating');
      expect(result.messageColor).toBe('neutral');
    });
  });

  describe('wrong_direction', () => {
    it('erkennt Gewichtszunahme mit Ziel niedriger als wrong_direction', () => {
      // Zunahme, aber Ziel ist niedriger
      const entries = makeEntries([75, 75.2, 75.4, 75.6, 75.8, 76.0]);
      const result = computeWeightTrend(entries, 72);
      expect(result.assessment).toBe('wrong_direction');
      expect(result.messageColor).toBe('negative');
    });
  });

  describe('gaining_correctly', () => {
    it('erkennt Zunahme mit Ziel höher als gaining_correctly', () => {
      // Zunahme, Ziel ist höher als aktuelles Gewicht
      const entries = makeEntries([70, 70.2, 70.4, 70.6, 70.8, 71.0]);
      const result = computeWeightTrend(entries, 75);
      expect(result.assessment).toBe('gaining_correctly');
      expect(result.messageColor).toBe('positive');
    });
  });

  describe('no_target', () => {
    it('gibt no_target zurück wenn kein Zielgewicht gesetzt', () => {
      const entries = makeEntries([75, 74.9, 74.8, 74.7, 74.6, 74.5]);
      const result = computeWeightTrend(entries, undefined);
      expect(result.assessment).toBe('no_target');
      expect(result.messageColor).toBe('neutral');
    });
  });

  describe('rateLabel', () => {
    it('formatiert negative Rate mit Minuszeichen', () => {
      const entries = makeEntries([76, 75.9, 75.8, 75.7, 75.6, 75.5]);
      const result = computeWeightTrend(entries, 72);
      expect(result.rateLabel).toMatch(/^−/);
    });

    it('formatiert positive Rate mit Pluszeichen', () => {
      const entries = makeEntries([70, 70.2, 70.4, 70.6, 70.8, 71.0]);
      const result = computeWeightTrend(entries, 75);
      expect(result.rateLabel).toMatch(/^\+/);
    });

    it('ist leer bei insufficient', () => {
      const result = computeWeightTrend([], 72);
      expect(result.rateLabel).toBe('');
    });
  });

  describe('max 14 Einträge', () => {
    it('nutzt maximal die letzten 14 Einträge', () => {
      // 20 Einträge, alle gleich außer den letzten 14 die abnehmen
      const flat = Array(6).fill(80);
      const declining = Array.from({ length: 14 }, (_, i) => 80 - i * 0.1);
      const entries = makeEntries([...flat, ...declining]);
      const result = computeWeightTrend(entries, 72);
      expect(result.assessment).toBe('on_track');
    });
  });
});
