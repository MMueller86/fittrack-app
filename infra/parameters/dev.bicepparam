// Parameter file for the dev environment.
//
// Target resource group: rg-Michael-Mueller (existing — do NOT recreate).
// Location is intentionally NOT set here — it is inherited from the resource
// group via `resourceGroup().location` in main.bicep. To override, uncomment
// the `location` line below.
//
// Secrets (Azure OpenAI key, JWT secrets, Google client id) MUST NOT be
// committed. Pass them at deploy time with `--parameters` overrides, e.g.:
//
//   az deployment group create `
//     --resource-group rg-Michael-Mueller `
//     --template-file infra/main.bicep `
//     --parameters infra/parameters/dev.bicepparam `
//     --parameters azureOpenAiEndpoint=https://oai-fittrack-dev.openai.azure.com/ `
//     --parameters azureOpenAiApiKey=$env:AZURE_OPENAI_API_KEY `
//     --parameters jwtSecret=$env:JWT_SECRET `
//     --parameters jwtRefreshSecret=$env:JWT_REFRESH_SECRET `
//     --parameters googleClientId=$env:GOOGLE_CLIENT_ID

using '../main.bicep'

param environmentName = 'dev'
param projectName = 'fittrack'

// param location = 'northeurope'
// param uniqueSuffix = 'mm0001'

// Public (non-secret) Azure OpenAI settings can live here.
param azureOpenAiApiVersion = '2024-08-01-preview'
param azureOpenAiDeploymentName = 'gpt-4o-mini'
