import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Font, SatoriNode } from "satori";

import { compose } from "./compose";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  RECIPE_META_ROW_WIDTH,
  TAG_CHIP_GAP,
  TAG_ROW_MAX_COUNT,
  TAG_ROW_MAX_WIDTH,
  TITLE_MAX_WIDTH,
} from "./layout";
import type { PhotoAsset } from "./photo";
import {
  composeRecipeDetailsTemplate,
  getRecipeDetailsTitleLayout,
  RECIPE_DETAILS_TEMPLATE_CHIP_TOP,
  RECIPE_DETAILS_TEMPLATE_DESCRIPTION_GAP,
  RECIPE_DETAILS_TEMPLATE_DESCRIPTION_TEXT_WIDTH,
  RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_ROW_HEIGHT,
  RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_TEXT_WIDTH,
  RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_ROW_HEIGHT,
  RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_TEXT_WIDTH,
  RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX,
  RECIPE_DETAILS_TEMPLATE_MAX_INGREDIENTS,
  RECIPE_DETAILS_TEMPLATE_MAX_STEPS,
  RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_ROW_HEIGHT,
  RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_TEXT_WIDTH,
  RECIPE_DETAILS_TEMPLATE_STEP_LARGE_ROW_HEIGHT,
  RECIPE_DETAILS_TEMPLATE_STEP_LARGE_TEXT_WIDTH,
  RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX,
  RECIPE_DETAILS_TEMPLATE_TITLE_NODE,
  RECIPE_DETAILS_TEMPLATE_TITLE_TOP,
  RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH,
  RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE,
  getRecipeDetailsTextLayoutFields,
  type RecipeDetailsTemplateTextOverrides,
} from "./recipeDetailsTemplateV3";
import { addMeasuredGermanBreaks, measureDetailTextWidths } from "./detailTextLayout";
import { loadRecipeMetaIcons, RecipeMetaIconAssetError } from "./recipeMeta";
import { TagIconAssetError } from "./tagIcons";
import type {
  RecipeDetailsTemplateInput,
  RecipeDetailsTemplateField,
  RecipeDetailsTemplateItemField,
  RecipeDetailsTemplateRenderResult,
  RenderInput,
  RenderResult,
} from "./types";

type SatoriRenderer = typeof import("satori").default;
type ResvgConstructor = typeof import("@resvg/resvg-js").Resvg;
type SharpFactory = typeof import("sharp");

type RuntimeDependencies = {
  satori: SatoriRenderer;
  Resvg: ResvgConstructor;
  sharp: SharpFactory;
};

type RendererAssets = {
  fonts: Font[];
  nutritionHighlights: Record<"high-protein" | "low-fat", string>;
  recipeMetaIcons: Awaited<ReturnType<typeof loadRecipeMetaIcons>>;
  barbell: string;
  wordmark: string;
  wordmarkMimeType: "image/png" | "image/svg+xml";
};

class MissingRendererAssetError extends Error {
  readonly asset: string;

  constructor(asset: string, cause?: unknown) {
    super(`Unable to load renderer asset: ${asset}${cause ? ` (${errorMessage(cause)})` : ""}`);
    this.name = "MissingRendererAssetError";
    this.asset = asset;
  }
}

class UnreadableImageError extends Error {
  constructor(cause: unknown) {
    super(`Unable to read input image: ${errorMessage(cause)}`);
    this.name = "UnreadableImageError";
  }
}

const ASSET_ROOT_RELATIVE = "src/lib/instagramRenderer/assets";
const FONT_FILES = {
  medium: "fonts/Inter-Medium.ttf",
  mediumItalic: "fonts/Inter-MediumItalic.ttf",
  semiBold: "fonts/Inter-SemiBold.ttf",
  displayBold: "fonts/InterDisplay-Bold.ttf",
} as const;
const DESIGN_ASSET_FILES = {
  barbell: "nutrition/barbell-header-frame.svg",
  wordmark: "branding/micha-logo-writing.svg",
  legacyWordmark: "branding/fittrack-wordmark.png",
  highProtein: "nutrition-highlights/high-protein.png",
  lowFat: "nutrition-highlights/low-fat.png",
} as const;

