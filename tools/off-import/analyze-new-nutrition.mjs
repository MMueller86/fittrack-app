/**
 * analyze-new-nutrition.mjs
 *
 * Dry-run analysis: How many products would be newly importable
 * if we also support the new OFF nutrition schema (schema_version >= 1003)?
 *
 * Old schema: doc.nutriments.energy-kcal_100g
 * New schema: doc.nutrition.aggregated_set.nutrients.energy-kcal.value
 *
 * Outputs:
 *  - Count of products currently passing (old logic)
 *  - Count of newly passing products (new nutrition schema)
 *  - Names of newly passing products
 */

import { MongoClient } from 'mongodb';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';
const KJ_TO_KCAL = 1 / 4.184;
const OUTPUT_FILE = resolve(__dirname, 'output', 'newly-passing-products.txt');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNum(obj, ...keys) {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
      const n = parseFloat(val);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** OLD logic: only reads flat nutriments field */
function extractNutritionOld(doc) {
  const n = doc['nutriments'];
  if (!n) return null;

  let calories = getNum(n, 'energy-kcal_100g', 'energy-kcal');
  if (calories == null) {
    const kj = getNum(n, 'energy_100g', 'energy');
    if (kj != null) calories = kj * KJ_TO_KCAL;
  }
  if (calories == null) return null;

  const protein = getNum(n, 'proteins_100g', 'proteins') ?? 0;
  const carbs   = getNum(n, 'carbohydrates_100g', 'carbohydrates') ?? 0;
  const fat      = getNum(n, 'fat_100g', 'fat') ?? 0;

  return { calories, protein, carbs, fat };
}

/**
 * NEW logic: tries nutriments first (old), then falls back to:
 *  1. nutrition.aggregated_set.nutrients  (preferred — merged best-source values)
 *  2. nutrition.input_sets[0].nutrients  (first packaging entry)
 */
function extractNutritionNew(doc) {
  // 1. Old-style flat nutriments — unchanged
  const old = extractNutritionOld(doc);
  if (old) return { ...old, source: 'nutriments' };

  // 2. New-style nutrition object
  const nutrition = doc['nutrition'];
  if (!nutrition) return null;

  // Helper: read nutrients map (new schema stores { value, unit } per nutrient)
  function readNutrients(nutrients) {
    if (!nutrients || typeof nutrients !== 'object') return null;

    function getNutrientVal(key) {
      const entry = nutrients[key];
      if (!entry) return undefined;
      // value may be direct number or nested { value: number }
      if (typeof entry.value === 'number' && Number.isFinite(entry.value)) return entry.value;
      if (typeof entry.value === 'string') {
        const n = parseFloat(entry.value);
        if (Number.isFinite(n)) return n;
      }
      return undefined;
    }

    let calories = getNutrientVal('energy-kcal');
    if (calories == null) {
      const kj = getNutrientVal('energy-kj') ?? getNutrientVal('energy');
      if (kj != null) calories = kj * KJ_TO_KCAL;
    }
    if (calories == null) return null;

    const protein = getNutrientVal('proteins') ?? 0;
    const carbs   = getNutrientVal('carbohydrates') ?? 0;
    const fat      = getNutrientVal('fat') ?? 0;

    return { calories, protein, carbs, fat };
  }

  // Try aggregated_set first (best merged values)
  const aggregated = nutrition['aggregated_set'];
  if (aggregated?.nutrients) {
    const result = readNutrients(aggregated.nutrients);
    if (result) return { ...result, source: 'nutrition.aggregated_set' };
  }

  // Fall back to first input_set
  const inputSets = nutrition['input_sets'];
  if (Array.isArray(inputSets) && inputSets.length > 0) {
    for (const set of inputSets) {
      const result = readNutrients(set.nutrients);
      if (result) return { ...result, source: 'nutrition.input_sets[0]' };
    }
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new MongoClient(MONGO_URI);

try {
  await client.connect();
  const col = client.db('off').collection('products');

  const mongoFilter = {
    product_type: 'food',
    product_name_de: { $exists: true, $gt: '' },
  };

  const projection = {
    _id: 0,
    code: 1,
    product_name_de: 1,
    product_name_en: 1,
    product_name: 1,
    nutriments: 1,
    nutrition: 1,
    data_quality_errors_tags: 1,
  };

  const cursor = col.find(mongoFilter, { projection });

  let scanned = 0;
  let passedOld = 0;
  let passedNew = 0;
  let newlyCount = 0;

  // Track source breakdown for new products
  const sourceCounts = {};

  // Write names directly to file to avoid memory issues with 300k+ products
  mkdirSync(resolve(__dirname, 'output'), { recursive: true });
  const fileStream = createWriteStream(OUTPUT_FILE, { encoding: 'utf-8' });
  fileStream.write('barcode\tname\tcalories\tprotein\tcarbs\tfat\tsource\n');

  for await (const doc of cursor) {
    scanned++;

    // Skip documents with quality errors (same as the main script)
    const qErrors = doc['data_quality_errors_tags'];
    if (Array.isArray(qErrors) && qErrors.length > 0) continue;

    // Must have a name (same guard as main script)
    const name = (doc['product_name_de'] || doc['product_name_en'] || doc['product_name'] || '').trim();
    if (!name) continue;

    const oldResult = extractNutritionOld(doc);
    const newResult = extractNutritionNew(doc);

    if (oldResult) {
      passedOld++;
      passedNew++;
    } else if (newResult) {
      passedNew++;
      newlyCount++;
      sourceCounts[newResult.source] = (sourceCounts[newResult.source] ?? 0) + 1;
      const cal = Math.round(newResult.calories);
      const prot = Math.round(newResult.protein * 10) / 10;
      const carbs = Math.round(newResult.carbs * 10) / 10;
      const fat = Math.round(newResult.fat * 10) / 10;
      // Escape tab characters in name for TSV safety
      const safeName = name.replace(/\t/g, ' ');
      fileStream.write(`${doc['code']}\t${safeName}\t${cal}\t${prot}\t${carbs}\t${fat}\t${newResult.source}\n`);
    }

    if (scanned % 10_000 === 0) {
      process.stdout.write(`\r  Scanned: ${scanned.toLocaleString().padStart(8)}  |  Old: ${passedOld.toLocaleString().padStart(7)}  |  New: ${passedNew.toLocaleString().padStart(7)}  |  Newly: ${newlyCount.toLocaleString().padStart(7)}`);
    }
  }

  await new Promise((res, rej) => fileStream.end((err) => err ? rej(err) : res()));
  process.stdout.write('\n\n');

  console.log('════════════════════════════════════════════════════');
  console.log('  Nutrition Schema Analysis — Dry Run');
  console.log('════════════════════════════════════════════════════');
  console.log(`  Scanned (passed MongoDB pre-filter):  ${scanned.toLocaleString()}`);
  console.log(`  Pass with OLD logic (nutriments):     ${passedOld.toLocaleString()}`);
  console.log(`  Pass with NEW logic (+ nutrition):    ${passedNew.toLocaleString()}`);
  console.log(`  Newly passing products:               ${newlyCount.toLocaleString()}`);
  console.log(`  Improvement factor:                   ${passedOld > 0 ? (passedNew / passedOld).toFixed(1) : 'N/A'}×`);
  console.log(`\n  Names written to: ${OUTPUT_FILE}`);

  if (Object.keys(sourceCounts).length > 0) {
    console.log('\n  Source breakdown for newly passing products:');
    for (const [src, cnt] of Object.entries(sourceCounts).sort(([,a],[,b]) => b-a)) {
      console.log(`    ${src.padEnd(40)} ${cnt.toLocaleString()}`);
    }
  }

} finally {
  await client.close();
}
