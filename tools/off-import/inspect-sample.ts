import { MongoClient } from 'mongodb';

async function main() {
const c = new MongoClient('mongodb://localhost:27017');
await c.connect();
const col = c.db('off').collection('products');

// Sample a german product to see what product_type looks like
const doc = await col.findOne({ countries_tags: 'en:germany' }, {
  projection: { code: 1, product_type: 1, product_name: 1, product_name_de: 1, 'nutriments.energy-kcal_100g': 1, 'nutriments.proteins_100g': 1 }
});
console.log('Sample doc:', JSON.stringify(doc, null, 2));

// Count distinct product_type values for german products
const types = await col.distinct('product_type', { countries_tags: 'en:germany' });
console.log('\nDistinct product_type values:', types);

await c.close();
}

main().catch(console.error);
