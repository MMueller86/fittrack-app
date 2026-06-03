#!/usr/bin/env node
// scripts/verify-build.mjs
//
// Two checks after every build:
//
// 1. ERR_MODULE_NOT_FOUND — catches value imports from '@fittrack/shared'
//    that survive into compiled JS. The @azure/functions package silently
//    skips registrations outside of `func start` (test-mode warnings), so
//    Node loads the file fine during require(), but the real Worker would
//    throw at startup.
//
// 2. Duplicate function IDs — Azure Functions throws
//    "A function with id X has already been registered" at Worker startup.
//    The @azure/functions package is in test-mode outside of `func start`
//    and just logs warnings instead of throwing, so the duplicate is
//    invisible to require() calls. We catch it by scanning TypeScript source
//    files for duplicate app.http/app.get/… registration IDs statically.
//
// Run: node scripts/verify-build.mjs
// Called by: npm run build:verify

import { createRequire } from 'module';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../dist/backend/src');
const srcRoot  = path.resolve(__dirname, '../src');

const require = createRequire(import.meta.url);

let failed = false;

// ---------------------------------------------------------------------------
// Check 1: ERR_MODULE_NOT_FOUND
// ---------------------------------------------------------------------------

async function collectJsFiles(dir, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsFiles(full, results);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      results.push(full);
    }
  }
  return results;
}

async function checkModuleResolution() {
  const files = await collectJsFiles(distRoot);
  for (const full of files) {
    try {
      require(full);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.error(`❌  ERR_MODULE_NOT_FOUND in ${path.relative(distRoot + '/..', full)}`);
        console.error(`    ${err.message}`);
        failed = true;
      }
      // Ignore other runtime errors (missing env vars, etc.)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: Duplicate Azure Function IDs (static scan of TypeScript source)
// ---------------------------------------------------------------------------
// Matches: app.http('my-id', ...) or app.get('my-id', ...) etc.
const REGISTRATION_RE = /\bapp\.\w+\(\s*['"]([^'"]+)['"]/g;

async function collectTsFiles(dir, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTsFiles(full, results);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

async function checkDuplicateFunctionIds() {
  const files = await collectTsFiles(srcRoot);
  // Map from function id → first file that registered it
  const seen = new Map();

  for (const full of files) {
    const src = await readFile(full, 'utf8');
    for (const match of src.matchAll(REGISTRATION_RE)) {
      const id = match[1];
      const rel = path.relative(srcRoot, full);
      if (seen.has(id)) {
        console.error(`❌  Duplicate function ID "${id}"`);
        console.error(`    First:  ${seen.get(id)}`);
        console.error(`    Second: ${rel}`);
        failed = true;
      } else {
        seen.set(id, rel);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run both checks
// ---------------------------------------------------------------------------

console.log('Check 1: Module resolution (ERR_MODULE_NOT_FOUND)…');
await checkModuleResolution();

console.log('Check 2: Duplicate Azure Function IDs…');
await checkDuplicateFunctionIds();

if (failed) {
  console.error('\nBuild verification FAILED. See errors above.');
  process.exit(1);
} else {
  console.log('✅  All checks passed.');
}
