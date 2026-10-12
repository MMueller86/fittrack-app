import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { stripVTControlCharacters } from 'node:util';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const require = createRequire(import.meta.url);
const ts = require(resolve(root, 'node_modules/typescript'));
const prefix = 'B-19_Recipe-Preparation_';
const date = '2026-10-09';
const artifact = (name, extension = 'json') => resolve(directory, `${prefix}${name}_${date}.${extension}`);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
const files = [
  'backend/src/lib/openai.ts', 'backend/src/lib/prompts/recipeAnalyze.ts',
  'backend/src/lib/recipeAnalyzeValidation.ts', 'backend/src/lib/recipeAnalyzeValidation.test.ts',
  'backend/src/functions/recipes.ts', 'backend/src/functions/recipes.test.ts',
  'backend/src/functions/ai.test.ts', 'backend/src/lib/prompts/recipeAnalyze.eval.test.ts',
  'backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts',
];

function summarize(report) {
  const assertions = report.testResults.flatMap((result) => result.assertionResults);
  return {
    executed: assertions.filter((test) => test.status === 'passed' || test.status === 'failed').length,
    pass: assertions.filter((test) => test.status === 'passed').length,
    fail: assertions.filter((test) => test.status === 'failed').length,
    skip: assertions.filter((test) => test.status === 'pending' || test.status === 'skipped').length,
    failures: assertions.filter((test) => test.status === 'failed').map((test) => ({
      name: test.fullName, messages: test.failureMessages,
    })),
  };
}

function declaration(text, name) {
  const source = ts.createSourceFile('snapshot.ts', text, ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!found) throw new Error(`Missing protected declaration: ${name}`);
  return found;
}

function capture(start, protectedFiles) {
  const snapshots = files.map((path) => {
    const original = readFileSync(resolve(start, path));
    const current = readFileSync(resolve(root, path));
    return { path, beforeSha256: digest(original), afterSha256: digest(current) };
  });
  const protectedResults = protectedFiles.map(({ path, hash }) => ({
    path, beforeSha256: hash.toLowerCase(), afterSha256: digest(readFileSync(resolve(root, path))),
  }));
  const invariants = [
    ['backend/src/lib/prompts/recipeAnalyze.ts', 'RECIPE_ANALYZE_SYSTEM_PROMPT'],
    ['backend/src/lib/prompts/recipeAnalyze.ts', 'RECIPE_ANALYZE_PROMPT_VERSION'],
    ['backend/src/lib/openai.ts', 'RECIPE_ANALYZE_SCHEMA'],
    ['backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts', 'RECIPE_ANALYZE_EVAL_FIXTURES'],
    ['backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts', 'RECIPE_PREPARATION_EVAL_FIXTURE'],
  ].map(([path, name]) => ({ path, name, unchanged:
    declaration(readFileSync(resolve(start, path), 'utf8'), name) === declaration(readFileSync(resolve(root, path), 'utf8'), name),
  }));
  const normalization = (text) => {
    const source = ts.createSourceFile('openai.ts', text, ts.ScriptTarget.Latest, true);
    const method = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'analyzeRecipeText');
    return method.body.statements.find((node) => ts.isReturnStatement(node)).getText(source);
  };
  invariants.push({ path: files[0], name: 'analyzeRecipeText normalization', unchanged:
    normalization(readFileSync(resolve(start, files[0]), 'utf8')) === normalization(readFileSync(resolve(root, files[0]), 'utf8')),
  });
  let ownDiff = '';
  for (const path of files) {
    const result = spawnSync('git', ['diff', '--no-index', '--', resolve(start, path), resolve(root, path)], { encoding: 'utf8' });
    if (![0, 1].includes(result.status)) throw new Error(`Diff capture failed: ${path}`);
    ownDiff += result.stdout.split('\n').map((line) => {
      if (line.startsWith('diff --git ')) return `diff --git a/${path} b/${path}`;
      if (line.startsWith('--- ')) return `--- a/${path}`;
      if (line.startsWith('+++ ')) return `+++ b/${path}`;
      return line;
    }).join('\n');
  }
  writeFileSync(artifact('EigenerDiff', 'patch'), ownDiff);
  const reports = ['red', 'compact-green', 'validator-sdk', 'handler-intermediate', 'handler-green', 'focus-green', 'rubric-final', 'full-unit', 'full-unit-final', 'version-guards']
    .filter((name) => existsSync(resolve(start, `${name}.json`)))
    .map((name) => {
      const report = JSON.parse(readFileSync(resolve(start, `${name}.json`), 'utf8'));
      return { name, startTime: report.startTime, ...summarize(report) };
    });
  const evidence = { date, baseline: 'Exact dirty worktree captured before B-19; not HEAD', snapshots, invariants,
    protectedTrackedFiles: protectedResults.length,
    protectedUnchanged: protectedResults.filter((entry) => entry.beforeSha256 === entry.afterSha256).length,
    protectedResults, reports,
    observedGates: { backendTypecheck: { exit: 0 }, backendBuildVerify: { exit: 0 }, encoding: { exit: 0 } },
  };
  writeJson(artifact('OfflineEvidence'), evidence);
  if (invariants.some((entry) => !entry.unchanged) || evidence.protectedUnchanged !== protectedResults.length) {
    throw new Error('Protected boundary changed');
  }
  console.log(JSON.stringify({ invariants, protected: evidence.protectedUnchanged, reports }, null, 2));
}

