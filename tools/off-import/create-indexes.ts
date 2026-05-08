/**
 * create-indexes.ts
 *
 * Creates indexes on off.products needed by the analysis script.
 * Run once before analyze-off-dump.ts.
 *
 * Run: npm run create:indexes
 */

import { MongoClient, type IndexSpecification } from 'mongodb';

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected. Creating indexes on off.products …\n');
    const col = client.db('off').collection('products');

    const indexes: Array<{ key: IndexSpecification; name: string }> = [
      { key: { countries_tags: 1 },                    name: 'countries_tags_1' },
      { key: { product_type: 1 },                      name: 'product_type_1' },
      { key: { product_name: 1 },                      name: 'product_name_1' },
      { key: { product_name_de: 1 },                   name: 'product_name_de_1' },
      { key: { data_quality_errors_tags: 1 },           name: 'data_quality_errors_tags_1' },
      { key: { 'nutriments.energy-kcal_100g': 1 },     name: 'nutriments_kcal_1' },
      { key: { 'nutriments.energy_100g': 1 },           name: 'nutriments_energy_1' },
      { key: { 'nutriments.proteins_100g': 1 },         name: 'nutriments_proteins_1' },
      { key: { 'nutriments.carbohydrates_100g': 1 },    name: 'nutriments_carbs_1' },
      { key: { 'nutriments.fat_100g': 1 },              name: 'nutriments_fat_1' },
    ];

    for (const idx of indexes) {
      process.stdout.write(`  Creating index ${idx.name} … `);
      await col.createIndex(idx.key, { name: idx.name, background: true });
      console.log('done');
    }

    console.log('\nAll indexes created. You can now run analyze-off-dump.ts.');
  } finally {
    await client.close();
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
