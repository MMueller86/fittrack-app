import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { renderInstagramRecipe } from "../index";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_LIME,
  HIGHLIGHT_BADGE_RIGHT,
  HIGHLIGHT_BADGE_SIZE,
  HIGHLIGHT_BADGE_TOP,
} from "../layout";

const HIGH_PROTEIN_ASSET_PATH = resolve(
  __dirname,
  "../assets/nutrition-highlights/high-protein.png",
);

async function decode(input: Buffer) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function alphaBounds(
  image: Awaited<ReturnType<typeof decode>>,
  minimumAlpha: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = image.info.width;
  let maxX = -1;
  let minY = image.info.height;
  let maxY = -1;
  for (let y = 0; y < image.info.height; y += 1) {
    for (let x = 0; x < image.info.width; x += 1) {
      const alpha = image.data[(y * image.info.width + x) * image.info.channels + 3];
      if (alpha < minimumAlpha) {
        continue;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
}

function isAccent(red: number, green: number, blue: number): boolean {
  return green - red >= 25 && green - blue >= 25 && green >= 40;
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const linearize = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  );
}

function isLimePixel(data: Buffer, offset: number): boolean {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return green - red >= 20 && green >= 180 && blue <= 90;
}

function countDifferencesOutsideBadge(actual: Buffer, expected: Buffer): number {
  const badgeLeft = CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT - HIGHLIGHT_BADGE_SIZE;
  let differences = 0;

  for (let y = 0; y < CANVAS_HEIGHT; y += 1) {
    for (let x = 0; x < CANVAS_WIDTH; x += 1) {
      if (
        x >= badgeLeft &&
        x < badgeLeft + HIGHLIGHT_BADGE_SIZE &&
        y >= HIGHLIGHT_BADGE_TOP &&
        y < HIGHLIGHT_BADGE_TOP + HIGHLIGHT_BADGE_SIZE
      ) {
        continue;
      }

      const offset = (y * CANVAS_WIDTH + x) * 4;
      if (
        actual[offset] !== expected[offset] ||
        actual[offset + 1] !== expected[offset + 1] ||
        actual[offset + 2] !== expected[offset + 2] ||
        actual[offset + 3] !== expected[offset + 3]
      ) {
        differences += 1;
      }
    }
  }

  return differences;
}

describe("Instagram recipe renderer nutrition highlights", () => {
  it("keeps the high-protein asset in the renderer palette with stable alpha bounds", async () => {
    const image = await decode(readFileSync(HIGH_PROTEIN_ASSET_PATH));
    const metadata = await sharp(readFileSync(HIGH_PROTEIN_ASSET_PATH)).metadata();

    expect(metadata.width).toBe(1254);
    expect(metadata.height).toBe(1254);
    expect(metadata.channels).toBe(4);
    expect(metadata.hasAlpha).toBe(true);
    expect(alphaBounds(image, 240)).toEqual({
      minX: 98,
      maxX: 1156,
      minY: 98,
      maxY: 1142,
    });

    const accentHistogram = new Map<string, number>();
    let darkLuminanceSum = 0;
    let darkPixelCount = 0;
    let whiteLuminanceSum = 0;
    let whitePixelCount = 0;
    for (let y = 0; y < image.info.height; y += 1) {
      for (let x = 0; x < image.info.width; x += 1) {
        const offset = (y * image.info.width + x) * image.info.channels;
        const red = image.data[offset];
        const green = image.data[offset + 1];
        const blue = image.data[offset + 2];
        const alpha = image.data[offset + 3];
        if (alpha < 240) {
          continue;
        }
        if (isAccent(red, green, blue)) {
          const key = `${red},${green},${blue}`;
          accentHistogram.set(key, (accentHistogram.get(key) ?? 0) + 1);
        }
        const luminance = relativeLuminance(red, green, blue);
        if (luminance < 0.03) {
          darkLuminanceSum += luminance;
          darkPixelCount += 1;
        }
        if (red >= 240 && green >= 240 && blue >= 240) {
          whiteLuminanceSum += luminance;
          whitePixelCount += 1;
        }
      }
    }

    const dominantAccent = [...accentHistogram.entries()].sort(
      (first, second) => second[1] - first[1],
    )[0];
    expect(dominantAccent?.[0]).toBe(COLOR_LIME.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16)).join(","));
    expect(dominantAccent?.[1]).toBeGreaterThan(100);
    const darkLuminance = darkLuminanceSum / darkPixelCount;
    const whiteLuminance = whiteLuminanceSum / whitePixelCount;
    expect((whiteLuminance + 0.05) / (darkLuminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["high-protein", "low-fat"] as const)(
    "renders exactly one %s badge without shifting the remaining layout",
    async (highlight) => {
      const [withoutHighlight, withHighlight] = await Promise.all([
        renderInstagramRecipe({ ...quarkbroetchenFixture, nutritionHighlight: null }),
        renderInstagramRecipe({ ...quarkbroetchenFixture, nutritionHighlight: highlight }),
      ]);

      expect(withoutHighlight.ok).toBe(true);
      expect(withHighlight.ok).toBe(true);
      if (!withoutHighlight.ok || !withHighlight.ok) {
        return;
      }

      const [withoutImage, withImage] = await Promise.all([
        decode(withoutHighlight.buffer),
        decode(withHighlight.buffer),
      ]);
      expect(withoutImage.info.width).toBe(CANVAS_WIDTH);
      expect(withoutImage.info.height).toBe(CANVAS_HEIGHT);
      expect(withHighlight.format).toBe("png");

      const badgeLeft = CANVAS_WIDTH - HIGHLIGHT_BADGE_RIGHT - HIGHLIGHT_BADGE_SIZE;
      expect(badgeLeft).toBe(887);
      expect(HIGHLIGHT_BADGE_TOP).toBe(66);
      expect(HIGHLIGHT_BADGE_RIGHT).toBe(65);
      expect(HIGHLIGHT_BADGE_SIZE).toBe(128);
      let nullBadgePixels = 0;
      let changedBadgePixels = 0;
      for (let y = HIGHLIGHT_BADGE_TOP; y < HIGHLIGHT_BADGE_TOP + HIGHLIGHT_BADGE_SIZE; y += 1) {
        for (let x = badgeLeft; x < badgeLeft + HIGHLIGHT_BADGE_SIZE; x += 1) {
          const offset = (y * CANVAS_WIDTH + x) * 4;
          if (isLimePixel(withoutImage.data, offset)) {
            nullBadgePixels += 1;
          }
          if (
            withoutImage.data[offset] !== withImage.data[offset] ||
            withoutImage.data[offset + 1] !== withImage.data[offset + 1] ||
            withoutImage.data[offset + 2] !== withImage.data[offset + 2] ||
            withoutImage.data[offset + 3] !== withImage.data[offset + 3]
          ) {
            changedBadgePixels += 1;
          }
        }
      }

      expect(nullBadgePixels).toBe(0);
      expect(changedBadgePixels).toBeGreaterThan(0);
      expect(countDifferencesOutsideBadge(withoutImage.data, withImage.data)).toBe(0);
    },
  );
});