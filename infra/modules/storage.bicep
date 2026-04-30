// Storage Account (Standard_LRS) with:
//   - AzureWebJobsStorage support for the Function App (default endpoints)
//   - Blob container `recipe-images` for backend-proxied recipe images
//
// Backend proxies all Blob access; no SAS tokens are exposed to mobile.

targetScope = 'resourceGroup'

@description('Azure region for the storage account.')
param location string

@description('Globally unique storage account name (3-24 chars, lowercase, alphanumeric).')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('Blob container for recipe images.')
param recipeImagesContainerName string = 'recipe-images'

@description('Tags applied to the account.')
param tags object = {}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource recipeImages 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: recipeImagesContainerName
  properties: {
    publicAccess: 'None'
  }
}

@description('Storage account resource id.')
output storageAccountId string = storage.id

@description('Storage account name.')
output storageAccountName string = storage.name

@description('Recipe images container name.')
output recipeImagesContainerName string = recipeImages.name
