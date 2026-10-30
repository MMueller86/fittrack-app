import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";

import type { FontBook } from "./fontBook";
import { borders, px, type LayoutNode } from "./flexLayout";

export type LoadedImages = Map<LayoutNode, Image>;

function roundedRectPath(context: SKRSContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  if (r > 0) context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  if (r > 0) context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  if (r > 0) context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  if (r > 0) context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

type Stop = { color: string; position: number | undefined; unit: "%" | "px" };

function parseStops(parts: string[]): Stop[] {
  return parts.map((part) => {
    const match = /^(.*?)(?:\s+(-?\d+(?:\.\d+)?)(%|px))?$/su.exec(part);
    if (!match) throw new Error(`Unsupported gradient stop: ${part}`);
    return {
      color: match[1]!.trim(),
      position: match[2] === undefined ? undefined : Number(match[2]),
      unit: (match[3] as "%" | "px" | undefined) ?? "%",
    };
  });
}

function applyStops(gradient: CanvasGradient, stops: Stop[], length: number): void {
  stops.forEach((stop, index) => {
    const position = stop.position === undefined
      ? stops.length === 1 ? 0 : index / (stops.length - 1)
      : stop.unit === "%" ? stop.position / 100 : stop.position / length;
    gradient.addColorStop(Math.min(1, Math.max(0, position)), stop.color);
  });
}

function directionDegrees(token: string): number | undefined {
  const keywords: Record<string, number> = {
    "to top": 0,
    "to right": 90,
    "to bottom": 180,
    "to left": 270,
  };
  const keyword = keywords[token.trim()];
  if (keyword !== undefined) return keyword;
  const match = /^(-?\d+(?:\.\d+)?)deg$/u.exec(token.trim());
  return match ? Number(match[1]) : undefined;
}

function paintGradient(
  context: SKRSContext2D,
  css: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const match = /^(linear|radial)-gradient\((.*)\)$/su.exec(css.trim());
  if (!match) throw new Error(`Unsupported background-image: ${css.slice(0, 60)}`);
  const parts = splitTopLevel(match[2]!);
  if (match[1] === "linear") {
    const degrees = directionDegrees(parts[0]!);
    const stops = parseStops(degrees === undefined ? parts : parts.slice(1));
    const angle = ((degrees ?? 180) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const length = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const gradient = context.createLinearGradient(
      cx - (dx * length) / 2, cy - (dy * length) / 2, cx + (dx * length) / 2, cy + (dy * length) / 2,
    );
    applyStops(gradient, stops, length);
    context.fillStyle = gradient;
  } else {
    const shape = /^circle\s+(\d+(?:\.\d+)?)px\s+at\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px$/u.exec(parts[0]!);
    if (!shape) throw new Error(`Unsupported radial-gradient shape: ${parts[0]}`);
    const radius = Number(shape[1]);
    const cx = x + Number(shape[2]);
    const cy = y + Number(shape[3]);
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    applyStops(gradient, parseStops(parts.slice(1)), radius);
    context.fillStyle = gradient;
  }
  context.fillRect(x, y, w, h);
}

function lengthOrPercent(token: string | undefined, full: number): number {
  if (token === undefined || token === "auto") return full;
  if (token.endsWith("%")) return (Number.parseFloat(token) / 100) * full;
  return Number.parseFloat(token);
}

function positionOffset(token: string | undefined, free: number): number {
  if (token === undefined || token === "left" || token === "top") return 0;
  if (token === "center") return free / 2;
  if (token === "right" || token === "bottom") return free;
  return lengthOrPercent(token, free);
}

function paintBackgroundImages(context: SKRSContext2D, node: LayoutNode): void {
  const css = node.style.backgroundImage;
  if (typeof css !== "string") return;
  const { bx, by, bw, bh } = node;
  const sizeTokens = typeof node.style.backgroundSize === "string" ? node.style.backgroundSize.split(/\s+/u) : [];
  const tileWidth = lengthOrPercent(sizeTokens[0], bw);
  const tileHeight = lengthOrPercent(sizeTokens[1] ?? sizeTokens[0], bh);
  const positionTokens = typeof node.style.backgroundPosition === "string"
    ? node.style.backgroundPosition.split(/\s+/u)
    : [];
  let horizontal = positionTokens[0];
  let vertical = positionTokens[1];
  if (horizontal === "top" || horizontal === "bottom") [horizontal, vertical] = [vertical, horizontal];
  const tileX = bx + positionOffset(horizontal, bw - tileWidth);
  const tileY = by + positionOffset(vertical, bh - tileHeight);
  // CSS paints the first listed layer on top.
  for (const layer of splitTopLevel(css).reverse()) {
    context.save();
    context.beginPath();
    context.rect(tileX, tileY, tileWidth, tileHeight);
    context.clip();
    paintGradient(context, layer, tileX, tileY, tileWidth, tileHeight);
    context.restore();
  }
}

function paintBorders(context: SKRSContext2D, node: LayoutNode, radius: number): void {
  const border = borders(node.style);
  const { bx: x, by: y, bw: w, bh: h } = node;
  const visible = (side: { width: number; color: string }) =>
    side.width > 0 && side.color !== "transparent" && !/^rgba\([^)]*,\s*0(?:\.0+)?\)$/u.test(side.color);
  if (![border.t, border.r, border.b, border.l].some(visible)) return;

  const innerRadius = Math.max(0, radius - Math.max(border.t.width, border.r.width, border.b.width, border.l.width));
  const ring = () => {
    context.beginPath();
    roundedRectPath(context, x, y, w, h, radius);
    roundedRectPath(
      context, x + border.l.width, y + border.t.width,
      w - border.l.width - border.r.width, h - border.t.width - border.b.width, innerRadius,
    );
  };
  const corners = {
    outer: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
    inner: [
      [x + border.l.width, y + border.t.width],
      [x + w - border.r.width, y + border.t.width],
      [x + w - border.r.width, y + h - border.b.width],
      [x + border.l.width, y + h - border.b.width],
    ],
  } as const;
  const polygons = {
    t: [corners.outer[0], corners.outer[1], corners.inner[1], corners.inner[0]],
    r: [corners.outer[1], corners.outer[2], corners.inner[2], corners.inner[1]],
    b: [corners.outer[2], corners.outer[3], corners.inner[3], corners.inner[2]],
    l: [corners.outer[3], corners.outer[0], corners.inner[0], corners.inner[3]],
  } as const;

  const uniform = [border.r, border.b, border.l].every(
    (side) => side.width === border.t.width && side.color === border.t.color,
  );
  if (uniform) {
    // Rounded uniform borders follow the arc, so the ring is filled directly instead of clipped per side.
    context.save();
    context.fillStyle = border.t.color;
    ring();
    context.fill("evenodd");
    context.restore();
    return;
  }

  const byColor = new Map<string, Array<keyof typeof polygons>>();
  for (const key of ["t", "r", "b", "l"] as const) {
    if (!visible(border[key])) continue;
    byColor.set(border[key].color, [...(byColor.get(border[key].color) ?? []), key]);
  }
  for (const [color, keys] of byColor) {
    context.save();
    context.beginPath();
    for (const key of keys) {
      polygons[key].forEach(([px0, py0], index) => (index === 0 ? context.moveTo(px0, py0) : context.lineTo(px0, py0)));
      context.closePath();
    }
    context.clip();
    context.fillStyle = color;
    ring();
    context.fill("evenodd");
    context.restore();
  }
}

function paintText(context: SKRSContext2D, node: LayoutNode, fonts: FontBook): void {
  if (!node.lines || !node.font || node.lineHeight === undefined) return;
  const font = fonts.resolve(node.font);
  const ascent = font.ascent * node.font.size;
  const descent = font.descent * node.font.size;
  context.font = fonts.cssFont(node.font);
  context.letterSpacing = `${node.font.letterSpacing}px`;
  context.fillStyle = String(node.style.color ?? "#000000");
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  const align = node.style.textAlign;
  node.lines.forEach((line, index) => {
    const width = fonts.measure(line, node.font!);
    const x = align === "center" ? node.bx + (node.bw - width) / 2
      : align === "right" || align === "end" ? node.bx + node.bw - width
      : node.bx;
    const top = node.by + index * node.lineHeight!;
    const baseline = top + (node.lineHeight! - (ascent + descent)) / 2 + ascent;
    if (line.length > 0) context.fillText(line, x, baseline);
  });
}

function paintNode(context: SKRSContext2D, node: LayoutNode, fonts: FontBook, images: LoadedImages, page: { width: number; height: number }): void {
  const opacity = typeof node.style.opacity === "number" ? node.style.opacity : 1;
  if (opacity < 1) {
    const layer = createCanvas(page.width, page.height);
    paintNode(layer.getContext("2d"), { ...node, style: { ...node.style, opacity: 1 } }, fonts, images, page);
    context.save();
    context.globalAlpha = opacity;
    context.drawImage(layer, 0, 0);
    context.restore();
    return;
  }

  if (node.kind === "text") {
    paintText(context, node, fonts);
    return;
  }
  const radius = px(node.style.borderRadius) ?? 0;
  if (node.kind === "image") {
    const image = images.get(node);
    if (image) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, node.bx, node.by, node.bw, node.bh);
    }
    return;
  }

  const hasBackground = typeof node.style.backgroundColor === "string" || typeof node.style.backgroundImage === "string";
  if (hasBackground) {
    context.save();
    context.beginPath();
    roundedRectPath(context, node.bx, node.by, node.bw, node.bh, radius);
    context.clip();
    if (typeof node.style.backgroundColor === "string") {
      context.fillStyle = node.style.backgroundColor;
      context.fillRect(node.bx, node.by, node.bw, node.bh);
    }
    paintBackgroundImages(context, node);
    context.restore();
  }
  paintBorders(context, node, radius);

  const clip = node.style.overflow === "hidden";
  if (clip) {
    const border = borders(node.style);
    context.save();
    context.beginPath();
    roundedRectPath(
      context, node.bx + border.l.width, node.by + border.t.width,
      node.bw - border.l.width - border.r.width, node.bh - border.t.width - border.b.width,
      Math.max(0, radius - Math.max(border.t.width, border.l.width)),
    );
    context.clip();
  }
  for (const child of node.children) paintNode(context, child, fonts, images, page);
  if (clip) context.restore();
}

