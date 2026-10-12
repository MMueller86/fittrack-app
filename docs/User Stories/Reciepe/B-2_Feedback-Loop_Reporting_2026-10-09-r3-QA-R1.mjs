import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require(path.resolve('node_modules/typescript'));
const directory = 'docs/User Stories/Reciepe/';
const prefix = 'B-2_Feedback-Loop_';
const suffix = '_2026-10-09-r3-QA-R1';
const filename = (label, extension = '.json') => directory + prefix + label + suffix + extension;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (file) => hash(fs.readFileSync(file));
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const baseline = read(filename('Baseline'));
const extension = read(filename('Ownership-Extension'));
const originals = [...baseline.files.filter((entry) => entry.base64), ...extension.files];
const owned = originals.map((entry) => entry.path);
const candidate = read(filename('Candidate'));
const candidateSha256 = fileHash(filename('Candidate'));

function verify(files) {
  for (const entry of files) assert.equal(fileHash(entry.path), entry.sha256, entry.path);
}

function reconcile() {
  const gate = read(filename('F'));
  assert.equal(gate.candidateSha256, candidateSha256);
  assert.equal(fileHash(gate.output), gate.outputSha256);
  assert.equal(fileHash(gate.report), gate.reportSha256);
  const report = read(gate.report);
  const output = fs.readFileSync(gate.output, 'utf8');
  const tagged = (tag) => output.split(/\r?\n/u).map((line) => line.replace(/\u001b\[[0-9;]*m/gu, ''))
    .filter((line) => line.startsWith(tag + ' ')).map((line) => JSON.parse(line.slice(tag.length + 1)));
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
      const attempt = entry.attempts[index + offset];
      assert.deepEqual(JSON.parse(sdk.raw), attempt.output);
      assert.equal(sdk.options.maxRetries, 0);
      assert.ok(sdk.options.timeout > 0 && sdk.options.timeout <= 20000 && sdk.options.signalPresent);
      assert.equal(sdk.request.temperature, 0.2);
      assert.equal(sdk.request.max_tokens, 2048);
      assert.equal(sdk.finishReason, 'stop');
      const input = JSON.parse(sdk.request.messages[1].content);
      assert.deepEqual(input, attempt.correction ? { originalPreparation: attempt.original, ...attempt.correction } : attempt.original);
    }
    const matches = tests.filter((test) => test.fullName.includes(entry.fixture.slice(0, 25)));
    assert.equal(matches.length, 1, 'Unique native test prefix for ' + entry.fixture);
    const test = matches[0];
    const protection = protections.find((value) => value.fixture === entry.fixture);
    const semantic = semantics.find((value) => value.fixture === entry.fixture);
    const finalProbe = entry.attempts.at(-1)?.probe;
    const validator = require(path.resolve('backend/dist/backend/src/lib/recipeAnalyzeValidation.js'));
    const validation = validator.validateRecipeExportPreparationOutput(entry.attempts.at(-1)?.output, entry.attempts[0].original.steps);
    return { ...entry, counts, nativeTestName: test.fullName, final: { fit: finalProbe?.ok === true,
      protectionAssertionsCompleted: !!protection, independentSemanticAssertionReached: !!protection,
      semanticPassed: !!semantic && test.status === 'passed', testStatus: test.status, failures: test.failureMessages,
      structuralErrors: validation.ok ? [] : validation.diagnostics, finalProbe }, protection };
  });
  assert.equal(fixtures.length, 4);
  const result = { gate: 'F', candidateSha256, counts: gate.counts,
    logicalCalls: counters.reduce((sum, entry) => sum + entry.preparationCalls, 0),
    sdkCalls: counters.reduce((sum, entry) => sum + entry.sdkCalls, 0), fixtures,
    allTests: tests.map(({ fullName, status, failureMessages }) => ({ fullName, status, failureMessages })),
    outputSha256: gate.outputSha256, reportSha256: gate.reportSha256, reconstructedFromNativeOutput: true, newProviderCalls: 0,
    reportingCorrection: 'Frozen runner reconcile exited1 before writing: exact bracket matching did not handle Vitest quoted/truncated titles. The first reporting-only reconcile also exited1 before writing because two raw lines begin with ANSI color resets. This tool strips only ANSI colors for parsing and verifies a unique 25-character fixture prefix. Original raw bytes/hashes retained; no gate rerun or candidate edit.' };
  write(filename('F-Reconciliation'), result);
  console.log(JSON.stringify({ logicalCalls: result.logicalCalls, sdkCalls: result.sdkCalls,
    fixtures: fixtures.map(({ fixture, counts, final }) => ({ fixture, counts, fit: final.fit, fidelityReached: final.independentSemanticAssertionReached, fidelityPassed: final.semanticPassed })) }));
}

