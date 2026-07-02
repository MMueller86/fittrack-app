// FoodCategory — optional food categorization for MealItem and ReusableItem.
//
// Used by the Hint Engine to detect variety, fruit/vegetable presence, etc.
// Designed for forward-compatibility: AI Coach, Weekly Review, Progress Intelligence.
//
// V1 scope: type definition + optional fields only. No UI input, no OFF-mapping yet.

export type FoodCategory =
  | 'fruit'
  | 'vegetable'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'grain'
  | 'legume'
  | 'nut'
  | 'oil'
  | 'beverage'
  | 'sweet'
  | 'snack';
