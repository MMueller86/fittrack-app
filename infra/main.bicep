// FitTrack Infrastructure — main Bicep orchestrator
// Deploys all backend Azure resources for the dev environment.
//
// Resources created:
//   - Cosmos DB Account + Database + 6 Containers (cosmos.bicep)
//   - Storage Account + Blob Container (storage.bicep)
//   - Log Analytics Workspace + Application Insights (appinsights.bicep)
//   - App Service Plan + Function App + App Settings (functionapp.bicep)
//
// NOT created here (already exists):
//   - Azure OpenAI resource and gpt4o-mini deployment
//   - Resource group (use existing rg-Michael-Mueller)
//
// Deploy with:
//   az deployment group create \
//     --resource-group rg-Michael-Mueller \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/dev.bicepparam
//
// Location defaults to the existing resource group's location
// (resourceGroup().location), so resources are co-located with the RG.

targetScope = 'resourceGroup'

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Environment name used in resource naming (dev, staging, prod).')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environmentName string = 'dev'

@description('Project short name used in resource naming.')
param projectName string = 'fittrack'

@description('Suffix appended to globally-unique resource names. Defaults to a deterministic 6-char hash of the resource group id so names stay stable across re-deployments.')
param uniqueSuffix string = toLower(substring(uniqueString(resourceGroup().id), 0, 6))

// --- Optional secrets (filled from .bicepparam / CLI) ---

@description('Azure OpenAI endpoint URL (existing resource).')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI API key.')
@secure()
param azureOpenAiApiKey string = ''

@description('Azure OpenAI API version.')
param azureOpenAiApiVersion string = '2024-02-01'

@description('Azure OpenAI deployment name.')
param azureOpenAiDeploymentName string = 'gpt4o-mini'

@description('JWT signing secret for access tokens (M2).')
@secure()
param jwtSecret string = ''

@description('JWT signing secret for refresh tokens (M2).')
@secure()
param jwtRefreshSecret string = ''

@description('Google OAuth client id used to validate ID tokens (M2).')
param googleClientId string = ''

// --- Naming ---

var namePrefix = '${projectName}-${environmentName}'
var cosmosAccountName = toLower('cosmos-${namePrefix}-${uniqueSuffix}')
// Storage account names: 3-24 chars, alphanumeric, lowercase
var storageAccountName = toLower(replace('st${projectName}${environmentName}${uniqueSuffix}', '-', ''))
var functionAppName = 'func-${namePrefix}-${uniqueSuffix}'
var planName = 'asp-${namePrefix}'
var appInsightsName = 'appi-${namePrefix}'
var logAnalyticsName = 'log-${namePrefix}'

var commonTags = {
  project: projectName
  environment: environmentName
  managedBy: 'bicep'
}

// --- Modules ---

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos-deploy'
  params: {
    location: location
    accountName: cosmosAccountName
    databaseName: 'fittrack-db'
    tags: commonTags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage-deploy'
  params: {
    location: location
    storageAccountName: storageAccountName
    tags: commonTags
  }
}

module monitoring 'modules/appinsights.bicep' = {
  name: 'monitoring-deploy'
  params: {
    location: location
    workspaceName: logAnalyticsName
    appInsightsName: appInsightsName
    tags: commonTags
  }
}

// Read the Cosmos primary key from the deployed account (kept inside the
// template — never written to outputs).

module functionApp 'modules/functionapp.bicep' = {
  name: 'functionapp-deploy'
  params: {
    location: location
    planName: planName
    functionAppName: functionAppName
    storageAccountName: storage.outputs.storageAccountName
    appInsightsConnectionString: monitoring.outputs.connectionString
    cosmosEndpoint: cosmos.outputs.endpoint
    cosmosKey: cosmos.outputs.primaryMasterKey
    cosmosDatabaseId: cosmos.outputs.databaseName
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiApiKey: azureOpenAiApiKey
    azureOpenAiApiVersion: azureOpenAiApiVersion
    azureOpenAiDeploymentName: azureOpenAiDeploymentName
    jwtSecret: jwtSecret
    jwtRefreshSecret: jwtRefreshSecret
    googleClientId: googleClientId
    tags: commonTags
  }
}

// --- Outputs ---

@description('Cosmos DB documentEndpoint URL.')
output cosmosEndpoint string = cosmos.outputs.endpoint

@description('Cosmos DB account name (use this with `az cosmosdb keys list` to retrieve the key).')
output cosmosAccountName string = cosmos.outputs.accountName

@description('Cosmos database id.')
output cosmosDatabaseId string = cosmos.outputs.databaseName

@description('Storage account name.')
output storageAccountName string = storage.outputs.storageAccountName

@description('Function App default hostname (https://...).')
output functionAppHostName string = functionApp.outputs.defaultHostName

@description('Function App name.')
output functionAppName string = functionApp.outputs.functionAppName

@description('Application Insights connection string.')
output appInsightsConnectionString string = monitoring.outputs.connectionString
