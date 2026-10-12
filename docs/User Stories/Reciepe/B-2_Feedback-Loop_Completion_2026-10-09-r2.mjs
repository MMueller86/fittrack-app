import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const prefix = 'B-2_Feedback-Loop_';
const status = 'IMPLEMENTATION_PRESENT_REQUIRED_F_FAILED_RELEASE_BLOCKED';
const name = (kind, extension = 'json') => `${prefix}${kind}_2026-10-09-r2-completion.${extension}`;
const bytes = (path) => readFileSync(resolve(root, path));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const parse = (path) => JSON.parse(bytes(path).toString('utf8').replace(/^\uFEFF/u, ''));
const local = (filename) => relative(root, resolve(directory, filename)).replaceAll('\\', '/');
const save = (kind, value, extension = 'json') => writeFileSync(resolve(directory, name(kind, extension)),
  extension === 'json' ? JSON.stringify(value, null, 2) + '\n' : value, { flag: 'wx' });
const originalPath = local(`${prefix}Baseline_2026-10-09.json`);
const resumePath = local(`${prefix}Resume-Baseline_2026-10-09-r2.json`);
const candidatePath = local(`${prefix}Candidate_2026-10-09-r2.json`);
const recoveryPath = local(`${prefix}Recovery-Manifest_2026-10-09.json`);
const original = parse(originalPath);
const resume = parse(resumePath);
const candidate = parse(candidatePath);
const recovery = parse(recoveryPath);
const handoffPath = local(`${prefix}Handoff_2026-10-09.md`);
const verifyFiles = (entries) => entries.map((entry) => {
  const actual = hash(bytes(entry.path));
  assert.equal(actual, entry.sha256, entry.path);
  return { path: entry.path, expectedSha256: entry.sha256, actualSha256: actual, matched: true };
});
assert.equal(hash(bytes(originalPath)), candidate.originalBaselineSha256);
assert.equal(hash(bytes(resumePath)), candidate.resumeBaselineSha256);
assert.equal(hash(bytes(candidatePath)), recovery.candidate.sha256);
assert.equal(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim(), candidate.head);
const frozen = verifyFiles(candidate.files);
const originalForeign = verifyFiles(original.files.filter((entry) => !original.owned.includes(entry.path)));
const resumeForeign = verifyFiles(resume.files.filter((entry) => !resume.owned.includes(entry.path) && entry.path !== handoffPath));
for (const baseline of [original, resume]) {
  for (const entry of baseline.files) assert.equal(hash(Buffer.from(entry.bytesBase64, 'base64')), entry.sha256, entry.path);
}

