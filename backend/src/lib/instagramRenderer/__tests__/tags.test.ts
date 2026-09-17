import { readFileSync } from "node:fs";

import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { compose, type ComposeAssets } from "../compose";
import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { renderInstagramRecipe, resolveTagIcon } from "../index";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_LIME,
  TAG_CHIP_GAP,
  TAG_CHIP_HEIGHT,
  TAG_CHIP_PADDING_X,
  TAG_ICON_GAP,
  TAG_ICON_SIZE,
  TAG_ROW_MAX_WIDTH,
  TAG_ROW_X,
  TAG_ROW_Y,
} from "../layout";
import type { RenderInput } from "../types";

const EMPTY_PNG = "data:image/png;base64,iVBORw0KGgo=";
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />';

function createInput(tags: RenderInput["tags"]): RenderInput {
  return {
    ...quarkbroetchenFixture,
    presentation: { ...quarkbroetchenFixture.presentation },
    tags: tags.map((tag) => ({ ...tag })),
    nutrition: { ...quarkbroetchenFixture.nutrition },
  };
}

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

function flattenElements(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap(flattenElements);
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const props = record.props;
  if (!props || typeof props !== "object") {
    return [record];
  }

  return [record, ...flattenElements((props as Record<string, unknown>).children)];
}

function tagChipElements(input: RenderInput): Array<Record<string, unknown>> {
  return flattenElements(compose(input, createComposeAssets())).filter((element) => {
    const props = element.props;
    return (
      typeof props === "object" &&
      props !== null &&
      (props as Record<string, unknown>)["data-render-node"] === "tag-chip"
    );
  });
}

async function renderBuffer(input: RenderInput): Promise<Buffer> {
  const result = await renderInstagramRecipe(input);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.buffer;
}

async function decode(input: Buffer) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

type RawImage = Awaited<ReturnType<typeof decode>>;

type PixelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function isLimePixel(image: RawImage, x: number, y: number): boolean {
  const offset = (y * image.info.width + x) * image.info.channels;
  return (
    image.data[offset + 3] >= 240 &&
    image.data[offset + 1] - image.data[offset] >= 20 &&
    image.data[offset + 1] >= 140 &&
    image.data[offset + 2] <= 130
  );
}

function findChipBorderBounds(image: RawImage): PixelBounds[] {
  const mask = new Uint8Array(image.info.width * image.info.height);
  for (let y = TAG_ROW_Y; y < TAG_ROW_Y + TAG_CHIP_HEIGHT; y += 1) {
    for (let x = TAG_ROW_X; x < TAG_ROW_X + TAG_ROW_MAX_WIDTH; x += 1) {
      if (isLimePixel(image, x, y)) {
        mask[y * image.info.width + x] = 1;
      }
    }
  }

  const seen = new Uint8Array(mask.length);
  const components: PixelBounds[] = [];
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;

  for (let y = TAG_ROW_Y; y < TAG_ROW_Y + TAG_CHIP_HEIGHT; y += 1) {
    for (let x = TAG_ROW_X; x < TAG_ROW_X + TAG_ROW_MAX_WIDTH; x += 1) {
      const start = y * image.info.width + x;
      if (!mask[start] || seen[start]) {
        continue;
      }

      const queue: Array<[number, number]> = [[x, y]];
      seen[start] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;

      while (queue.length > 0) {
        const [currentX, currentY] = queue.pop()!;
        count += 1;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (const [offsetX, offsetY] of neighbors) {
          const nextX = currentX + offsetX;
          const nextY = currentY + offsetY;
          if (
            nextX < TAG_ROW_X ||
            nextX >= TAG_ROW_X + TAG_ROW_MAX_WIDTH ||
            nextY < TAG_ROW_Y ||
            nextY >= TAG_ROW_Y + TAG_CHIP_HEIGHT
          ) {
            continue;
          }
          const next = nextY * image.info.width + nextX;
          if (!mask[next] || seen[next]) {
            continue;
          }
          seen[next] = 1;
          queue.push([nextX, nextY]);
        }
      }

      if (count >= 200 && maxY - minY + 1 === TAG_CHIP_HEIGHT) {
        components.push({ minX, maxX, minY, maxY });
      }
    }
  }

  return components.sort((first, second) => first.minX - second.minX);
}

