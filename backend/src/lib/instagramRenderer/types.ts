export type RenderInput = {
  image: { path: string } | { buffer: Buffer };
  presentation: { focusX: number; focusY: number; zoom: number };
  title: string;
  tags: Array<{ id: string; label: string }>;
  nutritionHighlight: "high-protein" | "low-fat" | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  recipeMeta?: RecipeMeta;
};

export type RecipeMeta = {
  totalTimeMinutes: number;
  portions: number;
  difficulty: string;
};

export type RenderOk = {
  ok: true;
  width: 1080;
  height: 1350;
  format: "png";
  buffer: Buffer;
};

export type RenderError =
  | {
      code: "INVALID_RECIPE_META";
      message: string;
      field: "recipeMeta" | "totalTimeMinutes" | "portions" | "difficulty";
    }
  | {
      code: "RECIPE_META_OVERFLOW";
      message: string;
      measured: { width: number; max: number };
    }
  | { code: "TITLE_OVERFLOW"; message: string; measured: { width: number; max: number } }
  | { code: "TOO_MANY_TAGS"; message: string; count: number; max: 4 }
  | { code: "TAG_ROW_OVERFLOW"; message: string; measured: { width: number; max: number } }
  | { code: "INVALID_ZOOM"; message: string; value: number }
  | { code: "INVALID_FOCUS"; message: string; field: "focusX" | "focusY"; value: number }
  | { code: "IMAGE_UNREADABLE"; message: string; cause?: string }
  | { code: "MISSING_ASSET"; message: string; asset: string }
  | { code: "INTERNAL"; message: string; cause?: string };

export type RenderFail = { ok: false; error: RenderError };

export type RenderResult = RenderOk | RenderFail;