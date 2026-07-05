import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const col = client.db('off').collection('products');

const total = await col.countDocuments({ countries_tags: 'en:germany' });
const withFrontDe = await col.countDocuments({ countries_tags: 'en:germany', 'images.front_de': { $exists: true } });
const withFrontEn = await col.countDocuments({ countries_tags: 'en:germany', 'images.front_en': { $exists: true } });
const withAnyFront = await col.countDocuments({ countries_tags: 'en:germany', $or: [{ 'images.front_de': { $exists: true } }, { 'images.front_en': { $exists: true } }] });

console.log(`Total DE products:          ${total}`);
console.log(`With images.front_de:       ${withFrontDe} (${Math.round(withFrontDe/total*100)}%)`);
console.log(`With images.front_en:       ${withFrontEn} (${Math.round(withFrontEn/total*100)}%)`);
console.log(`With front_de OR front_en:  ${withAnyFront} (${Math.round(withAnyFront/total*100)}%)`);

// Show one example with front_de to verify URL construction
const sample = await col.findOne(
  { countries_tags: 'en:germany', 'images.front_de': { $exists: true } },
  { projection: { code: 1, images: 1 } }
);
if (sample) {
  const fd = sample.images.front_de;
  const barcode = sample.code;
  const barcodePath = barcode.length > 9
    ? `${barcode.slice(0,3)}/${barcode.slice(3,6)}/${barcode.slice(6,9)}/${barcode.slice(9)}`
    : barcode;
  const url = `https://images.openfoodfacts.org/images/products/${barcodePath}/${fd.imgid}.${fd.rev}.400.jpg`;
  console.log(`\nSample barcode: ${barcode}`);
  console.log(`  imgid=${fd.imgid}, rev=${fd.rev}`);
  console.log(`  Constructed URL: ${url}`);
}

await client.close();


