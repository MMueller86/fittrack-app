# backend/

Azure Functions v4 backend for FitTrack. TypeScript, Node 20 LTS, Consumption Plan.

## Implementation status

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Weight tracking (`GET\|POST\|DELETE /api/weights`), health check, dev-user auth stub, Cosmos persistence, contract tests | ✅ Implemented |
| M2 | Real auth: Google ID token → JWT, `jwtMiddleware`, `/api/auth/google\|refresh\|logout`, profile + onboarding | ⏳ Stubs only (501) |
| M3 | Nutrition targets, diary, reusable items | ⏳ Stubs only (501) |
| M4 | Recipes (CRUD + image upload) | ⏳ Stubs only (501) |
| M5 | AI workflows (Azure OpenAI), dashboard aggregation | ⏳ Stubs only (501) |

All routes documented below that are not in M1 currently return
`501 Not Implemented`. Their paths and shapes are provisional.

## Auth (M1)

**There is no real authentication yet.** [`src/lib/auth.ts`](./src/lib/auth.ts)
exposes a `requireUser()` helper that returns a fixed dev user id
(`'dev-user'`) for every request, regardless of any `Authorization`
header.

Consequences:

- The backend is **not safe to expose publicly** in this state — anyone
  who reaches the endpoint reads/writes the same `dev-user` data.
- The deployed Azure Function App is gated by Functions auth keys at the
  HTTP trigger level (per-route `authLevel`), but for M1 all weights
  routes use `authLevel: 'anonymous'` and rely on "only I know the URL".
- Multi-tenant isolation arrives with **M2** when JWT validation
  replaces the stub. Until then, do not invite other users.

When M2 lands, JWT middleware will be applied to every route except
`/api/auth/google`, `/api/auth/refresh`, and `/api/health`.

## Structure

```
src/
├── index.ts           Entry point — registers all function routes + health check
├── functions/
│   ├── auth.ts        POST /api/auth/google | /refresh | /logout
│   ├── profile.ts     GET|PUT /api/profile | POST /api/profile/onboarding
│   ├── nutritionTargets.ts  GET|POST /api/nutrition/targets + calculate + ai-validate
│   ├── weights.ts     GET|POST /api/weights | DELETE /api/weights/:id
│   ├── diary.ts       GET /api/diary | meals CRUD | items CRUD
│   ├── reusableItems.ts  GET|POST /api/reusable-items
│   ├── recipes.ts     CRUD /api/recipes | image upload | ai-analyze
│   ├── ai.ts          POST /api/ai/analyze-meal-item
│   ├── dashboard.ts   GET /api/dashboard/today
│   ├── foodSearch.ts  GET /api/food-search?query= (library + catalog fan-out)
│   └── foodProducts.ts  GET /api/food-products/search?q= | /api/food-products/{id}
└── lib/
    ├── cosmos.ts      CosmosClient singleton + 7 container refs (incl. foodProducts)
    ├── openai.ts      AzureOpenAI client + prompt builders (3 workflows)
    ├── storage.ts     BlobServiceClient + upload helper
    ├── auth.ts        googleValidator, jwtMiddleware, tokenService
    └── repositories/
        ├── foodProductRepository.ts        Interface + in-memory impl + factory
        └── cosmosFoodProductRepository.ts  Cosmos-backed impl
```

## Food Product Catalog Import

The internal food product catalog is populated from an Open Food Facts MongoDB export via the `tools/off-import` CLI tool. This is an offline, one-time (or periodic) operation — the backend itself never calls OFF at runtime.

```powershell
# From the workspace root — dry-run (no writes, validates JSON only):
cd "tools/off-import"
npx tsx import-to-cosmos.ts --dry-run

# Import first 500 products (useful for local dev without a full dataset):
npx tsx import-to-cosmos.ts --limit=500

# Full import:
npx tsx import-to-cosmos.ts
```

