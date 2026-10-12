import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = 'docs/User Stories/Reciepe/';
const prefix = 'B-2_Feedback-Loop_';
const suffix = '_2026-10-09-r3-QA-R1';
const root = process.cwd();
const filename = (label, extension = '.json') => directory + prefix + label + suffix + extension;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (file) => hash(fs.readFileSync(file));
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const baseline = read(filename('Baseline'));
const extension = read(filename('Ownership-Extension'));
const owned = [...baseline.owned, ...extension.files.map((entry) => entry.path)];

function verify(files) {
  for (const entry of files) assert.equal(fileHash(entry.path), entry.sha256, entry.path);
}

function treeFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const file = directoryPath + '/' + entry.name;
    return entry.isDirectory() ? treeFiles(file) : [{ path: file, sha256: fileHash(file) }];
  });
}

function freeze() {
  for (const label of ['Focused-Final', 'Units', 'Typecheck', 'Build']) assert.equal(read(filename(label)).exit, 0, label);
  verify(baseline.files.filter((entry) => !owned.includes(entry.path)));
  verify(baseline.historical);
  const metadata = ['openai', 'satori', 'hyphen', 'sharp', '@resvg/resvg-js', 'vitest', 'typescript'].map((name) => {
    const file = ['node_modules/', 'backend/node_modules/'].map((base) => base + name + '/package.json').find((file) => fs.existsSync(file));
    assert.ok(file, name);
    return { path: file, name, version: read(file).version, sha256: fileHash(file) };
  });
  const files = baseline.files.map(({ path: file }) => ({ path: file, sha256: fileHash(file) }));
  const self = path.relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/');
  files.push({ path: self, sha256: fileHash(self) });
  const runtime = treeFiles('backend/dist');
  const changesFromR2 = baseline.inheritedCandidate.files.filter((entry) => fileHash(entry.path) !== entry.sha256)
    .map((entry) => ({ ...entry, currentSha256: fileHash(entry.path), scope: owned.includes(entry.path) ? 'QA-R1 owned' : 'inherited post-r2; preserved from round baseline' }));
  write(filename('Candidate'), { round: 'QA-R1', createdAt: new Date().toISOString(), head: baseline.head, node: process.version,
    originalRoundBaseline: filename('Baseline'), originalRoundBaselineSha256: fileHash(filename('Baseline')),
    originalB2Baseline: baseline.historical[0], previousCandidate: baseline.historical[1], owned,
    files, runtime, dependencies: metadata, changesFromR2, reviewedScope: 'Only eight declared B-2 deltas; inherited files retained, not automatically accepted for release',
    releaseEligible: false });
  console.log(JSON.stringify({ frozenCandidateSha256: fileHash(filename('Candidate')), files: files.length, runtime: runtime.length, owned: owned.length }));
}

function verifyCandidate() {
  const candidate = read(filename('Candidate'));
  verify(candidate.files);
  verify(candidate.runtime);
  verify(candidate.dependencies);
  return fileHash(filename('Candidate'));
}

function notRun(gate, blockedBy) {
  write(filename(gate), { gate, candidateSha256: fileHash(filename('Candidate')), status: 'NOT_RUN_REQUIRED_LIVE_FAILURE', blockedBy,
    exit: null, counts: { executed: 0, passed: 0, failed: 0, skipped: 0 }, logicalCalls: 0, sdkCalls: 0,
    verified: false, dispatched: false });
}

function gate(label) {
  assert.ok(['F', 'R', 'G'].includes(label));
  const candidateSha256 = verifyCandidate();
  if (label !== 'F') {
    const previous = read(filename(label === 'R' ? 'F' : 'R'));
    assert.equal(previous.exit, 0, 'Stop after required live failure');
    assert.ok(previous.counts.executed > 0 && previous.counts.failed === 0);
    assert.equal(previous.candidateSha256, candidateSha256);
  }
  const report = path.resolve(filename(label + '-Report'));
  const outputPath = filename(label + '-Output', '.txt');
  for (const file of [filename(label), filename(label + '-Started'), outputPath, report]) assert.ok(!fs.existsSync(file), 'Immutable gate already exists: ' + file);
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const args = label === 'G' ? [npm, 'run', 'test:eval', '--workspace=backend', '--']
    : ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts',
      ...(label === 'F' ? ['--testNamePattern', 'preparation prompt version matches fixture expectations|recipePreparation'] : [])];
  args.push('--reporter=default', '--reporter=json', '--outputFile=' + report);
  const start = new Date().toISOString();
  write(filename(label + '-Started'), { gate: label, start, candidateSha256, command: [process.execPath, ...args], runLimit: 1 });
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const end = new Date().toISOString();
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  fs.writeFileSync(outputPath, output, { flag: 'wx' });
  const nativeReport = fs.existsSync(report) ? read(report) : undefined;
  const counts = nativeReport ? { executed: nativeReport.numPassedTests + nativeReport.numFailedTests,
    passed: nativeReport.numPassedTests, failed: nativeReport.numFailedTests, skipped: nativeReport.numPendingTests } : null;
  const record = { gate: label, start, end, candidateSha256, command: [process.execPath, ...args], exit: result.status, signal: result.signal,
    error: result.error?.message, counts, output: outputPath, outputSha256: fileHash(outputPath),
    report: nativeReport ? path.relative(root, report).replaceAll('\\', '/') : null, reportSha256: nativeReport ? fileHash(report) : null };
  write(filename(label), record);
  verifyCandidate();
  console.log(JSON.stringify(record));
  console.log(output.slice(-5000));
  if (result.status !== 0 || !counts || counts.executed === 0 || counts.failed > 0) {
    if (label === 'F') notRun('R', label);
    if (label !== 'G') notRun('G', label);
    process.exitCode = result.status || 1;
  }
}

