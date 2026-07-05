import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const doc = await client.db('off').collection('products').findOne(
  { code: '9004145025448' },
  { projection: { code: 1, images: 1 } }
);
console.log('code:', doc.code);
console.log('typeof images:', typeof doc.images);
const frontDe = doc.images?.front_de;
console.log('front_de:', JSON.stringify(frontDe, null, 2));
console.log('imgid type:', typeof frontDe?.imgid, '=', JSON.stringify(frontDe?.imgid));
console.log('rev type:', typeof frontDe?.rev, '=', JSON.stringify(frontDe?.rev));

// Test the condition from the TS function
const imgid = frontDe?.imgid;
const rev = frontDe?.rev;
const condition = typeof imgid === 'string' && imgid && typeof rev === 'string' && rev;
console.log('condition result:', condition);

// What URL would be built?
const barcode = doc.code;
const barcodePath = barcode.length > 9
  ? `${barcode.slice(0, 3)}/${barcode.slice(3, 6)}/${barcode.slice(6, 9)}/${barcode.slice(9)}`
  : barcode;
console.log('barcodePath:', barcodePath);
if (condition) {
  console.log('Wrong URL (current):', `https://images.openfoodfacts.org/images/products/${barcodePath}/${imgid}.${rev}.400.jpg`);
  console.log('Correct URL (fix):   ', `https://images.openfoodfacts.org/images/products/${barcodePath}/front_de.${rev}.400.jpg`);
}

await client.close();
