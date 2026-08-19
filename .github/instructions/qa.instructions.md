# FitTrack — QA Agent Instructions

These instructions apply to the **QA agent** reviewing and writing tests across all packages.

Global rules: [`../copilot-instructions.md`](../copilot-instructions.md)
Test strategy: [`../../docs/kb/tech/08-testing.md`](../../docs/kb/tech/08-testing.md)


## QA Review Workflow

The review input contains the following — do not search for them independently:
- Full approved plan (with Scope and Out of Scope sections)
- All Acceptance Criteria (complete, numbered)
- Original user story
- Required Skills (as declared in the QA Work Package — load and apply each before reviewing)
- `handoff_store` (all subtask summaries and deviations)
- Which subtasks ran and which were skipped
- Any known unverified areas or configuration notes

Do not re-plan, add missing requirements, or supplement the plan independently.

Verify the implementation **against** the plan:
- All acceptance criteria are met — not just the ones attempted, but all that were defined
- No acceptance criteria were silently skipped or deferred without explicit acknowledgement
- Implementation scope matches the approved plan (no unreviewed additions)
- Architectural decisions from the plan were followed

If acceptance criteria are partially or fully missing from the implementation, the review verdict is **FAIL**.

For small bug fixes (no Planner plan): verify that a regression test exists and the stated issue is resolved.

### Manual and Environment-Limited Verification

Separate executable QA findings from checks that cannot be run in the current environment.

- Missing Azure credentials, a stopped Cosmos emulator, unavailable `adb`, missing real devices, and unavailable viewport or screen-reader tooling are verification limitations, not findings.
- Deliver those checks as a manual validation checklist with prerequisites, steps, expected result, and a result field for the user.
- Do not classify an unperformed manual or environment-limited check as `Blocking`, `Non-blocking`, or `Suggestion`.
- Do not lower the verdict because such a check could not be executed. Report it as `UNVERIFIED` or `MANUAL VALIDATION REQUIRED` outside the findings list.

### Structured Finding Output

For each actionable finding, return all of the following fields:

```text
Finding key: local stable key for this QA run
Plan reference: repository plan path or N/A
Acceptance criterion: AC identifier or N/A
Description: concrete observed problem
Criticality: Blocking | Non-blocking | Suggestion
Owner: Backend | Frontend | Infrastructure | Documentation | Planner | QA
Evidence: tests, file paths, commands, or reproducible steps
Recommendation: proposed next action
```

Report each finding as an observed result of the review. Do not make the user's prioritisation decision or mark a finding as accepted, deferred, or closed.

---

## Test Runner

Vitest — run from the package directory.

## Run Commands

```bash
# Backend unit tests (includes registrations.test.ts)
cd backend && npx vitest run

# Backend contract tests (requires Cosmos emulator running)
cd backend && npx vitest run --config vitest.contract.config.mts

# Shared unit tests
cd shared && npx vitest run

# Type check all packages
cd backend && npx tsc --noEmit
cd shared  && npx tsc --noEmit
cd mobile  && npx tsc --noEmit

# Verify no bad shared imports in backend build output
cd backend && npm run build:verify
```

## After Every Task — Test Checklist

Run only the commands for packages affected by the change. Exception: always run `build:verify` for any backend change, regardless of scope.

1. `cd backend && npx vitest run` — all unit tests pass *(backend changes)*
2. `cd shared && npx vitest run` — shared lib tests pass *(shared changes)*
3. `cd backend && npm run build:verify` — no `require('@fittrack/shared')` in output *(all backend changes)*
4. `npx tsc --noEmit` (from `mobile/`) — no TypeScript errors *(mobile or shared type changes)*

## Review Checklist

Beyond test execution, verify:

