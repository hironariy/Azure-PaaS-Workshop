// =============================================================================
// Static Web Apps Module - Azure Static Web Apps with Linked Backend
// =============================================================================
// This module creates:
// - Azure Static Web Apps (Free tier for workshop)
// - Linked Backend to App Service for API routing
// - GitHub deployment configuration is handled separately via GitHub Actions
//
// SWA Linked Backend automatically routes /api/* requests to the linked
// App Service, avoiding certificate issues with self-signed certificates.
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Unique suffix for globally unique resource names')
param uniqueSuffix string

@description('Static Web Apps SKU')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Free'

@description('App Service resource ID for Linked Backend')
param linkedBackendResourceId string = ''

@description('App Service region (may differ from SWA location)')
param linkedBackendRegion string = ''

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

// Static Web App name must be globally unique
var staticWebAppName = 'swa-${baseName}-${uniqueSuffix}'

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
// Linked Backend to App Service
// =============================================================================
// This creates a link between SWA and App Service, automatically routing
// /api/* requests to the App Service backend.
// IMPORTANT: Linked Backend requires Standard SKU (not available on Free tier)
// Ref: https://learn.microsoft.com/azure/static-web-apps/apis-app-service
// =============================================================================

resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-01-01' = if (!empty(linkedBackendResourceId) && sku == 'Standard') {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: linkedBackendResourceId
    region: linkedBackendRegion  // Must be the App Service's region, not SWA's location
  }
}

// =============================================================================
// Static Web Apps Custom Configuration
// Note: staticwebapp.config.json in the frontend repo handles routing
// =============================================================================

// Application Settings (available in staticwebapp.config.json via process.env)
// Note: With Linked Backend, API_BACKEND_URL is not needed as routing is automatic
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    // API calls are automatically routed via Linked Backend
    // No explicit API_BACKEND_URL needed
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
