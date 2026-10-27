import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import sharp from "sharp";
import satori from "satori";
import { describe, expect, it, vi } from "vitest";

import { nineIngredientsDetailsFixture } from "../fixtures/nine-ingredients-details";
import { quarkbroetchenDetailsFixture } from "../fixtures/quarkbroetchen-details";
import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { twentyIngredientsDetailsFixture } from "../fixtures/twenty-ingredients-details";
import { renderInstagramRecipe, renderInstagramRecipeDetailsTemplate } from "../index";
import type { RecipeDetailsTemplateInput, RenderInput } from "../types";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
} from "../layout";

vi.mock("satori", async (importOriginal) => {
  const actual = await importOriginal<typeof import("satori")>();
  return { ...actual, default: vi.fn(actual.default) };
});

type TextBoxMetric = {
  name: string;
  width: number;
  height: number;
  lineCount: number | null;
};

type CorpusFixture =
  | {
      id: string;
      template: "nutrition";
      image: "quarkbroetchen-source.png" | "none";
      input: RenderInput;
    }
  | {
      id: string;
      template: "details";
      image: "quarkbroetchen-source.png";
      input: RecipeDetailsTemplateInput;
    };

const REFERENCE_PHOTO = resolve(
  process.cwd(),
  "src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png",
);
const REFERENCE_DIRECTORY = resolve(
  __dirname,
  "../test-fixtures/reference-corpus",
);
const MANIFEST_PATH = resolve(REFERENCE_DIRECTORY, "manifest.json");
const UPDATE_REFERENCES = process.env.UPDATE_RENDERER_REFERENCE_CORPUS === "1";
const PIXELMATCH_THRESHOLD = 0.1;
const MAX_DIFFERING_PIXEL_RATIO = 0.03;
const CANONICAL_ENVIRONMENT = { platform: "win32", arch: "x64", nodeMajor: 24 };

function withReferencePhoto<Input extends { image: { path: string } | { buffer: Buffer } }>(
  input: Input,
): Input {
  return { ...input, image: { path: REFERENCE_PHOTO } } as Input;
}

