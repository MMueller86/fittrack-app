/**
 * migrate-alpha-data.mjs
 * Einmalige Kopie der Nutzerdaten der alten Alpha (PRODYNA) in die neue Alpha (Fittrack).
 * Die Quelle wird nur gelesen (Query/List/Download). Berichte enthalten nur Zaehlwerte.
 *
 * Umgebungsvariablen (Connection-Strings, nie ausgeben):
 *   SRC_COSMOS_CONN, SRC_STORAGE_CONN, TGT_COSMOS_CONN, TGT_STORAGE_CONN
 *
 * Usage:
 *   node scripts/migrate-alpha-data.mjs inventory   (SRC_* und/oder TGT_*)
 *   node scripts/migrate-alpha-data.mjs copy        (SRC_* und TGT_*)
 *   node scripts/migrate-alpha-data.mjs verify [--allow-extra]   (SRC_* und TGT_*)
 *   node scripts/migrate-alpha-data.mjs clear --yes (nur TGT_*)
 */

import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { CosmosClient } from '@azure/cosmos';
import { BlobServiceClient } from '@azure/storage-blob';

const DB_NAME = 'fittrack-db';
const MAX_RETRIES = 6;
const BATCH_SIZE = 25;
const SAMPLE_SIZE = 20;

const SOURCE_COSMOS = 'cosmos-fittrack-alpha-ppf5sc';
const SOURCE_STORAGE = 'stfittrackalphappf5sc';
const TARGET_COSMOS = 'cosmos-fittrack-alpha-wcobsd';
const TARGET_STORAGE = 'stfittrackalphawcobsd';

// Muss mit backend/src/lib/cosmos.ts uebereinstimmen (ohne foodProducts); Drift-Test in den Tests.
export const USER_CONTAINERS = [
  { id: 'users', partitionKey: '/id' },
  { id: 'nutritionProfiles', partitionKey: '/userId' },
  { id: 'profiles', partitionKey: '/userId' },
  { id: 'weights', partitionKey: '/userId' },
  { id: 'nutritionDiaryMeals', partitionKey: '/userId' },
  { id: 'reusableMealItems', partitionKey: '/userId' },
  { id: 'recipes', partitionKey: '/userId' },
  { id: 'communityRecipes', partitionKey: '/id' },
  { id: 'aiUsage', partitionKey: '/userId' },
  { id: 'aiInsights', partitionKey: '/userId' },
  { id: 'userFoodRelations', partitionKey: '/userId' },
];

// product-images wird nur kopiert, wenn es in der Quelle existiert; clear betrifft nur recipe-images.
export const BLOB_COPY_CONTAINERS = ['recipe-images', 'product-images'];
export const BLOB_CLEAR_CONTAINERS = ['recipe-images'];

/** Fehler mit sicherer Meldung (enthaelt nie Secrets). */
class UserError extends Error {}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new UserError('Ungueltiger Endpoint.');
  }
}

function parseConn(conn, label) {
  const parts = {};
  for (const seg of String(conn ?? '').split(';')) {
    const i = seg.indexOf('=');
    if (i > 0) parts[seg.slice(0, i).trim()] = seg.slice(i + 1).trim();
  }
  if (!Object.keys(parts).length) throw new UserError(`${label}: ungueltiger Connection-String.`);
  return parts;
}

export function parseCosmosConn(conn, label = 'Cosmos') {
  const p = parseConn(conn, label);
  if (!p.AccountEndpoint || !p.AccountKey) throw new UserError(`${label}: AccountEndpoint/AccountKey fehlen.`);
  hostOf(p.AccountEndpoint);
  return { endpoint: p.AccountEndpoint, key: p.AccountKey, account: hostOf(p.AccountEndpoint).split('.')[0] };
}

export function parseStorageConn(conn, label = 'Storage') {
  const p = parseConn(conn, label);
  if (!p.AccountName || !p.AccountKey) throw new UserError(`${label}: AccountName/AccountKey fehlen.`);
  const account = p.AccountName.toLowerCase();
  const host = p.BlobEndpoint
    ? hostOf(p.BlobEndpoint)
    : `${account}.blob.${(p.EndpointSuffix || 'core.windows.net').toLowerCase()}`;
  if (host.split('.')[0] !== account) throw new UserError(`${label}: BlobEndpoint passt nicht zu AccountName.`);
  return { conn, account, host };
}

