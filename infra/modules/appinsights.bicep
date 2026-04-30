// Application Insights (workspace-based) for the Function App.
// Modern AI resources require a Log Analytics workspace; a small one is
// created here at minimal cost. Required for cold-start debugging and
// request tracing.

targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Log Analytics workspace name.')
param workspaceName string

@description('Application Insights resource name.')
param appInsightsName string

@description('Tags applied to the resources.')
param tags object = {}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

@description('Application Insights instrumentation key.')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights connection string (preferred for SDKs).')
output connectionString string = appInsights.properties.ConnectionString

@description('Workspace resource id.')
output workspaceId string = workspace.id
