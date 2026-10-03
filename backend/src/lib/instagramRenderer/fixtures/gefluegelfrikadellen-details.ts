import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { RecipeDetailsTemplateInput } from "../types";

const ALPHA_PHOTO = "output/alpha-recipe-assets/3d5b4757-b6f8-49c7-91dc-0a829146c149-ab7c2e18-3db6-4a34-9c91-0b66ed9f522e.jpg";
const backendPhoto = resolve(process.cwd(), ALPHA_PHOTO);
const workspacePhoto = resolve(process.cwd(), "backend", ALPHA_PHOTO);
const alphaPhoto = existsSync(backendPhoto) ? backendPhoto : workspacePhoto;

// Visual approval fixture derived from Alpha; it is not persisted recipe data.
export const gefluegelfrikadellenDetailsFixture: RecipeDetailsTemplateInput = {
  image: { path: alphaPhoto },
  presentation: { focusX: 0.5, focusY: 0.46, zoom: 1 },
  description: "Proteinreicher Fingerfood-Favorit: außen goldbraun, innen saftig und ideal fürs Meal Prep.",
  highlight: "high-protein",
  title: "Kleine Geflügelfrikadellen",
  totalTimeMinutes: 20,
  portions: 14,
  ingredients: [
    { amount: "400 g", name: "Hähnchen-Schnitzel paniert" },
    { amount: "40 g", name: "Magerquark" },
    { amount: "60 g", name: "Eier" },
    { amount: "35 g", name: "Paniermehl" },
    { amount: "40 g", name: "Zwiebel" },
  ],
  steps: [
    "Geflügel, Quark, Ei, Paniermehl und gewürfelte Zwiebel vermengen.",
    "Senf, Paprikapulver, Knoblauch, Salz und Pfeffer zugeben und gut vermengen.",
    "Aus der Mischung etwa 14 kleine Frikadellen formen.",
    "Airfryer auf 180 °C vorheizen.",
    "Frikadellen 10–12 Minuten im Airfryer garen und dabei einmal wenden.",
  ],
};

export default gefluegelfrikadellenDetailsFixture;