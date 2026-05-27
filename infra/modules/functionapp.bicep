// Linux Consumption (Y1) Function App, Node 20 LTS, Functions runtime v4.
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

@description('Application Insights connection string.')
param appInsightsConnectionString string

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
param azureOpenAiApiVersion string = '2024-02-01'

@description('Azure OpenAI deployment name.')
param azureOpenAiDeploymentName string = 'gpt4o-mini'

// --- Entra External ID Auth ---
@description('Auth mode: dev or entra.')

@description('Entra JWT issuer URL (from OIDC discovery).')
param authIssuer string = ''

@description('Expected audience in access_token (Application ID URI).')
param authAudience string = ''

@description('JWKS URI for JWT signature verification.')
param authJwksUri string = ''

@description('Tags applied to the resources.')
param tags object = {}

// Reference the storage account to read its connection string.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        // --- App-specific settings ---
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
