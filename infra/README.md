# infra/

Bicep Infrastructure-as-Code for all FitTrack Azure resources.

## Target Resource Groups

Subscription `Fittrack` (`dd7539ab-c638-44f8-9173-8bcd28cdbae3`), region
`germanywestcentral`. Every `az` command passes `--subscription`. Resources
go into **existing** resource groups:

| Environment | Resource group | Parameters |
|---|---|---|
| Dev | `rg-fittrack-dev` | `parameters/dev.bicepparam` |
| Alpha | `rg-fittrack-alpha` | `parameters/alpha-fittrack.bicepparam` |

Do **not** create new resource groups. The former single group
`rg-Michael-Mueller` and `parameters/alpha.bicepparam` belong to the legacy
PRODYNA Alpha (Y1) and the old auth-relay Static Web App (backup), which remain for now.
The current auth-relay SWA is `swa-fittrack-alpha-wcobsd` in `rg-fittrack-alpha`
(deploy command: `docs/kb/tech/07-infrastructure.md`, "Auth Relay Static Web App").

## Resources Managed Here

| Resource | Alpha name | Module |
|---|---|---|
| Cosmos DB Account + DB + 12 containers | `cosmos-fittrack-alpha-wcobsd` | `modules/cosmos.bicep` |
| Storage Account (one per environment: blobs incl. `product-images`, queue, Flex deployment container) | `stfittrackalphawcobsd` | `modules/storage.bicep` |
| Function App (Flex Consumption FC1, Node 24) + Plan | `func-fittrack-alpha-wcobsd`, `asp-fittrack-alpha` | `modules/functionapp.bicep` |
| Application Insights | `appi-fittrack-alpha` | `modules/appinsights.bicep` |

The Function App is only created when `deployFunctionApp = true` (Alpha);
Dev has none because the backend runs locally.

## NOT Managed Here

- Azure OpenAI (`oai-fittrack-dev`, deployment `gpt-4.1-mini`, `GlobalStandard`) and Document Intelligence (`di-fittrack-dev-hlpqe7`) — shared by Dev and Alpha
- Resource groups — pre-existing (`rg-fittrack-dev`, `rg-fittrack-alpha`)
- Key Vault — out of MVP scope

## Deploy Alpha

Secrets are read from process environment variables (`AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_API_KEY`, `AZURE_DI_KEY`) and must never be written to files.

```powershell
az deployment group what-if `
  --subscription dd7539ab-c638-44f8-9173-8bcd28cdbae3 `
  --resource-group rg-fittrack-alpha `
  --template-file infra/main.bicep `
  --parameters infra/parameters/alpha-fittrack.bicepparam

az deployment group create `
  --subscription dd7539ab-c638-44f8-9173-8bcd28cdbae3 `
  --resource-group rg-fittrack-alpha `
  --template-file infra/main.bicep `
  --parameters infra/parameters/alpha-fittrack.bicepparam
```

For Dev use `--resource-group rg-fittrack-dev` and `infra/parameters/dev.bicepparam`.

## Azure Functions Runtime

The Alpha Function App runs on Flex Consumption (FC1) with Functions runtime
v4 and Node 24 (`functionAppConfig.runtime`), Maximum Instances 5, Always
Ready 0, 2048 MB. After an infrastructure deployment, confirm the live values
with `az functionapp show` and `az functionapp scale config show` instead of
trusting the ARM state.

## Azure Functions Release

The Azure Functions runtime is Linux, while releases are normally prepared on
Windows. Use the same artifact gates for Dev and Alpha releases:

```powershell
# 1. Clean the compiler output and build the complete verified artifact.
Remove-Item -Recurse -Force "backend\dist" -ErrorAction SilentlyContinue
Remove-Item -Force "backend\tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue
Push-Location backend
npm run build:verify
Pop-Location

# 2. Mirror the build output. robocopy exit codes 0-7 are successful.
robocopy "backend\dist" "_deploy_staging\dist" /MIR /NFL /NDL /NJH /NJS

# 3. Do not publish if either gate is False.
Test-Path "_deploy_staging\dist\backend\src\functions\instagramRecipe.js"
Test-Path "_deploy_staging\dist\backend\src\lib\instagramRenderer\assets\fonts\LICENSE.txt"

# 4. Publish from staging with a Linux remote build.
Push-Location _deploy_staging
func azure functionapp publish func-fittrack-alpha-wcobsd --build remote --javascript
Pop-Location
```

`npm run build:verify` is required instead of calling `tsc` directly: the
build copies and validates the complete nine-file Instagram renderer asset
manifest. `--build remote` is required for the normal Windows-to-Linux flow;
Azure Oryx installs the production lockfile on Linux, including native
packages such as `sharp` and `@resvg/resvg-js`. Do not run `npm ci` in the
staging directory on Windows and do not use `--no-build` unless a separately
verified Linux-compatible `node_modules` tree is intentionally packaged.

After publishing, verify the changed function in `az functionapp function list`,
check `GET /api/health` for HTTP 200, and check one protected endpoint for HTTP
401 without a token. For authenticated features, perform the relevant smoke
flow and inspect Application Insights for post-deploy errors.

## Naming Convention

| Resource | Alpha Name |
|---|---|
| Resource Group | `rg-fittrack-alpha` (Dev: `rg-fittrack-dev`) |
| Cosmos DB Account | `cosmos-fittrack-alpha-wcobsd` |
| Storage Account | `stfittrackalphawcobsd` |
| Function App | `func-fittrack-alpha-wcobsd` |
| App Service Plan (FC1) | `asp-fittrack-alpha` |
| App Insights | `appi-fittrack-alpha` |
