// QA-only helper: pre-registers the acceptance bar, hashes the candidate and runs recorded eval series. Never prints credentials.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { loadEvalEnvironment, getMissingRequiredEvalKeys } from '../../../backend/scripts/run-eval.mjs';

const prefix = 'docs/qa/reports/RECIPE-REVERIFY-2026-10-11-';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const environment = await loadEvalEnvironment();
const redact = (text) => ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'].reduce((content, key) => (environment[key] ? content.split(environment[key]).join('[REDACTED]') : content), text);
const write = (path, value) => { assert.ok(!existsSync(path), `Preserve existing evidence: ${path}`); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };

function candidateFiles() {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0);
  return [...new Set(result.stdout.split('\0'))].filter((path) => path && existsSync(path) && /^(backend|shared|mobile)\/(src\/|lib\/|types\/|scripts\/|index\.|package\.json|tsconfig|vitest)/u.test(path));
}
const candidateHash = () => {
  const files = candidateFiles().map((path) => ({ path, sha256: hash(readFileSync(path)) }));
  return { files, sha256: hash(JSON.stringify(files)) };
};

const [, , stage, ...rest] = process.argv;

if (stage === 'baseline') {
  const candidate = candidateHash();
  const record = {
    format: 'fittrack-reverify-baseline-v1',
    capturedAt: new Date().toISOString(),
    liveCallsBeforeThisRecord: 0,
    candidateSha256: candidate.sha256,
    candidateFileCount: candidate.files.length,
    files: candidate.files,
    settingsFingerprint: hash(JSON.stringify(Object.fromEntries(['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_VERSION', 'AZURE_OPENAI_DEPLOYMENT_NAME'].map((key) => [key, environment[key] ?? null])))),
    missingCredentials: getMissingRequiredEvalKeys(environment),
    acceptanceBarPreRegisteredBeforeAnyLiveRun: {
      fullFileRecipeRuns: { count: 10, testsPerRun: 21, passBar: 'every run 21/21' },
      riceIsolated: { count: 10, filter: 'synthetic-saved-eight-steps-rice-serv', passBar: '10/10' },
      importIsolated: { count: 8, fixtures: ['side-dish-and-serving-actions', 'full-recipe-output-fields', 'indeterminate-spray-oil-stays-food', 'no-lost-or-invented-ingredients'], passBar: '8/8 each' },
      verdictRules: [
        'PASS only if every pre-registered live run passes and offline gates are green.',
        'Any failing live run is diagnosed from its raw output and classified: product defect, eval-rubric artefact, or provider variance. A failure whose served/accepted output is wrong (lost source action, invented value, wrong order) is a product defect and Blocking.',
        'A failure that is a controlled safe rejection (HTTP 422, usage 0, no writes, no wrong content) in at most 1 of 10 comparable runs is Non-blocking at most (PASS WITH ISSUES), because the stabilisation goal is mechanical robustness, not a statistical guarantee.',
        'Two or more failures of the same fixture, or any accepted wrong content, keep the verdict FAIL.',
        'No retry-until-green: failures stay recorded; series are not extended to dilute a failure.',
      ],
    },
  };
  write(`${prefix}baseline.json`, record);
  console.log(JSON.stringify({ stage, candidateFileCount: record.candidateFileCount, candidateSha256: record.candidateSha256, missingCredentials: record.missingCredentials }));
} else if (stage === 'live') {
  // usage: live <series> <count> <vitest args...>; each run is a fresh runner process
  const [series, countText, ...vitestArgs] = rest;
  const count = Number(countText);
  const baseline = JSON.parse(readFileSync(`${prefix}baseline.json`, 'utf8'));
  assert.ok(getMissingRequiredEvalKeys(environment).length === 0, 'credentials missing: UNVERIFIED');
  const summary = [];
  for (let run = 1; run <= count; run += 1) {
    const label = `${series}-run${String(run).padStart(2, '0')}`;
    const jsonPath = resolve(`${prefix}${label}-Report.json`);
    const outPath = `${prefix}${label}-Output.txt`;
    assert.ok(!existsSync(jsonPath) && !existsSync(outPath), `No repeated runs: ${label}`);
    const before = candidateHash().sha256;
    const started = new Date().toISOString();
    const child = spawnSync(process.execPath, ['scripts/run-eval.mjs', ...vitestArgs, '--reporter=default', '--reporter=json', `--outputFile=${jsonPath}`], {
      cwd: resolve('backend'), env: environment, encoding: 'utf8', maxBuffer: 96 * 1024 * 1024,
    });
    const finished = new Date().toISOString();
    const after = candidateHash().sha256;
    writeFileSync(outPath, redact(`${child.stdout ?? ''}\n--- stderr ---\n${child.stderr ?? ''}`));
    let counts = null;
    let failures = [];
    if (existsSync(jsonPath)) {
      const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
      counts = { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests };
      failures = report.testResults.flatMap((file) => file.assertionResults.filter((test) => test.status === 'failed').map((test) => ({ name: test.fullName, messages: test.failureMessages.map((message) => redact(message).slice(0, 4000)) })));
    }
    const entry = { label, exit: child.status, started, finished, candidateStable: before === after && before === baseline.candidateSha256, counts, failures: failures.map((failure) => failure.name) };
    write(`${prefix}${label}.json`, { ...entry, failures, outputSha256: hash(readFileSync(outPath)), reportSha256: existsSync(jsonPath) ? hash(readFileSync(jsonPath)) : null });
    summary.push(entry);
    console.log(JSON.stringify(entry));
  }
  write(`${prefix}${series}-summary.json`, { series, runs: summary, passedRuns: summary.filter((entry) => entry.exit === 0 && entry.counts?.failed === 0).length, totalRuns: summary.length });
} else {
  throw new Error(`Unknown stage ${stage}`);
}
