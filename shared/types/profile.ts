// Profile and onboarding types — stub
// Will be populated in M2 (Auth + Onboarding milestone)

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Sex = 'male' | 'female';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
  createdAt: string;
}

export interface OnboardingInput {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}
