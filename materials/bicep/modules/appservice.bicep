// =============================================================================
// App Service Module - App Service with VNet Integration and Private Endpoint
// =============================================================================
// This module creates:
// - App Service Plan (Linux, Node.js)
// - App Service Web App with VNet Integration
// - Private Endpoint for inbound traffic
// - Separate firewall rules for main site vs SCM (Kudu)
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Subnet ID for VNet Integration (outbound)')
param appServiceSubnetId string

@description('Subnet ID for Private Endpoint (inbound)')
param privateEndpointSubnetId string

@description('Private DNS Zone ID for App Service')
param appServicePrivateDnsZoneId string

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

var appServicePlanName = 'asp-${baseName}-${environment}'
var appServiceName = 'app-${baseName}-${environment}'
var privateEndpointName = 'pe-appservice-${baseName}'

// =============================================================================
// App Service Plan
// =============================================================================

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
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

resource appService 'Microsoft.Web/sites@2023-01-01' = {
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
    publicNetworkAccess: 'Disabled'
    virtualNetworkSubnetId: appServiceSubnetId
    vnetRouteAllEnabled: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      // Separate firewall rules for main site vs SCM
      ipSecurityRestrictionsDefaultAction: 'Deny'
      scmIpSecurityRestrictionsUseMain: false
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
// VNet Integration (Outbound)
// =============================================================================

resource vnetIntegration 'Microsoft.Web/sites/networkConfig@2023-01-01' = {
  parent: appService
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: appServiceSubnetId
    swiftSupported: true
  }
}

// =============================================================================
// Private Endpoint (Inbound)
// =============================================================================

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'appservice-connection'
        properties: {
          privateLinkServiceId: appService.id
          groupIds: [
            'sites'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: appServicePrivateDnsZoneId
        }
      }
    ]
  }
}

// =============================================================================
// Outputs
// =============================================================================

output appServiceId string = appService.id
output appServiceName string = appService.name
output appServiceDefaultHostName string = appService.properties.defaultHostName
output appServicePrincipalId string = appService.identity.principalId
output privateEndpointId string = privateEndpoint.id

// Private Link FQDN for Application Gateway backend
output appServicePrivateLinkFqdn string = '${appServiceName}.privatelink.azurewebsites.net'
