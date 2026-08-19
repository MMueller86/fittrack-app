import type {
  WeeklyDayDataStatus,
  WeeklyNutritionDay,
  WeeklyNutritionReviewResponse,
  WeeklyTargetBand,
  WorkoutType,
} from '@fittrack/shared';
import { getWeeklyTargetBand } from '@fittrack/shared';
import { HOME_TRAINING_PRESENTATION } from './homeTrainingPresentation';

const integerFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});
const macroFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 1,
});
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
});

const STATUS_LABELS: Record<Exclude<WeeklyDayDataStatus, 'available'>, string> = {
  missing_nutrition: 'Keine Einträge',
  missing_target: 'Ziel nicht verfügbar',
  missing_nutrition_and_target: 'Keine Daten',
};

export interface WeeklyReviewDayViewModel {
  date: string;
  weekdayLabel: string;
  dateLabel: string;
  consumedCalories: number | null;
  consumedLabel: string | null;
  targetPercent: number | null;
  percentLabel: string | null;
  targetBand: WeeklyTargetBand | null;
  targetLabel: string | null;
  effectiveTargetLabel: string | null;
  baseTargetLabel: string | null;
  activityBonusLabel: string | null;
  activityBonusValueLabel: string | null;
  contextLabel: string | null;
  dayTypeLabel: string | null;
  workoutTypeLabel: string | null;
  activityLabel: string | null;
  markers: WeeklyReviewDayMarker[];
  statusLabel: string | null;
  missingState: Exclude<WeeklyDayDataStatus, 'available'> | null;
  hasTarget: boolean;
  hasNutrition: boolean;
  calorieSummary: WeeklyReviewDayCalorieSummary;
  macroSummary: WeeklyReviewDayMacroSummary;
  overlayDetails: WeeklyReviewDayOverlayDetails;
  accessibilityLabel: string;
}

export interface WeeklyReviewDayCalorieSummary {
  isAvailable: boolean;
  consumedLabel: string | null;
  targetLabel: string | null;
  percentLabel: string | null;
  progressRatio: number | null;
  targetBand: WeeklyTargetBand | null;
  accessibilityLabel: string;
}

export interface WeeklyReviewDayMacroSummary {
  isAvailable: boolean;
  proteinLabel: string | null;
  carbsLabel: string | null;
  fatLabel: string | null;
  accessibilityLabel: string;
}

export interface WeeklyReviewDayOverlayDetails {
  title: string;
  body: string;
  detailGroups: WeeklyReviewDayDetailGroup[];
  calorieSummary: WeeklyReviewDayCalorieSummary;
  macroSummary: WeeklyReviewDayMacroSummary;
}

type KnownTrainingKey = Exclude<keyof typeof HOME_TRAINING_PRESENTATION, 'rest'>;
type KnownTrainingPresentation = (typeof HOME_TRAINING_PRESENTATION)[KnownTrainingKey];

export type WeeklyReviewDayMarker =
  | {
      kind: 'training';
      icon: { lib: 'mci'; name: KnownTrainingPresentation['icon'] };
      label: KnownTrainingPresentation['label'];
    }
  | {
      kind: 'training';
      icon: { lib: 'feather'; name: 'activity' };
      label: 'Training';
    }
  | {
      kind: 'activity';
      icon: { lib: 'mci'; name: 'bike' | 'hiking' };
      label: 'Radtour' | 'Wanderung' | 'Sonderaktivität';
    }
  | {
      kind: 'activity';
      icon: { lib: 'feather'; name: 'info' };
      label: 'Sonderaktivität';
    };

export interface WeeklyReviewDayDetailGroup {
  label: string;
  value: string;
}

export interface WeeklyReviewViewModel {
  periodLabel: string;
  days: WeeklyReviewDayViewModel[];
  chartScaleMaxPercent: number;
  averageConsumedLabel: string | null;
  averageTargetLabel: string | null;
  totalConsumedLabel: string | null;
  totalTargetLabel: string | null;
  overallPercentLabel: string | null;
  overallTargetBand: WeeklyTargetBand | null;
}

function formatInteger(value: number): string {
  return integerFormatter.format(Math.round(value));
}

function formatCalories(value: number): string {
  return `${formatInteger(value)} kcal`;
}

function formatMacro(value: number): string {
  return `${macroFormatter.format(value)} g`;
}

const MISSING_VALUE_LABEL = 'Nicht verfügbar';

