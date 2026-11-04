// AI Meal Estimate — types for POST /api/ai/meal-estimate/preview
//
// This endpoint provides a two-level estimation model:
//   Level 1 (Fast Path):  overall meal nutrition estimate returned immediately
//   Level 2 (Precision):  user can optionally open the component-level refinement workflow
//
// Request photos are transient. V3 response photo-assessment fields are optional
// at read time so consumers can continue to read V1 responses.

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface AiMealEstimateComponent {
  name: string;
  estimatedGrams: number;
  calories: number;
}

export interface AiMealEstimateNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type AiMealEstimateRefineHint = 'larger' | 'smaller';

export interface AiMealEstimateRefine {
  previous: {
    mealName: string;
    estimatedTotalGrams: number;
    mealEstimate: AiMealEstimateNutrition;
    componentItems: AiMealEstimateComponent[];
  };
  hints?: AiMealEstimateRefineHint[];
  note?: string;
}

/** Input for POST /api/ai/meal-estimate/preview */
export interface AiMealEstimateRequest {
  /** Free-text meal description (1–500 chars). Contextual hints like "in der Kantine" are extracted automatically. */
  text: string;
  /**
   * Optional meal photo as base64-encoded string.
    * The submitted image is assessed transiently and contributes to nutrition estimation only
    * when server-validated routing includes it. In the response, photoProvided indicates
    * submission; photoUsed is authoritative for whether the image contributed to nutrition.
   */
  imageBase64?: string;
  /** MIME type of the image; required when imageBase64 is set */
  imageMimeType?: 'image/jpeg' | 'image/png';
  refine?: AiMealEstimateRefine;
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
  mealEstimate: AiMealEstimateNutrition;
  /** Recognised sub-components in componentItems order. */
  components: string[];
  /** V2 structured component estimate; absent on legacy V1 responses. */
  componentItems?: AiMealEstimateComponent[];
  /** V2 total meal weight in grams; absent on legacy V1 responses. */
  estimatedTotalGrams?: number;
  /** V2 prompt version; absent on legacy V1 responses. */
  promptVersion?: string;
  /** V3: true when an image was supplied and inspected; absent on V1 responses. */
  photoProvided?: boolean;
  /** V3: server-validated relationship classification; absent on V1 responses. */
  photoAssessment?: 'consistent' | 'complementary' | 'contradictory' | 'uncertain' | 'no_photo';
  /** V3: server-derived source routing; absent on V1 responses. */
  photoUse?: 'included' | 'excluded_mismatch' | 'excluded_uncertain' | 'no_photo';
  /**
   * Contextual hint extracted from the user's text, e.g. "Imbiss", "Kantine", "Restaurant".
   * Null when no context was detected — standard home/restaurant portions are used in that case.
   */
  contextDetected: string | null;
  /** Confidence level for the portion size estimate */
  portionConfidence: 'high' | 'medium' | 'low';
  /** True only when the photo contributed to the nutrition estimate. */
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
