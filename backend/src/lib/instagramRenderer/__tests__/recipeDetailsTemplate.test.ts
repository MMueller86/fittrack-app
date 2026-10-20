import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import satori from "satori";
import type { Font } from "satori";
import { describe, expect, it, vi } from "vitest";

import { gefluegelfrikadellenDetailsFixture as alphaGefluegelfrikadellenDetailsFixture } from "../fixtures/gefluegelfrikadellen-details";
import { nineIngredientsDetailsFixture as alphaNineIngredientsDetailsFixture } from "../fixtures/nine-ingredients-details";
import { quarkbroetchenDetailsFixture } from "../fixtures/quarkbroetchen-details";
import { twentyIngredientsDetailsFixture as alphaTwentyIngredientsDetailsFixture } from "../fixtures/twenty-ingredients-details";
import { probeInstagramRecipeDetailsGeneratedText, renderInstagramRecipeDetailsTemplate } from "../index";
import type { RecipeDetailsTemplateInput } from "../types";
import {
  composeRecipeDetailsTemplate,
  composeRecipeDetailsGeneratedText,
  getRecipeDetailsTextLayoutFields,
  getRecipeDetailsTitleLayout,
} from "../recipeDetailsTemplateV3";
import type { SatoriElement } from "../compose";
import {
  addMeasuredGermanBreaks,
  measureDetailTextWidths,
  type DetailTextLayoutField,
  type DetailTextMeasureRequest,
} from "../detailTextLayout";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: async (...args: Parameters<typeof actual.readFile>) => {
      const path = String(args[0]).replace(/\\/g, "/");
      if (path.includes("/output/alpha-recipe-assets/")) {
        throw new Error("Local Alpha output photos are unavailable in offline unit tests.");
      }
      return actual.readFile(...args);
    },
  };
});

vi.mock("satori", async (importOriginal) => {
  const actual = await importOriginal<typeof import("satori")>();
  return { ...actual, default: vi.fn(actual.default) };
});

const gefluegelfrikadellenDetailsFixture = {
  ...alphaGefluegelfrikadellenDetailsFixture,
  image: quarkbroetchenDetailsFixture.image,
};
const nineIngredientsDetailsFixture = {
  ...alphaNineIngredientsDetailsFixture,
  image: quarkbroetchenDetailsFixture.image,
};
const twentyIngredientsDetailsFixture = {
  ...alphaTwentyIngredientsDetailsFixture,
  image: quarkbroetchenDetailsFixture.image,
};
const servingLabelDetailsFixture = {
  ...quarkbroetchenDetailsFixture,
  ingredients: [
    ...quarkbroetchenDetailsFixture.ingredients,
    { amount: "10 g", name: "Leinsamen" },
    { amount: "3 1 portion (10 g)", name: "Sesam" },
  ],
};

const HYPHENATION_MARKER = "\uE000";
const germanHyphenate = (require("hyphen/de") as {
  hyphenateSync: (text: string, options?: { hyphenChar?: string }) => string;
}).hyphenateSync;
let measurementFontsPromise: Promise<Font[]> | undefined;

function loadMeasurementFonts(): Promise<Font[]> {
  measurementFontsPromise ??= readFile(
    resolve(process.cwd(), "src/lib/instagramRenderer/assets/fonts/Inter-Medium.ttf"),
  ).then((data) => [{ name: "Inter", weight: 500, data }]);
  return measurementFontsPromise;
}

async function measureTextRequests(
  requests: readonly DetailTextMeasureRequest[],
): Promise<ReadonlyMap<string, number>> {
  return measureDetailTextWidths(satori, await loadMeasurementFonts(), requests);
}

function createTextLayoutField(
  id: string,
  text: string,
  maxWidth: number,
): DetailTextLayoutField {
  return {
    id,
    text,
    maxWidth,
    maxHeight: 500,
    field: "description",
    style: {
      fontFamily: "Inter",
      fontSize: 21,
      fontWeight: 500,
      lineHeight: 1.2,
    },
  };
}

function isTemplateElement(value: unknown): value is SatoriElement {
  return Boolean(value) && typeof value === "object" && "type" in value && "props" in value;
}

function flattenTemplateElements(value: unknown): SatoriElement[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenTemplateElements);
  }
  if (!isTemplateElement(value)) {
    return [];
  }
  return [value, ...flattenTemplateElements(value.props.children)];
}

async function captureProductionMeasurements<Result>(action: () => Promise<Result>) {
  const actual = await vi.importActual<typeof import("satori")>("satori");
  const measurements = new Map<string, { width: number; height: number }>();
  const teaserSizes: number[] = [];
  vi.mocked(satori).mockImplementation(async (root, options) => {
    const teaser = flattenTemplateElements(root).find(
      (node) => node.props["data-render-node"] === "recipe-details-description",
    );
    if (teaser) teaserSizes.push((teaser.props.style as Record<string, unknown>).fontSize as number);
    return actual.default(root, {
      ...options,
      onNodeDetected: (node) => {
        const marker = node.props["data-render-node"];
        if (typeof marker === "string" && marker.startsWith("recipe-details-")) {
          measurements.set(marker, { width: node.width, height: node.height });
        }
        options.onNodeDetected?.(node);
      },
    });
  });
  try {
    return { result: await action(), measurements, teaserSizes };
  } finally {
    vi.mocked(satori).mockImplementation(actual.default);
  }
}

