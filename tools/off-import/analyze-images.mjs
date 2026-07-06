// analyze-images.mjs — analysiert die OFF MongoDB image-Struktur
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();

// Finde die richtige DB und Collection
const adminDb = client.db().admin();
const dbList = await adminDb.listDatabases();
console.log('Datenbanken:', dbList.databases.map(d => d.name).join(', '));

const db = client.db('off');
const collections = await db.listCollections().toArray();
console.log('Collections in "off":', collections.map(c => c.name).join(', '));

const colName = collections[0]?.name;
if (!colName) { console.log('Keine Collection gefunden'); await client.close(); process.exit(1); }

const col = db.collection(colName);
const totalCount = await col.countDocuments();
console.log(`Collection "${colName}": ${totalCount} Dokumente`);

// Sample-Dokument zeigen
const sample = await col.findOne({});
const sampleKeys = Object.keys(sample || {}).slice(0, 30);
console.log('Sample-Felder:', sampleKeys.join(', '));

// Welches Feld enthält den Produktnamen?
const nameFields = sampleKeys.filter(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('product'));
console.log('Name-Felder:', nameFields.join(', '));

// Images-Struktur
if (sample?.images) {
  const imgKeys = Object.keys(sample.images);
  console.log('\nImages-Keys im ersten Sample:', imgKeys.slice(0, 20).join(', '));
  const namedKey = imgKeys.find(k => !/^\d+$/.test(k));
  if (namedKey) {
    console.log(`Named key "${namedKey}":`, JSON.stringify(sample.images[namedKey]).substring(0, 300));
  }
}

console.log('\nimage_front_url im Sample:', sample?.image_front_url ?? 'FEHLT');
console.log('image_front_small_url im Sample:', sample?.image_front_small_url ?? 'FEHLT');

// Zähle Produkte mit image_front_url
const withImageUrl = await col.countDocuments({ image_front_url: { $exists: true, $ne: '' } });
console.log('\nMit image_front_url:', withImageUrl);

// Zähle Produkte mit images.front_de
const withFrontDe = await col.countDocuments({ 'images.front_de': { $exists: true } });
const withFrontEn = await col.countDocuments({ 'images.front_en': { $exists: true } });
console.log('Mit images.front_de:', withFrontDe);
console.log('Mit images.front_en:', withFrontEn);

// Finde Produkt mit front_de und zeige rev-Typ
const withDe = await col.findOne({ 'images.front_de': { $exists: true } }, 
  { projection: { product_name_de: 1, product_name: 1, 'images.front_de': 1, image_front_url: 1, code: 1 } });
if (withDe) {
  console.log('\nBeispiel mit front_de:');
  console.log('  Name:', withDe.product_name_de || withDe.product_name);
  console.log('  front_de:', JSON.stringify(withDe.images?.front_de));
  console.log('  typeof rev:', typeof withDe.images?.front_de?.rev, '| value:', withDe.images?.front_de?.rev);
  console.log('  image_front_url:', withDe.image_front_url ?? 'FEHLT');
}

await client.close();
console.log('\nFertig.');


const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('openfoodfacts');
const col = db.collection('products');

console.log('=== Analyse 1: Erstes deutsches Produkt MIT images-Feld ===');
const sample1 = await col.findOne(
  { 'product_name_de': { $exists: true, $ne: '' }, 'images': { $exists: true } },
  { projection: { product_name_de: 1, images: 1, image_front_url: 1 } }
);
if (sample1) {
  const keys = Object.keys(sample1.images || {});
  console.log('Name:', sample1.product_name_de);
  console.log('Image keys (erste 20):', keys.slice(0, 20).join(', '));
  console.log('image_front_url:', sample1.image_front_url ?? 'FEHLT');
  const namedKey = keys.find(k => !/^\d+$/.test(k));
  if (namedKey) {
    const val = sample1.images[namedKey];
    console.log(`\nNamed key "${namedKey}" Struktur:`, JSON.stringify(val, null, 2));
    console.log('typeof rev:', typeof val?.rev, '| rev value:', val?.rev);
  }
}

console.log('\n=== Analyse 2: Produkt MIT front_de aber rev als Number ===');
const sample2 = await col.findOne(
  {
    'product_name_de': { $exists: true, $ne: '' },
    'images.front_de': { $exists: true }
  },
  { projection: { product_name_de: 1, 'images.front_de': 1, 'images.front_en': 1, image_front_url: 1, barcode: 1, code: 1 } }
);
if (sample2) {
  console.log('Name:', sample2.product_name_de);
  console.log('front_de:', JSON.stringify(sample2.images?.front_de));
  console.log('typeof rev:', typeof sample2.images?.front_de?.rev);
  console.log('image_front_url:', sample2.image_front_url ?? 'FEHLT');
}

console.log('\n=== Analyse 3: Wie viele Produkte haben image_front_url direkt? ===');
const withDirectUrl = await col.countDocuments({
  'product_name_de': { $exists: true, $ne: '' },
  'image_front_url': { $exists: true, $ne: '' }
});
console.log('Mit image_front_url:', withDirectUrl);

console.log('\n=== Analyse 4: Wie viele haben images.front_de MIT rev? ===');
const withFrontDe = await col.countDocuments({
  'product_name_de': { $exists: true, $ne: '' },
  'images.front_de.rev': { $exists: true }
});
console.log('Mit images.front_de.rev:', withFrontDe);

console.log('\n=== Analyse 5: Neue Schema-Struktur — hat images.front_de.imgid? ===');
const sample3 = await col.findOne(
  {
    'product_name_de': { $exists: true, $ne: '' },
    'images.front_de.imgid': { $exists: true },
  },
  { projection: { product_name_de: 1, 'images.front_de': 1, code: 1 } }
);
if (sample3) {
  console.log('Name:', sample3.product_name_de, '| code:', sample3.code);
  console.log('front_de:', JSON.stringify(sample3.images?.front_de, null, 2));
}

console.log('\n=== Analyse 6: Produkt ohne front_de/en aber MIT images ===');
const sample4 = await col.findOne(
  {
    'product_name_de': { $exists: true, $ne: '' },
    'images': { $exists: true },
    'images.front_de': { $exists: false },
    'images.front_en': { $exists: false },
  },
  { projection: { product_name_de: 1, images: 1, code: 1 } }
);
if (sample4) {
  const keys = Object.keys(sample4.images || {});
  console.log('Name:', sample4.product_name_de, '| code:', sample4.code);
  console.log('Image keys:', keys.slice(0, 20).join(', '));
  // Zeige alle non-numeric keys
  const named = keys.filter(k => !/^\d+$/.test(k));
  named.forEach(k => {
    console.log(`\n  Key "${k}":`, JSON.stringify(sample4.images[k]).substring(0, 200));
  });
}

await client.close();
console.log('\nFertig.');
