import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const prefix = 'docs/qa/reports/RECIPE-STABILITY-2026-10-10-';
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const hash = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(import.meta.url);
const ts = require('typescript');
const baseline = read(`${prefix}baseline.json`);
const outputPath = `${prefix}reconcile-verified.json`;
assert.ok(!existsSync(outputPath), 'Do not replace reconciliation');
for (const file of baseline.files) assert.equal(hash(readFileSync(file.path)), file.sha256, file.path);
function loadSource(path) {
  const exports = {};
  const javascript = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', javascript)(dependency => dependency.startsWith('.') ? loadSource(resolve(dirname(path), `${dependency}.ts`)) : require(dependency), exports);
  return exports;
}
const validator = loadSource(resolve('backend/src/lib/recipeAnalyzeValidation.ts'));
const closedSchema = schema => {
  if (schema.type === 'object') assert.equal(schema.additionalProperties, false);
  for (const nested of Object.values(schema.properties ?? {})) closedSchema(nested);
  if (schema.items) closedSchema(schema.items);
};
const requestKinds = new Set();
const gates = baseline.experiment.liveOrder.map(stage => {
  const record = read(`${prefix}${stage}.json`);
  assert.equal(record.candidateHashStable, true);
  assert.equal(record.environmentFingerprint, baseline.environmentFingerprint);
  assert.equal(record.allIntendedTestsExecuted, true);
  assert.equal(hash(readFileSync(record.outputPath)), record.outputSha256);
  assert.equal(hash(readFileSync(record.testReport)), record.reportSha256);
  const fixtures = record.synthetic.filter(entry => entry.kind === 'preparation semantic evidence').map(entry => {
    const evidence = record.synthetic.filter(value => value.fixture === entry.fixture);
    const counts = evidence.find(value => value.kind === 'preparation counts and handler evidence');
    const attemptEvidence = evidence.find(value => value.kind === 'preparation complete attempt evidence');
    assert.ok(counts && attemptEvidence);
    assert.equal(counts.sdkCalls, attemptEvidence.sdk.length);
    assert.equal(counts.preparationCalls, attemptEvidence.attempts.length);
    assert.ok(counts.preparationCalls <= 3);
    assert.equal(counts.unchanged, true);
    assert.deepEqual(counts.writes, { update: 0, replace: 0, create: 0 });
    const original = attemptEvidence.attempts[0].original;
    const forced = attemptEvidence.initial.startsWith('forced');
    const requests = attemptEvidence.sdk.map((sdk, sdkIndex) => {
      const logicalIndex = sdkIndex + (forced ? 1 : 0);
      const attempt = attemptEvidence.attempts[logicalIndex];
      const textOnly = sdk.request.response_format.json_schema.name === 'recipe_text_correction';
      const kind = textOnly ? 'textOnly' : attempt.correction ? 'fullDraft' : 'initial';
      const promptName = { textOnly: 'RECIPE_TEXT_CORRECTION_SYSTEM_PROMPT', fullDraft: 'RECIPE_PREPARATION_CORRECTION_SYSTEM_PROMPT', initial: 'RECIPE_PREPARATION_SYSTEM_PROMPT' }[kind];
      assert.equal(sdk.request.messages[0].content, baseline.prompts[promptName].text);
      assert.equal(hash(sdk.request.messages[0].content), baseline.prompts[promptName].sha256);
      assert.equal(sdk.request.model, baseline.provider.deployment);
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
      if (kind === 'fullDraft') assert.deepEqual(user, { originalPreparation: original, latestDraft: attemptEvidence.attempts[logicalIndex - 1].output, validationErrors: attempt.correction.validationErrors });
      if (kind === 'textOnly') {
        const previous = attemptEvidence.attempts[logicalIndex - 1].output;
        const targets = [...new Map(attempt.correction.validationErrors.map(error => [error.path, error])).values()];
        const fields = targets.map(error => {
          const matched = /^steps\[(\d+)\]\.description$/u.exec(error.path);
          const index = matched ? Number(matched[1]) : undefined;
          assert.equal(error.phase, 'template');
          assert.equal(error.code, 'TEMPLATE_FIELD_OVERFLOW');
          return { index, text: index === undefined ? previous.teaser : previous.steps[index].description,
            actual: error.actual, bounds: { width: error.bounds.width, ...(error.bounds.height !== undefined ? { height: error.bounds.height } : {}) } };
        });
        assert.deepEqual(user, { texts: fields.map(({ text, actual, bounds }) => ({ text, actual, bounds })) });
        const merged = structuredClone(previous);
        const shortened = JSON.parse(sdk.raw).texts;
        fields.forEach((field, index) => { if (field.index === undefined) merged.teaser = shortened[index]; else merged.steps[field.index].description = shortened[index]; });
        assert.deepEqual(attempt.output, merged);
      }
      requestKinds.add(kind);
      return { kind, logicalCall: logicalIndex + 1, currentPromptEquality: true, systemPromptSha256: hash(sdk.request.messages[0].content),
        userMessageSha256: hash(sdk.request.messages[1].content), schemaSha256: hash(JSON.stringify(sdk.request.response_format)), currentContextVerified: true, callerSettingsVerified: true };
    });
    const finalValidation = validator.validateRecipeExportPreparationOutput(entry.raw, entry.savedSource);
    if (entry.fixture === baseline.experiment.fixtureId) assert.equal(finalValidation.ok, counts.status === 200, 'Rice final validator must agree with actual handler outcome');
    const protection = evidence.some(value => value.kind === 'preparation executed protection assertions');
    const semantic = evidence.some(value => value.kind === 'preparation executed semantic assertions');
    const finalProbe = attemptEvidence.attempts.at(-1).probe;
    const fixture = { fixture: entry.fixture, counts, original, savedSource: entry.savedSource, finalOutput: entry.raw, finalValidation,
      finalProbe, firstReferences: entry.raw.steps.map(step => step.sourceStepOrders[0]), sourceMatrix: entry.sourceMatrix, exportCoreMatrix: entry.exportCoreMatrix,
      protectionAssertionsReached: protection, metadataAssertionReached: protection, metadataPassed: protection && entry.raw.totalTimeMinutes === null,
      semanticAssertionsCompleted: semantic, manualBranchReached: evidence.some(value => value.kind === 'preparation manual content review required'),
      requests, attempts: attemptEvidence.attempts, sdk: attemptEvidence.sdk };
    if (counts.status === 422) assert.equal(counts.usageCalls, 0);
    if (counts.status === 200) assert.equal(counts.usageCalls, 1);
    return fixture;
  });
  assert.equal(fixtures.length, stage.startsWith('trial') ? 1 : 4);
  return { stage, exit: record.exit, counts: record.counts, startedAt: record.startedAt, finishedAt: record.finishedAt,
    rice: fixtures.find(fixture => fixture.fixture === baseline.experiment.fixtureId), fixtures,
    preparationHandlerSdkCalls: fixtures.reduce((sum, fixture) => sum + fixture.counts.sdkCalls, 0),
    preparationHandlerLogicalCalls: fixtures.reduce((sum, fixture) => sum + fixture.counts.preparationCalls, 0),
    imports: record.synthetic.filter(entry => entry.kind === 'import semantic evidence'), failures: record.failures,
    suites: read(record.testReport).testResults.map(suite => ({ file: suite.name.split(/[\\/]/u).pop(), passed: suite.assertionResults.filter(assertion => assertion.status === 'passed').length,
      failed: suite.assertionResults.filter(assertion => assertion.status === 'failed').length, skipped: suite.assertionResults.filter(assertion => assertion.status === 'pending').length })) };
});
const rice = gates.map(gate => gate.rice);
for (const fixture of rice) {
  assert.deepEqual(fixture.original, rice[0].original);
  assert.deepEqual(fixture.savedSource, rice[0].savedSource);
  assert.equal(fixture.requests[0].userMessageSha256, rice[0].requests[0].userMessageSha256);
  assert.equal(fixture.requests[0].systemPromptSha256, rice[0].requests[0].systemPromptSha256);
  assert.equal(fixture.requests[0].schemaSha256, rice[0].requests[0].schemaSha256);
}
const prior = ['F', 'R', 'G'].map(stage => {
  const record = read(`docs/qa/reports/CURRENT-RECIPE-SHARING-2026-10-10-${stage}.json`);
  const attempts = record.synthetic.find(entry => entry.kind === 'preparation complete attempt evidence' && entry.fixture === baseline.experiment.fixtureId);
  const counts = record.synthetic.find(entry => entry.kind === 'preparation counts and handler evidence' && entry.fixture === baseline.experiment.fixtureId);
  assert.deepEqual(attempts.attempts[0].original, rice[0].original);
  assert.equal(hash(attempts.sdk[0].request.messages[0].content), rice[0].requests[0].systemPromptSha256);
  assert.equal(hash(attempts.sdk[0].request.messages[1].content), rice[0].requests[0].userMessageSha256);
  return { stage, counts, sameSourceContextAndInitialPrompts: true, candidateSha256: record.candidateSha256 };
});
for (const file of baseline.files) assert.equal(hash(readFileSync(file.path)), file.sha256, file.path);
const result = { format: 'fittrack-recipe-stability-reconciliation-v1', checkedAt: new Date().toISOString(), exit: 0,
  candidateSha256: baseline.candidateSha256, candidateHashStable: true, versions: baseline.versions, requestKindsVerified: [...requestKinds],
  allRiceInitialRequestsIdentical: true, comparableRiceSamples: 7, focusedRicePassed: rice.slice(0, 5).filter(fixture => fixture.semanticAssertionsCompleted).length,
  overallRicePassed: rice.filter(fixture => fixture.semanticAssertionsCompleted).length, gates, prior,
  liveGateRuns: 7, replacements: 0, reconciliationLiveCalls: 0, allDomainSdkCounts: 'UNVERIFIED_NOT_FULLY_INSTRUMENTED',
  handlerSdkCalls: gates.reduce((sum, gate) => sum + gate.preparationHandlerSdkCalls, 0), handlerLogicalCalls: gates.reduce((sum, gate) => sum + gate.preparationHandlerLogicalCalls, 0) };
writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ exit: 0, candidateHashStable: true, requestKindsVerified: result.requestKindsVerified, allRiceInitialRequestsIdentical: true,
  focusedRicePassed: result.focusedRicePassed, overallRicePassed: result.overallRicePassed, handlerSdkCalls: result.handlerSdkCalls, handlerLogicalCalls: result.handlerLogicalCalls,
  gates: gates.map(gate => ({ stage: gate.stage, counts: gate.counts, rice: { status: gate.rice.counts.status, sdk: gate.rice.counts.sdkCalls, first: gate.rice.firstReferences },
    failures: gate.failures.map(failure => ({ name: failure.fullName, error: failure.failureMessages[0].split('\n')[0] })),
    otherFixtures: gate.fixtures.filter(fixture => fixture !== gate.rice).map(fixture => ({ fixture: fixture.fixture, status: fixture.counts.status, sdk: fixture.counts.sdkCalls,
      logical: fixture.counts.preparationCalls, fit: fixture.finalProbe?.ok, total: fixture.finalOutput.totalTimeMinutes, validation: fixture.finalValidation.ok })) })) }));