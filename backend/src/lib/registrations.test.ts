// Verify that every function module in ./functions/ is imported by index.ts.
// Prevents 404 bugs caused by forgetting to register a new route.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

describe('index.ts — function registration', () => {
  const srcDir = resolve(__dirname, '..');
  const indexContent = readFileSync(resolve(srcDir, 'index.ts'), 'utf-8');
  const functionFiles = readdirSync(resolve(srcDir, 'functions'))
    .filter((f) => f.endsWith('.ts') && !f.includes('.test.'));

  it.each(functionFiles)('imports ./functions/%s', (file) => {
    const moduleName = file.replace(/\.ts$/, '');
    const importPattern = `'./functions/${moduleName}'`;
    expect(indexContent).toContain(importPattern);
  });
});
