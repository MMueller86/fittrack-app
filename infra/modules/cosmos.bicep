// Cosmos DB account (Serverless), database, and the 6 containers from data_model.md.
// Partition keys:
//   users               /id
//   nutritionProfiles   /userId
//   weights             /userId
//   nutritionDiaryMeals /userId
//   reusableMealItems   /userId
//   recipes             /userId

targetScope = 'resourceGroup'

@description('Azure region for the Cosmos account.')
param location string

@description('Globally unique Cosmos DB account name (3-44 chars, lowercase).')
@minLength(3)
@maxLength(44)
param accountName string

@description('Logical database name.')
param databaseName string = 'fittrack-db'

@description('Tags applied to the account.')
param tags object = {}

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
    disableLocalAuth: false
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

var containerDefs = [
  { name: 'users', partitionKey: '/id' }
  { name: 'nutritionProfiles', partitionKey: '/userId' }
  { name: 'weights', partitionKey: '/userId' }
  { name: 'nutritionDiaryMeals', partitionKey: '/userId' }
  { name: 'reusableMealItems', partitionKey: '/userId' }
  { name: 'recipes', partitionKey: '/userId' }
]

resource containers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [for c in containerDefs: {
  parent: database
  name: c.name
  properties: {
    resource: {
      id: c.name
      partitionKey: {
        paths: [c.partitionKey]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}]

@description('Cosmos DB account resource id.')
output accountId string = account.id

@description('Cosmos DB account name.')
output accountName string = account.name

@description('Cosmos DB documentEndpoint URL.')
output endpoint string = account.properties.documentEndpoint

@description('Database name.')
output databaseName string = database.name

@description('Cosmos primary master key. Marked secure — not echoed in deployment outputs.')
@secure()
output primaryMasterKey string = account.listKeys().primaryMasterKey
