import { createHash } from "node:crypto";

import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";

export type RendererFont = {
  name: string;
  weight?: number;
  style?: "normal" | "italic";
  data: Buffer;
};

export type ResolvedFont = {
  alias: string;
  ascent: number;
  descent: number;
  lineGap: number;
};

export type FontSpec = {
  family: string;
  size: number;
  weight: number;
  italic: boolean;
  letterSpacing: number;
};

type RegisteredFont = RendererFont & ResolvedFont & { weight: number; style: "normal" | "italic" };

const registeredAliases = new Map<string, ResolvedFont>();
const fontIdentity = new WeakMap<Buffer, string>();
let measureContext: SKRSContext2D | undefined;

function getMeasureContext(): SKRSContext2D {
  measureContext ??= createCanvas(1, 1).getContext("2d");
  return measureContext;
}

function readVerticalMetrics(data: Buffer): { ascent: number; descent: number; lineGap: number } {
  if (data.length < 12) throw new Error("Font file is too small to be an sfnt font.");
  const magic = data.readUInt32BE(0);
  if (magic !== 0x00010000 && magic !== 0x4f54544f && magic !== 0x74727565) {
    throw new Error("Font file is not a TrueType/OpenType font.");
  }
  const tableCount = data.readUInt16BE(4);
  const tables = new Map<string, number>();
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (record + 16 > data.length) throw new Error("Font table directory is truncated.");
    tables.set(data.toString("latin1", record, record + 4), data.readUInt32BE(record + 8));
  }
  const head = tables.get("head");
  const hhea = tables.get("hhea");
  if (head === undefined || hhea === undefined || head + 20 > data.length || hhea + 10 > data.length) {
    throw new Error("Font is missing head/hhea tables.");
  }
  const unitsPerEm = data.readUInt16BE(head + 18);
  if (unitsPerEm === 0) throw new Error("Font has invalid unitsPerEm.");
  return {
    ascent: data.readInt16BE(hhea + 4) / unitsPerEm,
    descent: -data.readInt16BE(hhea + 6) / unitsPerEm,
    lineGap: data.readInt16BE(hhea + 8) / unitsPerEm,
  };
}

// Fonts are registered under a content-derived alias so only bundled font bytes are ever used for text.
function registerFont(font: RendererFont): ResolvedFont {
  let identity = fontIdentity.get(font.data);
  if (identity === undefined) {
    identity = createHash("sha1").update(font.data).digest("hex").slice(0, 16);
    fontIdentity.set(font.data, identity);
  }
  const alias = `fittrack-${identity}`;
  const known = registeredAliases.get(alias);
  if (known) return known;

  const metrics = readVerticalMetrics(font.data);
  if (!GlobalFonts.register(font.data, alias)) {
    throw new Error(`Unable to register font "${font.name}".`);
  }
  const resolved = { alias, ...metrics };
  registeredAliases.set(alias, resolved);
  return resolved;
}

export class FontBook {
  private readonly fonts: RegisteredFont[];
  private readonly widthCache = new Map<string, number>();

  constructor(fonts: readonly RendererFont[]) {
    this.fonts = fonts.map((font) => ({
      ...font,
      ...registerFont(font),
      weight: font.weight ?? 400,
      style: font.style ?? "normal",
    }));
  }

  resolve(spec: Pick<FontSpec, "family" | "weight" | "italic">): ResolvedFont {
    const candidates = this.fonts.filter((font) => font.name === spec.family);
    if (candidates.length === 0) {
      throw new Error(`Font family "${spec.family}" is not registered.`);
    }
    const wanted = spec.italic ? "italic" : "normal";
    const ranked = [...candidates].sort((left, right) =>
      Number(left.style !== wanted) - Number(right.style !== wanted) ||
      Math.abs(left.weight - spec.weight) - Math.abs(right.weight - spec.weight),
    );
    return ranked[0]!;
  }

  measure(text: string, spec: FontSpec): number {
    const font = this.resolve(spec);
    const key = `${font.alias}|${spec.size}|${spec.letterSpacing}|${text}`;
    const cached = this.widthCache.get(key);
    if (cached !== undefined) return cached;
    const context = getMeasureContext();
    context.font = `${spec.size}px "${font.alias}"`;
    context.letterSpacing = `${spec.letterSpacing}px`;
    const width = context.measureText(text).width;
    this.widthCache.set(key, width);
    return width;
  }

  cssFont(spec: FontSpec): string {
    return `${spec.size}px "${this.resolve(spec).alias}"`;
  }
}
