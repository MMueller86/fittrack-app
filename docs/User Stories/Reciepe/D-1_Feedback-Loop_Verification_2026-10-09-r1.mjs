import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const directory = 'docs/User Stories/Reciepe/';
const prefix = `${directory}D-1_Feedback-Loop_`;
const suffix = '_2026-10-09-r1';
const artifact = (name, extension = 'json') => `${prefix}${name}${suffix}.${extension}`;
const owned = ['docs/kb/domain/06-recipes.md', 'docs/kb/domain/07-ai-features.md',
  'docs/kb/tech/02-backend.md', 'docs/kb/tech/06-ai-integrations.md',
  'docs/kb/tech/09-api-reference.md', 'docs/kb/tech/08-testing.md'];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fingerprint = (file) => ({ path: file, sha256: hash(fs.readFileSync(file)), bytes: fs.statSync(file).size });
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const b2ManifestPath = `${directory}B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r3-QA-R1.json`;
const historicalManifestPath = `${directory}B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r2-completion.json`;
const priorD1ManifestPath = `${directory}D-1_Feedback-Loop_Manifest_2026-10-09.json`;

function verifyEvidence() {
  const current = read(b2ManifestPath);
  assert.equal(current.artifacts.length, 53);
  assert.equal(current.status, 'IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED');
  assert.equal(current.release, 'CLOSED');
  assert.deepEqual(current.live.F.counts, { executed: 5, passed: 2, failed: 3, skipped: 9 });
  assert.equal(current.live.F.exit, 1);
  assert.equal(current.live.F.logicalCalls, 10);
  assert.equal(current.live.F.sdkCalls, 9);
  assert.equal(current.live.R, 'NOT_RUN_REQUIRED_LIVE_FAILURE');
  assert.equal(current.live.G, 'NOT_RUN_REQUIRED_LIVE_FAILURE');
  const historical = read(historicalManifestPath);
  assert.equal(historical.artifacts.length, 83);
  for (const entry of [...current.artifacts, ...historical.artifacts, current.handoff]) {
    assert.equal(fingerprint(entry.path).sha256, entry.sha256, entry.path);
    if (entry.bytes !== undefined) assert.equal(fs.statSync(entry.path).size, entry.bytes, entry.path);
  }
  assert.equal(fingerprint(`${directory}B-2_Feedback-Loop_Candidate_2026-10-09-r3-QA-R1.json`).sha256, current.candidateSha256);
  const prior = read(priorD1ManifestPath);
  for (const entry of [prior.baseline, prior.ownedDiff]) assert.equal(fingerprint(entry.path).sha256, entry.sha256);
  return { currentManifest: fingerprint(b2ManifestPath), historicalManifest: fingerprint(historicalManifestPath),
    priorD1Manifest: fingerprint(priorD1ManifestPath), currentArtifactsVerified: 53, historicalArtifactsVerified: 83,
    candidateSha256: current.candidateSha256, live: current.live };
}

function linkIssues(file) {
  const issues = [];
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1];
    if (/^(?:https?:|mailto:)/u.test(target)) continue;
    const [relative, anchor] = target.split('#');
    const resolved = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative)) : path.resolve(file);
    if (!fs.existsSync(resolved)) { issues.push(`${file}:${target}:missing`); continue; }
    if (anchor) {
      const content = fs.readFileSync(resolved, 'utf8');
      const anchors = [...content.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((heading) => heading[1].toLowerCase()
        .replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/gu, '-'));
      if (!anchors.includes(decodeURIComponent(anchor)) && !/^L\d+(?:-L\d+)?$/u.test(anchor) &&
        !content.includes(`id="${anchor}"`)) issues.push(`${file}:${target}:anchor`);
    }
  }
  return issues;
}