function collectImages(node: LayoutNode, output: LayoutNode[]): void {
  if (node.kind === "image") output.push(node);
  node.children.forEach((child) => collectImages(child, output));
}

function decodeDataUri(src: string): { mime: string; data: Buffer } {
  const match = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/su.exec(src);
  if (!match) throw new Error("Image source must be a data URI.");
  const data = match[2]!.includes(";base64")
    ? Buffer.from(match[3]!, "base64")
    : Buffer.from(decodeURIComponent(match[3]!), "utf8");
  return { mime: match[1]!, data };
}

// Skia rasterises SVG at its intrinsic size, so the root size is rewritten to the drawn size to keep it vector-sharp.
export function sizeSvgForDrawing(svg: string, width: number, height: number): string {
  const open = /<svg\b[^>]*>/u.exec(svg);
  if (!open) throw new Error("SVG image has no root element.");
  let tag = open[0];
  const attribute = (name: string) => new RegExp(`\\s${name}="([^"]*)"`, "u").exec(tag)?.[1];
  const originalWidth = Number.parseFloat(attribute("width") ?? "");
  const originalHeight = Number.parseFloat(attribute("height") ?? "");
  const hasViewBox = attribute("viewBox") !== undefined;
  tag = tag.replace(/\s(?:width|height)="[^"]*"/gu, "");
  const viewBox = !hasViewBox && originalWidth > 0 && originalHeight > 0
    ? ` viewBox="0 0 ${originalWidth} ${originalHeight}"`
    : "";
  tag = tag.replace(/<svg\b/u, `<svg width="${width}" height="${height}"${viewBox}`);
  return svg.replace(open[0], tag);
}

async function loadNodeImage(node: LayoutNode): Promise<Image> {
  const src = node.element?.props.src;
  if (typeof src !== "string") throw new Error("Image node has no source.");
  const { mime, data } = decodeDataUri(src);
  if (mime === "image/svg+xml") {
    return loadImage(Buffer.from(sizeSvgForDrawing(data.toString("utf8"), node.bw, node.bh), "utf8"));
  }
  if (mime === "image/tiff") {
    const sharp = (await import("sharp")).default;
    return loadImage(await sharp(data).png().toBuffer());
  }
  return loadImage(data);
}

export async function paintTree(root: LayoutNode, width: number, height: number, fonts: FontBook): Promise<Buffer> {
  const nodes: LayoutNode[] = [];
  collectImages(root, nodes);
  const loaded = await Promise.all(nodes.map(async (node) => [node, await loadNodeImage(node)] as const));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  paintNode(context, root, fonts, new Map(loaded), { width, height });
  return canvas.toBuffer("image/png");
}
