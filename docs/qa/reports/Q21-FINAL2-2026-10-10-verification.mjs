import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { loadEvalEnvironment } from '../../../backend/scripts/run-eval.mjs';

const prefix = 'docs/qa/reports/Q21-FINAL2-2026-10-10-';
const report = 'docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md';
const candidatePath = 'docs/User Stories/Reciepe/Q21-CORR2-2026-10-10-candidate.json';
const require = createRequire(import.meta.url);
const npm = resolve(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js');
const vitest = require.resolve('vitest/vitest.mjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const stage = process.argv[2];
const recordPath = `${prefix}${stage}.json`;
assert.ok(!existsSync(recordPath), 'Stage already recorded; no repeat allowed');
const baselinePath = `${prefix}baseline.json`;
const candidate = read(candidatePath);
for (const file of candidate.files) assert.equal(hash(readFileSync(file.path)), file.sha256, file.path);
const unchanged = (allowReport = false) => read(baselinePath).files.filter(file =>
  !(allowReport && file.path === report) && (!existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256));
if (stage === 'baseline') {
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  assert.equal(listing.status, 0);
  const files = [...new Set(listing.stdout.split('\0'))].filter(path => path && existsSync(path) && !path.startsWith(prefix))
    .map(path => ({ path, sha256: hash(readFileSync(path)) }));
  const text = readFileSync(report, 'utf8');
  const result = { format: 'fittrack-q21-final2-baseline-v1', capturedAt: new Date().toISOString(), files,
    candidatePath, candidateSha256: hash(readFileSync(candidatePath)), versions: candidate.versions,
    priorReport: { path: report, text, sha256: hash(readFileSync(report)) } };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ files: files.length, candidateFiles: candidate.files.length, priorReportSha256: result.priorReport.sha256 }));
} else if (stage === 'docsHistory') {
  assert.deepEqual(unchanged(), []);
  const snapshots = read('docs/User Stories/Reciepe/Q21-CORR2-2026-10-10-kb-before.json');
  const file = snapshots.files.find(value => value.path === 'docs/kb/tech/06-ai-integrations.md');
  const blocks = text => [...text.matchAll(/^(#{1,6}) ([^\r\n]+)\r?\n([\s\S]*?)(?=^#{1,6} |$(?![\s\S]))/gmu)];
  const after = blocks(readFileSync(file.path, 'utf8'));
  const selected = blocks(file.text).filter(match => /Historical Preparation v9 Evidence|Preparation v8:|Preparation v7:|Preparation Feedback Loop: Recorded r3 QA-R1/u.test(match[2]));
  assert.equal(selected.length, 4);
  const historical = selected.map(match => {
    const current = after.find(value => value[2] === match[2]);
    assert.equal(current?.[0], match[0], match[2]);
    return { heading: match[2], sha256: hash(Buffer.from(match[0])), byteEquivalent: true };
  });
  const result = { format: 'fittrack-q21-final2-document-history-v1', exit: 0, checkedAt: new Date().toISOString(),
    path: file.path, historical, scope: 'Four selected historical heading blocks; not universal authorship attribution', liveCalls: 0 };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} else if (stage === 'reconcile') {
  assert.deepEqual(unchanged(), []);
  const baseline = read(baselinePath);
  const upstreamPrefix = 'docs/User Stories/Reciepe/Q21-CORR2-2026-10-10-';
  const upstream = read(`${upstreamPrefix}evidence.json`);
  const checked = [];
  const checkHash = (path, expected) => {
    assert.equal(hash(readFileSync(path)), expected, path);
    checked.push(path);
  };
  checkHash(upstream.handoff.path, upstream.handoff.sha256);
  for (const artifact of upstream.artifacts) checkHash(artifact.path, artifact.sha256);
  for (const execution of upstream.executions) {
    checkHash(execution.recordPath, execution.recordSha256);
    checkHash(execution.outputPath, execution.outputSha256);
    if (execution.reportPath) checkHash(execution.reportPath, execution.reportSha256);
  }
  const owned = new Set(candidate.files.map(file => file.path));
  const upstreamBaseline = read(`${upstreamPrefix}baseline.json`);
  const foreign = upstreamBaseline.files.filter(file => !owned.has(file.path));
  for (const file of foreign) checkHash(file.path, file.sha256);
  const snapshots = read(`${upstreamPrefix}kb-before.json`);
  const docs = snapshots.files.map(file => {
    const current = readFileSync(file.path, 'utf8');
    const blocks = text => [...text.matchAll(/^(#{1,6}) ([^\r\n]+)\r?\n([\s\S]*?)(?=^#{1,6} |$(?![\s\S]))/gmu)];
    const currentBlocks = blocks(current);
    const historical = blocks(file.text).filter(match => /2026-\d{2}-\d{2}/u.test(match[2])).map(match => {
      const after = currentBlocks.find(value => value[2] === match[2]);
      const preserved = !!after && after[0] === match[0];
      assert.ok(preserved, `${file.path}: ${match[2]}`);
      return { heading: match[2], byteEquivalent: preserved };
    });
    return { path: file.path, beforeSha256: hash(Buffer.from(file.text)), currentSha256: hash(readFileSync(file.path)), historical };
  });
  const selections = Object.fromEntries(['listPreparation', 'listRecipe', 'listOverall'].map(name => {
    const record = read(`${prefix}${name}.json`);
    checkHash(record.outputPath, record.outputSha256);
    assert.equal(record.exit, 0);
    assert.equal(record.selection.length, { listPreparation: 5, listRecipe: 14, listOverall: 42 }[name]);
    return [name, record.selection];
  }));
  const gates = ['F', 'R', 'G'].map(name => {
    const record = read(`${prefix}${name}.json`);
    checkHash(record.outputPath, record.outputSha256);
    checkHash(record.testReport, record.reportSha256);
    assert.equal(record.allIntendedTestsExecuted, true);
    const results = read(record.testReport);
    const fixtures = record.synthetic.filter(entry => entry.kind === 'preparation semantic evidence').map(entry => {
      const evidence = record.synthetic.filter(value => value.fixture === entry.fixture);
      const counts = evidence.find(value => value.kind === 'preparation counts and handler evidence');
      const attempts = evidence.find(value => value.kind === 'preparation complete attempt evidence');
      const protection = evidence.find(value => value.kind === 'preparation executed protection assertions');
      const semantic = evidence.find(value => value.kind === 'preparation executed semantic assertions');
      const manual = evidence.find(value => value.kind === 'preparation manual content review required');
      const required = /oven/u.test(entry.fixture) ? [1, 3, 6] : /rice/u.test(entry.fixture) ? [1, 4, 5, 6] : /pasta/u.test(entry.fixture) ? [1, 3, 4, 5] : [1, 2, 3];
      const refs = entry.raw.steps.flatMap(value => value.sourceStepOrders);
      const first = entry.raw.steps.map(value => value.sourceStepOrders[0]);
      const baking = /oven/u.test(entry.fixture) ? entry.raw.steps.filter(value => value.sourceStepOrders.includes(6)) : [];
      return { fixture: entry.fixture, savedContext: attempts.attempts[0].original, savedSource: entry.savedSource,
        finalOutput: entry.raw, counts, sourceMatrix: entry.sourceMatrix, exportCoreMatrix: entry.exportCoreMatrix,
        coreReferencePresence: required.map(order => ({ order, present: refs.includes(order) })),
        firstReferences: first, firstReferencesAscending: first.every((value, index) => index === 0 || value > first[index - 1]),
        finalFit: attempts.attempts.at(-1).probe?.ok ?? false,
        protectionAssertionsReached: !!protection, metadataAssertionReached: !!protection,
        metadataPassed: !!protection && entry.raw.totalTimeMinutes === null,
        cookingAssertionsCompleted: !!semantic, manualBranchReached: !!manual,
        ovenBakingText: baking, ovenEndpointPresent: baking.length ? baking.some(value => /bis.*(?:kartoffel|sie).*gar|kartoffel.*gar\s+sind|back\w*.*\bgar\b/iu.test(value.description)) : null,
        humanReview: /oven/u.test(entry.fixture) ? 'NOT_PERFORMED_MANUAL_VALIDATION_REQUIRED' : null,
        attempts: attempts.attempts, sdk: attempts.sdk };
    });
    assert.equal(fixtures.length, 4);
    return { stage: name, exit: record.exit, counts: record.counts, startedAt: record.startedAt, finishedAt: record.finishedAt,
      sdkPreparationCalls: fixtures.reduce((total, value) => total + value.counts.sdkCalls, 0),
      logicalPreparationCalls: fixtures.reduce((total, value) => total + value.counts.preparationCalls, 0),
      allDomainProviderCalls: 'UNVERIFIED_NOT_INSTRUMENTED', fixtures,
      imports: record.synthetic.filter(entry => entry.kind === 'import semantic evidence'),
      suites: results.testResults.map(suite => ({ file: suite.name.split(/[\\/]/u).pop(),
        assertions: suite.assertionResults.map(value => ({ name: value.fullName, status: value.status, failures: value.failureMessages })) })) };
  });
  const original = read('docs/qa/reports/Q21-2026-10-10-baseline.json');
  const categories = Object.fromEntries(Object.entries({ renderer: /^backend\/src\/lib\/instagramRenderer\//u,
    weekly: /^backend\/src\/.*weekly/iu,
    apiProviderQuotaLoopShared: /^(backend\/src\/lib\/(openai|quota|quotaConfig|recipePreparation|recipeAnalyzeValidation|dailyInsightValidation)\.ts|backend\/src\/functions\/(recipes|instagramRecipe)\.ts|shared\/types\/)/u,
  }).map(([name, pattern]) => {
    const files = original.files.filter(file => pattern.test(file.path));
    const changed = files.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256).map(file => file.path);
    assert.deepEqual(changed, []);
    return [name, { checked: files.length, changed }];
  }));
  const focused = read(read(`${prefix}focused.json`).testReport);
  const regressions = focused.testResults.flatMap(suite => suite.assertionResults)
    .filter(value => /CORR2|Q21|supported total|unsupported|cooking core|v14|identity|manifest|fingerprint/iu.test(value.fullName))
    .map(value => ({ name: value.fullName, status: value.status }));
  const prior = read('docs/qa/reports/Q21-CORR1-2026-10-10-reconciliation.json');
  const result = { format: 'fittrack-q21-final2-reconciliation-v1', checkedAt: new Date().toISOString(), exit: 0,
    versions: candidate.versions, retryCounts: candidate.retry_counts, selections, gates, regressions,
    upstreamHashesChecked: [...new Set(checked)], upstreamForeignPreserved: foreign.length, docs,
    reviewBaselineFilesPreserved: baseline.files.length, originalBaselineCategories: categories,
    priorReportSha256: baseline.priorReport.sha256,
    corr1Comparison: prior.gates.map(gate => ({ stage: gate.stage, counts: gate.counts,
      fixtures: gate.fixtures.map(fixture => ({ fixture: fixture.fixture, counts: fixture.counts, finalOutput: fixture.finalOutput,
        metadataPassed: fixture.metadataPassed, ovenEndpointPresent: fixture.ovenEndpointPresent })) })),
    liveGatesAttempted: 3, gateRetries: 0, liveCallsForReconciliation: 0,
    humanOvenReview: 'NOT_PERFORMED_MANUAL_VALIDATION_REQUIRED', decision: 'STOP_NO_THIRD_CANDIDATE_NO_DEPLOY' };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ gates: gates.map(gate => ({ stage: gate.stage, counts: gate.counts,
    sdk: gate.sdkPreparationCalls, logical: gate.logicalPreparationCalls, fixtures: gate.fixtures.map(fixture => ({
      fixture: fixture.fixture, counts: fixture.counts, total: fixture.finalOutput.totalTimeMinutes,
      groups: fixture.finalOutput.steps.map(step => step.sourceStepOrders), endpoint: fixture.ovenEndpointPresent,
      protection: fixture.protectionAssertionsReached, metadata: fixture.metadataPassed, cooking: fixture.cookingAssertionsCompleted,
      steps: fixture.finalOutput.steps })) })), docs, categories, upstreamForeignPreserved: foreign.length,
    regressionAssertions: regressions.length }));
} else if (stage === 'finish' || stage === 'validateReport') {
  assert.deepEqual(unchanged(true), []);
  const baseline = read(baselinePath);
  assert.equal(hash(Buffer.from(baseline.priorReport.text)), baseline.priorReport.sha256);
  const text = readFileSync(report, 'utf8');
  const verdicts = [...text.matchAll(/^- Verdict: `([^`]+)`/gmu)].map(match => match[1]);
  assert.equal(verdicts.length, 1);
  assert.ok(['PASS', 'PASS WITH ISSUES', 'FAIL'].includes(verdicts[0]));
  assert.ok(text.includes('fittrack-qa-v1'));
  const ids = [...text.matchAll(/^\| (AC-\d+|US-10 AC-\d+) \|/gmu)].map(match => match[1]);
  assert.deepEqual(ids, [...Array.from({ length: 10 }, (_, index) => `AC-${index + 1}`), 'US-10 AC-15', 'US-10 AC-16']);
  const findings = text.split(/^Finding key: /mu).slice(1);
  for (const finding of findings) for (const field of ['Plan reference:', 'Acceptance criterion:', 'Description:', 'Criticality:', 'Owner:', 'Evidence:', 'Recommendation:']) assert.ok(finding.includes(field), field);
  if (!findings.length) assert.ok(text.includes('No actionable findings.'));
  for (const link of text.matchAll(/\]\(([^)]+)\)/gu)) assert.ok(existsSync(resolve('docs/qa/reports', decodeURIComponent(link[1].split('#')[0]))), link[1]);
  const env = await loadEvalEnvironment();
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  const paths = [...new Set([...listing.stdout.split('\0').filter(path => path && (path.startsWith(prefix) || path === report)), ...candidate.files.map(file => file.path)])];
  const values = Object.entries(env).filter(([key, value]) => /^AZURE_.*(?:KEY|ENDPOINT)$/u.test(key) && typeof value === 'string' && value.length > 8).map(([, value]) => value);
  for (const path of paths) {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    assert.ok(!content.includes('\uFFFD'), path);
    for (const value of values) assert.ok(!content.includes(value), `Configured value exposure: ${path}`);
  }
  const result = { format: 'fittrack-q21-final2-validation-v1', checkedAt: new Date().toISOString(), exit: 0,
    verdict: verdicts[0], criteria: ids, findings: findings.length, baselineFilesUnchangedExceptReport: baseline.files.length - 1,
    candidateFilesStable: candidate.files.length, priorReportHashVerified: true, reportSha256: hash(readFileSync(report)),
    utf8ScopedSecretScanFiles: paths.length, secretExposure: 'NONE_IN_QA_ARTIFACT_SCOPE', liveCalls: 0 };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} else {
  assert.ok(existsSync(baselinePath));
  assert.deepEqual(unchanged(), []);
  const recipe = 'src/lib/prompts/recipeAnalyze.eval.test.ts';
  const filter = 'preparation prompt version matches fixture expectations|recipePreparation';
  const focus = ['src/lib/recipeAnalyzeValidation.test.ts', 'src/lib/recipePreparation.test.ts',
    'src/lib/openai.recipeAnalyze.test.ts', 'src/lib/openai.daily.test.ts', 'src/functions/recipes.test.ts',
    'src/functions/ai.test.ts', 'src/functions/instagramRecipe.test.ts', 'src/functions/dailyInsight.test.ts',
    'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/test-utils/weeklyInsightEvalSemantics.test.ts',
    'src/lib/prompts/dailyInsightPrompt.test.ts', 'src/lib/prompts/dailyInsightPromptManifest.test.ts',
    'src/lib/dailyInsightValidation.test.ts', 'src/lib/repositories/insightRepository.test.ts'];
  const configs = {
    focused: { cwd: 'backend', tests: true, args: [vitest, 'run', ...focus, '--silent'] },
    units: { tests: true, args: [npm, 'run', 'test', '--workspace=backend', '--', '--silent'] },
    typecheck: { args: [npm, 'run', 'typecheck', '--workspace=backend'] },
    build: { args: [npm, 'run', 'build:verify', '--workspace=backend'] },
    dailyRelease: { args: [npm, 'run', 'verify:daily-insight-prompt', '--workspace=backend'] },
    encoding: { args: ['scripts/check-encoding.mjs'] },
    versionGuards: { cwd: 'backend', tests: true, args: [vitest, 'run', '--config', 'vitest.eval.config.mts', recipe,
      'src/lib/prompts/dailyInsight.eval.test.ts', '--testNamePattern', 'prompt version matches fixture expectations', '--silent'] },
    listPreparation: { cwd: 'backend', list: 5, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
    listRecipe: { cwd: 'backend', list: 14, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
    listOverall: { cwd: 'backend', list: 42, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts'] },
    F: { live: 5, tests: true, args: ['backend/scripts/run-eval.mjs', recipe, '--testNamePattern', filter] },
    R: { live: 14, tests: true, args: ['backend/scripts/run-eval.mjs', recipe] },
    G: { live: 42, tests: true, args: [npm, 'run', 'test:eval', '--workspace=backend', '--'] },
  };
  const config = configs[stage];
  assert.ok(config, 'Unknown stage');
  if (config.live) for (const gate of ['focused', 'units', 'typecheck', 'build', 'dailyRelease', 'encoding', 'versionGuards', 'listPreparation', 'listRecipe', 'listOverall']) {
    const record = read(`${prefix}${gate}.json`);
    assert.equal(record.exit, 0, gate);
    if (record.counts) { assert.equal(record.counts.failed, 0); assert.ok(record.counts.passed > 0); }
    if (record.selection) assert.equal(record.selection.length, { listPreparation: 5, listRecipe: 14, listOverall: 42 }[gate]);
  }
  const outputPath = `${prefix}${stage}-Output.txt`;
  const testReport = `${prefix}${stage}-Report.json`;
  const args = [...config.args];
  if (config.tests) args.push('--reporter=default', '--reporter=json', `--outputFile=${resolve(testReport)}`);
  const env = await loadEvalEnvironment();
  const redact = text => ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].reduce((value, key) => env[key] ? value.split(env[key]).join('[REDACTED]') : value, text);
  const startedAt = new Date().toISOString();
  const cwd = config.cwd ?? '.';
  writeFileSync(recordPath, JSON.stringify({ stage, startedAt, executable: process.execPath, nativeArgs: args, cwd, status: 'STARTED' }, null, 2));
  const execution = spawnSync(process.execPath, args, { cwd: resolve(cwd), env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = redact(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
  writeFileSync(outputPath, output);
  if (existsSync(testReport)) writeFileSync(testReport, redact(readFileSync(testReport, 'utf8')));
  const results = existsSync(testReport) ? read(testReport) : null;
  const counts = results ? { total: results.numTotalTests, passed: results.numPassedTests, failed: results.numFailedTests, skipped: results.numPendingTests } : null;
  const synthetic = output.split(/\r?\n/u).flatMap(line => {
    const match = /Synthetic (preparation|import) (.+?) (\{.*\})/u.exec(line);
    if (!match) return [];
    try { return [{ kind: `${match[1]} ${match[2]}`, ...JSON.parse(match[3]) }]; } catch { return []; }
  });
  const selection = config.list ? JSON.parse(output.slice(output.indexOf('['), output.lastIndexOf(']') + 1)) : null;
  const result = { stage, startedAt, finishedAt: new Date().toISOString(), executable: process.execPath, nativeArgs: args, cwd,
    exit: execution.status, signal: execution.signal, error: execution.error?.message, counts, selection,
    outputPath, outputSha256: hash(readFileSync(outputPath)), testReport: results ? testReport : null,
    reportSha256: results ? hash(readFileSync(testReport)) : null, synthetic,
    allIntendedTestsExecuted: config.live && counts ? counts.passed + counts.failed === config.live : null,
    liveGate: !!config.live, offlineStage: !config.live };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ stage, exit: result.exit, counts, selectionCount: selection?.length, syntheticRecords: synthetic.length,
    allIntendedTestsExecuted: result.allIntendedTestsExecuted, outputPath }));
  if (execution.status !== 0) console.log(output.slice(-6500));
  if (config.list) assert.equal(selection.length, config.list);
  process.exitCode = execution.status ?? 1;
}