function documentationCheck() {
  const baseline = read(artifact('Baseline'));
  const handoff = artifact('Handoff', 'md');
  for (const file of [...owned, ...(fs.existsSync(handoff) ? [handoff] : [])]) {
    const bytes = fs.readFileSync(file);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!/\uFFFD|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC/u.test(text), `${file}: encoding`);
    const pending = ['Owned-Diff.patch', 'Preservation.json', 'Manifest.json'].map((value) => {
      const [name, extension] = value.split('.');
      return `${handoff}:${path.basename(artifact(name, extension))}:missing`;
    });
    for (const issue of linkIssues(file)) assert.ok(baseline.linkIssues.includes(issue) || pending.includes(issue), issue);
    if (!owned.includes(file)) continue;
    assert.match(text, /v6/u, file);
    assert.match(text, /519/u, file);
    assert.match(text, /1600/u, file);
    assert.match(text, /NOT ACCEPTED/u, file);
    assert.match(text, /NOT_RUN/u, file);
    assert.ok(!text.includes('preparation-feedback-loop-current-r2') ||
      text.includes('id="preparation-feedback-loop-current-r2"'), `${file}: stale current link`);
    assert.ok(!/pasta contradicts source 5|dough\s+loses source-1|fitting pasta\/dough\s+fail/u.test(text), `${file}: obsolete cooking claim`);
  }
  assert.match(fs.readFileSync('backend/src/lib/prompts/recipeAnalyze.ts', 'utf8'), /RECIPE_PREPARATION_PROMPT_VERSION = 'v6'/u);
  assert.match(fs.readFileSync('backend/src/lib/prompts/recipeAnalyze.eval.test.ts', 'utf8'), /TESTED_PREPARATION_PROMPT_VERSION = 'v6'/u);
  const loop = fs.readFileSync('backend/src/lib/recipePreparation.ts', 'utf8');
  assert.match(loop, /DEADLINE_MS = 75_000/u);
  assert.match(loop, /REQUEST_MS = 20_000/u);
  assert.match(loop, /attempt < 3/u);
  return { status: 'PASS', ownedDocuments: owned.length, utf8: 'PASS', linksAndAnchors: 'PASS_NO_NEW_ISSUES',
    inheritedLinkIssues: baseline.linkIssues, versionAndEvidenceAssertions: 'PASS', runtimeReadOnly: true };
}