const probeTitles = ["Brötchen", "Herzhafte Quarkbrötchen", "Herzhafte Quarkbrötchen mit Dinkel und Körnern"];
const denseProbeTeaser = "Goldbraune Quarkbrötchen mit Dinkelmehl und knackigen Körnern für ein sättigendes Frühstück.";

describe("B-1 generated detail text production probe", () => {
  it("keeps a longer saved title inside the detail image title and teaser bounds", async () => {
    const title = "Herzhafte Quarkbrötchen mit Dinkelmehl und Haferflocken";
    const input = { ...quarkbroetchenDetailsFixture, title };
    const full = await renderInstagramRecipeDetailsTemplate(input);
    const probe = await probeInstagramRecipeDetailsGeneratedText({
      savedTitle: title,
      teaser: input.description!,
      steps: input.steps,
    });

  expect(getRecipeDetailsTitleLayout(title).fontSize).toBe(40);
    expect(full.ok, full.ok ? undefined : JSON.stringify(full.error)).toBe(true);
    expect(probe).toMatchObject({ ok: true, status: "success" });
  }, 20000);

  it.each([1, 2, 3, 4, 5].flatMap((count) => probeTitles.map((title) => ({ count, title }))))(
    "matches full-render node geometry and teaser decisions for $count steps / $title",
    async ({ count, title }) => {
      const input: RecipeDetailsTemplateInput = {
        ...quarkbroetchenDetailsFixture, title,
        description: denseProbeTeaser,
        steps: Array.from({ length: count }, () => "Mische die Zutaten und forme daraus Brötchen."),
      };
      const before = JSON.stringify(input);
      const full = await captureProductionMeasurements(() => renderInstagramRecipeDetailsTemplate(input));
      const probe = await captureProductionMeasurements(() => probeInstagramRecipeDetailsGeneratedText({
        savedTitle: title, teaser: input.description!, steps: input.steps,
      }));
      expect(full.result.ok).toBe(true);
      expect(probe.result).toMatchObject({ ok: true, status: "success" });
      expect(probe.teaserSizes).toEqual(full.teaserSizes);
      expect(probe.teaserSizes).toEqual(probe.teaserSizes.map((_size, index) => 22 - index));
      expect(probe.result.teaserFontSize).toBe(full.teaserSizes.at(-1));
      expect(probe.result.diagnostics).toHaveLength(count + 2);
      for (const [marker, measurement] of probe.measurements) {
        expect(measurement, marker).toEqual(full.measurements.get(marker));
      }
      expect(probe.result.diagnostics.filter((item) => item.field === "steps"))
        .toEqual(Array.from({ length: count }, (_step, itemIndex) => expect.objectContaining({
          itemIndex, status: "fits", fontSize: count === 5 ? 18 : 22,
          measured: expect.objectContaining({ maxWidth: count === 5 ? 318 : 302, maxHeight: count === 5 ? 84 : 105 }),
        })));
      const teaser = probe.result.diagnostics.find((item) => item.field === "teaser");
      expect(teaser).toMatchObject({ status: "fits", displayText: denseProbeTeaser.slice(0, -1) });
      expect(JSON.stringify(input)).toBe(before);
    }, 20000,
  );

  it("uses exactly the full-render subtrees and parent constraints without images or ingredients", () => {
    const input = quarkbroetchenDetailsFixture;
    const overrides = {
      title: input.title, description: input.description!, descriptionFontSize: 21,
      steps: input.steps, ingredients: input.ingredients.map((ingredient) => `${ingredient.amount} ${ingredient.name}`),
    };
    const full = composeRecipeDetailsTemplate(input, {
      photo: { src: "data:image/png;base64,", width: 1080, height: 1350 },
      wordmark: "", wordmarkMimeType: "image/svg+xml", nutritionHighlights: { "high-protein": "", "low-fat": "" },
    }, overrides);
    const probe = composeRecipeDetailsGeneratedText(input, overrides);
    expect(probe.props.style).toEqual(full.props.style);
    const fullChildren = full.props.children as SatoriElement[];
    for (const subtree of probe.props.children as SatoriElement[]) {
      expect(fullChildren).toContainEqual(subtree);
    }
    expect(flattenTemplateElements(probe).some((node) => node.type === "img")).toBe(false);
    expect(JSON.stringify(probe)).not.toContain("recipe-details-ingredient-");
  });

  it("measures every step despite multiple overflow failures and reevaluates changed counts", async () => {
    const text = "Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.";
    const candidate = { savedTitle: "Quarkbrötchen", teaser: "Frisch gebacken.", steps: Array.from({ length: 4 }, () => text) };
    const four = await probeInstagramRecipeDetailsGeneratedText(candidate);
    expect(four).toMatchObject({ status: "generated-text-failure" });
    expect(four.diagnostics.filter((item) => item.field === "steps" && item.status === "overflow")).toHaveLength(4);
    const five = await probeInstagramRecipeDetailsGeneratedText({ ...candidate, steps: [...candidate.steps, "Backe die Brötchen."] });
    expect(five).toMatchObject({ ok: true, status: "success" });
    expect(five.diagnostics.filter((item) => item.field === "steps")).toHaveLength(5);
  });

  it("reports width-only failures without inventing a multiline height and still measures other fields", async () => {
    const result = await probeInstagramRecipeDetailsGeneratedText({
      savedTitle: "Quarkbrötchen", teaser: "W".repeat(96), steps: ["W".repeat(90), "Backe die Brötchen."],
    });
    expect(result).toMatchObject({ ok: false, status: "generated-text-failure", teaserFontSize: 18 });
    const failures = result.diagnostics.filter((item) => item.status === "width-overflow");
    expect(failures).toHaveLength(2);
    for (const failure of failures) {
      if (failure.status !== "width-overflow") continue;
      expect(failure.measured.width).toBeGreaterThan(failure.measured.maxWidth);
      expect(failure.measured).not.toHaveProperty("height");
      expect(failure.measured).not.toHaveProperty("maxHeight");
    }
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ field: "steps", itemIndex: 1, status: "fits" }));
  });

  it.each(["", " ", "Backe\nBrötchen", "Backe\rBrötchen", "Backe\u2028Brötchen", "Backe\u2029Brötchen", "x".repeat(97)])(
    "rejects generated invalid text %j without normalization or claiming validation", async (text) => {
      const candidate = { savedTitle: "Quarkbrötchen", teaser: text, steps: [text, "Backe die Brötchen."] };
      const before = JSON.stringify(candidate);
      const result = await probeInstagramRecipeDetailsGeneratedText(candidate);
      expect(result).toMatchObject({ ok: false, status: "generated-text-failure" });
      expect(result.diagnostics).toContainEqual({ field: "teaser", status: "invalid-text", code: "INVALID_TEXT" });
      expect(result.diagnostics).toContainEqual({ field: "steps", itemIndex: 0, status: "invalid-text", code: "INVALID_TEXT" });
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ field: "steps", itemIndex: 1, status: "fits" }));
      expect(JSON.stringify(candidate)).toBe(before);
    },
  );

  it.each([0, 6])("rejects %i steps and does not claim the skipped steps fit", async (count) => {
    const result = await probeInstagramRecipeDetailsGeneratedText({
      savedTitle: "Quarkbrötchen", teaser: "Frisch gebacken.", steps: Array.from({ length: count }, () => "Backe Brötchen."),
    });
    expect(result).toMatchObject({ status: "generated-text-failure" });
    expect(result.diagnostics.filter((item) => item.field === "steps" && item.status === "fits")).toHaveLength(0);
    expect(result.diagnostics).toContainEqual({ field: "steps", status: "invalid-text", code: "INVALID_STEP_COUNT" });
  });

  it.each([
    { dimension: "width" as const, extra: 0.5, ok: true },
    { dimension: "width" as const, extra: 0.5001, ok: false },
    { dimension: "height" as const, extra: 0.5, ok: true },
    { dimension: "height" as const, extra: 0.5001, ok: false },
  ])("shares the 0.5px $dimension boundary with full rendering: $extra", async ({ dimension, extra, ok }) => {
    const actual = await vi.importActual<typeof import("satori")>("satori");
    vi.mocked(satori).mockImplementation((root, options) => actual.default(root, {
      ...options,
      onNodeDetected: (node) => options.onNodeDetected?.(
        node.props["data-render-node"] === "recipe-details-step-0"
          ? { ...node, [dimension]: (dimension === "width" ? 302 : 105) + extra }
          : node,
      ),
    }));
    try {
      const input = { ...quarkbroetchenDetailsFixture, steps: ["Backe Brötchen."] };
      const full = await renderInstagramRecipeDetailsTemplate(input);
      const probe = await probeInstagramRecipeDetailsGeneratedText({ savedTitle: input.title, teaser: input.description!, steps: input.steps });
      expect(full.ok).toBe(ok);
      expect(probe.ok).toBe(ok);
      expect(probe.status).toBe(ok ? "success" : "generated-text-failure");
    } finally {
      vi.mocked(satori).mockImplementation(actual.default);
    }
  });

  it.each(["missing", "nan-width", "infinite-height", "missing-word"]) (
    "fails technically for %s production measurement, even with a correctable overflow", async (failure) => {
      const actual = await vi.importActual<typeof import("satori")>("satori");
      vi.mocked(satori).mockImplementation((root, options) => actual.default(root, {
        ...options,
        onNodeDetected: (node) => {
          const marker = node.props["data-render-node"];
          if (failure === "missing-word" && typeof marker === "string" && marker.startsWith("detail-text-measure-")) return;
          if (marker === "recipe-details-step-1") {
            if (failure === "missing") return;
            if (failure === "nan-width") node = { ...node, width: NaN };
            if (failure === "infinite-height") node = { ...node, height: Infinity };
          }
          options.onNodeDetected?.(node);
        },
      }));
      try {
        const result = await probeInstagramRecipeDetailsGeneratedText({
          savedTitle: "Quarkbrötchen", teaser: "Frisch gebacken.",
          steps: ["Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.", "Backe Brötchen."],
        });
        expect(result).toMatchObject({ ok: false, status: "technical-failure" });
        expect(result.diagnostics.some((item) => item.status === "technical-failure")).toBe(true);
      } finally {
        vi.mocked(satori).mockImplementation(actual.default);
      }
    },
  );

  it.each(["", "Titel\nZeile", "W".repeat(60)])("never makes the saved title %j AI-correctable", async (savedTitle) => {
    const result = await probeInstagramRecipeDetailsGeneratedText({ savedTitle, teaser: "Frisch gebacken.", steps: ["Backe Brötchen."] });
    expect(result).toMatchObject({ ok: false, status: "technical-failure" });
  });

  it.each([22, 21, 20, 19, 18])("retains identical font-attempt selection through %ipx", async (selectedSize) => {
    const actual = await vi.importActual<typeof import("satori")>("satori");
    const attempts: number[] = [];
    vi.mocked(satori).mockImplementation((root, options) => {
      const teaser = flattenTemplateElements(root).find((node) => node.props["data-render-node"] === "recipe-details-description");
      const fontSize = teaser ? (teaser.props.style as Record<string, unknown>).fontSize as number : undefined;
      if (fontSize !== undefined) attempts.push(fontSize);
      return actual.default(root, {
        ...options,
        onNodeDetected: (node) => options.onNodeDetected?.(
          node.props["data-render-node"] === "recipe-details-description" && fontSize! > selectedSize
            ? { ...node, height: 500 }
            : node,
        ),
      });
    });
    try {
      const input = quarkbroetchenDetailsFixture;
      const full = await renderInstagramRecipeDetailsTemplate(input);
      const fullAttempts = attempts.splice(0);
      const probe = await probeInstagramRecipeDetailsGeneratedText({ savedTitle: input.title, teaser: input.description!, steps: input.steps });
      expect(full.ok).toBe(true);
      expect(probe).toMatchObject({ ok: true, teaserFontSize: selectedSize });
      expect(attempts).toEqual(fullAttempts);
      expect(attempts).toEqual(Array.from({ length: 23 - selectedSize }, (_size, index) => 22 - index));
    } finally {
      vi.mocked(satori).mockImplementation(actual.default);
    }
  });

  it("matches title-dependent teaser overflow and legal German breaks with the full renderer", async () => {
    for (const title of probeTitles) {
      for (const description of ["W".repeat(96), "Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung"]) {
        const input = { ...quarkbroetchenDetailsFixture, title, description };
        const full = await renderInstagramRecipeDetailsTemplate(input);
        const probe = await probeInstagramRecipeDetailsGeneratedText({ savedTitle: title, teaser: description, steps: input.steps });
        expect(probe.ok).toBe(full.ok);
        if (!full.ok) {
          expect(full.error).toMatchObject({ field: "description", code: "TEMPLATE_FIELD_OVERFLOW" });
          expect(probe).toMatchObject({ status: "generated-text-failure", teaserFontSize: 18 });
        } else {
          const diagnostic = probe.diagnostics.find((item) => item.field === "teaser");
          expect(diagnostic).toMatchObject({ status: "fits" });
          if (diagnostic?.status === "fits") {
            expect(diagnostic.displayText.replace(/-\n/g, "")).toBe(description);
          }
        }
      }
    }
  }, 20000);

  it.each(["font-only", "missing-font", "corrupt-font", "satori-failure"])(
    "cold probe stays text-only and fails closed: %s", async (mode) => {
      const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
      const actualSatori = await vi.importActual<typeof import("satori")>("satori");
      const reads: string[] = [];
      const nativeImport = vi.fn(() => { throw new Error("Native image dependencies must not be loaded by the probe."); });
      vi.resetModules();
      vi.doMock("sharp", nativeImport);
      vi.doMock("@resvg/resvg-js", nativeImport);
      vi.doMock("node:fs/promises", () => ({
        ...actualFs,
        readFile: async (...args: Parameters<typeof actualFs.readFile>) => {
          const path = String(args[0]).replace(/\\/g, "/");
          reads.push(path);
          if (!path.includes("/assets/fonts/") || !path.endsWith(".ttf")) throw new Error("Probe attempted a non-font asset read.");
          if (mode === "missing-font") throw new Error("Simulated unavailable font.");
          if (mode === "corrupt-font") return Buffer.from("invalid-font");
          return actualFs.readFile(...args);
        },
      }));
      vi.doMock("satori", () => ({
        ...actualSatori,
        default: mode === "satori-failure" ? async () => { throw new Error("Simulated Satori failure."); } : actualSatori.default,
      }));
      try {
        const { probeInstagramRecipeDetailsGeneratedText: freshProbe } = await import("../render");
        const result = await freshProbe({ savedTitle: "Quarkbrötchen", teaser: "Frisch gebacken.", steps: ["Backe Brötchen."] });
        if (mode === "font-only") {
          expect(result).toMatchObject({ ok: true, status: "success" });
        } else {
          expect(result).toMatchObject({
            ok: false, status: "technical-failure",
            error: { code: mode === "missing-font" ? "MISSING_ASSET" : "FONT_OR_SATORI_FAILED" },
          });
          expect(result.diagnostics.every((item) => item.status === "technical-failure")).toBe(true);
        }
        expect(nativeImport).not.toHaveBeenCalled();
        expect(reads).toHaveLength(4);
      } finally {
        vi.doUnmock("sharp");
        vi.doUnmock("@resvg/resvg-js");
        vi.doUnmock("node:fs/promises");
        vi.doUnmock("satori");
        vi.resetModules();
      }
    },
  );
});

