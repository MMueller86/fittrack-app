# infra/

Bicep Infrastructure-as-Code for all FitTrack Azure resources.

## Resources Managed Here

| Resource | Name | Module |
|---|---|---|
| Cosmos DB Account + DB + 6 containers | `cosmos-fittrack-dev` | `modules/cosmos.bicep` |
| Storage Account + Blob container | `stfittrackdev` | `modules/storage.bicep` |
| Function App (Consumption) + Plan | `func-fittrack-dev` | `modules/functionapp.bicep` |
| Application Insights | `appi-fittrack-dev` | `modules/appinsights.bicep` |

## NOT Managed Here

- Azure OpenAI resource — already deployed (`oai-fittrack-dev`, `gpt4o-mini`)
- Resource group — created once manually or via `az group create`
- Key Vault — out of MVP scope

## Deploy (M1)

```bash
# Create resource group (one-time)
az group create --name rg-fittrack-dev --location westeurope

# Deploy all resources
az deployment group create \
  --resource-group rg-fittrack-dev \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

## Naming Convention

| Resource | Dev Name |
|---|---|
| Resource Group | `rg-fittrack-dev` |
| Cosmos DB Account | `cosmos-fittrack-dev` |
| Storage Account | `stfittrackdev` |
| Function App | `func-fittrack-dev` |
| App Service Plan | `asp-fittrack-dev` |
| App Insights | `appi-fittrack-dev` |
