import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  USER_CONTAINERS,
  assertSafeEnds,
  shouldCopy,
  stripSystemFields,
  classifyImageValue,
  parseCosmosConn,
  parseStorageConn,
  copyBlobs,
  verifyBlobs,
  safeError,
} from './migrate-alpha-data.mjs';

const SRC_COSMOS = 'https://cosmos-fittrack-alpha-ppf5sc.documents.azure.com:443/';
const TGT_COSMOS = 'https://cosmos-fittrack-alpha-wcobsd.documents.azure.com:443/';
const DEV_COSMOS = 'https://cosmos-fittrack-dev-hlpqe7.documents.azure.com:443/';
const GOOD = {
  sourceCosmosEndpoint: SRC_COSMOS,
  sourceStorageAccount: 'stfittrackalphappf5sc',
  targetCosmosEndpoint: TGT_COSMOS,
  targetStorageAccount: 'stfittrackalphawcobsd',
};

test('accepts the exact source/target pair', () => {
  assert.equal(assertSafeEnds(GOOD), true);
});

test('rejects dev as source or target', () => {
  assert.throws(() => assertSafeEnds({ ...GOOD, sourceCosmosEndpoint: DEV_COSMOS }), /Quelle Cosmos/);
  assert.throws(() => assertSafeEnds({ ...GOOD, targetCosmosEndpoint: DEV_COSMOS }), /Ziel Cosmos/);
});

test('rejects source equal to target', () => {
  assert.throws(() => assertSafeEnds({ ...GOOD, targetCosmosEndpoint: SRC_COSMOS }), /Ziel Cosmos/);
  assert.throws(() => assertSafeEnds({ ...GOOD, targetStorageAccount: 'stfittrackalphappf5sc' }), /Ziel Storage/);
});

test('rejects old PRODYNA account as target', () => {
  assert.throws(() => assertSafeEnds({ targetCosmosEndpoint: SRC_COSMOS }), /Ziel Cosmos/);
});

test('rejects a single wrong account', () => {
  assert.throws(() => assertSafeEnds({ ...GOOD, sourceStorageAccount: 'stfittrackdev' }), /Quelle Storage/);
  assert.throws(() => assertSafeEnds({ ...GOOD, targetStorageAccount: 'other' }), /Ziel Storage/);
});

test('rejects prefix-only matches', () => {
  assert.throws(() => assertSafeEnds({ targetCosmosEndpoint: 'https://cosmos-fittrack-alpha-abc123.documents.azure.com/' }), /Ziel Cosmos/);
});

test('rejects invalid endpoint', () => {
  assert.throws(() => assertSafeEnds({ ...GOOD, sourceCosmosEndpoint: 'nope' }), /Ungueltiger/);
});

test('accepts a single side (clear target only)', () => {
  assert.equal(assertSafeEnds({ targetCosmosEndpoint: TGT_COSMOS, targetStorageAccount: 'stfittrackalphawcobsd' }), true);
});

test('shouldCopy filters aiInsights to insightFeedback', () => {
  assert.equal(shouldCopy('aiInsights', { _docType: 'insightFeedback' }), true);
  for (const _docType of ['dailyInsight', 'weeklyInsight', 'profileDeletionLock']) {
    assert.equal(shouldCopy('aiInsights', { _docType }), false);
  }
  assert.equal(shouldCopy('aiInsights', { id: 'legacy' }), false);
});

test('shouldCopy copies everything in other containers', () => {
  for (const c of USER_CONTAINERS.map((d) => d.id).filter((id) => id !== 'aiInsights')) {
    assert.equal(shouldCopy(c, { _docType: 'dayMeta' }), true);
    assert.equal(shouldCopy(c, { id: 'x' }), true);
  }
});

test('stripSystemFields removes system fields and keeps _docType and ttl', () => {
  const doc = { id: '1', userId: 'u', _rid: 'a', _self: 'b', _etag: 'c', _attachments: 'd', _ts: 1, _lsn: 2, _docType: 'insightFeedback', ttl: 60 };
  assert.deepEqual(stripSystemFields(doc), { id: '1', userId: 'u', _docType: 'insightFeedback', ttl: 60 });
});

test('classifyImageValue', () => {
  const host = 'stfittrackalphappf5sc.blob.core.windows.net';
  assert.equal(classifyImageValue('u/r/i.jpg', host), 'relativ');
  assert.equal(classifyImageValue(`https://${host}/recipe-images/a.jpg?sig=x`, host), 'absolut-Quellhost');
  assert.equal(classifyImageValue('https://images.openfoodfacts.org/a.jpg', host), 'extern');
  assert.equal(classifyImageValue('data:image/png;base64,AAAA', host), 'sonstig');
  assert.equal(classifyImageValue('', host), 'sonstig');
  assert.equal(classifyImageValue(null, host), 'sonstig');
});

