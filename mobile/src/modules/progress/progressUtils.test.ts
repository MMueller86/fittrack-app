import { describe, expect, it } from 'vitest';
import {
  getProgressCalendarDates,
  getProgressAverageForWindow,
  getProgressEntriesForDate,
  getProgressEntriesInWindow,
  parseWeightInput,
} from './progressUtils';

function entry(date: string) {
  return { date };
}

describe('Progress utilities', () => {
  it('filters seven calendar dates including today without future or older entries', () => {
    const entries = ['2026-10-17', '2026-10-16', '2026-10-10', '2026-10-09'].map(entry);

    expect(getProgressEntriesInWindow(entries, 7, '2026-10-16').map(({ date }) => date)).toEqual([
      '2026-10-16', '2026-10-10',
    ]);
  });
  it('filters exact inclusive calendar windows and excludes future measurements', () => {
    const entries = [
      entry('2026-10-16'),
      entry('2026-10-15'),
      entry('2026-09-16'),
      entry('2026-09-15'),
    ];

    expect(getProgressEntriesInWindow(entries, 30, '2026-10-15').map(({ date }) => date)).toEqual([
      '2026-10-15',
      '2026-09-16',
    ]);
    expect(getProgressEntriesInWindow(entries, 0, '2026-10-15')).toEqual(entries);
  });

  it('includes exactly the first and last dates of the 90-day window', () => {
    const entries = [
      entry('2026-10-15'),
      entry('2026-07-18'),
      entry('2026-07-17'),
    ];

    expect(getProgressEntriesInWindow(entries, 90, '2026-10-15').map(({ date }) => date)).toEqual([
      '2026-10-15',
      '2026-07-18',
    ]);
  });

  it('calculates the selected calendar-window mean and excludes future entries', () => {
    const entries = [
      { date: '2026-10-17', value: 999 },
      { date: '2026-10-16', value: 80 },
      { date: '2026-10-10', value: 82 },
      { date: '2026-09-17', value: 90 },
      { date: '2026-09-16', value: 100 },
    ];

    expect(getProgressAverageForWindow(entries, 7, '2026-10-16')).toBe(81);
    expect(getProgressAverageForWindow(entries, 30, '2026-10-16')).toBe(84);
    expect(getProgressAverageForWindow(entries, 90, '2026-10-16')).toBe(88);
    expect(getProgressAverageForWindow(entries, 0, '2026-10-16')).toBe(88);
    expect(getProgressAverageForWindow([], 7, '2026-10-16')).toBeNull();
  });

  it.each([
    { date: '2026-10-16', first: '2026-09-28', last: '2026-11-01', days: 35 },
    { date: '2026-08-16', first: '2026-07-27', last: '2026-09-06', days: 42 },
  ])('builds a Monday-first calendar grid for $date', ({ date, first, last, days }) => {
    const calendarDates = getProgressCalendarDates(date);

    expect(calendarDates).toHaveLength(days);
    expect(calendarDates[0]).toBe(first);
    expect(calendarDates.at(-1)).toBe(last);
  });

  it('filters all measurements belonging to the selected calendar day', () => {
    const entries = [
      { id: 'today-1', date: '2026-10-16' },
      { id: 'yesterday', date: '2026-10-15' },
      { id: 'today-2', date: '2026-10-16' },
    ];

    expect(getProgressEntriesForDate(entries, '2026-10-16').map(({ id }) => id)).toEqual([
      'today-1', 'today-2',
    ]);
  });

  it('accepts decimal commas and rejects empty, invalid, and non-positive values', () => {
    expect(parseWeightInput(' 78,5 ')).toBe(78.5);
    expect(parseWeightInput('.5')).toBe(0.5);
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('78,5,1')).toBeNull();
    expect(parseWeightInput('0')).toBeNull();
    expect(parseWeightInput('-78')).toBeNull();
  });

});