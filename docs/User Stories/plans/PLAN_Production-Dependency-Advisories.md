# Revised Technical Plan: Production Dependency Advisory Corrections

- Status: Replanned; renderer strategy is open; implementation is not authorized by this replan-only task
- Plan revision: 2026-10-15-renderer-strategy-03
- Durable plan artifact: `docs/User Stories/plans/PLAN_Production-Dependency-Advisories.md`
- Original request: "Lass die Korrekturen umsetzen."
- New clarification (verbatim): "Ich will eine saubere Lösung. Wir sind in der Alpha pahse, wir müssen nicht auf workarounds setzen"
- Infrastructure Impact: Alpha
- Mobile Build Impact: None
- Release authorization: No Azure deployment, Functions publish, EAS build, or EAS submission is authorized. Local and CI validation builds are in scope after this plan is approved.

## 1. Open Product Owner Decision

### O-1: Select a supportable renderer dependency strategy

Which route should FitTrack own?

**Option A — maintain a FitTrack Satori source fork.** Fork the currently resolved `satori@0.33.5` source and make the dependency declaration itself require patched `fflate@0.7.5`. Keep the source, license notices, version, and upstream provenance under source control; establish an owner for upstream synchronization; and choose a distribution layout that both the root workspace and standalone `_deploy_staging/` install can consume. This is a source-level dependency fix, not an installed-package metadata edit. It minimizes renderer API and visual change, but creates a continuing fork-maintenance obligation. The published package is MPL-2.0; preserve its license and notices.

**Option B — replace Satori with an independent renderer.** `@napi-rs/canvas@1.0.11` is the current stable candidate checked on 2026-10-15. It is a Node Canvas/Skia API with platform-specific optional native packages, not a drop-in Satori replacement. This route requires porting the renderer composition, text measurement, font handling, and PNG output, then reviewing any visual-baseline changes. Recheck the package's latest stable version and Node 22 Linux support when implementation begins.

**Recommendation:** Prefer Option A only if FitTrack accepts a named maintainer and a durable source/distribution path usable by the standalone staging package. It preserves the established Satori layout and measurement contract while correcting the source manifest. If FitTrack does not want to own a fork, choose Option B and explicitly accept the broader renderer migration and visual review. Do not start the dependency implementation until O-1 records both the selected route and, for Option A, its owner and distribution mechanism.

If neither option is acceptable, no currently verified upstream package choice meets both requirements (patched fflate and a valid npm dependency tree); keep remediation open and ask the user for another supported direction. Do not substitute a dependency exception or an unverified renderer.

## 2. Requirement Assessment

**Classification: Requires user decision on implementation architecture.** The security goal is clear: remove the fflate advisory while keeping a dependency graph that npm considers valid. The previous plan's proposed install-time metadata correction is superseded and is not part of this plan.

An upstream Satori upgrade is not a solution based on current registry evidence. The installed `0.33.5` and latest `0.59.1` both declare `fflate` exactly as `0.7.3`; sampled `0.40.0` and `0.50.0` do too. The newer version therefore does not admit patched `0.7.5` in a valid tree. `@vercel/og@1.0.3` depends on `satori@0.33.5`, so it does not remove this dependency edge either.

The two viable directions differ materially: a maintained source fork preserves the renderer contract but creates ownership duties; an independent renderer avoids Satori but requires a substantial rendering and visual-validation change. That tradeoff belongs to the user and is not silently decided here.

## 3. Feature Summary

- Resolve the fflate advisory through an upstream-fixed package source or a deliberately selected independent renderer. Do not accept an invalid `npm ls` result.
- Preserve the root Azurite-scoped `form-data@2.5.6` correction and independent production `form-data@4.0.6` paths.
- Preserve the verified current Sharp line, `^0.35.5`, resolving to `0.35.5`.
- Keep root and standalone staging manifests and lockfiles consistent with the selected renderer strategy.
- Add a Linux x64 Node 22 CI gate that installs the staging production graph and renders through the staged build and staged dependencies.
- Correct stale dependency statements in `docs/kb/tech/07-infrastructure.md` after the final graph is selected.
- Do not remediate unrelated audit findings or deploy/build/publish to Azure or EAS.

## 4. Current Behaviour

