/**
 * migrate-food-products.mjs
 * Migriert den foodProducts-Container von Dev nach Alpha.
 * Strategie: DELETE ALL in Alpha, dann INSERT ALL aus Dev (paginiert, Batches).
 *
 * Usage:
 *   node scripts/migrate-food-products.mjs <alpha-cosmos-key> <dev-cosmos-key>
 * oder via Env-Variablen: DEV_COSMOS_KEY und ALPHA_COSMOS_KEY setzen.
 *
 * Dev-Credentials werden NICHT hardcoded gespeichert.
 */

import { CosmosClient } from '@azure/cosmos';

// ── Konfiguration ────────────────────────────────────────────────────────────
const DEV_ENDPOINT  = 'https://cosmos-fittrack-dev-ppf5sc.documents.azure.com:443/';
const DEV_KEY       = process.argv[3] ?? process.env.DEV_COSMOS_KEY;
const ALPHA_ENDPOINT = 'https://cosmos-fittrack-alpha-ppf5sc.documents.azure.com:443/';
const ALPHA_KEY     = process.argv[2] ?? process.env.ALPHA_COSMOS_KEY;
const DB_NAME       = 'fittrack-db';
const CONTAINER     = 'foodProducts';
const BATCH_SIZE    = 50; // Cosmos bulk upsert batch

if (!DEV_KEY) {
  console.error('ERROR: Dev Cosmos Key fehlt. Usage: node migrate-food-products.mjs <alpha-key> <dev-key> oder DEV_COSMOS_KEY setzen.');
  process.exit(1);
}
if (!ALPHA_KEY) {
  console.error('ERROR: Alpha Cosmos Key fehlt. Usage: node migrate-food-products.mjs <alpha-key> oder ALPHA_COSMOS_KEY setzen.');
  process.exit(1);
}

// ── Clients ──────────────────────────────────────────────────────────────────
const devClient   = new CosmosClient({ endpoint: DEV_ENDPOINT,   key: DEV_KEY   });
const alphaClient = new CosmosClient({ endpoint: ALPHA_ENDPOINT, key: ALPHA_KEY });

const devContainer   = devClient.database(DB_NAME).container(CONTAINER);
const alphaContainer = alphaClient.database(DB_NAME).container(CONTAINER);

// ── Helpers ──────────────────────────────────────────────────────────────────
function log(msg) { process.stdout.write(`\r${msg}                    `); }
function logln(msg) { console.log(`\n${msg}`); }

async function deleteAllInAlpha() {
  logln('📦 Lese alle IDs aus Alpha zum Löschen…');
  let deleted = 0;
  const iterator = alphaContainer.items.query('SELECT c.id FROM c', { maxItemCount: 200 });
  while (iterator.hasMoreResults()) {
    const { resources } = await iterator.fetchNext();
    if (!resources?.length) continue;

    // Paralleles Löschen (max BATCH_SIZE gleichzeitig)
    for (let i = 0; i < resources.length; i += BATCH_SIZE) {
      const batch = resources.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(({ id }) =>
        alphaContainer.item(id, id).delete().catch(() => {})
      ));
      deleted += batch.length;
      log(`  Gelöscht: ${deleted}`);
    }
  }
  logln(`✅ Alpha geleert: ${deleted} Dokumente gelöscht`);
}

async function insertAllFromDev() {
  logln('📥 Lese alle Produkte aus Dev und schreibe nach Alpha…');
  let total = 0;
  const iterator = devContainer.items.query('SELECT * FROM c', { maxItemCount: 200 });
  while (iterator.hasMoreResults()) {
    const { resources } = await iterator.fetchNext();
    if (!resources?.length) continue;

    // Paralleles Upsert (max BATCH_SIZE gleichzeitig)
    for (let i = 0; i < resources.length; i += BATCH_SIZE) {
      const batch = resources.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((doc) => {
        const { _rid, _self, _etag, _attachments, _ts, ...clean } = doc;
        return alphaContainer.items.upsert(clean).catch((e) =>
          console.error(`\nFehler bei ${doc.id}: ${e.message}`)
        );
      }));
      total += batch.length;
      log(`  Übertragen: ${total}`);
    }
  }
  logln(`✅ Migration abgeschlossen: ${total} Produkte nach Alpha importiert`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 FitTrack foodProducts Migration: Dev → Alpha');
  console.log(`   Dev:   ${DEV_ENDPOINT}`);
  console.log(`   Alpha: ${ALPHA_ENDPOINT}`);
  console.log(`   Container: ${CONTAINER}`);
  console.log('');

  const startTime = Date.now();
  await deleteAllInAlpha();
  await insertAllFromDev();

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logln(`\n🎉 Fertig in ${elapsed}s`);
})().catch((err) => {
  console.error('\n❌ Migration fehlgeschlagen:', err.message);
  process.exit(1);
});
