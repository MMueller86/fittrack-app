// Nutrition target types — stub
// Will be populated in M2 (Nutrition Targets milestone)

export interface MacroTargets {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

export interface NutritionProfile {
  id: string;
  userId: string;
  targets: MacroTargets;
  calculationInput: object; // OnboardingInput snapshot
  savedAt: string;
}

export interface MacroSummary {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}