- Root `package.json` overrides `fflate` to `0.7.5` and scopes `form-data@2.5.6` to `azurite -> @azure/ms-rest-js`.
- Root `package-lock.json` resolves that Azurite path to `form-data@2.5.6`; it separately retains production `form-data@4.0.6`. No `form-data@2.5.5` lock entry was found.
- Root `npm ls --all form-data fflate sharp satori` was run against the current install and exits 1. It reports `fflate@0.7.5` as invalid against Satori's exact `0.7.3` declaration. The output confirms the intended `form-data@2.5.6`, `form-data@4.0.6`, and `sharp@0.35.5` resolutions.
- `backend/package.json` declares `satori: ~0.33.4` and `sharp: ^0.35.5`. `_deploy_staging/package.json` separately overrides `fflate` to `0.7.5`. Its lock resolves `satori@0.33.5`, `fflate@0.7.5`, `sharp@0.35.5`, and `form-data@4.0.6`, but Satori's lock metadata still says `fflate: "0.7.3"`.
- Registry checks on 2026-10-15: latest `satori` is `0.59.1`, latest `fflate` is `0.8.3`, latest `sharp` is `0.35.5`, and latest `@resvg/resvg-js` is `2.6.2`. `satori@0.33.5`, `0.40.0`, `0.50.0`, and `0.59.1` all declare exact `fflate@0.7.3`; `fflate@0.7.5` is published.
- `@resvg/resvg-js` is the current Satori SVG rasterizer, not a JSX/layout replacement. `@vercel/og` inherits Satori. `@napi-rs/canvas@1.0.11` is a separate Canvas/Skia API with platform-specific optional binaries and has no Satori-compatible tree/measurement API.
- `backend/src/lib/instagramRenderer/render.ts` uses Satori's `Font` and `SatoriNode` types, builds a Satori tree, calls `satori(tree, { width, height, fonts, embedFont, onNodeDetected })`, then rasterizes the returned SVG through Resvg. `detailTextLayout.ts` also uses Satori to measure text widths. Sharp handles source-photo processing. A renderer replacement is therefore not a package-only substitution.
- Existing renderer coverage includes the nutrition layout, golden output, recipe details, photo handling, and error cases under `backend/src/lib/instagramRenderer/`.
- The reported root `npm audit` snapshot exits 1 with 82 findings (1 low, 42 moderate, 35 high, 4 critical) and does not include the targeted form-data GHSA or an fflate advisory for resolved `0.7.5`. This is a current snapshot, not a proven historical baseline; audit must be rerun after the final dependency choice.
- Backend Vitest (70 files / 1,742 tests), typecheck, and `build:verify` passed at an intermediate dependency state. They predate the current final dependency changes and must be rerun.
- The local Windows environment has no Docker or WSL, so it cannot produce Linux x64 Node 22 native-renderer evidence. `.github/workflows/ci.yml` currently runs Node 24 and has no staging production install/render gate. This plan adds a Node 22 Ubuntu CI job; until that job runs successfully, the staging gate is unverified.
- `docs/kb/tech/07-infrastructure.md` currently contains stale dependency text claiming the root retains `form-data@2.5.5` and describes the fflate override as if it satisfied Satori's exact `0.7.3` declaration.

## 5. Desired Behaviour

- The selected source has a declared dependency compatible with patched `fflate@0.7.5`, or Satori is removed by the selected independent renderer. Both root and staging effective graphs pass `npm ls --all` after clean installs.
- No install-time script or local package-manager exception mutates installed dependency metadata. Lockfiles are generated by npm and faithfully represent the selected package source.
- The root Azurite path remains on `form-data@2.5.6`; independent `form-data@4.0.6` production paths remain unchanged; affected `form-data@2.5.5` is absent.
- Sharp remains on the current latest stable `0.35.5` line unless a concrete compatibility issue is demonstrated.
- Existing renderer behavior remains unchanged on the source-fork route. On the replacement route, all layout behavior and visual changes receive explicit golden-image and human review before acceptance.
- Linux x64 Node 22 staging install, native dependency loading, and a 1080 x 1350 renderer smoke run in CI using `_deploy_staging/dist` and `_deploy_staging/node_modules`.
- Root audit findings outside the selected remediation remain reported, not silently treated as clean or expanded into this task.

## 6. Scope

Common dependency and documentation scope:

