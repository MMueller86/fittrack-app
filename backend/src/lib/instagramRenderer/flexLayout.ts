import type { FontBook, FontSpec } from "./fontBook";

type StyleValue = string | number | boolean;
export type Style = Record<string, StyleValue>;
export type TreeChild = TreeElement | string | number | null | undefined | boolean | TreeChild[];
export type TreeElement = {
  type: string;
  props: Record<string, unknown> & { children?: TreeChild; style?: Style };
};

type Sides = { t: number; r: number; b: number; l: number };

export type BorderSide = { width: number; color: string };

export type LayoutNode = {
  kind: "box" | "text" | "image";
  element?: TreeElement;
  style: Style;
  children: LayoutNode[];
  text?: string;
  // Layout result relative to the parent's border box (unrounded).
  x: number;
  y: number;
  w: number;
  h: number;
  lines?: string[];
  lineHeight?: number;
  font?: FontSpec;
  // Pixel-snapped absolute border box.
  bx: number;
  by: number;
  bw: number;
  bh: number;
};

const INHERITED = [
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "whiteSpace",
  "wordBreak",
  "textAlign",
] as const;

export function px(value: StyleValue | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/u.exec(value.trim());
    if (match) return Number(match[1]);
  }
  return undefined;
}

function sides(style: Style, base: "padding" | "margin"): Sides {
  const all = px(style[base]) ?? 0;
  return {
    t: px(style[`${base}Top`]) ?? all,
    r: px(style[`${base}Right`]) ?? all,
    b: px(style[`${base}Bottom`]) ?? all,
    l: px(style[`${base}Left`]) ?? all,
  };
}

function parseBorderShorthand(value: StyleValue | undefined): Partial<BorderSide> {
  if (typeof value !== "string") return {};
  const match = /^\s*(-?\d+(?:\.\d+)?)px\s+(?:solid\s+)?(.+?)\s*$/u.exec(value);
  if (!match) {
    if (/^\s*(none|0)\s*$/u.test(value)) return { width: 0 };
    throw new Error(`Unsupported border value: ${value}`);
  }
  return { width: Number(match[1]), color: match[2] };
}

export function borders(style: Style): { t: BorderSide; r: BorderSide; b: BorderSide; l: BorderSide } {
  const base = parseBorderShorthand(style.border);
  const side = (name: "Top" | "Right" | "Bottom" | "Left"): BorderSide => {
    const own = parseBorderShorthand(style[`border${name}`]);
    return {
      width: px(style[`border${name}Width`]) ?? own.width ?? px(style.borderWidth) ?? base.width ?? 0,
      color: (style[`border${name}Color`] as string | undefined) ?? own.color ??
        (style.borderColor as string | undefined) ?? base.color ?? "transparent",
    };
  };
  return { t: side("Top"), r: side("Right"), b: side("Bottom"), l: side("Left") };
}

function insets(node: LayoutNode): Sides {
  const border = borders(node.style);
  const padding = sides(node.style, "padding");
  return {
    t: border.t.width + padding.t,
    r: border.r.width + padding.r,
    b: border.b.width + padding.b,
    l: border.l.width + padding.l,
  };
}

function isAbsolute(node: LayoutNode): boolean {
  return node.style.position === "absolute";
}

function flattenChildren(value: TreeChild, output: Array<TreeElement | string>): void {
  if (value === null || value === undefined || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const child of value) flattenChildren(child, output);
    return;
  }
  output.push(typeof value === "number" ? String(value) : value);
}