/**
 * Exakte Allowlist: Quelle = altes PRODYNA-Paar, Ziel = neues Fittrack-Paar.
 * Nur uebergebene Seiten werden geprueft (Cosmos-Endpoint-URL bzw. Storage-Kontoname).
 */
export function assertSafeEnds({ sourceCosmosEndpoint, sourceStorageAccount, targetCosmosEndpoint, targetStorageAccount }) {
  const checks = [
    ['Quelle Cosmos', sourceCosmosEndpoint === undefined ? undefined : hostOf(sourceCosmosEndpoint).split('.')[0], SOURCE_COSMOS],
    ['Quelle Storage', sourceStorageAccount, SOURCE_STORAGE],
    ['Ziel Cosmos', targetCosmosEndpoint === undefined ? undefined : hostOf(targetCosmosEndpoint).split('.')[0], TARGET_COSMOS],
    ['Ziel Storage', targetStorageAccount, TARGET_STORAGE],
  ];
  let any = false;
  for (const [label, actual, expected] of checks) {
    if (actual === undefined) continue;
    any = true;
    if (String(actual).toLowerCase() !== expected) {
      throw new UserError(`${label} muss ${expected} sein (gefunden: ${actual}).`);
    }
  }
  if (!any) throw new UserError('Keine Konten zum Pruefen uebergeben.');
  return true;
}

/** E-3: aiInsights nur insightFeedback, alle anderen Container vollstaendig. */
export function shouldCopy(container, doc) {
  if (container === 'aiInsights') return doc?._docType === 'insightFeedback';
  return true;
}

/** E-4a: Systemfelder (_-Praefix) entfernen, ausser _docType. */
export function stripSystemFields(doc) {
  return Object.fromEntries(Object.entries(doc).filter(([k]) => !k.startsWith('_') || k === '_docType'));
}

