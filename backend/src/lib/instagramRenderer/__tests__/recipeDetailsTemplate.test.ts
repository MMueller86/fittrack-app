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
import { renderInstagramRecipeDetailsTemplate } from "../index";
import {
  composeRecipeDetailsTemplate,
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

describe("Instagram recipe details template", () => {
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