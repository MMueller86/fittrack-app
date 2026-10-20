import { addLocalDays, getLocalIsoDate, isValidDateOnly } from '../../shared/date/localDate';

export type ProgressWindowDays = 7 | 30 | 90 | 0;

export function getProgressEntriesInWindow<T extends { date: string }>(
  entries: T[],
  windowDays: ProgressWindowDays,
  today: string = getLocalIsoDate(),
): T[] {
  if (windowDays === 0) return entries;

  const firstDate = addLocalDays(today, -(windowDays - 1));
  return entries.filter((entry) => entry.date >= firstDate && entry.date <= today);
}

export function getProgressAverageForWindow<T extends { date: string; value: number }>(
  entries: T[],
  windowDays: ProgressWindowDays,
  today: string = getLocalIsoDate(),
): number | null {
  const values = getProgressEntriesInWindow(entries, windowDays, today)
    .filter((entry) => entry.date <= today)
    .map((entry) => entry.value);
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function getProgressCalendarDates(dateInMonth: string): string[] {
  if (!isValidDateOnly(dateInMonth)) {
    throw new RangeError(`Invalid date-only value: ${dateInMonth}`);
  }

  const [year, month] = dateInMonth.split('-').map(Number);
  const firstDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const mondayOffset = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0, 12).getDate();
  const gridDayCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  const gridFirstDate = addLocalDays(firstDate, -mondayOffset);

  return Array.from({ length: gridDayCount }, (_, index) => addLocalDays(gridFirstDate, index));
}

export function getProgressEntriesForDate<T extends { date: string }>(entries: T[], date: string): T[] {
  return entries.filter((entry) => entry.date === date);
}

export function parseWeightInput(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

