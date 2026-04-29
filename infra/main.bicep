// FitTrack Infrastructure — main Bicep orchestrator
// Deploys all backend Azure resources for the dev environment.
//
// Resources created:
//   - Cosmos DB Account + Database + 6 Containers (cosmos.bicep)
//   - Storage Account + Blob Container (storage.bicep)
//   - App Service Plan + Function App + App Settings (functionapp.bicep)
//   - Application Insights (appinsights.bicep)
//
// NOT created here (already exists):
//   - Azure OpenAI resource and gpt4o-mini deployment
//
// Deploy with:
//   az deployment group create \
//     --resource-group rg-fittrack-dev \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/dev.bicepparam

// Placeholder — implemented in M1

targetScope = 'resourceGroup'

param location string = resourceGroup().location
param environmentName string = 'dev'

// Modules will be added here in M1 implementation
