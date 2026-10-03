import type { RecipeDetailsTemplateInput } from "../types";
import { gefluegelfrikadellenDetailsFixture } from "./gefluegelfrikadellen-details";

export const nineIngredientsDetailsFixture: RecipeDetailsTemplateInput = {
  image: gefluegelfrikadellenDetailsFixture.image,
  presentation: gefluegelfrikadellenDetailsFixture.presentation,
  description: "Saftige Geflügelfrikadellen mit Couscous und Gemüse - proteinreich und frisch.",
  highlight: "high-protein",
  title: "Mediterrane Geflügelfrikadellen mit Couscoussalat",
  totalTimeMinutes: 45,
  portions: 4,
  ingredients: [
    { amount: "500 g", name: "Hähnchenhackfleisch" },
    { amount: "150 g", name: "Magerquark" },
    { amount: "2 Stück", name: "Eier" },
    { amount: "80 g", name: "Vollkorn-Paniermehl" },
    { amount: "1 große", name: "rote Zwiebel" },
    { amount: "1 große", name: "rote Paprika" },
    { amount: "200 g", name: "Vollkorn-Couscous" },
    { amount: "250 ml", name: "Gemüsebrühe" },
    { amount: "250 g", name: "Kirschtomaten" },
  ],
  steps: [
    "Couscous mit heißer Gemüsebrühe übergießen, 10 Minuten quellen lassen und auflockern.",
    "Hähnchenhack mit Quark, Ei, Paniermehl, Zwiebel und Paprika gründlich vermengen.",
    "Aus der Masse 14 Frikadellen formen und im Airfryer bei 180 °C 10–12 Minuten garen.",
    "Tomaten halbieren und mit dem Couscous locker vermengen.",
    "Frikadellen auf dem Couscoussalat anrichten und sofort servieren.",
  ],
};

export default nineIngredientsDetailsFixture;