- `package.json`, `package-lock.json`, `backend/package.json`, `_deploy_staging/package.json`, and `_deploy_staging/package-lock.json`.
- `.github/workflows/ci.yml` for a distinct Node 22 Linux staging verification job; retain existing Node 24 jobs.
- A staging renderer smoke helper at `_deploy_staging/scripts/verify-renderer-smoke.mjs`, importing the compiled renderer from `_deploy_staging/dist` and resolving runtime packages from `_deploy_staging/node_modules`.
- `docs/kb/tech/07-infrastructure.md` to document the final dependency source, lock graph, and CI/native validation boundary.
- `docs/qa/reports/PLAN_Production-Dependency-Advisories.md` as the durable QA evidence report.

Conditional renderer scope after O-1:

- **Option A:** the source-controlled FitTrack Satori fork at the approved repository path, including its package manifest, upstream provenance, license notices, and maintenance note. Both root and standalone staging installs must consume that same maintained source. Any local-file distribution must be present inside the standalone deployment input; a dependency path outside `_deploy_staging/` is not sufficient for remote staging builds.
- **Option B:** `backend/src/lib/instagramRenderer/**` and its existing tests/fixtures, plus only the renderer dependencies proven necessary after the port. Remove Satori and fflate only after the final graph proves no other runtime dependency requires them.

No mobile, shared, API, Cosmos, Bicep, or product behavior changes. Pre-existing unrelated worktree changes must be preserved and not absorbed into this task.

## 7. Out of Scope

- Any Azure Functions publish, Azure resource deployment, EAS build, or EAS submission. `Infrastructure Impact: Alpha` denotes the eventual runtime destination only; it is not deployment authorization. A later release command needs separate explicit authorization.
- Remediation of the other root audit findings. The reported 82 findings have unknown historical status; this plan does not claim they are pre-existing.
- Global `form-data` overrides, changing independent `form-data@4.0.6` paths, or upgrading Azurite / `@azure/ms-rest-js` without new evidence.
- A blind Satori version upgrade, an invalid dependency-tree exception, or an unreviewed renderer replacement.
- Changes to runtime renderer behavior outside the selected fflate/dependency correction.

## 8. Confirmed Facts

- The current root dependency tree is invalid according to npm because Satori declares exact `fflate@0.7.3` while the override installs `0.7.5`.
- The current root and staging locks both record Satori `0.33.5` with `fflate: "0.7.3"` in its dependency metadata and resolve fflate to `0.7.5`.
- Latest Satori `0.59.1` still pins `fflate@0.7.3`; the checked later releases `0.40.0` and `0.50.0` do too. The latest Satori upgrade does not solve the valid-tree requirement.
- `@vercel/og@1.0.3` depends on Satori `0.33.5`. `@resvg/resvg-js@2.6.2` rasterizes SVG; it does not replace Satori's JSX-like layout and measurement role.
- The renderer's current type/layout/measurement integration is directly coupled to Satori. `@napi-rs/canvas@1.0.11` is a possible independent rendering primitive, not an API-compatible drop-in.
- Root's Azurite-scoped form-data correction is present in the manifest and lock. Staging contains `form-data@4.0.6`, not the targeted `2.5.x` dependency path.
- The root audit count and prior test results are supplied handoff facts. QA must refresh them against the final install; the earlier tests are not final-state evidence.
- Current CI uses Node 24 on `ubuntu-latest` and contains no staging production install/render job. The workflow is CI-only and has no deploy steps.
- The existing `backend/scripts/render-golden.mjs` targets `backend/dist`; running it unchanged does not prove the staged runtime uses `_deploy_staging/node_modules`.

## 9. Assumptions and Open Questions

- **O-1 is blocking:** user selects a maintained source fork or renderer replacement. For a fork, the user also approves an owner and a durable distribution path usable by root and staging. No dependency implementation can proceed until that decision is recorded.
- The `@napi-rs/canvas@1.0.11` version is a candidate verified on 2026-10-15, not an accepted package selection. Recheck its current stable version, license, and Node 22 Linux native support before implementation.
- The root audit's 82 findings are a reported current snapshot, not a proven baseline. QA must not call them pre-existing without durable comparative evidence.
- A successful Node 22 CI job is required for staging native evidence. Windows-native modules and the existing Node 24 jobs are not substitutes.
- No Azure/EAS operation is authorized by this plan.

## 10. Existing Components to Reuse

