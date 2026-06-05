/**
 * copy-cosmos-to-cosmos.ts
 *
 * Copies all documents from the DEV foodProducts Cosmos container into the
 * Alpha foodProducts container. Useful for one-time seeding and re-syncing.
 *
 * Design:
 *   - Reads all documents from the SOURCE container via page-based query.
 *   - Upserts each document into the TARGET container (idempotent).
 *   - Preserves manualKeywords + negativeKeywords that already exist in TARGET.
 *   - Concurrent batching: 10 parallel upserts.
 *   - Progress report every 100 products, final summary at the end.
 *
 * Usage:
 *   npm run copy:cosmos
 *   npm run copy:cosmos -- --dry-run      # reads source, prints stats, no writes
 *   npm run copy:cosmos -- --limit=100    # copy first 100 products only
 *
 * Required env vars:
 *   SOURCE_COSMOS_ENDPOINT   — DEV Cosmos endpoint
 *   SOURCE_COSMOS_KEY        — DEV Cosmos key
 *   TARGET_COSMOS_ENDPOINT   — Alpha Cosmos endpoint
 *   TARGET_COSMOS_KEY        — Alpha Cosmos key
 *
 * Optional:
 *   COSMOS_DATABASE_ID — defaults to "fittrack-db"
 */

import { CosmosClient, type Container } from '@azure/cosmos';
import type { FoodProduct } from '../../shared/types/foodProduct.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOURCE_ENDPOINT  = process.env['SOURCE_COSMOS_ENDPOINT'];
const SOURCE_KEY       = process.env['SOURCE_COSMOS_KEY'];
const TARGET_ENDPOINT  = process.env['TARGET_COSMOS_ENDPOINT'];
const TARGET_KEY       = process.env['TARGET_COSMOS_KEY'];
const DATABASE_ID      = process.env['COSMOS_DATABASE_ID'] ?? 'fittrack-db';
const CONTAINER_ID     = 'foodProducts';

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT    = limitArg ? parseInt(limitArg.split('=')[1]!, 10) : Infinity;
const DRY_RUN  = process.argv.includes('--dry-run');

const CONCURRENCY    = 10;
const PROGRESS_EVERY = 100;

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

async function runBatch<T>(tasks: (() => Promise<T>)[]): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(tasks.map((t) => t()));
}

// ---------------------------------------------------------------------------
// Merge helper — preserves manual curation fields in TARGET
// ---------------------------------------------------------------------------

function mergeWithExisting(incoming: FoodProduct, existing: FoodProduct): FoodProduct {
  return {
    ...incoming,
    manualKeywords:   existing.manualKeywords.length   > 0 ? existing.manualKeywords   : incoming.manualKeywords,
    negativeKeywords: existing.negativeKeywords.length > 0 ? existing.negativeKeywords : incoming.negativeKeywords,
    searchKeywords: [
      ...new Set([
        ...incoming.autoKeywords,
        ...(existing.manualKeywords.length > 0 ? existing.manualKeywords : incoming.manualKeywords),
      ]),
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\nFitTrack — Cosmos-to-Cosmos Food Product Copier');
  console.log('=================================================');
  console.log(`Source:    ${SOURCE_ENDPOINT ?? '(not set)'}`);
  console.log(`Target:    ${TARGET_ENDPOINT ?? '(not set)'}`);
  console.log(`Database:  ${DATABASE_ID}`);
  console.log(`Container: ${CONTAINER_ID}`);
  if (Number.isFinite(LIMIT)) console.log(`Limit:     ${LIMIT.toLocaleString()} products`);
  if (DRY_RUN) console.log('\n⚠  DRY RUN — reads source only, no writes to target.\n');
  console.log();

  if (!SOURCE_ENDPOINT || !SOURCE_KEY) {
    console.error('Error: SOURCE_COSMOS_ENDPOINT and SOURCE_COSMOS_KEY must be set.');
    process.exit(1);
  }
  if (!DRY_RUN && (!TARGET_ENDPOINT || !TARGET_KEY)) {
    console.error('Error: TARGET_COSMOS_ENDPOINT and TARGET_COSMOS_KEY must be set (or use --dry-run).');
    process.exit(1);
  }

  // Connect to source
  const sourceClient = new CosmosClient({ endpoint: SOURCE_ENDPOINT, key: SOURCE_KEY });
  const sourceContainer: Container = sourceClient
    .database(DATABASE_ID)
    .container(CONTAINER_ID);

  // Connect to target
  let targetContainer: Container | undefined;
  if (!DRY_RUN) {
    const targetClient = new CosmosClient({ endpoint: TARGET_ENDPOINT!, key: TARGET_KEY! });
    const { database } = await targetClient.databases.createIfNotExists({ id: DATABASE_ID });
    const { container } = await database.containers.createIfNotExists({
      id: CONTAINER_ID,
      partitionKey: { paths: ['/id'] },
    });
    targetContainer = container;
    console.log('Both Cosmos accounts connected. Starting copy…\n');
  } else {
    console.log('Source Cosmos connected. Starting dry-run read…\n');
  }

  // Stats
  let processed = 0;
  let inserted  = 0;
  let updated   = 0;
  let failed    = 0;
  let skipped   = 0;

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

  // Page through all source documents
  const queryIterator = sourceContainer.items.query<FoodProduct>('SELECT * FROM c', { maxItemCount: 100 });

  outer: while (queryIterator.hasMoreResults()) {
    const { resources } = await queryIterator.fetchNext();

    for (const product of resources) {
      if (processed >= LIMIT) break outer;
      processed++;

      if (DRY_RUN) {
        skipped++;
      } else {
        const upsertTask = async () => {
          let final = product;

          // Check if target already has this document to preserve manual curation
          try {
            const { resource: existing } = await targetContainer!
              .item(product.id, product.id)
              .read<FoodProduct>();
            if (existing) {
              final = mergeWithExisting(product, existing);
              updated++;
            } else {
              inserted++;
            }
          } catch {
            // 404 = new document
            inserted++;
          }

          await targetContainer!.items.upsert(final);
        };

        batch.push(upsertTask);

        if (batch.length >= CONCURRENCY) {
          await flushBatch();
        }
      }

      if (processed % PROGRESS_EVERY === 0) {
        if (DRY_RUN) {
          console.log(`  Read ${processed.toLocaleString()} products…`);
        } else {
          console.log(`  Processed ${processed.toLocaleString()} | inserted: ${inserted} | updated: ${updated} | failed: ${failed}`);
        }
      }
    }
  }

  // Flush remaining batch
  await flushBatch();

  // Final summary
  console.log('\n=================================================');
  console.log('Copy complete.');
  console.log(`  Total read from source: ${processed.toLocaleString()}`);
  if (DRY_RUN) {
    console.log(`  Dry run — no writes made.`);
  } else {
    console.log(`  Inserted (new):         ${inserted.toLocaleString()}`);
    console.log(`  Updated (merged):       ${updated.toLocaleString()}`);
    console.log(`  Failed:                 ${failed.toLocaleString()}`);
  }
  console.log('=================================================\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