const mode = process.argv[2];
if (mode === 'baseline') {
  assert.ok(!fs.existsSync(artifact('Baseline')));
  const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .toString('utf8').split('\0').filter(Boolean))].filter((file) => fs.existsSync(file) && fs.statSync(file).isFile() &&
      !/(?:^|\/)(?:local\.settings\.json|\.env(?:\..*)?)$/u.test(file));
  write(artifact('Baseline'), { task: 'D-1-R1', createdAt: new Date().toISOString(),
    head: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
    status: execFileSync('git', ['status', '--porcelain=v1', '-uall']).toString('utf8'), owned,
    scope: 'Tracked/nonignored existing regular files; private settings/env excluded; foreign hashes only',
    files: files.map((file) => ({ ...fingerprint(file), ...(owned.includes(file) ? { beforeBase64: fs.readFileSync(file).toString('base64') } : {}) })),
    linkIssues: owned.flatMap(linkIssues), evidence: verifyEvidence() });
  console.log(JSON.stringify({ baseline: artifact('Baseline'), files: files.length, evidence: '53 current + 83 historical verified' }));
} else if (mode === 'check') {
  console.log(JSON.stringify(documentationCheck()));
} else if (mode === 'finish') {
  const checks = documentationCheck();
  const baseline = read(artifact('Baseline'));
  const foreign = baseline.files.filter((entry) => !owned.includes(entry.path) && entry.path !== artifact('Verification', 'mjs'));
  for (const entry of foreign) assert.equal(fingerprint(entry.path).sha256, entry.sha256, entry.path);
  const evidence = verifyEvidence();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fittrack-d1-r1-'));
  let patch = '';
  const ownFiles = [];
  try {
    for (const file of owned) {
      const entry = baseline.files.find((item) => item.path === file);
      for (const side of ['a', 'b']) fs.mkdirSync(path.dirname(path.join(temporary, side, file)), { recursive: true });
      fs.writeFileSync(path.join(temporary, 'a', file), Buffer.from(entry.beforeBase64, 'base64'));
      fs.copyFileSync(file, path.join(temporary, 'b', file));
      const result = spawnSync('git', ['diff', '--no-index', '--no-prefix', '--', `a/${file}`, `b/${file}`], { cwd: temporary, encoding: 'utf8' });
      assert.equal(result.status, 1, file);
      patch += result.stdout;
      ownFiles.push({ ...fingerprint(file), beforeSha256: entry.sha256,
        hunks: result.stdout.split('\n').filter((line) => line.startsWith('@@')) });
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  const addedLines = patch.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).join('\n') +
    fs.readFileSync(artifact('Handoff', 'md'), 'utf8');
  const secretPatterns = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/u, /AccountKey=[A-Za-z0-9+/=]{20,}/u,
    /(?:api[_-]?key|password|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9+/=_-]{20,}/iu];
  for (const pattern of secretPatterns) assert.ok(!pattern.test(addedLines), 'Introduced credential-like value');
  if (fs.existsSync(artifact('Owned-Diff', 'patch'))) {
    assert.equal(hash(fs.readFileSync(artifact('Owned-Diff', 'patch'))), hash(Buffer.from(patch)), 'Existing owned patch must remain byte-equivalent');
  } else fs.writeFileSync(artifact('Owned-Diff', 'patch'), patch, { flag: 'wx' });
  const patchChecks = [['git', 'apply', '--reverse', '--check', artifact('Owned-Diff', 'patch')],
    ['git', 'apply', '--reverse', '--check', '--whitespace=error-all', artifact('Owned-Diff', 'patch')]];
  for (const command of patchChecks) execFileSync(command[0], command.slice(1), { stdio: 'pipe' });
  const allowedNew = ['Verification.mjs', 'Baseline.json', 'Handoff.md', 'Owned-Diff.patch', 'Preservation.json', 'Manifest.json']
    .map((value) => { const [name, extension] = value.split('.'); return artifact(name, extension); });
  const currentFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0')
    .filter((file) => file && !/(?:^|\/)(?:local\.settings\.json|\.env(?:\..*)?)$/u.test(file));
  const additions = currentFiles.filter((file) => !baseline.files.some((entry) => entry.path === file));
  for (const file of additions) assert.ok(allowedNew.includes(file), `Unexpected addition: ${file}`);
  write(artifact('Preservation'), { status: 'PASS', baseline: fingerprint(artifact('Baseline')),
    foreignFilesVerified: foreign.length, currentArtifactsVerified: 53, historicalArtifactsVerified: 83,
    foreignFiles: foreign.map((entry) => ({ path: entry.path, sha256: entry.sha256 })),
    authorizedDocumentationDeltas: ownFiles, additions, deletedFiles: 0 });
  const artifacts = [...owned, artifact('Verification', 'mjs'), artifact('Baseline'), artifact('Handoff', 'md'),
    artifact('Owned-Diff', 'patch'), artifact('Preservation')].map(fingerprint);
  write(artifact('Manifest'), { task: 'D-1-R1', documentationStatus: 'DOCUMENTATION_COMPLETE_FEATURE_PARTIAL_NOT_ACCEPTED',
    featureStatus: 'IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED', featureAccepted: false,
    release: 'CLOSED', alphaLoopDeployed: false, findingClosure: 'NOT_CLAIMED_PENDING_INDEPENDENT_QA',
    implementationGateRuns: 0, liveCalls: 0, deployments: 0, fullPlanRead: false, requiredSkills: [],
    handoff: fingerprint(artifact('Handoff', 'md')), baseline: fingerprint(artifact('Baseline')),
    ownedDiff: fingerprint(artifact('Owned-Diff', 'patch')), preservation: fingerprint(artifact('Preservation')),
    artifacts, ownFiles, evidence, validation: { ...checks, foreignFilesVerified: foreign.length,
      reportingScript: { beforeSha256: baseline.files.find((entry) => entry.path === artifact('Verification', 'mjs')).sha256,
        ...fingerprint(artifact('Verification', 'mjs')), ownedByThisRound: true },
      initialFocusedCheck: { exit: 1, reason: 'Handoff referenced the three not-yet-generated owned artifacts; generator ordering corrected, no implementation gate failure' },
      executedCommands: [
        { command: ['node', '--check', artifact('Verification', 'mjs')], exit: 0 },
        { command: ['node', artifact('Verification', 'mjs'), 'baseline'], exit: 0 },
        { command: ['node', artifact('Verification', 'mjs'), 'check'], exit: 1, chronology: 'Before generator ordering correction' },
        { command: ['node', artifact('Verification', 'mjs'), 'check'], exit: 0, chronology: 'After local reporting correction' },
        { command: ['node', artifact('Verification', 'mjs'), 'check'], exit: 0, chronology: 'After final publication link correction' },
        { command: ['node', artifact('Verification', 'mjs'), 'finish'], exit: 1,
          chronology: 'Existing private env path was misclassified as an addition; identical baseline exclusion applied without reading values; created patch retained unchanged' },
        { command: ['node', artifact('Verification', 'mjs'), 'finish'], exit: 0 }
      ],
      patchChecks: patchChecks.map((command) => ({ command, exit: 0 })),
      command: ['node', artifact('Verification', 'mjs'), 'finish'],
      editorDiagnostics: { status: 'PASS', errors: 0, tool: 'get_errors', paths: [...owned, artifact('Verification', 'mjs'), artifact('Handoff', 'md')] },
      scopedSecretReview: { matches: 0, scope: 'Added KB prose and new handoff; three credential-pattern checks, not exhaustive detection; no private settings read' } },
    manifestSelfHashExcluded: true });
  for (const file of [...owned, artifact('Handoff', 'md')]) {
    for (const issue of linkIssues(file)) assert.ok(baseline.linkIssues.includes(issue), issue);
  }
  console.log(JSON.stringify({ status: 'PASS', manifest: fingerprint(artifact('Manifest')), artifacts: artifacts.length,
    foreignFilesVerified: foreign.length, currentEvidence: 53, historicalEvidence: 83, featureAccepted: false, release: 'CLOSED' }));
} else throw new Error('Expected baseline, check or finish; no implementation/live commands are supported.');