function countDifferencesOutsideTagRow(actual: Buffer, expected: Buffer): number {
  let differences = 0;
  for (let y = 0; y < CANVAS_HEIGHT; y += 1) {
    if (y >= TAG_ROW_Y && y < TAG_ROW_Y + TAG_CHIP_HEIGHT) {
      continue;
    }
    for (let x = 0; x < CANVAS_WIDTH; x += 1) {
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

function normalizeExpectedTablerSvg(svg: string): string {
  let normalized = svg
    .replace(/\s+stroke="[^"]*"/gi, ` stroke="${COLOR_LIME}"`)
    .replace(/\s+stroke-width="[^"]*"/gi, ' stroke-width="2"')
    .replace(/\s+stroke-linecap="[^"]*"/gi, ' stroke-linecap="round"')
    .replace(/\s+stroke-linejoin="[^"]*"/gi, ' stroke-linejoin="round"')
    .replace(/\s+color="[^"]*"/gi, ` color="${COLOR_LIME}"`)
    .replace(/\s+fill="currentColor"/gi, ` fill="${COLOR_LIME}"`);

  return normalized.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => {
    const rootAttributes = attributes
      .replace(/\s+stroke="[^"]*"/gi, "")
      .replace(/\s+stroke-width="[^"]*"/gi, "")
      .replace(/\s+stroke-linecap="[^"]*"/gi, "")
      .replace(/\s+stroke-linejoin="[^"]*"/gi, "")
      .replace(/\s+color="[^"]*"/gi, "");

    return `<svg${rootAttributes} stroke="${COLOR_LIME}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
  });
}

describe("Instagram recipe renderer tags", () => {
  it("uses an appliance icon for baking and a croissant for breakfast", () => {
    const bakingIcon = resolveTagIcon("backen");
    expect(bakingIcon).not.toBeNull();
    expect(bakingIcon?.source).toBe("lucide");
    expect(bakingIcon?.svg).toContain("lucide-microwave");
    expect(bakingIcon?.svg).not.toContain("lucide-croissant");

    const breakfastIcon = resolveTagIcon("fruhstuck");
    expect(breakfastIcon).not.toBeNull();
    expect(breakfastIcon?.source).toBe("lucide");
    expect(breakfastIcon?.svg).toContain("lucide-croissant");
    expect(breakfastIcon?.svg).not.toContain("lucide-egg-fried");
  });

  it("accepts zero, one, and four tags with the expected chip count", async () => {
    const variants = [
      [],
      [{ id: "backen", label: "Backen" }],
      [
        { id: "backen", label: "Backen" },
        { id: "vegetarisch", label: "Vegetarisch" },
        { id: "snacks", label: "Snacks" },
        { id: "fruhstuck", label: "Frühstück" },
      ],
    ];

    for (const tags of variants) {
      const result = await renderInstagramRecipe(createInput(tags));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.width).toBe(CANVAS_WIDTH);
        expect(result.height).toBe(CANVAS_HEIGHT);
      }
    }

    expect(tagChipElements(createInput([]))).toHaveLength(0);
    expect(tagChipElements(createInput(variants[1]))).toHaveLength(1);
    expect(tagChipElements(createInput(variants[2]))).toHaveLength(4);
  });

  it("keeps the remaining layout fixed when the tag row is omitted", async () => {
    const [withoutTags, withTags] = await Promise.all([
      renderBuffer(createInput([])),
      renderBuffer(createInput([
        { id: "backen", label: "Backen" },
        { id: "vegetarisch", label: "Vegetarisch" },
      ])),
    ]);
    const [withoutTagsImage, withTagsImage] = await Promise.all([
      decode(withoutTags),
      decode(withTags),
    ]);

    expect(withoutTagsImage.info.width).toBe(CANVAS_WIDTH);
    expect(withoutTagsImage.info.height).toBe(CANVAS_HEIGHT);
    expect(withTagsImage.info.width).toBe(CANVAS_WIDTH);
    expect(withTagsImage.info.height).toBe(CANVAS_HEIGHT);
    expect(countDifferencesOutsideTagRow(withoutTagsImage.data, withTagsImage.data)).toBe(0);

    const tagDiff = Buffer.alloc(withoutTagsImage.data.length);
    const differingPixels = pixelmatch(
      withoutTagsImage.data,
      withTagsImage.data,
      tagDiff,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      { threshold: 0.1 },
    );
    expect(differingPixels).toBeGreaterThan(0);
  });

  it("uses the compact chip geometry and preserves the four-tag render bounds", async () => {
    const input = createInput([
      { id: "backen", label: "Backen" },
      { id: "vegetarisch", label: "Vegetarisch" },
      { id: "snacks", label: "Snacks" },
      { id: "fruhstuck", label: "Frühstück" },
    ]);
    const elements = flattenElements(compose(input, createComposeAssets()));
    const tagRow = elements.find((element) => {
      const props = element.props as Record<string, unknown>;
      const style = props.style as Record<string, unknown> | undefined;
      return style?.top === TAG_ROW_Y && style.width === TAG_ROW_MAX_WIDTH;
    });

    expect(tagRow).toBeDefined();
    const rowStyle = (tagRow?.props as Record<string, unknown>).style as Record<string, unknown>;
    expect(rowStyle.left).toBe(TAG_ROW_X);
    expect(rowStyle.gap).toBe(TAG_CHIP_GAP);
    expect(rowStyle.height).toBe(TAG_CHIP_HEIGHT);

    const chips = tagChipElements(input);
    expect(chips).toHaveLength(4);
    for (const chip of chips) {
      const chipProps = chip.props as Record<string, unknown>;
      const chipStyle = chipProps.style as Record<string, unknown>;
      expect(chipStyle.paddingLeft).toBe(TAG_CHIP_PADDING_X);
      expect(chipStyle.paddingRight).toBe(TAG_CHIP_PADDING_X);
      expect(chipStyle.gap).toBe(TAG_ICON_GAP);
      expect(chipStyle.height).toBe(TAG_CHIP_HEIGHT);

      const icon = flattenElements(chipProps.children).find((element) => element.type === "img");
      expect(icon).toBeDefined();
      const iconStyle = (icon?.props as Record<string, unknown>).style as Record<string, unknown>;
      expect(iconStyle.width).toBe(TAG_ICON_SIZE);
      expect(iconStyle.height).toBe(TAG_ICON_SIZE);
    }

    const image = await decode(await renderBuffer(input));
    expect(findChipBorderBounds(image)).toEqual([
      { minX: 88, maxX: 202, minY: 936, maxY: 973 },
      { minX: 215, maxX: 364, minY: 936, maxY: 973 },
      { minX: 377, maxX: 490, minY: 936, maxY: 973 },
      { minX: 503, maxX: 637, minY: 936, maxY: 973 },
    ]);
  });

  it("uses text-only fallback chips for unknown tags and Curry", async () => {
    const input = createInput([
      { id: "unknown-tag", label: "Unbekannt" },
      { id: "curry", label: "Curry" },
    ]);
    const result = await renderInstagramRecipe(input);

    expect(result.ok).toBe(true);
    const chips = tagChipElements(input);
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      const props = chip.props as Record<string, unknown>;
      expect(
        flattenElements(props.children).some((element) => element.type === "img"),
      ).toBe(false);
    }
  });

  it("resolves the specified Tabler exports and normalizes their SVGs", () => {
    const tablerCases = [
      {
        id: "sauerteig",
        specifier: "@tabler/icons/outline/bread.svg",
      },
      {
        id: "pasta",
        specifier: "@tabler/icons/outline/bowl.svg",
      },
    ] as const;

    for (const { id, specifier } of tablerCases) {
      const resolvedPath = require.resolve(specifier);
      expect(resolvedPath).toMatch(/[\\/]icons[\\/]outline[\\/](bread|bowl)\.svg$/);

      const icon = resolveTagIcon(id);
      expect(icon).not.toBeNull();
      expect(icon?.source).toBe("tabler");
      expect(icon?.svg).toBe(
        normalizeExpectedTablerSvg(readFileSync(resolvedPath, "utf8")),
      );
    }

    expect(() => require.resolve("@tabler/icons/outline/noodles.svg")).toThrow();
    expect(() => require.resolve("@tabler/icons/outline/pasta.svg")).toThrow();
    expect(resolveTagIcon("noodles")).toBeNull();
  });
});