Requires `COSMOS_ENDPOINT` and `COSMOS_KEY` in your environment (or in `backend/local.settings.json`). The tool is idempotent — re-running updates existing documents while preserving `manualKeywords` and `negativeKeywords`.

**Local dev without Cosmos:** The `FoodProductRepository` factory falls back to an in-memory empty stub when `COSMOS_ENDPOINT` / `COSMOS_KEY` are not set. Food catalog search returns no results, but the rest of the app works normally.

## Prerequisites

Install these once before starting:

```powershell
# 1. Node.js 20 LTS (required for all workspaces)
winget install OpenJS.NodeJS.LTS

# 2. Azure Functions Core Tools v4 (required to run backend locally)
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# 3. Verify
node --version   # should be v20.x
func --version   # should be 4.x
```

## Local Development Setup

1. Copy the settings template:
   ```powershell
   Copy-Item local.settings.json.template local.settings.json
   ```
2. Fill in all values in `local.settings.json` (never commit this file)
3. Install all workspace dependencies from the monorepo root:
   ```bash
   cd ..   # go to fittrack-app root
   npm install
   ```
4. Build TypeScript:
   ```bash
   cd backend
   npm run build
   ```
5. Start the Functions runtime:
   ```bash
   npm start   # runs: func start
   ```
6. Verify: `GET http://localhost:7071/api/health` → `{ "status": "ok" }`

## Key Rules

- **M1:** weights routes are `authLevel: 'anonymous'` and use the
  `requireUser()` dev stub. Do not deploy publicly without M2 auth.
- **From M2:** JWT middleware must be applied to every route except
  `/api/auth/google`, `/api/auth/refresh`, `/api/health`.
- No Azure OpenAI keys or calls in `mobile/` — all AI goes through this backend
- All AI endpoints return a preview payload only — caller must POST to a save endpoint after user confirmation
- `local.settings.json` is gitignored — use the `.template` file as reference

## Dependencies

| Package | Purpose |
|---|---|
| `@azure/functions` v4 | Azure Functions v4 programming model |
| `@azure/cosmos` | Cosmos DB client |
| `@azure/storage-blob` | Blob Storage client (recipe images, M4) |

When M2/M5 lands, `google-auth-library`, `jsonwebtoken`, and `openai`
will be added back. They were removed in M1 because no source file
imports them yet.

## Testing

The backend uses a two-tier test strategy. Both tiers run **without** any
real Azure resources, so unit tests stay fast and CI-friendly while
contract tests still surface Cosmos-specific bugs (reserved keywords,
indexing requirements) before deployment.

### Tier 1 — Unit tests (Vitest)

Fast, in-process, no I/O. Validators, HTTP handlers (with the in-memory
repository), auth stub, and the repository factory.

```powershell
cd backend
npm test          # one-shot
npm run test:watch  # re-run on save
```

What is covered today:

- Weight input validation (value range, unit, ISO date including rollover
  rejection like `2026-02-30`)
- `GET /api/weights` shape + ordering
- `POST /api/weights` happy path + every 400 path
- `DELETE /api/weights/:id` 204 / 404 / 400
- `requireUser()` returns the dev user while the auth stub is active
- Repository factory selects in-memory vs. Cosmos based on env vars

These tests do **not** call:

- Azure Functions runtime (`func start` is not required)
- Azure Cosmos DB (real or emulator)
- Azure OpenAI
- Anything in `local.settings.json`

### Tier 2 — Cosmos contract tests (Emulator)

Runs the real `CosmosWeightsRepository` against the Cosmos DB **Linux
Emulator**. Catches SQL-dialect bugs (reserved keywords like `value`,
missing composite indexes for `ORDER BY`, partition-key behaviour) that
unit tests with mocks cannot find. **Never** points at real Azure Cosmos
DB — the endpoint is hard-coded to `http://127.0.0.1:8081` with the
well-known emulator master key.

#### Where these tests run