function reconcile(label) {
  const record = read(filename(label));
  assert.ok(record.output && record.report);
  assert.equal(fileHash(record.output), record.outputSha256);
  assert.equal(fileHash(record.report), record.reportSha256);
  const report = read(record.report);
  const output = fs.readFileSync(record.output, 'utf8');
  const tagged = (tag) => output.split(/\r?\n/u).filter((line) => line.startsWith(tag + ' ')).map((line) => JSON.parse(line.slice(tag.length + 1)));
  const attempts = tagged('Synthetic preparation complete attempt evidence');
  const counters = tagged('Synthetic preparation counts and handler evidence');
  const protections = tagged('Synthetic preparation executed protection assertions');
  const semantics = tagged('Synthetic preparation executed semantic assertions');
  const tests = report.testResults.flatMap((file) => file.assertionResults);
  const fixtures = attempts.map((entry) => {
    const counts = counters.find((counter) => counter.fixture === entry.fixture);
    assert.ok(counts);
    assert.equal(counts.sdkCalls, entry.sdk.length);
    assert.equal(counts.preparationCalls, entry.attempts.length);
    for (const [index, attempt] of entry.attempts.entries()) {
      assert.deepEqual(attempt.original, entry.attempts[0].original);
      if (index > 0) assert.deepEqual(attempt.correction.latestDraft, entry.attempts[index - 1].output);
    }
    const offset = entry.initial.startsWith('forced') ? 1 : 0;
    for (const [index, sdk] of entry.sdk.entries()) {
      assert.deepEqual(JSON.parse(sdk.raw), entry.attempts[index + offset].output);
      assert.equal(sdk.options.maxRetries, 0);
      assert.ok(sdk.options.timeout > 0 && sdk.options.timeout <= 20000 && sdk.options.signalPresent);
      assert.equal(sdk.request.temperature, 0.2);
      assert.equal(sdk.request.max_tokens, 2048);
      assert.equal(sdk.finishReason, 'stop');
    }
    const test = tests.find((test) => test.fullName.includes('[' + entry.fixture + ']'));
    const protection = protections.find((value) => value.fixture === entry.fixture);
    const semantic = semantics.find((value) => value.fixture === entry.fixture);
    assert.ok(test);
    return { ...entry, counts, final: { fit: entry.attempts.at(-1)?.probe?.ok === true,
      protectionAssertionsCompleted: !!protection, independentSemanticAssertionReached: !!protection,
      semanticPassed: !!semantic && test.status === 'passed', testStatus: test.status, failures: test.failureMessages }, protection };
  });
  write(filename(label + '-Reconciliation'), { gate: label, candidateSha256: record.candidateSha256, counts: record.counts,
    logicalCalls: counters.reduce((sum, entry) => sum + entry.preparationCalls, 0), sdkCalls: counters.reduce((sum, entry) => sum + entry.sdkCalls, 0),
    fixtures, allTests: tests.map(({ fullName, status, failureMessages }) => ({ fullName, status, failureMessages })),
    outputSha256: record.outputSha256, reportSha256: record.reportSha256, reconstructedFromNativeOutput: true, newProviderCalls: 0 });
  console.log(JSON.stringify({ gate: label, fixtures: fixtures.map(({ fixture, counts, final }) => ({ fixture, counts, final })) }));
}

const [action, label] = process.argv.slice(2);
if (action === 'freeze') freeze();
else if (action === 'gate') gate(label);
else if (action === 'reconcile') reconcile(label);
else if (action === 'verify') console.log(JSON.stringify({ candidateSha256: verifyCandidate(), foreignVerified: baseline.files.length - owned.length }));
else throw new Error('Expected freeze, gate F|R|G, reconcile F|R|G, or verify');