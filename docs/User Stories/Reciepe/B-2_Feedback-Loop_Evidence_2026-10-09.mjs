import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const require = createRequire(resolve(root, 'backend/package.json'));
const prefix = 'B-2_Feedback-Loop_';
const suffix = '_2026-10-09';
const artifact = (name, extension = 'json') => resolve(directory, `${prefix}${name}${suffix}.${extension}`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (path) => readFileSync(resolve(root, path));
const save = (name, data) => writeFileSync(artifact(name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
};
const paths = () => git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
const owned = [
  'backend/src/functions/recipes.ts', 'backend/src/functions/recipes.test.ts',
  'backend/src/functions/ai.test.ts', 'backend/src/lib/openai.ts',
  'backend/src/lib/openai.recipeAnalyze.test.ts', 'backend/src/lib/recipeAnalyzeValidation.ts',
  'backend/src/lib/recipeAnalyzeValidation.test.ts', 'backend/src/lib/recipePreparation.ts',
  'backend/src/lib/recipePreparation.test.ts', 'backend/src/lib/prompts/recipeAnalyze.ts',
  'backend/src/lib/prompts/recipeAnalyze.eval.test.ts', 'backend/src/lib/prompts/recipeAnalyze.eval.fixtures.ts',
];
const manifest = () => paths().filter((path) => !path.includes(prefix)).map((path) => ({ path, sha256: hash(read(path)) }));
const mode = process.argv[2];
if (mode === 'baseline') {
  const b1 = JSON.parse(read('docs/User Stories/Reciepe/B-1_Feedback-Loop_Evidence_2026-10-09.json'));
  for (const entry of b1.owned) {
    if (hash(read(entry.path)).toLowerCase() !== entry.endingSha256.toLowerCase()) {
      throw new Error(`B-1 dependency mismatch: ${entry.path}`);
    }
  }
  const files = manifest().map((entry) => ({ ...entry, bytesBase64: read(entry.path).toString('base64') }));
  save('Baseline', { head: git('rev-parse', 'HEAD').trim(), status: git('status', '--porcelain=v1', '-uall'), files,
    inheritedDiff: git('diff', '--binary'), b1Verified: true, owned });
  console.info(`Baseline frozen: ${files.length} files; B-1 hashes verified.`);
} else if (mode === 'record-development') {
  const output = readFileSync(process.argv[3]);
  writeFileSync(artifact('Development-Handler-Output', 'txt'), output, { flag: 'wx' });
  save('Offline', {
    status: 'STOP_FAILED_DEVELOPMENT_ASSERTION_PARTIAL_IMPLEMENTATION',
    runs: [
      { command: 'node --check docs/User Stories/Reciepe/B-2_Feedback-Loop_Evidence_2026-10-09.mjs', exit: 0 },
      { command: 'npm exec --workspace=backend -- vitest run src/lib/recipeAnalyzeValidation.test.ts --testNamePattern "B-2 source authority and diagnostic indices"',
        exit: 0, executed: 9, passed: 9, failed: 0, skipped: 140, rawEvidence: 'VS Code tool result; summary only in this artifact' },
      { command: 'npm exec --workspace=backend -- vitest run src/lib/recipePreparation.test.ts --reporter=dot',
        exit: 0, executed: 5, passed: 5, failed: 0, skipped: 0, rawEvidence: 'VS Code tool result; summary only in this artifact' },
      { command: 'npm exec --workspace=backend -- vitest run src/functions/recipes.test.ts --testNamePattern "returns a transient, server-generated|logs only the latest affected|does not track usage for a V2 provider failure|rejects empty saved cooking" --reporter=dot',
        exit: 1, executed: 4, passed: 3, failed: 1, skipped: 101,
        rawEvidence: `${prefix}Development-Handler-Output${suffix}.txt`, outputSha256: hash(output),
        failure: 'Expected only semantic unknown-source diagnostic; newline also produces template:INVALID_TEXT@steps[0].description. No retry or assertion repair performed.' },
    ],
    declaredGates: ['Focused', 'Units', 'Typecheck', 'Build', 'F', 'R', 'G'].map((name) => ({ name,
      status: 'NOT_RUN_STOP_ON_FAILED_ASSERTION', exit: null, executed: 0, passed: 0, failed: 0, skipped: null })),
    credentialStatus: 'NOT_CHECKED; credentials were not read; live checks may use only official runner',
  });
  for (const name of ['F', 'R', 'G']) save(name, { status: 'NOT_RUN_STOP_ON_FAILED_ASSERTION', exit: null,
    executed: 0, passed: 0, failed: 0, skipped: null, providerCalls: 0, semanticPass: false,
    reason: 'Implementation stopped before required offline gates and candidate live evaluation.' });
  console.info('Development failure and non-execution records saved; no test was retried.');
} else if (mode === 'freeze') {
  const packages = ['openai', 'satori', 'hyphen', 'sharp', '@resvg/resvg-js', 'vitest', 'typescript'];
  save('Candidate', { head: git('rev-parse', 'HEAD').trim(), files: manifest(), node: process.version,
    dependencies: packages.map((name) => {
      const metadata = [resolve(root, 'backend/node_modules', name, 'package.json'), resolve(root, 'node_modules', name, 'package.json')]
        .find((path) => existsSync(path));
      if (!metadata) throw new Error(`Installed dependency metadata missing: ${name}`);
      return { name, version: JSON.parse(readFileSync(metadata, 'utf8')).version, packageSha256: hash(readFileSync(metadata)) };
    }),
    scope: owned, inherited: 'Complete tracked/untracked baseline, including B-1, dependencies and bundled assets; not permission to publish the dirty directory.' });
  console.info('Candidate frozen.');
} else if (mode === 'gate') {
  const name = process.argv[3];
  if (existsSync(artifact(name))) throw new Error(`Immutable gate already exists: ${name}`);
  const candidate = existsSync(artifact('Candidate')) ? JSON.parse(readFileSync(artifact('Candidate'), 'utf8')) : null;
  if (candidate) for (const entry of candidate.files) {
    if (hash(read(entry.path)) !== entry.sha256) throw new Error(`Frozen candidate changed: ${entry.path}`);
  }
  const report = artifact(`${name}-Report`);
  const npmCli = resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const focused = ['src/lib/recipeAnalyzeValidation.test.ts', 'src/functions/recipes.test.ts', 'src/functions/ai.test.ts',
    'src/lib/openai.recipeAnalyze.test.ts', 'src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts', 'src/lib/recipePreparation.test.ts'];
  const reporter = ['--reporter=default', '--reporter=json', `--outputFile=${report}`];
  const commands = {
    Focused: [npmCli, 'exec', '--workspace=backend', '--', 'vitest', 'run', ...focused, ...reporter],
    Units: [npmCli, 'run', 'test', '--workspace=backend', '--', ...reporter],
    Typecheck: [npmCli, 'run', 'typecheck', '--workspace=backend'],
    Build: [npmCli, 'run', 'build:verify', '--workspace=backend'],
    F: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts', '--testNamePattern', 'preparation prompt version matches fixture expectations|recipePreparation', ...reporter],
    R: ['backend/scripts/run-eval.mjs', 'src/lib/prompts/recipeAnalyze.eval.test.ts', ...reporter],
    G: [npmCli, 'run', 'test:eval', '--workspace=backend', '--', ...reporter],
  };
  if (!commands[name]) throw new Error(`Unknown gate ${name}`);
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, commands[name], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  writeFileSync(artifact(`${name}-Output`, 'txt'), output, { flag: 'wx' });
  const counts = existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : null;
  const summary = { command: [process.execPath, ...commands[name]], startedAt, endedAt: new Date().toISOString(),
    exit: result.status, signal: result.signal, candidateSha256: candidate ? hash(readFileSync(artifact('Candidate'))) : null,
    outputSha256: hash(Buffer.from(output)), reportSha256: counts ? hash(readFileSync(report)) : null,
    counts: counts ? { total: counts.numTotalTests, passed: counts.numPassedTests, failed: counts.numFailedTests,
      skipped: counts.numPendingTests, executed: counts.numPassedTests + counts.numFailedTests } : null,
    failures: counts?.testResults.flatMap((file) => file.assertionResults.filter((test) => test.status === 'failed')
      .map((test) => ({ file: file.name.replace(root, ''), name: test.fullName, messages: test.failureMessages }))) ?? [],
  };
  save(name, summary);
  console.info(JSON.stringify(summary, null, 2));
  process.exitCode = result.status ?? 1;
} else if (mode === 'finalize') {
  const baseline = JSON.parse(readFileSync(artifact('Baseline'), 'utf8'));
  const unchanged = baseline.files.filter((entry) => !owned.includes(entry.path));
  for (const entry of unchanged) if (hash(read(entry.path)) !== entry.sha256) throw new Error(`Foreign file changed: ${entry.path}`);
  let patch = '';
  for (const path of owned.filter((path) => existsSync(resolve(root, path)))) {
    const previous = baseline.files.find((entry) => entry.path === path);
    const beforePath = artifact('Temporary-Before', 'tmp');
    const afterPath = artifact('Temporary-After', 'tmp');
    writeFileSync(beforePath, previous ? Buffer.from(previous.bytesBase64, 'base64') : Buffer.alloc(0));
    writeFileSync(afterPath, read(path));
    const diff = spawnSync('git', ['diff', '--no-index', '--no-prefix', '--', beforePath, afterPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (diff.status !== 0 && diff.status !== 1) throw new Error(`Owned diff failed: ${path}`);
    const lines = diff.stdout.split('\n');
    if (diff.stdout) patch += `diff --git a/${path} b/${path}\n` + lines.slice(1).map((line) =>
      line.startsWith('--- ') ? `--- ${previous ? `a/${path}` : '/dev/null'}` :
      line.startsWith('+++ ') ? `+++ b/${path}` : line).join('\n');
  }
  const { unlinkSync } = await import('node:fs');
  unlinkSync(artifact('Temporary-Before', 'tmp'));
  unlinkSync(artifact('Temporary-After', 'tmp'));
  writeFileSync(artifact('Owned-Diff', 'patch'), patch, { flag: 'wx' });
  save('Preservation', { unchangedForeignFiles: unchanged.length, ownedDiffSha256: hash(Buffer.from(patch)),
    owned: owned.filter((path) => existsSync(resolve(root, path))).map((path) => ({ path, sha256: hash(read(path)) })),
    artifacts: paths().filter((path) => path.includes(prefix)).map((path) => ({ path, sha256: hash(read(path)) })) });
  console.info(`Preserved ${unchanged.length} foreign files; owned patch saved.`);
} else throw new Error('Specify baseline, freeze, gate <name>, or finalize.');