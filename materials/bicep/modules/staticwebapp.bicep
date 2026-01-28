// =============================================================================
// Static Web Apps Module - Azure Static Web Apps
// =============================================================================
// This module creates:
// - Azure Static Web Apps (Free tier for workshop)
// - GitHub deployment configuration is handled separately via GitHub Actions
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Static Web Apps SKU')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Free'

@description('Application Gateway API URL for backend proxy')
param apiBackendUrl string = ''

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

var staticWebAppName = 'swa-${baseName}-${environment}'

// =============================================================================
// Static Web Apps
// =============================================================================

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// =============================================================================
// Static Web Apps Custom Configuration
// Note: staticwebapp.config.json in the frontend repo handles routing
// =============================================================================

// Application Settings (available in staticwebapp.config.json via process.env)
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    API_BACKEND_URL: apiBackendUrl
  }
}

// =============================================================================
// Outputs
// =============================================================================

output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppDefaultHostName string = staticWebApp.properties.defaultHostname
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'

// Deployment token is retrieved manually or via Azure CLI:
// az staticwebapp secrets list --name <swa-name> --query "properties.apiKey" -o tsv
