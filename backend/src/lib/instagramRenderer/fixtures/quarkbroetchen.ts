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

export const quarkbroetchenFixture: RenderInput = {
  image: { path: referencePhoto },
  presentation: { focusX: 0.5, focusY: 0.46, zoom: 1.0 },
  title: "Quarkbrötchen",
  tags: [
    { id: "backen", label: "Backen" },
    { id: "vegetarisch", label: "Vegetarisch" },
    { id: "snacks", label: "Snacks" },
    { id: "fruhstuck", label: "Frühstück" },
  ],
  nutritionHighlight: "high-protein",
  nutrition: { calories: 250, protein: 14, carbs: 31, fat: 8 },
};

export default quarkbroetchenFixture;