- Current scoped root form-data override and root/staging lockfiles.
- Current `sharp@0.35.5`, `@resvg/resvg-js@2.6.2`, renderer assets, and versioned renderer fixtures where still used by the selected route.
- Existing backend renderer unit, golden, and text-layout tests.
- Existing `npm run build:verify --workspace=backend` workflow and `.github/workflows/ci.yml` Node setup conventions.
- Existing staged build layout under `_deploy_staging/dist`; do not use the unchanged backend-only golden script as the staging smoke proof.

## 11. Proposed Technical Solution

1. Resolve O-1 before changing dependencies. Record the selected route, fork owner/source/distribution (if applicable), and required visual compatibility level.
2. For Option A, use a source-controlled Satori package whose own manifest declares patched `fflate@0.7.5`. Do not install the upstream Satori package and then alter installed metadata. Preserve the upstream source attribution and MPL-2.0 notices; document the upstream synchronization owner. Keep Satori's current renderer contract unless tests show a required source/API change.
3. For Option B, port the current templates and their measurement behavior to the selected independent renderer. The candidate `@napi-rs/canvas@1.0.11` uses a different API and native binaries; do not remove Resvg, Sharp, fonts, or assets until the port demonstrates they are unused. Recheck the candidate's latest version before adding it.
4. Remove the root and staging fflate overrides only when the selected package graph itself resolves to patched fflate or no longer contains fflate. Regenerate both locks with npm; never hand-edit lock metadata.
5. Preserve root `azurite -> @azure/ms-rest-js -> form-data@2.5.6`, separate production `form-data@4.0.6`, and Sharp `0.35.5`. Do not broaden the form-data override.
6. Add a Node 22 Linux x64 CI job while leaving Node 24 CI jobs unchanged. The job builds and verifies the backend, syncs the output to `_deploy_staging/dist`, runs a clean `_deploy_staging` production install, checks the effective dependency tree and staging audit, loads the staged renderer and native dependencies, and renders the existing fixture to a non-empty 1080 x 1350 PNG. This job performs no deployment.
7. Correct the infrastructure KB only after both root and staging graphs are final. Update dependency versions and describe the actual Linux CI gate; remove the stale `form-data@2.5.5` and fflate compatibility claims.

## 12. Backend Work Package

### WP-BE-01: Implement the Selected Renderer Dependency Strategy

Status: Blocked — pending O-1

Agent: Backend

Goal: Implement the user's selected source-level dependency solution, produce valid root and staging lock graphs, and preserve the verified form-data and Sharp corrections.

Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- `package.json`
- `package-lock.json`
- `backend/package.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `backend/src/lib/instagramRenderer/`
- `backend/scripts/copy-instagram-assets.mjs`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4

Dependencies:
- O-1: selected strategy; for a fork, owner and source/distribution mechanism are recorded

Expected Handoff:
- Selected package source, exact manifest declaration, license/provenance, owner, and distribution path.
- Root and staging locks regenerated by npm; clean installs and `npm ls --all` pass in both roots.
- Root `form-data@2.5.6`, production `form-data@4.0.6`, and Sharp `0.35.5` are preserved.
- Renderer test/golden impact is documented, with no unreviewed baseline change.

### WP-BE-02: Add Linux Node 22 Staging CI Gate

Agent: Backend

Goal: Add an Ubuntu x64 Node 22 job in `.github/workflows/ci.yml` that validates the exact staging production install and renderer runtime without publishing or deploying.

Required Knowledge Base:
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/01-system-overview.md`

Required Repository Context:
- `.github/workflows/ci.yml`
- `package.json`
- `backend/package.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `backend/src/lib/instagramRenderer/`
- `backend/scripts/copy-instagram-assets.mjs`
- `backend/scripts/render-golden.mjs`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-5
- AC-6
- AC-8

Dependencies:
- WP-BE-01

Expected Handoff:
- A required CI job using `ubuntu-latest`, x64, and Node 22; existing Node 24 jobs remain unchanged.
- The job performs root install/build verification, stages the compiled output, runs `_deploy_staging` `npm ci --omit=dev`, checks the staging dependency graph/audit, and invokes `_deploy_staging/scripts/verify-renderer-smoke.mjs`.
- The smoke imports the renderer from staged `dist`, resolves runtime packages from staged `node_modules`, and verifies native loading plus a non-empty 1080 x 1350 PNG from the versioned fixture.
- The job contains no Azure, Functions publish, or EAS commands.

### WP-BE-03: Final Backend Gates and Knowledge Base Update

Agent: Backend

Goal: Re-run backend checks against the selected final graph and update the infrastructure KB to match the shipped package source and validation boundary.

Required Knowledge Base:
- `docs/kb/tech/02-backend.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/08-testing.md`

Required Repository Context:
- `backend/package.json`
- `package.json`
- `package-lock.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `docs/kb/tech/07-infrastructure.md`
- `backend/src/lib/instagramRenderer/`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-7

