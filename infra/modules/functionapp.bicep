// Linux Flex Consumption (FC1) Function App, Node 24, Functions runtime v4.
// Wires app settings for Cosmos, Storage, Azure OpenAI, JWT, Google, AppInsights.
// Secrets that must remain secret (Cosmos key, JWT secrets, Google client id,
// OpenAI key) are passed in as @secure() params and not echoed via outputs.

targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('App Service Plan name.')
param planName string

@description('Function App name (must be globally unique).')
param functionAppName string

@description('Storage account name backing the Function App.')
param storageAccountName string

@description('Private blob container (in the same storage account) that holds the Flex deployment package.')
param deploymentContainerName string

@description('Maximum on-demand instances per function group.')
param maximumInstanceCount int = 5

@description('Instance memory in MB.')
param instanceMemoryMB int = 2048

@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Application Insights resource id for the Function App link tag.')
param appInsightsResourceId string

// --- Cosmos ---
@description('Cosmos DB documentEndpoint URL.')
param cosmosEndpoint string

@description('Cosmos DB primary master key.')
@secure()
param cosmosKey string

@description('Cosmos database id.')
param cosmosDatabaseId string = 'fittrack-db'

// --- Azure OpenAI (already provisioned externally) ---
@description('Azure OpenAI endpoint URL.')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI API key.')
@secure()
param azureOpenAiApiKey string = ''

@description('Azure OpenAI API version.')
param azureOpenAiApiVersion string = '2024-08-01-preview'

@description('Azure OpenAI deployment name.')
param azureOpenAiDeploymentName string = 'gpt-4.1-mini'

// --- Entra External ID Auth ---
@description('Entra JWT issuer URL (from OIDC discovery).')
param authIssuer string = ''

@description('Expected audience in access_token (Application ID URI).')
param authAudience string = ''

@description('JWKS URI for JWT signature verification.')
param authJwksUri string = ''

// --- Azure Document Intelligence ---
@description('Azure Document Intelligence endpoint URL.')
param azureDocIntelligenceEndpoint string = ''

@description('Azure Document Intelligence API key.')
@secure()
param azureDocIntelligenceKey string = ''

@description('Queue name for async AI keyword enrichment of reusable items.')
param enrichQueueName string = 'reusable-items-enrich'

@description('Tags applied to the resources.')
param tags object = {}

resource storage 'Microsoft.Storage/storageAccounts@2025-08-01' existing = {
  name: storageAccountName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

resource plan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2025-03-01' = {
  name: functionAppName
  location: location
  tags: union(tags, {
    'hidden-link: /app-insights-resource-id': appInsightsResourceId
  })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
      }
      runtime: {
        name: 'node'
        version: '24'
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: []
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'COSMOS_KEY'
          value: cosmosKey
        }
        {
          name: 'COSMOS_DATABASE_ID'
          value: cosmosDatabaseId
        }
        {
          name: 'STORAGE_CONNECTION_STRING'
          value: storageConnectionString
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: azureOpenAiEndpoint
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: azureOpenAiApiKey
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: azureOpenAiApiVersion
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
          value: azureOpenAiDeploymentName
        }
        {
          name: 'AUTH_ISSUER'
          value: authIssuer
        }
        {
          name: 'AUTH_AUDIENCE'
          value: authAudience
        }
        {
          name: 'AUTH_JWKS_URI'
          value: authJwksUri
        }
        {
          name: 'AZURE_DI_ENDPOINT'
          value: azureDocIntelligenceEndpoint
        }
        {
          name: 'AZURE_DI_KEY'
          value: azureDocIntelligenceKey
        }
        {
          name: 'ENRICH_QUEUE_NAME'
          value: enrichQueueName
        }
      ]
    }
  }
}

@description('Function App default hostname.')
output defaultHostName string = functionApp.properties.defaultHostName

@description('Function App resource id.')
output functionAppId string = functionApp.id

@description('Function App name.')
output functionAppName string = functionApp.name

@description('System-assigned principal id for granting RBAC later.')
output principalId string = functionApp.identity.principalId
