// QA helper: aggregates the raw live-eval outputs of the targeted series (read-only, no provider calls).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prefix = 'RECIPE-TARGETED-2026-10-12-';
const read = (file) => {
  const buffer = fs.readFileSync(path.join(dir, file));
  return buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString('utf16le') : buffer.toString('utf8');
};
const jsonAfter = (text, label) => [...text.matchAll(new RegExp(`${label} (\\{.*\\})`, 'gu'))].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);

const result = {};
for (const series of ['dough-forced', 'oven-seven-steps', 'import-no-lost-or-invented-ingredients', 'import-side-dish-and-serving-actions', 'full']) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${prefix}${series}-run`) && f.endsWith('-Output.txt')).sort();
  result[series] = files.map((file) => {
    const text = read(file);
    const lines = text.replace(/\x1b\[[0-9;]*m/gu, '').split(/\r?\n/u);
    const tests = lines.filter((l) => /^\s*\S+\s+src\/lib\/prompts\/recipeAnalyze\.eval\.test\.ts >/u.test(l) && /\d+ms\s*$/u.test(l))
      .map((l) => ({ passed: /^\s*\S*[âœ“âœ”]|Ã”Â£Ã´/u.test(l), ms: Number(/(\d+)ms\s*$/u.exec(l)[1]) }));
    const summary = lines.find((l) => /^\s*Tests\s/u.test(l))?.trim();
    const counts = jsonAfter(text, 'Synthetic preparation counts and handler evidence').map((c) => ({ fixture: c.fixture, sdkCalls: c.sdkCalls, logicalCalls: c.preparationCalls, usageCalls: c.usageCalls, http: c.status, lengths: c.lengths }));
    const semantic = jsonAfter(text, 'Synthetic preparation semantic evidence').map((s) => ({ fixture: s.fixture, texts: s.raw?.steps?.map((step) => step.description) }));
    const importEvidence = jsonAfter(text, 'Synthetic import semantic evidence').map((s) => ({ fixture: s.fixture, sourceStep8: s.source?.find((step) => step.order === 8)?.description, exportCount: s.export?.length }));
    return { file: file.replace(prefix, ''), summary, tests: series === 'full' ? { count: tests.length, failed: tests.filter((t) => !t.passed).length, maxMs: Math.max(0, ...tests.map((t) => t.ms)) } : tests, counts, semantic, importEvidence, http422: /status":422|handler\.response\.failure/u.test(text) };
  });
}
fs.writeFileSync(path.join(dir, `${prefix}aggregate.json`), JSON.stringify(result, null, 1));
console.log('written', Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length])));