- **Acceptance criteria:** all criteria defined in the Planner's plan are met — verify completeness, not just correctness
- **Scope:** no unrelated refactoring, unrelated documentation edits, or unreviewed architectural changes included in the change
- **Regression tests:** bug fixes include a regression test; behaviour changes update existing tests
- **Security-sensitive changes:** if `auth.ts`, `requireUser()`, or any endpoint auth is touched — verify the authentication contract is preserved and no secrets are introduced
- **API contract changes:** if request/response shapes changed — verify shared types and `docs/kb/tech/09-api-reference.md` are updated
- **Documentation:** if documented behaviour changed — verify the corresponding `docs/kb/` document was updated
- **Dependency versions:** if a new package version is introduced (added or updated in any `package.json`), verify it is the latest stable version using `npm view <package> version`. If an older version was chosen, the Planner's plan must contain an explicit justification. Without that justification, classify the finding as **Blocking**.

## Prompt Eval Verification

Applies when the change touches any file under `backend/src/lib/prompts/**`, `backend/src/lib/openai.ts`, or a Structured Output schema.

| Condition | Rule | Finding if violated |
|---|---|---|
| New prompt introduced | A corresponding `*.eval.test.ts` must exist | **Blocking** |
| Prompt semantically modified | The corresponding eval must pass (`npm run test:eval`) | **Blocking** |
| Prompt version constant changed | The `TESTED_PROMPT_VERSION` guard in the eval file must match the new version | **Blocking** |
| Eval exists and is in scope | QA must run `cd backend && npm run test:eval` and confirm all assertions pass | **Blocking** if eval fails |

QA verifies eval coverage and results only. QA must not create, modify, or fix prompt eval tests — a missing or failing eval is reported as a blocking finding and returned to the implementation agent.

## Coverage Expectations

| Code type | Test requirement |
|---|---|
| Pure functions (calculations, validators) | Unit tests — mandatory |
| AI classification logic (e.g., `classifyItem`) | Exhaustive unit tests — mandatory |
| HTTP handlers | Unit tests covering happy path + error cases |
| New repository methods | Contract test in `*.contract.test.ts` |
| Bug fixes | Regression test covering the reported scenario — mandatory |
| Re-exports and module wiring | Smoke test or registration test only |

## Contract Tests

Contract tests run against the **Cosmos emulator only** — never against real Azure Cosmos DB.

Locally: start the emulator via `backend/scripts/start-cosmos-emulator.ps1` before running contract tests.

In CI: the emulator runs automatically as a GitHub Actions service container (see `.github/workflows/ci.yml`). Contract tests only run after Tier 1 (unit tests) passes.

## Red → Green Workflow

The Red → Green workflow is an **implementation practice**, not a QA verification step. QA cannot reliably verify whether the implementation agent wrote the failing test first. What QA verifies is the outcome: a regression test exists and passes.

The workflow itself is documented in [`backend.instructions.md`](backend.instructions.md) for implementation agents.

## Encoding Validation

CI enforces encoding via `check-encoding.mjs` — a PR cannot merge with mojibake sequences in source files. No manual check needed during QA review.

## Review Output

After completing a review, summarise findings using one of these verdicts:

- **PASS** — implementation is complete, tests pass, acceptance criteria met
- **PASS WITH ISSUES** — actionable non-blocking findings exist; list them with their evidence and recommendations
- **FAIL** — one or more blocking issues; must be resolved before merging

Classify each finding as:
- **Blocking** — prevents merge (missing tests, broken behaviour, security issue, scope violation)
- **Non-blocking** — should be addressed but does not prevent merge
- **Suggestion** — optional improvement

`UNVERIFIED` and `MANUAL VALIDATION REQUIRED` are verification states, not finding criticalities.

## Registrations Test

`backend/src/lib/registrations.test.ts` verifies every function module file is imported by `backend/src/index.ts`. This test is part of the standard unit test suite and runs in CI.

If a new function module is added without registering it in `index.ts`, this test fails.

## Do Not

- Remove a test without explaining why
- Weaken an assertion to make a test pass
- Mock the Cosmos SDK in contract tests (use the emulator)
- Write contract tests that depend on test execution order
