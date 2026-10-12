import { describe, expect, it } from 'vitest';
import { enforceSourceBackedTotalTime } from './recipeTotalTimeGuard';

const draft = (totalTimeMinutes: number | null) => ({ totalTimeMinutes, teaser: 'T' });
const source = (steps: string[], description?: string) => ({ recipeContext: { description }, steps: steps.map((text) => ({ description: text })) });

describe('enforceSourceBackedTotalTime', () => {
  it('nulls a single step duration used as total when other steps are untimed', () => {
    const oven = source(['Schneide Kartoffeln.', 'Heize den Ofen auf 180°C vor.', 'Backe 40 Minuten.']);
    expect(enforceSourceBackedTotalTime(draft(40), oven).totalTimeMinutes).toBeNull();
  });

  it('keeps an explicitly stated total even with untimed steps', () => {
    expect(enforceSourceBackedTotalTime(draft(50), source(['Schneide.', 'Backe 40 Minuten.'], 'Gesamtzeit inklusive Vorbereitung und Backen: 50 Minuten.')).totalTimeMinutes).toBe(50);
    expect(enforceSourceBackedTotalTime(draft(90), source(['Schneide.'], 'Dauert insgesamt 1,5 Stunden.')).totalTimeMinutes).toBe(90);
  });

  it('keeps a total when every step is timed and the durations add up to it', () => {
    expect(enforceSourceBackedTotalTime(draft(15), source(['Rühre 5 Minuten.', 'Koche 10 Minuten.'])).totalTimeMinutes).toBe(15);
  });

  it('nulls a wrong total even when every step is timed', () => {
    expect(enforceSourceBackedTotalTime(draft(90), source(['Rühre 5 Minuten.', 'Koche 10 Minuten.'])).totalTimeMinutes).toBeNull();
  });

  it('reads compound hour and minute durations as one total', () => {
    expect(enforceSourceBackedTotalTime(draft(90), source(['Schneide.'], 'Gesamtzeit: 1 Std. 30 Min.')).totalTimeMinutes).toBe(90);
    expect(enforceSourceBackedTotalTime(draft(90), source(['Schneide.'], 'Dauert insgesamt 1 Stunde und 30 Minuten.')).totalTimeMinutes).toBe(90);
    expect(enforceSourceBackedTotalTime(draft(60), source(['Schneide.'], 'Gesamtzeit: 1 Std. 30 Min.')).totalTimeMinutes).toBeNull();
  });

  it('keeps a total that equals preparation plus cooking time stated in the description', () => {
    const recipe = source(['Schneide.', 'Backe.'], 'Vorbereitung: 15 Min. Backzeit: 30 Min.');
    expect(enforceSourceBackedTotalTime(draft(45), recipe).totalTimeMinutes).toBe(45);
    expect(enforceSourceBackedTotalTime(draft(30), recipe).totalTimeMinutes).toBeNull();
  });

  it('does not merge two separate minute durations into one', () => {
    expect(enforceSourceBackedTotalTime(draft(15), source(['Rühre 5 Min. 10 Min. warten.'])).totalTimeMinutes).toBe(15);
  });

  it('leaves null untouched and does not mutate the input', () => {
    const input = draft(40);
    enforceSourceBackedTotalTime(input, source(['Schneide.', 'Backe 40 Minuten.']));
    expect(input.totalTimeMinutes).toBe(40);
    expect(enforceSourceBackedTotalTime(draft(null), source(['Schneide.'])).totalTimeMinutes).toBeNull();
  });
});
