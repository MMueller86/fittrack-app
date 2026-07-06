import { describe, it, expect } from 'vitest';
import { getMealTypeForHour, getSuggestedMealType } from './mealTimeRules';

describe('getMealTypeForHour', () => {
  it('05:00 → breakfast', () => expect(getMealTypeForHour(5)).toBe('breakfast'));
  it('07:30 → breakfast', () => expect(getMealTypeForHour(7.5)).toBe('breakfast'));
  it('09:59 → breakfast', () => expect(getMealTypeForHour(9.99)).toBe('breakfast'));

  it('10:00 → snack', () => expect(getMealTypeForHour(10)).toBe('snack'));
  it('11:00 → snack', () => expect(getMealTypeForHour(11)).toBe('snack'));
  it('11:59 → snack', () => expect(getMealTypeForHour(11.99)).toBe('snack'));

  it('12:00 → lunch', () => expect(getMealTypeForHour(12)).toBe('lunch'));
  it('13:00 → lunch', () => expect(getMealTypeForHour(13)).toBe('lunch'));
  it('14:29 → lunch', () => expect(getMealTypeForHour(14.49)).toBe('lunch'));

  it('14:30 → snack', () => expect(getMealTypeForHour(14.5)).toBe('snack'));
  it('16:00 → snack', () => expect(getMealTypeForHour(16)).toBe('snack'));
  it('17:29 → snack', () => expect(getMealTypeForHour(17.49)).toBe('snack'));

  it('17:30 → dinner', () => expect(getMealTypeForHour(17.5)).toBe('dinner'));
  it('19:00 → dinner', () => expect(getMealTypeForHour(19)).toBe('dinner'));
  it('20:59 → dinner', () => expect(getMealTypeForHour(20.99)).toBe('dinner'));

  it('21:00 → snack (late night)', () => expect(getMealTypeForHour(21)).toBe('snack'));
  it('23:59 → snack', () => expect(getMealTypeForHour(23.99)).toBe('snack'));
  it('00:00 → snack (midnight)', () => expect(getMealTypeForHour(0)).toBe('snack'));
  it('04:59 → snack (early morning)', () => expect(getMealTypeForHour(4.99)).toBe('snack'));
});

describe('getSuggestedMealType', () => {
  it('returns a valid MealType', () => {
    const validTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'preworkout', 'postworkout'];
    expect(validTypes).toContain(getSuggestedMealType());
  });
});