| Where | Status | How |
|---|---|---|
| **GitHub Actions CI** | ✅ Required, runs on every push & PR | The workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) starts the emulator as a service container and runs `npm run test:contract` after Tier 1 passes. No setup needed locally to benefit from this. |
| **Local — Docker / Podman / Rancher** | Optional | See "Run locally" below. |
| **Local — without a container runtime** | Skipped | `npm run test:contract` fails fast with a friendly error pointing to this section. Tier 1 (`npm test`) remains fully offline. |

#### Why a real emulator is needed

`@azure/cosmos` translates the SQL we write into HTTP calls Cosmos
serves. Mocks would just let us assert the strings we already wrote.
Only a real Cosmos endpoint can tell us:

- `SELECT c.value FROM c` is invalid (`value` is a reserved keyword)
- `ORDER BY c.date DESC, c.createdAt DESC` requires a composite index
- `container.item(id, partitionKey).delete()` returns `404` (not throws)
  when the document is missing
- A wrong partition key can never delete another user's row

We hit all of these during manual smoke testing. Contract tests guarantee
they cannot regress.

#### Run locally (optional)

Prerequisite: a container runtime. Any of these works — the helper
scripts and CI both target the same Linux image
(`mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview`):

- **Docker Desktop** (default in the helper script)
- **Podman Desktop** — `podman` is Docker-CLI compatible
- **Rancher Desktop** — ships with a `docker` shim, helper script works
  unchanged

```powershell
# 1. start the emulator (idempotent — safe to run repeatedly)
cd backend
npm run emulator:start

# 2. run only the contract tests
npm run test:contract

# 3. stop + remove the emulator container when done
npm run emulator:stop
```

If you don't have a container runtime, just skip Tier 2 locally — CI
covers it on every push.

#### What is covered today

- `add` round-trips an entry through real Cosmos
- `list` returns empty array, ordered (newest first), partitioned per user
- Regression: `SELECT *` survives the `value`-reserved-word bug
- `delete` returns `true` for existing, `false` (404) for missing
- `delete` respects partition key — a wrong `userId` cannot delete another
  user's row

#### Files

- [`vitest.contract.config.mts`](./vitest.contract.config.mts) — separate
  Vitest config; **not** part of `npm test`
- [`scripts/start-cosmos-emulator.ps1`](./scripts/start-cosmos-emulator.ps1) —
  pulls and runs the emulator image
- [`src/test-utils/cosmosEmulator.ts`](./src/test-utils/cosmosEmulator.ts) —
  per-run isolated database (`fittrack-test-<random>`), creates all six
  containers with the same partition keys as `infra/modules/cosmos.bicep`
- [`src/lib/repositories/cosmosWeightsRepository.contract.test.ts`](./src/lib/repositories/cosmosWeightsRepository.contract.test.ts)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — CI workflow
  with both tiers

### Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `WARNING: Failed to detect the Azure Functions runtime ... test mode` while running tests | Expected. `@azure/functions` v4 detects no host and skips `app.http()` registration. Tests call the exported handler functions directly. |
| `Cannot find module './cosmosWeightsRepository'` | Means tests are still on the old `require()`-based factory. Pull latest. |
| Vitest can't resolve `@fittrack/shared` | The alias in `vitest.config.mts` must mirror `tsconfig.json` paths. |
| `Cosmos DB Emulator is not reachable at http://127.0.0.1:8081` from `npm run test:contract` | No container runtime running. Either start the emulator (`npm run emulator:start`) or skip Tier 2 locally — CI covers it. |
| `ERR_SSL_WRONG_VERSION_NUMBER` connecting to the emulator | The vnext-preview emulator listens on plain HTTP, not HTTPS. Make sure `COSMOS_ENDPOINT` starts with `http://`, not `https://`. |
| Contract tests time out on first run | First-time image pull (~1 GB) plus emulator boot. Increase `testTimeout` in `vitest.contract.config.mts` if needed. |

