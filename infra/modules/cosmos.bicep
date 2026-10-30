// Cosmos DB account (Serverless), database, and containers.
// Partition keys:
//   users               /id
//   nutritionProfiles   /userId
//   weights             /userId
//   nutritionDiaryMeals /userId
//   reusableMealItems  /userId
//   recipes             /userId
//   aiUsage             /userId
//   profiles            /userId
//   foodProducts        /id

targetScope = 'resourceGroup'

@description('Azure region for the Cosmos account.')
param location string

@description('Globally unique Cosmos DB account name (3-44 chars, lowercase).')
@minLength(3)
@maxLength(44)
param accountName string

@description('Logical database name.')
param databaseName string = 'fittrack-db'

@description('Create the Cosmos account; set false when the account already exists outside this deployment.')
param createAccount bool = true

@description('Tags applied to the account.')
param tags object = {}

resource account 'Microsoft.DocumentDB/databaseAccounts@2025-10-15' = if (createAccount) {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    analyticalStorageConfiguration: {
      schemaType: 'WellDefined'
    }
    defaultIdentity: 'FirstPartyIdentity'
    enableAutomaticFailover: true
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

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2025-10-15' = {
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
  { name: 'aiUsage', partitionKey: '/userId' }
  { name: 'profiles', partitionKey: '/userId' }
  { name: 'foodProducts', partitionKey: '/id' }
  { name: 'userFoodRelations', partitionKey: '/userId' }
]

// aiInsights is defined separately because it needs defaultTtl: -1 to enable
// per-document TTL expiry. All other containers have no TTL (property omitted).
// Cosmos DB only accepts -1 or a positive integer — omitting the property disables TTL.
resource aiInsightsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2025-10-15' = {
  parent: database
  name: 'aiInsights'
  properties: {
    resource: {
      id: 'aiInsights'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      defaultTtl: -1
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
        conflictResolutionProcedure: ''
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [{ path: '/"_etag"/?' }]
        compositeIndexes: []
      }
    }
  }
}

resource containers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2025-10-15' = [for c in containerDefs: {
  parent: database
  name: c.name
  properties: {
    resource: {
      id: c.name
      partitionKey: {
        paths: [c.partitionKey]
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
        conflictResolutionProcedure: ''
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        // foodProducts: targeted indexing — only index fields used in queries.
        // At 210k documents with large keyword arrays, full /* indexing would
        // consume excessive storage and RU on every write.
        includedPaths: c.name == 'foodProducts' ? [
          { path: '/normalizedName/?' }
          { path: '/brand/?' }
          { path: '/searchKeywords/*' }
          { path: '/source/?' }
          { path: '/barcode/?' }
        ] : [
          { path: '/*' }
        ]
        excludedPaths: c.name == 'foodProducts' ? [
          { path: '/*' }
          { path: '/"_etag"/?' }
        ] : [
          { path: '/"_etag"/?' }
        ]
        compositeIndexes: c.name == 'recipes' ? [
          [
            { path: '/lastUsedAt', order: 'descending' }
            { path: '/updatedAt', order: 'descending' }
          ]
          [
            { path: '/updatedAt', order: 'descending' }
            { path: '/id', order: 'ascending' }
          ]
        ] : []
      }
    }
  }
}]

resource communityRecipesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2025-10-15' = {
  parent: database
  name: 'communityRecipes'
  properties: {
    resource: {
      id: 'communityRecipes'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
        conflictResolutionProcedure: ''
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [{ path: '/"_etag"/?' }]
        compositeIndexes: [
          [
            { path: '/updatedAt', order: 'descending' }
            { path: '/id', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

@description('Cosmos DB account resource id.')
output accountId string = resourceId('Microsoft.DocumentDB/databaseAccounts', accountName)

@description('Cosmos DB account name.')
output accountName string = accountName

@description('Cosmos DB documentEndpoint URL.')
#disable-next-line use-resource-symbol-reference
output endpoint string = reference(resourceId('Microsoft.DocumentDB/databaseAccounts', accountName), '2024-05-15').documentEndpoint

@description('Database name.')
output databaseName string = database.name

@description('Cosmos primary master key. Marked secure — not echoed in deployment outputs.')
@secure()
#disable-next-line use-resource-symbol-reference
output primaryMasterKey string = listKeys(resourceId('Microsoft.DocumentDB/databaseAccounts', accountName), '2024-05-15').primaryMasterKey
