import { MongoClient } from "mongodb";
const mc = new MongoClient("mongodb://localhost:27017");
await mc.connect();
const db2 = mc.db("off");
const col2 = db2.collection((await db2.listCollections().toArray())[0].name);

// Zeige die 'selected' Struktur
const withSel = await col2.findOne({"images.selected": {$exists: true}},
  {projection: {product_name_de: 1, code: 1, "images.selected": 1}});
if (withSel) {
  const sel = withSel.images.selected;
  console.log("Produkt:", withSel.product_name_de, "code:", withSel.code);
  console.log("selected keys:", Object.keys(sel).join(","));
  if (sel.front) {
    console.log("selected.front keys:", Object.keys(sel.front).join(","));
    console.log("selected.front:", JSON.stringify(sel.front).substring(0, 600));
  }
}

// Produkt MIT selected.front.de
const withSelDe = await col2.findOne({"images.selected.front.de": {$exists: true}},
  {projection: {product_name_de: 1, code: 1, "images.selected.front.de": 1}});
if (withSelDe) {
  console.log("\nMIT selected.front.de:", withSelDe.product_name_de, "code:", withSelDe.code);
  console.log("front.de:", JSON.stringify(withSelDe.images.selected.front.de));
}

// Produkt MIT selected.front.en
const withSelEn = await col2.findOne({"images.selected.front.en": {$exists: true}},
  {projection: {product_name_de: 1, code: 1, "images.selected.front.en": 1}});
if (withSelEn) {
  console.log("\nMIT selected.front.en:", withSelEn.product_name_de, "code:", withSelEn.code);
  console.log("front.en:", JSON.stringify(withSelEn.images.selected.front.en));
}

await mc.close();
console.log("\nFertig.");
