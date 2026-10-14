// =============================================================================
// Main Bicep Template - Azure PaaS Workshop
// =============================================================================
// This template orchestrates the deployment of all PaaS resources:
// 1. Network (VNet, Subnets, NAT Gateway, Private DNS Zones)
// 2. Monitoring (Log Analytics, Application Insights)
// 3. Key Vault with Private Endpoint
// 4. Cosmos DB with Private Endpoint
// 5. App Service with VNet Integration (public access for simplicity)
// 6. Static Web Apps with Linked Backend to App Service
//
// Note: This architecture uses SWA Linked Backend instead of Application Gateway
// for API routing. This simplifies the architecture and avoids certificate
// management issues with self-signed certificates.
// =============================================================================

targetScope = 'resourceGroup'

// =============================================================================
// Parameters
// =============================================================================

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for all resources (will be combined with resource type prefix)')
@minLength(3)
@maxLength(15)
param baseName string = 'blogapp'

@description('Deployment mode: standard uses code deployment, fastpath-container uses prebuilt container image')
@allowed([
  'standard'
  'fastpath-container'
])
param deploymentMode string = 'standard'

@description('Container image for fastpath-container mode (for example docker.io/org/image@sha256:...)')
param appServiceContainerImage string = ''

// =============================================================================
// Multi-Group Workshop Support
// =============================================================================
// For workshops with multiple groups (A-J) deploying to the same subscription,
// each group should use a unique resource group name.
// The groupId is used to generate a recommended resource group name.
// Example: Group A → rg-blogapp-A-workshop
// =============================================================================

@description('Workshop group identifier (A-J) for multi-group deployments. Leave empty for single-group.')
@allowed(['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])
param groupId string = ''

@description('Microsoft Entra ID Tenant ID')
param entraTenantId string

@description('Microsoft Entra ID Backend API Client ID')
param entraBackendClientId string

@description('Microsoft Entra ID Frontend SPA Client ID - stored in Key Vault for frontend configuration')
#disable-next-line no-unused-params
param entraFrontendClientId string

@description('Cosmos DB administrator password')
@secure()
param cosmosDbAdminPassword string

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
param appServiceSku string = 'B1'

@description('Cosmos DB vCore tier')
@allowed([
  'M25'
  'M30'
  'M40'
  'M50'
])
param cosmosDbTier string = 'M25'

@description('Enable Cosmos DB High Availability')
param cosmosDbEnableHa bool = false

@description('Static Web Apps SKU: Standard is required for the linked App Service backend')
@allowed([
  'Standard'
])
param staticWebAppSku string = 'Standard'

@description('Static Web Apps location (limited regions available: westus2, centralus, eastus2, westeurope, eastasia)')
@allowed([
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
])
param staticWebAppLocation string = 'eastasia'

// =============================================================================
// Variables
// =============================================================================

var tags = {
  Environment: environment
  Project: 'Azure-PaaS-Workshop'
  ManagedBy: 'Bicep'
  GroupId: empty(groupId) ? 'single' : groupId
}

// Generate unique suffix for globally unique resource names
// This ensures multiple workshop groups can deploy to the same subscription
var uniqueSuffix = substring(uniqueString(resourceGroup().id, groupId, baseName), 0, 6)

// =============================================================================
// Module: Network
// =============================================================================

module network 'modules/network.bicep' = {
  name: 'network-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    tags: tags
  }
}

// =============================================================================
// Module: Monitoring
// =============================================================================

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    tags: tags
  }
}

// =============================================================================
// Module: Key Vault
// =============================================================================

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    uniqueSuffix: uniqueSuffix
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    keyVaultPrivateDnsZoneId: network.outputs.keyVaultPrivateDnsZoneId
    tenantId: entraTenantId
    tags: tags
  }
}

// =============================================================================
// Module: Cosmos DB
// =============================================================================

module cosmosDb 'modules/cosmosdb.bicep' = {
  name: 'cosmosdb-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    uniqueSuffix: uniqueSuffix
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    cosmosPrivateDnsZoneId: network.outputs.cosmosPrivateDnsZoneId
    administratorPassword: cosmosDbAdminPassword
    tier: cosmosDbTier
    enableHa: cosmosDbEnableHa
    keyVaultName: keyVault.outputs.keyVaultName
    tags: tags
  }
}

