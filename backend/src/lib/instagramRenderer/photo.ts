import { CANVAS_WIDTH, HERO_HEIGHT, PHOTO_TRANSITION_END_Y } from "./layout";
import type { SatoriElement } from "./compose";

export type PhotoAsset = {
  src: string;
  width: number;
  height: number;
};

export type PhotoPlacement = {
  width: number;
  height: number;
  left: number;
  top: number;
  scale: number;
};

export type PhotoPlacementOptions = {
  sourceWidth: number;
  sourceHeight: number;
  focusX: number;
  focusY: number;
  zoom: number;
  containerWidth?: number;
  containerHeight?: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampFocus(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
}

export function calculateCoverPlacement({
  sourceWidth,
  sourceHeight,
  focusX,
  focusY,
  zoom,
  containerWidth = CANVAS_WIDTH,
  containerHeight = HERO_HEIGHT,
}: PhotoPlacementOptions): PhotoPlacement {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    throw new RangeError("Photo dimensions must be positive finite numbers.");
  }

  const coverScale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const scale = coverScale * Math.max(1, zoom);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const horizontalOverflow = Math.max(0, width - containerWidth);
  const verticalOverflow = Math.max(0, height - containerHeight);

  return {
    width,
    height,
    left: -horizontalOverflow * clampFocus(focusX),
    top: -verticalOverflow * clampFocus(focusY),
    scale,
  };
}

function element(type: string, props: Record<string, unknown>): SatoriElement {
  return { type, props };
}

export function createPhotoLayer(
  photo: PhotoAsset,
  presentation: PhotoPlacementOptions,
): SatoriElement {
  const placement = calculateCoverPlacement({
    ...presentation,
    sourceWidth: photo.width,
    sourceHeight: photo.height,
    containerHeight: HERO_HEIGHT,
  });

  return element("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: PHOTO_TRANSITION_END_Y,
      display: "flex",
      overflow: "hidden",
    },
    children: element("img", {
      src: photo.src,
      width: placement.width,
      height: placement.height,
      style: {
        position: "absolute",
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
      },
    }),
  });
}