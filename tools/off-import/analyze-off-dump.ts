/**
 * analyze-off-dump.ts � rewritten for performance using $facet (single pass).
 */
import { MongoClient, type Document } from 'mongodb';

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';
const KJ_TO_KCAL = 1 / 4.184;

function getNum(doc: Document, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const val = doc[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') { const n = parseFloat(val); if (Number.isFinite(n)) return n; }
  }
  return undefined;
}
function getProductName(doc: Document): string | undefined {
  for (const k of ['product_name_de','product_name','product_name_en']) {
    const v = doc[k]; if (typeof v === 'string' && v.trim()) return v.trim();
  }
}
function extractNutrition(doc: Document) {
  const n: Document = doc['nutriments'] ?? {};
  let cal = getNum(n,'energy-kcal_100g','energy-kcal');
  if (cal == null) { const kj = getNum(n,'energy_100g','energy'); if (kj != null) cal = kj * KJ_TO_KCAL; }
  const pro = getNum(n,'proteins_100g','proteins');
  const carb = getNum(n,'carbohydrates_100g','carbohydrates');
  const fat = getNum(n,'fat_100g','fat');
  if (cal==null||pro==null||carb==null||fat==null) return undefined;
  return { calories:cal, protein:pro, carbs:carb, fat, fiber:getNum(n,'fiber_100g','fiber') };
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log(`Connected.\n`);
    const col = client.db('off').collection('products');

    const hasName = { $or: [
      { product_name_de: { $exists: true, $gt: '' } },
      { product_name:    { $exists: true, $gt: '' } },
    ]};
    const hasNutrition = { $and: [
      { $or: [
        { 'nutriments.energy-kcal_100g': { $exists: true } },
        { 'nutriments.energy_100g':      { $exists: true } },
      ]},
      { 'nutriments.proteins_100g':      { $exists: true } },
      { 'nutriments.carbohydrates_100g': { $exists: true } },
      { 'nutriments.fat_100g':           { $exists: true } },
    ]};

    console.log('Running $facet aggregation (single pass) �');
    const [res] = await col.aggregate([{ $facet: {
      total:      [{ $count: 'n' }],
      germany:    [{ $match: { countries_tags: 'en:germany' } }, { $count: 'n' }],
      foodType:   [{ $match: { product_type: 'food' } },         { $count: 'n' }],
      named:      [{ $match: hasName },                           { $count: 'n' }],
      nutrition:  [{ $match: hasNutrition },                      { $count: 'n' }],
      noQualErr:  [{ $match: { $or:[
                    { data_quality_errors_tags: { $exists: false } },
                    { data_quality_errors_tags: { $size: 0 } },
                  ]}},                                            { $count: 'n' }],
      allFilters: [{ $match: { $and: [hasName, hasNutrition] } }, { $count: 'n' }],
    }}], { allowDiskUse: true }).toArray() as Document[];

    const n = (k: string): number => (res[k] as Document[])[0]?.['n'] as number ?? 0;
    const total = n('total');
    const pct = (v: number) => total > 0 ? ` (${((v/total)*100).toFixed(1)}%)` : '';

    console.log('\n---------------------------------------------------');
    console.log('  Open Food Facts � MongoDB Dump Analysis');
    console.log('---------------------------------------------------');
    console.log(`  Total products:                   ${total.toLocaleString()}`);
    console.log(`  countries_tags = en:germany:      ${n('germany').toLocaleString()}${pct(n('germany'))}`);
    console.log(`  product_type = food:              ${n('foodType').toLocaleString()}${pct(n('foodType'))}`);
    console.log(`  Usable product name:              ${n('named').toLocaleString()}${pct(n('named'))}`);
    console.log(`  Complete core nutrition (exists): ${n('nutrition').toLocaleString()}${pct(n('nutrition'))}`);
    console.log(`  No quality error tags:            ${n('noQualErr').toLocaleString()}${pct(n('noQualErr'))}`);
    console.log('---------------------------------------------------');
    console.log(`  Pass ALL filters (name+nutrition): ${n('allFilters').toLocaleString()}${pct(n('allFilters'))}`);
    console.log('---------------------------------------------------\n');

    console.log('10 example products passing all filters:\n');
    const examples = await col.find({ $and: [hasName, hasNutrition] }, { projection: {
      _id:0, code:1, product_name:1, product_name_de:1, brands:1, countries_tags:1,
      'nutriments.energy-kcal_100g':1, 'nutriments.energy_100g':1,
      'nutriments.proteins_100g':1, 'nutriments.carbohydrates_100g':1,
      'nutriments.fat_100g':1, 'nutriments.fiber_100g':1,
    }}).limit(10).toArray();

    for (const doc of examples) {
      const name = getProductName(doc) ?? '(no name)';
      const brand = typeof doc['brands']==='string' ? doc['brands'].split(',')[0]?.trim() : '';
      const nut = extractNutrition(doc);
      const de = Array.isArray(doc['countries_tags']) && (doc['countries_tags'] as string[]).includes('en:germany') ? '????' : '  ';
      console.log(`  ${de} ${name}${brand ? ` [${brand}]` : ''}`);
      console.log(`     code: ${doc['code']??'�'}`);
      if (nut) console.log(`     kcal:${Math.round(nut.calories)}  pro:${nut.protein.toFixed(1)}g  carbs:${nut.carbs.toFixed(1)}g  fat:${nut.fat.toFixed(1)}g  fiber:${nut.fiber!=null?nut.fiber.toFixed(1):'�'}g`);
      console.log();
    }
  } finally {
    await client.close();
    console.log('Connection closed.');
  }
}
main().catch((e:unknown)=>{ console.error('Fatal:',e); process.exit(1); });
