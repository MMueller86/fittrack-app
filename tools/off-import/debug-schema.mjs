import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const col = client.db('off').collection('products');

// Check a product that has nutrition but NO nutriments
const doc = await col.findOne(
  { product_name_de: { $exists: true, $gt: '' }, nutrition: { $exists: true }, nutriments: { $exists: false } },
  { projection: { code:1, product_name_de:1, nutriments:1, nutrition:1 } }
);
if (doc) {
  console.log('code:', doc.code);
  console.log('name:', doc.product_name_de);
  console.log('Has nutriments:', !!doc.nutriments);
  console.log('Has nutrition:', !!doc.nutrition);
  const agg = doc.nutrition?.aggregated_set;
  console.log('Has aggregated_set:', !!agg);
  const nuts = agg?.nutrients;
  console.log('Has nutrients:', !!nuts);
  if (nuts) {
    console.log('Sample keys:', Object.keys(nuts).slice(0, 5));
    const kcal = nuts['energy-kcal'];
    console.log('energy-kcal entry:', JSON.stringify(kcal));
  }
  // Also show full nutrition structure (truncated)
  const str = JSON.stringify(doc.nutrition).slice(0, 500);
  console.log('\nnutrition (truncated):', str);
} else {
  // Try with nutriments absent differently
  const doc2 = await col.findOne(
    { product_name_de: { $exists: true, $gt: '' }, 'nutrition.aggregated_set': { $exists: true } },
    { projection: { code:1, product_name_de:1, nutriments:1, nutrition:1 } }
  );
  if (doc2) {
    console.log('Found via nutrition.aggregated_set query');
    console.log('code:', doc2.code, '| name:', doc2.product_name_de);
    console.log('Has nutriments:', !!doc2.nutriments);
    const agg = doc2.nutrition?.aggregated_set;
    const nuts = agg?.nutrients;
    if (nuts) {
      console.log('nutrients keys (first 5):', Object.keys(nuts).slice(0,5));
      console.log('energy-kcal:', JSON.stringify(nuts['energy-kcal']));
    } else {
      console.log('aggregated_set structure:', JSON.stringify(agg).slice(0,300));
    }
  } else {
    console.log('No doc with nutrition.aggregated_set found at all!');
  }
}

await client.close();
