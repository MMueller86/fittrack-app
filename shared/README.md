# shared/

Shared TypeScript types and DTOs used by both `backend/` and `mobile/`.

## Usage

Referenced via `tsconfig` path aliases — **no build step required**.

In `backend/tsconfig.json` and `mobile/tsconfig.json`:
```json
"paths": {
  "@fittrack/shared": ["../shared/index.ts"],
  "@fittrack/shared/*": ["../shared/*"]
}
```

Then import as:
```typescript
import { UserProfile, MacroTargets } from '@fittrack/shared';
```

## Files

| File | Purpose |
|---|---|
| `types/auth.ts` | Token response types, JWT payload |
| `types/profile.ts` | UserProfile, OnboardingInput, ActivityLevel |
| `types/nutrition.ts` | MacroTargets, NutritionProfile, MacroSummary |
| `types/diary.ts` | Meal, MealItem, MealItemSourceType |
| `types/recipes.ts` | Recipe, RecipeIngredient, PerPortionNutrition |
| `types/weights.ts` | WeightEntry |

## Rules

- Types only — no runtime logic, no dependencies
- All types are stubs until their milestone is implemented
- Do not add implementation code here
