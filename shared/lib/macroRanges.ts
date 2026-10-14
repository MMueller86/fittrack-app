import type { MacroRange, MacroRanges, ProteinCoachingBand } from '../types/nutrition';

export const PROTEIN_MIN_G_PER_KG = 1.5;
export const PROTEIN_MAX_G_PER_KG = 2.0;
export const PROTEIN_COACHING_THRESHOLD_G_PER_KG = 2.2;

export function isWithinMacroRange(
  valueG: number,
  range: MacroRange | null | undefined,
): boolean {
  return Number.isFinite(valueG)
    && range != null
    && Number.isFinite(range.minG)
    && Number.isFinite(range.maxG)
    && range.minG <= range.maxG
    && valueG >= range.minG
    && valueG <= range.maxG;
}

export function classifyProteinCoachingBand(
  proteinG: number | null | undefined,
  weightKg: number | null | undefined,
  range: MacroRange | null | undefined,
): ProteinCoachingBand {
  if (
    proteinG == null
    || !Number.isFinite(proteinG)
    || proteinG < 0
    || range == null
    || !Number.isFinite(range.minG)
    || !Number.isFinite(range.maxG)
    || range.minG > range.maxG
  ) {
    return 'unknown';
  }

  if (weightKg != null && Number.isFinite(weightKg) && weightKg > 0) {
    const gramsPerKg = proteinG / weightKg;
    if (gramsPerKg < PROTEIN_MIN_G_PER_KG) return 'below_range';
    if (gramsPerKg <= PROTEIN_MAX_G_PER_KG) return 'in_range';
    if (gramsPerKg <= PROTEIN_COACHING_THRESHOLD_G_PER_KG) return 'above_range';
    return 'above_coaching_threshold';
  }

  if (proteinG < range.minG) return 'below_range';
  if (proteinG <= range.maxG) return 'in_range';
  return 'above_range';
}

/** Calculate profile-day protein and carbohydrate ranges from its own targets. */
export function calculateMacroRanges(
  weightKg: number,
  calories: number,
  fatG: number,
): MacroRanges {
  const proteinMinG = Math.round(PROTEIN_MIN_G_PER_KG * weightKg);
  const proteinMaxG = Math.round(PROTEIN_MAX_G_PER_KG * weightKg);
  const carbsMinG = Math.max(
    0,
    Math.round((calories - 4 * proteinMaxG - 9 * fatG) / 4),
  );
  const carbsMaxG = Math.max(
    0,
    Math.round((calories - 4 * proteinMinG - 9 * fatG) / 4),
  );

  return {
    proteinG: { minG: proteinMinG, maxG: proteinMaxG },
    carbsG: { minG: carbsMinG, maxG: carbsMaxG },
  };
}