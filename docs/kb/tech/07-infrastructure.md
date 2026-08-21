# Infrastructure

## IaC Tool

Bicep. All Azure resources are defined in `infra/`.

## Module Structure

```
infra/
├── main.bicep              Orchestrator — deploys all modules
├── parameters/
│   ├── dev.bicepparam      Dev environment values
│   └── alpha.bicepparam    Alpha (staging) environment values
└── modules/
    ├── cosmos.bicep         Cosmos DB account + database + containers
    ├── storage.bicep        Storage account + blob container
    ├── appinsights.bicep    Log Analytics workspace + Application Insights
    ├── functionapp.bicep    App Service Plan + Function App + App Settings
    ├── documentintelligence.bicep  Azure Document Intelligence resource
    └── (Azure OpenAI not in IaC — existing shared resource)
```

## Azure Resources Created by `main.bicep`

| Resource | Module | Notes |
|---|---|---|
| Cosmos DB Account + DB | `cosmos.bicep` | Serverless, 7 containers |
| Storage Account | `storage.bicep` | Blob for recipe images |
| Log Analytics Workspace | `appinsights.bicep` | |
| Application Insights | `appinsights.bicep` | |
| App Service Plan | `functionapp.bicep` | Consumption (serverless) |
| Function App | `functionapp.bicep` | Node.js 20, TypeScript build output |
| Document Intelligence | `documentintelligence.bicep` | F0 for dev, S0 for alpha/prod |

**Not in IaC:**
- Azure OpenAI resource — pre-existing shared resource
- Resource group — must already exist (`rg-Michael-Mueller`)

## Cosmos DB Containers

All user-data containers use `/userId` as partition key.

| Container | Partition Key | Notes |
|---|---|---|
| `users` | `/id` | User account documents |
| `nutritionProfiles` | `/userId` | One profile per user |
| `nutritionDiaryMeals` | `/userId` | Diary meal documents |
| `reusableMealItems` | `/userId` | Personal food library |
| `recipes` | `/userId` | User recipes |
| `weights` | `/userId` | Weight entries |
| `aiUsage` | `/userId` | AI quota usage counters |
| `foodProducts` | `/id` | Open Food Facts catalog (partition key = id) |
| `dayMeta` | `/userId` | Per-day metadata (dayType, workoutType) |
| `hintState` | `/userId` | Hint cooldown tracking |
| `aiInsights` | `/userId` | Heterogeneous AI documents: Daily cache, Weekly cache, and durable feedback snapshots |
| `userFoodRelations` | `/userId` | Favorites + recents tracking |

`aiInsights` is the existing `/userId`-partitioned container for Daily Insight
documents (`_docType: 'dailyInsight'`), Weekly Insight documents
(`_docType: 'weeklyInsight'`), and durable negative-feedback snapshots
(`_docType: 'insightFeedback'`). Repository reads filter these discriminators;
the container is not a separate feedback API surface.

The container is configured with `defaultTtl: -1` so Daily and Weekly
documents can use per-document TTL values. Feedback documents deliberately
omit both `ttl` and `expiresAt`, so they are not automatically deleted. They
remain available for later analysis until a manual database cleanup, which is
an operational follow-up outside the feature.

### One-off Daily Insight snapshot migration

The Class 3 rename of the persisted weight trend key is handled by the
one-off script `backend/scripts/migrate-insight-weight-trend.mjs`. It requires
`COSMOS_ENDPOINT` and `COSMOS_KEY` from the operator environment and uses
`COSMOS_DATABASE_ID` when supplied, defaulting to `fittrack-db`. No credential
is embedded in the script or repository.

The script pages through Daily and feedback documents in `aiInsights`, patches
the legacy nested trend key to `inputContext.weight.weeklyTrend30d`, and never
deletes and recreates a document. It preserves IDs, partition keys,
discriminators, Daily `ttl`/`expiresAt`, and feedback fields. Weekly documents
are excluded. Documents without the legacy key are counted as skipped. A
document containing both keys with the same value is also skipped; differing
values are reported as conflicts and are never overwritten.

Each run prints `scanned`, `migrated`, `skipped`, `conflict`, and `failed`
counts. A non-zero `conflict` or `failed` count causes a non-zero process exit;
write failures are reported with their document ID. Resolve every conflict
before considering the run successful. The migration is safe to repeat after
the backend with the new field is deployed: migrated documents become
skipped, and a clean repeat has zero writes.

Infrastructure runs and validates the migration against the Dev Cosmos
environment first, then runs it separately against Alpha after the explicit
Alpha release command. Contract coverage uses only the local Cosmos emulator;
the migration must never target a real account during tests. No Bicep,
container, partition-key, or application dual-read/dual-write change is part
of this migration.

The existing authorized administrative/operational direct-read access may read
feedback snapshots directly from this container. This feature introduces no
new application role, permission model, Admin UI, read endpoint, or cleanup
endpoint; it also grants no implicit database access to normal users or
arbitrary JWT admins.

## Resource Naming Convention

Pattern: `{type}-{projectName}-{env}-{uniqueSuffix}`