test('connection string parsing extracts accounts without exposing keys in errors', () => {
  const c = parseCosmosConn('AccountEndpoint=https://cosmos-x.documents.azure.com:443/;AccountKey=SECRETKEY==;');
  assert.equal(c.account, 'cosmos-x');
  const s = parseStorageConn('DefaultEndpointsProtocol=https;AccountName=stfoo;AccountKey=SECRETKEY==;EndpointSuffix=core.windows.net');
  assert.equal(s.account, 'stfoo');
  assert.equal(s.host, 'stfoo.blob.core.windows.net');
  assert.throws(() => parseCosmosConn('AccountEndpoint=nope;AccountKey=SECRETKEY=='), (e) => !/SECRETKEY/.test(e.message));
  assert.throws(() => parseStorageConn('garbage SECRETKEY'), (e) => !/SECRETKEY/.test(e.message));
});

test('safeError never echoes foreign error messages', () => {
  assert.doesNotMatch(safeError(new Error('AccountKey=SECRETKEY==')), /SECRETKEY/);
  assert.match(safeError(Object.assign(new Error('x'), { code: 429 })), /429/);
});

function stubContainer(blobs, exists = true) {
  const uploaded = new Map();
  return {
    uploaded,
    exists: async () => exists,
    createIfNotExists: async () => ({}),
    listBlobsFlat: async function* () { for (const b of blobs) yield b; },
    getBlockBlobClient: (name) => ({
      downloadToBuffer: async () => Buffer.from(blobs.find((b) => b.name === name).data),
      uploadData: async (buf, opts) => { uploaded.set(name, { buf, opts }); },
    }),
  };
}

const blob = (name, data, contentType) => ({ name, data, properties: { contentLength: data.length, contentType }, metadata: { m: '1' } });

test('missing source blob container is skipped and reported, not an error', async () => {
  const recipe = stubContainer([blob('u/r/a.jpg', 'abc', 'image/jpeg'), blob('community/b.png', 'de', 'image/png')]);
  const targetRecipe = stubContainer([]);
  const missing = stubContainer([], false);
  const src = { getContainerClient: (n) => (n === 'recipe-images' ? recipe : missing) };
  const targetProduct = stubContainer([]);
  const tgt = { getContainerClient: (n) => (n === 'recipe-images' ? targetRecipe : targetProduct) };

  const res = await copyBlobs(src, tgt);
  assert.equal(res.failed, 0);
  assert.deepEqual(res.containers.map((c) => [c.name, c.status, c.copied]), [
    ['recipe-images', 'kopiert', 2],
    ['product-images', 'Quelle nicht vorhanden', 0],
  ]);
  assert.equal(targetRecipe.uploaded.get('u/r/a.jpg').opts.blobHTTPHeaders.blobContentType, 'image/jpeg');
  assert.deepEqual(targetRecipe.uploaded.get('u/r/a.jpg').opts.metadata, { m: '1' });
  assert.equal(targetProduct.uploaded.size, 0);
});

test('verifyBlobs compares count, bytes and content type; missing source is skipped', async () => {
  const blobs = [blob('a', 'abc', 'image/jpeg')];
  const src = { getContainerClient: (n) => (n === 'recipe-images' ? stubContainer(blobs) : stubContainer([], false)) };
  const okTgt = { getContainerClient: () => stubContainer(blobs) };
  const ok = await verifyBlobs(src, okTgt);
  assert.equal(ok.ok, true);
  assert.equal(ok.containers[1].status, 'Quelle nicht vorhanden');

  const badTgt = { getContainerClient: () => stubContainer([blob('a', 'abc', 'text/plain')]) };
  const bad = await verifyBlobs(src, badTgt);
  assert.equal(bad.ok, false);
  assert.equal(bad.containers[0].typeMismatch, 1);
});

test('USER_CONTAINERS matches backend/src/lib/cosmos.ts without foodProducts', () => {
  const file = fileURLToPath(new URL('../backend/src/lib/cosmos.ts', import.meta.url));
  const source = readFileSync(file, 'utf8');
  const defs = [...source.matchAll(/\{\s*id:\s*'([A-Za-z]+)',\s*partitionKey:\s*'([^']+)'/g)]
    .map(([, id, partitionKey]) => ({ id, partitionKey }))
    .filter((d) => d.id !== 'foodProducts');
  const sort = (a) => [...a].sort((x, y) => x.id.localeCompare(y.id));
  assert.equal(defs.length, 11);
  assert.deepEqual(sort(USER_CONTAINERS), sort(defs));
});
