import { MongoClient } from 'mongodb';

async function main() {
  const c = new MongoClient('mongodb://localhost:27017');
  await c.connect();
  const col = c.db('off').collection('products');

  // Suche nach Produkten MIT vollständigen Nährwerten aber OHNE deutschen Namen
  // die trotzdem deutsche Keywords haben könnten
  const terms = ['toast', 'eier', 'brot', 'hähnchen', 'salami', 'pizza'];

  for (const term of terms) {
    console.log(`\n=== Suche: "${term}" ===`);

    // 1. Über product_name_de
    const byDeName = await col.countDocuments({
      product_name_de: { $regex: term, $options: 'i' },
      'nutriments.energy-kcal_100g': { $exists: true },
      'nutriments.proteins_100g': { $exists: true },
    });
    console.log(`  product_name_de enthält "${term}": ${byDeName}`);

    // 2. Über _keywords
    const byKeyword = await col.countDocuments({
      _keywords: term,
      'nutriments.energy-kcal_100g': { $exists: true },
      'nutriments.proteins_100g': { $exists: true },
    });
    console.log(`  _keywords enthält "${term}": ${byKeyword}`);

    // 3. Über categories_tags (de: prefix)
    const byCategory = await col.countDocuments({
      categories_tags: `de:${term}`,
      'nutriments.energy-kcal_100g': { $exists: true },
      'nutriments.proteins_100g': { $exists: true },
    });
    console.log(`  categories_tags enthält "de:${term}": ${byCategory}`);

    // Beispielprodukt ohne deutschen Namen aber mit keyword
    if (byKeyword > 0) {
      const example = await col.findOne(
        {
          _keywords: term,
          product_name_de: { $exists: false },
          'nutriments.energy-kcal_100g': { $exists: true },
        },
        { projection: { code: 1, product_name: 1, product_name_de: 1, _keywords: 1 } }
      );
      if (example) {
        console.log(`  Beispiel ohne DE-Name: "${example['product_name']}" | keywords: ${JSON.stringify((example['_keywords'] as string[])?.slice(0, 5))}`);
      }
    }
  }

  await c.close();
}

main().catch(console.error);
