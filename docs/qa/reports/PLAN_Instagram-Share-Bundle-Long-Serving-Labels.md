# QA Report: Instagram Share Bundle Long Serving Labels

- Format: `fittrack-qa-v1`
- Plan reference: [docs/User Stories/plans/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md](../../User%20Stories/plans/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md)
- Verdict: `PASS WITH ISSUES`
- Review date: 2026-10-03

## Scope

Reviewed the full explicitly approved plan and supplied B-1 handoff against AC-1 through AC-7. Only B-1 Backend ran. Frontend, Infrastructure and release were explicitly skipped and are not missing implementation work.

Original user requirement, verbatim: 'ich möchte dass das problem per unit tests abgefangen wird, dann korrigiert wird. Eien neue installation machen wir erstmal nicht, da wir eine parallel entwicklung haben'.

B-1 ownership is limited to:

- [backend/src/lib/instagramRenderer/render.ts](../../../backend/src/lib/instagramRenderer/render.ts): removal of the two fixed 16-character amount checks and correction of the validation message only.
- [backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts): seven-ingredient regression, actual PNG metadata and full-label assertions, genuine width/height overflow, empty/multiline rejection.
- [backend/src/lib/instagramRenderer/recipeAdapter.test.ts](../../../backend/src/lib/instagramRenderer/recipeAdapter.test.ts): formatting, full labels, ordinary units, fallbacks and nonmutation tests.
- [docs/kb/domain/06-recipes.md](../../kb/domain/06-recipes.md): one targeted paragraph about complete amount labels and unchanged geometric limits.

QA read the required context, including [backend/package.json](../../../backend/package.json), [docs/kb/tech/08-testing.md](../../kb/tech/08-testing.md), [docs/qa/reports/README.md](README.md) and [backend/src/functions/instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts). Required skills: None. QA added only this report; no implementation or central findings-register edits.

Out of scope: mobile, API contracts, nutrition calculation, Cosmos documents/migrations, dependencies, layout redesign, deployment, EAS, installation and Azure access/mutations. Existing processes were inspected but not started, stopped or contacted by QA.

## Acceptance Criteria

| ID | Result | Evidence |
|---|---|---|
| AC-1 | Met | Supplied B-1 handoff records regression-before-fix command, exit 1 and `INVALID_TEMPLATE_INPUT`, `field: ingredients`, `itemIndex: 6`, `itemField: amount`, `itemValue: 3 1 portion (10 g)`. Independently inspected `servingLabelDetailsFixture`: five original ingredients plus two, with the exact label at index 6; its test expects PNG success. QA does not reenact Red chronology, as explicitly permitted by the plan and QA instructions. |
| AC-2 | Met | Independent focused execution passes the same seven-ingredient test. The Satori spy delegates to the real implementation, not a fake renderer. Actual PNG metadata from Sharp is 1080x1350; the captured ingredient render node contains exactly `3 1 portion (10 g) Sesam`. Production font loading and measured overflow validation in [render.ts](../../../backend/src/lib/instagramRenderer/render.ts) remain unchanged. [quarkbroetchen.ts](../../../backend/src/lib/instagramRenderer/fixtures/quarkbroetchen.ts) selects the offline fixture [quarkbroetchen-source.png](../../../backend/src/lib/instagramRenderer/test-fixtures/quarkbroetchen-source.png); the test's file-read guard rejects local Alpha output photos. |
| AC-3 | Met | Eight added parameterized cases in [recipeAdapter.test.ts](../../../backend/src/lib/instagramRenderer/recipeAdapter.test.ts) verify complete serving labels, g/piece/can units, existing one-decimal formatting, null-input and empty-unit grams fallbacks. `structuredClone` equality verifies recipe and nested nutrition are not mutated; title-render nutrition remains the stored per-portion values. [recipeAdapter.ts](../../../backend/src/lib/instagramRenderer/recipeAdapter.ts) has no B-1 production changes. |
| AC-4 | Met | A fitting label longer than 16 characters succeeds. Real width and height overflow cases both return `TEMPLATE_FIELD_OVERFLOW`, `field: ingredients`, `itemIndex: 6`, `itemField: text`, and assert the respective measured dimension exceeds its limit plus the existing 0.5 tolerance. Seven empty/whitespace/multiline cases return `INVALID_TEMPLATE_INPUT` with amount-specific ingredient details. Other field limits and geometric checks are unchanged. |
| AC-5 | Met | Independent focused run: 48 tests in 2 files. Independent full backend run: 1193 tests in 63 files, including the 20-ingredient details test and the existing atomic bundle failure tests. Unmodified `build:verify` passes in an isolated source snapshot with existing dependencies. Scoped diff hygiene also passes. No unrelated test or build failures observed. |
| AC-6 | Met | [docs/kb/domain/06-recipes.md](../../kb/domain/06-recipes.md), section Sharing a Confirmed Export View or Request Draft, explicitly states full labels, no fixed 16-character limit, no shortening/translation/label conversion, unchanged numeric formatting and grams fallback, single-line/nonempty validation and measured width/height overflow. This matches the production diff. [docs/kb/tech/08-testing.md](../../kb/tech/08-testing.md) already documents the offline fixture and real fonts/rendering; no change is needed there. No relevant KB/implementation conflict found. |
| AC-7 | Met | B-1 diff and handoff separate the four owned files/hunks from concurrent development. QA made no excluded calls, installs, deployments or data changes. The running Functions host's `backend/dist` was not overwritten: build validation used a separate source snapshot. Concurrent Community/repository/shared/staging/infrastructure edits and the approved plan were left untouched. The pre-existing editor diagnostic is reported separately below, not attributed to B-1. Alpha E2E is explicitly unverified. |

