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
import { loadRecipeMetaIcons, RecipeMetaIconAssetError } from "./recipeMeta";
import { TagIconAssetError } from "./tagIcons";
import type { RenderInput, RenderResult } from "./types";

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
  const [medium, semiBold, displayBold, barbell, highProtein, lowFat] = await Promise.all([
    readAsset(assetRoot, FONT_FILES.medium),
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
      { name: "Inter", weight: 500, data: medium },
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
    typeof totalTimeMinutes !== "number" ||
    !Number.isFinite(totalTimeMinutes) ||
    !Number.isInteger(totalTimeMinutes) ||
    totalTimeMinutes <= 0
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
    typeof difficulty !== "string" ||
    difficulty.trim().length === 0 ||
    /[\r\n\u2028\u2029]/u.test(difficulty)
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

async function loadPhoto(sharp: SharpFactory, image: RenderInput["image"]): Promise<PhotoAsset> {
  try {
    let buffer: Buffer;
    if (image && "buffer" in image && Buffer.isBuffer(image.buffer)) {
      buffer = image.buffer;
    } else if (image && "path" in image && typeof image.path === "string") {
      buffer = await readFile(image.path);
    } else {
      throw new Error("Image must contain a readable path or Buffer.");
    }

    const metadata = await sharp(buffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height) {
      throw new Error("Image dimensions are unavailable.");
    }

    return {
      src: toDataUri(buffer, mimeTypeForImage(metadata.format)),
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
        recipeMeta: { ...input.recipeMeta, difficulty: input.recipeMeta.difficulty.trim() },
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
