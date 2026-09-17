import { readFileSync } from "node:fs";

import { COLOR_LIME } from "./layout";

export type ResolvedTagIcon = {
  svg: string;
  source: "lucide" | "tabler";
};

type IconDefinition = { asset: string; source: ResolvedTagIcon["source"] };

export class TagIconAssetError extends Error {
  readonly asset: string;

  constructor(asset: string) {
    super(`Unable to load tag icon asset: ${asset}`);
    this.name = "TagIconAssetError";
    this.asset = asset;
  }
}

function normalizeSvg(svg: string): string {
  let normalized = svg
    .replace(/\s+stroke="[^"]*"/gi, ` stroke="${COLOR_LIME}"`)
    .replace(/\s+stroke-width="[^"]*"/gi, ' stroke-width="2"')
    .replace(/\s+stroke-linecap="[^"]*"/gi, ' stroke-linecap="round"')
    .replace(/\s+stroke-linejoin="[^"]*"/gi, ' stroke-linejoin="round"')
    .replace(/\s+color="[^"]*"/gi, ` color="${COLOR_LIME}"`)
    .replace(/\s+fill="currentColor"/gi, ` fill="${COLOR_LIME}"`);

  normalized = normalized.replace(/<svg\b([^>]*)>/i, (_match, attributes: string) => {
    const rootAttributes = attributes
      .replace(/\s+stroke="[^"]*"/gi, "")
      .replace(/\s+stroke-width="[^"]*"/gi, "")
      .replace(/\s+stroke-linecap="[^"]*"/gi, "")
      .replace(/\s+stroke-linejoin="[^"]*"/gi, "")
      .replace(/\s+color="[^"]*"/gi, "");

    return `<svg${rootAttributes} stroke="${COLOR_LIME}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
  });

  return normalized;
}

function loadIcon(asset: string): string {
  try {
    return normalizeSvg(readFileSync(require.resolve(asset), "utf8"));
  } catch {
    throw new TagIconAssetError(asset);
  }
}

const ICONS: Record<string, IconDefinition> = {
  schnell: { asset: "lucide-static/icons/timer.svg", source: "lucide" },
  vegetarisch: { asset: "lucide-static/icons/leaf.svg", source: "lucide" },
  familienrezept: { asset: "lucide-static/icons/house-heart.svg", source: "lucide" },
  backen: { asset: "lucide-static/icons/microwave.svg", source: "lucide" },
  gesund: { asset: "lucide-static/icons/heart-pulse.svg", source: "lucide" },
  snack: { asset: "lucide-static/icons/popcorn.svg", source: "lucide" },
  wraps: { asset: "lucide-static/icons/sandwich.svg", source: "lucide" },
  salat: { asset: "lucide-static/icons/salad.svg", source: "lucide" },
  grillen: { asset: "lucide-static/icons/flame.svg", source: "lucide" },
  italienisch: { asset: "lucide-static/icons/pizza.svg", source: "lucide" },
  vollkorn: { asset: "lucide-static/icons/wheat.svg", source: "lucide" },
  sauerteig: { asset: "@tabler/icons/outline/bread.svg", source: "tabler" },
  dessert: { asset: "lucide-static/icons/cake-slice.svg", source: "lucide" },
  klassisch: { asset: "lucide-static/icons/book-open.svg", source: "lucide" },
  einfach: { asset: "lucide-static/icons/sparkles.svg", source: "lucide" },
  fruhstuck: { asset: "lucide-static/icons/croissant.svg", source: "lucide" },
  kontaktgrill: { asset: "lucide-static/icons/flame.svg", source: "lucide" },
  hahnchen: { asset: "lucide-static/icons/drumstick.svg", source: "lucide" },
  "one pot": { asset: "lucide-static/icons/cooking-pot.svg", source: "lucide" },
  pasta: { asset: "@tabler/icons/outline/bowl.svg", source: "tabler" },
  fingerfood: { asset: "lucide-static/icons/hand-platter.svg", source: "lucide" }
};

const ICON_CACHE = new Map<string, string>();

function normalizeTagId(tagId: string): string {
  return tagId
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveTagIcon(tagId: string): ResolvedTagIcon | null {
  const normalizedTagId = normalizeTagId(tagId);
  const canonicalTagId = normalizedTagId === "snacks" ? "snack" : normalizedTagId;

  if (canonicalTagId === "curry") {
    return null;
  }

  const icon = ICONS[canonicalTagId];
  if (!icon) {
    return null;
  }

  let svg = ICON_CACHE.get(canonicalTagId);
  if (!svg) {
    svg = loadIcon(icon.asset);
    ICON_CACHE.set(canonicalTagId, svg);
  }

  return { svg, source: icon.source };
}