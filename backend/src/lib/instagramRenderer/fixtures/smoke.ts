import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { RenderInput } from "../types";

const REFERENCE_PHOTO = "../test-fixtures/quarkbroetchen-source.png";
const localReferencePhoto = resolve(__dirname, REFERENCE_PHOTO);
const sourceReferencePhoto = resolve(
  process.cwd(),
  "src/lib/instagramRenderer/fixtures",
  REFERENCE_PHOTO,
);
const referencePhoto = existsSync(localReferencePhoto) ? localReferencePhoto : sourceReferencePhoto;

export const smokeFixture: RenderInput = {
  image: { path: referencePhoto },
  presentation: { focusX: 0.5, focusY: 0.5, zoom: 1.0 },
  title: "Sauerteig Nussbrot",
  tags: [
    { id: "backen", label: "Backen" },
    { id: "vollkorn", label: "Vollkorn" },
  ],
  nutritionHighlight: null,
  nutrition: { calories: 210, protein: 8, carbs: 32, fat: 4 },
};

export default smokeFixture;
