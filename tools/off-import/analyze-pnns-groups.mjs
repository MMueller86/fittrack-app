/**
 * analyze-pnns-groups.mjs
 *
 * Samples the OFF MongoDB to understand what PNNS group values exist
 * and how well they map to our FoodCategory type.
 */
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';

const client = new MongoClient(MONGO_URI);
await client.connect();
const col = client.db('off').collection('products');

// Count distinct pnns_groups_1 + pnns_groups_2 values across German products
const pipeline = [
  { $match: { product_type: 'food', product_name_de: { $exists: true, $gt: '' } } },
  { $group: {
    _id: { g1: '$pnns_groups_1', g2: '$pnns_groups_2' },
    count: { $sum: 1 }
  }},
  { $sort: { count: -1 } },
  { $limit: 60 },
];

const results = await col.aggregate(pipeline).toArray();

console.log('\nPNNS Group Distribution (German products):');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`${'pnns_groups_1'.padEnd(35)} ${'pnns_groups_2'.padEnd(30)} count`);
console.log('─'.repeat(80));

for (const r of results) {
  const g1 = (r._id.g1 ?? '(none)').padEnd(35);
  const g2 = (r._id.g2 ?? '(none)').padEnd(30);
  console.log(`${g1} ${g2} ${r.count.toLocaleString()}`);
}

// Also check food_groups_tags for fruit/vegetable distinction
console.log('\n\nTop food_groups_tags values:');
console.log('─'.repeat(50));
const fgPipeline = [
  { $match: { product_type: 'food', product_name_de: { $exists: true, $gt: '' } } },
  { $unwind: '$food_groups_tags' },
  { $group: { _id: '$food_groups_tags', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 30 },
];
const fgResults = await col.aggregate(fgPipeline).toArray();
for (const r of fgResults) {
  console.log(`  ${(r._id ?? '(none)').padEnd(40)} ${r.count.toLocaleString()}`);
}

await client.close();
