// Recipe types

export * from './recipeImageHeroCrop';
export * from './recipeExport';
import type { RecipeImageHeroCrop } from './recipeImageHeroCrop';
import { RECIPE_EXPORT_VIEW_VERSION, type RecipeExportViewVersion } from './recipeExport';

// ---------------------------------------------------------------------------
// Nutrition (aligned with nutritionCalculator.ts — no G suffix)
// ---------------------------------------------------------------------------

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

// ---------------------------------------------------------------------------
// Export view
// ---------------------------------------------------------------------------

export interface RecipeExportStep {
  order: number;
  description: string;
}

export type RecipeExportViewAction = 'confirm';
export type RecipeExportDifficulty = string;

/** Client-owned export fields; sourceFingerprint is never accepted as input. */
export interface RecipeExportViewInput {
  version: RecipeExportViewVersion;
  teaser: string;
  totalTimeMinutes: number;
  difficulty: RecipeExportDifficulty;
  steps: RecipeExportStep[];
  includedIngredientIds: string[];
}

/** Unconfirmed request-only export data accepted for a single share render. */
export interface RecipeShareBundleExportDraft {
  version: RecipeExportViewVersion;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: RecipeExportDifficulty | null;
  steps: RecipeExportStep[];
  includedIngredientIds: string[];
}

/** Confirmation fields in the request body; If-Match is an optional HTTP precondition. */
export interface RecipeExportViewRequest {
  exportView: RecipeExportViewInput;
  exportViewAction: RecipeExportViewAction;
}

/** Persisted export data with its server-owned source fingerprint. */
export interface RecipeExportViewPersistence extends RecipeExportViewInput {
  sourceFingerprint: string;
}

/** Existing name retained for consumers of the persisted export snapshot. */
export type RecipeExportView = RecipeExportViewPersistence;

/** Shared API shape for an analysis/preparation suggestion. */
export interface RecipeExportSuggestion {
  version: RecipeExportViewVersion;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: RecipeExportDifficulty | null;
  steps: RecipeExportStep[];
  includedIngredientKeys: string[];
  sourceFingerprint: string;
}

export interface PrepareRecipeExportViewRequestV2 {
  contractVersion: 2;
}

export interface PrepareRecipeExportViewSuggestionV2 {
  version: RecipeExportViewVersion;
  teaser: string;
  totalTimeMinutes: number | null;
  difficulty: RecipeExportDifficulty | null;
  steps: RecipeExportStep[];
}

export interface PrepareRecipeExportViewResponseV2 {
  contractVersion: 2;
  recipeId: string;
  sourceEtag: string;
  suggestion: PrepareRecipeExportViewSuggestionV2;
}

export type RecipeExportViewStatus = 'missing' | 'current' | 'stale';

/** Optional export fields and derived status on a Recipe response. */
export interface RecipeExportViewResponse {
  exportView?: RecipeExportViewPersistence;
  exportViewStatus?: RecipeExportViewStatus;
}

// ---------------------------------------------------------------------------
// Ingredient
// ---------------------------------------------------------------------------

export type RecipeIngredientInputMode = 'grams' | 'portion';
export type RecipeIngredientCategory = 'food' | 'seasoning';

export interface RecipeIngredient {
  id: string;
  /** Human-readable name (may include brand/product qualifier) */
  displayName: string;
  inputMode: RecipeIngredientInputMode;
  /** Amount as entered by the user (grams or portions); null when indeterminate */
  inputAmount: number | null;
  /** Resolved gram weight for nutrition calculation; null means indeterminate */
  amountGrams: number | null;
  /** Display unit label (e.g. "g", "Scheibe", "Portion") */
  unit: string;
  /** Optional persistent display label for a seasoning (e.g. "1 TL") */
  amountLabel?: string;
  /** Link to food catalog product (null if custom/AI) */
  linkedProductId: string | null;
  /** Link to user's reusable item library (null if catalog/AI) */
  linkedReusableItemId: string | null;
  /** True when nutrition was estimated by AI */
  isAiEstimate: boolean;
  /** AI-assigned classification; omitted on legacy documents and treated as food */
  category?: RecipeIngredientCategory;
  /** Gram weight of one portion — present when the source product has portion info */
  portionWeightGrams?: number;
  /** Display label for the portion (e.g. "Portion", "Scheibe") */
  portionLabel?: string;
  /** Nutrition per 100g — used to recalculate on edit */
  nutritionPer100g: RecipeNutrition;
  /** Pre-calculated contribution of this ingredient to the total recipe */
  nutritionContribution: RecipeNutrition;
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export interface RecipeStep {
  /** 1-based ordering index */
  order: number;
  title?: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface RecipeImage {
  id: string;
  /** Blob path: {userId}/{recipeId}/{imageId}.{ext} — stored in Cosmos */
  blobName: string;
  /** 1-based display order */
  order: number;
  heroCrop?: RecipeImageHeroCrop;
  /**
   * Transient read-only SAS URL (1h TTL).
   * Generated by backend on GET /recipes/:id — never persisted in Cosmos.
   */
  url?: string;
}

// ---------------------------------------------------------------------------
// Recipe
// ---------------------------------------------------------------------------

export type RecipeVisibility = 'private';

export interface Recipe extends RecipeExportViewResponse {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string;
  /** Number of portions this recipe yields */
  portions: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  images: RecipeImage[];
  /** Aggregate nutrition for the full recipe */
  nutritionTotal: RecipeNutrition;
  /** Nutrition per single portion (= nutritionTotal / portions) */
  nutritionPerPortion: RecipeNutrition;
  /** Always 'private' for now — architecture ready for future sharing */
  visibility: RecipeVisibility;
  /** Future sharing — user IDs explicitly granted access */
  sharedWithUserIds: string[];
  tags: string[];
  /** ISO timestamp of last diary log — used for "Zuletzt verwendet" sorting */
  lastUsedAt?: string;
  /** Total number of times this recipe was logged into the diary */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}