function toLocalDate(dateOnly: string): Date | null {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (![year, month, day].every(Number.isInteger)) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateParts(dateOnly: string): { weekdayLabel: string; dateLabel: string } {
  const date = toLocalDate(dateOnly);
  if (!date) return { weekdayLabel: '', dateLabel: dateOnly };

  return {
    weekdayLabel: weekdayFormatter.format(date).replace(/\.$/, ''),
    dateLabel: dateFormatter.format(date),
  };
}

function isWorkoutType(value: unknown): value is WorkoutType {
  return value === 'gym'
    || value === 'bouldering'
    || value === 'running'
    || value === 'cycling'
    || value === 'other';
}

function getWorkoutPresentation(workoutType: unknown): KnownTrainingPresentation | null {
  return isWorkoutType(workoutType) ? HOME_TRAINING_PRESENTATION[workoutType] : null;
}

function getActivityDisplayLabel(day: WeeklyNutritionDay): string | null {
  if (!day.activity) return null;
  if (day.activity.type !== 'hiking' && day.activity.type !== 'cycling') {
    return 'Sonderaktivität';
  }
  const label = day.activity.label.trim();
  if (label) return label;
  return day.activity.type === 'cycling' ? 'Radtour' : 'Wanderung';
}

function getContextLabel(day: WeeklyNutritionDay): string | null {
  const activityLabel = getActivityDisplayLabel(day);
  if (activityLabel) return activityLabel;
  if (day.dayType === 'rest') return 'Ruhetag';
  if (day.dayType === 'training') {
    return getWorkoutPresentation(day.workoutType)?.label ?? 'Training';
  }
  return null;
}

function getDayTypeLabel(day: WeeklyNutritionDay): string | null {
  if (day.dayType === 'rest') return 'Ruhetag';
  if (day.dayType === 'training') return 'Training';
  return null;
}

function getWorkoutTypeLabel(day: WeeklyNutritionDay): string | null {
  return getWorkoutPresentation(day.workoutType)?.label ?? null;
}

function getStatusLabel(day: WeeklyNutritionDay): string | null {
  if (day.dataStatus === 'available') return null;
  return STATUS_LABELS[day.dataStatus];
}

const GENERIC_TRAINING_MARKER: WeeklyReviewDayMarker = {
  kind: 'training',
  icon: { lib: 'feather', name: 'activity' },
  label: 'Training',
};

const SPECIAL_ACTIVITY_FALLBACK_MARKER: WeeklyReviewDayMarker = {
  kind: 'activity',
  icon: { lib: 'feather', name: 'info' },
  label: 'Sonderaktivität',
};

function getActivityMarker(day: WeeklyNutritionDay): WeeklyReviewDayMarker | null {
  if (!day.activity) return null;
  if (day.activity.type === 'cycling') {
    return {
      kind: 'activity',
      icon: { lib: 'mci', name: 'bike' },
      label: 'Radtour',
    };
  }
  if (day.activity.type === 'hiking') {
    return {
      kind: 'activity',
      icon: { lib: 'mci', name: 'hiking' },
      label: 'Wanderung',
    };
  }
  return SPECIAL_ACTIVITY_FALLBACK_MARKER;
}

function getDayMarkers(day: WeeklyNutritionDay): WeeklyReviewDayMarker[] {
  const markers: WeeklyReviewDayMarker[] = [];
  if (day.dayType === 'training') {
    const workoutPresentation = getWorkoutPresentation(day.workoutType);
    markers.push(workoutPresentation
      ? {
          kind: 'training',
          icon: { lib: 'mci', name: workoutPresentation.icon },
          label: workoutPresentation.label,
        }
      : GENERIC_TRAINING_MARKER);
  }
  const activityMarker = getActivityMarker(day);
  if (activityMarker) markers.push(activityMarker);
  return markers;
}

function hasSpecialActivity(day: WeeklyNutritionDay): boolean {
  return day.activity != null || (day.activityBonusCalories != null && day.activityBonusCalories > 0);
}

function getMacroSummary(day: WeeklyNutritionDay): WeeklyReviewDayMacroSummary {
  if (day.consumedMacros == null) {
    return {
      isAvailable: false,
      proteinLabel: null,
      carbsLabel: null,
      fatLabel: null,
      accessibilityLabel: 'Makrodaten nicht verfügbar',
    };
  }

  const proteinLabel = formatMacro(day.consumedMacros.protein);
  const carbsLabel = formatMacro(day.consumedMacros.carbs);
  const fatLabel = formatMacro(day.consumedMacros.fat);

  return {
    isAvailable: true,
    proteinLabel,
    carbsLabel,
    fatLabel,
    accessibilityLabel: `Makros: Eiweiß ${proteinLabel}, Kohlenhydrate ${carbsLabel}, Fett ${fatLabel}`,
  };
}

function formatPositiveCaloriesOrMissing(value: number | null): string {
  return value != null && Number.isFinite(value) && value > 0
    ? formatCalories(value)
    : MISSING_VALUE_LABEL;
}

function formatBonusCaloriesOrMissing(value: number | null): string {
  return value != null && Number.isFinite(value) && value >= 0
    ? formatCalories(value)
    : MISSING_VALUE_LABEL;
}

function getDetailGroups(day: WeeklyNutritionDay): WeeklyReviewDayDetailGroup[] {
  const activityLabel = getActivityDisplayLabel(day);
  const hasTargetContext = hasSpecialActivity(day) || day.dayType === 'training' || day.workoutType != null;
  const activityGroupLabel = hasSpecialActivity(day) ? 'Sonderaktivität' : 'Aktivität';

  if (hasTargetContext) {
    return [
      { label: 'Basisziel', value: formatPositiveCaloriesOrMissing(day.baseTargetCalories) },
      { label: 'Aktivitätsbonus', value: formatBonusCaloriesOrMissing(day.activityBonusCalories) },
      { label: 'Effektives Ziel', value: formatPositiveCaloriesOrMissing(day.effectiveTargetCalories) },
      { label: activityGroupLabel, value: activityLabel ?? MISSING_VALUE_LABEL },
    ];
  }

  return activityLabel ? [{ label: activityGroupLabel, value: activityLabel }] : [];
}

function getCalorieProgressPercent(
  day: WeeklyNutritionDay,
  hasNutrition: boolean,
  hasTarget: boolean,
): number | null {
  if (!hasNutrition || !hasTarget) return null;
  if (day.targetPercent != null && Number.isFinite(day.targetPercent)) return day.targetPercent;
  if (day.consumedCalories == null || day.effectiveTargetCalories == null) return null;
  return (day.consumedCalories / day.effectiveTargetCalories) * 100;
}

export function formatWeeklyReviewDayCalorieSummary(day: WeeklyNutritionDay): WeeklyReviewDayCalorieSummary {
  const hasTarget = day.effectiveTargetCalories != null && day.effectiveTargetCalories > 0;
  const hasNutrition = day.consumedCalories != null && day.hasMealItem;
  const progressPercent = getCalorieProgressPercent(day, hasNutrition, hasTarget);
  const isAvailable = progressPercent != null && Number.isFinite(progressPercent);
  const consumedLabel = hasNutrition ? formatCalories(day.consumedCalories!) : null;
  const targetLabel = hasTarget ? formatCalories(day.effectiveTargetCalories!) : null;
  const percentLabel = isAvailable ? `${formatInteger(progressPercent!)} %` : null;
  const targetBand = isAvailable
    ? day.targetBand ?? getWeeklyTargetBand(progressPercent)
    : null;

  return {
    isAvailable,
    consumedLabel,
    targetLabel,
    percentLabel,
    progressRatio: isAvailable ? Math.min(Math.max(progressPercent! / 100, 0), 1) : null,
    targetBand,
    accessibilityLabel: isAvailable
      ? `Kalorien: ${consumedLabel} von ${targetLabel}, Zielerreichung ${percentLabel}`
      : 'Kalorienvergleich nicht verfügbar',
  };
}

export function formatWeeklyReviewDayOverlay(day: WeeklyNutritionDay): WeeklyReviewDayOverlayDetails {
  const dateParts = formatDateParts(day.date);
  const calorieSummary = formatWeeklyReviewDayCalorieSummary(day);
  const macroSummary = getMacroSummary(day);
  const detailGroups = getDetailGroups(day);

  return {
    title: `${dateParts.weekdayLabel} ${dateParts.dateLabel}`,
    body: '',
    detailGroups,
    calorieSummary,
    macroSummary,
  };
}

function buildAccessibilityLabel(overlayDetails: WeeklyReviewDayOverlayDetails): string {
  const parts = [
    `${overlayDetails.title}.`,
    overlayDetails.calorieSummary.accessibilityLabel,
    overlayDetails.detailGroups.length > 0
      ? overlayDetails.detailGroups.map((group) => `${group.label}: ${group.value}`).join('. ')
      : null,
  ].filter((part): part is string => part != null);
  return parts.join(' ');
}

function toDayViewModel(day: WeeklyNutritionDay): WeeklyReviewDayViewModel {
  const dateParts = formatDateParts(day.date);
  const hasTarget = day.effectiveTargetCalories != null && day.effectiveTargetCalories > 0;
  const hasNutrition = day.consumedCalories != null && day.hasMealItem;
  const hasActivity = hasSpecialActivity(day);
  const targetLabel = hasTarget ? `Ziel ${formatCalories(day.effectiveTargetCalories!)}` : null;
  const effectiveTargetLabel = hasTarget ? formatCalories(day.effectiveTargetCalories!) : null;
  const baseTargetLabel = day.baseTargetCalories != null && day.baseTargetCalories > 0
    ? `Basisziel ${formatCalories(day.baseTargetCalories)}`
    : null;
  const activityBonusValueLabel = hasActivity && day.activityBonusCalories != null
    ? formatCalories(day.activityBonusCalories)
    : null;
  const activityBonusLabel = activityBonusValueLabel
    ? `+${activityBonusValueLabel} Aktivitätsbonus`
    : null;
  const contextLabel = getContextLabel(day);
  const dayTypeLabel = getDayTypeLabel(day);
  const workoutTypeLabel = getWorkoutTypeLabel(day);
  const activityLabel = getActivityDisplayLabel(day);
  const markers = getDayMarkers(day);
  const statusLabel = getStatusLabel(day);
  const targetBand = day.targetBand ?? getWeeklyTargetBand(day.targetPercent);
  const overlayDetails = formatWeeklyReviewDayOverlay(day);

  return {
    date: day.date,
    ...dateParts,
    consumedCalories: day.consumedCalories,
    consumedLabel: hasNutrition ? formatCalories(day.consumedCalories!) : null,
    targetPercent: day.targetPercent,
    percentLabel: hasTarget && day.targetPercent != null ? `${formatInteger(day.targetPercent)} %` : null,
    targetBand,
    targetLabel,
    effectiveTargetLabel,
    baseTargetLabel,
    activityBonusLabel,
    activityBonusValueLabel,
    contextLabel,
    dayTypeLabel,
    workoutTypeLabel,
    activityLabel,
    markers,
    statusLabel,
    hasTarget,
    hasNutrition,
    calorieSummary: overlayDetails.calorieSummary,
    missingState: day.dataStatus === 'available' ? null : day.dataStatus,
    macroSummary: overlayDetails.macroSummary,
    overlayDetails,
    accessibilityLabel: buildAccessibilityLabel(overlayDetails),
  };
}

function getChartScaleMaxPercent(days: readonly WeeklyNutritionDay[]): number {
  const highestPercent = days.reduce(
    (highest, day) => Math.max(highest, day.targetPercent ?? 0),
    100,
  );
  return Math.max(120, Math.ceil(highestPercent / 20) * 20);
}

export function createWeeklyReviewViewModel(
  review: WeeklyNutritionReviewResponse,
): WeeklyReviewViewModel {
  const days = review.days.map(toDayViewModel);
  const { totals } = review;
  const periodStart = formatDateParts(review.periodStart).dateLabel;
  const periodEnd = formatDateParts(review.periodEnd).dateLabel;
  const overallTargetBand = getWeeklyTargetBand(totals.overallTargetPercent);

  return {
    periodLabel: `${periodStart} - ${periodEnd}`,
    days,
    chartScaleMaxPercent: getChartScaleMaxPercent(review.days),
    averageConsumedLabel: totals.averageConsumedCalories != null
      ? formatCalories(totals.averageConsumedCalories)
      : null,
    averageTargetLabel: totals.averageTargetCalories != null
      ? formatCalories(totals.averageTargetCalories)
      : null,
    totalConsumedLabel: totals.totalConsumedCalories != null
      ? formatCalories(totals.totalConsumedCalories)
      : null,
    totalTargetLabel: totals.totalTargetCalories != null
      ? formatCalories(totals.totalTargetCalories)
      : null,
    overallPercentLabel: totals.overallTargetPercent != null
      ? `${formatInteger(totals.overallTargetPercent)} %`
      : null,
    overallTargetBand,
  };
}