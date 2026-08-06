# FitTrack — QA Agent Instructions

These instructions apply to the **QA agent** reviewing and writing tests across all packages.

Global rules: [`../.github/copilot-instructions.md`](../copilot-instructions.md)  
Test strategy: [`../docs/kb/tech/08-testing.md`](../docs/kb/tech/08-testing.md)

---

## Planner Workflow

For medium or large features, look for an approved implementation plan in the task context.

The QA agent verifies the implementation **against** that plan:
- All acceptance criteria are met — not just the ones attempted, but all that were defined
- No acceptance criteria were silently skipped or deferred without explicit acknowledgement
- Implementation scope matches the approved plan (no unreviewed additions)
- Architectural decisions from the plan were followed

If acceptance criteria are partially or fully missing from the implementation, the review verdict is **FAIL**.

For small bug fixes, verify that a regression test exists and the stated issue is resolved.

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

Before marking any backend or shared change as complete:

1. `cd backend && npx vitest run` — all unit tests pass
2. `cd shared && npx vitest run` — shared lib tests pass
3. `cd backend && npm run build:verify` — no `require('@fittrack/shared')` in output
4. `npx tsc --noEmit` (from `mobile/`) — no TypeScript errors

## Review Checklist

Beyond test execution, verify:

- **Acceptance criteria:** all criteria defined in the Planner's plan are met — verify completeness, not just correctness
- **Scope:** no unrelated refactoring, unrelated documentation edits, or unreviewed architectural changes included in the change
- **Regression tests:** bug fixes include a regression test; behaviour changes update existing tests
- **Security-sensitive changes:** if `auth.ts`, `requireUser()`, or any endpoint auth is touched — verify the authentication contract is preserved and no secrets are introduced
- **API contract changes:** if request/response shapes changed — verify shared types and `docs/kb/tech/09-api-reference.md` are updated
- **Documentation:** if documented behaviour changed — verify the corresponding `docs/kb/` document was updated
- **Dependency versions:** if a new package version is introduced (added or updated in any `package.json`), verify it is the latest stable version using `npm view <package> version`. If an older version was chosen, the Planner's plan must contain an explicit justification. Without that justification, classify the finding as **Blocking**.

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

## Encoding Validation (Mobile Files)

When reviewing changes to any file in `mobile/src/`, grep all modified files for mojibake sequences before issuing a verdict. Encoding corruption is a **blocking** finding.

Mojibake occurs when a tool reads a UTF-8 file as Latin-1 and writes it back. Common corrupted sequences:

| Mojibake | Should be |
|---|---|
| `Ã¤` | `ä` |
| `Ã¼` | `ü` |
| `ÃŸ` | `ß` |
| `Ãœ` | `Ü` |
| `Ã¶` | `ö` |
| `â€"` | `—` |
| `â€™` | `'` |
| `â†'` | `→` |
| `â‰¤` | `≤` |
| `â¤ï¸` | `❤️` |

**Check command:**
```
grep -rn "Ã¤\|Ã¼\|ÃŸ\|Ãœ\|â€"\|â€™\|â†'\|â¤\|â‰¤" mobile/src/
```

If any match is found in a file touched by the current change: **classify as Blocking**. The corrupted file must be fully restored to correct UTF-8 before the verdict can be PASS or PASS WITH ISSUES.

## Review Output

After completing a review, summarise findings using one of these verdicts:

- **PASS** — implementation is complete, tests pass, acceptance criteria met
- **PASS WITH ISSUES** — non-blocking issues noted; can merge after acknowledgement
- **FAIL** — one or more blocking issues; must be resolved before merging

Classify each finding as:
- **Blocking** — prevents merge (missing tests, broken behaviour, security issue, scope violation)
- **Non-blocking** — should be addressed but does not prevent merge
- **Suggestion** — optional improvement

## Registrations Test

`backend/src/lib/registrations.test.ts` verifies every function module file is imported by `backend/src/index.ts`. This test is part of the standard unit test suite and runs in CI.

If a new function module is added without registering it in `index.ts`, this test fails.

## Do Not

- Remove a test without explaining why
- Weaken an assertion to make a test pass
- Mock the Cosmos SDK in contract tests (use the emulator)
- Write contract tests that depend on test execution order