Examples:
- `cosmos-fittrack-dev-ppf5sc`
- `func-fittrack-alpha-ppf5sc`
- `st-fittrack-dev-ppf5sc` (storage)

`uniqueSuffix` defaults to a 6-char hash of the resource group ID, ensuring stable names across re-deploys.

## Environments

| Environment | Purpose | Parameters |
|---|---|---|
| `dev` | Local + CI development | `parameters/dev.bicepparam` |
| `alpha` | Staging integration environment | `parameters/alpha.bicepparam` |
| `staging` | (planned) | — |
| `prod` | (planned) | — |

[Rule] All resources stay in `rg-Michael-Mueller`. Never create new resource groups. Environments are separated by name prefix only.

## Deploy Command

```bash
az deployment group create \
  --resource-group rg-Michael-Mueller \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

## Function App Deploy Workflow

**Context:** The Azure Function App runs on **Linux**. Development happens on **Windows** (PowerShell). This combination has caused repeated deployment failures. Follow the steps below exactly.

### Directory Structure

`_deploy_staging/` is a **separate directory** at the repo root — it is NOT a symlink to `backend/dist/`. It has its own `dist/` folder that must be explicitly synced from `backend/dist/` before every deploy.

```
fittrack-app/
├── backend/
│   └── dist/               ← TypeScript compiler output (tsc outDir)
│       ├── backend/src/     ← compiled backend source
│       └── shared/          ← compiled shared library
└── _deploy_staging/
    ├── dist/               ← SEPARATE copy — must be synced manually before deploy
    ├── node_modules/        ← Linux-compatible node_modules (do NOT rebuild on Windows)
    ├── host.json
    └── package.json
```

**Root cause of missing endpoints on Alpha:** If step 2 (sync) is skipped, `_deploy_staging/dist/` contains stale compiled output. The deploy succeeds (exit 0) but the new functions are absent. Always verify step 3 before deploying.

### Step-by-Step (run from repo root)

```powershell
# 1. Clean build — REQUIRED. Incremental build cache silently omits changes.
#    Run from repo root.
Remove-Item -Recurse -Force "backend\dist" -ErrorAction SilentlyContinue
Remove-Item -Force "backend\tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue
cd backend
npx tsc --project tsconfig.json
cd ..

# 2. Sync build output to _deploy_staging/dist/ using robocopy (mirror).
#    robocopy exit codes 0–7 are all SUCCESS (0=nothing to copy, 1=files copied).
#    Do NOT use Copy-Item — it creates nested folders when target exists.
robocopy "backend\dist" "_deploy_staging\dist" /MIR /NFL /NDL /NJH /NJS

# 3. Verify: spot-check that a recently added/changed function file is present.
#    Replace the filename with the most recently added function in functions/.
Test-Path "_deploy_staging\dist\backend\src\functions\specialActivity.js"
# Must return True — if False, step 2 did not sync correctly.

# 4. Deploy — always from _deploy_staging/, never from backend/
cd _deploy_staging
func azure functionapp publish func-fittrack-alpha-ppf5sc --no-build --javascript
cd ..
```

### Rules

[Rule] Always deploy from `_deploy_staging/` with `--no-build`. Never deploy from `backend/` directly.

[Rule] Always include `--javascript`. The `_deploy_staging/` directory has no `local.settings.json`, so the `func` CLI cannot auto-detect the Node.js worker runtime without this flag.

[Rule] Always delete `backend/dist/` and `backend/tsconfig.tsbuildinfo` before building. Incremental TypeScript build cache silently omits changes — this has caused real production bugs.

[Rule] Always sync with `robocopy /MIR` (step 2) before deploying. `_deploy_staging/dist/` is NOT automatically updated by `tsc`. Skipping this step deploys stale code silently.

[Rule] Verify step 3 before deploying. A successful `func publish` (exit 0) does NOT guarantee the new functions are present — it only confirms the upload succeeded. Only the function list in the output or a `Test-Path` check confirms the sync was complete.

## Application Settings — Local Dev Credentials

**`backend/local.settings.json`** is the only source of credentials for local development.

This file is gitignored and never committed. It contains all secrets needed to run the backend locally: Cosmos connection, OpenAI key, Document Intelligence key, Auth config.

When an agent needs to run or test the backend locally:
- Check `backend/local.settings.json` for all env var values
- If a required key is missing → inform the user to add it to `local.settings.json`
- Never hardcode keys anywhere else — not in code, not in tests, not in documentation

For Alpha (deployed), all Application Settings are configured directly in the Azure Portal on the Function App — never stored locally.

## Azure OpenAI and Document Intelligence — Shared Services

Both services are **intentionally shared across all environments** (Dev and Alpha). They are stateless — no user data, no environment-specific state.

- Azure OpenAI endpoint: `https://oai-fittrackapp-dev.openai.azure.com/`
- Deployment: `gpt-4o-mini` (version `2024-08-01-preview`)
- Document Intelligence: shared F0/S0 instance

[Rule] Do not create separate OpenAI or Document Intelligence resources per environment. Deduplication is intentional.

See [tech/01-system-overview.md](01-system-overview.md#intentionally-shared-services) for the full rationale.
