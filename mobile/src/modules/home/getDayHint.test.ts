import { describe, it, expect } from 'vitest';
import { getDayHint } from './getDayHint';

const BASE_SUMMARY = { calories: 1200, protein: 140, carbs: 150, fat: 40, fiber: 15 };
const BASE_TARGETS = {
  calories: 2000,
  macroRanges: {
    proteinG: { minG: 120, maxG: 160 },
    carbsG: { minG: 200, maxG: 300 },
  },
};

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

  describe('3. Protein-Hinweis (unterhalb des Zielbereichs)', () => {
    it('zeigt Protein-Hinweis bei mehr als 20 g bis zur unteren Bereichsgrenze', () => {
      const summary = { ...BASE_SUMMARY, protein: 99 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Bis zu deinem Protein-Zielbereich fehlen dir noch 21 g.',
      );
    });

    it('zeigt keinen Protein-Hinweis, wenn die untere Bereichsgrenze erreicht ist', () => {
      const summary = { ...BASE_SUMMARY, protein: 120 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Noch 800 kcal verfügbar.',
      );
    });

    it('zeigt an der oberen Grenze und darüber keinen negativen Protein-Hinweis', () => {
      for (const protein of [160, 161, 170]) {
        const summary = { ...BASE_SUMMARY, protein };
        const result = getDayHint(summary, BASE_TARGETS, 'rest', null);
        expect(result).not.toContain('Protein');
      }
    });

    it('sperrt Empfehlungen bei höchstens 20 g bis zur unteren Bereichsgrenze', () => {
      const summary = { ...BASE_SUMMARY, protein: 100 };
      expect(getDayHint(summary, BASE_TARGETS, 'rest', null)).toBe(
        'Noch 800 kcal verfügbar.',
      );
    });

    it('wertet Kohlenhydrate außerhalb ihres Richtbereichs nicht negativ', () => {
      const summary = { ...BASE_SUMMARY, carbs: 0 };
      const result = getDayHint(summary, BASE_TARGETS, 'rest', null);
      expect(result).toBe('Noch 800 kcal verfügbar.');
      expect(result).not.toContain('Kohlenhydrate');
    });

    it('verwendet ohne Makrobereiche keinen Legacy-Protein-Punktwert', () => {
      const summary = { ...BASE_SUMMARY, protein: 0 };
      expect(getDayHint(summary, { calories: 2000 }, 'rest', null)).toBe(
        'Noch 800 kcal verfügbar.',
      );
    });
  });

  describe('4. Kalorien-Hinweis', () => {
    it('zeigt verbleibende Kalorien', () => {
      // 2000 - 1200 = 800 kcal remaining
      const summary = { ...BASE_SUMMARY, protein: 130 }; // innerhalb des Protein-Zielbereichs
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
