import { Buffer } from "node:buffer";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { loadPhoto } from "../render";
import { createPhotoLayer } from "../photo";
import type { SatoriElement } from "../compose";

function imageElement(layer: SatoriElement): SatoriElement {
  return layer.props.children as SatoriElement;
}

const CANONICAL_WIDTH = 3;
const CANONICAL_HEIGHT = 2;
const CANONICAL_PIXELS = Buffer.from([
  255, 0, 0, 0, 255, 0, 0, 0, 255,
  255, 255, 0, 255, 0, 255, 0, 255, 255,
]);

const EXIF_FIXTURES = [
  { label: "0", degrees: 0, orientation: undefined },
  { label: "1", degrees: 0, orientation: 1 },
  { label: "90", degrees: 90, orientation: 6 },
  { label: "180", degrees: 180, orientation: 3 },
  { label: "270", degrees: 270, orientation: 8 },
] as const;

async function createExifFixture(
  degrees: number,
  orientation: number | undefined,
): Promise<Buffer> {
  const image = sharp(CANONICAL_PIXELS, {
    raw: { width: CANONICAL_WIDTH, height: CANONICAL_HEIGHT, channels: 3 },
  });
  if (degrees !== 0) {
    image.rotate(-degrees);
  }
  if (orientation !== undefined) {
    image.withMetadata({ orientation });
  }
  return image.png().toBuffer();
}

async function decodePhotoPixels(photo: Awaited<ReturnType<typeof loadPhoto>>): Promise<Buffer> {
  const encoded = Buffer.from(photo.src.slice(photo.src.indexOf(",") + 1), "base64");
  return sharp(encoded).raw().toBuffer();
}

describe("Instagram renderer photo placement", () => {
  it("keeps portrait photos upright and covers the hero with the existing geometry", () => {
    const layer = createPhotoLayer(
      { src: "data:image/png;base64,", width: 800, height: 1200, renderRotation: 0 },
      { sourceWidth: 800, sourceHeight: 1200, focusX: 0.5, focusY: 0.5, zoom: 1 },
    );
    const image = imageElement(layer);
    const style = image.props.style;

    expect(style?.transform).toBeUndefined();
    expect(style?.width).toBe(1080);
    expect(style?.height).toBe(1620);
    expect(style?.left).toBeCloseTo(0);
    expect(style?.top).toBe(-302.5);
  });

  it("keeps the existing rotated landscape treatment and cover geometry", () => {
    const layer = createPhotoLayer(
      { src: "data:image/png;base64,", width: 1200, height: 800, renderRotation: 90 },
      { sourceWidth: 1200, sourceHeight: 800, focusX: 0.5, focusY: 0.5, zoom: 1 },
    );
    const image = imageElement(layer);
    const style = image.props.style;

    expect(style?.transform).toBe("rotate(90deg)");
    expect(style?.transformOrigin).toBe("center center");
    expect(style?.width).toBe(1620);
    expect(style?.height).toBe(1080);
    expect(style?.left).toBe(-270);
    expect(style?.top).toBe(12.5);
  });

  it("does not infer a rotation from landscape dimensions when the asset is upright", () => {
    const layer = createPhotoLayer(
      { src: "data:image/png;base64,", width: 1200, height: 800, renderRotation: 0 },
      { sourceWidth: 1200, sourceHeight: 800, focusX: 0.5, focusY: 0.5, zoom: 1 },
    );
    const image = imageElement(layer);
    const style = image.props.style;

    expect(style?.transform).toBeUndefined();
    expect(style?.width).toBe(1522.5);
    expect(style?.height).toBe(1015);
    expect(style?.left).toBe(-221.25);
    expect(style?.top).toBeCloseTo(0);
  });

  it.each(EXIF_FIXTURES)(
    "normalizes EXIF $label to the same canonical pixels without a second turn",
    async ({ degrees, orientation }) => {
      const source = await createExifFixture(degrees, orientation);
      const photo = await loadPhoto(sharp, { buffer: source });
      const encoded = Buffer.from(photo.src.slice(photo.src.indexOf(",") + 1), "base64");
      const metadata = await sharp(encoded).metadata();

      expect(photo.width).toBe(CANONICAL_WIDTH);
      expect(photo.height).toBe(CANONICAL_HEIGHT);
      expect(metadata.width).toBe(CANONICAL_WIDTH);
      expect(metadata.height).toBe(CANONICAL_HEIGHT);
      expect([undefined, 1]).toContain(metadata.orientation);
      expect(await decodePhotoPixels(photo)).toEqual(CANONICAL_PIXELS);

      if (degrees !== 0) {
        const layer = createPhotoLayer(photo, {
          sourceWidth: photo.width,
          sourceHeight: photo.height,
          focusX: 0.5,
          focusY: 0.5,
          zoom: 1,
        });
        expect(imageElement(layer).props.style?.transform).toBeUndefined();
      }
    },
  );

  it("keeps normal portrait and landscape source orientation explicit", async () => {
    const portraitPixels = Buffer.from([
      255, 0, 0, 0, 255, 0,
      0, 0, 255, 255, 255, 0,
      255, 0, 255, 0, 255, 255,
    ]);
    const portraitSource = await sharp(portraitPixels, {
      raw: { width: 2, height: 3, channels: 3 },
    })
      .png()
      .toBuffer();
    const landscapeSource = await createExifFixture(0, undefined);

    const portrait = await loadPhoto(sharp, { buffer: portraitSource });
    const landscape = await loadPhoto(sharp, { buffer: landscapeSource });

    expect(portrait.renderRotation).toBe(0);
    expect(landscape.renderRotation).toBe(90);
    expect(await decodePhotoPixels(portrait)).toEqual(portraitPixels);
    expect(await decodePhotoPixels(landscape)).toEqual(CANONICAL_PIXELS);
  });
});