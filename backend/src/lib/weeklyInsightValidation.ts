export interface WeeklyInsightValidationResult {
  valid: boolean;
  reason?: string;
}

const EXCEEDANCE_TERMS = [
  'überschritten',
  'überschreitung',
  'über dem ziel',
  'über deinem ziel',
  'über deinen bedarf',
  'über dein ziel',
];

/**
 * Rejects exceedance language when no day exceeded its effective target.
 * Mixed periods remain valid because an exceedance claim may refer to a real
 * exceedance day.
 */
export function validateWeeklyInsightExceedanceClaims(
  text: string,
  days: Array<{ targetPercent: number | null }>,
): WeeklyInsightValidationResult {
  const hasAnyExceededDay = days.some(
    (day) => day.targetPercent !== null && day.targetPercent > 100,
  );

  if (hasAnyExceededDay) return { valid: true };

  const lowerText = text.toLocaleLowerCase('de-DE');
  if (EXCEEDANCE_TERMS.some((term) => lowerText.includes(term))) {
    return {
      valid: false,
      reason: 'Exceedance language detected but no day exceeded effective target',
    };
  }

  return { valid: true };
}