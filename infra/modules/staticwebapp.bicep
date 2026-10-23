// Static Web App (Free) hosting the Android App Link / auth relay content.
// Content is deployed separately (infra/static/auth-relay) with the SWA CLI.

@description('Static Web App name.')
param name string

@description('Azure region. Free SKU is only available in: centralus, eastus2, westus2, westeurope, eastasia.')
@allowed([
  'centralus'
  'eastus2'
  'westus2'
  'westeurope'
  'eastasia'
])
param location string

param tags object = {}

resource staticSite 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Disabled'
    allowConfigFileUpdates: true
  }
}

output name string = staticSite.name
output defaultHostname string = staticSite.properties.defaultHostname
