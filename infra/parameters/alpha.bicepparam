// Parameter file for the alpha environment (permanent personal test environment).
//
// Target resource group: rg-Michael-Mueller (same as dev — no new RG needed).
// Resources are separated by name prefix: *-fittrack-alpha-* vs *-fittrack-dev-*.
// Location is inherited from the resource group via `resourceGroup().location`.
//
// Cosmos DB, Storage, and Document Intelligence are all separate resources from dev,
// so alpha data never mixes with local dev data.
//
// Azure OpenAI is SHARED with dev (external resource, not managed by this template).
// Pass the same endpoint and key as for dev at deploy time:
//
//   az deployment group create `
//     --resource-group rg-Michael-Mueller `
//     --template-file infra/main.bicep `
//     --parameters infra/parameters/alpha.bicepparam `
//     --parameters azureOpenAiEndpoint=https://oai-fittrackapp-dev.openai.azure.com/ `
//     --parameters azureOpenAiApiKey=$env:AZURE_OPENAI_API_KEY
//
// Secrets (azureOpenAiApiKey) MUST NOT be committed. Pass them at deploy time.

using '../main.bicep'

param environmentName = 'alpha'
param projectName = 'fittrack'

// Document Intelligence — reuse the shared dev instance (stateless service, no user data).
// F0 is limited to 1 per subscription, so we pass the dev endpoint/key directly
// and skip deploying a new DI resource for alpha.
// These values are passed at deploy time via --parameters (not committed as secrets):
//   --parameters azureDocIntelligenceEndpoint=https://di-fittrack-dev-ppf5sc.cognitiveservices.azure.com/
//   --parameters azureDocIntelligenceKey=$env:AZURE_DI_KEY

// Public Azure OpenAI settings (no secrets).
param azureOpenAiApiVersion = '2024-08-01-preview'
param azureOpenAiDeploymentName = 'gpt-4o-mini'

// Entra External ID auth — same CIAM tenant as dev (same user accounts work in both environments).
param authIssuer = 'https://997c7414-a6e0-47fa-9f5f-de98ea6c426e.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/v2.0'
param authAudience = 'api://ce439bd5-864f-46cb-ae77-518d3cba368b'
param authJwksUri = 'https://michaelmuellertestapp.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/discovery/v2.0/keys'
