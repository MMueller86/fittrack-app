import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import satori from "satori";
import { describe, expect, it } from "vitest";

import { compose, type ComposeAssets, type SatoriElement } from "../compose";
import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { smokeFixture } from "../fixtures/smoke";
import {
  BARBELL_CARD_INSET,
  BARBELL_HEIGHT,
  BARBELL_SCALE,
  BARBELL_SHAFT_CENTER_Y,
  BARBELL_SHAFT_HEIGHT,
  BARBELL_SHAFT_TOP_OFFSET_Y,
  BARBELL_SHAFT_TOP_Y,
  BARBELL_VIEWBOX_SHAFT_TOP_OFFSET_Y,
  BARBELL_VIEWBOX_HEIGHT,
  BARBELL_VIEWBOX_WIDTH,
  BARBELL_WIDTH,
  BARBELL_X,
  BARBELL_Y,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_DIVIDER,
  COLOR_LIME,
  COLOR_PANEL,
  HERO_HEIGHT,
  HIGHLIGHT_BADGE_RIGHT,
  HIGHLIGHT_BADGE_SIZE,
  HIGHLIGHT_BADGE_TOP,
  NUTRITION_CARD_BORDER_WIDTH,
  NUTRITION_CARD_BOTTOM_Y,
  NUTRITION_CARD_HEIGHT,
  NUTRITION_CARD_RADIUS,
  NUTRITION_CARD_X,
  NUTRITION_CARD_WIDTH,
  NUTRITION_CARD_Y,
  NUTRITION_FOOTER_TOP_Y,
  NUTRITION_DIVIDER_HEIGHT,
  NUTRITION_DIVIDER_X,
  NUTRITION_DIVIDER_WIDTH,
  NUTRITION_VALUE_ROW_BOTTOM_Y,
  NUTRITION_VALUE_ROW_HEIGHT,
  NUTRITION_LABEL_FONT_SIZE,
  NUTRITION_VALUE_FONT_SIZE,
  NUTRITION_VALUE_ROW_TOP_Y,
  NUTRITION_VALUE_ROW_WIDTH,
  NUTRITION_VALUE_ROW_X,
  PRO_PORTION_CENTER_X,
  PRO_PORTION_CENTER_Y,
  PRO_PORTION_HEIGHT,
  PRO_PORTION_TOP,
  PRO_PORTION_WIDTH,
  PHOTO_TRANSITION_END_Y,
  PHOTO_TRANSITION_START_Y,
  TAG_CHIP_HEIGHT,
  TAG_ROW_Y,
  TITLE_Y,
  WORDMARK_BOTTOM_CLEARANCE,
  WORDMARK_CENTER_X,
  WORDMARK_HEIGHT,
  WORDMARK_VIEWBOX_HEIGHT,
  WORDMARK_VIEWBOX_WIDTH,
  WORDMARK_WIDTH,
  WORDMARK_Y,
} from "../layout";
import { renderInstagramRecipe } from "../index";

const EMPTY_PNG = "data:image/png;base64,iVBORw0KGgo=";
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />';
const BARBELL_ASSET_PATH = resolve(__dirname, "../assets/nutrition/barbell-header-frame.svg");
const WORDMARK_ASSET_PATH = resolve(__dirname, "../assets/branding/micha-logo-writing.svg");

type PixelImage = Awaited<ReturnType<typeof decodePng>>;

function createComposeAssets(): ComposeAssets {
  return {
    photo: { src: EMPTY_PNG, width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    nutritionHighlights: {
      "high-protein": EMPTY_PNG,
      "low-fat": EMPTY_PNG,
    },
    recipeMetaIcons: {
      totalTime: EMPTY_SVG,
      portions: EMPTY_SVG,
      difficulty: EMPTY_SVG,
    },
    barbell: EMPTY_SVG,
    wordmark: EMPTY_PNG,
  };
}

function childElements(element: SatoriElement): SatoriElement[] {
  const children = element.props.children;
  if (!Array.isArray(children)) {
    return children && typeof children === "object" ? [children] : [];
  }
  return children.filter((child): child is SatoriElement => {
    return Boolean(child) && typeof child === "object" && !Array.isArray(child);
  });
}

function styleOf(element: SatoriElement): Record<string, unknown> {
  return element.props.style as Record<string, unknown>;
}

function findNutritionNodes(root: SatoriElement): {
  card: SatoriElement;
  valueRow: SatoriElement;
  dividers: SatoriElement[];
  barbell: SatoriElement;
  proPortion: SatoriElement;
  wordmark: SatoriElement;
} {
  const children = childElements(root);
  const card = children.find((child) => {
    return child.props["data-render-node"] === "nutrition-card";
  });
  const cardChildren = card ? childElements(card) : [];
  const valueRow = cardChildren.find(
    (child) => child.props["data-render-node"] === "nutrition-value-row",
  );
  const dividers = cardChildren.filter(
    (child) => child.props["data-render-node"] === "nutrition-divider",
  );
  const barbell = children.find((child) => {
    return child.props["data-render-node"] === "barbell";
  });
  const proPortion = children.find((child) => {
    return child.props["data-render-node"] === "pro-portion";
  });
  const wordmark = children.find((child) => {
    return child.props["data-render-node"] === "wordmark";
  });

  if (!card || !valueRow || dividers.length !== NUTRITION_DIVIDER_X.length || !barbell || !proPortion || !wordmark) {
    throw new Error("Nutrition footer nodes are missing from the compose tree.");
  }

  return { card, valueRow, dividers, barbell, proPortion, wordmark };
}

async function decodePng(input: Buffer): Promise<{
  data: Buffer;
  info: { width: number; height: number; channels: number };
}> {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pixelAt(image: PixelImage, x: number, y: number): [number, number, number, number] {
  const offset = (y * image.info.width + x) * image.info.channels;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3],
  ];
}