let runtimeDependenciesPromise: Promise<RuntimeDependencies> | undefined;
let rendererAssetsPromise: Promise<RendererAssets> | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toInternalError(error: unknown): RenderResult {
  return {
    ok: false,
    error: {
      code: "INTERNAL",
      message: "Instagram recipe rendering failed.",
      cause: errorMessage(error),
    },
  };
}

function toMissingAssetError(
  error: MissingRendererAssetError | TagIconAssetError | RecipeMetaIconAssetError,
): RenderResult {
  return {
    ok: false,
    error: {
      code: "MISSING_ASSET",
      message: error.message,
      asset: error.asset,
    },
  };
}

function toImageError(error: UnreadableImageError): RenderResult {
  return {
    ok: false,
    error: {
      code: "IMAGE_UNREADABLE",
      message: error.message,
      cause: error.message,
    },
  };
}

async function loadRuntimeDependencies(): Promise<RuntimeDependencies> {
  const [satoriModule, resvgModule, sharpModule] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
    import("sharp"),
  ]);

  return {
    satori: satoriModule.default,
    Resvg: resvgModule.Resvg,
    sharp: (sharpModule.default ?? sharpModule) as SharpFactory,
  };
}

function getRuntimeDependencies(): Promise<RuntimeDependencies> {
  runtimeDependenciesPromise ??= loadRuntimeDependencies();
  return runtimeDependenciesPromise;
}

function findAssetRoot(): string {
  const candidates = [
    resolve(__dirname, "assets"),
    resolve(__dirname, "../../../../../src/lib/instagramRenderer/assets"),
    resolve(process.cwd(), ASSET_ROOT_RELATIVE),
    resolve(process.cwd(), "backend", ASSET_ROOT_RELATIVE),
  ];
  const assetRoot = candidates.find((candidate) =>
    existsSync(join(candidate, FONT_FILES.medium)),
  );

  if (!assetRoot) {
    throw new MissingRendererAssetError(ASSET_ROOT_RELATIVE);
  }

  return assetRoot;
}

async function readAsset(assetRoot: string, relativePath: string): Promise<Buffer> {
  const asset = join(assetRoot, relativePath);
  try {
    return await readFile(asset);
  } catch (error) {
    throw new MissingRendererAssetError(relativePath, error);
  }
}

