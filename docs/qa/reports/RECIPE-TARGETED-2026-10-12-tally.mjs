// Read-only tally of RECIPE-TARGETED-2026-10-12 raw outputs (UTF-16 PowerShell captures).
import fs from 'node:fs';

const dir = 'docs/qa/reports/';
const read = (file) => {
  const b = fs.readFileSync(dir + file);
  const text = (b[0] === 0xff && b[1] === 0xfe) || b[1] === 0 ? b.toString('utf16le') : b.toString('utf8');
  return text.replace(/^\uFEFF/, '').replace(/\x1b\[[0-9;]*m/g, '');
};
const series = process.argv[2];
const count = Number(process.argv[3]);
for (let i = 1; i <= count; i++) {
  const file = `RECIPE-TARGETED-2026-10-12-${series}-run${String(i).padStart(2, '0')}-Output.txt`;
  if (!fs.existsSync(dir + file)) { console.log(`run${i}: MISSING`); continue; }
  const t = read(file);
  const tests = (t.match(/^ *Tests .*$/m) || [''])[0].trim();
  const logical = (t.match(/"logicalCall":\d+/g) || []).length;
  const sdk = (t.match(/"sdkCalls":\d+/g) || []).join(',');
  const outputs = [...t.matchAll(/"output":\{"version":1[\s\S]*?"probe"/g)];
  const cheese = outputs.map((m) => [...m[0].matchAll(/"description":"(.*?)"/g)].map((x) => x[1]).filter((s) => /K.{1,4}se/.test(s)).join(' / '));
  const flags = ['422', 'RecipeAnalysisContractError', 'refs', 'repair', 'usage.', 'timeout', 'AssertionError'].filter((k) => t.includes(k));
  console.log(`run${i}: ${tests} | logicalCallMarkers=${logical} sdk=${sdk} | outputs=${outputs.length} | flags=${flags.join(',')}`);
  cheese.forEach((c) => console.log('   cheese:', c));
}
