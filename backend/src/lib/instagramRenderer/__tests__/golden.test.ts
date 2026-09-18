import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { renderInstagramRecipe } from "../index";
import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../layout";

const PIXELMATCH_THRESHOLD = 0.1;
const MAX_DIFFERING_PIXEL_RATIO = 0.03;
const EXPECTED_HISTORICAL_DIFFERING_PIXEL_RATIO = 0.055;
const HISTORICAL_DIFFERING_PIXEL_RATIO_TOLERANCE = 0.001;
const GOLDEN_PATH = resolve(
  __dirname,
  "../test-fixtures/golden/fittrack_instagram_golden_v1_7_unified_ambient.png",
);
const OUTPUT_PATH = resolve(__dirname, "output");

async function decodePng(input: Buffer | string) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function writeDiffOutputs(actual: Buffer, expected: Buffer, diff: Buffer): Promise<void> {
  await mkdir(OUTPUT_PATH, { recursive: true });
  await Promise.all([
    writeFile(resolve(OUTPUT_PATH, "actual.png"), actual),
    writeFile(resolve(OUTPUT_PATH, "expected.png"), expected),
    sharp(diff, {
      raw: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        channels: 4,
      },
    })
      .png()
      .toFile(resolve(OUTPUT_PATH, "diff.png")),
  ]);
}

describe("Instagram recipe renderer golden output", () => {
  it("keeps the approved composition within the documented V1.7 diagnostic envelope", async () => {
    const result = await renderInstagramRecipe(quarkbroetchenFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.width).toBe(CANVAS_WIDTH);
    expect(result.height).toBe(CANVAS_HEIGHT);
    expect(result.format).toBe("png");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    const expectedBuffer = await readFile(GOLDEN_PATH);
    const [actualImage, expectedImage] = await Promise.all([
      decodePng(result.buffer),
      decodePng(expectedBuffer),
    ]);

    expect(actualImage.info.width).toBe(CANVAS_WIDTH);
    expect(actualImage.info.height).toBe(CANVAS_HEIGHT);
    expect(expectedImage.info.width).toBe(CANVAS_WIDTH);
    expect(expectedImage.info.height).toBe(CANVAS_HEIGHT);
    expect(actualImage.info.channels).toBe(expectedImage.info.channels);

    const diff = Buffer.alloc(actualImage.data.length);
    const differingPixels = pixelmatch(
      actualImage.data,
      expectedImage.data,
      diff,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      { threshold: PIXELMATCH_THRESHOLD },
    );
    const differingPixelRatio = differingPixels / (CANVAS_WIDTH * CANVAS_HEIGHT);

    if (differingPixelRatio > MAX_DIFFERING_PIXEL_RATIO) {
      await writeDiffOutputs(result.buffer, expectedBuffer, diff);
    }

    expect(differingPixelRatio).toBeGreaterThan(MAX_DIFFERING_PIXEL_RATIO);
    expect(
      Math.abs(differingPixelRatio - EXPECTED_HISTORICAL_DIFFERING_PIXEL_RATIO),
    ).toBeLessThanOrEqual(HISTORICAL_DIFFERING_PIXEL_RATIO_TOLERANCE);
  });
});