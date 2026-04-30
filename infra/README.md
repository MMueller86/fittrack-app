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

## Naming Convention

| Resource | Dev Name |
|---|---|
| Resource Group | `rg-Michael-Mueller` (existing) |
| Cosmos DB Account | `cosmos-fittrack-dev` |
| Storage Account | `stfittrackdev` |
| Function App | `func-fittrack-dev` |
| App Service Plan | `asp-fittrack-dev` |
| App Insights | `appi-fittrack-dev` |
