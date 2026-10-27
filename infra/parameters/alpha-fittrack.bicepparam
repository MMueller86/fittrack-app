// Alpha blueprint for the personal subscription "Fittrack" (dd7539ab-c638-44f8-9173-8bcd28cdbae3).
//
// Target resource group: rg-fittrack-alpha (germanywestcentral).
// Azure OpenAI (oai-fittrack-dev, gpt-4.1-mini) and Document Intelligence (di-fittrack-dev-hlpqe7)
// are shared with Dev; no Alpha instances are created.
//
//   az deployment group create `
//     --subscription dd7539ab-c638-44f8-9173-8bcd28cdbae3 `
//     --resource-group rg-fittrack-alpha `
//     --template-file infra/main.bicep `
//     --parameters infra/parameters/alpha-fittrack.bicepparam
//
// Secrets are read from process environment variables at deploy time and MUST NOT be committed:
//   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_DI_KEY

using '../main.bicep'

param environmentName = 'alpha'
param projectName = 'fittrack'

param deployFunctionApp = true
param deployStaticWebApp = true
param staticWebAppLocation = 'centralus'

param azureOpenAiEndpoint = readEnvironmentVariable('AZURE_OPENAI_ENDPOINT')
param azureOpenAiApiKey = readEnvironmentVariable('AZURE_OPENAI_API_KEY')
param azureOpenAiApiVersion = '2024-08-01-preview'
param azureOpenAiDeploymentName = 'gpt-4.1-mini'

param azureDocIntelligenceEndpoint = 'https://di-fittrack-dev-hlpqe7.cognitiveservices.azure.com/'
param azureDocIntelligenceKey = readEnvironmentVariable('AZURE_DI_KEY')

// Entra External ID tenant is shared with Dev.
param authIssuer = 'https://997c7414-a6e0-47fa-9f5f-de98ea6c426e.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/v2.0'
param authAudience = 'api://ce439bd5-864f-46cb-ae77-518d3cba368b'
param authJwksUri = 'https://michaelmuellertestapp.ciamlogin.com/997c7414-a6e0-47fa-9f5f-de98ea6c426e/discovery/v2.0/keys'
