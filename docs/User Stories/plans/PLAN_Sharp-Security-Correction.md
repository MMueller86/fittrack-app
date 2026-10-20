# Technical Plan: Sharp Security Correction

- Status: Planned; current Sharp manifests and lockfiles already match the latest stable release
- Assessed: 2026-10-15
- Infrastructure Impact: Alpha (backend runtime dependency target only; no Azure/EAS deployment or publish is authorized)
- Mobile Build Impact: None

## Requirement Assessment

**Classification: Accept as proposed.** Keep Sharp on the latest stable version, make a dependency edit only if the current declarations or resolutions drift, and validate the staged Linux runtime. No Product Owner decision is required for this Sharp-only scope.

The current registry latest (`npm view sharp dist-tags.latest`) is `0.35.5`. Both backend and staging currently declare `sharp: ^0.35.5` and resolve `sharp@0.35.5`; no Sharp version mismatch was found.

## Current State

- `backend/package.json` declares `sharp: ^0.35.5`; the root workspace `package-lock.json` records that backend dependency and resolves `sharp@0.35.5` plus `@img/sharp-linux-x64@0.35.5`. There is no backend-local lockfile.
- `_deploy_staging/package.json` declares `sharp: ^0.35.5`; its separate lockfile resolves the same Sharp and Linux x64 binary versions.
- `.github/workflows/ci.yml` runs on Ubuntu but its existing jobs use Node 24; it has no staged Sharp smoke on Node 22.
- The current host is Windows, with no Docker executable and no installed WSL distribution. A local Linux x64 Node 22 smoke is unavailable.
- The worktree already has uncommitted package and lockfile edits, and an untracked broader dependency plan. Preserve all of them; do not amend the broader plan. The root `package.json` does not declare Sharp and is not an edit target.
- The reported root audit snapshot has 82 findings (1 low, 42 moderate, 35 high, 4 critical); its historical baseline is unknown. Do not broaden this task into root-audit remediation.

## Scope

- Reconcile Sharp only in `backend/package.json`, the root `package-lock.json`, `_deploy_staging/package.json`, and `_deploy_staging/package-lock.json`. Change these only if the Sharp declaration or its resolved version differs from the verified latest stable `0.35.5`; if aligned, leave all dependency files untouched.
- Run the backend unit tests, typecheck, and build verification.
- Run `npm audit --omit=dev` from `_deploy_staging` and assess only advisories affecting `sharp` or its `@img/sharp-*` packages. Record the command result; unrelated audit entries do not block this Sharp-only work.
- Add a narrow, non-deploying Ubuntu x64 / Node 22 CI job for a clean staging install and an in-memory Sharp PNG encode/decode smoke. This gate is needed because no local Linux runtime is available. Keep every existing Node 24 job unchanged.

## Out of Scope

- Satori/fflate strategy is deferred to a separate discussion and is not a prerequisite for these Sharp checks. Do not modify or propose changes to Satori or fflate.
- Do not modify or propose changes to form-data, other packages, renderer behavior, or unrelated audit findings. Do not use a root-wide clean-audit result as an acceptance gate.
- No Azure/EAS build, deployment, publish, or release operation is authorized.

## Backend Work Package

Agent: Backend

Goal: Preserve the verified Sharp version, correct only a confirmed Sharp mismatch, run the backend and staging checks, and add the Node 22 Linux smoke job.

Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- `package.json` (workspace scripts only; do not edit for this task)
- `package-lock.json`
- `backend/package.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `.github/workflows/ci.yml`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5

Dependencies:
- None

Implementation and checks:

1. Recheck the Sharp declarations and resolutions. If mismatched, update only Sharp-specific entries in the scoped backend/staging manifests and locks; do not run a broad dependency update. If still aligned, make no dependency-file edits.
2. Run `npm test --workspace=backend`, `npm run typecheck --workspace=backend`, and `npm run build:verify --workspace=backend` from the repository root. `build:verify` runs the backend build and its artifact checks.
3. From `_deploy_staging`, run `npm audit --omit=dev`. Inspect and report Sharp-related findings only. A non-zero exit caused solely by out-of-scope packages is recorded, not expanded into remediation.
4. Add a CI job on `ubuntu-latest` using `actions/setup-node@v5` with Node 22. In `_deploy_staging`, run `npm ci --omit=dev`, assert `process.platform === 'linux'` and `process.arch === 'x64'`, import staged `sharp`, encode a small 2x2 RGB buffer to PNG, decode it back to raw pixels, and assert dimensions and pixel equality. Keep the fixture in memory. The job must not deploy or publish.

Expected Handoff:
- Sharp manifest/lock status, with any changes limited to a proven Sharp mismatch.
- Backend test, typecheck, build-verification, and staging audit commands with exit codes and Sharp-specific audit result.
- Node 22 Linux smoke CI result; existing Node 24 jobs unchanged.

## QA Work Package

Agent: QA

Goal: Independently verify all acceptance criteria and confirm that the final diff stays within Sharp and the narrow CI gate.

Required Knowledge Base:
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- `backend/package.json`
- `package-lock.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `.github/workflows/ci.yml`
- `docs/User Stories/plans/PLAN_Sharp-Security-Correction.md`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5

Dependencies:
- Backend Work Package

Expected Handoff:
- QA report at `docs/qa/reports/PLAN_Sharp-Security-Correction.md`, with every AC, commands and exit codes, Sharp-focused audit evidence, and the CI smoke result. Mark the Linux smoke `UNVERIFIED` if the job did not run; do not substitute Windows-native results.

## Acceptance Criteria

- **AC-1:** Registry latest and backend/staging declarations and lock resolutions are `0.35.5`. Dependency files are unchanged when already aligned; any necessary edit is limited to Sharp-specific entries.
- **AC-2:** Backend unit tests, typecheck, and `build:verify` pass on the final worktree state.
- **AC-3:** `npm audit --omit=dev` is run in `_deploy_staging`; QA records whether `sharp` or an `@img/sharp-*` package has a production advisory. Non-Sharp findings, including any failure caused by them, are not remediated or treated as a Sharp failure.
- **AC-4:** The Ubuntu x64 / Node 22 CI smoke installs the staging production lockfile, imports staged Sharp, encodes and decodes the in-memory PNG fixture, and passes the platform, dimensions, and pixel assertions. The job has no deploy/publish steps, and existing Node 24 jobs are unchanged.
- **AC-5:** No Satori, fflate, form-data, unrelated audit, renderer, Azure, or EAS changes are included; pre-existing worktree edits remain intact.

## Recommended Execution Order

1. Backend reconciles Sharp state, runs the backend and staging checks, and adds/runs the narrow Node 22 Linux smoke job.
2. QA independently verifies AC-1 through AC-5 and records any unavailable CI evidence as `UNVERIFIED`.