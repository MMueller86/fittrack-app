export function getLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface LocalDateContext {
  currentLocalDate: string;
  currentHour: number | null;
}

export function getLocalHour(date: Date = new Date()): number | null {
  const hour = date.getHours();
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

export function getLocalDateContext(date: Date = new Date()): LocalDateContext {
  return {
    currentLocalDate: getLocalIsoDate(date),
    currentHour: getLocalHour(date),
  };
}

export function getLocalTimezoneOffsetMinutes(date: Date = new Date()): number | null {
  const offsetMinutes = -date.getTimezoneOffset();
  return Number.isInteger(offsetMinutes) && offsetMinutes >= -840 && offsetMinutes <= 840
    ? offsetMinutes
    : null;
}

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function dateOnlyToDay(dateOnly: string): number {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / 86_400_000);
}

export function differenceInLocalDays(laterDate: string, earlierDate: string): number {
  if (!isValidDateOnly(laterDate) || !isValidDateOnly(earlierDate)) {
    throw new RangeError(`Invalid date-only value: ${laterDate} or ${earlierDate}`);
  }
  return dateOnlyToDay(laterDate) - dateOnlyToDay(earlierDate);
}

export function addLocalDays(dateOnly: string, days: number): string {
  if (!isValidDateOnly(dateOnly)) {
    throw new RangeError(`Invalid date-only value: ${dateOnly}`);
  }
  if (!Number.isInteger(days)) {
    throw new RangeError(`Date-only day offset must be an integer: ${days}`);
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}