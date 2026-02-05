// =============================================================================
// App Service Module - App Service with VNet Integration (Public Access)
// =============================================================================
// This module creates:
// - App Service Plan (Linux, Node.js)
// - App Service Web App with VNet Integration for outbound traffic
// - Public access enabled for both main site and SCM (Kudu) for simplicity
//
// Note: This architecture uses SWA Linked Backend for API routing.
// App Service is publicly accessible but protected by Entra ID authentication.
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Unique suffix for globally unique resource names')
param uniqueSuffix string

@description('Subnet ID for VNet Integration (outbound)')
param appServiceSubnetId string

@description('Key Vault name for referencing secrets')
param keyVaultName string

@description('Application Insights connection string')
param appInsightsConnectionString string = ''

@description('Microsoft Entra ID Tenant ID')
param entraTenantId string

@description('Microsoft Entra ID Backend Client ID')
param entraBackendClientId string

@description('Static Web Apps URL for CORS')
param swaUrl string = ''

@description('App Service Plan SKU')
@allowed([
  'B1'
  'B2'
  'B3'
  'S1'
  'S2'
  'S3'
  'P1v3'
  'P2v3'
  'P3v3'
])
param sku string = 'B1'

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

// App Service name must be globally unique (becomes *.azurewebsites.net)
var appServicePlanName = 'asp-${baseName}-${uniqueSuffix}'
var appServiceName = 'app-${baseName}-${uniqueSuffix}'

// =============================================================================
// App Service Plan
// =============================================================================

resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: sku
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// =============================================================================
// App Service Web App
// =============================================================================

resource appService 'Microsoft.Web/sites@2024-04-01' = {
  name: appServiceName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    // Public access enabled for both main site and SCM
    // SWA Linked Backend provides the API routing
    // Entra ID authentication protects the API endpoints
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: appServiceSubnetId
    vnetRouteAllEnabled: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      // Explicit startup command (also defined in package.json)
      appCommandLine: 'node src/app.js'
      // Allow public access (protected by Entra ID at application level)
      ipSecurityRestrictionsDefaultAction: 'Allow'
      scmIpSecurityRestrictionsUseMain: true
      scmIpSecurityRestrictionsDefaultAction: 'Allow'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=cosmos-connection-string)'
        }
        {
          name: 'ENTRA_TENANT_ID'
          value: entraTenantId
        }
        {
          name: 'ENTRA_CLIENT_ID'
          value: entraBackendClientId
        }
        {
          name: 'CORS_ORIGINS'
          value: swaUrl
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_NodeJS'
          value: '1'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
  }
}

// =============================================================================
// Security: Disable Basic Publishing Credentials
// =============================================================================
// Disable FTP and SCM basic auth for security best practices.
// Use managed identity or deployment tokens instead.
// =============================================================================

resource ftpPublishingPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: appService
  name: 'ftp'
  properties: {
    allow: false
  }
}

resource scmPublishingPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: appService
  name: 'scm'
  properties: {
    allow: false
  }
}

// =============================================================================
// VNet Integration (Outbound)
// =============================================================================
// VNet Integration allows App Service to access resources in the VNet
// (e.g., Cosmos DB via Private Endpoint, Key Vault via Private Endpoint)
// =============================================================================

resource vnetIntegration 'Microsoft.Web/sites/networkConfig@2024-04-01' = {
  parent: appService
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: appServiceSubnetId
    swiftSupported: true
  }
}

// =============================================================================
// NOTE: EasyAuth Configuration
// =============================================================================
// EasyAuth (authsettingsV2) is configured in a SEPARATE module that runs
// AFTER the SWA Linked Backend is created. This is necessary because:
//
// 1. SWA Linked Backend automatically configures EasyAuth with default settings
//    (unauthenticatedClientAction: 'RedirectToLoginPage')
// 2. These default settings break API deployments (causes 302 redirects instead of 401)
// 3. The default settings also don't include excludedPaths, blocking /health checks
//
// See: modules/appservice-auth.bicep for the EasyAuth configuration
// =============================================================================

// =============================================================================
// Outputs
// =============================================================================

output appServiceId string = appService.id
output appServiceName string = appService.name
output appServiceDefaultHostName string = appService.properties.defaultHostName
output appServicePrincipalId string = appService.identity.principalId
