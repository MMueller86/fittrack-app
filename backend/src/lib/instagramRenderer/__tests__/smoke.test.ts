import { describe, expect, it } from "vitest";

import { renderInstagramRecipe } from "../index";
import { smokeFixture } from "../fixtures/smoke";

describe("Instagram recipe renderer smoke fixture", () => {
  it("renders the alternate recipe without a golden comparison", async () => {
    const result = await renderInstagramRecipe(smokeFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1350);
    expect(result.format).toBe("png");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});