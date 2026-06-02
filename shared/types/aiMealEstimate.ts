// AI Meal Estimate — types for POST /api/ai/meal-estimate/preview
//
// This endpoint provides a two-level estimation model:
//   Level 1 (Fast Path):  overall meal nutrition estimate returned immediately
//   Level 2 (Precision):  user can optionally open the component-level refinement workflow
//
// The optional photo fields are present from v1. When no photo is supplied,
// imageUri / imageMimeType are omitted and photoUsed will be false in the response.

import type { NutritionValues } from './diary';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** Input for POST /api/ai/meal-estimate/preview */
export interface AiMealEstimateRequest {
  /** Free-text meal description (1–500 chars). Contextual hints like "in der Kantine" are extracted automatically. */
  text: string;
  /**
   * Optional meal photo as base64-encoded string.
   * When provided, the AI uses the image to improve portion size and component detection.
   * The photo is never persisted — it is only used during this single API call.
   */
  imageBase64?: string;
  /** MIME type of the image; required when imageBase64 is set */
  imageMimeType?: 'image/jpeg' | 'image/png';
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

/**
 * Overall meal nutrition estimate returned by the AI.
 * Values represent the complete meal as described — NOT per 100g.
 */
export interface AiMealEstimatePreview {
  /** Normalised German name for the meal (e.g. "Schnitzel mit Pommes und Mayo") */
  mealName: string;
  /** Estimated total macros for the complete meal portion */
  mealEstimate: NutritionValues;
  /** Recognised sub-components, e.g. ["Schnitzel", "Pommes", "Mayo"] */
  components: string[];
  /**
   * Contextual hint extracted from the user's text, e.g. "Imbiss", "Kantine", "Restaurant".
   * Null when no context was detected — standard home/restaurant portions are used in that case.
   */
  contextDetected: string | null;
  /** Confidence level for the portion size estimate */
  portionConfidence: 'high' | 'medium' | 'low';
  /** True when a photo was supplied and used to improve the estimate */
  photoUsed: boolean;
  /**
   * Plain-language statements describing the assumptions the AI made.
   * Shown to the user only in the "KI-Annahmen" section; not required for MVP display.
   * Example: "Große Imbiss-Portion angenommen (ca. 550g)"
   */
  assumptions: string[];
  /** Warnings about uncertainty, ambiguous input, or potential inaccuracies */
  warnings: string[];
}