/** Klassen: relativ | absolut-Quellhost | extern | sonstig */
export function classifyImageValue(value, sourceStorageHost) {
  if (typeof value !== 'string' || !value.trim()) return 'sonstig';
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) {
    try {
      const h = new URL(v).hostname.toLowerCase();
      return sourceStorageHost && h === sourceStorageHost.toLowerCase() ? 'absolut-Quellhost' : 'extern';
    } catch {
      return 'sonstig';
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return 'sonstig';
  return 'relativ';
}

function partitionValue(def, doc) {
  return doc[def.partitionKey.slice(1)];
}

export function docKey(def, doc) {
  return `${partitionValue(def, doc)}\u0000${doc.id}`;
}

export function safeError(e) {
  if (e instanceof UserError) return e.message;
  const code = e?.code ?? e?.statusCode ?? e?.name ?? 'unbekannt';
  return `Operation fehlgeschlagen (code=${typeof code === 'object' ? 'unbekannt' : code}).`;
}

async function withRetry(op) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (e) {
      const status = e?.code ?? e?.statusCode;
      if ((status !== 429 && status !== 503) || attempt >= MAX_RETRIES) throw e;
      const wait = Math.max(e.retryAfterInMs ?? 0, 500 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function readAllDocs(container) {
  const docs = [];
  const iterator = container.items.query('SELECT * FROM c', { maxItemCount: 200 });
  while (iterator.hasMoreResults()) {
    const { resources } = await withRetry(() => iterator.fetchNext());
    if (resources?.length) docs.push(...resources);
  }
  return docs;
}

async function listBlobs(containerClient) {
  const blobs = [];
  for await (const b of containerClient.listBlobsFlat({ includeMetadata: true })) blobs.push(b);
  return blobs;
}

const sumBytes = (blobs) => blobs.reduce((s, b) => s + (b.properties?.contentLength ?? 0), 0);

/** Kopiert Blob-Container; fehlender Quell-Container wird uebersprungen (kein Fehler). */
export async function copyBlobs(sourceSvc, targetSvc, names = BLOB_COPY_CONTAINERS) {
  const containers = [];
  let failed = 0;
  for (const name of names) {
    const src = sourceSvc.getContainerClient(name);
    if (!(await withRetry(() => src.exists()))) {
      containers.push({ name, status: 'Quelle nicht vorhanden', copied: 0, failed: 0, bytes: 0 });
      continue;
    }
    const tgt = targetSvc.getContainerClient(name);
    await withRetry(() => tgt.createIfNotExists());
    let copied = 0;
    let bytes = 0;
    let fail = 0;
    for (const b of await withRetry(() => listBlobs(src))) {
      try {
        const buffer = await withRetry(() => src.getBlockBlobClient(b.name).downloadToBuffer());
        const p = b.properties ?? {};
        await withRetry(() => tgt.getBlockBlobClient(b.name).uploadData(buffer, {
          blobHTTPHeaders: {
            blobContentType: p.contentType,
            blobCacheControl: p.cacheControl,
            blobContentEncoding: p.contentEncoding,
            blobContentDisposition: p.contentDisposition,
            blobContentLanguage: p.contentLanguage,
          },
          ...(b.metadata ? { metadata: b.metadata } : {}),
        }));
        copied++;
        bytes += buffer.length;
      } catch {
        fail++;
      }
    }
    failed += fail;
    containers.push({ name, status: 'kopiert', copied, failed: fail, bytes });
  }
  return { containers, failed };
}

/** Vergleicht Quell- und Ziel-Blobs (Anzahl, Bytes, Content-Type); nur Zaehlwerte. */
export async function verifyBlobs(sourceSvc, targetSvc, names = BLOB_COPY_CONTAINERS) {
  const containers = [];
  let ok = true;
  for (const name of names) {
    const src = sourceSvc.getContainerClient(name);
    if (!(await withRetry(() => src.exists()))) {
      containers.push({ name, status: 'Quelle nicht vorhanden' });
      continue;
    }
    const srcBlobs = await withRetry(() => listBlobs(src));
    const tgt = targetSvc.getContainerClient(name);
    const tgtBlobs = (await withRetry(() => tgt.exists())) ? await withRetry(() => listBlobs(tgt)) : [];
    const tgtMap = new Map(tgtBlobs.map((b) => [b.name, b]));
    let missing = 0;
    let sizeMismatch = 0;
    let typeMismatch = 0;
    for (const b of srcBlobs) {
      const t = tgtMap.get(b.name);
      if (!t) { missing++; continue; }
      if (t.properties?.contentLength !== b.properties?.contentLength) sizeMismatch++;
      if (t.properties?.contentType !== b.properties?.contentType) typeMismatch++;
    }
    const srcBytes = sumBytes(srcBlobs);
    const tgtBytes = sumBytes(tgtBlobs);
    const pass = srcBlobs.length === tgtBlobs.length && srcBytes === tgtBytes && !missing && !sizeMismatch && !typeMismatch;
    if (!pass) ok = false;
    containers.push({
      name, status: pass ? 'OK' : 'ABWEICHUNG',
      sourceCount: srcBlobs.length, targetCount: tgtBlobs.length, sourceBytes: srcBytes, targetBytes: tgtBytes,
      missing, sizeMismatch, typeMismatch,
    });
  }
  return { containers, ok };
}

function walkImages(node, field, host, counts, hostRef) {
  if (typeof node === 'string') {
    if (host && node.toLowerCase().includes(host.toLowerCase())) hostRef.n++;
    return;
  }
  if (Array.isArray(node)) { node.forEach((n) => walkImages(n, field, host, counts, hostRef)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'imageUrl' || k === 'blobName') && !(v && typeof v === 'object')) {
        const key = `${k}:${classifyImageValue(v, host)}`;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      walkImages(v, k, host, counts, hostRef);
    }
  }
}

function randomSample(docs, n) {
  const arr = [...docs];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function fmt(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(', ') || '-';
}

async function inventoryCosmos(db, label, host) {
  console.log(`\n[${label}] Cosmos`);
  for (const def of USER_CONTAINERS) {
    const docs = await readAllDocs(db.container(def.id));
    const byType = {};
    const images = {};
    const hostRef = { n: 0 };
    let copy = 0;
    for (const d of docs) {
      if (shouldCopy(def.id, d)) copy++;
      const t = d._docType ?? '(ohne)';
      byType[t] = (byType[t] ?? 0) + 1;
      if (host) walkImages(d, '', host, images, hostRef);
    }
    console.log(`  ${def.id}: gesamt=${docs.length}, kopiert=${copy}, gefiltert=${docs.length - copy}`);
    if (def.id === 'aiInsights' || Object.keys(byType).some((t) => t !== '(ohne)')) console.log(`    _docType: ${fmt(byType)}`);
    if (host) {
      const imgText = fmt(images);
      if (imgText !== '-' || hostRef.n) console.log(`    Bildfelder: ${imgText}; Strings mit Quell-Storage-Host=${hostRef.n}`);
    }
  }
}

async function inventoryBlobs(svc, label) {
  console.log(`\n[${label}] Blobs`);
  for (const name of BLOB_COPY_CONTAINERS) {
    const c = svc.getContainerClient(name);
    if (!(await withRetry(() => c.exists()))) { console.log(`  ${name}: nicht vorhanden`); continue; }
    const blobs = await withRetry(() => listBlobs(c));
    console.log(`  ${name}: Blobs=${blobs.length}, Bytes=${sumBytes(blobs)}`);
  }
}

async function copyCosmos(srcDb, tgtDb) {
  let failed = 0;
  console.log('\nCosmos-Kopie');
  for (const def of USER_CONTAINERS) {
    const tgt = tgtDb.container(def.id);
    const before = (await withRetry(() => tgt.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll())).resources[0];
    const docs = await readAllDocs(srcDb.container(def.id));
    const selected = docs.filter((d) => shouldCopy(def.id, d));
    let written = 0;
    let fail = 0;
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const results = await Promise.all(selected.slice(i, i + BATCH_SIZE).map(async (d) => {
        try {
          await withRetry(() => tgt.items.upsert(stripSystemFields(d)));
          return true;
        } catch {
          return false;
        }
      }));
      written += results.filter(Boolean).length;
      fail += results.filter((r) => !r).length;
    }
    failed += fail;
    console.log(`  ${def.id}: gelesen=${docs.length}, gefiltert=${docs.length - selected.length}, geschrieben=${written}, fehlgeschlagen=${fail}, Ziel vorher=${before}`);
  }
  return failed;
}

async function verifyCosmos(srcDb, tgtDb, allowExtra) {
  let ok = true;
  console.log('\nCosmos-Verifikation');
  for (const def of USER_CONTAINERS) {
    const srcDocs = (await readAllDocs(srcDb.container(def.id))).filter((d) => shouldCopy(def.id, d));
    const tgtDocs = await readAllDocs(tgtDb.container(def.id));
    const tgtMap = new Map(tgtDocs.map((d) => [docKey(def, d), d]));
    const srcKeys = new Set(srcDocs.map((d) => docKey(def, d)));
    const missing = srcDocs.filter((d) => !tgtMap.has(docKey(def, d))).length;
    const extra = tgtDocs.filter((d) => !srcKeys.has(docKey(def, d))).length;
    const sample = randomSample(srcDocs, SAMPLE_SIZE);
    const diff = sample.filter((d) => {
      const t = tgtMap.get(docKey(def, d));
      return !t || !isDeepStrictEqual(stripSystemFields(d), stripSystemFields(t));
    }).length;
    const pass = missing === 0 && diff === 0 && (extra === 0 || allowExtra);
    if (!pass) ok = false;
    console.log(`  ${def.id}: ${pass ? 'OK' : 'ABWEICHUNG'} Quelle(gefiltert)=${srcDocs.length}, Ziel=${tgtDocs.length}, fehlend=${missing}, mehr=${extra}, Stichproben=${sample.length}, Stichproben-Abweichung=${diff}`);
  }
  return ok;
}

async function clearTarget(tgtDb, tgtSvc) {
  console.log('\nclear (nur Ziel)');
  let failed = 0;
  for (const def of USER_CONTAINERS) {
    const c = tgtDb.container(def.id);
    const docs = await readAllDocs(c);
    let deleted = 0;
    for (const d of docs) {
      try {
        await withRetry(() => c.item(d.id, partitionValue(def, d)).delete());
        deleted++;
      } catch {
        failed++;
      }
    }
    console.log(`  ${def.id}: geloescht=${deleted}`);
  }
  for (const name of BLOB_CLEAR_CONTAINERS) {
    const cc = tgtSvc.getContainerClient(name);
    if (!(await withRetry(() => cc.exists()))) { console.log(`  ${name}: nicht vorhanden`); continue; }
    let deleted = 0;
    for (const b of await withRetry(() => listBlobs(cc))) {
      try {
        await withRetry(() => cc.getBlockBlobClient(b.name).deleteIfExists());
        deleted++;
      } catch {
        failed++;
      }
    }
    console.log(`  ${name}: Blobs geloescht=${deleted}`);
  }
  return failed;
}

function readSides(mode, env) {
  const need = (k) => { if (!env[k]) throw new UserError(`Fehlende Umgebungsvariable: ${k}`); return env[k]; };
  const side = (prefix) => ({
    cosmos: parseCosmosConn(need(`${prefix}_COSMOS_CONN`), `${prefix}_COSMOS_CONN`),
    storage: parseStorageConn(need(`${prefix}_STORAGE_CONN`), `${prefix}_STORAGE_CONN`),
  });
  const hasSide = (p) => Boolean(env[`${p}_COSMOS_CONN`] && env[`${p}_STORAGE_CONN`]);
  let src;
  let tgt;
  if (mode === 'clear') {
    tgt = side('TGT');
  } else if (mode === 'inventory') {
    if (!hasSide('SRC') && !hasSide('TGT')) throw new UserError('Inventur braucht SRC_* und/oder TGT_* (Cosmos und Storage).');
    if (hasSide('SRC')) src = side('SRC');
    if (hasSide('TGT')) tgt = side('TGT');
  } else {
    src = side('SRC');
    tgt = side('TGT');
  }
  assertSafeEnds({
    sourceCosmosEndpoint: src?.cosmos.endpoint,
    sourceStorageAccount: src?.storage.account,
    targetCosmosEndpoint: tgt?.cosmos.endpoint,
    targetStorageAccount: tgt?.storage.account,
  });
  return { src, tgt };
}

const dbOf = (cosmos) => new CosmosClient({ endpoint: cosmos.endpoint, key: cosmos.key }).database(DB_NAME);
const svcOf = (storage) => BlobServiceClient.fromConnectionString(storage.conn);

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (!['inventory', 'copy', 'verify', 'clear'].includes(mode)) {
    throw new UserError('Modus: inventory | copy | verify [--allow-extra] | clear --yes');
  }
  if (mode === 'clear' && !args.includes('--yes')) throw new UserError('clear erfordert --yes.');

  const { src, tgt } = readSides(mode, process.env);
  const srcDb = src && dbOf(src.cosmos);
  const tgtDb = tgt && dbOf(tgt.cosmos);
  const srcSvc = src && svcOf(src.storage);
  const tgtSvc = tgt && svcOf(tgt.storage);
  console.log(`Modus ${mode}: ${src ? SOURCE_COSMOS : '-'} -> ${tgt ? TARGET_COSMOS : '-'}`);

  if (mode === 'inventory') {
    if (src) { await inventoryCosmos(srcDb, 'Quelle', src.storage.host); await inventoryBlobs(srcSvc, 'Quelle'); }
    if (tgt) { await inventoryCosmos(tgtDb, 'Ziel', null); await inventoryBlobs(tgtSvc, 'Ziel'); }
  } else if (mode === 'copy') {
    const docFailed = await copyCosmos(srcDb, tgtDb);
    const blobs = await copyBlobs(srcSvc, tgtSvc);
    console.log('\nBlob-Kopie');
    for (const c of blobs.containers) console.log(`  ${c.name}: ${c.status}, kopiert=${c.copied}, fehlgeschlagen=${c.failed}, Bytes=${c.bytes}`);
    if (docFailed + blobs.failed > 0) process.exitCode = 1;
  } else if (mode === 'verify') {
    const docsOk = await verifyCosmos(srcDb, tgtDb, args.includes('--allow-extra'));
    const blobs = await verifyBlobs(srcSvc, tgtSvc);
    console.log('\nBlob-Verifikation');
    for (const c of blobs.containers) {
      console.log(c.sourceCount === undefined
        ? `  ${c.name}: ${c.status}`
        : `  ${c.name}: ${c.status} Quelle=${c.sourceCount}/${c.sourceBytes}B, Ziel=${c.targetCount}/${c.targetBytes}B, fehlend=${c.missing}, Groessen-Abw.=${c.sizeMismatch}, Content-Type-Abw.=${c.typeMismatch}`);
    }
    console.log(`\nErgebnis: ${docsOk && blobs.ok ? 'PASS' : 'ABWEICHUNG'}`);
    if (!docsOk || !blobs.ok) process.exitCode = 1;
  } else {
    if ((await clearTarget(tgtDb, tgtSvc)) > 0) process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Migration fehlgeschlagen:', safeError(err));
    process.exit(1);
  });
}