describe("Instagram recipe details template", () => {
  it("preserves B-1 Alpha geometry and pre-extraction PNG fingerprints", async () => {
    const steps = [
      "Vermische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu einem Teig.",
      "Forme den Teig zu Brötchen.",
      "Backe die Brötchen im vorgeheizten Ofen.",
      "Lasse die Brötchen abkühlen.",
    ];
    const input = { ...quarkbroetchenDetailsFixture, steps };
    const overflow = await renderInstagramRecipeDetailsTemplate(input);
    expect(overflow).toMatchObject({
      ok: false,
      error: {
        code: "TEMPLATE_FIELD_OVERFLOW", field: "steps", itemIndex: 0,
        measured: { width: 300, height: 112, maxWidth: 302, maxHeight: 105 },
      },
    });
    const probe = await probeInstagramRecipeDetailsGeneratedText({
      savedTitle: input.title, teaser: input.description!, steps,
    });
    expect(probe).toMatchObject({ ok: false, status: "generated-text-failure", teaserFontSize: 22 });
    expect(probe.diagnostics.find((item) => item.field === "steps" && item.itemIndex === 0)).toMatchObject({
      status: "overflow", fontSize: 22,
      measured: { width: 300, height: 112, maxWidth: 302, maxHeight: 105 },
      displayText: steps[0],
    });
    expect(probe.diagnostics.filter((item) => item.field === "steps")).toHaveLength(4);
    const shorter = {
      ...input,
      steps: ["Mische Mehl, Quark, Zucker, Backpulver, Ei, Kerne und Salz zu Teig.", ...steps.slice(1)],
    };
    const hashes = [
      "b81a0cc528c389cc3b21113ef7d65ea6d7cc37ba2023b4d9fa035e087573036a",
      "bc9276a5158de0c1247a9da9b33a4fd5a072268f4fec4c7108b40ac94f460d74",
      "e1737c8af626890d61ae1cc3decac0a31e6e6de7da8ca98fe2a88982e17b130b",
    ];
    for (const [index, candidate] of [quarkbroetchenDetailsFixture, shorter, twentyIngredientsDetailsFixture].entries()) {
      const result = await renderInstagramRecipeDetailsTemplate(candidate);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(createHash("sha256").update(result.buffer).digest("hex")).toBe(hashes[index]);
      }
    }
    const passing = await probeInstagramRecipeDetailsGeneratedText({
      savedTitle: shorter.title, teaser: shorter.description!, steps: shorter.steps,
    });
    expect(passing).toMatchObject({ ok: true, status: "success", teaserFontSize: 22 });
    expect(passing.diagnostics.filter((item) => item.field === "steps"))
      .toEqual(expect.arrayContaining([expect.objectContaining({ itemIndex: 0, status: "fits", fontSize: 22 })]));
  }, 20000);

  it("omits difficulty and applies normal word wrapping to every visible text node", () => {
    const template = composeRecipeDetailsTemplate(
      { ...quarkbroetchenDetailsFixture, difficulty: "Einfach" },
      {
        photo: { src: "data:image/png;base64,", width: 1080, height: 1350 },
        wordmark: "",
        wordmarkMimeType: "image/svg+xml",
        nutritionHighlights: { "high-protein": "", "low-fat": "" },
      },
    );
    const source = JSON.stringify(template);

    expect(source).not.toContain("Schwierigkeit Einfach");
    expect(source).not.toContain('"wordBreak":"break-all"');

    const visibleTextNodes = flattenTemplateElements(template).filter((node) => {
      const children = node.props.children;
      return (typeof children === "string" && children.trim().length > 0) || typeof children === "number";
    });
    expect(visibleTextNodes.length).toBeGreaterThan(0);
    for (const node of visibleTextNodes) {
      const style = node.props.style as Record<string, unknown>;
      expect(style.wordBreak).toBe("normal");
      expect(["normal", "pre-line"]).toContain(style.whiteSpace ?? "normal");
    }
  });

  it("uses an unlabeled italic teaser at regular step size without changing other text", () => {
    const template = composeRecipeDetailsTemplate(
      quarkbroetchenDetailsFixture,
      {
        photo: { src: "data:image/png;base64,", width: 1080, height: 1350 },
        wordmark: "",
        wordmarkMimeType: "image/svg+xml",
        nutritionHighlights: { "high-protein": "", "low-fat": "" },
      },
    );
    const teaserTitle = flattenTemplateElements(template).find(
      (node) => node.props.children === "DEIN MEAL-PREP-FAVORIT",
    );
    expect(teaserTitle).toBeUndefined();
    const teaser = flattenTemplateElements(template).find(
      (node) => node.props["data-render-node"] === "recipe-details-description",
    );
    expect(teaser?.props.style).toMatchObject({ fontSize: 22, fontStyle: "italic" });
    expect(getRecipeDetailsTextLayoutFields(quarkbroetchenDetailsFixture)
      .find((field) => field.field === "description")?.style.fontSize).toBe(22);

    expect(getRecipeDetailsTitleLayout("Brötchen").fontSize).toBe(64);
    const denseFields = getRecipeDetailsTextLayoutFields(twentyIngredientsDetailsFixture);
    const regularFields = getRecipeDetailsTextLayoutFields({
      ...twentyIngredientsDetailsFixture,
      ingredients: twentyIngredientsDetailsFixture.ingredients.slice(0, 8),
      steps: twentyIngredientsDetailsFixture.steps.slice(0, 4),
    });
    const findFontSize = (
      fields: DetailTextLayoutField[],
      field: DetailTextLayoutField["field"],
    ) => fields.find((item) => item.field === field)?.style.fontSize;

    expect(findFontSize(denseFields, "ingredients")).toBe(15);
    expect(findFontSize(denseFields, "steps")).toBe(18);
    expect(findFontSize(regularFields, "ingredients")).toBe(21);
    expect(findFontSize(regularFields, "steps")).toBe(22);
  });

  it("omits only the teaser's final period from measured and rendered text", () => {
    const description = "Frisch gebacken und besonders fluffig.";
    const input = { ...quarkbroetchenDetailsFixture, description };
    const field = getRecipeDetailsTextLayoutFields(input)
      .find((item) => item.field === "description");
    const template = composeRecipeDetailsTemplate(
      input,
      {
        photo: { src: "data:image/png;base64,", width: 1080, height: 1350 },
        wordmark: "",
        wordmarkMimeType: "image/svg+xml",
        nutritionHighlights: { "high-protein": "", "low-fat": "" },
      },
    );
    const teaser = flattenTemplateElements(template).find(
      (node) => node.props["data-render-node"] === "recipe-details-description",
    );

    expect(field?.text).toBe("Frisch gebacken und besonders fluffig");
    expect(teaser?.props.children).toBe(field?.text);
    expect(input.description).toBe(description);
  });

  it("keeps short teasers at 22px and shrinks only overflowing teasers to the largest fitting size", async () => {
    const getAttemptSizes = () => vi.mocked(satori).mock.calls.flatMap(([root]) => {
      const teaser = flattenTemplateElements(root).find(
        (node) => node.props["data-render-node"] === "recipe-details-description",
      );
      return teaser ? [(teaser.props.style as Record<string, unknown>).fontSize as number] : [];
    });

    vi.mocked(satori).mockClear();
    const short = await renderInstagramRecipeDetailsTemplate(quarkbroetchenDetailsFixture);
    expect(short.ok).toBe(true);
    expect(getAttemptSizes()).toEqual([22]);

    vi.mocked(satori).mockClear();
    const dense = await renderInstagramRecipeDetailsTemplate(twentyIngredientsDetailsFixture);
    expect(dense.ok).toBe(true);
    const sizes = getAttemptSizes();
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes).toEqual(Array.from({ length: sizes.length }, (_, index) => 22 - index));
    expect(sizes.at(-1)).toBeGreaterThanOrEqual(18);
  });

  it("keeps Vorteig whole or breaks it at the measured Vor- / teig position", async () => {
    const whole = await addMeasuredGermanBreaks(
      [createTextLayoutField("whole", "Vorteig", 100)],
      measureTextRequests,
    );
    const split = await addMeasuredGermanBreaks(
      [createTextLayoutField("split", "Vorteig", 50)],
      measureTextRequests,
    );

    expect(whole.ok).toBe(true);
    expect(split.ok).toBe(true);
    if (!whole.ok || !split.ok) {
      return;
    }
    expect(whole.textById.get("whole")).toBe("Vorteig");
    expect(split.textById.get("split")).toBe("Vor-\nteig");

    const widths = await measureTextRequests([
      { id: "prefix-with-hyphen", text: "Vor-", style: createTextLayoutField("x", "", 50).style },
      { id: "suffix", text: "teig", style: createTextLayoutField("y", "", 50).style },
    ]);
    expect(widths.get("prefix-with-hyphen")).toBe(44);
    expect(widths.get("prefix-with-hyphen")).toBeLessThanOrEqual(50);
    expect(widths.get("suffix")).toBeLessThanOrEqual(50);
  });

  it("uses only German pattern positions for a forced compound break", async () => {
    const compound = "Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung";
    const field = createTextLayoutField("compound", compound, 160);
    const result = await addMeasuredGermanBreaks([field], measureTextRequests);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const lines = result.textById.get("compound")!.split("\n");
    expect(lines.length).toBeGreaterThan(1);

    const validPositions = new Set<number>();
    const markedParts = germanHyphenate(compound, { hyphenChar: HYPHENATION_MARKER })
      .split(HYPHENATION_MARKER);
    let position = 0;
    for (let index = 0; index < markedParts.length - 1; index += 1) {
      position += markedParts[index]!.length;
      validPositions.add(position);
    }

    let emittedPosition = 0;
    for (const line of lines.slice(0, -1)) {
      expect(line.endsWith("-")).toBe(true);
      emittedPosition += line.length - 1;
      expect(validPositions.has(emittedPosition)).toBe(true);
    }
    expect(lines.map((line, index) => index < lines.length - 1 ? line.slice(0, -1) : line).join(""))
      .toBe(compound);

    const lineWidths = await measureTextRequests(
      lines.map((text, index) => ({
        id: `compound-line-${index}`,
        text,
        style: field.style,
      })),
    );
    for (let index = 0; index < lines.length; index += 1) {
      expect(lineWidths.get(`compound-line-${index}`)).toBeLessThanOrEqual(field.maxWidth);
    }
  });

  it("rejects a German break when the visible hyphen cannot fit", async () => {
    const result = await addMeasuredGermanBreaks(
      [createTextLayoutField("too-narrow", "Vorteig", 40)],
      measureTextRequests,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        field: "description",
        word: "Vorteig",
        measuredWidth: 44,
        maxWidth: 40,
      },
    });
  });

  it("renders the Quarkbroetchen approval fixture as an Instagram PNG", async () => {
    const result = await renderInstagramRecipeDetailsTemplate(quarkbroetchenDetailsFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1350);
    expect(result.format).toBe("png");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });

  it("renders selective cooking summaries at 1..5 steps including 90 characters", async () => {
    const rice = "Koche Reis separat in Salzwasser und gieße ihn ab, bevor du ihn zu dem Hähnchen servierst.";
    expect(rice).toHaveLength(90);
    const core = [
      "Schneide Hähnchen.", "Brate Hähnchen an.", "Koche Reis separat.",
      "Senke die Hitze und gare Hähnchen fertig.",
    ];
    for (const steps of [
      ["Schneide Hähnchen, brate es an, koche Reis separat und gare Hähnchen fertig."],
      ["Schneide Hähnchen und brate es an.", "Koche Reis separat und gare Hähnchen fertig."],
      ["Schneide Hähnchen und brate es an.", "Koche Reis separat.", core[3]!],
      core,
      [core[0]!, core[1]!, rice, core[3]!, "Serviere Hähnchen mit Reis."],
    ]) {
      const result = await renderInstagramRecipeDetailsTemplate({
        ...quarkbroetchenDetailsFixture,
        title: "Hähnchen mit Reis",
        description: "Hähnchenpfanne mit separat gekochtem Reis.",
        ingredients: [
          { amount: "350 g", name: "Hähnchen" },
          { amount: "150 g", name: "Reis" },
          { amount: "15 g", name: "Olivenöl" },
        ],
        steps,
      });
      expect(result, result.ok ? undefined : JSON.stringify(result.error))
        .toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
      if (result.ok) {
        expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 1080, height: 1350, format: "png" });
      }
    }
  });

  it("renders the Alpha Gefluegelfrikadellen recipe with an offline reference photo as an Instagram PNG", async () => {
    const result = await renderInstagramRecipeDetailsTemplate(gefluegelfrikadellenDetailsFixture);
    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("renders seven ingredients with the full serving label at index 6 as an Instagram PNG", async () => {
    vi.mocked(satori).mockClear();
    const result = await renderInstagramRecipeDetailsTemplate(servingLabelDetailsFixture);

    expect(result, result.ok ? undefined : JSON.stringify(result.error))
      .toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
    if (!result.ok) {
      return;
    }
    expect(await sharp(result.buffer).metadata()).toMatchObject({
      width: 1080,
      height: 1350,
      format: "png",
    });
    const ingredientNodes = vi.mocked(satori).mock.calls.flatMap(([root]) =>
      flattenTemplateElements(root).filter(
        (node) => node.props["data-render-node"] === "recipe-details-ingredient-6",
      ),
    );
    expect(ingredientNodes).toHaveLength(1);
    expect(ingredientNodes[0]?.props.children).toBe("3 1 portion (10 g) Sesam");
  });

  it.each([
    { dimension: "width" as const, amount: "W".repeat(80) },
    { dimension: "height" as const, amount: "1 portion (10 g) ".repeat(30).trim() },
  ])("reports genuine amount $dimension overflow with ingredient detail", async ({ dimension, amount }) => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...servingLabelDetailsFixture,
      ingredients: servingLabelDetailsFixture.ingredients.map((ingredient, index) =>
        index === 6 ? { ...ingredient, amount } : ingredient,
      ),
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "TEMPLATE_FIELD_OVERFLOW",
        field: "ingredients",
        itemIndex: 6,
        itemField: "text",
      },
    });
    if (result.ok || result.error.code !== "TEMPLATE_FIELD_OVERFLOW") {
      return;
    }
    const measured = result.error.measured!;
    expect(measured).toMatchObject({ maxWidth: expect.any(Number), maxHeight: expect.any(Number) });
    expect(measured[dimension]).toBeGreaterThan(
      (dimension === "width" ? measured.maxWidth : measured.maxHeight)! + 0.5,
    );
  });

  it.each(["", "   ", "3\nportion", "3\rportion", "3\r\nportion", "3\u2028portion", "3\u2029portion"])(
    "rejects an empty or multiline amount %j with ingredient detail",
    async (amount) => {
      const result = await renderInstagramRecipeDetailsTemplate({
        ...servingLabelDetailsFixture,
        ingredients: servingLabelDetailsFixture.ingredients.map((ingredient, index) =>
          index === 6 ? { ...ingredient, amount } : ingredient,
        ),
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "INVALID_TEMPLATE_INPUT",
          field: "ingredients",
          itemIndex: 6,
          itemField: "amount",
          itemValue: amount,
        },
      });
    },
  );

  it("renders the nine-ingredient two-column boundary as an Instagram PNG", async () => {
    const result = await renderInstagramRecipeDetailsTemplate(nineIngredientsDetailsFixture);

    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("keeps eight ingredients in the larger one-column layout", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...nineIngredientsDetailsFixture,
      ingredients: nineIngredientsDetailsFixture.ingredients.slice(0, 8),
    });

    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("renders the fourteen-ingredient compact range as an Instagram PNG", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...nineIngredientsDetailsFixture,
      ingredients: [
        ...nineIngredientsDetailsFixture.ingredients,
        { amount: "80 g", name: "schwarze Oliven" },
        { amount: "1 Dose", name: "Kichererbsen" },
        { amount: "100 g", name: "Babyspinat" },
        { amount: "100 g", name: "Feta light" },
        { amount: "1 Bio", name: "Zitrone" },
      ],
    });

    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("renders the 20-ingredient layout prototype as an Instagram PNG", async () => {
    const result = await renderInstagramRecipeDetailsTemplate(twentyIngredientsDetailsFixture);
    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("keeps fifteen ingredients in the compact layout without the motif overflow", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...twentyIngredientsDetailsFixture,
      ingredients: twentyIngredientsDetailsFixture.ingredients.slice(0, 15),
    });
    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("rejects content that exceeds the approved template capacity", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      ingredients: Array.from({ length: 21 }, (_, index) => ({
        amount: "10 g",
        name: `Zutat ${index + 1}`,
      })),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TEMPLATE_INPUT", field: "ingredients" },
    });
  });

  it("rejects more than five preparation steps", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      steps: Array.from({ length: 6 }, () => "Ein kurzer Arbeitsschritt."),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TEMPLATE_INPUT", field: "steps" },
    });
  });

  it("renders a longer recipe name without changing the fixed Instagram canvas", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      title: "Herzhafte Quarkbrötchen mit Dinkel und Körnern",
    });

    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("rejects a teaser that does not fit the approved template space", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      description: "Teaser ".repeat(20),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TEMPLATE_INPUT", field: "description" },
    });
  });

  it("renders a long German teaser compound after a measured legal break", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      description: "Grundstücksverkehrsgenehmigungszuständigkeitsübertragungsverordnung",
    });

    expect(result).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("omits difficulty from the detail image without affecting the other metadata", async () => {
    const withDifficulty = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      difficulty: "Einfach",
    });
    const withoutDifficulty = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      difficulty: undefined,
    });
    expect(withDifficulty).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
    expect(withoutDifficulty).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
    if (!withDifficulty.ok || !withoutDifficulty.ok) {
      return;
    }
    expect(withDifficulty.buffer).toEqual(withoutDifficulty.buffer);

    const overflow = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      difficulty: "Schwierigkeit ".repeat(30),
    });
    expect(overflow).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("omits a null time chip while retaining portions and ingredient count", async () => {
    const input = { ...quarkbroetchenDetailsFixture, totalTimeMinutes: null, difficulty: null };
    const template = composeRecipeDetailsTemplate(input, {
      photo: { src: "data:image/png;base64,", width: 1080, height: 1350 },
      wordmark: "",
      wordmarkMimeType: "image/svg+xml",
      nutritionHighlights: { "high-protein": "", "low-fat": "" },
    });
    const source = JSON.stringify(template);

    expect(source).not.toContain("25 Min.");
    expect(source).toContain(`${input.portions} Portionen`);
    expect(source).toContain(`${input.ingredients.length} Zutaten`);
    const rendered = await renderInstagramRecipeDetailsTemplate(input);
    expect(rendered).toMatchObject({ ok: true, width: 1080, height: 1350, format: "png" });
  });

  it("rejects ingredient and step text instead of silently clipping it", async () => {
    const invalidIngredientName = "Sehr langer Zutatenname ".repeat(3);
    const longIngredient = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      ingredients: [{ amount: "250 g", name: invalidIngredientName }],
    });
    const longStep = await renderInstagramRecipeDetailsTemplate({
      ...quarkbroetchenDetailsFixture,
      steps: ["Sehr langer Arbeitsschritt ".repeat(5)],
    });

    expect(longIngredient).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_TEMPLATE_INPUT",
        field: "ingredients",
        itemIndex: 0,
        itemField: "name",
        itemValue: invalidIngredientName,
      },
    });
    expect(longStep).toMatchObject({
      ok: false,
      error: { code: "INVALID_TEMPLATE_INPUT", field: "steps" },
    });
  });

  it("reports a production-font overflow with a field-specific error", async () => {
    const result = await renderInstagramRecipeDetailsTemplate({
      ...twentyIngredientsDetailsFixture,
      title: "Mediterrane Geflügel-Frikadellen-Bowl mit Couscoussalat",
      description: "W".repeat(96),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_FIELD_OVERFLOW", field: "description" },
    });
  });
});