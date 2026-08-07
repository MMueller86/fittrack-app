#!/usr/bin/env node
// Fails with exit 1 if any source file contains known UTF-8 mojibake sequences.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// UTF-8 bytes of common German/special characters misread as Latin-1
const MOJIBAKE = [
  { pattern: 'Ã¤', original: 'ä' },
  { pattern: 'Ã¶', original: 'ö' },
  { pattern: 'Ã¼', original: 'ü' },
  { pattern: 'ÃŸ', original: 'ß' },
  { pattern: 'Ã„', original: 'Ä' },
  { pattern: 'Ã–', original: 'Ö' },
  { pattern: 'Ãœ', original: 'Ü' },
  { pattern: 'â€"', original: '—' },
  { pattern: 'â€™', original: '\u2019' },
  { pattern: 'â€œ', original: '\u201C' },
  { pattern: 'â€\u009d', original: '\u201D' },
];

const SCAN_DIRS = ['mobile/src', 'shared/lib', 'shared/types', 'backend/src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']);

function* walkFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

let totalErrors = 0;

for (const dir of SCAN_DIRS) {
  const absDir = join(ROOT, dir);
  try { statSync(absDir); } catch { continue; }

  for (const file of walkFiles(absDir)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = relative(ROOT, file).replaceAll('\\', '/');

    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, original } of MOJIBAKE) {
        if (lines[i].includes(pattern)) {
          console.error(`[encoding] ${rel}:${i + 1} — "${pattern}" (expected "${original}")`);
          totalErrors++;
        }
      }
    }
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} encoding error(s) found. Re-save the affected files as UTF-8.`);
  process.exit(1);
} else {
  console.log('Encoding check passed.');
}
