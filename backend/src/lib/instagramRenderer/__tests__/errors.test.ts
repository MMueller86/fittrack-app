import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { quarkbroetchenFixture } from "../fixtures/quarkbroetchen";
import { renderInstagramRecipe } from "../index";
import type { RenderInput } from "../types";

vi.mock("../tagIcons", async () => {
  const actual = await vi.importActual<typeof import("../tagIcons")>("../tagIcons");

  return {
    ...actual,
    resolveTagIcon: (tagId: string) => {
      if (tagId === "missing-asset") {
        throw new actual.TagIconAssetError("test/missing.svg");
      }
      return actual.resolveTagIcon(tagId);
    },
  };
});

function createInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    ...quarkbroetchenFixture,
    presentation: { ...quarkbroetchenFixture.presentation },
    tags: quarkbroetchenFixture.tags.map((tag) => ({ ...tag })),
    nutrition: { ...quarkbroetchenFixture.nutrition },
    ...overrides,
  };
}

async function expectError(input: RenderInput, code: string): Promise<void> {
  const result = await renderInstagramRecipe(input);

  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }

  expect(result.error.code).toBe(code);
}

describe("Instagram recipe renderer validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a title that exceeds the fixed width", async () => {
    await expectError(
      createInput({ title: "Quarkbrötchen ".repeat(50) }),
      "TITLE_OVERFLOW",
    );
  });

  it("rejects more than four tags", async () => {
    await expectError(
      createInput({
        tags: [
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
          { id: "three", label: "Three" },
          { id: "four", label: "Four" },
          { id: "five", label: "Five" },
        ],
      }),
      "TOO_MANY_TAGS",
    );
  });

  it("rejects a tag row that exceeds the fixed width", async () => {
    await expectError(
      createInput({
        title: "Kurz",
        tags: Array.from({ length: 4 }, (_, index) => ({
          id: `long-${index}`,
          label: "Sehr langer Tag ".repeat(40),
        })),
      }),
      "TAG_ROW_OVERFLOW",
    );
  });

  it("rejects zoom values below one", async () => {
    await expectError(
      createInput({ presentation: { ...quarkbroetchenFixture.presentation, zoom: 0.99 } }),
      "INVALID_ZOOM",
    );
  });

  it("rejects focus values outside the normalized range", async () => {
    await expectError(
      createInput({
        presentation: { ...quarkbroetchenFixture.presentation, focusX: 1.01 },
      }),
      "INVALID_FOCUS",
    );
  });

  it("returns IMAGE_UNREADABLE for a missing input image", async () => {
    await expectError(
      createInput({ image: { path: resolve(__dirname, "does-not-exist.png") } }),
      "IMAGE_UNREADABLE",
    );
  });

  it("returns MISSING_ASSET when an icon asset cannot be loaded", async () => {
    await expectError(
      createInput({
        title: "Kurz",
        tags: [{ id: "missing-asset", label: "Missing" }],
      }),
      "MISSING_ASSET",
    );
  });

  it("translates unexpected runtime failures to INTERNAL", async () => {
    await expectError(
      { ...createInput(), tags: undefined } as unknown as RenderInput,
      "INTERNAL",
    );
  });
});