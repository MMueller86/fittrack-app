import type { RecipeDetailsTemplateInput } from "../types";
import { gefluegelfrikadellenDetailsFixture } from "./gefluegelfrikadellen-details";

export const twentyIngredientsDetailsFixture: RecipeDetailsTemplateInput = {
  image: gefluegelfrikadellenDetailsFixture.image,
  presentation: gefluegelfrikadellenDetailsFixture.presentation,
  description: "Saftige Frikadellen, bunter Couscous und cremiger Dip: proteinreich, frisch, meal-prep-tauglich.",
  highlight: "high-protein",
  title: "Mediterrane Geflügel-Frikadellen-Bowl mit Couscoussalat",
  totalTimeMinutes: 50,
  portions: 5,
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
    { amount: "1 Stück", name: "Salatgurke" },
    { amount: "80 g", name: "schwarze Oliven" },
    { amount: "1 kleine Dose", name: "Kichererbsen" },
    { amount: "100 g", name: "Babyspinat" },
    { amount: "1 reife", name: "Avocado" },
    { amount: "100 g", name: "Feta light" },
    { amount: "150 g", name: "griechischer Joghurt" },
    { amount: "1 EL (15 ml)", name: "Tahini" },
    { amount: "1 Bio", name: "Zitrone" },
    { amount: "2 EL (30 ml)", name: "Olivenöl" },
    { amount: "1 EL", name: "Granatapfelkerne" },
  ],
  steps: [
    "Couscous mit heißer Gemüsebrühe übergießen, 10 Minuten quellen lassen und auflockern.",
    "Hähnchenhack mit Quark, Ei, Paniermehl, Zwiebel und Paprika gründlich vermengen.",
    "Aus der Masse 14 Frikadellen formen und im Airfryer bei 180 °C 10–12 Minuten garen.",
    "Tomaten, Gurke, Oliven, Kichererbsen, Spinat und Avocado für den Salat vorbereiten.",
    "Joghurt, Tahini, Zitrone und Öl verrühren und alles mit Couscous anrichten.",
  ],
};

export default twentyIngredientsDetailsFixture;