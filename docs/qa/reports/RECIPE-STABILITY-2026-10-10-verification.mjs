import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { loadEvalEnvironment, getMissingRequiredEvalKeys } from '../../../backend/scripts/run-eval.mjs';

const prefix = 'docs/qa/reports/RECIPE-STABILITY-2026-10-10-';
const reportPath = 'docs/qa/reports/QA_Recipe_Preparation_Stability_2026-10-10.md';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const vitest = require.resolve('vitest/vitest.mjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const write = (path, value) => { assert.ok(!existsSync(path), `Preserve existing evidence: ${path}`); writeFileSync(path, JSON.stringify(value, null, 2)); };
const stage = process.argv[2];
const recordPath = `${prefix}${stage}.json`;
assert.ok(!existsSync(recordPath), 'No repeated stages');
const recipe = 'src/lib/prompts/recipeAnalyze.eval.test.ts';
const fixtureId = 'synthetic-saved-eight-steps-rice-serving';
const fixtureNamePrefix = 'synthetic-saved-eight-steps-rice-serv';
const filter = `recipePreparation: synthetic saved-source live evaluation.*${fixtureNamePrefix}`;
const liveOrder = ['trial1', 'trial2', 'trial3', 'trial4', 'trial5', 'R', 'G'];
const listing = () => {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  return [...new Set(result.stdout.split('\0'))].filter(path => path && existsSync(path) && !path.startsWith(prefix) && path !== reportPath);
};
const changes = baseline => baseline.files.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256).map(file => file.path);
function loadPromptModule(path) {
  const exports = {};
  const javascript = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', javascript)(dependency => loadPromptModule(resolve(dirname(path), `${dependency}.ts`)), exports);
  return exports;
}
const environment = await loadEvalEnvironment();
const environmentFingerprint = hash(JSON.stringify(Object.fromEntries(['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_API_VERSION', 'AZURE_OPENAI_DEPLOYMENT_NAME'].map(key => [key, environment[key] ?? null]))));
const redact = text => ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].reduce((content, key) => environment[key] ? content.split(environment[key]).join('[REDACTED]') : content, text);
if (stage === 'baseline') {
  assert.ok(!existsSync(reportPath), 'Required new report already exists');
  const files = listing().map(path => ({ path, sha256: hash(readFileSync(path)) }));
  const candidate = files.filter(file => /^(backend|mobile|shared)\/(src\/|lib\/|types\/|scripts\/|assets\/|android\/|index\.|package\.json|.*config|tsconfig|app\.)/u.test(file.path) || /^(package(-lock)?\.json|tsconfig.*\.json)$/u.test(file.path));
  const promptsModule = loadPromptModule(resolve('backend/src/lib/prompts/recipeAnalyze.ts'));
  const guards = readFileSync(`backend/${recipe}`, 'utf8');
  const daily = readFileSync('backend/src/lib/prompts/dailyInsightPrompt.ts', 'utf8');
  const versions = { preparation: promptsModule.RECIPE_PREPARATION_PROMPT_VERSION, import: promptsModule.RECIPE_ANALYZE_PROMPT_VERSION,
    preparationGuard: guards.match(/TESTED_PREPARATION_PROMPT_VERSION = '(v\d+)'/u)[1], importGuard: guards.match(/TESTED_PROMPT_VERSION = '(v\d+)'/u)[1],
    daily: daily.match(/DAILY_INSIGHT_PROMPT_VERSION = '(v\d+)'/u)[1], assembly: daily.match(/DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION = '(v\d+)'/u)[1] };
  const prompts = Object.fromEntries(['RECIPE_PREPARATION_SYSTEM_PROMPT', 'RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT', 'RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT', 'RECIPE_ANALYZE_SYSTEM_PROMPT'].map(name => [name, { text: promptsModule[name], sha256: hash(promptsModule[name]) }]));
  const old = read('docs/qa/reports/CURRENT-RECIPE-SHARING-2026-10-10-baseline.json');
  const result = { format: 'fittrack-recipe-stability-baseline-v1', capturedAt: new Date().toISOString(), files, candidate, candidateSha256: hash(JSON.stringify(candidate)),
    versions, prompts, environmentFingerprint, settingsSha256: hash(readFileSync('backend/local.settings.json')),
    provider: { deployment: environment.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt4o-mini', apiVersion: environment.AZURE_OPENAI_API_VERSION ?? '2024-07-01', temperature: 0.2, maxTokens: 2048, preparationSdkRetries: 0 },
    previousCandidateSha256: old.candidateSha256, sameAsPreviousCandidate: hash(JSON.stringify(candidate)) === old.candidateSha256,
    changedPreviousCandidateFiles: old.candidate.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256).map(file => file.path),
    experiment: { fixedBeforeLive: true, liveOrder, independentRiceTrials: 5, recipeGates: 1, overallGates: 1, replacements: 0, filter, fixtureId },
    missingCredentials: getMissingRequiredEvalKeys(environment), liveCalls: 0 };
  write(recordPath, result);
  console.log(JSON.stringify({ stage, candidateFiles: candidate.length, candidateSha256: result.candidateSha256, sameAsPreviousCandidate: result.sameAsPreviousCandidate, versions, missingCredentials: result.missingCredentials }));
} else {
  const baseline = read(`${prefix}baseline.json`);
  assert.deepEqual(changes(baseline), [], 'STOP: preexisting files changed');
  assert.equal(environmentFingerprint, baseline.environmentFingerprint, 'STOP: provider settings changed');
  assert.equal(hash(readFileSync('backend/local.settings.json')), baseline.settingsSha256, 'STOP: local settings changed');
  if (stage === 'finish') {
    const text = readFileSync(reportPath, 'utf8');
    const verdicts = [...text.matchAll(/^- Verdict: `([^`]+)`/gmu)].map(match => match[1]);
    assert.equal(verdicts.length, 1);
    assert.ok(['PASS', 'PASS WITH ISSUES', 'FAIL'].includes(verdicts[0]));
    assert.ok(text.includes('fittrack-qa-v1'));
    const criteria = [...text.matchAll(/^\| (AC-\d+|US-10 AC-\d+) \|/gmu)].map(match => match[1]);
    assert.equal(criteria.length, 12);
    assert.equal(new Set(criteria).size, 12);
    for (const block of text.split(/^Finding key: /mu).slice(1)) for (const field of ['Plan reference:', 'Acceptance criterion:', 'Description:', 'Criticality:', 'Owner:', 'Evidence:', 'Recommendation:']) assert.ok(block.includes(field));
    for (const link of text.matchAll(/\]\(([^)]+)\)/gu)) assert.ok(existsSync(resolve('docs/qa/reports', decodeURIComponent(link[1].split('#')[0]))), link[1]);
    const all = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
    assert.equal(all.status, 0);
    const artifacts = all.stdout.split('\0').filter(path => path.startsWith(prefix) || path === reportPath);
    for (const path of artifacts) {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
      for (const key of ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY']) if (environment[key]) assert.ok(!content.includes(environment[key]), `Secret exposure: ${path}`);
    }
    const gates = liveOrder.map(name => read(`${prefix}${name}.json`));
    const result = { stage, exit: 0, checkedAt: new Date().toISOString(), verdict: verdicts[0], candidateHashStable: true, candidateSha256: baseline.candidateSha256,
      preservationChanges: changes(baseline), newForeignFiles: listing().filter(path => !baseline.files.some(file => file.path === path)), filesVerified: baseline.files.length,
      artifactsChecked: artifacts.length, secretExposure: 'NONE', utf8: 'VALID', criteria, reportSha256: hash(readFileSync(reportPath)),
      sevenGateRuns: gates.length, replacements: 0, allIntendedTestsExecuted: gates.every(gate => gate.allIntendedTestsExecuted), liveCalls: 0 };
    assert.deepEqual(result.newForeignFiles, []);
    write(recordPath, result);
    console.log(JSON.stringify(result));
  } else {
    const live = liveOrder.includes(stage);
    const configs = {
      focused: { cwd: 'backend', tests: true, args: [vitest, 'run', 'src/lib/recipeAnalyzeValidation.test.ts', 'src/lib/recipePreparation.test.ts', 'src/lib/openai.recipeAnalyze.test.ts', '--silent'] },
      typecheck: { cwd: 'backend', args: [require.resolve('typescript/bin/tsc'), '--noEmit'] },
      guards: { cwd: 'backend', tests: true, args: [vitest, 'run', '--config', 'vitest.eval.config.mts', recipe, 'src/lib/prompts/dailyInsight.eval.test.ts', '--testNamePattern', 'prompt version matches fixture expectations', '--silent'] },
      listRice: { cwd: 'backend', list: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
      listRiceVerified: { cwd: 'backend', list: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
      listR: { cwd: 'backend', list: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
      listG: { cwd: 'backend', list: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts'] },
      ...Object.fromEntries(liveOrder.map(name => [name, { tests: true, selection: name.startsWith('trial') ? 'listRiceVerified' : `list${name}`,
        args: ['backend/scripts/run-eval.mjs', ...(name === 'G' ? [] : [recipe]), ...(name.startsWith('trial') ? ['--testNamePattern', filter] : [])] }])),
    };
    const config = configs[stage];
    assert.ok(config, 'Unknown stage');
    if (live) {
      for (const name of ['focused', 'typecheck', 'guards', 'listRiceVerified', 'listR', 'listG']) assert.equal(read(`${prefix}${name}.json`).exit, 0, name);
      assert.equal(read(`${prefix}listRiceVerified.json`).selection.length, 1);
      assert.deepEqual(getMissingRequiredEvalKeys(environment), [], 'STOP: missing credentials');
      for (const previous of liveOrder.slice(0, liveOrder.indexOf(stage))) {
        const prior = read(`${prefix}${previous}.json`);
        assert.equal(prior.state, 'COMPLETED');
        assert.equal(prior.candidateHashStable, true);
        assert.equal(prior.allIntendedTestsExecuted, true);
        assert.ok(prior.rice?.sdkCalls > 0, 'STOP: no live rice request');
      }
    }
    const args = [...config.args];
    const outputPath = `${prefix}${stage}-Output.txt`;
    const testReport = `${prefix}${stage}-Report.json`;
    if (config.tests) args.push('--reporter=default', '--reporter=json', `--outputFile=${resolve(testReport)}`);
    assert.ok(!existsSync(outputPath) && !existsSync(testReport));
    const startedAt = new Date().toISOString();
    const execution = spawnSync(process.execPath, args, { cwd: resolve(config.cwd ?? '.'), env: environment, encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
    const output = redact(`${execution.stdout ?? ''}\n${execution.stderr ?? ''}`);
    writeFileSync(outputPath, output);
    if (existsSync(testReport)) writeFileSync(testReport, redact(readFileSync(testReport, 'utf8')));
    const results = existsSync(testReport) ? read(testReport) : null;
    const assertions = results?.testResults.flatMap(suite => suite.assertionResults.map(assertion => ({ ...assertion, file: suite.name }))) ?? [];
    const counts = results ? { total: results.numTotalTests, passed: results.numPassedTests, failed: results.numFailedTests, skipped: results.numPendingTests } : null;
    const synthetic = output.split(/\r?\n/u).flatMap(line => {
      const matched = /Synthetic (preparation|import) (.+?) (\{.*\})/u.exec(line);
      if (!matched) return [];
      try { return [{ kind: `${matched[1]} ${matched[2]}`, ...JSON.parse(matched[3]) }]; } catch { return []; }
    });
    const selection = config.list ? JSON.parse(output.slice(output.indexOf('['), output.lastIndexOf(']') + 1)) : null;
    const intended = live ? read(`${prefix}${config.selection}.json`).selection : null;
    const normalizeName = value => value.replace(/ > /gu, ' ');
    const normalizePath = value => value.replace(/\\/gu, '/').toLowerCase();
    const executionNames = intended?.map(test => ({ ...test, matches: assertions.filter(assertion => normalizeName(assertion.fullName) === normalizeName(test.name) && normalizePath(assertion.file) === normalizePath(test.file)).map(assertion => assertion.status) }));
    const riceEvidence = synthetic.filter(entry => entry.fixture === fixtureId);
    const riceCounts = riceEvidence.find(entry => entry.kind === 'preparation counts and handler evidence');
    const attempts = riceEvidence.find(entry => entry.kind === 'preparation complete attempt evidence');
    const semantic = riceEvidence.find(entry => entry.kind === 'preparation semantic evidence');
    const riceAssertion = assertions.find(assertion => assertion.fullName.includes('synthetic saved-source live evaluation') && assertion.fullName.includes(fixtureNamePrefix));
    const result = { format: 'fittrack-recipe-stability-execution-v1', stage, startedAt, finishedAt: new Date().toISOString(), executable: process.execPath,
      nativeArgs: args, cwd: config.cwd ?? '.', exit: execution.status, signal: execution.signal, error: execution.error?.message,
      candidateSha256: baseline.candidateSha256, candidateHashStable: changes(baseline).length === 0, changedPaths: changes(baseline), environmentFingerprint,
      counts, selection, executionNames, allIntendedTestsExecuted: intended ? executionNames.every(test => test.matches.length === 1 && ['passed', 'failed'].includes(test.matches[0])) && assertions.filter(assertion => ['passed', 'failed'].includes(assertion.status)).length === intended.length : null,
      synthetic, failures: assertions.filter(assertion => assertion.status === 'failed'),
      rice: riceCounts ? { ...riceCounts, testStatus: riceAssertion?.status, finalOutput: semantic?.raw, savedSource: semantic?.savedSource,
        firstReferences: semantic?.raw?.steps.map(step => step.sourceStepOrders[0]), finalProbe: attempts?.attempts.at(-1)?.probe,
        protectionAssertionsReached: riceEvidence.some(entry => entry.kind === 'preparation executed protection assertions'),
        semanticAssertionsCompleted: riceEvidence.some(entry => entry.kind === 'preparation executed semantic assertions') } : null,
      outputPath, outputSha256: hash(readFileSync(outputPath)), testReport: results ? testReport : null, reportSha256: results ? hash(readFileSync(testReport)) : null,
      noProviderCalls: !live, liveGate: live, state: 'COMPLETED' };
    if (!result.candidateHashStable) result.state = 'UNVERIFIED_CANDIDATE_MUTATED';
    write(recordPath, result);
    console.log(JSON.stringify({ stage, exit: result.exit, counts, selectionCount: selection?.length, candidateHashStable: result.candidateHashStable,
      allIntendedTestsExecuted: result.allIntendedTestsExecuted, rice: result.rice && { status: result.rice.status, sdkCalls: result.rice.sdkCalls, logicalCalls: result.rice.preparationCalls, testStatus: result.rice.testStatus, firstReferences: result.rice.firstReferences } }));
    if (stage === 'listRice' || stage === 'listRiceVerified') { assert.equal(selection.length, 1); assert.ok(selection[0].file.replace(/\\/gu, '/').endsWith(recipe)); assert.ok(selection[0].name.includes(fixtureNamePrefix)); }
    if (stage === 'guards') assert.equal(counts.passed, 3);
    assert.equal(result.candidateHashStable, true, 'STOP: candidate mutated during execution');
    process.exitCode = execution.status ?? 1;
  }
}