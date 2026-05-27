// Parameter file for the dev environment.
//
// Target resource group: rg-Michael-Mueller (existing — do NOT recreate).
// Location is intentionally NOT set here — it is inherited from the resource
// group via `resourceGroup().location` in main.bicep. To override, uncomment
// the `location` line below.
//
// Secrets (Azure OpenAI key) MUST NOT be committed. Pass them at deploy time
// with `--parameters` overrides, e.g.:
//
//   az deployment group create `
//     --resource-group rg-Michael-Mueller `
//     --template-file infra/main.bicep `
//     --parameters infra/parameters/dev.bicepparam `
//     --parameters azureOpenAiEndpoint=https://oai-fittrack-dev.openai.azure.com/ `
//     --parameters azureOpenAiApiKey=$env:AZURE_OPENAI_API_KEY

using '../main.bicep'

param environmentName = 'dev'
param projectName = 'fittrack'

// param location = 'northeurope'
// param uniqueSuffix = 'mm0001'

// Public (non-secret) Azure OpenAI settings can live here.
param azureOpenAiApiVersion = '2024-08-01-preview'
param azureOpenAiDeploymentName = 'gpt-4o-mini'

// Entra External ID auth (all public values — no secrets)
param authIssuer = 'https://997c7414-a6e0-47fa-9f5f-de98ea6c426e.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/v2.0'
param authAudience = 'api://ce439bd5-864f-46cb-ae77-518d3cba368b'
param authJwksUri = 'https://michaelmuellertestapp.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/discovery/v2.0/keys'