function selectedTests(text, label, finding) {
  const source = ts.createSourceFile('snapshot.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const container = source.statements.find((statement) => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
    ts.isStringLiteral(statement.expression.arguments[0]) && statement.expression.arguments[0].text === label);
  assert.ok(container, label);
  const callback = container.expression.arguments.at(-1);
  assert.ok(ts.isArrowFunction(callback) && ts.isBlock(callback.body));
  const removals = callback.body.statements.filter((statement) => {
    const content = statement.getText(source);
    if (!content.includes('QA-R1') && !/^function (?:pastaOutput|doughOutput)\b/u.test(content)) return false;
    const owner = label === 'B-2 bounded Preparation loop'
      ? /unknown-key-only|nonstring/u.test(content) ? 'Q1-01' : content.includes('font metadata') ? 'Q1-02' : 'Q1-03'
      : label === 'B-19 three saved-source semantic rubrics'
        ? /doughOutput|RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE/u.test(content) ? 'Q1-05' : 'Q1-04'
        : 'Q1-01';
    return owner !== finding;
  }).sort((left, right) => right.pos - left.pos);
  for (const statement of removals) text = text.slice(0, statement.getFullStart()) + text.slice(statement.end);
  return text;
}

function findingSnapshot(file, before, after, finding) {
  if (file.endsWith('/recipePreparation.ts')) {
    const filter = "    if (diagnostic.code === 'unrecognized_keys') continue;\n";
    if (finding === 'Q1-01') return before.replace('  for (const diagnostic of diagnostics) {\n', '  for (const diagnostic of diagnostics) {\n' + filter);
    if (finding === 'Q1-02') return after.replace(filter, '');
  }
  if (file.endsWith('/recipePreparation.test.ts') && ['Q1-01', 'Q1-02', 'Q1-03'].includes(finding)) {
    let selected = selectedTests(after, 'B-2 bounded Preparation loop', finding);
    if (finding !== 'Q1-03') selected = selected.replace(/^import .*from '\.\/prompts\/recipeAnalyze(?:\.eval\.fixtures)?';\r?\n/gmu, '');
    return selected;
  }
  if (file.endsWith('/recipes.test.ts') && ['Q1-01', 'Q1-03'].includes(finding)) {
    const selected = selectedTests(after, 'POST /recipes/{id}/export-view/prepare', finding);
    return finding === 'Q1-01' ? selected.replace("prompt_version: 'v6'", "prompt_version: 'v5'") : selected;
  }
  if (file.endsWith('/recipeAnalyzeValidation.test.ts') && ['Q1-04', 'Q1-05'].includes(finding)) {
    const selected = selectedTests(after, 'B-19 three saved-source semantic rubrics', finding);
    return finding === 'Q1-04' ? selected.replace(', RECIPE_PREPARATION_FORCED_DOUGH_FIXTURE }', ' }') : selected;
  }
  if (file.endsWith('/recipeAnalyze.eval.fixtures.ts') && ['Q1-04', 'Q1-05'].includes(finding)) {
    const oldLine = before.split('\n').find((line) => line.includes("description: 'cook pasta independently'"));
    const newLine = after.split('\n').find((line) => line.includes("description: 'cook pasta independently'"));
    assert.ok(oldLine && newLine);
    return finding === 'Q1-04' ? before.replace(oldLine, newLine) : after.replace(newLine, oldLine);
  }
  if (finding === 'Q1-03' && ['/recipeAnalyze.ts', '/recipeAnalyze.eval.test.ts', '/ai.test.ts'].some((ending) => file.endsWith(ending))) return after;
  return before;
}