export function buildTree(element: TreeElement, inherited: Style = {}): LayoutNode {
  const own = element.props.style ?? {};
  const style: Style = { ...own };
  for (const key of INHERITED) {
    if (style[key] === undefined && inherited[key] !== undefined) style[key] = inherited[key]!;
  }
  const empty = { x: 0, y: 0, w: 0, h: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  if (element.type === "img") {
    return { kind: "image", element, style, children: [], ...empty };
  }
  const flat: Array<TreeElement | string> = [];
  flattenChildren(element.props.children, flat);
  const children = flat.map((child): LayoutNode => {
    if (typeof child === "string") {
      const textStyle: Style = {};
      for (const key of INHERITED) if (style[key] !== undefined) textStyle[key] = style[key]!;
      return { kind: "text", style: textStyle, text: child, children: [], ...empty };
    }
    return buildTree(child, style);
  });
  return { kind: "box", element, style, children, ...empty };
}

function fontSpecOf(style: Style): FontSpec {
  const size = px(style.fontSize) ?? 16;
  return {
    family: String(style.fontFamily ?? "Inter"),
    size,
    weight: typeof style.fontWeight === "number" ? style.fontWeight : Number(style.fontWeight ?? 400) || 400,
    italic: style.fontStyle === "italic",
    letterSpacing: px(style.letterSpacing) ?? 0,
  };
}

// Break opportunities: spaces and after a hyphen that is followed by a letter.
function splitSegments(paragraph: string): Array<{ text: string; spaceBefore: boolean }> {
  const segments: Array<{ text: string; spaceBefore: boolean }> = [];
  paragraph.split(" ").forEach((word, wordIndex) => {
    if (word.length === 0) return;
    const parts = word.split(/(?<=-)(?=[^\s\d-])/u);
    parts.forEach((part, partIndex) => {
      segments.push({ text: part, spaceBefore: wordIndex > 0 && partIndex === 0 });
    });
  });
  return segments;
}

function breakLines(
  text: string,
  mode: "nowrap" | "normal" | "pre-line",
  maxWidth: number | undefined,
  measure: (value: string) => number,
): string[] {
  const paragraphs = mode === "pre-line" ? text.split(/\r?\n/u) : [text];
  const lines: string[] = [];
  for (const raw of paragraphs) {
    const paragraph = raw.replace(/[ \t\r\n\f]+/gu, " ").trim();
    if (mode === "nowrap" || maxWidth === undefined) {
      lines.push(paragraph);
      continue;
    }
    let current = "";
    for (const segment of splitSegments(paragraph)) {
      const candidate = current === "" ? segment.text : `${current}${segment.spaceBefore ? " " : ""}${segment.text}`;
      if (current === "" || measure(candidate) <= maxWidth + 0.01) {
        current = candidate;
      } else {
        lines.push(current);
        current = segment.text;
      }
    }
    lines.push(current);
  }
  return lines;
}

function layoutText(
  node: LayoutNode,
  forcedWidth: number | undefined,
  forcedHeight: number | undefined,
  availableWidth: number | undefined,
  fonts: FontBook,
): void {
  const font = fontSpecOf(node.style);
  const resolved = fonts.resolve(font);
  const whiteSpace = node.style.whiteSpace === "nowrap" || node.style.whiteSpace === "pre-line"
    ? node.style.whiteSpace
    : "normal";
  const lineHeightValue = node.style.lineHeight;
  // Line boxes are whole pixels, matching the rounded line heights of the Satori baseline.
  const lineHeight = Math.round(typeof lineHeightValue === "number"
    ? lineHeightValue * font.size
    : (resolved.ascent + resolved.descent + resolved.lineGap) * font.size);
  const measure = (value: string) => fonts.measure(value, font);
  const wrapWidth = forcedWidth ?? availableWidth;
  const lines = breakLines(node.text ?? "", whiteSpace, wrapWidth, measure);
  const natural = Math.max(0, ...lines.map(measure));
  node.lines = lines;
  node.lineHeight = lineHeight;
  node.font = font;
  node.w = forcedWidth ?? Math.ceil(natural);
  node.h = forcedHeight ?? lines.length * lineHeight;
}

type Item = {
  node: LayoutNode;
  mainMargin: number;
  crossMargin: number;
  marginStart: number;
  marginCrossStart: number;
  crossForced: number | undefined;
  styleCross: number | undefined;
  align: string;
  grow: number;
  shrink: number;
  min: number;
  max: number;
  basis: number;
  main: number;
};

export function layoutNode(
  node: LayoutNode,
  forcedWidth: number | undefined,
  forcedHeight: number | undefined,
  availableWidth: number | undefined,
  fonts: FontBook,
): void {
  if (node.kind === "text") {
    layoutText(node, forcedWidth, forcedHeight, availableWidth, fonts);
    return;
  }
  const style = node.style;
  if (node.kind === "image") {
    node.w = forcedWidth ?? px(style.width) ?? 0;
    node.h = forcedHeight ?? px(style.height) ?? 0;
    return;
  }

  const inset = insets(node);
  const width = forcedWidth ?? px(style.width);
  const height = forcedHeight ?? px(style.height);
  const innerWidth = width === undefined ? undefined : Math.max(0, width - inset.l - inset.r);
  const innerHeight = height === undefined ? undefined : Math.max(0, height - inset.t - inset.b);
  const capWidth = innerWidth ?? (availableWidth === undefined ? undefined : Math.max(0, availableWidth - inset.l - inset.r));
  const isRow = style.flexDirection !== "column";
  const gap = px(style.gap) ?? 0;
  const justify = String(style.justifyContent ?? "flex-start");
  const alignItems = String(style.alignItems ?? "stretch");
  const innerMain = isRow ? innerWidth : innerHeight;
  const innerCross = isRow ? innerHeight : innerWidth;
  const capMain = isRow ? capWidth : undefined;
  const capCross = isRow ? undefined : capWidth;

  const flow = node.children.filter((child) => !isAbsolute(child));
  const items: Item[] = flow.map((child) => {
    const margin = sides(child.style, "margin");
    const mainMargin = isRow ? margin.l + margin.r : margin.t + margin.b;
    const crossMargin = isRow ? margin.t + margin.b : margin.l + margin.r;
    const styleMain = px(isRow ? child.style.width : child.style.height);
    const styleCross = px(isRow ? child.style.height : child.style.width);
    const align = String(child.style.alignSelf ?? alignItems);
    const crossForced = styleCross ?? (align === "stretch" && innerCross !== undefined
      ? Math.max(0, innerCross - crossMargin)
      : undefined);
    const flexNumber = typeof child.style.flex === "number" ? child.style.flex : undefined;
    const grow = typeof child.style.flexGrow === "number" ? child.style.flexGrow : Math.max(0, flexNumber ?? 0);
    const shrink = typeof child.style.flexShrink === "number" ? child.style.flexShrink : 1;
    const min = px(isRow ? child.style.minWidth : child.style.minHeight) ?? 0;
    const max = px(isRow ? child.style.maxWidth : child.style.maxHeight) ?? Number.POSITIVE_INFINITY;
    let basis = px(child.style.flexBasis);
    if (basis === undefined) basis = flexNumber !== undefined ? 0 : styleMain;
    if (basis === undefined) {
      if (isRow) {
        layoutNode(child, undefined, crossForced, undefined, fonts);
        basis = child.w;
      } else {
        layoutNode(child, crossForced, undefined, crossForced === undefined && capCross !== undefined ? capCross - crossMargin : undefined, fonts);
        basis = child.h;
      }
    }
    // Unwrappable text cannot shrink below its content width (min-content equals max-content).
    const unshrinkable = isRow && child.kind === "text" && child.style.whiteSpace === "nowrap";
    return {
      node: child, mainMargin, crossMargin,
      marginStart: isRow ? margin.l : margin.t,
      marginCrossStart: isRow ? margin.t : margin.l,
      crossForced, styleCross, align, grow, shrink, max,
      min: unshrinkable ? Math.max(min, basis) : min,
      basis: Math.min(Math.max(basis, min), max), main: 0,
    };
  });

  const gaps = gap * Math.max(0, items.length - 1);
  const total = items.reduce((sum, item) => sum + item.basis + item.mainMargin, 0) + gaps;
  const mainSpace = innerMain ?? (capMain !== undefined && total > capMain ? capMain : total);
  items.forEach((item) => { item.main = item.basis; });
  let free = mainSpace - total;
  if (free > 0) {
    const growTotal = items.reduce((sum, item) => sum + item.grow, 0);
    if (growTotal > 0) {
      for (const item of items) item.main = Math.min(item.max, item.basis + (free * item.grow) / growTotal);
    }
  } else if (free < 0) {
    const frozen = new Set<Item>();
    for (let pass = 0; pass < items.length; pass += 1) {
      const active = items.filter((item) => !frozen.has(item));
      const used = items.reduce((sum, item) => sum + (frozen.has(item) ? item.main : item.basis) + item.mainMargin, 0) + gaps;
      const deficit = used - mainSpace;
      const scaled = active.reduce((sum, item) => sum + item.shrink * item.basis, 0);
      if (deficit <= 0 || scaled <= 0) break;
      let clamped = false;
      for (const item of active) {
        const target = item.basis - (deficit * item.shrink * item.basis) / scaled;
        if (target < item.min) {
          item.main = item.min;
          frozen.add(item);
          clamped = true;
        } else {
          item.main = target;
        }
      }
      if (!clamped) break;
    }
  }

  const finalizeItem = (item: Item, cross: number | undefined) => {
    if (isRow) {
      layoutNode(item.node, item.main, cross, undefined, fonts);
    } else {
      layoutNode(item.node, cross, item.main, cross === undefined && capCross !== undefined ? capCross - item.crossMargin : undefined, fonts);
    }
  };
  for (const item of items) finalizeItem(item, item.crossForced);

  const crossOf = (item: Item) => (isRow ? item.node.h : item.node.w);
  let maxCross = items.reduce((max, item) => Math.max(max, crossOf(item) + item.crossMargin), 0);
  if (innerCross === undefined) {
    for (const item of items) {
      if (item.align === "stretch" && item.styleCross === undefined && crossOf(item) + item.crossMargin < maxCross) {
        finalizeItem(item, Math.max(0, maxCross - item.crossMargin));
      }
    }
    maxCross = items.reduce((max, item) => Math.max(max, crossOf(item) + item.crossMargin), 0);
  }
  const crossSpace = innerCross ?? maxCross;
  const used = items.reduce((sum, item) => sum + item.main + item.mainMargin, 0) + gaps;
  const mainContent = innerMain ?? used;
  const remaining = mainSpace - used;

  node.w = width ?? (isRow ? mainContent : crossSpace) + inset.l + inset.r;
  node.h = height ?? (isRow ? crossSpace : mainContent) + inset.t + inset.b;

  let cursor = 0;
  let spacing = gap;
  if (justify === "center") cursor = remaining / 2;
  else if (justify === "flex-end") cursor = remaining;
  else if (justify === "space-between" && items.length > 1) spacing = gap + remaining / (items.length - 1);
  else if (justify === "space-around" && items.length > 0) {
    spacing = gap + remaining / items.length;
    cursor = remaining / items.length / 2;
  } else if (justify === "space-evenly" && items.length > 0) {
    spacing = gap + remaining / (items.length + 1);
    cursor = remaining / (items.length + 1);
  }

  for (const item of items) {
    const crossSize = crossOf(item);
    let crossOffset = item.marginCrossStart;
    if (item.align === "center") crossOffset = (crossSpace - crossSize - item.crossMargin) / 2 + item.marginCrossStart;
    else if (item.align === "flex-end") crossOffset = crossSpace - crossSize - (item.crossMargin - item.marginCrossStart);
    const mainOffset = cursor + item.marginStart;
    item.node.x = (isRow ? mainOffset : crossOffset) + inset.l;
    item.node.y = (isRow ? crossOffset : mainOffset) + inset.t;
    cursor += item.main + item.mainMargin + spacing;
  }

  const border = borders(style);
  // Absolute children are positioned against the padding box (inside the border).
  const areaWidth = node.w - border.l.width - border.r.width;
  const areaHeight = node.h - border.t.width - border.b.width;
  for (const child of node.children.filter(isAbsolute)) {
    const left = px(child.style.left);
    const right = px(child.style.right);
    const top = px(child.style.top);
    const bottom = px(child.style.bottom);
    const childWidth = px(child.style.width) ?? (left !== undefined && right !== undefined ? areaWidth - left - right : undefined);
    const childHeight = px(child.style.height) ?? (top !== undefined && bottom !== undefined ? areaHeight - top - bottom : undefined);
    layoutNode(child, childWidth, childHeight, childWidth === undefined ? Math.max(0, areaWidth - (left ?? 0)) : undefined, fonts);
    child.x = left !== undefined ? border.l.width + left
      : right !== undefined ? node.w - border.r.width - right - child.w
      : inset.l;
    child.y = top !== undefined ? border.t.width + top
      : bottom !== undefined ? node.h - border.b.width - bottom - child.h
      : inset.t;
  }
}

// Snap boxes to the pixel grid from absolute edges so neighbouring boxes never gain or lose a pixel.
export function snapToPixels(node: LayoutNode, originX: number, originY: number): void {
  const absoluteX = originX + node.x;
  const absoluteY = originY + node.y;
  node.bx = Math.round(absoluteX);
  node.by = Math.round(absoluteY);
  node.bw = Math.round(absoluteX + node.w) - node.bx;
  node.bh = Math.round(absoluteY + node.h) - node.by;
  for (const child of node.children) snapToPixels(child, absoluteX, absoluteY);
}
