// Read-only: count log events / repair markers per import-series raw output.
import fs from 'node:fs';

const dir = 'docs/qa/reports/';
for (const [series, count] of [['import-no-lost-or-invented-ingredients', 10], ['import-side-dish-and-serving-actions', 8]]) {
  for (let i = 1; i <= count; i++) {
    const file = `${dir}RECIPE-TARGETED-2026-10-12-${series}-run${String(i).padStart(2, '0')}-Output.txt`;
    const b = fs.readFileSync(file);
    const t = (b[1] === 0 || b[0] === 0xff ? b.toString('utf16le') : b.toString('utf8')).replace(/\x1b\[[0-9;]*m/g, '');
    const sum = {};
    for (const m of t.matchAll(/"event":"([^"]+)"/g)) sum[m[1]] = (sum[m[1]] || 0) + 1;
    const marks = ['RecipeAnalysisContractError', '422', 'references', 'repair', 'correction', 'trackUsage', 'usage'].filter((k) => t.includes(k));
    console.log(series.slice(7, 20), i, JSON.stringify(sum), 'marks=' + marks.join(','), 'len=' + t.length);
  }
}
