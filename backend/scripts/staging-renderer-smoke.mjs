#!/usr/bin/env node
// Renders one Instagram PNG with the production-only install in _deploy_staging
// (npm ci --omit=dev) to prove the @napi-rs/canvas native binary loads on this platform.
// Usage: node scripts/staging-renderer-smoke.mjs [stagingDir]

import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXPECTED_WIDTH = 1080;
export const EXPECTED_HEIGHT = 1350;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIN_PNG_BYTES = 10_000;

export function assertPngDimensions(buffer, width = EXPECTED_WIDTH, height = EXPECTED_HEIGHT) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MIN_PNG_BYTES) {
    throw new Error(`PNG is empty or too small (${buffer?.length ?? 0} bytes).`);
  }
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Output is not a PNG (signature mismatch).');
  }
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`PNG is ${actualWidth}x${actualHeight}, expected ${width}x${height}.`);
  }
}

export function assertResolvedInside(resolvedPath, stagingDir) {
  const root = realpathSync(resolve(stagingDir, 'node_modules')) + sep;
  if (!realpathSync(resolvedPath).startsWith(root)) {
    throw new Error(`@napi-rs/canvas resolved outside ${root}: ${resolvedPath}`);
  }
}

async function main() {
  const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const stagingDir = resolve(process.argv[2] ?? resolve(backendRoot, '../_deploy_staging'));
  const distRoot = resolve(stagingDir, 'dist/backend/src/lib/instagramRenderer');
  const sourceImagePath = resolve(backendRoot, 'src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png');

  const stagingRequire = createRequire(resolve(distRoot, 'index.js'));
  assertResolvedInside(stagingRequire.resolve('@napi-rs/canvas'), stagingDir);
  stagingRequire('@napi-rs/canvas');

  const renderer = await import(pathToFileURL(resolve(distRoot, 'index.js')).href);
  const fixtureModule = await import(pathToFileURL(resolve(distRoot, 'fixtures/quarkbroetchen-meta.js')).href);
  const fixture = fixtureModule.quarkbroetchenMetaFixture ?? fixtureModule.quarkbroetchenFixture ?? fixtureModule.default;
  const input = existsSync(fixture.image.path) ? fixture : { ...fixture, image: { path: sourceImagePath } };

  const result = await renderer.renderInstagramRecipe(input);
  if (!result.ok) {
    throw new Error(`Renderer failed: ${JSON.stringify(result.error)}`);
  }
  assertPngDimensions(result.buffer);
  console.log(`Staging renderer smoke passed: ${result.buffer.length} bytes, ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