async function normalizeWordmarkBackground(sharp: SharpFactory, input: Buffer): Promise<Buffer> {
  const background = [3, 6, 4];
  const image = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const difference = Math.max(
      Math.abs(image.data[offset] - background[0]),
      Math.abs(image.data[offset + 1] - background[1]),
      Math.abs(image.data[offset + 2] - background[2]),
    );
    const alpha = Math.min(255, Math.max(0, (difference - 1) * 64));
    if (alpha === 0) {
      image.data[offset + 3] = 0;
      continue;
    }

    const opacity = alpha / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      image.data[offset + channel] = Math.round(
        Math.min(255, Math.max(0, (image.data[offset + channel] - background[channel] * (1 - opacity)) / opacity)),
      );
    }
    image.data[offset + 3] = alpha;
  }

  return sharp(image.data, {
    raw: {
      width: image.info.width,
      height: image.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function toDataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function loadRendererAssets(): Promise<RendererAssets> {
  const assetRoot = findAssetRoot();
  const recipeMetaIcons = loadRecipeMetaIcons();
  const [medium, mediumItalic, semiBold, displayBold, barbell, highProtein, lowFat] = await Promise.all([
    readAsset(assetRoot, FONT_FILES.medium),
    readAsset(assetRoot, FONT_FILES.mediumItalic),
    readAsset(assetRoot, FONT_FILES.semiBold),
    readAsset(assetRoot, FONT_FILES.displayBold),
    readAsset(assetRoot, DESIGN_ASSET_FILES.barbell),
    readAsset(assetRoot, DESIGN_ASSET_FILES.highProtein),
    readAsset(assetRoot, DESIGN_ASSET_FILES.lowFat),
  ]);

  let wordmark: string;
  let wordmarkMimeType: "image/png" | "image/svg+xml";
  try {
    wordmark = (await readAsset(assetRoot, DESIGN_ASSET_FILES.wordmark)).toString("utf8");
    wordmarkMimeType = "image/svg+xml";
  } catch {
    const legacyWordmark = await readAsset(assetRoot, DESIGN_ASSET_FILES.legacyWordmark);
    const normalizedWordmark = await normalizeWordmarkBackground(
      (await getRuntimeDependencies()).sharp,
      legacyWordmark,
    );
    wordmark = toDataUri(normalizedWordmark, "image/png");
    wordmarkMimeType = "image/png";
  }

  return {
    fonts: [
      { name: "Inter", weight: 500, style: "normal", data: medium },
      { name: "Inter", weight: 500, style: "italic", data: mediumItalic },
      { name: "Inter", weight: 600, data: semiBold },
      { name: "InterDisplay", weight: 700, data: displayBold },
    ],
    nutritionHighlights: {
      "high-protein": toDataUri(highProtein, "image/png"),
      "low-fat": toDataUri(lowFat, "image/png"),
    },
    recipeMetaIcons,
    barbell: barbell.toString("utf8"),
    wordmark,
    wordmarkMimeType,
  };
}

function getRendererAssets(): Promise<RendererAssets> {
  rendererAssetsPromise ??= loadRendererAssets();
  return rendererAssetsPromise;
}

function invalidZoom(value: number): RenderResult {
  return {
    ok: false,
    error: {
      code: "INVALID_ZOOM",
      message: "Zoom must be a finite number greater than or equal to 1.",
      value,
    },
  };
}

function invalidFocus(field: "focusX" | "focusY", value: number): RenderResult {
  return {
    ok: false,
    error: {
      code: "INVALID_FOCUS",
      message: `${field} must be a finite number between 0 and 1.`,
      field,
      value,
    },
  };
}

function invalidRecipeMeta(
  field: "recipeMeta" | "totalTimeMinutes" | "portions" | "difficulty",
  message: string,
): RenderResult {
  return {
    ok: false,
    error: { code: "INVALID_RECIPE_META", message, field },
  };
}

function validateRecipeMeta(input: RenderInput): RenderResult | undefined {
  const recipeMeta: unknown = input.recipeMeta;
  if (recipeMeta === undefined) {
    return undefined;
  }
  if (recipeMeta === null || typeof recipeMeta !== "object" || Array.isArray(recipeMeta)) {
    return invalidRecipeMeta("recipeMeta", "recipeMeta must be a complete object.");
  }

  const values = recipeMeta as Record<string, unknown>;
  const totalTimeMinutes = values.totalTimeMinutes;
  if (
    totalTimeMinutes !== null &&
    (typeof totalTimeMinutes !== "number" ||
      !Number.isFinite(totalTimeMinutes) ||
      !Number.isInteger(totalTimeMinutes) ||
      totalTimeMinutes <= 0)
  ) {
    return invalidRecipeMeta(
      "totalTimeMinutes",
      "totalTimeMinutes must be a finite positive integer.",
    );
  }

  const portions = values.portions;
  if (
    typeof portions !== "number" ||
    !Number.isFinite(portions) ||
    !Number.isInteger(portions) ||
    portions <= 0
  ) {
    return invalidRecipeMeta("portions", "portions must be a finite positive integer.");
  }

  const difficulty = values.difficulty;
  if (
    difficulty !== null &&
    (typeof difficulty !== "string" ||
      difficulty.trim().length === 0 ||
      /[\r\n\u2028\u2029]/u.test(difficulty))
  ) {
    return invalidRecipeMeta(
      "difficulty",
      "difficulty must be a visible single-line string.",
    );
  }

  return undefined;
}

function validatePresentation(input: RenderInput): RenderResult | undefined {
  const { focusX, focusY, zoom } = input.presentation;
  if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom < 1) {
    return invalidZoom(zoom);
  }
  if (typeof focusX !== "number" || !Number.isFinite(focusX) || focusX < 0 || focusX > 1) {
    return invalidFocus("focusX", focusX);
  }
  if (typeof focusY !== "number" || !Number.isFinite(focusY) || focusY < 0 || focusY > 1) {
    return invalidFocus("focusY", focusY);
  }
  return undefined;
}

function mimeTypeForImage(format: string | undefined): string {
  const mimeTypes: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    tiff: "image/tiff",
  };
  const mimeType = format ? mimeTypes[format] : undefined;
  if (!mimeType) {
    throw new Error(`Unsupported image format: ${format ?? "unknown"}`);
  }
  return mimeType;
}

export async function loadPhoto(sharp: SharpFactory, image: RenderInput["image"]): Promise<PhotoAsset> {
  try {
    let buffer: Buffer;
    if (image && "buffer" in image && Buffer.isBuffer(image.buffer)) {
      buffer = image.buffer;
    } else if (image && "path" in image && typeof image.path === "string") {
      buffer = await readFile(image.path);
    } else {
      throw new Error("Image must contain a readable path or Buffer.");
    }

    const sourceMetadata = await sharp(buffer).metadata();
    const exifWasNormalized =
      sourceMetadata.orientation !== undefined && sourceMetadata.orientation !== 1;
    let normalizedBuffer = buffer;
    if (exifWasNormalized) {
      normalizedBuffer = await sharp(buffer).rotate().toBuffer();
    }

    const metadata = normalizedBuffer === buffer
      ? sourceMetadata
      : await sharp(normalizedBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height) {
      throw new Error("Image dimensions are unavailable.");
    }

    return {
      src: toDataUri(normalizedBuffer, mimeTypeForImage(metadata.format)),
      width,
      height,
    };
  } catch (error) {
    throw new UnreadableImageError(error);
  }
}

function getNodeMarker(node: SatoriNode): string | undefined {
  const marker = node.props["data-render-node"];
  return typeof marker === "string" ? marker : undefined;
}

function validateMeasuredLayout(
  titleWidth: number | undefined,
  tagWidths: number[],
  tagCount: number,
  recipeMetaWidth: number | undefined,
  hasRecipeMeta: boolean,
): RenderResult | undefined {
  if (titleWidth === undefined) {
    throw new Error("Satori did not report the title measurement node.");
  }
  if (titleWidth > TITLE_MAX_WIDTH) {
    return {
      ok: false,
      error: {
        code: "TITLE_OVERFLOW",
        message: "Recipe title exceeds the fixed title width.",
        measured: { width: titleWidth, max: TITLE_MAX_WIDTH },
      },
    };
  }

  if (tagCount !== tagWidths.length) {
    throw new Error("Satori did not report every tag chip measurement node.");
  }
  const tagRowWidth =
    tagWidths.reduce((total, width) => total + width, 0) +
    Math.max(0, tagCount - 1) * TAG_CHIP_GAP;
  if (tagRowWidth > TAG_ROW_MAX_WIDTH) {
    return {
      ok: false,
      error: {
        code: "TAG_ROW_OVERFLOW",
        message: "Recipe tag row exceeds the fixed content width.",
        measured: { width: tagRowWidth, max: TAG_ROW_MAX_WIDTH },
      },
    };
  }

  if (hasRecipeMeta) {
    if (recipeMetaWidth === undefined) {
      throw new Error("Satori did not report the recipe meta measurement node.");
    }
    if (recipeMetaWidth > RECIPE_META_ROW_WIDTH) {
      return {
        ok: false,
        error: {
          code: "RECIPE_META_OVERFLOW",
          message: "Recipe meta row exceeds the fixed content width.",
          measured: { width: recipeMetaWidth, max: RECIPE_META_ROW_WIDTH },
        },
      };
    }
  }
  return undefined;
}

async function render(input: RenderInput): Promise<RenderResult> {
  const invalidMeta = validateRecipeMeta(input);
  if (invalidMeta) {
    return invalidMeta;
  }

  if (input.tags.length > TAG_ROW_MAX_COUNT) {
    return {
      ok: false,
      error: {
        code: "TOO_MANY_TAGS",
        message: `A maximum of ${TAG_ROW_MAX_COUNT} tags is supported.`,
        count: input.tags.length,
        max: TAG_ROW_MAX_COUNT,
      },
    };
  }

  const invalidPresentation = validatePresentation(input);
  if (invalidPresentation) {
    return invalidPresentation;
  }

  const normalizedInput = input.recipeMeta
    ? {
        ...input,
        recipeMeta: {
          ...input.recipeMeta,
          difficulty: input.recipeMeta.difficulty?.trim() ?? null,
        },
      }
    : input;

  const runtime = await getRuntimeDependencies();
  const [photo, assets] = await Promise.all([
    loadPhoto(runtime.sharp, input.image),
    getRendererAssets(),
  ]);

  let titleWidth: number | undefined;
  const tagWidths: number[] = [];
  let recipeMetaWidth: number | undefined;
  const svg = await runtime.satori(
    compose(normalizedInput, {
      photo,
      nutritionHighlights: assets.nutritionHighlights,
      recipeMetaIcons: assets.recipeMetaIcons,
      barbell: assets.barbell,
      wordmark: assets.wordmark,
      wordmarkMimeType: assets.wordmarkMimeType,
    }) as unknown as Parameters<SatoriRenderer>[0],
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: assets.fonts,
      embedFont: true,
      onNodeDetected: (node) => {
        const marker = getNodeMarker(node);
        if (marker === "title") {
          titleWidth = node.width;
        } else if (marker === "tag-chip") {
          tagWidths.push(node.width);
        } else if (marker === "recipe-meta-content") {
          recipeMetaWidth = node.width;
        }
      },
    },
  );

  const layoutError = validateMeasuredLayout(
    titleWidth,
    tagWidths,
    input.tags.length,
    recipeMetaWidth,
    normalizedInput.recipeMeta !== undefined,
  );
  if (layoutError) {
    return layoutError;
  }

  const rendered = new runtime.Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: false },
  }).render();
  if (rendered.width !== CANVAS_WIDTH || rendered.height !== CANVAS_HEIGHT) {
    throw new Error(`Unexpected render dimensions: ${rendered.width}x${rendered.height}.`);
  }

  return {
    ok: true,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    format: "png",
    buffer: rendered.asPng(),
  };
}

