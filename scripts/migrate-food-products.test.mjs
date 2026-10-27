import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeTarget } from './migrate-food-products.mjs';

const SRC = 'https://cosmos-fittrack-dev-hlpqe7.documents.azure.com:443/';
const OK = 'https://cosmos-fittrack-alpha-abc123.documents.azure.com:443/';

test('accepts dev source and new alpha target', () => {
  assert.deepEqual(assertSafeTarget(SRC, OK), {
    source: 'cosmos-fittrack-dev-hlpqe7',
    target: 'cosmos-fittrack-alpha-abc123',
  });
});

test('rejects target equal to source', () => {
  assert.throws(() => assertSafeTarget(SRC, SRC), /Quelle/);
});

test('rejects old PRODYNA accounts as target', () => {
  assert.throws(() => assertSafeTarget(SRC, 'https://cosmos-fittrack-alpha-ppf5sc.documents.azure.com:443/'), /gesperrt/);
  assert.throws(() => assertSafeTarget(SRC, 'https://cosmos-fittrack-dev-ppf5sc.documents.azure.com:443/'), /gesperrt/);
});

test('rejects non-alpha target', () => {
  assert.throws(() => assertSafeTarget(SRC, 'https://cosmos-other.documents.azure.com:443/'), /cosmos-fittrack-alpha-/);
});

test('rejects wrong source account', () => {
  assert.throws(() => assertSafeTarget('https://cosmos-fittrack-dev-ppf5sc.documents.azure.com/', OK), /Quelle/);
});

test('rejects invalid endpoint', () => {
  assert.throws(() => assertSafeTarget('nope', OK), /Ungueltiger/);
});