if (process.argv[2] === 'verify') {
  const manifest = parse(local(name('Artifact-Manifest')));
  assert.ok(manifest.artifacts.length > 0);
  verifyFiles(manifest.artifacts);
  const preservation = parse(local(name('Preservation')));
  assert.equal(preservation.originalForeign.length, originalForeign.length);
  assert.equal(preservation.resumeForeign.length, resumeForeign.length);
  assert.equal(parse(local(name('Patch-Audit'))).exit, 0);
  assert.equal(manifest.status, status);
  console.log(JSON.stringify({ status, artifactHashesVerified: manifest.artifacts.length,
    frozenFilesVerified: frozen.length, originalForeignVerified: originalForeign.length,
    resumeForeignVerified: resumeForeign.length, reportingException: handoffPath, gateRuns: 0, liveCalls: 0 }));
} else {
  assert.equal(process.argv[2], 'generate');
  const scratch = mkdtempSync(resolve(tmpdir(), 'fittrack-b2-completion-'));
  const git = (args, cwd = root) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const patches = (baseline, ending) => {
    let patch = '';
    for (const path of candidate.owned) {
      const previous = baseline.files.find((entry) => entry.path === path);
      const next = ending.files.find((entry) => entry.path === path);
      const before = previous ? Buffer.from(previous.bytesBase64, 'base64') : Buffer.alloc(0);
      const after = next?.bytesBase64 ? Buffer.from(next.bytesBase64, 'base64') : next ? bytes(path) : Buffer.alloc(0);
      if (before.equals(after)) continue;
      writeFileSync(resolve(scratch, 'before'), before);
      writeFileSync(resolve(scratch, 'after'), after);
      const diff = git(['-c', 'core.autocrlf=false', 'diff', '--no-index', '--no-prefix', '--', 'before', 'after'], scratch);
      assert.equal(diff.status, 1, path);
      let body = diff.stdout.split('\n').slice(1).map((line) => line.startsWith('--- ') ? `--- ${previous ? `a/${path}` : '/dev/null'}`
        : line.startsWith('+++ ') ? `+++ ${next ? `b/${path}` : '/dev/null'}` : line).join('\n');
      if (!previous) body = 'new file mode 100644\n' + body;
      if (!next) body = 'deleted file mode 100644\n' + body;
      patch += `diff --git a/${path} b/${path}\n${body}`;
    }
    return patch;
  };
  try {
    const aggregate = patches(original, candidate);
    save('Owned-Diff', aggregate, 'patch');
    save('Resume-Owned-Diff', patches(resume, candidate), 'patch');
    save('Original-To-Resume-Owned-Diff', patches(original, resume), 'patch');
    save('Inherited-Original-Diff', original.inheritedDiff, 'patch');
    save('Inherited-Resume-Diff', resume.inheritedDiff, 'patch');
    const command = ['apply', '--reverse', '--check', '--whitespace=error', resolve(directory, name('Owned-Diff', 'patch'))];
    const audit = git(command);
    const output = `${audit.stdout ?? ''}\n${audit.stderr ?? ''}`;
    save('Patch-Audit-Output', output, 'txt');
    save('Patch-Audit', { command: ['git', ...command], exit: audit.status, signal: audit.signal,
      outputSha256: hash(Buffer.from(output)), patchSha256: hash(Buffer.from(aggregate)),
      basis: 'ORIGINAL B2 starting worktree; NOT HEAD and NOT resume baseline', writesOrRollback: false });
    assert.equal(audit.status, 0, 'Read-only aggregate reverse-check failed; frozen candidate must not be changed');
    const isolated = resolve(scratch, 'isolated');
    mkdirSync(isolated);
    for (const entry of candidate.files.filter((entry) => candidate.owned.includes(entry.path))) {
      const target = resolve(isolated, entry.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes(entry.path));
    }
    const reconstruction = git(['apply', '--reverse', '--whitespace=error', resolve(directory, name('Owned-Diff', 'patch'))], isolated);
    assert.equal(reconstruction.status, 0);
    const reconstructed = candidate.owned.map((path) => {
      const previous = original.files.find((entry) => entry.path === path);
      const target = resolve(isolated, path);
      if (previous) assert.equal(hash(readFileSync(target)), previous.sha256, path);
      else assert.equal(existsSync(target), false, path);
      return { path, originalSha256: previous?.sha256 ?? null, reconstructedExactly: true };
    });
    save('Ownership', { basis: 'Aggregate original-to-frozen-r2; original-to-resume and resume-to-r2 are separate',
      owned: candidate.owned.map((path) => ({ path, originalSha256: original.files.find((entry) => entry.path === path)?.sha256 ?? null,
        resumeSha256: resume.files.find((entry) => entry.path === path)?.sha256 ?? null,
        finalSha256: candidate.files.find((entry) => entry.path === path)?.sha256 ?? null })),
      inheritedB1VerifiedByOriginalBaseline: original.b1Verified, originalStatus: original.status, resumeStatus: resume.status,
      inheritedOriginalDiff: name('Inherited-Original-Diff', 'patch'), inheritedResumeDiff: name('Inherited-Resume-Diff', 'patch'),
      originalToResumeOwnedDiff: name('Original-To-Resume-Owned-Diff', 'patch'), resumeOwnedDiff: name('Resume-Owned-Diff', 'patch'),
      isolatedReconstruction: { touchesWorktree: false, exit: reconstruction.status, files: reconstructed } });
  } finally { rmSync(scratch, { recursive: true, force: true }); }

  const recordedOutput = bytes(local(`${prefix}F-Output_2026-10-09-r2.txt`)).toString('utf8');
  const marker = 'Synthetic preparation complete attempt evidence ';
  const attempts = recordedOutput.split(/\r?\n/u).filter((line) => line.includes(marker))
    .map((line) => JSON.parse(line.slice(line.indexOf(marker) + marker.length)));
  assert.equal(attempts.length, 4);
  const reconciliation = parse(local(recovery.live.reconciliation.path));
  for (const entry of [...Object.values(recovery.offline).filter((entry) => entry?.path), recovery.live.F, recovery.live.R, recovery.live.G, recovery.live.reconciliation]) {
    assert.equal(hash(bytes(local(entry.path))), entry.sha256, entry.path);
    const record = parse(local(entry.path));
    if (record.outputSha256) assert.equal(hash(bytes(local(entry.path.replace('_2026', '-Output_2026').replace('.json', '.txt')))), record.outputSha256);
    if (record.reportSha256) assert.equal(hash(bytes(local(entry.path.replace('_2026', '-Report_2026')))), record.reportSha256);
    if (entry.counts) assert.deepEqual(record.counts, entry.counts);
    if ('exit' in entry) assert.equal(record.exit, entry.exit);
  }
  save('Recorded-Provider-Evidence', { status, extractedOnly: true, rerun: false,
    nativeOutput: recovery.live.F.path.replace('_2026', '-Output_2026').replace('.json', '.txt'),
    nativeOutputSha256: reconciliation.nativeOutputSha256, contract: recovery.contract,
    metadata: { candidate: recovery.candidate, node: candidate.node, dependencies: candidate.dependencies,
      logicalCalls: 8, sdkCalls: 7, forcedInitialDrafts: 1 },
    fixtures: attempts.map((entry) => ({ ...entry, lastSdkRequest: entry.sdk.at(-1),
      lastCorrection: entry.attempts.at(-1).correction ?? null, latestText: entry.attempts.at(-1).output,
      sourceContext: entry.attempts[0].original, finalProviderOptions: entry.sdk.at(-1).options,
      terminalEvidence: reconciliation.fixtures.find((fixture) => fixture.fixture === entry.fixture) })),
    terminalTextLogLines: recordedOutput.split(/\r?\n/u).filter((line) => line.includes('correctionsExhausted')),
    limitations: reconciliation.limitations });
  save('Preservation', { status, candidateSha256: hash(bytes(candidatePath)), frozenCandidateUnchanged: true,
    originalBaselineSha256: hash(bytes(originalPath)), resumeBaselineSha256: hash(bytes(resumePath)),
    originalForeign, resumeForeign, resumeForeignTotal: resumeForeign.length + 1,
    authorizedReportingException: { path: handoffPath, baselineSha256: resume.files.find((entry) => entry.path === handoffPath).sha256,
      finalSha256: hash(bytes(handoffPath)), reason: 'Explicitly authorized ExpectedHandoff completion only; not production candidate' },
    owned: frozen.filter((entry) => candidate.owned.includes(entry.path)),
    patchAuditExit: 0, originalImmutableArtifactsOverwritten: false, codeTestPromptChanges: 0, gateRuns: 0, liveCalls: 0 });

  const patterns = [
    { id: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu },
    { id: 'azure-account-key', regex: /AccountKey=[A-Za-z0-9+/]{40,}={0,2}/gu },
    { id: 'bearer-token', regex: /Bearer\s+[A-Za-z0-9._~+/-]{24,}/gu },
    { id: 'jwt', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/gu },
    { id: 'provider-key', regex: /\bsk-[A-Za-z0-9_-]{20,}/gu },
    { id: 'github-token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/gu },
    { id: 'literal-secret', regex: /(?:api[_-]?key|password|client[_-]?secret)\s*[=:]\s*["'][A-Za-z0-9+/=_-]{24,}["']/giu },
  ];
  const artifactNames = () => readdirSync(directory).filter((filename) => filename.startsWith(prefix));
  const scanPaths = [...candidate.owned, ...artifactNames().filter((filename) => !filename.includes('Baseline_') && !filename.includes('Resume-Baseline_')).map(local)];
  const findings = [];
  for (const path of scanPaths) {
    const content = bytes(path).toString('utf8');
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      for (const match of content.matchAll(pattern.regex)) findings.push({ path, pattern: pattern.id, offset: match.index });
    }
  }
  save('Secret-Scan', { status: findings.length ? 'FAIL' : 'PASS', scope: scanPaths, patterns: patterns.map((entry) => ({ id: entry.id, pattern: entry.regex.source })),
    excluded: ['Immutable baseline base64 snapshots (integrity checked, not decoded secret-scanned)', 'Settings, credentials, ignored files and unrelated repository files'],
    limitations: 'Pattern scan only, not proof of absence of secrets. No matched values are emitted.', findings });
  assert.equal(findings.length, 0, 'Scoped secret-pattern findings require disposition without candidate edits');
  const expectedAssets = ['Owned-Diff', 'Patch-Audit', 'Patch-Audit-Output', 'Preservation', 'Ownership',
    'Resume-Owned-Diff', 'Original-To-Resume-Owned-Diff', 'Inherited-Original-Diff', 'Inherited-Resume-Diff', 'Recorded-Provider-Evidence', 'Secret-Scan']
    .map((kind) => name(kind, kind.includes('Diff') ? 'patch' : kind === 'Patch-Audit-Output' ? 'txt' : 'json'));
  save('Recovery-Manifest', { ...recovery, status, routing: 'Orchestrator scoped disposition of three required F failures; no automatic continuation',
    handoffArtifactsComplete: true, implementationPresent: true, b2Complete: false, releaseEligible: false,
    previousRecoveryManifest: { path: recoveryPath, sha256: hash(bytes(recoveryPath)), preserved: true },
    preservation: { ...recovery.preservation, finalR2PreservationManifestExists: true, completion: name('Preservation') },
    expectedHandoffAssets: [...expectedAssets, name('Artifact-Manifest')],
    missingChecksAndArtifacts: [],
    remainingVerificationRequirements: ['Orchestrator disposition/authorization for oven overflow, pasta contradiction and dough ingredient fidelity',
      'Any authorized successor candidate needs its own verification; no retries authorized by this completion',
      'Required R/G remain NOT_RUN after F failure', 'Independent QA and historical/private Alpha replay remain unverified; Q-19 remains FAIL; no D-1 or deployment'],
    nextBlocker: 'Required F failed; ExpectedHandoff evidence is complete, but this frozen r2 candidate remains release blocked.' });
  const manifestEntries = artifactNames().filter((filename) => filename !== name('Artifact-Manifest')).map((filename) => ({ path: local(filename), sha256: hash(bytes(local(filename))) }));
  save('Artifact-Manifest', { status, releaseEligible: false, candidateSha256: hash(bytes(candidatePath)),
    expectedHandoffAssets: [...expectedAssets, name('Recovery-Manifest'), name('Artifact-Manifest')],
    artifacts: manifestEntries, selfHashExcluded: true, gateRuns: 0, liveCalls: 0 });
  console.log(JSON.stringify({ status, artifactsGenerated: expectedAssets.length + 2, originalForeignVerified: originalForeign.length,
    resumeForeignVerified: resumeForeign.length, frozenFilesVerified: frozen.length, reverseCheckExit: 0, secretScan: 'PASS', gateRuns: 0, liveCalls: 0 }));
}