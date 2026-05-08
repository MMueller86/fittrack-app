/**
 * import-to-cosmos.ts
 *
 * Reads the cleaned food-products.sample.json export and upserts each product
 * into the Cosmos DB `foodProducts` container.
 *
 * Design:
 *   - Idempotent: uses id = "openFoodFacts:<barcode>" as both document id and partition key.
 *   - Re-import merge: for existing documents, preserves manualKeywords + negativeKeywords.
 *   - Concurrent batching: 10 parallel upserts to avoid overwhelming Cosmos RU limits.
 *   - Progress report every 100 products, final summary at the end.
 *
 * Usage:
 *   npm run import:cosmos
 *   npm run import:cosmos -- --dry-run          # validate JSON, print stats, no writes
 *   npm run import:cosmos -- --limit=100        # import first 100 products only
 *
 * Required env vars:
 *   COSMOS_ENDPOINT   — e.g. https://fittrack.documents.azure.com:443/
 *   COSMOS_KEY        — primary or secondary key
 *
 * Optional:
 *   COSMOS_DATABASE_ID — defaults to "fittrack-db"
 */

import { CosmosClient } from '@azure/cosmos';
import { createReadStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import type { FoodProduct } from '../../shared/types/foodProduct.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COSMOS_ENDPOINT = process.env['COSMOS_ENDPOINT'];
const COSMOS_KEY      = process.env['COSMOS_KEY'];
const DATABASE_ID     = process.env['COSMOS_DATABASE_ID'] ?? 'fittrack-db';
const CONTAINER_ID    = 'foodProducts';

const INPUT_FILE = resolve(__dirname, 'output', 'food-products.sample.json');

const limitArg  = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1]!, 10) : Infinity;
const DRY_RUN   = process.argv.includes('--dry-run');

const CONCURRENCY = 10;   // parallel upserts per batch
const PROGRESS_EVERY = 100;

// ---------------------------------------------------------------------------
// JSON line reader — streams the array without loading it fully into memory
// ---------------------------------------------------------------------------

async function* readProductsFromFile(filePath: string): AsyncGenerator<FoodProduct> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const raw of rl) {
    const line = raw.trim().replace(/^\[/, '').replace(/\]$/, '').replace(/^,/, '').replace(/,$/, '').trim();
    if (!line || line === '[' || line === ']') continue;
    try {
      yield JSON.parse(line) as FoodProduct;
    } catch {
      // skip malformed lines silently
    }
  }
}

// ---------------------------------------------------------------------------
// Merge helper — preserves manual curation fields across re-imports
// ---------------------------------------------------------------------------

function mergeWithExisting(incoming: FoodProduct, existing: FoodProduct): FoodProduct {
  return {
    ...incoming,
    // Preserve manually curated fields — these are set by humans, not the pipeline
    manualKeywords:  existing.manualKeywords.length  > 0 ? existing.manualKeywords  : incoming.manualKeywords,
    negativeKeywords: existing.negativeKeywords.length > 0 ? existing.negativeKeywords : incoming.negativeKeywords,
    // Recompute searchKeywords so it reflects any preserved manualKeywords
    searchKeywords: [
      ...new Set([
        ...incoming.autoKeywords,
        ...(existing.manualKeywords.length > 0 ? existing.manualKeywords : incoming.manualKeywords),
      ]),
    ],
  };
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

async function runBatch<T>(tasks: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(tasks.map((t) => t()));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nFitTrack — Food Product Cosmos Importer');
  console.log('========================================');
  console.log(`Source:    ${INPUT_FILE}`);
  console.log(`Database:  ${DATABASE_ID}`);
  console.log(`Container: ${CONTAINER_ID}`);
  if (Number.isFinite(LIMIT)) console.log(`Limit:     ${LIMIT.toLocaleString()} products`);
  if (DRY_RUN) console.log('\n⚠  DRY RUN — no writes will be made.\n');
  console.log();

  if (!DRY_RUN) {
    if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
      console.error(
        'Error: COSMOS_ENDPOINT and COSMOS_KEY must be set in environment variables.\n' +
        'For local dev, set them in tools/off-import/.env or export them in your shell.',
      );
      process.exit(1);
    }
  }

  // Connect to Cosmos
  let container: import('@azure/cosmos').Container | undefined;
  if (!DRY_RUN) {
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT!, key: COSMOS_KEY! });
    const { database } = await client.databases.createIfNotExists({ id: DATABASE_ID });
    const { container: c } = await database.containers.createIfNotExists({
      id: CONTAINER_ID,
      partitionKey: { paths: ['/id'] },
    });
    container = c;
    console.log('Cosmos connected. Starting import…\n');
  }

  // Stats
  let processed = 0;
  let inserted  = 0;
  let updated   = 0;
  let failed    = 0;
  let skipped   = 0;  // dry-run

  const batch: (() => Promise<void>)[] = [];

  async function flushBatch() {
    if (batch.length === 0) return;
    const results = await runBatch(batch);
    batch.length = 0;
    for (const r of results) {
      if (r.status === 'rejected') {
        failed++;
        console.error('  ✗ upsert failed:', r.reason instanceof Error ? r.reason.message : r.reason);
      }
    }
  }

  for await (const product of readProductsFromFile(INPUT_FILE)) {
    if (processed >= LIMIT) break;
    processed++;

    if (DRY_RUN) {
      skipped++;
    } else {
      const task = async () => {
        // Try to read existing document to preserve manual curation fields
        const { resource: existing } = await container!
          .item(product.id, product.id)
          .read<FoodProduct>();

        const toWrite = existing ? mergeWithExisting(product, existing) : product;

        await container!.items.upsert(toWrite);

        if (existing) {
          updated++;
        } else {
          inserted++;
        }
      };
      batch.push(task);

      if (batch.length >= CONCURRENCY) {
        await flushBatch();
      }
    }

    if (processed % PROGRESS_EVERY === 0) {
      const done = DRY_RUN ? skipped : inserted + updated + failed;
      process.stdout.write(
        `\r  Processed: ${processed.toLocaleString().padStart(6)}  |  Done: ${done.toLocaleString().padStart(6)}`,
      );
    }
  }

  // Flush remaining batch
  await flushBatch();
  process.stdout.write('\n');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n════════════════════════════════════════');
  console.log('  Import Summary');
  console.log('════════════════════════════════════════');
  console.log(`  Products read:    ${processed.toLocaleString()}`);
  if (DRY_RUN) {
    console.log(`  Dry run — no writes made.`);
  } else {
    console.log(`  Inserted (new):  ${inserted.toLocaleString()}`);
    console.log(`  Updated (merge): ${updated.toLocaleString()}`);
    console.log(`  Failed:          ${failed.toLocaleString()}`);
  }
  console.log('════════════════════════════════════════\n');
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
