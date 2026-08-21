import { CosmosClient } from '@azure/cosmos';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTAINER_NAME = 'aiInsights';
export const OLD_TREND_KEY = 'trend7d';
export const NEW_TREND_KEY = 'weeklyTrend30d';
export const DEFAULT_PAGE_SIZE = 100;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function addFailure(summary, id, error) {
  summary.failed += 1;
  summary.failures.push({ id, message: errorMessage(error) });
}

function createSummary() {
  return {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    conflict: 0,
    failed: 0,
    conflicts: [],
    failures: [],
  };
}

function parsePageSize(value) {
  if (value == null || value === '') return DEFAULT_PAGE_SIZE;
  const pageSize = Number(value);
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('COSMOS_MIGRATION_PAGE_SIZE must be a positive integer.');
  }
  return pageSize;
}

export async function migrateInsightWeightTrend(container, options = {}) {
  const summary = createSummary();
  const pageSize = parsePageSize(options.pageSize);
  const querySpec = {
    query: 'SELECT * FROM c WHERE (NOT IS_DEFINED(c._docType) OR c._docType = @dailyInsight OR c._docType = @insightFeedback)',
    parameters: [
      { name: '@dailyInsight', value: 'dailyInsight' },
      { name: '@insightFeedback', value: 'insightFeedback' },
    ],
  };

  try {
    const iterator = container.items.query(querySpec, { maxItemCount: pageSize });
    while (iterator.hasMoreResults()) {
      const { resources } = await iterator.fetchNext();
      for (const document of resources ?? []) {
        if (
          document._docType !== undefined
          && document._docType !== 'dailyInsight'
          && document._docType !== 'insightFeedback'
        ) {
          continue;
        }
        summary.scanned += 1;

        const inputContext = isRecord(document.inputContext) ? document.inputContext : null;
        const weight = inputContext && isRecord(inputContext.weight) ? inputContext.weight : null;
        if (!weight || !Object.hasOwn(weight, OLD_TREND_KEY)) {
          summary.skipped += 1;
          continue;
        }

        const oldValue = weight[OLD_TREND_KEY];
        if (Object.hasOwn(weight, NEW_TREND_KEY)) {
          if (!Object.is(weight[NEW_TREND_KEY], oldValue)) {
            summary.conflict += 1;
            summary.conflicts.push(document.id ?? '<missing-id>');
          } else {
            summary.skipped += 1;
          }
          continue;
        }

        if (oldValue === undefined) {
          addFailure(summary, document.id ?? '<missing-id>', new Error('The legacy trend value is undefined.'));
          continue;
        }
        if (typeof document.id !== 'string' || typeof document.userId !== 'string') {
          addFailure(summary, document.id ?? '<missing-id>', new Error('The document id or userId is missing.'));
          continue;
        }

        try {
          await container.item(document.id, document.userId).patch({
            operations: [
              { op: 'set', path: `/inputContext/weight/${NEW_TREND_KEY}`, value: oldValue },
              { op: 'remove', path: `/inputContext/weight/${OLD_TREND_KEY}` },
            ],
          });
          summary.migrated += 1;
        } catch (error) {
          addFailure(summary, document.id, error);
        }
      }
    }
  } catch (error) {
    addFailure(summary, '<query>', error);
  }

  return summary;
}

export function formatMigrationSummary(summary) {
  const lines = [
    `Migration counts: scanned=${summary.scanned} migrated=${summary.migrated} skipped=${summary.skipped} conflict=${summary.conflict} failed=${summary.failed}`,
  ];
  for (const id of summary.conflicts) lines.push(`Conflict: ${id}`);
  for (const failure of summary.failures) lines.push(`Failed: ${failure.id}: ${failure.message}`);
  return lines.join('\n');
}

async function runFromEnvironment() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set.');
  }

  const client = new CosmosClient({ endpoint, key });
  const databaseId = process.env.COSMOS_DATABASE_ID ?? 'fittrack-db';
  const container = client.database(databaseId).container(CONTAINER_NAME);
  try {
    const summary = await migrateInsightWeightTrend(container, {
      pageSize: process.env.COSMOS_MIGRATION_PAGE_SIZE,
    });
    console.log(formatMigrationSummary(summary));
    if (summary.conflict > 0 || summary.failed > 0) {
      throw new Error('Migration completed with conflicts or failures.');
    }
  } finally {
    client.dispose();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runFromEnvironment().catch((error) => {
    console.error(`Migration failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}