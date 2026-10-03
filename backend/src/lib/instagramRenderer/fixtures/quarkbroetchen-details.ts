import type { RecipeDetailsTemplateInput } from "../types";
import { quarkbroetchenFixture } from "./quarkbroetchen";

// Visual approval fixture only; it is not persisted recipe data.
export const quarkbroetchenDetailsFixture: RecipeDetailsTemplateInput = {
  image: quarkbroetchenFixture.image,
  presentation: quarkbroetchenFixture.presentation,
  description: "Proteinreich, schnell vorbereitet und perfekt für Frühstück oder Meal Prep.",
  highlight: "high-protein",
  title: "Quarkbrötchen",
  totalTimeMinutes: 25,
  portions: 8,
  ingredients: [
    { amount: "250 g", name: "Magerquark" },
    { amount: "2", name: "Eier" },
    { amount: "200 g", name: "Dinkelmehl" },
    { amount: "1 Pck.", name: "Backpulver" },
    { amount: "80 g", name: "Haferflocken" },
  ],
  steps: [
    "Backofen auf 180 °C Ober-/Unterhitze vorheizen.",
    "Quark und Eier glatt verrühren.",
    "Mehl, Backpulver und Haferflocken unterheben.",
    "Acht Brötchen formen und 20 Minuten goldbraun backen.",
  ],
};

export default quarkbroetchenDetailsFixture;