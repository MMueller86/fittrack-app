// FoodCategory — optional food categorization for MealItem and ReusableItem.
//
// Used by the Hint Engine to detect variety, fruit/vegetable presence, etc.
// Designed for forward-compatibility: AI Coach, Weekly Review, Progress Intelligence.
//
// Values match PNNS pnns_groups_2 strings from Open Food Facts (1:1, no translation).
// Products without a pnns_groups_2 value leave category undefined.

export type FoodCategory =
  | 'Fruits'
  | 'Vegetables'
  | 'Dried fruits'
  | 'Soups'
  | 'Cereals'
  | 'Bread'
  | 'Potatoes'
  | 'Legumes'
  | 'Breakfast cereals'
  | 'Meat'
  | 'Processed meat'
  | 'Fish and seafood'
  | 'Eggs'
  | 'Offals'
  | 'Milk and yogurt'
  | 'Cheese'
  | 'Ice cream'
  | 'Dairy desserts'
  | 'Sweets'
  | 'Chocolate products'
  | 'Biscuits and cakes'
  | 'Pastries'
  | 'Salty and fatty products'
  | 'Nuts'
  | 'Appetizers'
  | 'Dressings and sauces'
  | 'Fats'
  | 'One-dish meals'
  | 'Pizza pies and quiches'
  | 'Sandwiches'
  | 'Sweetened beverages'
  | 'Unsweetened beverages'
  | 'Artificially sweetened beverages'
  | 'Waters and flavored waters'
  | 'Fruit juices'
  | 'Fruit nectars'
  | 'Plant-based milk substitutes'
  | 'Teas and herbal teas and coffees'
  | 'Alcoholic beverages'
  | 'Baby foods'
  | 'Baby milks';
