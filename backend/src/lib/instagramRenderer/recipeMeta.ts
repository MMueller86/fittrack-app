import { readFileSync } from "node:fs";

import { COLOR_SECONDARY_TEXT } from "./layout";

export type RecipeMetaIconAssets = {
  totalTime: string;
  portions: string;
  difficulty: string;
};

export class RecipeMetaIconAssetError extends Error {
  readonly asset: string;

  constructor(asset: string) {
    super(`Unable to load recipe meta icon asset: ${asset}`);
    this.name = "RecipeMetaIconAssetError";
    this.asset = asset;
  }
}

function normalizeSvg(svg: string): string {
  const normalized = svg
    .replace(/\s+stroke="[^"]*"/gi, ` stroke="${COLOR_SECONDARY_TEXT}"`)
    .replace(/\s+stroke-width="[^"]*"/gi, ' stroke-width="2"')
    .replace(/\s+stroke-linecap="[^"]*"/gi, ' stroke-linecap="round"')
    .replace(/\s+stroke-linejoin="[^"]*"/gi, ' stroke-linejoin="round"')
    .replace(/\s+color="[^"]*"/gi, ` color="${COLOR_SECONDARY_TEXT}"`)
    .replace(/\s+fill="currentColor"/gi, ` fill="${COLOR_SECONDARY_TEXT}"`);

  return normalized.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => {
    const rootAttributes = attributes
      .replace(/\s+stroke="[^"]*"/gi, "")
      .replace(/\s+stroke-width="[^"]*"/gi, "")
      .replace(/\s+stroke-linecap="[^"]*"/gi, "")
      .replace(/\s+stroke-linejoin="[^"]*"/gi, "")
      .replace(/\s+color="[^"]*"/gi, "");

    return `<svg${rootAttributes} stroke="${COLOR_SECONDARY_TEXT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
  });
}

function loadIcon(asset: string): string {
  try {
    return normalizeSvg(readFileSync(require.resolve(asset), "utf8"));
  } catch {
    throw new RecipeMetaIconAssetError(asset);
  }
}

export function loadRecipeMetaIcons(): RecipeMetaIconAssets {
  return {
    totalTime: loadIcon("lucide-static/icons/timer.svg"),
    portions: loadIcon("lucide-static/icons/users.svg"),
    difficulty: loadIcon("lucide-static/icons/signal.svg"),
  };
}