function isMetalPixel(image: PixelImage, x: number, y: number): boolean {
  const [red, green, blue, alpha] = pixelAt(image, x, y);
  if (alpha < 240) {
    return false;
  }
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return brightest >= 35 && brightest - darkest <= 45;
}

function isLimePixel(image: PixelImage, x: number, y: number): boolean {
  const [red, green, blue, alpha] = pixelAt(image, x, y);
  return alpha >= 240 && green - red >= 20 && green >= 160 && blue <= 110;
}

function countMetalPixels(
  image: PixelImage,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): number {
  let count = 0;
  for (let y = Math.floor(yStart); y < Math.ceil(yEnd); y += 1) {
    for (let x = Math.ceil(xStart); x < Math.floor(xEnd); x += 1) {
      if (isMetalPixel(image, x, y)) {
        count += 1;
      }
    }
  }
  return count;
}

function countLimePixels(
  image: PixelImage,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): { count: number; minX: number; maxX: number; minY: number; maxY: number } {
  let count = 0;
  let minX = xEnd;
  let maxX = xStart;
  let minY = yEnd;
  let maxY = yStart;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      if (!isLimePixel(image, x, y)) {
        continue;
      }
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return { count, minX, maxX, minY, maxY };
}

function countMetalRows(
  image: PixelImage,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): number[] {
  const rows: number[] = [];
  for (let y = Math.floor(yStart); y < Math.ceil(yEnd); y += 1) {
    if (countMetalPixels(image, xStart, xEnd, y, y + 1) > 0) {
      rows.push(y);
    }
  }
  return rows;
}

type PixelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function findMetalBounds(
  image: PixelImage,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): PixelBounds | undefined {
  let minX = Math.ceil(xEnd);
  let maxX = Math.floor(xStart);
  let minY = Math.ceil(yEnd);
  let maxY = Math.floor(yStart);

  for (let y = Math.floor(yStart); y < Math.ceil(yEnd); y += 1) {
    for (let x = Math.ceil(xStart); x < Math.floor(xEnd); x += 1) {
      if (!isMetalPixel(image, x, y)) {
        continue;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX >= minX && maxY >= minY ? { minX, maxX, minY, maxY } : undefined;
}

function countWordmarkPixels(
  image: PixelImage,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): { count: number; minX: number; maxX: number; minY: number; maxY: number } {
  let count = 0;
  let minX = xEnd;
  let maxX = xStart;
  let minY = yEnd;
  let maxY = yStart;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const [red, green, blue, alpha] = pixelAt(image, x, y);
      if (alpha < 240 || Math.max(red, green, blue) <= 60) {
        continue;
      }
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return { count, minX, maxX, minY, maxY };
}

function colorDistance(
  first: [number, number, number, number],
  second: [number, number, number, number],
): number {
  return Math.max(
    Math.abs(first[0] - second[0]),
    Math.abs(first[1] - second[1]),
    Math.abs(first[2] - second[2]),
  );
}

function toDataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function renderNutritionComparison(barbell: string): Promise<Buffer> {
  const assetRoot = resolve(__dirname, "../assets");
  const photoBuffer = readFileSync(quarkbroetchenFixture.image.path);
  const photoMetadata = await sharp(photoBuffer).metadata();
  if (!photoMetadata.width || !photoMetadata.height) {
    throw new Error("The nutrition comparison photo has no dimensions.");
  }

  const assets: ComposeAssets = {
    photo: {
      src: toDataUri(photoBuffer, "image/png"),
      width: photoMetadata.width,
      height: photoMetadata.height,
    },
    nutritionHighlights: {
      "high-protein": toDataUri(
        readFileSync(resolve(assetRoot, "nutrition-highlights/high-protein.png")),
        "image/png",
      ),
      "low-fat": toDataUri(
        readFileSync(resolve(assetRoot, "nutrition-highlights/low-fat.png")),
        "image/png",
      ),
    },
    recipeMetaIcons: {
      totalTime: EMPTY_SVG,
      portions: EMPTY_SVG,
      difficulty: EMPTY_SVG,
    },
    barbell,
    wordmark: toDataUri(
      readFileSync(resolve(assetRoot, "branding/fittrack-wordmark.png")),
      "image/png",
    ),
  };

  const svg = await satori(compose(quarkbroetchenFixture, assets) as never, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    fonts: [
      { name: "Inter", weight: 500, data: readFileSync(resolve(assetRoot, "fonts/Inter-Medium.ttf")) },
      { name: "Inter", weight: 600, data: readFileSync(resolve(assetRoot, "fonts/Inter-SemiBold.ttf")) },
      {
        name: "InterDisplay",
        weight: 700,
        data: readFileSync(resolve(assetRoot, "fonts/InterDisplay-Bold.ttf")),
      },
    ],
    embedFont: true,
  });

  return new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
}

function isLimePixelAt(image: PixelImage, x: number, y: number): boolean {
  const [red, green, blue, alpha] = pixelAt(image, x, y);
  return alpha >= 240 && green - red >= 20 && green >= 140 && blue <= 130;
}

function isExactColor(
  image: PixelImage,
  x: number,
  y: number,
  color: [number, number, number, number],
): boolean {
  return pixelAt(image, x, y).every((channel, index) => channel === color[index]);
}

describe("Instagram recipe renderer nutrition layout", () => {
  it("keeps the PRO PORTION label free of foreign horizontal pixels", async () => {
    const [normalBuffer, barbellFreeBuffer] = await Promise.all([
      renderNutritionComparison(readFileSync(BARBELL_ASSET_PATH, "utf8")),
      renderNutritionComparison('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 904 64" />'),
    ]);
    const [normal, barbellFree] = await Promise.all([
      decodePng(normalBuffer),
      decodePng(barbellFreeBuffer),
    ]);
    const region = { left: 466, right: 614, top: 1038, bottom: 1059 };
    const dividerColor: [number, number, number, number] = [55, 70, 61, 255];
    let differences = 0;
    let nonLimeDifferences = 0;
    let dividerPixels = 0;

    for (let y = region.top; y < region.bottom; y += 1) {
      for (let x = region.left; x < region.right; x += 1) {
        const normalPixel = pixelAt(normal, x, y);
        const barbellFreePixel = pixelAt(barbellFree, x, y);
        if (!normalPixel.every((channel, index) => channel === barbellFreePixel[index])) {
          differences += 1;
          if (!isLimePixelAt(normal, x, y) && !isLimePixelAt(barbellFree, x, y)) {
            nonLimeDifferences += 1;
          }
        }
        if (y === BARBELL_SHAFT_CENTER_Y && isExactColor(normal, x, y, dividerColor)) {
          dividerPixels += 1;
        }
      }
    }

    expect(differences).toBe(0);
    expect(nonLimeDifferences).toBe(0);
    expect(dividerPixels).toBe(0);
  });

  it("renders the complete symmetric barbell above the card and integrates PRO PORTION", async () => {
    const result = await renderInstagramRecipe(quarkbroetchenFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.width).toBe(CANVAS_WIDTH);
    expect(result.height).toBe(CANVAS_HEIGHT);
    expect(result.format).toBe("png");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    const image = await decodePng(result.buffer);
    expect(image.info.width).toBe(CANVAS_WIDTH);
    expect(image.info.height).toBe(CANVAS_HEIGHT);
    expect(image.info.channels).toBe(4);

    const barbellPixelTop = Math.floor(BARBELL_Y);
    const barbellPixelBottom = Math.ceil(BARBELL_Y + BARBELL_HEIGHT);
    const leftPlatePixels = countMetalPixels(
      image,
      BARBELL_X,
      BARBELL_X + 60,
      barbellPixelTop,
      barbellPixelBottom,
    );
    const rightPlatePixels = countMetalPixels(
      image,
      BARBELL_X + BARBELL_WIDTH - 60,
      BARBELL_X + BARBELL_WIDTH,
      barbellPixelTop,
      barbellPixelBottom,
    );
    const leftPlateBounds = findMetalBounds(
      image,
      BARBELL_X,
      BARBELL_X + 60,
      barbellPixelTop,
      barbellPixelBottom,
    );
    const rightPlateBounds = findMetalBounds(
      image,
      BARBELL_X + BARBELL_WIDTH - 60,
      BARBELL_X + BARBELL_WIDTH,
      barbellPixelTop,
      barbellPixelBottom,
    );

    expect(leftPlatePixels).toBeGreaterThan(240);
    expect(rightPlatePixels).toBeGreaterThan(240);
    expect(Math.abs(leftPlatePixels - rightPlatePixels)).toBeLessThanOrEqual(2);
    expect(leftPlateBounds).toBeDefined();
    expect(rightPlateBounds).toBeDefined();
    if (!leftPlateBounds || !rightPlateBounds) {
      return;
    }

    expect(leftPlateBounds.minX).toBeGreaterThanOrEqual(BARBELL_X);
    expect(rightPlateBounds.maxX).toBeLessThanOrEqual(BARBELL_X + BARBELL_WIDTH - 1);
    const leftVisibleInset = leftPlateBounds.minX - NUTRITION_CARD_X;
    const rightVisibleInset =
      NUTRITION_CARD_X + NUTRITION_CARD_WIDTH - (rightPlateBounds.maxX + 1);
    expect(leftVisibleInset).toBeGreaterThanOrEqual(BARBELL_CARD_INSET);
    expect(rightVisibleInset).toBeGreaterThanOrEqual(BARBELL_CARD_INSET);
    expect(Math.abs(leftVisibleInset - rightVisibleInset)).toBeLessThanOrEqual(1);
    expect(leftPlateBounds.minY).toBe(1025);
    expect(rightPlateBounds.minY).toBe(1025);
    expect(leftPlateBounds.maxY).toBe(1070);
    expect(rightPlateBounds.maxY).toBe(1070);
    expect(leftPlateBounds.minY).toBeGreaterThanOrEqual(barbellPixelTop);
    expect(rightPlateBounds.maxY).toBeLessThan(barbellPixelBottom);

    const leftRows = countMetalRows(
      image,
      BARBELL_X,
      BARBELL_X + 60,
      barbellPixelTop,
      barbellPixelBottom,
    );
    const rightRows = countMetalRows(
      image,
      BARBELL_X + BARBELL_WIDTH - 60,
      BARBELL_X + BARBELL_WIDTH,
      barbellPixelTop,
      barbellPixelBottom,
    );
    expect(leftRows[0]).toBe(1025);
    expect(rightRows[0]).toBe(1025);
    expect(leftRows.at(-1)).toBe(1070);
    expect(rightRows.at(-1)).toBe(1070);
    expect(leftRows).toEqual(rightRows);

    const shaftRows = countMetalRows(
      image,
      BARBELL_X + 212,
      BARBELL_X + 232,
      barbellPixelTop,
      barbellPixelBottom,
    );
    expect(shaftRows).toEqual([1045, 1046, 1047, 1048, 1049, 1050]);
    expect(shaftRows[0]).toBe(Math.floor(BARBELL_SHAFT_TOP_Y));
    expect(BARBELL_SHAFT_TOP_Y).toBeCloseTo(1045.265487, 5);
    expect(BARBELL_SHAFT_CENTER_Y).toBe(NUTRITION_FOOTER_TOP_Y);
    expect(Math.abs((shaftRows[0] + shaftRows.at(-1)!) / 2 - NUTRITION_FOOTER_TOP_Y)).toBeLessThanOrEqual(1);

    for (let y = barbellPixelTop; y < barbellPixelBottom; y += 1) {
      for (let offset = 2; offset < 58; offset += 1) {
        expect(isMetalPixel(image, BARBELL_X + offset, y)).toBe(
          isMetalPixel(image, BARBELL_X + BARBELL_WIDTH - 1 - offset, y),
        );
      }
    }

    const asset = readFileSync(BARBELL_ASSET_PATH, "utf8");
    expect(asset).toMatch(/viewBox="0 0 904 64"/);
    expect(asset).toMatch(/transform="translate\(904 0\) scale\(-1 1\)"/);
    expect(asset).toMatch(/<rect x="55" y="29" width="311" height="6"/);
    expect(BARBELL_CARD_INSET).toBe(40);
    expect(BARBELL_SCALE).toBe((NUTRITION_CARD_WIDTH - BARBELL_CARD_INSET * 2) / BARBELL_VIEWBOX_WIDTH);
    expect(BARBELL_X).toBe(128);
    expect(BARBELL_WIDTH).toBe(824);
    expect(BARBELL_WIDTH).toBeLessThan(NUTRITION_CARD_WIDTH);
    expect(BARBELL_X - NUTRITION_CARD_X).toBe(BARBELL_CARD_INSET);
    expect(NUTRITION_CARD_X + NUTRITION_CARD_WIDTH - (BARBELL_X + BARBELL_WIDTH)).toBe(BARBELL_CARD_INSET);
    expect(BARBELL_X + BARBELL_WIDTH / 2).toBe(CANVAS_WIDTH / 2);
    expect(BARBELL_VIEWBOX_WIDTH / BARBELL_VIEWBOX_HEIGHT).toBe(904 / 64);
    expect(BARBELL_WIDTH / BARBELL_HEIGHT).toBeCloseTo(BARBELL_VIEWBOX_WIDTH / BARBELL_VIEWBOX_HEIGHT, 12);
    expect(BARBELL_HEIGHT).toBeCloseTo(58.336283, 5);

    const tree = compose(quarkbroetchenFixture, createComposeAssets());
    const { card, valueRow, dividers, barbell, proPortion, wordmark } = findNutritionNodes(tree);
    const rootChildren = childElements(tree);
    const cardIndex = rootChildren.indexOf(card);
    const barbellIndex = rootChildren.indexOf(barbell);
    const proPortionIndex = rootChildren.indexOf(proPortion);
    const wordmarkIndex = rootChildren.indexOf(wordmark);
    const photoLayer = rootChildren[1];
    const transitionLayer = rootChildren[2];
    const titleLayer = rootChildren.find((child) => {
      return childElements(child).some((nested) => nested.props["data-render-node"] === "title");
    });
    const tagRow = rootChildren.find((child) => {
      const style = styleOf(child);
      return style.top === TAG_ROW_Y && style.height === TAG_CHIP_HEIGHT;
    });
    const highlightLayer = rootChildren.find((child) => {
      const style = styleOf(child);
      return style.top === HIGHLIGHT_BADGE_TOP && style.width === HIGHLIGHT_BADGE_SIZE;
    });

    expect(cardIndex).toBeGreaterThanOrEqual(0);
    expect(barbellIndex).toBeGreaterThan(cardIndex);
    expect(proPortionIndex).toBeGreaterThan(barbellIndex);
    expect(wordmarkIndex).toBe(rootChildren.length - 1);
    expect(photoLayer).toBeDefined();
    expect(transitionLayer).toBeDefined();
    expect(titleLayer).toBeDefined();
    expect(tagRow).toBeDefined();
    expect(highlightLayer).toBeDefined();
    if (!photoLayer || !transitionLayer || !titleLayer || !tagRow || !highlightLayer) {
      return;
    }

    expect(PHOTO_TRANSITION_END_Y).toBe(1015);
    expect(HERO_HEIGHT).toBe(PHOTO_TRANSITION_END_Y);
    expect(NUTRITION_CARD_Y - PHOTO_TRANSITION_END_Y).toBe(33);
    expect(styleOf(photoLayer).top).toBe(0);
    expect(styleOf(photoLayer).height).toBe(PHOTO_TRANSITION_END_Y);
    expect(styleOf(transitionLayer).top).toBe(PHOTO_TRANSITION_START_Y);
    expect(styleOf(transitionLayer).height).toBe(PHOTO_TRANSITION_END_Y - PHOTO_TRANSITION_START_Y);
    expect(styleOf(transitionLayer).top + styleOf(transitionLayer).height).toBe(PHOTO_TRANSITION_END_Y);
    expect(styleOf(titleLayer).top).toBe(TITLE_Y);
    expect(styleOf(tagRow).top).toBe(TAG_ROW_Y);
    expect(styleOf(tagRow).height).toBe(TAG_CHIP_HEIGHT);
    expect(styleOf(highlightLayer).left).toBe(
      CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT - HIGHLIGHT_BADGE_SIZE,
    );
    expect(styleOf(highlightLayer).top).toBe(HIGHLIGHT_BADGE_TOP);
    expect(styleOf(card).overflow).toBe("hidden");
    expect(styleOf(card).left).toBe(NUTRITION_CARD_X);
    expect(styleOf(card).top).toBe(NUTRITION_CARD_Y);
    expect(styleOf(card).width).toBe(NUTRITION_CARD_WIDTH);
    expect(styleOf(card).height).toBe(NUTRITION_CARD_HEIGHT);
    expect(styleOf(card).borderRadius).toBe(NUTRITION_CARD_RADIUS);
    expect(styleOf(card).border).toBe(`${NUTRITION_CARD_BORDER_WIDTH}px solid ${COLOR_DIVIDER}`);
    expect(styleOf(card).borderTopColor).toBe("transparent");
    expect(styleOf(card).backgroundImage).toContain(COLOR_DIVIDER);
    expect(styleOf(card).backgroundColor).toBe(COLOR_PANEL);
    expect(NUTRITION_CARD_BOTTOM_Y).toBe(NUTRITION_CARD_Y + NUTRITION_CARD_HEIGHT);
    expect(NUTRITION_CARD_BOTTOM_Y).toBe(1192);

    const valueRowStyle = styleOf(valueRow);
    expect(valueRowStyle.left).toBe(
      NUTRITION_VALUE_ROW_X - NUTRITION_CARD_X - NUTRITION_CARD_BORDER_WIDTH,
    );
    expect(valueRowStyle.top).toBe(
      NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_CARD_Y - NUTRITION_CARD_BORDER_WIDTH,
    );
    expect(valueRowStyle.width).toBe(NUTRITION_VALUE_ROW_WIDTH);
    expect(valueRowStyle.height).toBe(NUTRITION_VALUE_ROW_HEIGHT);
    expect(NUTRITION_VALUE_ROW_X).toBe(120);
    expect(NUTRITION_VALUE_ROW_TOP_Y).toBe(1062);
    expect(NUTRITION_VALUE_ROW_BOTTOM_Y).toBe(1182);
    expect(NUTRITION_VALUE_ROW_WIDTH).toBe(840);
    expect(NUTRITION_VALUE_ROW_HEIGHT).toBe(120);

    expect(dividers.map((divider) => styleOf(divider).left)).toEqual(
      NUTRITION_DIVIDER_X.map((x) => x - NUTRITION_CARD_X - NUTRITION_CARD_BORDER_WIDTH),
    );
    expect(
      dividers.every(
        (divider) =>
          styleOf(divider).top ===
          NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_CARD_Y - NUTRITION_CARD_BORDER_WIDTH,
      ),
    ).toBe(true);
    expect(dividers.every((divider) => styleOf(divider).width === NUTRITION_DIVIDER_WIDTH)).toBe(true);
    expect(dividers.every((divider) => styleOf(divider).height === NUTRITION_DIVIDER_HEIGHT)).toBe(true);
    expect(NUTRITION_DIVIDER_X).toEqual([330, 540, 750]);
    expect(NUTRITION_DIVIDER_HEIGHT).toBe(120);

    for (const dividerX of NUTRITION_DIVIDER_X) {
      expect(pixelAt(image, dividerX, NUTRITION_VALUE_ROW_TOP_Y + 20)).toEqual([55, 70, 61, 255]);
      expect(pixelAt(image, dividerX, NUTRITION_VALUE_ROW_BOTTOM_Y - 1)).toEqual([55, 70, 61, 255]);
      expect(pixelAt(image, dividerX, NUTRITION_VALUE_ROW_BOTTOM_Y)).not.toEqual([55, 70, 61, 255]);
    }

    const valueColumns = childElements(valueRow);
    expect(valueColumns.map((column) => styleOf(childElements(column)[0]).fontSize)).toEqual([
      NUTRITION_VALUE_FONT_SIZE,
      NUTRITION_VALUE_FONT_SIZE,
      NUTRITION_VALUE_FONT_SIZE,
      NUTRITION_VALUE_FONT_SIZE,
    ]);
    expect(valueColumns.map((column) => styleOf(childElements(column)[1]).fontSize)).toEqual([
      NUTRITION_LABEL_FONT_SIZE,
      NUTRITION_LABEL_FONT_SIZE,
      NUTRITION_LABEL_FONT_SIZE,
      NUTRITION_LABEL_FONT_SIZE,
    ]);
    expect(valueColumns.map((column) => childElements(column)[0]?.props.children)).toEqual([
      "250 kcal",
      "14 g",
      "31 g",
      "8 g",
    ]);
    expect(valueColumns.map((column) => childElements(column)[1]?.props.children)).toEqual([
      "Kalorien",
      "Protein",
      "Kohlenhydrate",
      "Fett",
    ]);

    expect(styleOf(barbell).top).toBe(BARBELL_Y);
    expect(styleOf(barbell).left).toBe(BARBELL_X);
    expect(styleOf(barbell).width).toBe(BARBELL_WIDTH);
    expect(styleOf(barbell).height).toBe(BARBELL_HEIGHT);
    expect(styleOf(barbell).objectFit).toBeUndefined();
    expect(childElements(card)).not.toContain(barbell);
    expect(BARBELL_VIEWBOX_SHAFT_TOP_OFFSET_Y).toBe(29);
    expect(BARBELL_SHAFT_TOP_OFFSET_Y).toBeCloseTo(
      BARBELL_VIEWBOX_SHAFT_TOP_OFFSET_Y * BARBELL_SCALE,
      12,
    );
    expect(BARBELL_SHAFT_HEIGHT).toBeCloseTo(6 * BARBELL_SCALE, 12);
    expect(BARBELL_SHAFT_TOP_Y).toBeCloseTo(1045.265487, 5);
    expect(BARBELL_SHAFT_CENTER_Y).toBe(1048);
    expect(BARBELL_Y).toBeCloseTo(1018.831858, 5);
    expect(BARBELL_Y).toBeGreaterThanOrEqual(0);
    expect(BARBELL_Y + BARBELL_HEIGHT).toBeLessThanOrEqual(CANVAS_HEIGHT);
    expect(BARBELL_SHAFT_TOP_Y).not.toBe(NUTRITION_VALUE_ROW_TOP_Y);

    const proPortionStyle = styleOf(proPortion);
    expect(proPortionStyle.left).toBe(PRO_PORTION_CENTER_X - PRO_PORTION_WIDTH / 2);
    expect(proPortionStyle.top).toBe(PRO_PORTION_TOP);
    expect(PRO_PORTION_CENTER_Y).toBe(BARBELL_SHAFT_CENTER_Y);
    expect(PRO_PORTION_TOP).toBe(1034);
    expect(proPortion.props.children).toBe("PRO PORTION");
    expect(proPortionStyle.color).toBe(COLOR_LIME);
    expect(proPortionStyle.backgroundColor).toBeUndefined();
    expect(proPortionStyle.background).toBeUndefined();
    expect(proPortionStyle.border).toBeUndefined();
    expect(proPortionStyle.boxShadow).toBeUndefined();

    const labelTop = PRO_PORTION_TOP;
    const labelLeft = PRO_PORTION_CENTER_X - PRO_PORTION_WIDTH / 2;
    const labelRight = labelLeft + PRO_PORTION_WIDTH;
    const labelPixels = countLimePixels(
      image,
      labelLeft,
      labelRight,
      labelTop,
      labelTop + PRO_PORTION_HEIGHT,
    );
    expect(labelPixels.count).toBeGreaterThan(100);
    expect(labelPixels.minX).toBeGreaterThanOrEqual(470);
    expect(labelPixels.maxX).toBeLessThanOrEqual(610);
    expect(labelPixels.minY).toBeGreaterThanOrEqual(1037);
    expect(labelPixels.minY).toBeLessThanOrEqual(1043);
    expect(labelPixels.maxY).toBeGreaterThanOrEqual(1051);
    expect(labelPixels.maxY).toBeLessThanOrEqual(1057);
    expect(Math.abs((labelPixels.minX + labelPixels.maxX) / 2 - PRO_PORTION_CENTER_X)).toBeLessThanOrEqual(1);
    expect(Math.abs((labelPixels.minY + labelPixels.maxY) / 2 - BARBELL_SHAFT_CENTER_Y)).toBeLessThanOrEqual(2);

    const ambientLabelPixel = pixelAt(image, labelLeft, labelTop);
    const adjacentAmbientPixel = pixelAt(image, labelLeft - 1, labelTop);
    expect(colorDistance(ambientLabelPixel, adjacentAmbientPixel)).toBeLessThanOrEqual(1);

    for (let y = labelTop; y < BARBELL_SHAFT_TOP_Y; y += 1) {
      expect(colorDistance(pixelAt(image, labelLeft + 2, y), pixelAt(image, labelLeft - 1, y))).toBeLessThanOrEqual(1);
      expect(colorDistance(pixelAt(image, labelRight - 3, y), pixelAt(image, labelRight, y))).toBeLessThanOrEqual(1);
    }

    expect(isMetalPixel(image, labelLeft + 10, BARBELL_SHAFT_CENTER_Y)).toBe(true);
    expect(isMetalPixel(image, labelRight - 10, BARBELL_SHAFT_CENTER_Y)).toBe(true);

    expect(pixelAt(image, labelLeft, labelTop)).toEqual(pixelAt(image, labelLeft - 1, labelTop));
    expect(pixelAt(image, labelRight - 1, labelTop)).toEqual(pixelAt(image, labelRight, labelTop));

    const wordmarkStyle = styleOf(wordmark);
    expect(wordmarkStyle.left).toBe(WORDMARK_CENTER_X - WORDMARK_WIDTH / 2);
    expect(wordmarkStyle.top).toBe(WORDMARK_Y);
    expect(wordmarkStyle.width).toBe(WORDMARK_WIDTH);
    expect(wordmarkStyle.height).toBe(WORDMARK_HEIGHT);
    expect(WORDMARK_WIDTH).toBe(160);
    expect(WORDMARK_HEIGHT).toBeCloseTo(
      (WORDMARK_WIDTH * WORDMARK_VIEWBOX_HEIGHT) / WORDMARK_VIEWBOX_WIDTH,
      12,
    );
    expect(WORDMARK_Y).toBe(1242);
    expect(CANVAS_HEIGHT - (WORDMARK_Y + WORDMARK_HEIGHT)).toBeCloseTo(WORDMARK_BOTTOM_CLEARANCE, 12);

    const wordmarkLeft = WORDMARK_CENTER_X - WORDMARK_WIDTH / 2;
    const wordmarkRight = wordmarkLeft + WORDMARK_WIDTH;
    const wordmarkBottomY = WORDMARK_Y + WORDMARK_HEIGHT;
    const wordmarkPixels = countWordmarkPixels(
      image,
      wordmarkLeft,
      wordmarkRight,
      WORDMARK_Y,
      wordmarkBottomY,
    );
    expect(wordmarkPixels.count).toBeGreaterThan(100);
    expect(wordmarkPixels.maxX - wordmarkPixels.minX + 1).toBeGreaterThanOrEqual(150);
    expect(wordmarkPixels.maxX - wordmarkPixels.minX + 1).toBeLessThanOrEqual(180);
    expect(Math.abs(wordmarkPixels.minY - WORDMARK_Y)).toBeLessThanOrEqual(1);
    expect(Math.abs(wordmarkPixels.maxY - (Math.ceil(wordmarkBottomY) - 1))).toBeLessThanOrEqual(1);
    expect(Math.abs((wordmarkPixels.minX + wordmarkPixels.maxX) / 2 - WORDMARK_CENTER_X)).toBeLessThanOrEqual(1);

    const wordmarkAsset = readFileSync(WORDMARK_ASSET_PATH, "utf8");
    expect(wordmarkAsset).toMatch(/viewBox="0 0 1197\.24 197\.35"/);
    expect(wordmarkAsset).not.toMatch(/<rect\b/i);
    expect(wordmarkAsset).not.toMatch(/#0e110f/i);
    expect(NUTRITION_CARD_BOTTOM_Y).toBe(1192);
    expect(WORDMARK_Y).toBe(1242);
    expect(CANVAS_HEIGHT).toBe(1350);
    expect(PHOTO_TRANSITION_END_Y).toBe(1015);
    expect(NUTRITION_CARD_Y - PHOTO_TRANSITION_END_Y).toBe(33);
    expect(NUTRITION_FOOTER_TOP_Y - BARBELL_SHAFT_CENTER_Y).toBe(0);
    expect(NUTRITION_VALUE_ROW_TOP_Y - NUTRITION_FOOTER_TOP_Y).toBe(14);
    expect(WORDMARK_Y - NUTRITION_CARD_BOTTOM_Y).toBe(50);
    expect(wordmarkBottomY - WORDMARK_Y).toBeCloseTo(WORDMARK_HEIGHT, 12);
    expect(CANVAS_HEIGHT - wordmarkBottomY).toBeCloseTo(WORDMARK_BOTTOM_CLEARANCE, 12);

    const smokeTree = compose(smokeFixture, createComposeAssets());
    const smokeNodes = findNutritionNodes(smokeTree);
    expect(styleOf(smokeNodes.card).top).toBe(NUTRITION_CARD_Y);
    expect(styleOf(smokeNodes.wordmark).top).toBe(WORDMARK_Y);
  });

  it("keeps the null-highlight smoke fixture renderable", async () => {
    const highlightedResult = await renderInstagramRecipe(quarkbroetchenFixture);
    const result = await renderInstagramRecipe(smokeFixture);

    expect(highlightedResult.ok).toBe(true);
    expect(result.ok).toBe(true);
    if (!highlightedResult.ok || !result.ok) {
      return;
    }

    expect(result.width).toBe(CANVAS_WIDTH);
    expect(result.height).toBe(CANVAS_HEIGHT);
    expect(result.format).toBe("png");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    const highlightedImage = await decodePng(highlightedResult.buffer);
    const smokeImage = await decodePng(result.buffer);
    const wordmarkLeft = WORDMARK_CENTER_X - WORDMARK_WIDTH / 2;
    const wordmarkRight = wordmarkLeft + WORDMARK_WIDTH;
    const wordmarkBottomY = WORDMARK_Y + WORDMARK_HEIGHT;
    const highlightedWordmark = countWordmarkPixels(
      highlightedImage,
      wordmarkLeft,
      wordmarkRight,
      WORDMARK_Y,
      wordmarkBottomY,
    );
    const smokeWordmark = countWordmarkPixels(
      smokeImage,
      wordmarkLeft,
      wordmarkRight,
      WORDMARK_Y,
      wordmarkBottomY,
    );
    expect(smokeWordmark).toEqual(highlightedWordmark);

    const highlightedBarbell = findMetalBounds(
      highlightedImage,
      BARBELL_X,
      BARBELL_X + 60,
      Math.floor(BARBELL_Y),
      Math.ceil(BARBELL_Y + BARBELL_HEIGHT),
    );
    const smokeBarbell = findMetalBounds(
      smokeImage,
      BARBELL_X,
      BARBELL_X + 60,
      Math.floor(BARBELL_Y),
      Math.ceil(BARBELL_Y + BARBELL_HEIGHT),
    );
    expect(smokeBarbell).toEqual(highlightedBarbell);

    const highlightedLabel = countLimePixels(
      highlightedImage,
      PRO_PORTION_CENTER_X - PRO_PORTION_WIDTH / 2,
      PRO_PORTION_CENTER_X + PRO_PORTION_WIDTH / 2,
      PRO_PORTION_TOP,
      PRO_PORTION_TOP + PRO_PORTION_HEIGHT,
    );
    const smokeLabel = countLimePixels(
      smokeImage,
      PRO_PORTION_CENTER_X - PRO_PORTION_WIDTH / 2,
      PRO_PORTION_CENTER_X + PRO_PORTION_WIDTH / 2,
      PRO_PORTION_TOP,
      PRO_PORTION_TOP + PRO_PORTION_HEIGHT,
    );
    expect(smokeLabel).toEqual(highlightedLabel);

    const highlightedNodes = findNutritionNodes(compose(quarkbroetchenFixture, createComposeAssets()));
    const smokeNodes = findNutritionNodes(compose(smokeFixture, createComposeAssets()));
    expect(styleOf(smokeNodes.card)).toEqual(styleOf(highlightedNodes.card));
    expect(styleOf(smokeNodes.barbell)).toEqual(styleOf(highlightedNodes.barbell));
    expect(styleOf(smokeNodes.proPortion)).toEqual(styleOf(highlightedNodes.proPortion));
    expect(styleOf(smokeNodes.wordmark)).toEqual(styleOf(highlightedNodes.wordmark));
    expect(styleOf(smokeNodes.card).top).toBe(NUTRITION_CARD_Y);
    expect(styleOf(smokeNodes.barbell).top).toBe(BARBELL_Y);
    expect(styleOf(smokeNodes.proPortion).top).toBe(PRO_PORTION_TOP);
    expect(styleOf(smokeNodes.wordmark).top).toBe(WORDMARK_Y);
  });
});