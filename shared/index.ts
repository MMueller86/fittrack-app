// Shared TypeScript types and DTOs for FitTrack.
// Referenced by both mobile/ and backend/ via tsconfig path aliases.
// No build step required — imported directly as TypeScript source.

export * from './types/auth';
export * from './types/profile';
export * from './types/nutrition';
export * from './types/diary';
export * from './types/aiMealEstimate';
export * from './types/recipes';
export * from './types/weights';
export * from './types/foodProduct';
export * from './types/quota';
export * from './types/insight';
export * from './lib/nutritionCalculator';
export * from './lib/recipeCalculator';
export * from './lib/profileCalculator';
export * from './lib/goalContext';
export * from './lib/plateauDetector';
export * from './types/foodCategory';
export * from './types/hint';
export * from './types/userFoodRelation';
