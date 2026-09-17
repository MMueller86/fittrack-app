import {
  CANVAS_WIDTH,
  COLOR_AMBIENT_BASE,
  PHOTO_TRANSITION_END_Y,
  PHOTO_TRANSITION_START_Y,
} from "./layout";
import type { SatoriElement } from "./compose";

function element(type: string, props: Record<string, unknown>): SatoriElement {
  return { type, props };
}

function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

const TRANSITION_ALPHA_POINTS = [
  [0, 0],
  [0.2, 0],
  [0.312, 0.01],
  [0.436, 0.05],
  [0.559, 0.2],
  [0.685, 0.4],
  [0.807, 0.55],
  [0.869, 0.65],
  [0.931, 0.76],
  [0.98, 0.8],
  [1, 0.82],
] as const;

export function smootherstep(value: number): number {
  const t = clampUnit(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function transitionAlphaAt(
  y: number,
  startY = PHOTO_TRANSITION_START_Y,
  endY = PHOTO_TRANSITION_END_Y,
): number {
  if (endY <= startY) {
    return y < startY ? 0 : 1;
  }

  const position = clampUnit((y - startY) / (endY - startY));
  for (let index = 1; index < TRANSITION_ALPHA_POINTS.length; index += 1) {
    const [rightPosition, rightAlpha] = TRANSITION_ALPHA_POINTS[index];
    const [leftPosition, leftAlpha] = TRANSITION_ALPHA_POINTS[index - 1];
    if (position <= rightPosition) {
      const segmentPosition = (position - leftPosition) / (rightPosition - leftPosition);
      return leftAlpha + (rightAlpha - leftAlpha) * smootherstep(segmentPosition);
    }
  }

  return 1;
}

export function transitionBackgroundImage(
  startY = PHOTO_TRANSITION_START_Y,
  endY = PHOTO_TRANSITION_END_Y,
): string {
  const red = Number.parseInt(COLOR_AMBIENT_BASE.slice(1, 3), 16);
  const green = Number.parseInt(COLOR_AMBIENT_BASE.slice(3, 5), 16);
  const blue = Number.parseInt(COLOR_AMBIENT_BASE.slice(5, 7), 16);
  const sampleCount = 100;
  const stops = [
    `rgba(${red}, ${green}, ${blue}, 0) 0%`,
    `rgba(${red}, ${green}, ${blue}, 0) ${((startY / endY) * 100).toFixed(3)}%`,
  ];

  for (let index = 0; index <= sampleCount; index += 1) {
    const y = startY + ((endY - startY) * index) / sampleCount;
    const alpha = transitionAlphaAt(y, startY, endY);
    stops.push(
      `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)}) ${((y / endY) * 100).toFixed(3)}%`,
    );
  }

  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

export function createTransitionLayer(): SatoriElement {
  return element("div", {
    style: {
      position: "absolute",
      left: 0,
      top: PHOTO_TRANSITION_START_Y,
      width: CANVAS_WIDTH,
      height: PHOTO_TRANSITION_END_Y - PHOTO_TRANSITION_START_Y,
      pointerEvents: "none",
      backgroundImage: transitionBackgroundImage(0, PHOTO_TRANSITION_END_Y - PHOTO_TRANSITION_START_Y),
    },
  });
}