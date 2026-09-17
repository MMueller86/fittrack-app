import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { compose, type ComposeAssets, type SatoriElement } from "../compose";
import { quarkbroetchenMetaFixture } from "../fixtures/quarkbroetchen-meta";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CONTENT_LEFT,
  CONTENT_WIDTH,
  HIGHLIGHT_BADGE_RIGHT,
  HIGHLIGHT_BADGE_SIZE,
  HIGHLIGHT_BADGE_TOP,
  NUTRITION_CARD_BOTTOM_Y,
  RECIPE_META_FONT_SIZE,
  RECIPE_META_ICON_SIZE,
  RECIPE_META_LINE_HEIGHT,
  RECIPE_META_ROW_HEIGHT,
  RECIPE_META_ROW_TOP_Y,
  RECIPE_META_ROW_WIDTH,
  WORDMARK_Y,
} from "../layout";
import { renderInstagramRecipe } from "../index";
import { loadRecipeMetaIcons } from "../recipeMeta";
import type { RenderInput } from "../types";

const EMPTY_PNG = "data:image/png;base64,iVBORw0KGgo=";
const META_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#B9BFBB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16" /></svg>';

type PixelImage = Awaited<ReturnType<typeof decode>>;

function createComposeAssets(): ComposeAssets {
  return {
    photo: { src: EMPTY_PNG, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    nutritionHighlights: {
      "high-protein": EMPTY_PNG,
      "low-fat": EMPTY_PNG,
    },
    recipeMetaIcons: {
      totalTime: META_ICON_SVG,
      portions: META_ICON_SVG,
      difficulty: META_ICON_SVG,
    },
    barbell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 904 64" />',
    wordmark: EMPTY_PNG,
  };
}

function isElement(value: unknown): value is SatoriElement {
  return Boolean(value) && typeof value === "object" && "type" in value && "props" in value;
}

function flattenElements(value: unknown): SatoriElement[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenElements);
  }
  if (!isElement(value)) {
    return [];
  }
  return [value, ...flattenElements(value.props.children)];
}

function findNodes(root: SatoriElement, marker: string): SatoriElement[] {
  return flattenElements(root).filter((element) => element.props["data-render-node"] === marker);
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join("");
  }
  if (isElement(value)) {
    return textContent(value.props.children);
  }
  return "";
}

function styleOf(element: SatoriElement): Record<string, unknown> {
  return element.props.style as Record<string, unknown>;
}

async function decode(input: Buffer) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pixelOffset(image: PixelImage, x: number, y: number): number {
  return (y * image.info.width + x) * image.info.channels;
}

