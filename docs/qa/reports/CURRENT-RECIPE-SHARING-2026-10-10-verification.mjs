import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { loadEvalEnvironment, getMissingRequiredEvalKeys } from '../../../backend/scripts/run-eval.mjs';

const prefix = 'docs/qa/reports/CURRENT-RECIPE-SHARING-2026-10-10-';
const reportPath = 'docs/qa/reports/QA_Current_Recipe_Sharing_2026-10-10.md';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const vitest = require.resolve('vitest/vitest.mjs');
const npm = resolve(process.execPath, '..', 'node_modules/npm/bin/npm-cli.js');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const stage = process.argv[2];
const recordPath = `${prefix}${stage}.json`;
const baselinePath = `${prefix}baseline.json`;
assert.ok(!existsSync(recordPath), 'Stage already exists: no gate repetition');
const listing = () => {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  return [...new Set(result.stdout.split('\0'))].filter(path => path && existsSync(path) && !path.startsWith(prefix) && path !== reportPath);
};
function loadPromptModule(path) {
  const exports = {};
  const javascript = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', javascript)(dependency => loadPromptModule(resolve(dirname(path), `${dependency}.ts`)), exports);
  return exports;
}
const changes = baseline => baseline.files.filter(file => !existsSync(file.path) || hash(readFileSync(file.path)) !== file.sha256).map(file => file.path);
if (stage === 'baseline') {
  const files = listing().map(path => ({ path, sha256: hash(readFileSync(path)) }));
  const candidate = files.filter(file => /^(backend|mobile|shared)\/(src\/|lib\/|types\/|scripts\/|assets\/|android\/|index\.|package\.json|.*config|tsconfig|app\.)/u.test(file.path) || /^(package(-lock)?\.json|tsconfig.*\.json)$/u.test(file.path));
  const recipe = loadPromptModule(resolve('backend/src/lib/prompts/recipeAnalyze.ts'));
  const daily = readFileSync('backend/src/lib/prompts/dailyInsightPrompt.ts', 'utf8');
  const guards = readFileSync('backend/src/lib/prompts/recipeAnalyze.eval.test.ts', 'utf8');
  const versions = { preparation: recipe.RECIPE_PREPARATION_PROMPT_VERSION, import: recipe.RECIPE_ANALYZE_PROMPT_VERSION,
    daily: daily.match(/DAILY_INSIGHT_PROMPT_VERSION = '(v\d+)'/u)[1], assembly: daily.match(/DAILY_INSIGHT_PROMPT_ASSEMBLY_VERSION = '(v\d+)'/u)[1],
    preparationGuard: guards.match(/TESTED_PREPARATION_PROMPT_VERSION = '(v\d+)'/u)[1], importGuard: guards.match(/TESTED_PROMPT_VERSION = '(v\d+)'/u)[1],
    dailyGuard: readFileSync('backend/src/lib/prompts/dailyInsight.eval.test.ts', 'utf8').match(/TESTED_PROMPT_VERSION = '(v\d+)'/u)[1] };
  const prompts = Object.fromEntries(['RECIPE_PREPARATION_SYSTEM_PROMPT', 'RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT', 'RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT', 'RECIPE_ANALYZE_SYSTEM_PROMPT'].map(name => [name, { text: recipe[name], sha256: hash(recipe[name]) }]));
  const priorReport = existsSync(reportPath) ? { path: reportPath, text: readFileSync(reportPath, 'utf8'), sha256: hash(readFileSync(reportPath)) } : null;
  const result = { format: 'fittrack-current-recipe-sharing-baseline-v1', capturedAt: new Date().toISOString(), files, candidate,
    candidateSha256: hash(JSON.stringify(candidate)), versions, prompts, priorReport, liveCalls: 0 };
  writeFileSync(recordPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ files: files.length, candidateFiles: candidate.length, candidateSha256: result.candidateSha256, versions, priorReportPreserved: !!priorReport }));
} else {
  const baseline = read(baselinePath);
  const beforeChanges = changes(baseline);
  if (stage === 'emulator') {
    assert.deepEqual(beforeChanges, []);
    const startedAt = new Date().toISOString();
    let status;
    let reason;
    try {
      const response = await fetch('http://127.0.0.1:18081/', { signal: AbortSignal.timeout(3000) });
      status = response.status;
    } catch (error) {
      reason = error.cause?.code ?? error.name;
    }
    const result = { stage, startedAt, finishedAt: new Date().toISOString(), endpoint: 'http://127.0.0.1:18081/',
      command: 'Node fetch loopback Cosmos readiness, 3000ms abort limit', reachable: status !== undefined, httpStatus: status,
      state: status === undefined ? 'UNVERIFIED_LOCAL_EMULATOR_UNAVAILABLE' : 'LOCAL_EMULATOR_REACHABLE', reason,
      contractTestsExecuted: 0, liveCalls: 0, candidateHashStable: changes(baseline).length === 0 };
    writeFileSync(recordPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } else if (stage === 'reconcile') {
    assert.deepEqual(beforeChanges, []);
    const environment = await loadEvalEnvironment();
    const closedSchema = schema => {
      if (schema.type === 'object') assert.equal(schema.additionalProperties, false);
      for (const nested of Object.values(schema.properties ?? {})) closedSchema(nested);
      if (schema.items) closedSchema(schema.items);
    };
    const requestKinds = new Set();
    const gates = ['F', 'R', 'G'].map(name => {
      const record = read(`${prefix}${name}.json`);
      assert.equal(record.candidateHashStable, true);
      assert.equal(record.allIntendedTestsExecuted, true);
      assert.equal(hash(readFileSync(record.outputPath)), record.outputSha256);
      assert.equal(hash(readFileSync(record.testReport)), record.reportSha256);
      const results = read(record.testReport);
      const fixtures = record.synthetic.filter(entry => entry.kind === 'preparation semantic evidence').map(entry => {
        const evidence = record.synthetic.filter(value => value.fixture === entry.fixture);
        const counts = evidence.find(value => value.kind === 'preparation counts and handler evidence');
        const attempts = evidence.find(value => value.kind === 'preparation complete attempt evidence');
        assert.ok(counts && attempts);
        const forced = attempts.initial.startsWith('forced');
        assert.equal(counts.sdkCalls, attempts.sdk.length);
        assert.equal(counts.preparationCalls, attempts.attempts.length);
        assert.ok(counts.preparationCalls <= 3);
        assert.equal(counts.unchanged, true);
        assert.deepEqual(counts.writes, { update: 0, replace: 0, create: 0 });
        const original = attempts.attempts[0].original;
        const requests = attempts.sdk.map((sdk, sdkIndex) => {
          const logicalIndex = sdkIndex + (forced ? 1 : 0);
          const attempt = attempts.attempts[logicalIndex];
          const textOnly = sdk.request.response_format.json_schema.name === 'recipe_text_correction';
          const kind = textOnly ? 'textOnly' : attempt.correction ? 'fullDraft' : 'initial';
          const prompt = baseline.prompts[{ textOnly: 'RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT', fullDraft: 'RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT', initial: 'RECIPE_PREPARATION_SYSTEM_PROMPT' }[kind]];
          assert.equal(sdk.request.messages[0].content, prompt.text);
          assert.equal(hash(sdk.request.messages[0].content), prompt.sha256);
          assert.equal(sdk.request.model, environment.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt4o-mini');
          assert.equal(sdk.request.temperature, 0.2);
          assert.equal(sdk.request.max_tokens, 2048);
          assert.equal(sdk.options.maxRetries, 0);
          assert.ok(sdk.options.timeout > 0 && sdk.options.timeout <= 20000);
          assert.equal(sdk.options.signalPresent, true);
          assert.equal(sdk.finishReason, 'stop');
          assert.equal(sdk.request.response_format.json_schema.strict, true);
          closedSchema(sdk.request.response_format.json_schema.schema);
          assert.deepEqual(attempt.original, original);
          const user = JSON.parse(sdk.request.messages[1].content);
          if (kind === 'initial') assert.deepEqual(user, original);
          if (kind === 'fullDraft') assert.deepEqual(user, { originalPreparation: original,
            latestDraft: attempts.attempts[logicalIndex - 1].output, validationErrors: attempt.correction.validationErrors });
          if (kind === 'textOnly') {
            const previous = attempts.attempts[logicalIndex - 1].output;
            const targets = [...new Map(attempt.correction.validationErrors.map(error => [error.path, error])).values()];
            const fields = targets.map(error => {
              const matched = /^steps\[(\d+)\]\.description$/u.exec(error.path);
              const index = matched ? Number(matched[1]) : undefined;
              assert.equal(error.phase, 'template');
              assert.equal(error.code, 'TEMPLATE_FIELD_OVERFLOW');
              return { index, text: index === undefined ? previous.teaser : previous.steps[index].description, actual: error.actual,
                bounds: { width: error.bounds.width, ...(error.bounds.height !== undefined ? { height: error.bounds.height } : {}) } };
            });
            assert.deepEqual(user, { texts: fields.map(({ text, actual, bounds }) => ({ text, actual, bounds })) });
            const merged = structuredClone(previous);
            const shortened = JSON.parse(sdk.raw).texts;
            fields.forEach((field, index) => {
              if (field.index === undefined) merged.teaser = shortened[index];
              else merged.steps[field.index].description = shortened[index];
            });
            assert.deepEqual(attempt.output, merged);
          }
          requestKinds.add(kind);
          return { kind, logicalCall: logicalIndex + 1, systemPromptSha256: prompt.sha256, matchesCapturedCurrentPrompt: true,
            callerConfigurationVerified: true, userContextVerified: true, strictClosedSchemaVerified: true };
        });
        const protection = evidence.some(value => value.kind === 'preparation executed protection assertions');
        const semantic = evidence.some(value => value.kind === 'preparation executed semantic assertions');
        const manual = evidence.some(value => value.kind === 'preparation manual content review required');
        const final = entry.raw;
        const firstReferences = final.steps.map(step => step.sourceStepOrders[0]);
        return { fixture: entry.fixture, savedContext: original, savedSource: entry.savedSource, finalOutput: final,
          counts, sourceMatrix: entry.sourceMatrix, exportCoreMatrix: entry.exportCoreMatrix, firstReferences,
          firstReferencesAscending: firstReferences.every((value, index) => index === 0 || value > firstReferences[index - 1]),
          finalFit: attempts.attempts.at(-1).probe?.ok ?? false,
          protectionAssertionsReached: protection, metadataAssertionReached: protection, metadataPassed: protection && final.totalTimeMinutes === null,
          semanticAssertionsCompleted: semantic, manualBranchReached: manual,
          cookingContentState: manual ? 'MANUAL_VALIDATION_REQUIRED' : semantic ? 'EXECUTED_PASS' : 'NOT_REACHED',
          requests, attempts: attempts.attempts, sdk: attempts.sdk };
      });
      assert.equal(fixtures.length, 4);
      const assertions = results.testResults.flatMap(suite => suite.assertionResults);
      return { stage: name, exit: record.exit, counts: record.counts, startedAt: record.startedAt, finishedAt: record.finishedAt,
        preparationHandlerSdkCalls: fixtures.reduce((sum, fixture) => sum + fixture.counts.sdkCalls, 0),
        preparationHandlerLogicalCalls: fixtures.reduce((sum, fixture) => sum + fixture.counts.preparationCalls, 0),
        allDomainSdkCallCount: 'UNVERIFIED_NOT_INSTRUMENTED; excludes six direct provenance calls per gate',
        fixtures, imports: record.synthetic.filter(entry => entry.kind === 'import semantic evidence'),
        provenanceAssertions: assertions.filter(assertion => assertion.fullName.includes('total-time provenance regression')),
        failures: assertions.filter(assertion => assertion.status === 'failed'),
        suites: results.testResults.map(suite => ({ file: suite.name.split(/[\\/]/u).pop(),
          passed: suite.assertionResults.filter(assertion => assertion.status === 'passed').length,
          failed: suite.assertionResults.filter(assertion => assertion.status === 'failed').length,
          skipped: suite.assertionResults.filter(assertion => assertion.status === 'pending').length })) };
    });
    assert.deepEqual([...requestKinds].sort(), ['fullDraft', 'initial', 'textOnly']);
    const offline = ['focused', 'units', 'mobile', 'shared'].map(name => {
      const record = read(`${prefix}${name}.json`);
      return { stage: name, counts: record.counts, assertions: read(record.testReport).testResults.map(suite => ({
        file: suite.name.split(/[\\/]/u).pop(), tests: suite.assertionResults.map(assertion => ({ name: assertion.fullName, status: assertion.status })) })) };
    });
    const result = { format: 'fittrack-current-recipe-sharing-reconciliation-v1', checkedAt: new Date().toISOString(), exit: 0,
      versions: baseline.versions, candidateSha256: baseline.candidateSha256, candidateHashStable: true, requestKindsVerified: [...requestKinds],
      gates, offline, liveGateRuns: 3, gateRetries: 0, liveCallsForReconciliation: 0, humanOvenReview: 'NOT_PERFORMED_MANUAL_VALIDATION_REQUIRED' };
    writeFileSync(recordPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ exit: 0, candidateHashStable: true, requestKindsVerified: [...requestKinds], gates: gates.map(gate => ({
      stage: gate.stage, counts: gate.counts, sdk: gate.preparationHandlerSdkCalls, logical: gate.preparationHandlerLogicalCalls,
      fixtures: gate.fixtures.map(fixture => ({ fixture: fixture.fixture, total: fixture.finalOutput.totalTimeMinutes, firstReferences: fixture.firstReferences,
        status: fixture.counts.status, metadataPassed: fixture.metadataPassed, cooking: fixture.cookingContentState })) })) }));
  } else if (stage === 'selectionNames') {
    assert.deepEqual(beforeChanges, []);
    const selections = [['F', 'listPreparationCurrent'], ['R', 'listRecipeCurrent'], ['G', 'listOverallCurrent']].map(([name, list]) => {
      const record = read(`${prefix}${name}.json`);
      const selected = read(`${prefix}${list}.json`).selection;
      const assertions = read(record.testReport).testResults.flatMap(suite => suite.assertionResults.map(assertion => ({ ...assertion, file: suite.name })));
      const normalize = value => value.replace(/ > /gu, ' ');
      const normalizePath = value => value.replace(/\\/gu, '/').toLowerCase();
      const intended = selected.map(test => {
        const matches = assertions.filter(assertion => normalize(assertion.fullName) === normalize(test.name)
          && normalizePath(assertion.file) === normalizePath(test.file));
        assert.equal(matches.length, 1, test.name);
        assert.ok(['passed', 'failed'].includes(matches[0].status), test.name);
        return { file: test.file, name: test.name, status: matches[0].status };
      });
      assert.equal(assertions.filter(assertion => ['passed', 'failed'].includes(assertion.status)).length, intended.length);
      return { stage: name, intended, allIntendedNamesExecuted: true, counts: record.counts };
    });
    const result = { stage, checkedAt: new Date().toISOString(), exit: 0, candidateHashStable: changes(baseline).length === 0,
      liveCalls: 0, selections };
    writeFileSync(recordPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ exit: 0, candidateHashStable: result.candidateHashStable,
      gates: selections.map(gate => ({ stage: gate.stage, allIntendedNamesExecuted: true, count: gate.intended.length })) }));
  } else if (stage === 'finish') {
    const text = readFileSync(reportPath, 'utf8');
    const verdicts = [...text.matchAll(/^- Verdict: `([^`]+)`/gmu)].map(match => match[1]);
    assert.equal(verdicts.length, 1);
    assert.ok(['PASS', 'PASS WITH ISSUES', 'FAIL'].includes(verdicts[0]));
    assert.ok(text.includes('fittrack-qa-v1'));
    const criteria = [...text.matchAll(/^\| (AC-\d+|US-10 AC-\d+) \|/gmu)].map(match => match[1]);
    assert.equal(new Set(criteria).size, criteria.length);
    assert.equal(criteria.length, 39);
    for (const block of text.split(/^Finding key: /mu).slice(1)) for (const field of ['Plan reference:', 'Acceptance criterion:', 'Description:', 'Criticality:', 'Owner:', 'Evidence:', 'Recommendation:']) assert.ok(block.includes(field), field);
    for (const link of text.matchAll(/\]\(([^)]+)\)/gu)) assert.ok(existsSync(resolve('docs/qa/reports', decodeURIComponent(link[1].split('#')[0]))), link[1]);
    const env = await loadEvalEnvironment();
    const values = ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].map(key => env[key]).filter(value => value?.length > 8);
    const artifacts = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).stdout.split('\0').filter(path => path.startsWith(prefix) || path === reportPath);
    for (const path of artifacts) {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
      for (const value of values) assert.ok(!content.includes(value), `Configured secret exposure in ${path}`);
    }
    const candidateChanges = beforeChanges.filter(path => baseline.candidate.some(file => file.path === path));
    const newForeignFiles = listing().filter(path => !baseline.files.some(file => file.path === path));
    const result = { format: 'fittrack-current-recipe-sharing-finish-v1', checkedAt: new Date().toISOString(), verdict: verdicts[0],
      candidateHashStable: candidateChanges.length === 0, candidateChanges, preservationChanges: beforeChanges, newForeignFiles,
      baselineFilesVerified: baseline.files.length, candidateFilesVerified: baseline.candidate.length, candidateSha256: baseline.candidateSha256,
      reportSha256: hash(readFileSync(reportPath)), criteria, secretExposure: 'NONE_IN_NEW_QA_ARTIFACTS', liveCalls: 0 };
    writeFileSync(recordPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } else {
    assert.deepEqual(beforeChanges, [], 'Saved candidate changed before gate: do not mix candidates');
    const recipe = 'src/lib/prompts/recipeAnalyze.eval.test.ts';
    const filter = 'preparation prompt version matches fixture expectations|recipePreparation';
    const focus = ['src/lib/recipeAnalyzeValidation.test.ts', 'src/lib/recipePreparation.test.ts', 'src/lib/openai.recipeAnalyze.test.ts',
      'src/functions/recipes.test.ts', 'src/functions/ai.test.ts', 'src/functions/instagramRecipe.test.ts',
      'src/lib/recipeValidation.test.ts', 'src/lib/repositories/recipesRepository.test.ts', 'src/lib/repositories/cosmosRecipesRepository.test.ts',
      'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/lib/instagramRenderer/recipeAdapter.test.ts',
      'src/test-utils/weeklyInsightEvalSemantics.test.ts', 'src/lib/prompts/dailyInsightPrompt.test.ts',
      'src/lib/prompts/dailyInsightPromptManifest.test.ts', 'src/lib/dailyInsightValidation.test.ts', 'src/functions/dailyInsight.test.ts'];
    const configs = {
      focused: { cwd: 'backend', tests: true, args: [vitest, 'run', ...focus, '--silent'] },
      units: { tests: true, args: [npm, 'run', 'test', '--workspace=backend', '--', '--silent'] },
      shared: { cwd: 'shared', tests: true, args: [vitest, 'run', '--silent'] },
      mobile: { cwd: 'mobile', tests: true, args: [vitest, 'run', 'src/modules/recipes', 'src/shared/api/recipeApi.test.ts', 'src/services/recipeShareMediaService.test.ts', '--silent'] },
      mobileAll: { cwd: 'mobile', tests: true, args: [vitest, 'run', '--silent'] },
      contract: { cwd: 'backend', tests: true, args: [vitest, 'run', '--config', 'vitest.contract.config.mts', 'src/lib/repositories/cosmosRecipesRepository.contract.test.ts', '--silent'] },
      typecheck: { args: [npm, 'run', 'typecheck', '--workspace=backend'] },
      sharedTypecheck: { args: [npm, 'run', 'typecheck', '--workspace=shared'] },
      mobileTypecheck: { args: [npm, 'run', 'typecheck', '--workspace=mobile'] },
      build: { args: [npm, 'run', 'build:verify', '--workspace=backend'] },
      dailyRelease: { args: [npm, 'run', 'verify:daily-insight-prompt', '--workspace=backend'] },
      encoding: { args: ['scripts/check-encoding.mjs'] },
      versionGuards: { cwd: 'backend', tests: true, noCalls: true, args: [vitest, 'run', '--config', 'vitest.eval.config.mts', recipe, 'src/lib/prompts/dailyInsight.eval.test.ts', '--testNamePattern', 'prompt version matches fixture expectations', '--silent'] },
      listPreparation: { cwd: 'backend', list: true, noCalls: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
      listRecipe: { cwd: 'backend', list: true, noCalls: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
      listOverall: { cwd: 'backend', list: true, noCalls: true, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts'] },
      listPreparationCurrent: { cwd: 'backend', list: true, noCalls: true, expected: 11, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe, '--testNamePattern', filter] },
      listRecipeCurrent: { cwd: 'backend', list: true, noCalls: true, expected: 20, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts', recipe] },
      listOverallCurrent: { cwd: 'backend', list: true, noCalls: true, expected: 48, args: [vitest, 'list', '--disableConsoleIntercept', '--json', '--config', 'vitest.eval.config.mts'] },
      F: { live: 'listPreparationCurrent', tests: true, args: ['backend/scripts/run-eval.mjs', recipe, '--testNamePattern', filter] },
      R: { live: 'listRecipeCurrent', tests: true, args: ['backend/scripts/run-eval.mjs', recipe] },
      G: { live: 'listOverallCurrent', tests: true, args: [npm, 'run', 'test:eval', '--workspace=backend', '--'] },
    };
    const config = configs[stage];
    assert.ok(config, 'Unknown stage');
    const env = await loadEvalEnvironment();
    if (stage === 'contract') {
      assert.equal(read(`${prefix}emulator.json`).reachable, true);
      env.COSMOS_ENDPOINT = 'http://127.0.0.1:18081';
    }
    if (config.live) {
      for (const gate of ['focused', 'units', 'shared', 'mobile', 'typecheck', 'sharedTypecheck', 'mobileTypecheck', 'build', 'dailyRelease', 'encoding', 'versionGuards', 'listPreparationCurrent', 'listRecipeCurrent', 'listOverallCurrent']) assert.equal(read(`${prefix}${gate}.json`).exit, 0, gate);
      for (const [gate, count] of [['listPreparationCurrent', 11], ['listRecipeCurrent', 20], ['listOverallCurrent', 48]]) assert.equal(read(`${prefix}${gate}.json`).selection.length, count, gate);
      assert.deepEqual(getMissingRequiredEvalKeys(env), [], 'Credentials unavailable: live gates UNVERIFIED');
      assert.equal(baseline.versions.preparation, baseline.versions.preparationGuard);
      assert.equal(baseline.versions.import, baseline.versions.importGuard);
      assert.equal(baseline.versions.daily, baseline.versions.dailyGuard);
    }
    if (config.noCalls && !stage.endsWith('Current')) for (const key of ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY']) delete env[key];
    const redact = text => ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].reduce((content, key) => env[key] ? content.split(env[key]).join('[REDACTED]') : content, text);
    const outputPath = `${prefix}${stage}-Output.txt`;
    const testReport = `${prefix}${stage}-Report.json`;
    const args = [...config.args];
    if (config.tests) args.push('--reporter=default', '--reporter=json', `--outputFile=${resolve(testReport)}`);
    const startedAt = new Date().toISOString();
    const cwd = config.cwd ?? '.';
    writeFileSync(recordPath, JSON.stringify({ stage, startedAt, executable: process.execPath, nativeArgs: args, cwd, state: 'STARTED', candidateSha256: baseline.candidateSha256 }, null, 2));
    const execution = spawnSync(process.execPath, args, { cwd: resolve(cwd), env, encoding: 'utf8', maxBuffer: 96 * 1024 * 1024 });
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
    const afterChanges = changes(baseline);
    const intended = config.live ? read(`${prefix}${config.live}.json`).selection : null;
    const result = { format: 'fittrack-current-recipe-sharing-execution-v1', stage, startedAt, finishedAt: new Date().toISOString(),
      executable: process.execPath, nativeArgs: args, cwd, exit: execution.status, signal: execution.signal, error: execution.error?.message,
      candidateSha256: baseline.candidateSha256, candidateHashStable: afterChanges.length === 0, changedPaths: afterChanges,
      state: afterChanges.length ? 'UNVERIFIED_CANDIDATE_MUTATED' : 'COMPLETED', counts, selection, synthetic,
      outputPath, outputSha256: hash(readFileSync(outputPath)), testReport: results ? testReport : null,
      reportSha256: results ? hash(readFileSync(testReport)) : null,
      allIntendedTestsExecuted: intended && counts ? counts.passed + counts.failed === intended.length : null,
      noProviderCalls: !!config.noCalls, liveGate: !!config.live };
    writeFileSync(recordPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ stage, exit: result.exit, counts, selectionCount: selection?.length, allIntendedTestsExecuted: result.allIntendedTestsExecuted, candidateHashStable: result.candidateHashStable, syntheticRecords: synthetic.length }));
    if (config.expected) assert.equal(selection.length, config.expected);
    if (execution.status !== 0) console.log(output.slice(-6500));
    process.exitCode = execution.status ?? 1;
  }
}