## Tests

Commands use the workspace root unless otherwise noted. The first two entries are supplied B-1 chronology evidence, not independently rerun Red evidence.

| Command | Exit code | Result |
|---|---:|---|
| `npm --prefix backend test -- src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts -t "renders seven ingredients"` (B-1 before fix) | 1 | Supplied handoff: regression failed with the exact AC-1 amount-specific `INVALID_TEMPLATE_INPUT` at index 6. |
| Same targeted command (B-1 after fix) | 0 | Supplied handoff: same regression renders the complete label in a real 1080x1350 PNG. |
| `npm --prefix backend test -- src/lib/instagramRenderer/recipeAdapter.test.ts src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts --reporter=basic` | 0 | Independent QA: 48 passed, 2 files (15 adapter and 33 detail-template tests). |
| `npm --prefix backend test -- --reporter=basic` | 0 | Independent QA: 1193 passed, 63 files; no failing suites. |
| `npm --prefix backend run build:verify` (isolated source snapshot root) | 0 | Independent QA: TypeScript production compile, 10 renderer asset copies, module resolution and duplicate function-ID checks passed. |
| `git diff --check -- backend/src/lib/instagramRenderer/render.ts backend/src/lib/instagramRenderer/recipeAdapter.test.ts backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts docs/kb/domain/06-recipes.md` | 0 | Independent QA: no whitespace errors; only Git line-ending notices. |
| `git show HEAD:backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts` (helper inspection) | 0 | Confirms the diagnosed helper expression already exists identically in HEAD. |

### Build Isolation

Process inspection found an existing local Functions host and an unrelated no-emit test typecheck, so QA did not run a build against their shared output directory. A fresh source snapshot copied the current backend source/scripts, shared source, package metadata and TypeScript configuration. A directory junction reused already-installed dependencies; no package installation took place. Local settings and secrets were not copied. The existing `build:verify` script ran unchanged and produced only isolated output. This is a concurrency-protection execution adjustment, not an implementation or architecture deviation.

### Atomic Failure Handling

The required handler tests were inspected and ran in the full suite. In [backend/src/functions/instagramRecipe.test.ts](../../../backend/src/functions/instagramRecipe.test.ts), `does not return a partial pair when the detail render fails` verifies HTTP 500, neither image property in the response, and unchanged stored export view. `logs the invalid detail item value without returning it` verifies controlled HTTP 422 and no internal item value in the response. Handler, auth and response contracts were not modified by B-1.

## Verification Notes

- State: `UNVERIFIED`
- Check: Alpha end-to-end share flow on an existing installation.
- Reason: The approved plan explicitly excludes deployment, EAS, installation and Azure access/mutations; this backend-local QA run intentionally makes none of those calls. Local renderer tests do not prove the deployed Alpha binary contains this fix.
- Manual action: Only under a separately authorized validation/release task, with the corrected backend already deployed and an existing authenticated installation, open a seven-ingredient recipe whose seventh amount is `3 1 portion (10 g)`, request Share and inspect both returned images. Expected result: an atomic pair of 1080x1350 PNGs, complete fitting label without clipping, no recipe/nutrition mutation; genuine overflow returns a controlled error and no partial pair.
- Result: Not performed in this review. No new installation is required or authorized by this report.

Contract tests, live prompt evals, mobile validation and shared-package tests were not required for the approved backend-renderer-only scope. No persistence, prompt, API or shared implementation changes belong to B-1.

## Findings

No actionable B-1 implementation findings. One independently confirmed pre-existing diagnostic is reported separately; it does not invalidate any acceptance criterion or the successful production build/unit gates.

### QA-LSL-01: Pre-existing Test-Helper Null Diagnostic

- Finding key: QA-LSL-01
- Plan reference: docs/User Stories/plans/PLAN_Instagram-Share-Bundle-Long-Serving-Labels.md
- Acceptance criterion: N/A; separately reported under AC-7.
- Description: The editor reports `'value' is possibly 'null'` in the unchanged `isTemplateElement` helper. `Boolean(value)` does not provide TypeScript's null narrowing for the later `in` operator. This is pre-existing, not introduced by the label fix.
- Criticality: Non-blocking
- Owner: Backend
- Evidence: Editor diagnostics at [backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts](../../../backend/src/lib/instagramRenderer/__tests__/recipeDetailsTemplate.test.ts#L107) identify `Boolean(value) && typeof value === "object" && "type" in value && "props" in value`. HEAD inspection confirms the identical expression; the B-1 diff does not touch the helper. The full unit suite passes. [backend/tsconfig.json](../../../backend/tsconfig.json) excludes test files from the successful production build, so that build does not certify test-file typechecking.
- Recommendation: Address the explicit null guard in a separate coordinated Backend change and rerun test-file typechecking plus the detail-template tests. QA did not modify this unrelated helper or claim a clean test-file typecheck.