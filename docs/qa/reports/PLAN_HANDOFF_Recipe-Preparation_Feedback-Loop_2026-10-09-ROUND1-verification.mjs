import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const prefix = 'docs/qa/reports/PLAN_HANDOFF_Recipe-Preparation_Feedback-Loop_2026-10-09';
const store = 'docs/User Stories/Reciepe/';
const round = '_2026-10-09-r3-QA-R1';
const candidateHash = '59c7d826f4b0188ed82ee675ba20e787e5aa30f8459ea7680c7f364a6bcbed44';
const archiveHash = '0706f39479ab6f53eaf918b27b1ea5440b7cff43d704dcddf5977c20b47bca32';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = (name, data) => fs.writeFileSync(`${prefix}-ROUND1-${name}.json`, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
const artifact = (name) => `${store}B-2_Feedback-Loop_${name}${round}.json`;
const counts = (report) => ({ executed: report.numPassedTests + report.numFailedTests,
  passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests });
const verifyEntry = (entry) => {
  assert.equal(hash(entry.path), entry.sha256, entry.path);
  if (entry.bytes !== undefined) assert.equal(fs.statSync(entry.path).size, entry.bytes, entry.path);
};

async function audit() {
  assert.equal(hash(`${prefix}-before-ROUND1.md`), archiveHash);
  assert.equal(hash(artifact('Candidate')), candidateHash);
  const candidate = read(artifact('Candidate'));
  const current = read(artifact('Artifact-Manifest'));
  const historical = read(`${store}B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r2-completion.json`);
  const documentation = read(`${store}D-1_Feedback-Loop_Manifest_2026-10-09-r1.json`);
  for (const manifest of [current, historical, documentation]) for (const entry of manifest.artifacts) verifyEntry(entry);
  assert.equal(current.artifacts.length, 53);
  assert.equal(historical.artifacts.length, 83);
  assert.equal(documentation.artifacts.length, 11);
  verifyEntry(documentation.evidence.currentManifest);
  verifyEntry(documentation.evidence.historicalManifest);
  const published = new Map(documentation.ownFiles.map((entry) => [entry.path, entry]));
  const candidateDeltas = [];
  for (const entry of candidate.files) {
    if (hash(entry.path) === entry.sha256) continue;
    const delta = published.get(entry.path);
    assert.ok(delta, `Unexpected candidate delta: ${entry.path}`);
    assert.equal(delta.beforeSha256, entry.sha256, entry.path);
    verifyEntry(delta);
    candidateDeltas.push(entry.path);
  }
  assert.equal(candidateDeltas.length, 6);
  for (const entry of [...candidate.runtime, ...candidate.dependencies]) verifyEntry(entry);
  assert.equal(candidate.runtime.length, 338);
  verifyEntry(candidate.originalB2Baseline);
  verifyEntry(candidate.previousCandidate);
  assert.equal(hash(candidate.originalRoundBaseline), candidate.originalRoundBaselineSha256);
  const baseline = read(candidate.originalRoundBaseline);
  const owned = new Set(candidate.owned);
  const foreign = baseline.files.filter((entry) => !owned.has(entry.path));
  for (const entry of foreign) {
    if (published.has(entry.path)) continue;
    if (entry.path === `${prefix}.md`) assert.equal(entry.sha256, archiveHash);
    else verifyEntry(entry);
  }
  const d1Foreign = read(documentation.preservation.path).foreignFiles;
  for (const entry of d1Foreign) {
    if (entry.path === `${prefix}.md`) assert.equal(entry.sha256, archiveHash);
    else verifyEntry(entry);
  }
  const gateSummary = read(artifact('Gate-Summary'));
  for (const gate of Object.values(gateSummary.offline)) {
    assert.equal(hash(gate.output), gate.outputSha256);
    assert.equal(hash(gate.recordPath), gate.recordSha256);
    if (gate.report) {
      assert.equal(hash(gate.report), gate.reportSha256);
      assert.deepEqual(counts(read(gate.report)), gate.counts);
    }
  }
  const rawPath = `${store}B-2_Feedback-Loop_F-Output${round}.txt`;
  const rawHash = '36f4ffdc97fdd9945ca3d6e1e753df2c052f8f48fa0e12f34a8d3f94724546c7';
  assert.equal(hash(rawPath), rawHash);
  const raw = fs.readFileSync(rawPath, 'utf8').replace(/\x1b\[[0-9;]*m/gu, '');
  const labels = ['complete attempt evidence', 'semantic evidence', 'counts and handler evidence',
    'executed protection assertions', 'executed semantic assertions'];
  const records = Object.fromEntries(labels.map((label) => [label, new Map()]));
  for (const line of raw.split(/\r?\n/u)) {
    for (const label of labels) {
      const marker = `Synthetic preparation ${label} `;
      const index = line.indexOf(marker);
      if (index < 0) continue;
      const record = JSON.parse(line.slice(index + marker.length));
      assert.ok(!records[label].has(record.fixture));
      records[label].set(record.fixture, record);
    }
  }
  const reconciliation = read(artifact('F-Reconciliation'));
  const native = read(`${store}B-2_Feedback-Loop_F-Report${round}.json`);
  assert.deepEqual(counts(native), { executed: 5, passed: 2, failed: 3, skipped: 9 });
  const require = createRequire(path.resolve('package.json'));
  const preparation = require('./backend/dist/backend/src/lib/recipePreparation.js');
  const validation = require('./backend/dist/backend/src/lib/recipeAnalyzeValidation.js');
  const renderer = require('./backend/dist/backend/src/lib/instagramRenderer/index.js');
  const fixtures = [];
  let logicalCalls = 0;
  let sdkCalls = 0;
  let replayProbes = 0;
  for (const fixture of reconciliation.fixtures) {
    const complete = records['complete attempt evidence'].get(fixture.fixture);
    assert.ok(complete);
    assert.deepEqual(complete.attempts, fixture.attempts);
    assert.deepEqual(complete.sdk, fixture.sdk);
    const counters = records['counts and handler evidence'].get(fixture.fixture);
    assert.deepEqual(counters, fixture.counts);
    assert.equal(counters.unchanged, true);
    assert.deepEqual(counters.writes, { update: 0, replace: 0, create: 0 });
    assert.equal(counters.apiVersion, '2024-08-01-preview');
    const forced = fixture.initial.startsWith('forced');
    assert.equal(complete.sdk.length, complete.attempts.length - Number(forced));
    const original = complete.attempts[0].original;
    for (const [index, attempt] of complete.attempts.entries()) {
      assert.deepEqual(attempt.original, original);
      assert.equal(attempt.logicalCall, index + 1);
      assert.equal(attempt.signalPresent, true);
      assert.ok(attempt.timeout > 0 && attempt.timeout <= 20_000);
      if (index === 0) assert.equal(attempt.correction, undefined);
      else {
        assert.deepEqual(attempt.correction.latestDraft, complete.attempts[index - 1].output);
        assert.ok(attempt.correction.validationErrors.length);
      }
      const probe = await renderer.probeInstagramRecipeDetailsGeneratedText({ savedTitle: original.recipeContext.name,
        teaser: attempt.output.teaser, steps: attempt.output.steps.map((step) => step.description) });
      assert.deepEqual(probe, attempt.probe);
      replayProbes += 1;
      if (forced && index === 0) continue;
      const sdk = complete.sdk[index - Number(forced)];
      assert.deepEqual(JSON.parse(sdk.raw), attempt.output);
      assert.equal(sdk.finishReason, 'stop');
      assert.deepEqual(sdk.options, { maxRetries: 0, timeout: attempt.timeout, signalPresent: true });
      assert.equal(sdk.request.temperature, 0.2);
      assert.equal(sdk.request.max_tokens, 2048);
      assert.equal(sdk.request.model, 'gpt-4o-mini');
      assert.equal(sdk.request.response_format.type, 'json_schema');
      assert.equal(sdk.request.response_format.json_schema.strict, true);
      assert.equal(sdk.request.response_format.json_schema.schema.additionalProperties, false);
      assert.equal(sdk.request.response_format.json_schema.schema.properties.steps.items.additionalProperties, false);
      const data = JSON.parse(sdk.request.messages[1].content);
      assert.deepEqual(data, attempt.correction ? { originalPreparation: original,
        latestDraft: attempt.correction.latestDraft, validationErrors: attempt.correction.validationErrors } : original);
      assert.ok(sdk.request.messages[0].content.includes('Preparation v6'));
    }
    const final = complete.attempts.at(-1);
    const checked = validation.validateRecipeExportPreparationOutput(final.output, original.steps);
    const matches = native.testResults.flatMap((file) => file.assertionResults).filter((entry) => entry.fullName === fixture.nativeTestName);
    assert.equal(matches.length, 1);
    const test = matches[0];
    assert.ok(test);
    assert.equal(test.status, fixture.final.testStatus);
    assert.equal(final.probe.ok, fixture.final.fit);
    const protection = records['executed protection assertions'].has(fixture.fixture);
    const semantic = records['executed semantic assertions'].has(fixture.fixture);
    assert.equal(protection, fixture.final.protectionAssertionsCompleted);
    assert.equal(semantic, fixture.final.semanticPassed);
    const remainingFailures = final.probe.diagnostics.filter((entry) => entry.status === 'overflow');
    fixtures.push({ fixture: fixture.fixture, logical: complete.attempts.length, sdk: complete.sdk.length,
      http: counters.status, usage: counters.usageCalls, fit: final.probe.ok, structural: checked.ok,
      semanticsReached: fixture.final.independentSemanticAssertionReached, semanticsPassed: semantic,
      nativeStatus: test.status, failures: test.failureMessages, structuralErrors: checked.ok ? [] : checked.diagnostics,
      overflows: remainingFailures.map(({ itemIndex, measured }) => ({ itemIndex, measured })), final: final.output });
    logicalCalls += complete.attempts.length;
    sdkCalls += complete.sdk.length;
  }
  assert.equal(logicalCalls, 10);
  assert.equal(sdkCalls, 9);
  for (const name of ['R', 'G']) {
    const gate = read(artifact(name));
    assert.equal(gate.status, 'NOT_RUN_REQUIRED_LIVE_FAILURE');
    assert.equal(gate.exit, null);
  }
  const synthetic = { version: 1, teaser: 'Goldbraunes Brot', totalTimeMinutes: null, difficulty: null,
    steps: [{ order: 1, description: 'Mische den Teig.', sourceStepOrders: [1], extra: 'UNKNOWN_SENTINEL' }] };
  const diagnosis = validation.validateRecipeExportPreparationOutput(synthetic, [{ order: 1, description: 'Mische den Teig.' }]);
  assert.equal(diagnosis.ok, false);
  assert.deepEqual(preparation.recipePreparationAffectedFields(synthetic, diagnosis.diagnostics), []);
  const result = { candidateHash, archiveHash, currentArtifacts: 53, historicalArtifacts: 83, documentationArtifacts: 11,
    candidateFiles: candidate.files.length, authorizedPublicationDeltas: candidateDeltas,
    runtimeFiles: candidate.runtime.length, dependencyIdentities: candidate.dependencies.length,
    roundForeignFiles: foreign.length, d1ForeignFiles: d1Foreign.length,
    recordedOfflineCountsVerified: true, rawFHash: rawHash, recordedLogicalCalls: logicalCalls,
    recordedSdkCalls: sdkCalls, offlineRealFontReplayProbes: replayProbes, newProviderCalls: 0,
    unknownKeyOnlyMetadataCheck: 'PASS', fixtures };
  output('Audit', result);
  console.log(JSON.stringify({ ...result, fixtures: fixtures.map(({ final, failures, ...fixture }) => fixture) }));
}

function runOffline(name) {
  const suites = ['src/lib/recipeAnalyzeValidation.test.ts', 'src/functions/recipes.test.ts', 'src/functions/ai.test.ts',
    'src/lib/openai.recipeAnalyze.test.ts', 'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/lib/recipePreparation.test.ts'];
  const args = name === 'Focused' ? ['exec', '--workspace=backend', '--', 'vitest', 'run', ...suites]
    : name === 'Units' ? ['run', 'test', '--workspace=backend', '--']
      : ['run', 'typecheck', '--workspace=backend'];
  const report = `${prefix}-ROUND1-${name}-Report.json`;
  const log = `${prefix}-ROUND1-${name}-Output.txt`;
  if (name !== 'Typecheck') args.push('--reporter=dot', '--reporter=json', '--silent', `--outputFile=${path.resolve(report)}`);
  for (const file of [log, report, `${prefix}-ROUND1-${name}.json`]) assert.ok(!fs.existsSync(file), `Refusing overwrite: ${file}`);
  assert.equal(hash(artifact('Candidate')), candidateHash);
  const start = new Date().toISOString();
  const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const run = spawnSync(process.execPath, [npm, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' } });
  assert.ifError(run.error);
  const end = new Date().toISOString();
  fs.writeFileSync(log, `${run.stdout ?? ''}${run.stderr ?? ''}`, { flag: 'wx' });
  const record = { command: ['npm', ...args.map((arg) => arg.startsWith('--outputFile=') ? `--outputFile=${report}` : arg)],
    start, end, exit: run.status, signal: run.signal, candidateHash, output: log, outputSha256: hash(log),
    report: name === 'Typecheck' ? null : report,
    reportSha256: name === 'Typecheck' ? null : hash(report), counts: name === 'Typecheck' ? null : counts(read(report)),
    liveCalls: 0, buildRuns: 0 };
  output(name, record);
  console.log(JSON.stringify(record));
  process.exitCode = run.status ?? 1;
}

function finish() {
  const baseline = JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/u, ''));
  assert.equal(baseline.files.length, 994);
  const report = `${prefix}.md`;
  const archive = `${prefix}-before-ROUND1.md`;
  const manifest = `${prefix}-ROUND1-Manifest.json`;
  assert.equal(hash(archive), archiveHash);
  assert.equal(fs.statSync(archive).size, 35526);
  assert.ok(!fs.existsSync(manifest), 'Refusing to overwrite final manifest');
  const text = fs.readFileSync(report, 'utf8');
  assert.equal((text.match(/^- Verdict:/gmu) ?? []).length, 1);
  assert.ok(/^- Verdict: `FAIL`$/mu.test(text));
  assert.ok(/^- Release Gate: `CLOSED`$/mu.test(text));
  assert.ok(text.includes('fittrack-qa-v1'));
  const criteria = [...text.matchAll(/^\| AC-(\d+) \|/gmu)].map((match) => Number(match[1]));
  assert.deepEqual(criteria, Array.from({ length: 14 }, (_, index) => index + 1));
  const active = text.split('## Remaining Actionable Finding')[1].split('## Recorded F Reconciliation')[0];
  for (const field of ['Finding key', 'Plan reference', 'Acceptance criterion', 'Description', 'Criticality', 'Owner', 'Evidence', 'Recommendation']) {
    assert.ok(active.includes(`- ${field}:`), field);
  }
  assert.ok(active.includes('- Criticality: Blocking.'));
  assert.ok(active.includes('- Owner: Backend.'));
  for (const entry of baseline.files) {
    if (entry.path === report) assert.equal(entry.sha256, archiveHash);
    else verifyEntry(entry);
  }
  const names = ['verification.mjs', 'Audit.json', 'Focused.json', 'Focused-Output.txt', 'Focused-Report.json',
    'Units.json', 'Units-Output.txt', 'Units-Report.json', 'Typecheck.json', 'Typecheck-Output.txt', 'Manifest.json'];
  const allowed = new Set([archive, ...names.map((name) => `${prefix}-ROUND1-${name}`)]);
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  assert.ifError(listed.error);
  assert.equal(listed.status, 0);
  const original = new Set(baseline.files.map((entry) => entry.path));
  const additions = [...new Set(listed.stdout.split('\0').filter(Boolean))].filter((file) =>
    fs.existsSync(file) && fs.statSync(file).isFile() && !/(?:^|\/)(?:local\.settings\.json|\.env(?:\..*)?)$/iu.test(file)
    && !original.has(file));
  for (const file of additions) assert.ok(allowed.has(file), `Unauthorized new path: ${file}`);
  const candidate = read(artifact('Candidate'));
  assert.equal(hash(artifact('Candidate')), candidateHash);
  for (const entry of [...candidate.runtime, ...candidate.dependencies]) verifyEntry(entry);
  const documentation = read(`${store}D-1_Feedback-Loop_Manifest_2026-10-09-r1.json`);
  const published = new Map(documentation.ownFiles.map((entry) => [entry.path, entry]));
  let docDeltas = 0;
  for (const entry of candidate.files) {
    if (hash(entry.path) === entry.sha256) continue;
    if (entry.path === report) {
      assert.equal(entry.sha256, archiveHash);
      continue;
    }
    const delta = published.get(entry.path);
    assert.ok(delta, entry.path);
    assert.equal(delta.beforeSha256, entry.sha256);
    verifyEntry(delta);
    docDeltas += 1;
  }
  assert.equal(docDeltas, 6);
  for (const file of [artifact('Artifact-Manifest'), `${store}B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r2-completion.json`,
    `${store}D-1_Feedback-Loop_Manifest_2026-10-09-r1.json`]) {
    for (const entry of read(file).artifacts) verifyEntry(entry);
  }
  const focused = read(`${prefix}-ROUND1-Focused.json`);
  const units = read(`${prefix}-ROUND1-Units.json`);
  const typecheck = read(`${prefix}-ROUND1-Typecheck.json`);
  for (const record of [focused, units, typecheck]) {
    assert.equal(record.exit, 0);
    assert.equal(hash(record.output), record.outputSha256);
    if (record.report) {
      assert.equal(hash(record.report), record.reportSha256);
      assert.deepEqual(counts(read(record.report)), record.counts);
    }
  }
  assert.deepEqual(focused.counts, { executed: 519, passed: 519, failed: 0, skipped: 0 });
  assert.deepEqual(units.counts, { executed: 1600, passed: 1600, failed: 0, skipped: 0 });
  const regressions = read(focused.report).testResults.flatMap((file) => file.assertionResults)
    .filter((entry) => entry.fullName.includes('QA-R1'));
  assert.equal(regressions.length, 24);
  assert.ok(regressions.every((entry) => entry.status === 'passed'));
  const auditResult = read(`${prefix}-ROUND1-Audit.json`);
  assert.equal(auditResult.newProviderCalls, 0);
  assert.equal(auditResult.offlineRealFontReplayProbes, 10);
  const links = [...text.matchAll(/\]\(([^)]+)\)/gu)].map((match) =>
    path.resolve(path.dirname(report), decodeURIComponent(match[1].split('#')[0])));
  for (const file of links) assert.ok(fs.existsSync(file) || file === path.resolve(manifest), file);
  const asset = (file) => ({ path: file, sha256: hash(file), bytes: fs.statSync(file).size });
  const verifiedFixed = [
    { key: 'Q1-01', id: 'FT-QA-2026-081', criteria: ['AC-10'], scope: 'Unknown-key-only/nonstring metadata logging',
      evidence: ['backend/src/lib/recipePreparation.ts', 'backend/src/lib/recipePreparation.test.ts', 'backend/src/functions/recipes.test.ts'] },
    { key: 'Q1-02', id: 'FT-QA-2026-082', criteria: ['AC-4', 'AC-10'], scope: 'Production-derived compact/large/teaser diagnostic font metadata',
      evidence: ['backend/src/lib/recipePreparation.ts', 'backend/src/lib/recipePreparation.test.ts'] },
    { key: 'Q1-04', id: 'FT-QA-2026-084', criteria: ['AC-11', 'AC-12'], scope: 'Test-only pasta suffix/component scope with retained negatives',
      evidence: ['backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts', 'backend/src/lib/recipeAnalyzeValidation.test.ts'] },
    { key: 'Q1-05', id: 'FT-QA-2026-085', criteria: ['AC-11', 'AC-12'], scope: 'Test-only exact full-source single-stage dough equivalence with retained negatives',
      evidence: ['backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts', 'backend/src/lib/recipeAnalyzeValidation.test.ts'] },
  ].map((finding) => ({ ...finding, owner: 'Backend', result: 'VERIFIED_FIXED_SCOPED_CLOSURE_RECOMMENDED',
    qaEvidence: [focused.report, `${prefix}-ROUND1-Audit.json`], registerUpdated: false }));
  const result = {
    format: 'fittrack-qa-v1-response', date: '2026-10-09', round: 'ROUND1', qaReport: report,
    verdict: 'FAIL', releaseGate: 'CLOSED', candidateHash, archive: asset(archive), report: asset(report),
    verifiedFixed, remainingFindings: [{ key: 'Q1-03', id: 'FT-QA-2026-083', criticality: 'Blocking', owner: 'Backend',
      criteria: ['AC-11', 'AC-12'], result: 'REQUIRED_CURRENT_F_FAILED',
      evidence: [artifact('F-Reconciliation'), `${store}B-2_Feedback-Loop_F-Report${round}.json`, `${prefix}-ROUND1-Audit.json`],
      recommendation: 'Smallest separately authorized owner correction/investigation; no gate waiver or automatic retry' }],
    frozenF: { exit: 1, counts: { executed: 5, passed: 2, failed: 3, skipped: 9 }, logicalCalls: 10, sdkCalls: 9,
      raw: asset(`${store}B-2_Feedback-Loop_F-Output${round}.txt`),
      report: asset(`${store}B-2_Feedback-Loop_F-Report${round}.json`),
      fixtures: auditResult.fixtures.map(({ final, failures, ...fixture }) => fixture) },
    requiredRG: { status: 'NOT_RUN_REQUIRED_LIVE_FAILURE', blockedBy: 'F', exit: null, calls: 0, required: true, waived: false },
    independentOffline: { focused, units, typecheck, regressionCases: 24, offlineRealFontReplayProbes: 10,
      sourceImportAstComparisons: 8, untouchedContractHashComparisons: 13, syntaxExit: 0, auditExits: [1, 0],
      reportContractExit: 0, liveCalls: 0, buildRuns: 0, deploys: 0 },
    preservation: { result: 'PASS', baselineFiles: 994, unchangedOriginalFiles: 993,
      originalReportPreservedAsExactArchive: true, onlyOriginalPathReplaced: report,
      baselineSha256: crypto.createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
      baseline: baseline.files, newPaths: [...additions, manifest].sort(),
      candidateFiles: candidate.files.length, authorizedDocumentationDeltas: docDeltas,
      archivedCandidateReportSubstitution: true,
      runtimeFilesUnchanged: candidate.runtime.length, dependencyIdentitiesUnchanged: candidate.dependencies.length,
      currentArtifacts: 53, historicalArtifacts: 83, documentationArtifacts: 11,
      roundForeignFiles: 926, d1ForeignFiles: 982,
      limitations: ['Private settings/env excluded', 'Ignored generated output/dependency tree not exhaustively baselined',
        'No full inherited release acceptance or Linux native install certification'] },
    releaseAndManual: { r1: 'SKIPPED', candidateReadyForRelease: false, linuxNode22CleanBuild: 'UNVERIFIED',
      stagingMirPublishParity: 'UNVERIFIED', authenticatedNativeSmoke: 'MANUAL_VALIDATION_REQUIRED',
      humanCookingMetadataReview: 'MANUAL_VALIDATION_REQUIRED', historicalQ19Closed: false,
      retryCount: 1, remainingPossibleCorrectionRounds: 1, remainingRoundAuthorized: false },
    boundaries: { codeOrTestEdits: 0, knowledgeBaseEdits: 0, registerEdits: 0, sourceRepairs: 0,
      historicalEvidenceRepairs: 0, newLiveFGates: 0, liveRGates: 0, liveGGates: 0, providerCalls: 0,
      cosmosCalls: 0, rebuilds: 0, deployment: 0, nativeMobileEasOperations: 0, delegation: 0,
      registration: 0, commitOrBranch: 0 },
    assets: [report, archive, ...names.filter((name) => name !== 'Manifest.json').map((name) => `${prefix}-ROUND1-${name}`)].map(asset),
    selfHashExcluded: true,
  };
  output('Manifest', result);
  for (const file of links) assert.ok(fs.existsSync(file), file);
  const saved = read(manifest);
  assert.equal(saved.report.sha256, hash(report));
  for (const entry of saved.assets) verifyEntry(entry);
  console.log(JSON.stringify({ manifest: asset(manifest), verdict: saved.verdict, gate: saved.releaseGate,
    reportContract: 'PASS', baselineFiles: 994, originalFilesUnchanged: 993,
    runtimeFilesUnchanged: candidate.runtime.length, allLocalLinksExist: true, newProviderCalls: 0 }));
}

const action = process.argv[2];
if (action === 'audit') await audit();
else if (action === 'finish') finish();
else if (['Focused', 'Units', 'Typecheck'].includes(action)) runOffline(action);
else throw new Error('Allowed actions: audit, Focused, Units, Typecheck, finish; no build or live action exists');