# Testing

## Test Runner

Vitest — used in all three packages (`backend`, `mobile`, `shared`).

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

### Registration Test

`backend/src/lib/registrations.test.ts` — verifies every `*.ts` file in `functions/` is imported by `index.ts`. Prevents 404 bugs from forgotten route registrations.

This test runs as part of the standard unit test suite.

## Run Commands

```bash
# Backend unit tests
cd backend && npx vitest run

# Backend contract tests (requires Cosmos emulator)
cd backend && npx vitest run --config vitest.contract.config.mts

# Shared unit tests
cd shared && npx vitest run

# Type check (mobile + shared)
npx tsc --noEmit  # from mobile/ or shared/
```

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

## Coverage Target

High function-level coverage on business logic is explicitly desired. No specific percentage target is documented, but any logic that can be tested should be.

## CI Pipeline (`.github/workflows/ci.yml`)

GitHub Actions — runs on every push and pull request to `main`.

### Tier 1 — Unit Tests (10 min timeout)

Runs on `ubuntu-latest`. Steps in order:
1. Typecheck `shared` — `npm run typecheck --workspace=shared`
2. Typecheck `backend` — `npm run typecheck --workspace=backend`
3. Typecheck `mobile` — catches TypeScript errors before `expo build` does
4. Backend unit tests — `npm test --workspace=backend`

All three typechecks run before tests to fail fast on cheap checks.

### Tier 2 — Contract Tests (20 min timeout)

Runs only when Tier 1 passes (`needs: unit-tests`).

Uses the **Azure Cosmos DB Linux Emulator** (`vnext-preview`) as a GitHub Actions service container:
- Image: `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview`
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
- No mobile unit tests in CI (mobile unit tests run locally; CI runs mobile typecheck only)
- No shared unit tests in CI (covered by typecheck; shared logic is tested via backend package)

[Open] A dedicated CI step for `shared` unit tests and `mobile` unit tests may be added in a future iteration.
