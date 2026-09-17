import {
  AMBIENT_CENTER_X,
  AMBIENT_CENTER_Y,
  AMBIENT_RADIUS,
  AMBIENT_STOP_BASE,
  AMBIENT_STOP_EDGE,
  AMBIENT_STOP_LOCAL,
  AMBIENT_STOP_NEAR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_AMBIENT_BASE,
  WORDMARK_AMBIENT_CENTER_Y,
  WORDMARK_AMBIENT_RADIUS,
} from "./layout";
import type { SatoriElement } from "./compose";

function element(type: string, props: Record<string, unknown>): SatoriElement {
  return { type, props };
}

export function ambientBackgroundImage(): string {
  const wordmarkZone = `radial-gradient(circle ${WORDMARK_AMBIENT_RADIUS}px at ${AMBIENT_CENTER_X}px ${WORDMARK_AMBIENT_CENTER_Y}px, ${AMBIENT_STOP_LOCAL} 0%, rgba(3, 6, 4, 0.92) 42%, rgba(3, 6, 4, 0) 100%)`;
  const ambientField = `radial-gradient(circle ${AMBIENT_RADIUS}px at ${AMBIENT_CENTER_X}px ${AMBIENT_CENTER_Y}px, ${AMBIENT_STOP_LOCAL} 0%, ${AMBIENT_STOP_NEAR} 15%, ${AMBIENT_STOP_BASE} 40%, ${AMBIENT_STOP_EDGE} 100%)`;

  return `${wordmarkZone}, ${ambientField}`;
}

export function createAmbientLayer(): SatoriElement {
  return element("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: COLOR_AMBIENT_BASE,
      backgroundImage: ambientBackgroundImage(),
    },
  });
}