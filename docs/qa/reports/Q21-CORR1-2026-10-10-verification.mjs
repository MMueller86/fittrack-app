import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadEvalEnvironment } from '../../../backend/scripts/run-eval.mjs';

const prefix = 'docs/qa/reports/Q21-CORR1-2026-10-10-';
const report = 'docs/qa/reports/PLAN_US-10_Recipe-Export-Preparation_Vereinfachung_2026-10-09-v21.md';
const require = createRequire(import.meta.url);
const npm = resolve(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const stage = process.argv[2];
const baselinePath = `${prefix}baseline.json`;
if (stage === 'start') {
  if (existsSync(baselinePath)) throw new Error('Baseline already exists');
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error('Cannot capture workspace baseline');
  const files = listing.stdout.split('\0').filter(path => path && existsSync(path) && !path.startsWith(prefix))
    .map(path => ({ path, sha256: hash(readFileSync(path)) }));
  writeFileSync(baselinePath, JSON.stringify({ capturedAt: new Date().toISOString(), files,
    priorReport: { path: report, text: readFileSync(report, 'utf8'), sha256: hash(readFileSync(report)) } }, null, 2));
  console.log(JSON.stringify({ baselinePath, files: files.length, priorReportPreserved: true }));
} else if (stage === 'finish') {
  const baseline = read(baselinePath);
  const changed = baseline.files.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256);
  const unexpected = changed.filter(file => file.path !== report);
  const result = { checkedAt: new Date().toISOString(), checkedFiles: baseline.files.length, changed, unexpected,
    candidateUnchanged: unexpected.length === 0 };
  writeFileSync(`${prefix}preservation.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exitCode = unexpected.length ? 1 : 0;
} else if (stage === 'validateReport') {
  const text = readFileSync(report, 'utf8');
  const verdicts = [...text.matchAll(/^- Verdict: `([^`]+)`/gmu)].map(match => match[1]);
  if (verdicts.length !== 1 || verdicts[0] !== 'FAIL' || !text.includes('fittrack-qa-v1')) throw new Error('Invalid report format/verdict');
  const ids = [...text.matchAll(/^\| (AC-\d+|US-10 AC-\d+) \|/gmu)].map(match => match[1]);
  const expected = [...Array.from({ length: 10 }, (_, index) => `AC-${index + 1}`), 'US-10 AC-15', 'US-10 AC-16'];
  if (ids.length !== 12 || expected.some(id => ids.filter(value => value === id).length !== 1)) throw new Error('Incomplete criteria matrix');
  const findings = text.split(/^Finding key: /mu).slice(1);
  for (const finding of findings) for (const field of ['Plan reference:', 'Acceptance criterion:', 'Description:', 'Criticality:', 'Owner:', 'Evidence:', 'Recommendation:']) {
    if (!finding.includes(field)) throw new Error(`Missing finding field: ${field}`);
  }
  const links = [...text.matchAll(/\]\(([^)]+)\)/gu)].map(match => match[1]).filter(link => !/^https?:/u.test(link));
  for (const link of links) if (!existsSync(resolve('docs/qa/reports', decodeURIComponent(link.split('#')[0])))) throw new Error(`Broken report link: ${link}`);
  const baseline = read(baselinePath);
  if (hash(Buffer.from(baseline.priorReport.text, 'utf8')) !== baseline.priorReport.sha256) throw new Error('Prior report snapshot hash mismatch');
  const env = await loadEvalEnvironment();
  const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  const paths = listing.stdout.split('\0').filter(path => path && (path.startsWith(prefix) || path === report));
  const configured = Object.entries(env).filter(([key, value]) => /^AZURE_.*(?:KEY|ENDPOINT)$/u.test(key) && typeof value === 'string' && value.length > 8).map(([, value]) => value);
  for (const path of paths) {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    if (content.includes('\uFFFD')) throw new Error(`Invalid replacement character: ${path}`);
    for (const value of configured) if (content.includes(value)) throw new Error(`Configured value exposure in ${path}`);
  }
  const result = { checkedAt: new Date().toISOString(), exit: 0, verdict: verdicts[0], criteria: ids,
    structuredFindings: findings.length, linksChecked: links.length, priorReportHashVerified: true,
    utf8FilesChecked: paths.length, configuredValueExposure: 'NONE_IN_QA_ARTIFACT_SCOPE', liveCalls: 0 };
  writeFileSync(`${prefix}report-validation.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} else if (stage === 'reconcile') {
  const selections = Object.fromEntries(['listPreparation', 'listRecipe', 'listOverall'].map(name => {
    const record = read(`${prefix}${name}.json`);
    const output = readFileSync(record.outputPath, 'utf8');
    const names = JSON.parse(output.slice(output.indexOf('['), output.lastIndexOf(']') + 1));
    const expected = { listPreparation: 5, listRecipe: 14, listOverall: 42 }[name];
    if (record.exit !== 0 || names.length !== expected) throw new Error(`Incorrect selection: ${name}`);
    return [name, { count: names.length, names }];
  }));
  const gates = ['F', 'R', 'G'].map(name => {
    const record = read(`${prefix}${name}.json`);
    if (hash(readFileSync(record.outputPath)) !== record.outputSha256 || hash(readFileSync(record.testReport)) !== record.reportSha256) throw new Error('Capture hash mismatch');
    const results = read(record.testReport);
    const fixtures = record.synthetic.filter(entry => entry.kind === 'preparation semantic evidence').map(entry => {
      const evidence = record.synthetic.filter(value => value.fixture === entry.fixture);
      const counts = evidence.find(value => value.kind === 'preparation counts and handler evidence');
      const attempt = evidence.find(value => value.kind === 'preparation complete attempt evidence');
      const protection = evidence.find(value => value.kind === 'preparation executed protection assertions');
      const semantic = evidence.find(value => value.kind === 'preparation executed semantic assertions');
      const required = /oven/u.test(entry.fixture) ? [1, 3, 6] : /rice/u.test(entry.fixture) ? [1, 4, 5, 6] : /pasta/u.test(entry.fixture) ? [1, 3, 4, 5] : [1, 2, 3];
      const refs = entry.raw.steps.flatMap(value => value.sourceStepOrders);
      return { fixture: entry.fixture, savedContext: attempt.attempts[0].original, savedSource: entry.savedSource,
        finalOutput: entry.raw, counts, sourceMatrix: entry.sourceMatrix, exportCoreMatrix: entry.exportCoreMatrix,
        sourceCoreReferencePresence: required.map(order => ({ order, present: refs.includes(order) })),
        finalFit: attempt.attempts.at(-1).probe?.ok ?? false,
        protectionAssertionsReached: !!protection, metadataAssertionReached: !!protection,
        metadataPassed: !!protection && entry.raw.totalTimeMinutes === null,
        independentCookingAssertionReached: !!semantic, independentCookingAssertionPassed: !!semantic,
        ovenEndpointPresent: /oven/u.test(entry.fixture) ? entry.raw.steps.some(value => /bis.*(?:kartoffel|sie).*gar|kartoffel.*gar\s+sind/iu.test(value.description)) : null,
        humanReview: /oven/u.test(entry.fixture) ? 'NOT_PERFORMED_MANUAL_VALIDATION_REQUIRED' : null,
        sdkSchemas: attempt.sdk.map(value => value.request.response_format.json_schema.name) };
    });
    return { stage: name, exit: record.exit, counts: record.counts, startedAt: record.startedAt, finishedAt: record.finishedAt,
      sdkPreparationCalls: fixtures.reduce((total, value) => total + value.counts.sdkCalls, 0),
      logicalPreparationCalls: fixtures.reduce((total, value) => total + value.counts.preparationCalls, 0),
      allDomainProviderCalls: 'UNVERIFIED_NOT_INSTRUMENTED', fixtures,
      imports: record.synthetic.filter(entry => entry.kind === 'import semantic evidence'),
      suites: results.testResults.map(suite => ({ file: suite.name.split(/[\\/]/u).pop(),
        assertions: suite.assertionResults.map(value => ({ name: value.fullName, status: value.status, failures: value.failureMessages })) })) };
  });
  const baseline = read(baselinePath);
  const changed = baseline.files.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256);
  const original = read('docs/qa/reports/Q21-2026-10-10-baseline.json');
  const categories = Object.fromEntries(Object.entries({ renderer: /^backend\/src\/lib\/instagramRenderer\//u,
    weekly: /^backend\/src\/.*weekly/iu,
    apiProviderQuotaLoopShared: /^(backend\/src\/lib\/(openai|quota|quotaConfig|recipePreparation|recipeAnalyzeValidation|dailyInsightValidation)\.ts|backend\/src\/functions\/(recipes|instagramRecipe)\.ts|shared\/types\/)/u,
  }).map(([name, pattern]) => {
    const rows = original.files.filter(file => pattern.test(file.path));
    return [name, { checked: rows.length, changed: rows.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256).map(file => file.path) }];
  }));
  const focused = read(read(`${prefix}focused.json`).testReport);
  const tests = focused.testResults.flatMap(suite => suite.assertionResults);
  const regressions = tests.filter(value => /Q21|supported total|unsupported|source 6|cooking core|v14|v16|identity|manifest|fingerprint/iu.test(value.fullName))
    .map(value => ({ name: value.fullName, status: value.status }));
  const result = { format: 'fittrack-q21-correction-reconciliation-v1', capturedAt: new Date().toISOString(),
    selections, gates, regressions, baselineFiles: baseline.files.length, changedSinceReviewStart: changed, originalBaselineCategories: categories,
    importBodyBytePreservation: 'UNVERIFIED_NO_PRE_CORRECTION_TEXT_BASELINE',
    manualOvenReview: 'NOT_PERFORMED_MANUAL_VALIDATION_REQUIRED', liveGatesAttempted: 3, retries: 0 };
  writeFileSync(`${prefix}reconciliation.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ selectionCounts: Object.fromEntries(Object.entries(selections).map(([name, value]) => [name, value.count])),
    gates: gates.map(value => ({ stage: value.stage, exit: value.exit, counts: value.counts, sdk: value.sdkPreparationCalls, logical: value.logicalPreparationCalls })),
    categories, changedSinceReviewStart: changed.map(value => value.path), regressionAssertions: regressions.length }));
} else {
  const recipe = 'src/lib/prompts/recipeAnalyze.eval.test.ts';
  const filter = 'preparation prompt version matches fixture expectations|recipePreparation';
  const configs = {
    focused: { cwd: 'backend', args: [require.resolve('vitest/vitest.mjs'), 'run',
      'src/lib/recipeAnalyzeValidation.test.ts', 'src/lib/recipePreparation.test.ts', 'src/lib/openai.test.ts',
      'src/functions/recipes.test.ts', 'src/functions/ai.test.ts', 'src/functions/instagramRecipe.test.ts',
      'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/test-utils/weeklyInsightEvalSemantics.test.ts',
      'src/lib/prompts/dailyInsightPrompt.test.ts', 'src/lib/prompts/dailyInsightPromptManifest.test.ts',
      'src/lib/dailyInsightValidation.test.ts', 'src/functions/dailyInsight.test.ts', '--silent'] },
    units: { args: [npm, 'run', 'test', '--workspace=backend', '--', '--silent'] },
    typecheck: { args: [npm, 'run', 'typecheck', '--workspace=backend'] },
    build: { args: [npm, 'run', 'build:verify', '--workspace=backend'] },
    listPreparation: { cwd: 'backend', list: true, args: [require.resolve('vitest/vitest.mjs'), 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
    listRecipe: { cwd: 'backend', list: true, args: [require.resolve('vitest/vitest.mjs'), 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
    listOverall: { cwd: 'backend', list: true, args: [require.resolve('vitest/vitest.mjs'), 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts'] },
    F: { live: true, args: ['backend/scripts/run-eval.mjs', recipe, '--testNamePattern', filter] },
    R: { live: true, args: ['backend/scripts/run-eval.mjs', recipe] },
    G: { live: true, args: [npm, 'run', 'test:eval', '--workspace=backend', '--'] },
  };
  const config = configs[stage];
  if (!config) throw new Error('Unknown stage');
  if (!existsSync(baselinePath)) throw new Error('Capture baseline first');
  if (config.live) {
    for (const gate of ['focused', 'units', 'typecheck', 'build', 'listPreparation', 'listRecipe', 'listOverall']) {
      const record = read(`${prefix}${gate}.json`);
      if (record.exit !== 0 || (record.counts && (record.counts.failed || !record.counts.passed))) throw new Error(`Offline gate not successful: ${gate}`);
    }
    const changed = read(baselinePath).files.filter(file => file.path !== report && (!existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256));
    if (changed.length) throw new Error('Candidate changed since capture');
  }
  const recordPath = `${prefix}${stage}.json`;
  if (existsSync(recordPath)) throw new Error('Stage already attempted; refusing a repeat');
  const outputPath = `${prefix}${stage}-Output.txt`;
  const testReport = `${prefix}${stage}-Report.json`;
  const args = [...config.args];
  if (!config.list && !['build', 'typecheck'].includes(stage)) args.push('--reporter=default', '--reporter=json', `--outputFile=${resolve(testReport)}`);
  const env = await loadEvalEnvironment();
  const redact = text => ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].reduce((value, key) => env[key] ? value.split(env[key]).join('[REDACTED]') : value, text);
  const startedAt = new Date().toISOString();
  writeFileSync(recordPath, JSON.stringify({ stage, startedAt, status: 'STARTED', args }));
  const execution = spawnSync(process.execPath, args, { cwd: resolve(config.cwd ?? '.'), env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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
  const result = { stage, startedAt, finishedAt: new Date().toISOString(), args, cwd: config.cwd ?? '.', exit: execution.status,
    signal: execution.signal, error: execution.error?.message, counts, outputPath, outputSha256: hash(readFileSync(outputPath)),
    testReport: results ? testReport : null, reportSha256: results ? hash(readFileSync(testReport)) : null, synthetic };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ stage, exit: execution.status, counts, syntheticRecords: synthetic.length, outputPath }));
  if (config.list) console.log(output);
  if (execution.status !== 0) console.log(output.slice(-6500));
  process.exitCode = execution.status ?? 1;
}