targetScope = 'resourceGroup'

param accountName string
param databaseName string = 'fittrack-db'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: accountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: account
  name: databaseName
}

resource recipesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'recipes'
  properties: {
    resource: {
      id: 'recipes'
      partitionKey: {
        paths: ['/userId']
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
            { path: '/lastUsedAt', order: 'descending' }
            { path: '/updatedAt', order: 'descending' }
          ]
          [
            { path: '/updatedAt', order: 'descending' }
            { path: '/id', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

resource communityRecipesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
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