Dependencies:
- WP-BE-01
- WP-BE-02

Expected Handoff:
- Final exit codes and summaries for backend unit tests, typecheck, and `build:verify`.
- Updated `docs/kb/tech/07-infrastructure.md` accurately describes the selected renderer source, effective dependency graph, form-data paths, Sharp version, and Node 22 CI gate.
- No claim that unrelated root audit findings are clean or historically pre-existing.

## 13. QA Work Package

### WP-QA-01: Independently Verify the Final Dependency and Renderer State

Agent: QA

Goal: Verify every acceptance criterion against final manifests, locks, clean installs, test/CI evidence, renderer output, audit data, documentation, and scope. Write the durable report at `docs/qa/reports/PLAN_Production-Dependency-Advisories.md` using `fittrack-qa-v1`.

Required Knowledge Base:
- `docs/kb/tech/08-testing.md`
- `docs/kb/tech/07-infrastructure.md`
- `docs/kb/tech/01-system-overview.md`

Required Repository Context:
- `package.json`
- `package-lock.json`
- `backend/package.json`
- `_deploy_staging/package.json`
- `_deploy_staging/package-lock.json`
- `.github/workflows/ci.yml`
- `backend/src/lib/instagramRenderer/`
- `_deploy_staging/scripts/verify-renderer-smoke.mjs`
- `docs/kb/tech/07-infrastructure.md`
- `docs/qa/reports/README.md`

Required Skills:
- None

Relevant Acceptance Criteria:
- AC-1
- AC-2
- AC-3
- AC-4
- AC-5
- AC-6
- AC-7
- AC-8

Dependencies:
- WP-BE-01
- WP-BE-02
- WP-BE-03

Expected Handoff:
- QA report at `docs/qa/reports/PLAN_Production-Dependency-Advisories.md`, with every AC exactly once, commands and exit codes, root audit severity/advisory/package-path details, and any environment-limited result recorded as `UNVERIFIED`.
- A concise evidence-based verdict for the Orchestrator. Do not treat unrun Linux staging checks as passed.

Required QA checks:

- Verify both effective dependency trees from clean installs; `npm ls --all` must exit 0 in root and staging. Inspect the selected renderer source/manifest and confirm the tree resolves patched fflate or no longer contains it.
- Verify no affected `form-data@2.5.5` remains; root Azurite resolves `2.5.6`; independent production `form-data@4.0.6` remains; Sharp resolves to `0.35.5`.
- Run root `npm audit --json`; verify `GHSA-hmw2-7cc7-3qxx` and fflate advisories affecting the selected graph are absent. Record the command exit code, current severity counts, advisory IDs, and package paths. A non-zero root audit due unrelated findings is not a clean audit and does not authorize expanding this plan.
- Run `npm audit --omit=dev` from `_deploy_staging`; require exit 0 and no production advisories.
- Run `npm test --workspace=backend`, `npm run typecheck --workspace=backend`, and `npm run build:verify --workspace=backend` against the final graph.
- Verify the Node 22 Linux CI job installs and loads the staged native dependencies and renders a non-empty 1080 x 1350 PNG from staged `dist` and staged `node_modules`.
- For Option A, confirm the fork's source provenance, maintained owner, package source used by both roots, dependency declaration, and preserved MPL-2.0 notices. Existing renderer goldens must remain unchanged.
- For Option B, verify all affected renderer tests and reviewed golden outputs. Any changed golden requires recorded before/after visual review; do not accept snapshot churn alone as proof.
- Verify KB accuracy, change scope, and that no Azure/EAS deployment, build, or publish command was run.

## 14. Test Strategy

