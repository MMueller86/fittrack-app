# infra/

Bicep Infrastructure-as-Code for all FitTrack Azure resources.

## Target Resource Group

All resources are deployed into the **existing** resource group:

```
rg-Michael-Mueller
```

Do **not** create a new resource group. The location of every resource is
inherited from this RG via `resourceGroup().location` in `main.bicep`.

## Resources Managed Here

| Resource | Name | Module |
|---|---|---|
| Cosmos DB Account + DB + 6 containers | `cosmos-fittrack-dev` | `modules/cosmos.bicep` |
| Storage Account + Blob container | `stfittrackdev` | `modules/storage.bicep` |
| Function App (Consumption) + Plan | `func-fittrack-dev` | `modules/functionapp.bicep` |
| Application Insights | `appi-fittrack-dev` | `modules/appinsights.bicep` |

## NOT Managed Here

- Azure OpenAI resource — already deployed (`oai-fittrack-dev`, `gpt4o-mini`)
- Resource group — pre-existing (`rg-Michael-Mueller`)
- Key Vault — out of MVP scope

## Deploy (M1)

```powershell
# Verify the resource group exists and check its location (one-time check)
az group show --name rg-Michael-Mueller --query "{name:name, location:location}" -o table

# Deploy all resources into the existing RG.
# Location is inherited from the RG — no need to pass it.
az deployment group create `
  --resource-group rg-Michael-Mueller `
  --template-file infra/main.bicep `
  --parameters infra/parameters/dev.bicepparam
```

If you ever need to override the inherited location, edit
`infra/parameters/dev.bicepparam` and uncomment the `param location = '...'` line.

## Azure Functions Runtime

The Function App is pinned to Linux `Node|22` and
`WEBSITE_NODE_DEFAULT_VERSION=~22` with Functions runtime v4. Microsoft
documents Node 22 as the last Node version supported on Linux Consumption;
newer versions such as Node 24 require Flex Consumption. The general Azure
runtime listing can still show Node 24, but it must not be applied to this Y1
app. See Microsoft's [supported versions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions).

Microsoft lists Node 22 support through **30 April 2027** and Linux
Consumption retirement for **30 September 2028**. Plan the Flex migration
before the Node 22 support date; the later platform retirement is not the first
deadline.

```powershell
az functionapp list-runtimes --os-type linux -o table
```

After an infrastructure deployment, the deployed app must report
`linuxFxVersion: Node|22` and `WEBSITE_NODE_DEFAULT_VERSION: ~22`.
Moving to Node 24 requires the separate Flex migration workflow; it creates a
new Function App and is not a safe in-place runtime-setting change.

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
func azure functionapp publish <function-app-name> --build remote --javascript
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

| Resource | Dev Name |
|---|---|
| Resource Group | `rg-Michael-Mueller` (existing) |
| Cosmos DB Account | `cosmos-fittrack-dev` |
| Storage Account | `stfittrackdev` |
| Function App | `func-fittrack-dev` |
| App Service Plan | `asp-fittrack-dev` |
| App Insights | `appi-fittrack-dev` |