function isTrackedNode(marker: string): boolean {
  return marker === "title" || marker === "tag-chip" || marker === "nutrition-value-row" ||
    marker.startsWith("recipe-details-");
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

async function captureTextBoxes<Result>(action: () => Promise<Result>) {
  const actual = await vi.importActual<typeof import("satori")>("satori");
  const boxes: TextBoxMetric[] = [];
  const occurrences = new Map<string, number>();

  vi.mocked(satori).mockImplementation(async (root, options) => {
    return actual.default(root, {
      ...options,
      onNodeDetected: (node) => {
        const marker = node.props["data-render-node"];
        if (typeof marker === "string" && isTrackedNode(marker)) {
          const index = (occurrences.get(marker) ?? 0) + 1;
          occurrences.set(marker, index);
          const style = node.props.style as Record<string, unknown> | undefined;
          const fontSize = typeof style?.fontSize === "number" ? style.fontSize : undefined;
          const lineHeight = typeof style?.lineHeight === "number" ? style.lineHeight : undefined;
          const lineHeightPixels = lineHeight === undefined || fontSize === undefined
            ? undefined
            : lineHeight <= 4 ? fontSize * lineHeight : lineHeight;
          const measuredLineCount = lineHeightPixels && node.height > 0
            ? Math.max(1, Math.round(node.height / lineHeightPixels))
            : null;
          const lineCount = measuredLineCount ?? (
            marker === "title"
              ? Math.max(1, Math.round(node.height / (TITLE_FONT_SIZE * TITLE_LINE_HEIGHT)))
              : marker === "tag-chip"
                ? 1
                : marker === "nutrition-value-row"
                  ? 2
                  : null
          );

          boxes.push({
            name: `${marker}:${index}`,
            width: roundMetric(node.width),
            height: roundMetric(node.height),
            lineCount,
          });
        }
        options.onNodeDetected?.(node);
      },
    });
  });

  try {
    return { result: await action(), boxes };
  } finally {
    vi.mocked(satori).mockImplementation(actual.default);
  }
}

function lineCountsFrom(boxes: TextBoxMetric[]): Record<string, number> {
  return Object.fromEntries(
    boxes.flatMap((box) => box.lineCount === null ? [] : [[box.name, box.lineCount]]),
  );
}

function isCanonicalEnvironment(): boolean {
  return process.platform === CANONICAL_ENVIRONMENT.platform &&
    process.arch === CANONICAL_ENVIRONMENT.arch &&
    Number(process.versions.node.split(".")[0]) === CANONICAL_ENVIRONMENT.nodeMajor;
}

async function createFixtures(): Promise<CorpusFixture[]> {
  const transparentPixel = await sharp({
    create: {
      width: 1,
      height: 1,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();

  const nutritionWithPhoto = withReferencePhoto(quarkbroetchenFixture);
  const nutritionWithoutPhoto: RenderInput = {
    ...quarkbroetchenFixture,
    image: { buffer: transparentPixel },
    nutritionHighlight: "low-fat",
  };
  const oneIngredientDetails: RecipeDetailsTemplateInput = {
    ...withReferencePhoto(quarkbroetchenDetailsFixture),
    title: "Einfaches Kräuter-Ei mit Quark",
    ingredients: [{ amount: "1 Stück", name: "Ei" }],
    steps: ["Ei und Quark verrühren.", "Mit Kräutern würzen und servieren."],
  };

  return [
    {
      id: "nutrition-with-photo",
      template: "nutrition",
      image: "quarkbroetchen-source.png",
      input: nutritionWithPhoto,
    },
    {
      id: "nutrition-without-photo",
      template: "nutrition",
      image: "none",
      input: nutritionWithoutPhoto,
    },
    {
      id: "details-1-ingredient",
      template: "details",
      image: "quarkbroetchen-source.png",
      input: oneIngredientDetails,
    },
    {
      id: "details-5-ingredients",
      template: "details",
      image: "quarkbroetchen-source.png",
      input: withReferencePhoto(quarkbroetchenDetailsFixture),
    },
    {
      id: "details-9-ingredients",
      template: "details",
      image: "quarkbroetchen-source.png",
      input: withReferencePhoto(nineIngredientsDetailsFixture),
    },
    {
      id: "details-20-ingredients",
      template: "details",
      image: "quarkbroetchen-source.png",
      input: withReferencePhoto(twentyIngredientsDetailsFixture),
    },
  ];
}

async function renderFixture(fixture: CorpusFixture) {
  return fixture.template === "nutrition"
    ? renderInstagramRecipe(fixture.input)
    : renderInstagramRecipeDetailsTemplate(fixture.input);
}

async function decodePng(input: Buffer) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe("Instagram renderer reference corpus", () => {
  it("locks renderer-neutral output and text-layout metrics for every fixture", async () => {
    if (UPDATE_REFERENCES && !isCanonicalEnvironment()) {
      throw new Error("Reference PNGs may only be regenerated on Windows x64 with Node 24.");
    }

    const fixtures = await createFixtures();
    if (UPDATE_REFERENCES) {
      await mkdir(REFERENCE_DIRECTORY, { recursive: true });
    }
    const actualEntries = [];

    for (const fixture of fixtures) {
      const usesApprovedImage = fixture.image === "none"
        ? "buffer" in fixture.input.image
        : "path" in fixture.input.image && fixture.input.image.path === REFERENCE_PHOTO;
      expect(usesApprovedImage).toBe(true);

      const { result, boxes } = await captureTextBoxes(() => renderFixture(fixture));
      if (!result.ok) {
        throw new Error(`Fixture ${fixture.id} failed to render: ${JSON.stringify(result.error)}`);
      }

      const image = await sharp(result.buffer).stats();
      const metadata = await sharp(result.buffer).metadata();
      const pngName = `${fixture.id}.png`;
      const pngPath = resolve(REFERENCE_DIRECTORY, pngName);
      const entry = {
        id: fixture.id,
        template: fixture.template,
        image: fixture.image,
        png: pngName,
        format: metadata.format ?? null,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        nonEmpty: result.buffer.length > 0 && image.entropy > 0,
        overflow: [],
        lineCounts: lineCountsFrom(boxes),
        textBoxes: boxes,
        byteLength: result.buffer.length,
        sha256: createHash("sha256").update(result.buffer).digest("hex"),
      };

      if (
        entry.format !== "png" ||
        entry.width !== CANVAS_WIDTH ||
        entry.height !== CANVAS_HEIGHT ||
        !entry.nonEmpty ||
        entry.overflow.length !== 0 ||
        entry.textBoxes.length === 0
      ) {
        throw new Error(`Fixture ${fixture.id} produced invalid renderer metrics.`);
      }
      actualEntries.push({ entry, buffer: result.buffer });
    }

    if (UPDATE_REFERENCES) {
      for (const { entry, buffer } of actualEntries) {
        await writeFile(resolve(REFERENCE_DIRECTORY, entry.png), buffer);
      }
      await writeFile(MANIFEST_PATH, `${JSON.stringify({
        schemaVersion: 1,
        renderer: "satori+resvg",
        canonicalEnvironment: CANONICAL_ENVIRONMENT,
        pixelmatch: {
          threshold: PIXELMATCH_THRESHOLD,
          maxDifferingPixelRatio: MAX_DIFFERING_PIXEL_RATIO,
        },
        fixtures: actualEntries.map(({ entry }) => entry),
      }, null, 2)}\n`);
    }

    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as {
      schemaVersion: number;
      renderer: string;
      canonicalEnvironment: typeof CANONICAL_ENVIRONMENT;
      pixelmatch: { threshold: number; maxDifferingPixelRatio: number };
      fixtures: Array<(typeof actualEntries)[number]["entry"]>;
    };

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.renderer).toBe("satori+resvg");
    expect(manifest.canonicalEnvironment).toEqual(CANONICAL_ENVIRONMENT);
    expect(manifest.pixelmatch).toEqual({
      threshold: PIXELMATCH_THRESHOLD,
      maxDifferingPixelRatio: MAX_DIFFERING_PIXEL_RATIO,
    });
    expect(manifest.fixtures.map(({ id }) => id)).toEqual(fixtures.map(({ id }) => id));

    for (const { entry, buffer } of actualEntries) {
      const expected = manifest.fixtures.find((fixture) => fixture.id === entry.id);
      expect(expected).toBeDefined();
      if (!expected) continue;

      expect(entry).toMatchObject({
        id: expected.id,
        template: expected.template,
        image: expected.image,
        format: expected.format,
        width: expected.width,
        height: expected.height,
        nonEmpty: expected.nonEmpty,
        overflow: expected.overflow,
        lineCounts: expected.lineCounts,
        textBoxes: expected.textBoxes,
      });
      expect(expected.format).toBe("png");
      expect(expected.width).toBe(CANVAS_WIDTH);
      expect(expected.height).toBe(CANVAS_HEIGHT);
      expect(expected.nonEmpty).toBe(true);
      expect(expected.overflow).toEqual([]);

      const expectedBuffer = await readFile(resolve(REFERENCE_DIRECTORY, expected.png));
      expect(expectedBuffer.length).toBe(expected.byteLength);
      expect(createHash("sha256").update(expectedBuffer).digest("hex")).toBe(expected.sha256);

      const [actualImage, expectedImage] = await Promise.all([
        decodePng(buffer),
        decodePng(expectedBuffer),
      ]);
      expect(actualImage.info.width).toBe(CANVAS_WIDTH);
      expect(actualImage.info.height).toBe(CANVAS_HEIGHT);
      expect(expectedImage.info.width).toBe(CANVAS_WIDTH);
      expect(expectedImage.info.height).toBe(CANVAS_HEIGHT);

      if (isCanonicalEnvironment()) {
        const diff = Buffer.alloc(actualImage.data.length);
        const differingPixels = pixelmatch(
          actualImage.data,
          expectedImage.data,
          diff,
          CANVAS_WIDTH,
          CANVAS_HEIGHT,
          { threshold: PIXELMATCH_THRESHOLD },
        );
        expect(differingPixels / (CANVAS_WIDTH * CANVAS_HEIGHT)).toBeLessThanOrEqual(
          MAX_DIFFERING_PIXEL_RATIO,
        );
      }
    }
  });
});