function live() {
  if (existsSync(artifact('LiveEvidence'))) throw new Error('B-19 live gates already captured; no retry authorized');
  const npmCli = process.env['npm_execpath'];
  if (!npmCli) throw new Error('Invoke live through npm exec so the actual npm CLI is available');
  const candidate = files.map((path) => ({ path, sha256: digest(readFileSync(resolve(root, path))) }));
  const gates = [
    { id: 'F', args: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts', '--testNamePattern', 'preparation prompt version matches fixture expectations|recipePreparation'] },
    { id: 'R', args: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts'] },
    { id: 'G', args: [npmCli, 'run', 'test:eval', '--workspace=backend', '--'] },
  ];
  const evidence = { date, candidate, officialRunner: true, gates: [] };
  writeJson(artifact('LiveEvidence'), evidence);
  for (const gate of gates) {
    const reportPath = artifact(`Live-${gate.id}-Report`);
    const args = [...gate.args, '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`];
    const started = new Date().toISOString();
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    writeFileSync(artifact(`Live-${gate.id}-Output`, 'txt'), output);
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : undefined;
    const counts = report ? summarize(report) : { executed: 0, pass: 0, fail: 0, skip: 0, failures: [] };
    const preparation = report?.testResults.flatMap((file) => file.assertionResults)
      .filter((test) => test.fullName.includes('recipePreparation')) ?? [];
    const preparedExecuted = preparation.filter((test) => ['passed', 'failed'].includes(test.status)).length;
    const missingCredentials = output.includes('missing AZURE_OPENAI');
    const status = result.status === 2 || result.signal || result.error || missingCredentials || !counts.executed || preparedExecuted !== 3
      ? 'UNVERIFIED' : result.status === 0 && counts.fail === 0 ? 'PASS' : 'FAIL';
    const records = output.split(/\r?\n/u).flatMap((line) => {
      const marker = 'Synthetic preparation ';
      if (!line.startsWith(marker)) return [];
      const jsonStart = line.indexOf('{');
      return jsonStart < 0 ? [] : [{ label: line.slice(0, jsonStart).trim(), data: JSON.parse(line.slice(jsonStart)) }];
    });
    const entry = { id: gate.id, command: [process.execPath, ...args], started, finished: new Date().toISOString(),
      exit: result.status, signal: result.signal, status, ...counts, preparedExecuted,
      preparation: preparation.map((test) => ({ name: test.fullName, status: test.status })), records,
    };
    evidence.gates.push(entry);
    writeJson(artifact('LiveEvidence'), evidence);
    console.log(JSON.stringify({ gate: gate.id, exit: entry.exit, status, executed: counts.executed, pass: counts.pass, fail: counts.fail, skip: counts.skip, preparedExecuted }));
  }
  evidence.candidateUnchanged = candidate.every(({ path, sha256 }) => digest(readFileSync(resolve(root, path))) === sha256);
  writeJson(artifact('LiveEvidence'), evidence);
}

function reconcile() {
  const evidence = JSON.parse(readFileSync(artifact('LiveEvidence'), 'utf8'));
  const { validateRecipeExportPreparationOutput } = require(resolve(root, 'backend/dist/backend/src/lib/recipeAnalyzeValidation.js'));
  for (const gate of evidence.gates) {
    const output = stripVTControlCharacters(readFileSync(artifact(`Live-${gate.id}-Output`, 'txt'), 'utf8'));
    gate.reconciledRecords = output.split(/\r?\n/u).flatMap((line) => {
      if (!line.startsWith('Synthetic preparation ')) return [];
      const start = line.indexOf('{');
      return start < 0 ? [] : [{ label: line.slice(0, start).trim(), data: JSON.parse(line.slice(start)) }];
    });
    const rawOutputs = gate.reconciledRecords.filter((record) => record.label === 'Synthetic preparation semantic evidence');
    if (rawOutputs.length !== 3) throw new Error(`Incomplete three-case raw capture: ${gate.id}`);
    gate.postCaptureValidation = rawOutputs.map(({ data }) => ({
      fixture: data.fixture, result: validateRecipeExportPreparationOutput(data.raw, data.savedSource),
    }));
  }
  evidence.captureNote = 'Post-run ANSI stripping recovers all existing raw transcript records. No provider call or candidate edit; these are post-capture validations, not formerly unreached live assertions.';
  writeJson(artifact('LiveEvidence'), evidence);
  console.log(JSON.stringify(evidence.gates.map((gate) => ({
    gate: gate.id, rawCases: gate.postCaptureValidation.length,
    validation: gate.postCaptureValidation.map(({ fixture, result }) => ({ fixture, ok: result.ok, diagnostics: result.diagnostics })),
  })), null, 2));
}

if (process.argv[2] === 'capture') {
  capture(process.argv[3], JSON.parse(readFileSync(0, 'utf8')));
} else if (process.argv[2] === 'live') {
  live();
} else if (process.argv[2] === 'reconcile') {
  reconcile();
} else {
  throw new Error('Expected capture <start-directory>, live or reconcile');
}