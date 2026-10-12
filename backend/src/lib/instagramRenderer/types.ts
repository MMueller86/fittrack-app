import type { RecipeImageHeroCrop } from "@fittrack/shared";

export type RenderPresentation = Pick<RecipeImageHeroCrop, "focusX" | "focusY" | "zoom">;

export type RenderInput = {
  image: { path: string } | { buffer: Buffer };
  presentation: RenderPresentation;
  title: string;
  tags: Array<{ id: string; label: string }>;
  nutritionHighlight: "high-protein" | "low-fat" | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  recipeMeta?: RecipeMeta;
};

export type RecipeMeta = {
  totalTimeMinutes: number | null;
  portions: number;
  difficulty: string | null;
};

export type RecipeDetailsTemplateInput = {
  image: { path: string } | { buffer: Buffer };
  presentation: RenderPresentation;
  description?: string;
  highlight?: "high-protein" | "low-fat";
  title: string;
  totalTimeMinutes: number | null;
  difficulty?: string | null;
  portions: number;
  ingredients: Array<{ amount: string; name: string }>;
  steps: Array<string>;
};

export type RecipeDetailsTemplateField =
  | "title"
  | "description"
  | "totalTimeMinutes"
  | "difficulty"
  | "portions"
  | "ingredients"
  | "steps";

export type RecipeDetailsTemplateItemField = "amount" | "name" | "text";

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

export type RecipeDetailsTemplateRenderError =
  | {
      code: "INVALID_TEMPLATE_INPUT";
      message: string;
      field: RecipeDetailsTemplateField;
      itemIndex?: number;
      itemField?: RecipeDetailsTemplateItemField;
      itemValue?: string;
    }
  | {
      code: "TEMPLATE_FIELD_OVERFLOW";
      message: string;
      field: RecipeDetailsTemplateField;
      itemIndex?: number;
      itemField?: RecipeDetailsTemplateItemField;
      measured: {
        width: number;
        height: number;
        maxWidth?: number;
        maxHeight?: number;
      };
    }
  | {
      code: "TEMPLATE_PROBE_FAILED";
      message: string;
      field: RecipeDetailsTemplateField;
      itemIndex?: number;
      itemField?: RecipeDetailsTemplateItemField;
    }
  | { code: "MISSING_ASSET"; message: string; asset: string }
  | { code: "INTERNAL"; message: string; cause?: string };

export type RecipeDetailsTemplateRenderResult =
  | RenderOk
  | { ok: false; error: RecipeDetailsTemplateRenderError };

export type RecipeDetailsGeneratedTextProbeInput = {
  savedTitle: string;
  teaser: string;
  steps: string[];
};

export type RecipeDetailsGeneratedTextProbeField = "title" | "teaser" | "steps";

export type RecipeDetailsGeneratedTextProbeTechnicalCode =
  | "INVALID_CONTEXT"
  | "MISSING_ASSET"
  | "FONT_OR_SATORI_FAILED"
  | "MISSING_MEASUREMENT"
  | "NON_FINITE_MEASUREMENT"
  | "TITLE_LAYOUT_FAILED"
  | "PROBE_FAILED";

export type RecipeDetailsGeneratedTextProbeDiagnostic = {
  field: RecipeDetailsGeneratedTextProbeField;
  itemIndex?: number;
} & (
  | {
      status: "fits" | "overflow";
      measured: { width: number; height: number; maxWidth: number; maxHeight: number };
      fontSize: number;
      displayText: string;
    }
  | {
      status: "width-overflow";
      measured: { width: number; maxWidth: number };
      fontSize: number;
    }
  | { status: "invalid-text"; code: "INVALID_TEXT" | "INVALID_STEP_COUNT" }
  | { status: "technical-failure"; code: RecipeDetailsGeneratedTextProbeTechnicalCode }
);

export type RecipeDetailsGeneratedTextProbeResult = {
  diagnostics: RecipeDetailsGeneratedTextProbeDiagnostic[];
  teaserFontSize?: number;
} & (
  | { ok: true; status: "success" }
  | { ok: false; status: "generated-text-failure" }
  | {
      ok: false;
      status: "technical-failure";
      error: { code: RecipeDetailsGeneratedTextProbeTechnicalCode; message: string; asset?: string };
    }
);