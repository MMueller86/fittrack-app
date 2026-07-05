import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const col = client.db('off').collection('products');

const baseFilter = { product_type: 'food', product_name_de: { $exists: true, $gt: '' } };

const both = await col.countDocuments({
  ...baseFilter,
  nutriments: { $exists: true },
  'nutrition.aggregated_set': { $exists: true },
});

const noKcalHasAgg = await col.countDocuments({
  ...baseFilter,
  nutriments: { $exists: true },
  'nutriments.energy-kcal_100g': { $exists: false },
  'nutriments.energy-kcal': { $exists: false },
  'nutriments.energy_100g': { $exists: false },
  'nutriments.energy': { $exists: false },
  'nutrition.aggregated_set': { $exists: true },
});

console.log('Both nutriments AND nutrition.aggregated_set:', both);
console.log('nutriments exists but no energy at all, has aggregated_set:', noKcalHasAgg);

await client.close();
