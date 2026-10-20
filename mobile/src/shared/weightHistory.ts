import type { WeightEntry } from '@fittrack/shared';
import { addLocalDays, getLocalIsoDate } from './date/localDate';

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function getMondayOf(iso: string): string {
  const day = parseDate(iso).getDay();
  return addLocalDays(iso, day === 0 ? -6 : 1 - day);
}

function formatDateRange(first: string, last: string): string {
  const formatDate = (iso: string) => {
    const date = parseDate(iso);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
  };
  return `${formatDate(first)} – ${formatDate(last)}`;
}

export function buildLast7DaysItems<T extends { entry: WeightEntry }>(
  allItems: T[],
  today: string = getLocalIsoDate(),
): T[] {
  const cutoff = addLocalDays(today, -6);
  return allItems.filter((item) => item.entry.date >= cutoff && item.entry.date <= today);
}

export function buildCompletedWeekGroups<T extends { entry: WeightEntry }>(
  allItems: T[],
  today: string = getLocalIsoDate(),
): { key: string; label: string; avgValue: number; count: number; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of allItems) {
    const monday = getMondayOf(item.entry.date);
    if (addLocalDays(monday, 6) < today) {
      const items = groups.get(monday) ?? [];
      items.push(item);
      groups.set(monday, items);
    }
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => ({
      key,
      label: formatDateRange(key, addLocalDays(key, 6)),
      avgValue: items.reduce((sum, item) => sum + item.entry.value, 0) / items.length,
      count: items.length,
      items,
    }));
}

export function getWeightWeekComparison(entries: WeightEntry[], today: string = getLocalIsoDate()) {
  const allItems = entries.map((entry) => ({ entry }));
  const last7Items = buildLast7DaysItems(allItems, today);
  const groups = buildCompletedWeekGroups(allItems, today);
  const previousMonday = addLocalDays(getMondayOf(today), -7);
  const previousGroup = groups.find((group) => group.key === previousMonday);
  const recent = {
    label: formatDateRange(addLocalDays(today, -6), today),
    average: last7Items.length > 0
      ? last7Items.reduce((sum, item) => sum + item.entry.value, 0) / last7Items.length
      : null,
    count: last7Items.length,
  };
  const previous = {
    label: formatDateRange(previousMonday, addLocalDays(previousMonday, 6)),
    average: previousGroup?.avgValue ?? null,
    count: previousGroup?.count ?? 0,
  };
  return {
    recent,
    previous,
    delta: recent.average !== null && previous.average !== null ? recent.average - previous.average : null,
  };
}