// =============================================================================
// Module: App Service
// =============================================================================

module appService 'modules/appservice.bicep' = {
  name: 'appservice-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    uniqueSuffix: uniqueSuffix
    appServiceSubnetId: network.outputs.appServiceSubnetId
    keyVaultName: keyVault.outputs.keyVaultName
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    entraTenantId: entraTenantId
    entraBackendClientId: entraBackendClientId
    sku: appServiceSku
    runtimeMode: deploymentMode
    containerImage: appServiceContainerImage
    tags: tags
  }
  dependsOn: [
    cosmosDb // Ensure connection string is in Key Vault
  ]
}

// =============================================================================
// Update Key Vault RBAC for App Service
// =============================================================================

module keyVaultRbac 'modules/keyvault-rbac.bicep' = {
  name: 'keyvault-rbac-deployment'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    appServicePrincipalId: appService.outputs.appServicePrincipalId
  }
}

// =============================================================================
// Module: Static Web Apps with Linked Backend
// =============================================================================

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp-deployment'
  params: {
    environment: environment
    location: staticWebAppLocation  // SWA has limited region availability
    baseName: baseName
    uniqueSuffix: uniqueSuffix
    sku: staticWebAppSku
    // Link to App Service backend (SWA Linked Backend feature)
    linkedBackendResourceId: appService.outputs.appServiceId
    linkedBackendRegion: location  // App Service region (may differ from SWA location)
    tags: tags
  }
}

// =============================================================================
// Module: App Service EasyAuth Configuration (MUST RUN AFTER SWA Linked Backend)
// =============================================================================
// SWA Linked Backend automatically configures EasyAuth with default settings
// (RedirectToLoginPage) which breaks API deployments. This module runs AFTER
// the Linked Backend to override those settings with correct API configuration.
// =============================================================================

module appServiceAuth 'modules/appservice-auth.bicep' = {
  name: 'appservice-auth-deployment'
  params: {
    appServiceName: appService.outputs.appServiceName
    entraTenantId: entraTenantId
    entraBackendClientId: entraBackendClientId
    staticWebAppDefaultHostName: staticWebApp.outputs.staticWebAppDefaultHostName
  }
}

// =============================================================================
// Outputs
// =============================================================================

// Deployment info
output uniqueSuffix string = uniqueSuffix
output groupId string = groupId

// Network outputs
output vnetId string = network.outputs.vnetId
output vnetName string = network.outputs.vnetName
output natGatewayPublicIp string = network.outputs.natGatewayPublicIp

// Key Vault outputs
output keyVaultName string = keyVault.outputs.keyVaultName
output keyVaultUri string = keyVault.outputs.keyVaultUri

// Cosmos DB outputs
output cosmosDbClusterName string = cosmosDb.outputs.clusterName

// App Service outputs
output appServiceName string = appService.outputs.appServiceName
output appServiceDefaultHostName string = appService.outputs.appServiceDefaultHostName
output appServiceUrl string = 'https://${appService.outputs.appServiceDefaultHostName}'

// Static Web Apps outputs
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl

// API URL (via SWA Linked Backend - accessed through SWA's /api/* routes)
output apiUrl string = '${staticWebApp.outputs.staticWebAppUrl}/api'

// Monitoring outputs
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId
output appInsightsName string = monitoring.outputs.appInsightsName

// Multi-group workshop support
output recommendedResourceGroupName string = empty(groupId) 
  ? 'rg-${baseName}-paas-workshop' 
  : 'rg-${baseName}-${groupId}-paas-workshop'

// =============================================================================
// Post-Deployment Instructions
// =============================================================================
// After deployment, complete these manual steps:
//
// Follow materials/docs/learner/day-1-deploy-{backend,frontend}.ja.md.
// Register the SWA origin as the Frontend SPA redirect URI, not an EasyAuth callback.
// The state-scoped scripts deploy without printing SWA tokens or parameter secrets.
// =============================================================================
