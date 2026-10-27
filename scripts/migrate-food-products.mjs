/**
 * migrate-food-products.mjs
 * Kopiert den Katalog-Container foodProducts aus dem Dev-Cosmos in das Alpha-Cosmos (reiner Upsert, wiederholbar).
 * Die Quelle wird nur gelesen. Es wird nichts geloescht.
 *
 * Umgebungsvariablen (keine Argumente, keine Dateien):
 *   SOURCE_COSMOS_ENDPOINT, SOURCE_COSMOS_KEY
 *   TARGET_COSMOS_ENDPOINT, TARGET_COSMOS_KEY (im Dry-Run nicht noetig)
 *
 * Usage:
 *   node scripts/migrate-food-products.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { CosmosClient } from '@azure/cosmos';

// Muss mit backend/src/lib/cosmos.ts uebereinstimmen (foodProducts: Partition Key /id).
const DB_NAME = 'fittrack-db';
const CONTAINER = 'foodProducts';
const BATCH_SIZE = 50;
const MAX_RETRIES = 6;

const ALLOWED_SOURCE_ACCOUNT = 'cosmos-fittrack-dev-hlpqe7';
const TARGET_ACCOUNT_PREFIX = 'cosmos-fittrack-alpha-';
const BLOCKED_ACCOUNTS = ['cosmos-fittrack-dev-ppf5sc', 'cosmos-fittrack-alpha-ppf5sc'];

function accountName(endpoint) {
  let host;
  try {
    host = new URL(endpoint).hostname.toLowerCase();
  } catch {
    throw new Error('Ungueltiger Cosmos-Endpoint.');
  }
  return host.split('.')[0];
}

/** Wirft, wenn Quelle/Ziel nicht dem erlaubten Paar entsprechen. Gibt die Kontonamen zurueck. */
export function assertSafeTarget(sourceEndpoint, targetEndpoint) {
  const source = accountName(sourceEndpoint);
  const target = accountName(targetEndpoint);
  if (source !== ALLOWED_SOURCE_ACCOUNT) {
    throw new Error(`Quelle muss ${ALLOWED_SOURCE_ACCOUNT} sein (gefunden: ${source}).`);
  }
  if (target === source) {
    throw new Error('Ziel entspricht der Quelle.');
  }
  if (BLOCKED_ACCOUNTS.includes(target)) {
    throw new Error(`Ziel ${target} ist gesperrt (altes PRODYNA-Konto).`);
  }
  if (!target.startsWith(TARGET_ACCOUNT_PREFIX)) {
    throw new Error(`Ziel muss ein ${TARGET_ACCOUNT_PREFIX}*-Konto sein (gefunden: ${target}).`);
  }
  return { source, target };
}

async function withRetry(op) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      if (e?.code !== 429 || attempt >= MAX_RETRIES) throw e;
      const wait = Math.max(e.retryAfterInMs ?? 0, 500 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  const env = process.env;
  const sourceEndpoint = env.SOURCE_COSMOS_ENDPOINT;
  const targetEndpoint = env.TARGET_COSMOS_ENDPOINT;
  const sourceKey = env.SOURCE_COSMOS_KEY;
  const targetKey = env.TARGET_COSMOS_KEY;

  const missing = [
    ['SOURCE_COSMOS_ENDPOINT', sourceEndpoint],
    ['SOURCE_COSMOS_KEY', sourceKey],
    ['TARGET_COSMOS_ENDPOINT', targetEndpoint],
    ...(dryRun ? [] : [['TARGET_COSMOS_KEY', targetKey]]),
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Fehlende Umgebungsvariablen: ${missing.join(', ')}`);

  const { source, target } = assertSafeTarget(sourceEndpoint, targetEndpoint);
  console.log(`foodProducts ${dryRun ? 'Dry-Run' : 'Seed'}: ${source} -> ${target} (${DB_NAME}/${CONTAINER})`);

  const sourceContainer = new CosmosClient({ endpoint: sourceEndpoint, key: sourceKey })
    .database(DB_NAME).container(CONTAINER);

  if (dryRun) {
    const { resources } = await withRetry(() =>
      sourceContainer.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll());
    console.log(`Quelle: ${resources[0]} Dokumente. Dry-Run, es wurde nichts geschrieben.`);
    return;
  }

  const targetContainer = new CosmosClient({ endpoint: targetEndpoint, key: targetKey })
    .database(DB_NAME).container(CONTAINER);

  let read = 0;
  let upserted = 0;
  let failed = 0;
  const iterator = sourceContainer.items.query('SELECT * FROM c', { maxItemCount: 200 });
  while (iterator.hasMoreResults()) {
    const { resources } = await withRetry(() => iterator.fetchNext());
    if (!resources?.length) continue;
    read += resources.length;
    for (let i = 0; i < resources.length; i += BATCH_SIZE) {
      const results = await Promise.all(resources.slice(i, i + BATCH_SIZE).map(async (doc) => {
        const { _rid, _self, _etag, _attachments, _ts, ...clean } = doc;
        try {
          await withRetry(() => targetContainer.items.upsert(clean));
          return true;
        } catch {
          return false;
        }
      }));
      upserted += results.filter(Boolean).length;
      failed += results.filter((ok) => !ok).length;
    }
    process.stdout.write(`\r  gelesen: ${read}, geschrieben: ${upserted}`);
  }
  console.log(`\nBericht: gelesen=${read}, geschrieben=${upserted}, fehlgeschlagen=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Seed fehlgeschlagen:', err?.message ?? 'unbekannter Fehler');
    process.exit(1);
  });
}