- Dependency graph: clean root `npm ci`; root `npm ls --all`; clean staging `npm ci --omit=dev`; staging `npm ls --all`.
- Advisory state: root `npm audit --json` with targeted advisory checks; staging `npm audit --omit=dev`.
- Backend: `npm test --workspace=backend`, `npm run typecheck --workspace=backend`, `npm run build:verify --workspace=backend`.
- Linux production runtime: CI on Ubuntu x64 / Node 22, staging clean install, native dependency load, and staged renderer fixture smoke. Current local Windows lacks Docker and WSL; do not use Windows native modules or Node 24 CI as substitutes. Until the Node 22 job passes, mark this gate `UNVERIFIED`.
- Renderer-fork path: require existing visual/golden outputs to remain unchanged because only the dependency source declaration changes.
- Renderer-replacement path: include all existing composition, typography, measuring, photo, error, and golden cases; require human review of changed baselines before QA acceptance.
- No deployment commands are part of any test gate.

## 15. Acceptance Criteria

- **AC-1:** O-1 is recorded before implementation. The selected dependency source and, for a fork, its maintainer, provenance, license handling, and root/staging distribution mechanism are explicit.
- **AC-2:** After clean installs, root and staging `npm ls --all` both exit 0. No invalid or knowingly unsatisfied dependency edge is waived. The selected graph resolves patched fflate or has no reachable fflate package requiring remediation.
- **AC-3:** Root and staging preserve the intended form-data split: no affected `form-data@2.5.5`, Azurite's `@azure/ms-rest-js` path uses `2.5.6`, and independent production paths remain on `4.0.6`. Sharp remains `0.35.5` unless a tested blocker requires replanning.
- **AC-4:** The selected renderer path passes its complete backend renderer coverage. A Satori fork preserves existing golden output; a replacement has reviewed before/after baselines and no unapproved visual change.
- **AC-5:** Backend unit tests, backend typecheck, and `build:verify` pass on the final dependency state. Earlier intermediate results do not count.
- **AC-6:** Root audit contains neither `GHSA-hmw2-7cc7-3qxx` nor an fflate advisory affecting the selected graph. Staging `npm audit --omit=dev` exits 0. QA records the current root audit exit code, severity counts, IDs, and paths; unrelated findings are not remediated or described as historically pre-existing without evidence.
- **AC-7:** The Node 22 Ubuntu x64 CI gate clean-installs `_deploy_staging` production dependencies, loads the staged renderer/native dependencies, and renders a non-empty PNG with PNG format and exact dimensions `1080 x 1350`. If the job cannot run, QA records `UNVERIFIED`; it must not be reported as passed.
- **AC-8:** `docs/kb/tech/07-infrastructure.md` documents the final selected source and dependency graph, correct form-data paths, Sharp resolution, and Node 22 CI validation. No Azure/EAS deployment, build, or publish is run or authorized; unrelated worktree changes remain untouched.

## 16. Risks and Edge Cases

- **No upstream Satori fix:** latest `0.59.1` still pins `fflate@0.7.3`. A version-only Satori upgrade cannot satisfy the clean-tree goal.
- **Fork ownership:** Option A is supportable only with an owner, source/distribution path usable by standalone staging, preserved license notices, and an upstream synchronization policy. Without those, a fork merely transfers risk.
- **Renderer replacement:** Canvas is not Satori-compatible. Layout, text measurement, line breaks, icon/SVG handling, and current goldens can change. This is a larger product-rendering change and must not be treated as dependency-only work.
- **Native runtime:** local Windows cannot prove Linux x64 Node 22 support. The added CI job is the evidence gate; if it fails or is unavailable, report `UNVERIFIED` and do not claim Alpha runtime readiness.
- **Root audit:** 82 findings are the reported current snapshot, with unknown historical status. Re-run final audit and limit remediation to in-scope advisories.
- **Deployment boundary:** `Infrastructure Impact: Alpha` indicates where runtime dependency changes would eventually take effect. This plan does not authorize `func publish`, `az deployment`, or any EAS command.

## 17. Recommended Execution Order

1. Obtain the user's O-1 choice. If Option A, record the fork owner and source/distribution mechanism; if Option B, record acceptance of the renderer rewrite and visual review scope.
2. Run WP-BE-01 to implement the selected source strategy, update both root/staging manifests and locks, and preserve the form-data and Sharp state.
3. Run WP-BE-02 to add and execute the Node 22 Linux staging CI gate. It performs validation only; it does not publish or deploy.
4. Run WP-BE-03 to execute final backend checks and update the infrastructure KB.
5. Run WP-QA-01 independently and write `docs/qa/reports/PLAN_Production-Dependency-Advisories.md`.

No deployment, EAS build, or Azure resource operation is included in this execution order. Any later Alpha release is a separate operational action requiring explicit authorization.