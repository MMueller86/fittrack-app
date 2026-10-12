import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvalEnvironment } from '../../../backend/scripts/run-eval.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const evidencePath = resolve(here, 'B-18_Recipe-Kurzfassung_LiveEvidence_2026-10-09.json');
const commands = [
  'npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations|recipePreparation"',
  'npm run test:eval -- src/lib/prompts/recipeAnalyze.eval.test.ts',
  'npm run test:eval',
];
const gate = Number(process.argv[2]);
if (![1, 2, 3].includes(gate)) throw new Error('Specify exactly one gate: 1, 2 or 3');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sourcePaths = () => [...new Set(execFileSync('git', [
  'ls-files', '--cached', '--others', '--exclude-standard', '-z',
], { cwd: root, encoding: 'utf8' }).split('\0').filter((path) => path && (
  /^(backend\/(src|scripts)\/|shared\/|mobile\/src\/|infra\/|docs\/(kb|qa)\/|\.github\/)/.test(path) ||
  /^(backend|mobile)\/[^/]+\.(json|mts|js)$/.test(path) ||
  /^(package(-lock)?\.json|tsconfig[^/]*\.json)$/.test(path)
)).filter((path) => !/local\.settings\.json$/.test(path)))].sort();
const snapshot = () => Object.fromEntries(sourcePaths().map((path) => [path, hash(readFileSync(resolve(root, path)))]));
const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')) : {
  schema: 'b18-authorized-current-live-verification-v1',
  authorization: 'Explicit user/Orchestrator clarification, 2026-10-09; one invocation per mandatory gate; no edits or retries.',
  originalLiveRuns: 'UNVERIFIED', originalRedCapture: 'UNVERIFIED',
  candidate: { import: 'v16', preparation: 'v3' },
  frozenAtUtc: new Date().toISOString(), before: snapshot(), runs: [],
};
if (evidence.runs.length !== gate - 1) throw new Error('Out-of-order or duplicate invocation refused');
const beforeGate = snapshot();
if (JSON.stringify(beforeGate) !== JSON.stringify(evidence.before)) throw new Error('Frozen source changed before gate');
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
const environment = await loadEvalEnvironment();
const privateValues = Object.entries(environment).filter(([key, value]) =>
  /KEY|TOKEN|SECRET|PASSWORD|CONNECTION|ENDPOINT|DEPLOYMENT_NAME/i.test(key) && typeof value === 'string' && value.length > 3,
).map(([, value]) => value).sort((left, right) => right.length - left.length);
const sanitize = (text) => {
  let cleaned = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const value of privateValues) cleaned = cleaned.split(value).join('[REDACTED]');
  return cleaned.replace(/https?:\/\/[^\s"'<>]+/g, '[REDACTED_URL]');
};
const startedAtUtc = new Date().toISOString();
const child = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commands[gate - 1]], {
  cwd: resolve(root, 'backend'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
const chunks = [];
child.stdout.on('data', (chunk) => chunks.push(chunk.toString()));
child.stderr.on('data', (chunk) => chunks.push(chunk.toString()));
const exit = await new Promise((accept, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => accept({ code, signal }));
});
const finishedAtUtc = new Date().toISOString();
const output = sanitize(chunks.join(''));
const after = snapshot();
const changedPaths = [...new Set([...Object.keys(evidence.before), ...Object.keys(after)])]
  .filter((path) => evidence.before[path] !== after[path]);
const observedSyntheticEvidence = output.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/(Synthetic (?:preparation semantic|preparation counts and handler|import semantic) evidence) (\{.*\})/);
  return match ? [{ label: match[1], value: JSON.parse(match[2]) }] : [];
});
evidence.runs.push({
  gate, command: commands[gate - 1], cwd: 'backend', startedAtUtc, finishedAtUtc,
  exitCode: exit.code, signal: exit.signal,
  result: exit.code === 2 ? 'UNVERIFIED' : exit.code === 0 ? 'PASS' : 'FAIL',
  output, observedSyntheticEvidence, after, changedPaths, sourceUnchanged: changedPaths.length === 0,
});
evidence.after = after;
evidence.sourceUnchanged = evidence.runs.every((run) => run.sourceUnchanged);
evidence.sourceManifestSha256 = hash(JSON.stringify(evidence.before));
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ gate, startedAtUtc, finishedAtUtc, exitCode: exit.code,
  sourceUnchanged: changedPaths.length === 0, protectedPaths: Object.keys(after).length }));
console.log(output);
process.exitCode = exit.code ?? 1;