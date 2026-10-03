import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_PANEL,
} from "./layout";
import type { SatoriElement } from "./compose";

function element(type: string, props: Record<string, unknown>): SatoriElement {
  return { type, props };
}

export function ambientBackgroundImage(): string {
  return "radial-gradient(circle 700px at 1030px 90px, #203b1d 0%, rgba(32, 59, 29, 0) 62%), radial-gradient(circle 760px at 70px 1320px, #172b18 0%, rgba(23, 43, 24, 0) 68%)";
}

export function createAmbientLayer(): SatoriElement {
  return element("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: COLOR_PANEL,
      backgroundImage: ambientBackgroundImage(),
    },
  });
}