export async function renderInstagramRecipe(input: RenderInput): Promise<RenderResult> {
  try {
    return await render(input);
  } catch (error) {
    if (
      error instanceof MissingRendererAssetError ||
      error instanceof TagIconAssetError ||
      error instanceof RecipeMetaIconAssetError
    ) {
      return toMissingAssetError(error);
    }
    if (error instanceof UnreadableImageError) {
      return toImageError(error);
    }
    return toInternalError(error);
  }
}

type DetailsProbeMeasurement = { width: number; height: number };

type DetailsProbeMeasurements = {
  title?: DetailsProbeMeasurement;
  description?: DetailsProbeMeasurement;
  ingredients: Map<number, DetailsProbeMeasurement>;
  steps: Map<number, DetailsProbeMeasurement>;
};

function getDetailsNodeIndex(marker: string, prefix: string): number | undefined {
  if (!marker.startsWith(prefix)) return undefined;
  const index = Number(marker.slice(prefix.length));
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

function detailsProbeFailure(
  field: RecipeDetailsTemplateField,
  message: string,
  itemIndex?: number,
  itemField?: RecipeDetailsTemplateItemField,
): RecipeDetailsTemplateRenderResult {
  return {
    ok: false,
    error: { code: "TEMPLATE_PROBE_FAILED", field, message, itemIndex, itemField },
  };
}

function detailsFieldOverflow(
  field: RecipeDetailsTemplateField,
  message: string,
  measurement: DetailsProbeMeasurement,
  maxWidth: number,
  maxHeight: number,
  itemIndex?: number,
  itemField?: RecipeDetailsTemplateItemField,
): RecipeDetailsTemplateRenderResult {
  return {
    ok: false,
    error: {
      code: "TEMPLATE_FIELD_OVERFLOW",
      field,
      message,
      itemIndex,
      itemField,
      measured: {
        width: measurement.width,
        height: measurement.height,
        maxWidth,
        maxHeight,
      },
    },
  };
}

function exceedsDetailsBounds(
  measurement: DetailsProbeMeasurement,
  maxWidth: number,
  maxHeight: number,
): boolean {
  return measurement.width > maxWidth + 0.5 || measurement.height > maxHeight + 0.5;
}

function validateMeasuredDetailsTemplate(
  input: RecipeDetailsTemplateInput,
  measurements: DetailsProbeMeasurements,
): RecipeDetailsTemplateRenderResult | undefined {
  const titleMeasurement = measurements.title;
  if (!titleMeasurement) {
    return detailsProbeFailure("title", "The production font probe did not measure the title.");
  }

  const titleLayout = getRecipeDetailsTitleLayout(input.title);
  const titleMaxHeight =
    (input.description ? titleLayout.teaserTop : RECIPE_DETAILS_TEMPLATE_CHIP_TOP) -
    RECIPE_DETAILS_TEMPLATE_TITLE_TOP;
  if (exceedsDetailsBounds(titleMeasurement, RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH, titleMaxHeight)) {
    return detailsFieldOverflow(
      "title",
      "Recipe title exceeds the measured detail-template bounds.",
      titleMeasurement,
      RECIPE_DETAILS_TEMPLATE_TITLE_WIDTH,
      titleMaxHeight,
    );
  }

  if (input.description !== undefined) {
    const descriptionMeasurement = measurements.description;
    if (!descriptionMeasurement) {
      return detailsProbeFailure(
        "description",
        "The production font probe did not measure the teaser.",
      );
    }

    const descriptionMaxHeight =
      RECIPE_DETAILS_TEMPLATE_CHIP_TOP -
      titleLayout.teaserTop -
      RECIPE_DETAILS_TEMPLATE_DESCRIPTION_GAP;
    if (
      exceedsDetailsBounds(
        descriptionMeasurement,
        RECIPE_DETAILS_TEMPLATE_DESCRIPTION_TEXT_WIDTH,
        descriptionMaxHeight,
      )
    ) {
      return detailsFieldOverflow(
        "description",
        "Recipe teaser exceeds the measured detail-template bounds.",
        descriptionMeasurement,
        RECIPE_DETAILS_TEMPLATE_DESCRIPTION_TEXT_WIDTH,
        descriptionMaxHeight,
      );
    }
  }

  const compactIngredients = input.ingredients.length > 8;
  const ingredientMaxWidth = compactIngredients
    ? RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_TEXT_WIDTH
    : RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_TEXT_WIDTH;
  const ingredientMaxHeight = compactIngredients
    ? RECIPE_DETAILS_TEMPLATE_INGREDIENT_COMPACT_ROW_HEIGHT
    : RECIPE_DETAILS_TEMPLATE_INGREDIENT_LARGE_ROW_HEIGHT;
  for (let index = 0; index < input.ingredients.length; index += 1) {
    const measurement = measurements.ingredients.get(index);
    if (!measurement) {
      return detailsProbeFailure(
        "ingredients",
        `The production font probe did not measure ingredient ${index + 1}.`,
        index,
        "text",
      );
    }
    if (exceedsDetailsBounds(measurement, ingredientMaxWidth, ingredientMaxHeight)) {
      return detailsFieldOverflow(
        "ingredients",
        `Ingredient ${index + 1} exceeds its measured detail-template row.`,
        measurement,
        ingredientMaxWidth,
        ingredientMaxHeight,
        index,
        "text",
      );
    }
  }

  const compactSteps = input.steps.length === RECIPE_DETAILS_TEMPLATE_MAX_STEPS;
  const stepMaxWidth = compactSteps
    ? RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_TEXT_WIDTH
    : RECIPE_DETAILS_TEMPLATE_STEP_LARGE_TEXT_WIDTH;
  const stepMaxHeight = compactSteps
    ? RECIPE_DETAILS_TEMPLATE_STEP_COMPACT_ROW_HEIGHT
    : RECIPE_DETAILS_TEMPLATE_STEP_LARGE_ROW_HEIGHT;
  for (let index = 0; index < input.steps.length; index += 1) {
    const measurement = measurements.steps.get(index);
    if (!measurement) {
      return detailsProbeFailure(
        "steps",
        `The production font probe did not measure step ${index + 1}.`,
        index,
        "text",
      );
    }
    if (exceedsDetailsBounds(measurement, stepMaxWidth, stepMaxHeight)) {
      return detailsFieldOverflow(
        "steps",
        `Step ${index + 1} exceeds its measured detail-template row.`,
        measurement,
        stepMaxWidth,
        stepMaxHeight,
        index,
        "text",
      );
    }
  }

  return undefined;
}

function invalidTemplateInput(
  field: RecipeDetailsTemplateField,
  message: string,
  itemIndex?: number,
  itemField?: RecipeDetailsTemplateItemField,
  itemValue?: string,
): RecipeDetailsTemplateRenderResult {
  return {
    ok: false,
    error: { code: "INVALID_TEMPLATE_INPUT", field, message, itemIndex, itemField, itemValue },
  };
}

function validateRecipeDetailsTemplate(
  input: RecipeDetailsTemplateInput,
): RecipeDetailsTemplateRenderResult | undefined {
  if (
    input.title.trim().length === 0 ||
    input.title.trim().length > 60 ||
    /[\r\n\u2028\u2029]/u.test(input.title)
  ) {
    return invalidTemplateInput(
      "title",
      "title must be a visible single-line string with at most 60 characters.",
    );
  }
  if (
    input.description !== undefined &&
    (input.description.trim().length === 0 ||
      input.description.trim().length > 96 ||
      /[\r\n\u2028\u2029]/u.test(input.description))
  ) {
    return invalidTemplateInput(
      "description",
      "description must be a visible single-line string with at most 96 characters.",
    );
  }
  if (
    input.difficulty !== undefined &&
    input.difficulty !== null &&
    (input.difficulty.trim().length === 0 || /[\r\n\u2028\u2029]/u.test(input.difficulty))
  ) {
    return invalidTemplateInput(
      "difficulty",
      "difficulty must be a visible single-line string.",
    );
  }
  if (
    input.totalTimeMinutes !== null &&
    (!Number.isInteger(input.totalTimeMinutes) || input.totalTimeMinutes <= 0)
  ) {
    return invalidTemplateInput("totalTimeMinutes", "totalTimeMinutes must be a positive integer.");
  }
  if (!Number.isInteger(input.portions) || input.portions <= 0) {
    return invalidTemplateInput("portions", "portions must be a positive integer.");
  }
  if (
    input.ingredients.length === 0 ||
    input.ingredients.length > RECIPE_DETAILS_TEMPLATE_MAX_INGREDIENTS
  ) {
    return invalidTemplateInput(
      "ingredients",
      `ingredients must contain 1 to ${RECIPE_DETAILS_TEMPLATE_MAX_INGREDIENTS} visible entries with amounts up to 16 and names up to 36 characters.`,
    );
  }
  const invalidIngredientIndex = input.ingredients.findIndex((ingredient) =>
    ingredient.amount.trim().length === 0 ||
    ingredient.amount.trim().length > 16 ||
    ingredient.name.trim().length === 0 ||
    ingredient.name.trim().length > 36 ||
    /[\r\n\u2028\u2029]/u.test(ingredient.amount) ||
    /[\r\n\u2028\u2029]/u.test(ingredient.name),
  );
  if (invalidIngredientIndex >= 0) {
    const ingredient = input.ingredients[invalidIngredientIndex]!;
    const itemField =
      ingredient.amount.trim().length === 0 ||
      ingredient.amount.trim().length > 16 ||
      /[\r\n\u2028\u2029]/u.test(ingredient.amount)
        ? "amount"
        : "name";
    return invalidTemplateInput(
      "ingredients",
      `ingredient ${invalidIngredientIndex + 1} has an invalid ${itemField}.`,
      invalidIngredientIndex,
      itemField,
      ingredient[itemField],
    );
  }
  if (
    input.steps.length === 0 ||
    input.steps.length > RECIPE_DETAILS_TEMPLATE_MAX_STEPS
  ) {
    return invalidTemplateInput(
      "steps",
      `steps must contain 1 to ${RECIPE_DETAILS_TEMPLATE_MAX_STEPS} visible entries with up to 90 characters each.`,
    );
  }
  const invalidStepIndex = input.steps.findIndex((step) =>
    step.trim().length === 0 ||
    step.trim().length > 90 ||
    /[\r\n\u2028\u2029]/u.test(step),
  );
  if (invalidStepIndex >= 0) {
    return invalidTemplateInput(
      "steps",
      `step ${invalidStepIndex + 1} has invalid text.`,
      invalidStepIndex,
      "text",
      input.steps[invalidStepIndex],
    );
  }
  return undefined;
}

export async function renderInstagramRecipeDetailsTemplate(
  input: RecipeDetailsTemplateInput,
): Promise<RecipeDetailsTemplateRenderResult> {
  const validationError = validateRecipeDetailsTemplate(input);
  if (validationError) {
    return validationError;
  }

  try {
    const [runtime, assets] = await Promise.all([getRuntimeDependencies(), getRendererAssets()]);
    const photo = await loadPhoto(runtime.sharp, input.image);
    for (const descriptionFontSize of [22, 21, 20, 19, 18]) {
      const textFields = getRecipeDetailsTextLayoutFields(input, descriptionFontSize);
      const textLayout = await addMeasuredGermanBreaks(textFields, (requests) =>
        measureDetailTextWidths(runtime.satori, assets.fonts, requests),
      );
      if (!textLayout.ok) {
        if (textLayout.error.field === "description" && descriptionFontSize > 18) {
          continue;
        }
        const failedField = textFields.find((field) => field.id === textLayout.error.id);
        if (!failedField) {
          return detailsProbeFailure(
            textLayout.error.field,
            "The detail text layout did not return its source field.",
            textLayout.error.itemIndex,
            textLayout.error.itemField,
          );
        }
        return detailsFieldOverflow(
          textLayout.error.field,
          "No valid German hyphenation break fits the assigned detail-text width.",
          {
            width: textLayout.error.measuredWidth,
            height: failedField.style.fontSize * failedField.style.lineHeight,
          },
          failedField.maxWidth,
          failedField.maxHeight,
          textLayout.error.itemIndex,
          textLayout.error.itemField,
        );
      }

      const textById = textLayout.textById;
      const textOverrides: RecipeDetailsTemplateTextOverrides = {
        title: textById.get(RECIPE_DETAILS_TEMPLATE_TITLE_NODE) ?? input.title,
        descriptionFontSize,
        ...(input.description === undefined
          ? {}
          : {
              description:
                textById.get(RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE) ?? input.description,
            }),
        ingredients: input.ingredients.map((ingredient, index) =>
          textById.get(`${RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX}${index}`) ??
          `${ingredient.amount} ${ingredient.name}`,
        ),
        steps: input.steps.map(
          (step, index) =>
            textById.get(`${RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX}${index}`) ?? step,
        ),
      };
      const measurements: DetailsProbeMeasurements = {
        ingredients: new Map(),
        steps: new Map(),
      };
      const svg = await runtime.satori(
        composeRecipeDetailsTemplate(input, {
          photo,
          wordmark: assets.wordmark,
          wordmarkMimeType: assets.wordmarkMimeType,
          nutritionHighlights: assets.nutritionHighlights,
        }, textOverrides) as unknown as Parameters<SatoriRenderer>[0],
        {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          fonts: assets.fonts,
          embedFont: true,
          onNodeDetected: (node) => {
            const marker = getNodeMarker(node);
            if (marker === RECIPE_DETAILS_TEMPLATE_TITLE_NODE) {
              measurements.title = { width: node.width, height: node.height };
            } else if (marker === RECIPE_DETAILS_TEMPLATE_DESCRIPTION_NODE) {
              measurements.description = { width: node.width, height: node.height };
            } else {
              const ingredientIndex = getDetailsNodeIndex(
                marker ?? "",
                RECIPE_DETAILS_TEMPLATE_INGREDIENT_NODE_PREFIX,
              );
              if (ingredientIndex !== undefined) {
                measurements.ingredients.set(ingredientIndex, {
                  width: node.width,
                  height: node.height,
                });
                return;
              }

              const stepIndex = getDetailsNodeIndex(marker ?? "", RECIPE_DETAILS_TEMPLATE_STEP_NODE_PREFIX);
              if (stepIndex !== undefined) {
                measurements.steps.set(stepIndex, {
                  width: node.width,
                  height: node.height,
                });
              }
            }
          },
        },
      );
      const layoutError = validateMeasuredDetailsTemplate(input, measurements);
      if (layoutError) {
        if (
          !layoutError.ok && layoutError.error.code === "TEMPLATE_FIELD_OVERFLOW" &&
          layoutError.error.field === "description" && descriptionFontSize > 18
        ) {
          continue;
        }
        return layoutError;
      }
      const rendered = new runtime.Resvg(svg, {
        fitTo: { mode: "original" },
        font: { loadSystemFonts: false },
      }).render();
      if (rendered.width !== CANVAS_WIDTH || rendered.height !== CANVAS_HEIGHT) {
        throw new Error(`Unexpected render dimensions: ${rendered.width}x${rendered.height}.`);
      }

      return {
        ok: true,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        format: "png",
        buffer: rendered.asPng(),
      };
    }
    throw new Error("No detail teaser font size was evaluated.");
  } catch (error) {
    if (error instanceof MissingRendererAssetError) {
      return {
        ok: false,
        error: {
          code: "MISSING_ASSET",
          message: error.message,
          asset: error.asset,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Instagram recipe details template rendering failed.",
        cause: errorMessage(error),
      },
    };
  }
}
