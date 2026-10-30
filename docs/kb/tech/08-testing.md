# Testing

## Test Runner

Vitest 5 (`^5.0.5`, resolved 5.0.5, Vite 8) — used in all three packages (`backend`, `mobile`, `shared`). Type checking uses TypeScript 7 (`tsc --noEmit`); the classic TypeScript compiler API is not available in TS 7, so AST-based tests import `@typescript/typescript6` (see [02-backend.md](02-backend.md#runtime-and-production-dependencies)). Vitest 5 no longer supports `test.poolOptions`; `backend/vitest.eval.config.mts` and `backend/vitest.contract.config.mts` use `maxWorkers: 1` and `isolate: false` instead.

Install scripts: npm 12 blocks dependency install scripts. The root `package.json` records explicit decisions under `allowScripts`; `@napi-rs/canvas`, `esbuild` and `protobufjs` are all set to `false` (canvas and esbuild binaries come from platform packages; the protobufjs script only prints a version-scheme hint). Run `npm install-scripts ls` after dependency changes; do not approve scripts blanket-wide. Tools that rely on a postinstall download need an explicit, scoped allowance, e.g. `--allow-scripts=azure-functions-core-tools` for Core Tools.

### Current test counts (2026-10-30)

Measured with Vitest JSON reports and recorded in the handoffs and in the QA report `docs/qa/reports/PLAN_FitTrack-Technology-Refresh_Findings.md`; the checked-in minimums in `scripts/test-baseline.json` (`asOf` 2026-10-30) equal them:

| Package | Test files | Tests |
|---|---:|---:|
| `shared` | 10 | 466 |
| `backend` | 84 | 2,709 |
| `mobile` | 108 | 1,002 |

Additional suites: `npm run test:scripts` 27 pass; `npm run test:startup --workspace=backend` 31 pass (28 before the staging-renderer smoke tests were added). These numbers change with the code; the baseline file and the parity gate are the authoritative, versioned source, not this table.

Config files:
- `backend/vitest.config.mts` — unit tests
- `backend/vitest.contract.config.mts` — Cosmos integration (contract) tests
- `mobile/vitest.config.mts`
- `shared/vitest.config.mts`

## Test Types

### Unit Tests

Colocated with the implementation file, named `*.test.ts`.

Focus: pure functions, business logic, calculations, validation rules.

Examples:
- `shared/lib/profileCalculator.test.ts` — BMR + target calculation
- `shared/lib/nutritionCalculator.test.ts` — macro scaling
- `shared/lib/plateauDetector.test.ts` — plateau algorithm
- `backend/src/lib/hintEngine.test.ts` — rule evaluation
- `backend/src/lib/quota.test.ts` — quota enforcement
- `backend/src/functions/foodSearch.test.ts` — search deduplication
- `mobile/src/modules/nutrition/hub/hubReducer.test.ts` — state machine

### Contract Tests (Cosmos Integration)

Located alongside their repositories, named `*.contract.test.ts`.

Require a running Cosmos emulator. Configured via `vitest.contract.config.mts`.

Examples:
- `cosmosDiaryRepository.contract.test.ts`
- `cosmosWeightsRepository.contract.test.ts`
- `cosmosAiUsageRepository.contract.test.ts`
- `cosmosFoodProductRepository.contract.test.ts`
- `cosmosRecipesRepository.contract.test.ts` — owner-backed compatibility and ownerless `/id` community documents
- `profileDeletionRepository.contract.test.ts` — user/legacy partition sweep, lock exclusion, and shared-data isolation

Repository delta contract tests seed legacy documents without optional
`updatedAt`, verify the `createdAt` fallback and inclusive boundary, and prove
that reads stay within the requested `/userId` partition. Diary delta tests
also seed `_docType: 'dayMeta'` in the shared container and verify it is not
returned as a Meal. These additive Class-0 fields require no migration.

Profile deletion unit coverage is colocated in `profileDeletion.test.ts`,
`profileDeletionRepository.test.ts`, `functions/profile.test.ts`,
`functions/reusableItems.test.ts`, `functions/reusableItemsEnrich.test.ts`,
`functions/reusableItemsEnrichScheduler.test.ts`, and `recipeHttp.test.ts`.
It covers strict request validation, authenticated request rejection during
the lease, queue-worker rejection at start, scheduler skipping locked users,
cleanup without waiting for pre-lock work, repeated personal-blob inventory
until empty, and selected ownerless community cleanup. It intentionally does
not claim that pre-lock work cannot write after `204`; that residual is part of
the contract. The Cosmos contract requires the local emulator; without it, the
persistence boundary is `UNVERIFIED`, not a pass.

### Registration Test

`backend/src/lib/registrations.test.ts` — verifies every `*.ts` file in `functions/` is imported by `index.ts`. Prevents 404 bugs from forgotten route registrations.

This test runs as part of the standard unit test suite.

## Run Commands

```bash
# Backend unit tests
cd backend && npx vitest run

# Backend contract tests (requires Cosmos emulator)
cd backend && npx vitest run --config vitest.contract.config.mts

# Azure OpenAI prompt evals (requires configured credentials)
cd backend && npm run test:eval

# Shared unit tests
cd shared && npx vitest run

# Type check (mobile + shared)
npx tsc --noEmit  # from mobile/ or shared/
```

### Real Functions Host Smoke

Run `cd backend && npm run test:functions-smoke` with Node.js 24, Azure Functions Core Tools, and `backend/local.settings.json` available. The smoke builds the backend, starts the existing local dev orchestration and Azurite, disables the queue and timer background functions, checks `GET /api/health` (200) and unauthenticated `GET /api/diary/meals` (401), and compares both source declarations and host registrations against the checked-in versioned 79-name baseline at `backend/scripts/fixtures/functions-baseline.v1.json`. The Node startup tests validate its version, fixed count, uniqueness, deterministic ordering, and comparison failures without starting the host. It clears inherited cloud integration environment variables so Core Tools uses local settings, then stops the local process tree.

## Rules

- [Rule] **Every logic change must be covered by unit tests.** Logic = pure functions, calculations, validations.
- [Rule] **Bug fix workflow (Red → Green):** write a failing test reproducing the bug first, then fix until green.
- [Rule] **After every implementation, run all affected test suites** — backend, shared, and mobile as appropriate.
- [Rule] **After changing shared imports in backend, run `npm run build:verify`** — catches the relative-path import issue.
- Mobile: smoke tests only for re-exports; full tests in the owning package (backend/shared).

## Test Conventions

- Logic tests belong to the package that owns the implementation
- Mocks: use `vi.mock()` for external dependencies (Cosmos, OpenAI, etc.)
- `backend/src/lib/auth.ts` exports `_setJwksForTesting()` for unit test JWKS injection
- Repository tests use the in-memory implementations unless testing Cosmos-specific behavior
- Contract tests should be isolated from unit test runs (separate config + CI step)
- Prompt evals are explicit live checks. `npm run test:eval` loads local Azure
	settings without printing secrets; exit code `2` means `UNVERIFIED` because
	required credentials are unavailable.

### Weekly Insight Diagnostic Evidence

The Weekly Insight semantic judge must provide a non-empty excerpt present in
the generated text. The local evidence comparison ignores capitalization only;
numbers, wording, punctuation and whitespace are not normalized or fuzzily
matched. The original evidence remains unchanged in diagnostic output. Missing
or changed evidence and ambiguous judgments remain `UNVERIFIED`; contradictory
target judgments remain `INCORRECT`. Unit regressions cover the recorded
`dein` versus `Dein` mismatch and changed calorie/percentage negatives. This is
an eval-only correction, not a production prompt or calorie-calculation change,
and does not reclassify previously recorded failed runs.

### Instagram Detail-Template Fixtures

Detail-template unit tests reuse the versioned
`backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png`
for the Alpha-derived recipe data. Their file-read guard rejects local
`output/alpha-recipe-assets` photos so missing CI assets cannot be masked by
local downloads. Production fonts, text measurements, and PNG rendering run
unchanged. Visual approval fixtures and rendering scripts retain their Alpha
photos; those local files are not prerequisites for Tier 1.

The same existing renderer test file covers the internal generated-text probe:
real-font/full-render measurement parity for 1-5 steps and three title layouts,
title-dependent teaser sizing, German breaks, all-field overflow collection and
invalid/skipped fields. The Alpha four-step sentence measures 300 x 112 px
against 302 x 105 px; a shorter ingredient-preserving sentence passes at the
unchanged 22 px step font. Three pre-extraction PNG SHA-256 fingerprints lock
the full-render output. Boundary tests inject only the final measured dimension
at 0.5 px / 0.5001 px while retaining real fonts and the real layout engine. Tests for each
teaser selection size inject overflow in earlier attempts; real-font title
variants separately exercise natural sizing. Isolated cold-start tests block
Sharp imports and non-font reads and check missing/corrupt fonts and
render-engine failures (public error code `FONT_OR_SATORI_FAILED`, kept for contract stability). No live AI, authenticated photo or confirmed export view is
required by these offline probe tests.

### Instagram Renderer Reference Corpus

`backend/src/lib/instagramRenderer/__tests__/referenceCorpus.test.ts` checks
six versioned PNG fixtures (the frozen baseline generated before the renderer
moved from Satori/Resvg to `@napi-rs/canvas`; never overwritten by the new
renderer) and their renderer-neutral manifest:
PNG format and `1080 x 1350` dimensions, non-empty output, an empty overflow
list, text-box sizes and line counts. The fixtures cover Nutrition with and
without a photo and detail templates with 1, 5, 9 and 20 ingredients. Every
recipe photo is the versioned `quarkbroetchen-source.png`; the no-photo case
uses a transparent generated pixel.

The hard checks are the manifest (including the recorded `pixelmatch` threshold
`0.10` and maximum ratio `0.03`), PNG format and SHA-256/size of the baseline
files, `1080 x 1350` dimensions, non-empty output, empty overflow list, line
counts, text-box heights and text-box widths within the width tolerance. The
pixel comparison itself (`pixelmatch`, threshold `0.10`) is **report-only**: the
test only asserts that the differing-pixel ratio is finite and writes it to the
optional review report (`RENDERER_CORPUS_REVIEW_DIR`). The `0.03` ratio is not
enforced; the Product Owner's visual review is the acceptance step. The report
is meaningful on Windows x64 with Node 24. Reference regeneration is guarded by
`UPDATE_RENDERER_REFERENCE_CORPUS=1` and is limited to the canonical platform;
the generation command and historical-Golden separation are documented in
`backend/src/lib/instagramRenderer/docs/golden-metrics.md`. The canonical-platform
CI job is `renderer-reference-corpus` (`windows-2022`, Node from
`.nvmrc`; formerly `renderer-reference-pixel-gate`). When the renderer moved to `@napi-rs/canvas`, a Windows x64 pixelmatch
comparison against the frozen baseline measured 0.31 % to 0.74 % differing
pixels per fixture (reported against the 3 % reference value, not enforced); the agent's visual check of one fixture
attributed the difference to text anti-aliasing (WP-BE-02
handoff; the Product Owner's visual approval of the side-by-side images is
**[Open]**). `golden.test.ts` (historical diagnostic, not a release gate)
expects a differing-pixel ratio of about 0.5946 with a tolerance of 0.01 since
`pixelmatch` 8 (OKLab distance); thresholds and gates were not weakened.

### Recipe Preparation Feedback Loop Evidence

[Partial] B-1 probe is implemented with passing recorded offline evidence;
B-2 r3 / QA-R1 loop is implemented, NOT ACCEPTED / release CLOSED. Dedicated colocated
`recipePreparation.test.ts`, handler/source-validator/SDK tests and the existing
renderer tests cover initial/correction1/correction2 success and three-draft
exhaustion, immutable original context/latest draft, complete rechecks/count
changes, real-font Alpha overflow, technical precedence, missing/non-finite
measurements, provider/refusal/timeout/late results, once-only quota/booking,
no writes, generic HTTP and exact latest affected-text exhaustion privacy.
Injected SDK/time/measurement tests are offline coverage, not evidence that
every failure mode executed live. V12 Preparation guards are separate from
unchanged v17 Import; geometry is separate from independent cooking-core,
ingredient-fidelity and contradiction rubrics and explicit user review.

Q-21 correction-attempt regressions cover source cooking endpoints in all three
Preparation prompt paths and positive/negative reviewed aggregate-time provenance.
Final attempt 2 adds pre-compression time-decision and cooking-priority prompt
checks, rice essential-cooking omission independent of metadata, and reversed
FIRST-order rejection; free non-adjacent groups remain covered positively.
The existing live fixtures require `null` total time for unchanged rice, oven,
pasta and forced dough. Oven metadata checks do not replace its human cooking
review (`MANUAL VALIDATION REQUIRED`). Final-candidate F/R/G belong to the
next independent QA run; dated recorded checks below remain historical.

QA-R1 regressions cover unknown-key-only/nonstring metadata-only logging,
production-derived compact lineHeight1.17, correction path/index guidance and
recorded-oven replay with an injected fitting final draft. Narrow test-only
pasta action-boundary and exact single-stage dough whole-set equivalence fixes
retain negative contradiction/omission/invention/staged-component checks.
All local corrections are reported tested, pending independent QA; no QA
finding/register closure or provider-success proof follows from offline replay.

Recorded r3 / QA-R1 commands/results, NOT rerun by documentation-only D-1-R1:

| Check | Recorded command family (exact arguments/hashes in linked records) | Exit | Executed / Passed / Failed / Skipped |
| --- | --- | --- | --- |
| Focused final | `npm exec --workspace=backend -- vitest run` on the six owning test files | 0 | 519 / 519 / 0 / 0 |
| Units | `npm run test --workspace=backend -- --reporter=default --reporter=json --outputFile=<recorded report>` | 0 | 1600 / 1600 / 0 / 0 |
| Typecheck | `npm run typecheck --workspace=backend` | 0 | non-test |
| Build | `npm run build:verify --workspace=backend` | 0 | non-test |
| F | `node backend/scripts/run-eval.mjs src/lib/prompts/recipeAnalyze.eval.test.ts --testNamePattern "preparation prompt version matches fixture expectations\|recipePreparation"` plus recorded reporters | 1 | 5 / 2 / 3 / 9 |
| R/G | NOT_RUN after required F failure; no command dispatched | null | 0 executed; 0 provider calls |

F's passing v6 version guard plus four fixtures include 10 logical calls (one
forced initial draft) and 9 SDK calls. Pasta passes independent semantics.
Rice fails FIRST 6 before 5 and overflows at indices1/2 (300x112 versus302x105),
422/usage0; forced dough repeats the same literal mixing overflow at index0,
422/usage0. Both exhaust three logical calls; semantics are NOT_REACHED.
Oven fits/200/usage1 but fails independent source binding: source-3 cream action
is in the source-4 group. Fit/reference validity/200 is not semantic PASS.
R/G are NOT_RUN_REQUIRED_LIVE_FAILURE. Offline records
predate candidate freeze (`candidateSha256: null`), not hash-guarded gate runs.

The initial focused run (519/518/1/0, stale v5 companion guard) and all Red
records remain failures; the final focused run is separately recorded.
Historical r2 F remains FAIL (5/2/3/9, 8 logical/7 SDK calls). QA proved pasta's
cross-action regex false positive and dough's excess literal-name requirement,
not actual cooking corruption. New rubric repairs do not retrospectively PASS
that run, and new dough exhaustion does not reach an equivalence assertion.

See [B-2 r3 recorded commands and hashes](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Gate-Summary_2026-10-09-r3-QA-R1.json),
[53-artifact inventory](../../User%20Stories/Reciepe/B-2_Feedback-Loop_Artifact-Manifest_2026-10-09-r3-QA-R1.json)
and [current evidence boundary](06-ai-integrations.md#preparation-feedback-loop-current-r3-qa-r1).
Q-19 FAIL, old B-16/B-18/B-18C/B-19 FAIL/UNVERIFIED and foreign Import/Daily
failures remain preserved; R/G NOT_RUN cannot close them. No independent QA,
release or authenticated private/Alpha replay is claimed. The historical
14:12 Alpha release deployed only logging, not the loop. D-1-R1 performs only
focused documentation assertions, links/encoding/errors and owned-diff/hash
preservation checks, not units/typecheck/build/live gates. Its
[handoff](../../User%20Stories/Reciepe/D-1_Feedback-Loop_Handoff_2026-10-09-r1.md)
records those separate results; documentation PASS cannot waive feature gates.

### Daily Insight Prompt and Cache Checks

The authoritative Daily Insight behavioral boundaries are in the
[central rulebook](../domain/09-daily-insight.md). US-03's live gate covers the
affected Daily suite only; Weekly Insight diagnostics are separate and are not
part of this story's acceptance gate. A fresh 10-run Daily series is required
after any prompt-, schema-, validator-, fixture-, or eval-relevant change.
Current candidate release v30 / prompt v29 / assembly v13 binds
`sha256:827de73de0186f5320ad02e23c2896cd82a2e85a4d20a08040cdaefc688037eb`.
The fresh 10-run evaluation for this candidate is pending; the prior evidence
below predates the CTA removal. Prior offline baseline (2026-10-20): 71 Backend
test files, typechecks, and the release guard passed. Eval fixtures include `protein-above-range-no-warning` and
`protein-high-with-calories-over-target`, and a prompt test pins the protein
above-range guidance for every intent. The Daily validator tests (`dailyInsightValidation.test.ts`) cover schema
and length limits, greeting/short-insight structure, and calorie
numbers that were not supplied; wording is intentionally not tested. The Daily
live eval (`dailyInsight.eval.test.ts`) asserts only structure and supplied
numbers; its former `forbiddenPhrases`/`requiredPhraseGroups` and the
wording-based rubric tests were removed, and wording is reviewed manually from
the saved `backend/output/daily-insight-*.json` artifacts. Ten consecutive
Daily-only live runs passed. This is a weaker gate than the earlier planned
rubric; a broader test strategy (replay set, quality rubric, smoke gate) is a
separate follow-up scope. The Weekly diagnostic is a separate feature
check and is excluded from US-03 acceptance.

The active Daily prompt is tested through
`backend/src/lib/prompts/dailyInsightPrompt.ts`, which is the sole runtime
composition root. Unit tests cover all six intent snapshots, deterministic
canonical-bundle fingerprinting, the append-only manifest preserving v14-v29
and locking active v30, and the context-dependent system-prompt hashes. The
offline release check
`npm run verify:daily-insight-prompt --workspace=backend` verifies the active
release fingerprint, historical manifest entries, and provider-visible prompt
or schema changes without calling Azure OpenAI. Changes to
`dailyInsightValidation.ts` count as provider-visible only when an exported
`DAILY_INSIGHT_*_MAX_LENGTH` constant is changed, added, or removed; edits to
the local Zod post-validation do not require a new release.
Local consistency checks for the same change include
`npm run build:verify --workspace=backend`, `node scripts/check-encoding.mjs`,
and `git diff --check`.

Repository and handler tests cover the complete cache identity:
`promptVersion`, `promptFingerprint`, `systemPromptHash`, selected intent,
prompt snapshot, and input hash. They also cover the semantic boundary
`remainingCalories = -0.01`, `0`, `0.01`, with `null` and non-finite values
treated as `unknown`.
Missing or changed provenance must regenerate before rate limits are applied;
an unchanged complete identity remains a cache hit. Daily and Feedback
roundtrips verify the server-owned provenance, exact feedback binding, and
legacy documents without optional identity fields. Legacy documents remain
readable without a backfill; the Class 0 change is verified by compatibility
tests rather than a migration.

Handler tests also prove that a complete unexpired same-date v14 cache entry is
returned unchanged until expiry, while the repository status-operation test
constrains the read projection to status metadata and the patch to
`/processingStatus`.

For this US-03 task only, emulator persistence is **UNVERIFIED / vom User aus
Prüfauftrag ausgenommen**, never PASS. No contract command, installation,
remote Cosmos write test or deployment is authorized. Offline handler and
Daily/Feedback repository regressions remain mandatory and are included in
the unit run; they do not prove actual Cosmos serialization, partition
isolation or TTL. This excluded emulator boundary alone does not block B-1,
F-1 or completion after independent Q-1. All other required gate failures or
missing evidence still block completion. This is not a general change to CI
or other features' contract-test requirements.

Prompt evals remain explicit live checks for the tested release. They are not
part of the normal CI job because they require Azure credentials and incur
provider cost; unavailable credentials are reported as `UNVERIFIED`, not as a
silent pass. The Daily Insight eval makes one live generation per fixture and
uses deterministic local assertions for explicit safety contracts; model-based
judge verdicts are not part of its pass criteria.

## Phase-0 Gates

The Phase-0 safety net combines focused tests with runtime checks:

- **Wire-contract tests** exercise backend provider adapters against controlled HTTP responses, checking the serialized request and response mapping without calling a live provider.
- **Schema characterization tests** record the current Zod request-schema behavior, including optional, nullable, and unknown fields, so later validation changes are deliberate.
- **Renderer reference corpus** protects deterministic recipe-image output using checked-in reference inputs and expected rendering evidence; see the renderer corpus section above.
- **Functions host smoke** (`npm run test:functions-smoke --workspace=backend`) builds and starts the real Core Tools host with Azurite, checks `/api/health` (200), an unauthenticated protected diary route (401), and all 79 registered function names against source declarations, then stops the process tree. CI installs Core Tools 4.16.0 with `--allow-scripts=azure-functions-core-tools` (npm 12 blocks the postinstall that downloads the `func` binary otherwise) and copies the non-secret `backend/local.settings.json.template`; no cloud credentials are used.
- **Mobile bundle smoke** (`npm run smoke:bundle --workspace=mobile`) runs `expo export --platform android` into an OS temporary directory and requires a non-empty bundle.
- **Mobile manifest smoke** (`npm run smoke:manifest --workspace=mobile`) runs Android prebuild in a temporary project outside the repository and checks Health Connect permissions and package visibility, the verified Alpha App Link, the URI scheme, and minSdk 26. It does not modify `mobile/android/`.
- **Expo Doctor smoke** (`npm run smoke:doctor --workspace=mobile`) pins Expo Doctor 1.21.5 and passes when all checks pass (20/20 on 2026-10-30 with SDK 58). The script still contains a tolerance for one SDK 54 patch-version mismatch (`expo ~54.0.37` vs `54.0.36`); with SDK 58 it cannot match and any finding fails the smoke. The stale tolerance is a code cleanup left open ([Open]).
- **Android debug assemble** (`npm run smoke:android-debug --workspace=mobile`) runs Expo prebuild in an OS temporary project, then invokes its generated Gradle wrapper with `assembleDebug`; it requires JDK 17 or newer plus Android SDK Platform 36, Build Tools 36.0.0, and NDK 27.1.12297006, and does not modify `mobile/android/`. It is not an EAS build. On Windows, long checkout paths can exceed the NDK/Ninja 260-character path limit when generated CMake object paths include `node_modules`; the CI job runs on Ubuntu and is unaffected by this Windows-specific limitation.
- **Test parity gate** (`scripts/check-test-parity.mjs`, versioned baseline `scripts/test-baseline.json`) consumes the shared, backend, and mobile Vitest JSON reports. It enforces the checked-in file/test counts as minimums and rejects failed, skipped, pending, todo, or otherwise non-passing tests. Raising the baseline is a deliberate edit of that file; lowering it requires a justification (rule: do not remove tests without justification).
- **Staging renderer smoke** (`npm run smoke:staging-renderer --workspace=backend`, `backend/scripts/staging-renderer-smoke.mjs`) renders one PNG with the production-only install in `_deploy_staging`; `@napi-rs/canvas` must resolve from `_deploy_staging/node_modules`, and the PNG must be exactly 1080x1350 and non-empty. Its unit tests are part of `test:startup`. Locally it was run on Windows only; the Linux result needs the CI job (see below) and is `UNVERIFIED` until a run on the final state is recorded.
- **Daily Insight prompt guard** (`npm run verify:daily-insight-prompt --workspace=backend`) is content-based: it diffs the provider-visible prompt/schema files against a base revision (`FITTRACK_PROMPT_GUARD_BASE`, push `before` SHA or merge base), requires a new append-only manifest release when they changed, and for `dailyInsightValidation.ts` compares only the exported `DAILY_INSIGHT_*_MAX_LENGTH` constants, so edits to local Zod post-validation do not trigger a release.

CI runs the Functions host smoke, the three non-Gradle mobile smokes, Android debug assemble, a Windows x64 Node 24 renderer reference-corpus job, and the staging install/audit/renderer-smoke job as separate jobs. The renderer job enforces the corpus structure and layout metrics and reports the pixel difference (report-only); Ubuntu Tier 1 enforces the same structure and layout metrics. The parity check runs in the Tier 1 unit-test job. The existing Tier 2 Cosmos contract job is unchanged apart from the emulator tag.

## Dependency Policy and Update Process

Versions and the two remaining audit exceptions are listed in [01-system-overview.md](01-system-overview.md#version-pins-and-support-matrix).

- **Update source:** `.github/dependabot.yml` (weekly) covers npm for the root workspaces (`/`, one lockfile for `mobile`, `backend`, `shared`, `tools/off-import`), npm for `/_deploy_staging` (production-only set) and GitHub Actions. Expo SDK packages (`expo*`, `react-native*`, `@expo/*`) form one group for minor/patch updates; major updates, including a new Expo SDK, are separate PRs. Docker is not configured because the repository has no Dockerfile. The file was only syntax-checked locally; GitHub validates it after the push ([Open]).
- **Expo-managed packages** move with the SDK: use `npx expo install --check` (must say up to date; `typescript` is excluded via `expo.install.exclude`) instead of raising them individually. On 2026-10-30 `react 19.3.1`, `react-native-gesture-handler 3.4.0`, `react-native-safe-area-context 5.11.0`, `react-native-worklets 0.13.1` and `@react-native-async-storage/async-storage 3.x` were newer than the pins but intentionally held to the SDK 58 line; `@types/node` stays on 24 because the runtime is Node 24.
- **Audit gate:** the production set must be clean: `npm audit --omit=dev` in `_deploy_staging` (blocking in CI, 0 findings on 2026-10-30). The full root `npm audit` is report-only in CI (`continue-on-error`); any finding outside the documented exceptions PO-1 (Azurite chain) and PO-2 (Expo build tooling) must be investigated. Fix with a normal upgrade or lockfile update; no `--force`, no downgrade, no blanket overrides (the one existing override is targeted and nested). Time-limited exceptions need advisory ID, dependency path, reachability, upstream evidence and a review date, and are re-checked at every upstream release.
- **npm 12 install scripts:** scripts are blocked unless allowed. Review new native/tool packages with `npm install-scripts ls`, record decisions in root `allowScripts`, and use scoped CLI flags (`--allow-scripts=<package>`) for global tools. CI installs npm 12.2.1 explicitly and reads the Node version from `.nvmrc`.
- **After every dependency change** run, from the repository root: `npm ci --dry-run`, `npm ls --all` (also in `_deploy_staging`), `npm run typecheck`, the three Vitest suites, `npm run test:scripts`, `npm run test:startup --workspace=backend`, `npm run build:verify --workspace=backend`, `npm run check:encoding`, and the parity gate; for mobile changes also `smoke:bundle`, `smoke:manifest` and `smoke:doctor`. The Backend suite must run with `backend` as the working directory.
- **Renderer-affecting updates** (`@napi-rs/canvas`, fonts, icon packages, `sharp`) must pass the reference corpus and the staging renderer smoke.
- **Not covered by automated gates:** prompt evals (live, credentialed; one run on 2026-10-30 exited 0 with 61 tests, whether all calls were live is not independently proven), Cosmos contract tests (need an emulator, none was available locally; CI result is Product-Owner-reported only), Android debug assemble locally (Windows path length; CI only), and device validation of an Expo SDK change (`MANUAL VALIDATION REQUIRED`).

## Coverage Target

High function-level coverage on business logic is explicitly desired. No specific percentage target is documented, but any logic that can be tested should be.

## CI Pipeline (`.github/workflows/ci.yml`)

GitHub Actions — runs on every push and pull request to `main`.

A separate encoding-check job also runs `node scripts/check-encoding.mjs`.

### Tier 1 — Unit Tests and Offline Prompt Guard (30 min timeout)

Runs on `ubuntu-latest`. Steps in order:
1. Typecheck `shared` — `npm run typecheck --workspace=shared`
2. Typecheck `backend` — `npm run typecheck --workspace=backend`
3. Typecheck `mobile` — catches TypeScript errors before `expo build` does
4. Verify the active Daily prompt release —
	`npm run verify:daily-insight-prompt --workspace=backend`
5. Shared unit tests — `npm test --workspace=shared`
6. Backend unit tests — `npm test --workspace=backend`
7. Mobile unit tests — `npm test --workspace=mobile`
8. Repository script tests — `npm run test:scripts`
9. Backend startup tests — `npm run test:startup --workspace=backend`
10. Backend build verification — `npm run build:verify --workspace=backend`
11. Test parity — `node scripts/check-test-parity.mjs` with the three Vitest JSON reports

All three typechecks run before tests to fail fast on cheap checks.

The independent `functions-host-smoke`, `mobile-smokes`, and
`android-debug-assemble` jobs run the Phase-0 runtime gates. The Android job
uses JDK 17. These jobs require no secrets and perform no deployment.
The separate `renderer-reference-corpus` job runs the reference-corpus
test on `windows-2022` with Node 24, the canonical platform for the
report-only pixel comparison (structure and layout metrics gate; pixel ratio
is reported, not enforced).

The `staging-linux-renderer-smoke` job (`ubuntu-latest`) builds the backend, copies
`backend/dist` to `_deploy_staging/dist`, runs `npm ci --omit=dev` in
`_deploy_staging`, fails on `npm audit --omit=dev` findings (blocking), and runs
`npm run smoke:staging-renderer --workspace=backend`: it loads
`@napi-rs/canvas` from the staging `node_modules` and renders one PNG that must
be exactly 1080x1350 and non-empty. A final root `npm audit` step is
report-only (`continue-on-error`); the expected findings are the documented
exceptions PO-1 (Azurite chain) and PO-2 (Expo build tooling). Dependabot
(`.github/dependabot.yml`) opens weekly update PRs for npm (root workspaces and
`_deploy_staging`) and GitHub Actions; Expo SDK packages form one group and
major updates are separate PRs.

### Tier 2 — Contract Tests (20 min timeout)

Runs only when Tier 1 passes (`needs: unit-tests`).

Uses the **Azure Cosmos DB Linux Emulator** (vNext, stable dated tag `vnext-EN20261019`) as a GitHub Actions service container:
- Image: `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-EN20261019`
- Listens on **plain HTTP** (not HTTPS) at `http://127.0.0.1:8081`
- `127.0.0.1` (not `localhost`) — avoids Node/undici resolving to IPv6

Readiness check: `node backend/scripts/wait-for-cosmos.mjs` — probes with the same Node/undici stack the tests use. A curl-based probe gave false positives and was replaced.

For local runs, `backend/scripts/start-cosmos-emulator.ps1` maps the
container's port 8081 to host port 18081. This leaves Expo/Metro's default
host port 8081 available. Local contract tests default to
`http://127.0.0.1:18081`; CI sets `COSMOS_ENDPOINT` explicitly to its service
container at `http://127.0.0.1:8081`.

[Rule] Contract tests **never** run against real Azure Cosmos DB. The emulator key is hard-coded in `backend/src/test-utils/cosmosEmulator.ts` as a defence-in-depth safeguard.

### What CI Does Not Include

- No deploy steps — CI is test-only
- No EAS builds
- No live Azure OpenAI prompt evals in CI; those remain an explicit credentialed
	check outside the normal pipeline
