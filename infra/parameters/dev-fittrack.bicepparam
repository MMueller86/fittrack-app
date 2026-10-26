// Dev blueprint for the new personal subscription "Fittrack"
// (tenant 207e17a1-97d8-4866-b33c-d74c0feb01de, subscription dd7539ab-c638-44f8-9173-8bcd28cdbae3).
//
// Target resource group: rg-fittrack-dev (germanywestcentral, pre-existing).
// Azure OpenAI (oai-fittrack-dev, gpt-4.1-mini) is created outside Bicep; Document Intelligence (F0) is deployed here.
//
//   az deployment group create `
//     --subscription dd7539ab-c638-44f8-9173-8bcd28cdbae3 `
//     --resource-group rg-fittrack-dev `
//     --template-file infra/main.bicep `
//     --parameters infra/parameters/dev-fittrack.bicepparam `
//     --parameters azureOpenAiEndpoint=$env:AZURE_OPENAI_ENDPOINT `
//     --parameters azureOpenAiApiKey=$env:AZURE_OPENAI_API_KEY
//
// Secrets MUST NOT be committed; pass them at deploy time.

using '../main.bicep'

param environmentName = 'dev'
param projectName = 'fittrack'

param azureOpenAiApiVersion = '2024-08-01-preview'
param azureOpenAiDeploymentName = 'gpt-4.1-mini'

// Entra External ID tenant is unchanged by the subscription move.
param authIssuer = 'https://997c7414-a6e0-47fa-9f5f-de98ea6c426e.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/v2.0'
param authAudience = 'api://ce439bd5-864f-46cb-ae77-518d3cba368b'
param authJwksUri = 'https://michaelmuellertestapp.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/discovery/v2.0/keys'