function patches() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fittrack-qa-r1-'));
  const patch = (file, before, after) => {
    if (before === after) return '';
    const original = path.join(temporary, 'before');
    const current = path.join(temporary, 'after');
    fs.writeFileSync(original, before);
    fs.writeFileSync(current, after);
    const result = spawnSync('git', ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--binary', original, current], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    return result.stdout.split('\n').map((line) => line.startsWith('diff --git ') ? `diff --git a/${file} b/${file}`
      : line.startsWith('--- ') ? `--- a/${file}` : line.startsWith('+++ ') ? `+++ b/${file}` : line).join('\n');
  };
  try {
    const records = originals.map((entry) => ({ path: entry.path, before: Buffer.from(entry.base64, 'base64').toString('utf8'),
      after: fs.readFileSync(entry.path, 'utf8'), beforeSha256: entry.sha256, afterSha256: fileHash(entry.path) }));
    fs.writeFileSync(filename('Owned-Diff', '.patch'), records.map((entry) => patch(entry.path, entry.before, entry.after)).join(''), { flag: 'wx' });
    const findings = ['Q1-01', 'Q1-02', 'Q1-03', 'Q1-04', 'Q1-05'].map((finding, index) => {
      const snapshots = records.map((entry) => ({ ...entry, selected: findingSnapshot(entry.path, entry.before, entry.after, finding) }));
      const file = filename(finding + '-Owned-Diff', '.patch');
      fs.writeFileSync(file, snapshots.map((entry) => patch(entry.path, entry.before, entry.selected)).join(''), { flag: 'wx' });
      assert.ok(fs.statSync(file).size > 0, finding);
      return { finding, stableKey: 'FT-QA-2026-08' + (index + 1), patch: file, sha256: fileHash(file),
        base: 'Immutable round starting worktree, not HEAD; independent finding projection, companion tests split by TypeScript AST',
        files: snapshots.filter((entry) => entry.before !== entry.selected).map((entry) => ({ path: entry.path,
          beforeSha256: entry.beforeSha256, findingSnapshotSha256: hash(entry.selected), finalSha256: entry.afterSha256 })) };
    });
    write(filename('Ownership'), { candidateSha256, baselineSha256: fileHash(filename('Baseline')), extensionSha256: fileHash(filename('Ownership-Extension')),
      aggregate: { path: filename('Owned-Diff', '.patch'), sha256: fileHash(filename('Owned-Diff', '.patch')) }, findings,
      files: records.map(({ path: file, beforeSha256, afterSha256 }) => ({ path: file, beforeSha256, afterSha256 })),
      inheritedDiff: 'Retained verbatim in round Baseline.inheritedTrackedDiff; all original/resume/r2 patches remain unchanged' });
    const reverse = spawnSync('git', ['apply', '--reverse', '--check', filename('Owned-Diff', '.patch')], { encoding: 'utf8' });
    write(filename('Patch-Audit'), { command: ['git', 'apply', '--reverse', '--check', filename('Owned-Diff', '.patch')], exit: reverse.status,
      output: (reverse.stdout ?? '') + (reverse.stderr ?? ''), appliedToWorktree: false, candidateSha256 });
    assert.equal(reverse.status, 0, reverse.stderr);
    console.log(JSON.stringify({ owned: records.length, findingPatches: findings.length, reverseCheck: reverse.status }));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function preservation() {
  verify(baseline.files.filter((entry) => !owned.includes(entry.path)));
  verify(baseline.historical);
  verify(candidate.files);
  verify(candidate.runtime);
  verify(candidate.dependencies);
  const oldManifest = read(directory + prefix + 'Artifact-Manifest_2026-10-09-r2-completion.json');
  for (const entry of oldManifest.artifacts) assert.equal(fileHash(fs.existsSync(entry.path) ? entry.path : directory + entry.path), entry.sha256);
  const entries = fs.readdirSync(directory).filter((name) => name.startsWith(prefix) && name.includes(suffix) && !name.includes('Artifact-Manifest'))
    .map((name) => ({ path: directory + name, sha256: fileHash(directory + name) }));
  write(filename('Preservation'), { candidateSha256, foreignFilesVerified: baseline.files.length - owned.length,
    candidateFilesVerified: candidate.files.length, runtimeFilesVerified: candidate.runtime.length, historicalArtifactsVerified: oldManifest.artifacts.length,
    historical: baseline.historical, owned, privateSettingsRead: false, noDeployment: true, noD1Edits: true, noQaOrRegisterEdits: true,
    exclusions: 'Gitignored dependencies/build caches/private settings are not part of the source baseline; installed dependency metadata and frozen runtime hashes checked separately',
    newArtifacts: entries });
  console.log(JSON.stringify({ foreignVerified: baseline.files.length - owned.length, candidateFiles: candidate.files.length,
    runtime: candidate.runtime.length, historicalArtifacts: oldManifest.artifacts.length }));
}

const [action] = process.argv.slice(2);
if (action === 'reconcile') reconcile();
else if (action === 'patches') patches();
else if (action === 'preservation') preservation();
else throw new Error('Expected reconcile, patches or preservation');