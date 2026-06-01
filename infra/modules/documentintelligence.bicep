// Azure AI Document Intelligence (formerly Form Recognizer).
// Used by the label-scan feature for OCR/table extraction from nutrition labels.
// F0 (free) tier: 500 pages/month — suitable for dev/test.

targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Cognitive Services account name.')
param accountName string

@description('Pricing tier (F0 = free 500 pages/month, S0 = standard pay-per-page).')
@allowed(['F0', 'S0'])
param sku string = 'F0'

@description('Tags applied to the resource.')
param tags object = {}

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: sku
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: accountName
  }
}

@description('Document Intelligence endpoint URL.')
output endpoint string = documentIntelligence.properties.endpoint

@description('Document Intelligence primary access key.')
output primaryKey string = documentIntelligence.listKeys().key1
