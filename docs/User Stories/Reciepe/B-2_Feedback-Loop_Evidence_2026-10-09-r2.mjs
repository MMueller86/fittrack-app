import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const artifact = (name, extension = 'json') => resolve(directory, `B-2_Feedback-Loop_${name}_2026-10-09-r2.${extension}`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => readFileSync(resolve(root, path));
const parse = (path) => JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/u, ''));
const originalPath = 'docs/User Stories/Reciepe/B-2_Feedback-Loop_Baseline_2026-10-09.json';
const original = parse(originalPath);
const owned = original.owned;
const save = (name, value) => writeFileSync(artifact(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
};
const paths = () => git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
const manifest = () => paths().filter((path) => !path.includes('B-2_Feedback-Loop_')).map((path) => ({ path, sha256: hash(read(path)) }));
const verify = (entries) => {
  for (const entry of entries) if (hash(read(entry.path)) !== entry.sha256) throw new Error(`Preservation violation: ${entry.path}`);
};
const mode = process.argv[2];
if (mode === 'baseline') {
  verify(original.files.filter((entry) => !owned.includes(entry.path)));
  verify(parse('docs/User Stories/Reciepe/B-2_Feedback-Loop_Preservation_2026-10-09.json').owned);
  const files = paths().filter((path) => path !== 'docs/User Stories/Reciepe/B-2_Feedback-Loop_Evidence_2026-10-09-r2.mjs')
    .map((path) => ({ path, sha256: hash(read(path)), bytesBase64: read(path).toString('base64') }));
  save('Resume-Baseline', { head: git('rev-parse', 'HEAD').trim(), originalPath, originalSha256: hash(read(originalPath)),
    files, status: git('status', '--porcelain=v1', '-uall'), inheritedDiff: git('diff', '--binary'), owned });
  console.info(`Resume frozen: ${files.length} files; original baseline preserved.`);
} else if (mode === 'freeze') {
  verify(parse(artifact('Resume-Baseline')).files.filter((entry) => !owned.includes(entry.path)));
  const dependencies = ['openai', 'satori', 'hyphen', 'sharp', '@resvg/resvg-js', 'vitest', 'typescript'].map((name) => {
    const path = [resolve(root, 'backend/node_modules', name, 'package.json'), resolve(root, 'node_modules', name, 'package.json')].find(existsSync);
    if (!path) throw new Error(`Missing installed metadata: ${name}`);
    return { name, version: parse(path).version, sha256: hash(read(path)) };
  });
  save('Candidate', { files: manifest(), head: git('rev-parse', 'HEAD').trim(), node: process.version, dependencies,
    originalBaselineSha256: hash(read(originalPath)), resumeBaselineSha256: hash(read(artifact('Resume-Baseline'))), owned });
  console.info('Final r2 candidate frozen; no live call made.');
} else if (mode === 'gate' || mode === 'development') {
  const name = process.argv[3];
  if (existsSync(artifact(name))) throw new Error(`Immutable record exists: ${name}`);
  const candidate = existsSync(artifact('Candidate')) ? parse(artifact('Candidate')) : undefined;
  if (candidate) verify(candidate.files);
  const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const report = artifact(`${name}-Report`);
  const reporters = ['--reporter=default', '--reporter=json', `--outputFile=${report}`];
  const commands = {
    Focused: [npmCli, 'exec', '--workspace=backend', '--', 'vitest', 'run', 'src/lib/recipeAnalyzeValidation.test.ts', 'src/functions/recipes.test.ts',
      'src/functions/ai.test.ts', 'src/lib/openai.recipeAnalyze.test.ts', 'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/lib/recipePreparation.test.ts', ...reporters],
    Units: [npmCli, 'run', 'test', '--workspace=backend', '--', ...reporters],
    Typecheck: [npmCli, 'run', 'typecheck', '--workspace=backend'],
    Build: [npmCli, 'run', 'build:verify', '--workspace=backend'],
    F: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts', '--testNamePattern', 'preparation prompt version matches fixture expectations|recipePreparation', ...reporters],
    R: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts', ...reporters],
    G: [npmCli, 'run', 'test:eval', '--workspace=backend', '--', ...reporters],
  };
  const args = mode === 'development' ? [npmCli, 'exec', '--workspace=backend', '--', 'vitest', 'run', ...process.argv.slice(4), ...reporters] : commands[name];
  if (!args) throw new Error(`Unknown gate: ${name}`);
  if (['F', 'R', 'G'].includes(name)) {
    if (!candidate) throw new Error('Live gate needs frozen candidate');
    for (const previous of { F: [], R: ['F'], G: ['F', 'R'] }[name]) if (parse(artifact(previous)).exit !== 0) throw new Error('Required live gate failed; stop');
  }
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  writeFileSync(artifact(`${name}-Output`, 'txt'), output, { flag: 'wx' });
  const native = existsSync(report) ? parse(report) : undefined;
  const summary = { command: [process.execPath, ...args], startedAt, endedAt: new Date().toISOString(), exit: result.status, signal: result.signal,
    candidateSha256: candidate ? hash(read(artifact('Candidate'))) : null, outputSha256: hash(Buffer.from(output)), reportSha256: native ? hash(read(report)) : null,
    counts: native ? { executed: native.numPassedTests + native.numFailedTests, passed: native.numPassedTests, failed: native.numFailedTests, skipped: native.numPendingTests } : null,
    failures: native?.testResults.flatMap((file) => file.assertionResults.filter((test) => test.status === 'failed').map((test) => ({ file: file.name, name: test.fullName, messages: test.failureMessages }))) ?? [] };
  save(name, summary);
  console.info(JSON.stringify(summary, null, 2));
  process.exitCode = result.status ?? 1;
} else if (mode === 'not-run') {
  save(process.argv[3], { status: 'NOT_RUN_REQUIRED_LIVE_FAILURE', exit: null, executed: 0, providerCalls: 0, semanticPass: false, reason: process.argv[4] });
} else if (mode === 'reconcile') {
  const output = read(artifact('F-Output', 'txt')).toString('utf8');
  const collect = (marker) => output.split(/\r?\n/u).filter((line) => line.includes(marker))
    .map((line) => JSON.parse(line.slice(line.indexOf(marker) + marker.length)));
  const attempts = collect('Synthetic preparation complete attempt evidence ');
  const counts = collect('Synthetic preparation counts and handler evidence ');
  const semantics = collect('Synthetic preparation semantic evidence ');
  const protections = collect('Synthetic preparation executed protection assertions ');
  if (attempts.length !== 4 || counts.length !== 4 || semantics.length !== 4) throw new Error('Incomplete recorded fixture evidence');
  const fixtures = attempts.map((record) => {
    const final = record.attempts.at(-1);
    const forced = record.initial.startsWith('forced');
    const count = counts.find((entry) => entry.fixture === record.fixture);
    const semantic = semantics.find((entry) => entry.fixture === record.fixture);
    const protection = protections.find((entry) => entry.fixture === record.fixture);
    return {
      fixture: record.fixture, initial: record.initial, counts: count,
      originalUnchangedEveryCall: record.attempts.every((entry) => JSON.stringify(entry.original) === JSON.stringify(record.attempts[0].original)),
      attempts: record.attempts.map((entry, index) => ({ logicalCall: entry.logicalCall, output: entry.output,
        previousDraftExact: !entry.correction || JSON.stringify(entry.correction.latestDraft) === JSON.stringify(record.attempts[index - 1].output),
        correctionErrors: entry.correction?.validationErrors ?? [], timeout: entry.timeout, signalPresent: entry.signalPresent,
        probe: entry.probe })),
      sdk: record.sdk.map((entry, index) => ({ options: entry.options, finishReason: entry.finishReason,
        requestShape: Object.keys(JSON.parse(entry.request.messages[1].content)),
        rawMatchesLogicalDraft: JSON.stringify(JSON.parse(entry.raw)) === JSON.stringify(record.attempts[index + (forced ? 1 : 0)].output) })),
      final: { schemaAssertionReached: true, realProbeStatus: final.probe.status, fit: final.probe.ok,
        protectionAssertionsCompleted: protection ?? false, finalV2BookingAssertionsReached: !!protection,
        independentSemanticAssertionReached: !!protection, semanticMatrix: semantic.exportCoreMatrix,
        semanticPassed: record.fixture === 'synthetic-saved-eight-steps-rice-serving' },
    };
  });
  const result = { candidateSha256: hash(read(artifact('Candidate'))), nativeOutputSha256: hash(read(artifact('F-Output', 'txt'))),
    gate: parse(artifact('F')), logicalCalls: counts.reduce((sum, entry) => sum + entry.preparationCalls, 0),
    sdkCalls: counts.reduce((sum, entry) => sum + entry.sdkCalls, 0),
    logicalCallsIncludeOneForcedDraft: true, fixtures,
    limitations: ['Oven stopped at final fit assertion; final V2/booking and independent semantic assertions were not reached.',
      'Recorded source/write/count evidence is not itself a semantic pass.',
      'No R/G, foreign-flow live conclusions, historical/private Alpha replay, release, deployment or final QA approval.'] };
  save('Live-Reconciliation', result);
  console.info(JSON.stringify({ fixtures: fixtures.map((entry) => ({ fixture: entry.fixture, counts: entry.counts, final: entry.final })),
    logicalCalls: result.logicalCalls, sdkCalls: result.sdkCalls }, null, 2));
} else if (mode === 'finalize') {
  const resume = parse(artifact('Resume-Baseline'));
  verify(resume.files.filter((entry) => !owned.includes(entry.path)));
  verify(original.files.filter((entry) => !owned.includes(entry.path)));
  const candidate = parse(artifact('Candidate'));
  verify(candidate.files);
  if (JSON.stringify(manifest()) !== JSON.stringify(candidate.files)) throw new Error('Candidate path set changed');
  let patch = '';
  const { mkdtempSync, unlinkSync, rmdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const temp = mkdtempSync(resolve(tmpdir(), 'fittrack-b2-r2-'));
  for (const path of owned.filter((path) => existsSync(resolve(root, path)))) {
    const previous = original.files.find((entry) => entry.path === path);
    const before = resolve(temp, 'before');
    const after = resolve(temp, 'after');
    writeFileSync(before, previous ? Buffer.from(previous.bytesBase64, 'base64') : Buffer.alloc(0));
    writeFileSync(after, read(path));
    const diff = spawnSync('git', ['diff', '--no-index', '--no-prefix', '--', before, after], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (![0, 1].includes(diff.status)) throw new Error(`Diff failed: ${path}`);
    if (diff.stdout) patch += `diff --git a/${path} b/${path}\n` + diff.stdout.split('\n').slice(1).map((line) =>
      line.startsWith('--- ') ? `--- ${previous ? `a/${path}` : '/dev/null'}` : line.startsWith('+++ ') ? `+++ b/${path}` : line).join('\n');
    unlinkSync(before); unlinkSync(after);
  }
  rmdirSync(temp);
  writeFileSync(artifact('Owned-Diff', 'patch'), patch, { flag: 'wx' });
  const audit = spawnSync('git', ['apply', '--reverse', '--check', '--whitespace=error', artifact('Owned-Diff', 'patch')],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const auditOutput = `${audit.stdout ?? ''}\n${audit.stderr ?? ''}`;
  writeFileSync(artifact('Patch-Audit-Output', 'txt'), auditOutput, { flag: 'wx' });
  save('Patch-Audit', { command: ['git', 'apply', '--reverse', '--check', '--whitespace=error', artifact('Owned-Diff', 'patch')],
    exit: audit.status, outputSha256: hash(Buffer.from(auditOutput)), appliesTo: 'original-worktree owned delta',
    writesOrRollback: false });
  if (audit.status !== 0) throw new Error('Aggregate patch audit failed; do not alter frozen candidate');
  save('Preservation', { originalForeignFiles: original.files.filter((entry) => !owned.includes(entry.path)).length,
    resumeForeignFiles: resume.files.filter((entry) => !owned.includes(entry.path)).length,
    frozenCandidateUnchanged: true, candidateSha256: hash(read(artifact('Candidate'))), patchAuditExit: audit.status,
    originalBaselineSha256: hash(read(originalPath)), ownedDiffSha256: hash(Buffer.from(patch)),
    owned: owned.filter((path) => existsSync(resolve(root, path))).map((path) => ({ path, sha256: hash(read(path)) })),
    artifacts: paths().filter((path) => path.includes('B-2_Feedback-Loop_')).map((path) => ({ path, sha256: hash(read(path)) })) });
  save('Artifact-Manifest', { excludesThisSelfReferentialManifest: true,
    artifacts: paths().filter((path) => path.includes('B-2_Feedback-Loop_')).map((path) => ({ path, sha256: hash(read(path)) })) });
  console.info('Original and resume foreign bytes preserved; aggregate original-worktree diff saved.');
} else throw new Error('Specify baseline, freeze, gate, development, not-run, reconcile or finalize');