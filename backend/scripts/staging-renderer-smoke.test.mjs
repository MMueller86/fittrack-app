import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertPngDimensions, assertResolvedInside } from './staging-renderer-smoke.mjs';

function fakePng(width, height, size = 20_000) {
  const buffer = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test('accepts a 1080x1350 PNG', () => {
  assert.doesNotThrow(() => assertPngDimensions(fakePng(1080, 1350)));
});

test('rejects wrong dimensions, empty output, and non-PNG data', () => {
  assert.throws(() => assertPngDimensions(fakePng(1080, 1080)), /expected 1080x1350/);
  assert.throws(() => assertPngDimensions(Buffer.alloc(0)), /empty or too small/);
  assert.throws(() => assertPngDimensions(Buffer.alloc(20_000)), /signature/);
});

test('rejects a module resolved outside the staging node_modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'staging-smoke-'));
  try {
    mkdirSync(join(root, 'staging', 'node_modules'), { recursive: true });
    writeFileSync(join(root, 'outside.js'), '');
    writeFileSync(join(root, 'staging', 'node_modules', 'inside.js'), '');
    assert.doesNotThrow(() => assertResolvedInside(join(root, 'staging', 'node_modules', 'inside.js'), join(root, 'staging')));
    assert.throws(() => assertResolvedInside(join(root, 'outside.js'), join(root, 'staging')), /outside/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
