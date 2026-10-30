export interface FramePreset {
  aspectRatio: number;
  /** Longest edge in px of the cropped output; omitted when the original is kept. */
  maxEdge?: number;
}

/** Every photo capture uses one of these frames; new camera features add a preset here. */
export const FRAME_PRESETS = {
  recipeHero: { aspectRatio: 1080 / 1015 },
  nutritionLabel: { aspectRatio: 3 / 4, maxEdge: 2000 },
  mealPhoto: { aspectRatio: 4 / 3, maxEdge: 1600 },
} as const satisfies Record<string, FramePreset>;

export type FramePresetId = keyof typeof FRAME_PRESETS;

export const CROPPED_PHOTO_JPEG_QUALITY = 0.85;
