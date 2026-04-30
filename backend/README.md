# backend/

Azure Functions v4 backend for FitTrack. TypeScript, Node 20 LTS, Consumption Plan.

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
│   └── dashboard.ts   GET /api/dashboard/today
└── lib/
    ├── cosmos.ts      CosmosClient singleton + 6 container refs
    ├── openai.ts      AzureOpenAI client + prompt builders (3 workflows)
    ├── storage.ts     BlobServiceClient + upload helper
    └── auth.ts        googleValidator, jwtMiddleware, tokenService
```

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

- JWT middleware must be applied to every route except `/api/auth/google`, `/api/auth/refresh`, `/api/health`
- No Azure OpenAI keys or calls in `mobile/` — all AI goes through this backend
- All AI endpoints return a preview payload only — caller must POST to a save endpoint after user confirmation
- `local.settings.json` is gitignored — use the `.template` file as reference

## Dependencies

| Package | Purpose |
|---|---|
| `@azure/functions` v4 | Azure Functions v4 programming model |
| `@azure/cosmos` | Cosmos DB client |
| `@azure/storage-blob` | Blob Storage client (recipe images) |
| `google-auth-library` | Google ID token validation |
| `jsonwebtoken` | Access/refresh token signing |
| `openai` | Azure OpenAI client |

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

### Tier 2 — Cosmos contract tests (Emulator) — coming next

Runs the real `CosmosWeightsRepository` against the Cosmos DB Linux
Emulator in Docker. Catches SQL-dialect bugs (reserved words, missing
composite indexes) that unit tests with mocks cannot find. Excluded from
`npm test` and run via `npm run test:contract` (TODO — see test plan in
chat history). Never points at real Azure Cosmos DB.

### Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `WARNING: Failed to detect the Azure Functions runtime ... test mode` while running tests | Expected. `@azure/functions` v4 detects no host and skips `app.http()` registration. Tests call the exported handler functions directly. |
| `Cannot find module './cosmosWeightsRepository'` | Means tests are still on the old `require()`-based factory. Pull latest. |
| Vitest can't resolve `@fittrack/shared` | The alias in `vitest.config.mts` must mirror `tsconfig.json` paths. |

