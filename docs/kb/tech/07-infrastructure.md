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
| `insights` | `/userId` | Cached daily insight documents |
| `userFoodRelations` | `/userId` | Favorites + recents tracking |

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

### Step-by-Step

```powershell
# 1. Clean build — REQUIRED. Incremental build cache silently omits changes.
Remove-Item -Recurse -Force backend\dist
Remove-Item -Force backend\tsconfig.tsbuildinfo
cd backend
npm run build

# 2. Copy output to _deploy_staging/
#    WARNING: Copy-Item trap — if target exists, Recurse creates nested folder.
#    Always use wildcard (*) to copy contents, not the folder itself:
Remove-Item -Recurse -Force "_deploy_staging\dist"
Copy-Item -Recurse -Force "dist\*" "_deploy_staging\dist\"

# 3. Verify the build before deploying (spot-check a known value)
(Get-Content "_deploy_staging\dist\src\lib\auth.js") -match "isAdmin"
# Must return True — if False, the build did not include recent changes

# 4. Deploy — always from _deploy_staging/, never from backend/
cd ..\_ deploy_staging
func azure functionapp publish func-fittrack-alpha-ppf5sc --no-build
```

### Rules

[Rule] Always deploy from `_deploy_staging/` with `--no-build`. Never deploy from `backend/` directly.

[Rule] Always delete `dist/` and `tsconfig.tsbuildinfo` before building. Incremental TypeScript build cache silently omits changes — this has caused real production bugs.

[Rule] Use wildcard when copying: `Copy-Item -Recurse -Force "dist\*" "_deploy_staging\dist\"`. Without the `*`, PowerShell creates `_deploy_staging\dist\dist\` (nesting) when the target already exists.

[Rule] Verify `_deploy_staging` contents before deploying. The grep check (`-match "isAdmin"`) confirms the compiled output contains recent code.

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
