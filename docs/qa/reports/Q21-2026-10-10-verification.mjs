import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadEvalEnvironment } from '../../../backend/scripts/run-eval.mjs';

const root = process.cwd();
const directory = 'docs/qa/reports/';
const prefix = `${directory}Q21-2026-10-10-`;
const report = `${directory}PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md`;
const require = createRequire(import.meta.url);
const npm = resolve(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const files = () => spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).stdout.split('\0').filter((path) => path && existsSync(path) && !path.startsWith(prefix)).map((path) => ({ path, sha256: hash(readFileSync(path)) }));
const stage = process.argv[2];
const baselinePath = `${prefix}baseline.json`;
if (stage === 'start') {
  if (existsSync(baselinePath)) throw new Error('Baseline already exists');
  writeFileSync(baselinePath, JSON.stringify({ capturedAt: new Date().toISOString(), files: files(), priorReport: { path: report, text: readFileSync(report, 'utf8'), sha256: hash(readFileSync(report)) } }, null, 2));
  console.log('Baseline and prior Q-21 report preserved.');
} else if (stage === 'finish') {
  const baseline = read(baselinePath);
  const changed = baseline.files.filter((file) => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256);
  const unexpected = changed.filter((file) => file.path !== report);
  const result = { checkedAt: new Date().toISOString(), checkedFiles: baseline.files.length, changed, unexpected, candidateUnchanged: unexpected.length === 0 };
  writeFileSync(`${prefix}preservation.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exitCode = unexpected.length ? 1 : 0;
} else {
  const recipe = 'src/lib/prompts/recipeAnalyze.eval.test.ts';
  const filter = 'preparation prompt version matches fixture expectations|recipePreparation';
  const configs = {
    listPreparation: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
    listRecipe: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--json', '--config', 'vitest.eval.config.mts', recipe] },
    listPreparationSilent: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--silent', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
    listRecipeSilent: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--silent', '--json', '--config', 'vitest.eval.config.mts', recipe] },
    listPreparationDirect: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
    listRecipeDirect: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
    focused: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'run', 'src/lib/recipeAnalyzeValidation.test.ts', 'src/functions/recipes.test.ts', 'src/functions/ai.test.ts', 'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/test-utils/weeklyInsightEvalSemantics.test.ts', '--silent'] },
    units: { args: [npm, 'run', 'test', '--workspace=backend', '--', '--silent'] },
    typecheck: { args: [npm, 'run', 'typecheck', '--workspace=backend'] },
    build: { args: [npm, 'run', 'build:verify', '--workspace=backend'] },
    F: { live: true, args: ['backend/scripts/run-eval.mjs', recipe, '--testNamePattern', filter] },
    R: { live: true, args: ['backend/scripts/run-eval.mjs', recipe] },
    G: { live: true, args: [npm, 'run', 'test:eval', '--workspace=backend', '--'] },
  };
  const config = configs[stage];
  if (!config) throw new Error('Unknown stage');
  const recordPath = `${prefix}${stage}.json`;
  if (existsSync(recordPath)) throw new Error('Stage already attempted; refusing a repeat');
  const outputPath = `${prefix}${stage}-Output.txt`;
  const testReport = `${prefix}${stage}-Report.json`;
  const args = [...config.args];
  if (!stage.startsWith('list') && stage !== 'build' && stage !== 'typecheck') args.push('--reporter=default', '--reporter=json', `--outputFile=${resolve(testReport)}`);
  const startedAt = new Date().toISOString();
  writeFileSync(recordPath, JSON.stringify({ stage, startedAt, status: 'STARTED', args }));
  const env = await loadEvalEnvironment();
  const execution = spawnSync(process.execPath, args, { cwd: resolve(config.cwd ?? '.'), env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  let output = `${execution.stdout ?? ''}\n${execution.stderr ?? ''}`;
  for (const key of ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY']) if (env[key]) output = output.split(env[key]).join('[REDACTED]');
  writeFileSync(outputPath, output);
  const results = existsSync(testReport) ? read(testReport) : null;
  const counts = results ? { total: results.numTotalTests, passed: results.numPassedTests, failed: results.numFailedTests, skipped: results.numPendingTests } : null;
  const synthetic = output.split(/\r?\n/u).flatMap((line) => {
    const match = /Synthetic (preparation|import) (.+?) (\{.*\})/u.exec(line);
    if (!match) return [];
    try { return [{ kind: `${match[1]} ${match[2]}`, ...JSON.parse(match[3]) }]; } catch { return []; }
  });
  const result = { stage, startedAt, finishedAt: new Date().toISOString(), args, cwd: config.cwd ?? '.', exit: execution.status, signal: execution.signal, error: execution.error?.message, counts, outputPath, outputSha256: hash(readFileSync(outputPath)), testReport: results ? testReport : null, synthetic };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ stage, exit: execution.status, counts, syntheticRecords: synthetic.length, outputPath }));
  if (stage.startsWith('list')) console.log(output);
  if (execution.status !== 0) console.log(output.slice(-6500));
  process.exitCode = execution.status ?? 1;
}