function differenceBounds(actual: PixelImage, expected: PixelImage): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
} | undefined {
  let minX = actual.info.width;
  let maxX = -1;
  let minY = actual.info.height;
  let maxY = -1;
  let count = 0;

  for (let y = 0; y < actual.info.height; y += 1) {
    for (let x = 0; x < actual.info.width; x += 1) {
      const actualOffset = pixelOffset(actual, x, y);
      const expectedOffset = pixelOffset(expected, x, y);
      let differs = false;
      for (let channel = 0; channel < actual.info.channels; channel += 1) {
        if (actual.data[actualOffset + channel] !== expected.data[expectedOffset + channel]) {
          differs = true;
          break;
        }
      }
      if (!differs) {
        continue;
      }
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return count === 0 ? undefined : { minX, maxX, minY, maxY, count };
}

function countDifferencesOutsideRectangle(
  actual: PixelImage,
  expected: PixelImage,
  rectangle: { left: number; right: number; top: number; bottom: number },
): number {
  let differences = 0;
  for (let y = 0; y < actual.info.height; y += 1) {
    for (let x = 0; x < actual.info.width; x += 1) {
      if (
        x >= rectangle.left &&
        x < rectangle.right &&
        y >= rectangle.top &&
        y < rectangle.bottom
      ) {
        continue;
      }

      const actualOffset = pixelOffset(actual, x, y);
      const expectedOffset = pixelOffset(expected, x, y);
      for (let channel = 0; channel < actual.info.channels; channel += 1) {
        if (actual.data[actualOffset + channel] !== expected.data[expectedOffset + channel]) {
          differences += 1;
          break;
        }
      }
    }
  }
  return differences;
}

function withoutMeta(): RenderInput {
  return { ...quarkbroetchenMetaFixture, recipeMeta: undefined };
}

function invalidMeta(value: unknown): RenderInput {
  return { ...quarkbroetchenMetaFixture, recipeMeta: value } as RenderInput;
}

describe("Instagram recipe renderer meta line", () => {
  it("uses a signal icon for difficulty without the clipped gauge arc", () => {
    const icons = loadRecipeMetaIcons();

    expect(icons.difficulty).toContain("lucide-signal");
    expect(icons.difficulty).not.toContain("lucide-gauge");
  });

  it("renders one complete centered meta row with three line icons", async () => {
    const result = await renderInstagramRecipe(quarkbroetchenMetaFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.width).toBe(CANVAS_WIDTH);
    expect(result.height).toBe(CANVAS_HEIGHT);
    expect(result.format).toBe("png");

    const tree = compose(quarkbroetchenMetaFixture, createComposeAssets());
    const metaRow = findNodes(tree, "recipe-meta-row");
    const metaContent = findNodes(tree, "recipe-meta-content");
    const metaItems = findNodes(tree, "recipe-meta-item");
    const metaIcons = findNodes(tree, "recipe-meta-icon");
    const separators = findNodes(tree, "recipe-meta-separator");
    expect(metaRow).toHaveLength(1);
    expect(metaContent).toHaveLength(1);
    expect(metaItems).toHaveLength(3);
    expect(metaIcons).toHaveLength(3);
    expect(separators).toHaveLength(2);

    const row = metaRow[0];
    const rowStyle = styleOf(row);
    expect(rowStyle.left).toBe(CONTENT_LEFT);
    expect(rowStyle.top).toBe(RECIPE_META_ROW_TOP_Y);
    expect(rowStyle.width).toBe(RECIPE_META_ROW_WIDTH);
    expect(rowStyle.height).toBe(RECIPE_META_ROW_HEIGHT);
    expect(rowStyle.justifyContent).toBe("center");
    expect(rowStyle.backgroundColor).toBeUndefined();
    expect(rowStyle.border).toBeUndefined();
    expect(rowStyle.borderRadius).toBeUndefined();
    expect(rowStyle.boxShadow).toBeUndefined();
    expect(textContent(row)).toBe("25 Min.·8 Portionen·Einfach");

    expect(metaItems.map((item) => textContent(item))).toEqual([
      "25 Min.",
      "8 Portionen",
      "Einfach",
    ]);
    for (const icon of metaIcons) {
      expect(styleOf(icon).width).toBe(RECIPE_META_ICON_SIZE);
      expect(styleOf(icon).height).toBe(RECIPE_META_ICON_SIZE);
    }
    for (const item of metaItems) {
      const textNode = flattenElements(item).find((element) => element.type === "span");
      expect(textNode).toBeDefined();
      if (!textNode) {
        continue;
      }
      expect(styleOf(textNode).fontSize).toBe(RECIPE_META_FONT_SIZE);
      expect(styleOf(textNode).lineHeight).toBe(RECIPE_META_LINE_HEIGHT);
      expect(styleOf(textNode).whiteSpace).toBe("nowrap");
    }

    const rootChildren = Array.isArray(tree.props.children)
      ? tree.props.children.filter(isElement)
      : [];
    const cardIndex = rootChildren.findIndex(
      (child) => child.props["data-render-node"] === "nutrition-card",
    );
    const rowIndex = rootChildren.indexOf(row);
    const wordmarkIndex = rootChildren.findIndex(
      (child) => child.props["data-render-node"] === "wordmark",
    );
    expect(rowIndex).toBeGreaterThan(cardIndex);
    expect(rowIndex).toBeLessThan(wordmarkIndex);
  });

  it("keeps every existing pixel outside the optional meta zone unchanged", async () => {
    const [withMeta, withoutRecipeMeta] = await Promise.all([
      renderInstagramRecipe(quarkbroetchenMetaFixture),
      renderInstagramRecipe(withoutMeta()),
    ]);

    expect(withMeta.ok).toBe(true);
    expect(withoutRecipeMeta.ok).toBe(true);
    if (!withMeta.ok || !withoutRecipeMeta.ok) {
      return;
    }

    const [metaImage, legacyImage] = await Promise.all([
      decode(withMeta.buffer),
      decode(withoutRecipeMeta.buffer),
    ]);
    const bounds = differenceBounds(metaImage, legacyImage);
    expect(bounds).toBeDefined();
    if (!bounds) {
      return;
    }

    expect(bounds.minX).toBeGreaterThanOrEqual(CONTENT_LEFT);
    expect(bounds.maxX).toBeLessThan(CONTENT_LEFT + CONTENT_WIDTH);
    expect(bounds.minY).toBeGreaterThanOrEqual(RECIPE_META_ROW_TOP_Y);
    expect(bounds.maxY).toBeLessThan(RECIPE_META_ROW_TOP_Y + RECIPE_META_ROW_HEIGHT);
    expect(bounds.minY).toBeGreaterThanOrEqual(NUTRITION_CARD_BOTTOM_Y);
    expect(bounds.maxY).toBeLessThan(WORDMARK_Y);
    expect(
      countDifferencesOutsideRectangle(metaImage, legacyImage, {
        left: CONTENT_LEFT,
        right: CONTENT_LEFT + CONTENT_WIDTH,
        top: RECIPE_META_ROW_TOP_Y,
        bottom: RECIPE_META_ROW_TOP_Y + RECIPE_META_ROW_HEIGHT,
      }),
    ).toBe(0);

    const metaTree = compose(quarkbroetchenMetaFixture, createComposeAssets());
    const legacyTree = compose(withoutMeta(), createComposeAssets());
    expect(findNodes(metaTree, "recipe-meta-row")).toHaveLength(1);
    expect(findNodes(legacyTree, "recipe-meta-row")).toHaveLength(0);
    for (const marker of ["nutrition-card", "barbell", "pro-portion", "wordmark"]) {
      const metaNode = findNodes(metaTree, marker)[0];
      const legacyNode = findNodes(legacyTree, marker)[0];
      expect(metaNode).toBeDefined();
      expect(legacyNode).toBeDefined();
      expect(metaNode && styleOf(metaNode)).toEqual(legacyNode && styleOf(legacyNode));
    }
  });

  it.each([
    ["missing time", { totalTimeMinutes: undefined }, "totalTimeMinutes"],
    ["zero time", { totalTimeMinutes: 0 }, "totalTimeMinutes"],
    ["negative time", { totalTimeMinutes: -1 }, "totalTimeMinutes"],
    ["fractional time", { totalTimeMinutes: 2.5 }, "totalTimeMinutes"],
    ["non-finite time", { totalTimeMinutes: Number.POSITIVE_INFINITY }, "totalTimeMinutes"],
    ["missing portions", { portions: undefined }, "portions"],
    ["zero portions", { portions: 0 }, "portions"],
    ["negative portions", { portions: -1 }, "portions"],
    ["fractional portions", { portions: 2.5 }, "portions"],
    ["non-finite portions", { portions: Number.NaN }, "portions"],
    ["missing difficulty", { difficulty: undefined }, "difficulty"],
    ["empty difficulty", { difficulty: "" }, "difficulty"],
    ["blank difficulty", { difficulty: "   " }, "difficulty"],
    ["non-string difficulty", { difficulty: 3 }, "difficulty"],
    ["line break in difficulty", { difficulty: "Ein\nfach" }, "difficulty"],
  ] as const)("rejects %s fail-closed", async (_label, changes, field) => {
    const result = await renderInstagramRecipe(
      invalidMeta({ ...quarkbroetchenMetaFixture.recipeMeta, ...changes }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("INVALID_RECIPE_META");
    if (result.error.code === "INVALID_RECIPE_META") {
      expect(result.error.field).toBe(field);
    }
  });

  it("rejects a non-object meta value with a field-specific validation error", async () => {
    const result = await renderInstagramRecipe(invalidMeta(null));

    expect(result.ok).toBe(false);
    if (!result.ok && result.error.code === "INVALID_RECIPE_META") {
      expect(result.error.field).toBe("recipeMeta");
    }
  });

  it("rejects a valid but too-wide difficulty without rendering a partial row", async () => {
    const result = await renderInstagramRecipe(
      invalidMeta({
        ...quarkbroetchenMetaFixture.recipeMeta,
        difficulty: "Sehr schwierige Zubereitung mit einem absichtlich langen Label ".repeat(10),
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RECIPE_META_OVERFLOW");
      if (result.error.code === "RECIPE_META_OVERFLOW") {
        expect(result.error.measured.width).toBeGreaterThan(result.error.measured.max);
        expect(result.error.measured.max).toBe(RECIPE_META_ROW_WIDTH);
      }
    }
  });

  it.each([
    [1, "1 Portion"],
    [2, "2 Portionen"],
  ] as const)("formats %d portion(s) as %s", (portions, expected) => {
    const input: RenderInput = {
      ...quarkbroetchenMetaFixture,
      recipeMeta: { ...quarkbroetchenMetaFixture.recipeMeta!, portions },
    };
    const row = findNodes(compose(input, createComposeAssets()), "recipe-meta-row")[0];

    expect(textContent(row)).toContain(expected);
  });

  it("keeps the complete meta row when the nutrition highlight is null", async () => {
    const input = { ...quarkbroetchenMetaFixture, nutritionHighlight: null };
    const result = await renderInstagramRecipe(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const tree = compose(input, createComposeAssets());
    expect(findNodes(tree, "recipe-meta-row")).toHaveLength(1);
    expect(
      flattenElements(tree).some((element) => {
        const style = styleOf(element);
        return (
          element.type === "img" &&
          style.top === HIGHLIGHT_BADGE_TOP &&
          style.width === HIGHLIGHT_BADGE_SIZE
        );
      }),
    ).toBe(false);
    expect(textContent(findNodes(tree, "recipe-meta-row")[0])).toBe(
      "25 Min.·8 Portionen·Einfach",
    );
  });

  it("keeps highlight changes confined to the existing badge zone", async () => {
    const [withHighlight, withoutHighlight] = await Promise.all([
      renderInstagramRecipe(quarkbroetchenMetaFixture),
      renderInstagramRecipe({ ...quarkbroetchenMetaFixture, nutritionHighlight: null }),
    ]);

    expect(withHighlight.ok).toBe(true);
    expect(withoutHighlight.ok).toBe(true);
    if (!withHighlight.ok || !withoutHighlight.ok) {
      return;
    }

    const [withImage, withoutImage] = await Promise.all([
      decode(withHighlight.buffer),
      decode(withoutHighlight.buffer),
    ]);
    expect(
      countDifferencesOutsideRectangle(withImage, withoutImage, {
        left: CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT - HIGHLIGHT_BADGE_SIZE,
        right: CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT,
        top: HIGHLIGHT_BADGE_TOP,
        bottom: HIGHLIGHT_BADGE_TOP + HIGHLIGHT_BADGE_SIZE,
      }),
    ).toBe(0);
  });

  it("retains distinct footer zones after a 4:5 thumbnail downscale", async () => {
    const [withMeta, withoutRecipeMeta] = await Promise.all([
      renderInstagramRecipe(quarkbroetchenMetaFixture),
      renderInstagramRecipe(withoutMeta()),
    ]);

    expect(withMeta.ok).toBe(true);
    expect(withoutRecipeMeta.ok).toBe(true);
    if (!withMeta.ok || !withoutRecipeMeta.ok) {
      return;
    }

    const [thumbnail, legacyThumbnail] = await Promise.all([
      sharp(withMeta.buffer).resize(216, 270).raw().toBuffer({ resolveWithObject: true }),
      sharp(withoutRecipeMeta.buffer)
        .resize(216, 270)
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    expect(thumbnail.info.width).toBe(216);
    expect(thumbnail.info.height).toBe(270);
    const bounds = differenceBounds(thumbnail, legacyThumbnail);
    expect(bounds).toBeDefined();
    if (!bounds) {
      return;
    }

    expect(bounds.count).toBeGreaterThan(5);
    expect(bounds.minY).toBeGreaterThanOrEqual(238);
    expect(bounds.maxY).toBeLessThanOrEqual(247);
  });
});