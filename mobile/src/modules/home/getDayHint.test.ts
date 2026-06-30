import { describe, it, expect } from 'vitest';
import { getDayHint } from './getDayHint';

const BASE_SUMMARY = { calories: 1200, protein: 80, carbs: 150, fat: 40, fiber: 15 };
const BASE_TARGETS = { calories: 2000, proteinG: 165 };

describe('getDayHint', () => {
  describe('1. Kein Eintrag heute', () => {
    it('gibt Einstiegs-CTA zurück wenn summary null', () => {
      expect(getDayHint(null, BASE_TARGETS, 'rest', null)).toBe(
        'Starte mit deinem ersten Eintrag.',
      );
    });

    it('gibt Einstiegs-CTA zurück wenn calories === 0', () => {
      const empty = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      expect(getDayHint(empty, BASE_TARGETS, 'rest', null)).toBe(
        'Starte mit deinem ersten Eintrag.',
      );
    });
  });

  describe('2. Trainingstag', () => {
    it('zeigt Gym-Tag Hinweis', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', 'gym')).toBe(
        'Heute ist dein Gym-Tag.',
      );
    });

    it('zeigt Klettertag Hinweis für bouldering', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', 'bouldering')).toBe(
        'Heute ist dein Klettertag.',
      );
    });

    it('zeigt Lauftag für running', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', 'running')).toBe(
        'Heute ist dein Lauftag.',
      );
    });

    it('zeigt Radtag für cycling', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', 'cycling')).toBe(
        'Heute ist dein Radtag.',
      );
    });

    it('zeigt Trainingstag für other', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', 'other')).toBe(
        'Heute ist dein Trainingstag.',
      );
    });

    it('zeigt Trainingstag wenn workoutType null', () => {
      expect(getDayHint(BASE_SUMMARY, BASE_TARGETS, 'training', null)).toBe(
        'Heute ist dein Trainingstag.',
      );
    });
  });

  describe('3. Protein-Hinweis (unter 50% des Ziels)', () => {
    it('zeigt Protein-Hinweis wenn Protein < 50% des Ziels', () => {
      // protein: 60, target: 165 → 60 < 82.5 → Hinweis
      const summary = { ...BASE_SUMMARY, protein: 60 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Dir fehlen noch 105 g Protein.',
      );
    });

    it('zeigt Protein-Hinweis bei genau 49%', () => {
      // 49% von 165 = 80.85 → protein = 80 → < 82.5 → Hinweis
      const summary = { ...BASE_SUMMARY, protein: 80 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Dir fehlen noch 85 g Protein.',
      );
    });

    it('zeigt keinen Protein-Hinweis wenn Protein >= 50% des Ziels', () => {
      // protein: 90 >= 82.5 → kein Protein-Hinweis → Kalorien-Hinweis
      const summary = { ...BASE_SUMMARY, protein: 90 };
      const result = getDayHint(summary, BASE_TARGETS, 'rest', null);
      expect(result).not.toContain('Protein');
    });
  });

  describe('4. Kalorien-Hinweis', () => {
    it('zeigt verbleibende Kalorien', () => {
      // 2000 - 1200 = 800 kcal remaining
      const summary = { ...BASE_SUMMARY, protein: 90 }; // protein ok
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Noch 800 kcal verfügbar.',
      );
    });

    it('zeigt Überschreitung wenn über Ziel', () => {
      const summary = { ...BASE_SUMMARY, calories: 2300, protein: 120 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        '300 kcal über deinem Ziel.',
      );
    });
  });

  describe('Edge Cases', () => {
    it('zeigt neutralen Text wenn targets null', () => {
      expect(getDayHint(BASE_SUMMARY, null, 'rest', null)).toBe('Alles im Blick.');
    });

    it('zeigt Einstiegs-CTA auch bei Trainingstag wenn keine Einträge', () => {
      const empty = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      expect(getDayHint(empty, BASE_TARGETS, 'training', 'gym')).toBe(
        'Starte mit deinem ersten Eintrag.',
      );
    });
  });
});
