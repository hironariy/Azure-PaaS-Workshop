// =============================================================================
// Main Bicep Template - Azure PaaS Workshop
// =============================================================================
// This template orchestrates the deployment of all PaaS resources:
// 1. Network (VNet, Subnets, NAT Gateway, Private DNS Zones)
// 2. Monitoring (Log Analytics, Application Insights)
// 3. Key Vault with Private Endpoint
// 4. Cosmos DB with Private Endpoint
// 5. App Service with VNet Integration and Private Endpoint
// 6. Application Gateway with WAF v2
// 7. Static Web Apps
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
param cosmosDbTier string = 'M30'

@description('Enable Cosmos DB High Availability')
param cosmosDbEnableHa bool = false

@description('Static Web Apps SKU')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Free'

@description('Application Gateway minimum instances')
@minValue(1)
@maxValue(10)
param appGatewayMinCapacity int = 1

@description('Application Gateway maximum instances')
@minValue(2)
@maxValue(10)
param appGatewayMaxCapacity int = 2

// =============================================================================
// Variables
// =============================================================================

var tags = {
  Environment: environment
  Project: 'Azure-PaaS-Workshop'
  ManagedBy: 'Bicep'
}

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
    appServiceSubnetId: network.outputs.appServiceSubnetId
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    appServicePrivateDnsZoneId: network.outputs.appServicePrivateDnsZoneId
    keyVaultName: keyVault.outputs.keyVaultName
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    entraTenantId: entraTenantId
    entraBackendClientId: entraBackendClientId
    sku: appServiceSku
    tags: tags
  }
  dependsOn: [
    cosmosDb // Ensure connection string is in Key Vault
  ]
}

// =============================================================================
// Update Key Vault RBAC for App Service
// =============================================================================

module keyVaultRbac 'modules/keyvault.bicep' = {
  name: 'keyvault-rbac-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    privateEndpointSubnetId: network.outputs.privateEndpointSubnetId
    keyVaultPrivateDnsZoneId: network.outputs.keyVaultPrivateDnsZoneId
    tenantId: entraTenantId
    appServicePrincipalId: appService.outputs.appServicePrincipalId
    tags: tags
  }
}

// =============================================================================
// Module: Application Gateway
// =============================================================================

module appGateway 'modules/appgateway.bicep' = {
  name: 'appgateway-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    appGatewaySubnetId: network.outputs.appGatewaySubnetId
    appServicePrivateLinkFqdn: appService.outputs.appServicePrivateLinkFqdn
    minCapacity: appGatewayMinCapacity
    maxCapacity: appGatewayMaxCapacity
    tags: tags
  }
}

// =============================================================================
// Module: Static Web Apps
// =============================================================================

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp-deployment'
  params: {
    environment: environment
    location: location
    baseName: baseName
    sku: staticWebAppSku
    apiBackendUrl: 'https://${appGateway.outputs.appGatewayFqdn}'
    tags: tags
  }
}

// =============================================================================
// Outputs
// =============================================================================

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

// Application Gateway outputs
output appGatewayName string = appGateway.outputs.appGatewayName
output appGatewayPublicIp string = appGateway.outputs.appGatewayPublicIp
output appGatewayFqdn string = appGateway.outputs.appGatewayFqdn
output apiUrl string = 'https://${appGateway.outputs.appGatewayFqdn}/api'

// Static Web Apps outputs
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl

// Monitoring outputs
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId
output appInsightsName string = monitoring.outputs.appInsightsName

// =============================================================================
// Post-Deployment Instructions
// =============================================================================
// After deployment, complete these manual steps:
//
// 1. Get Static Web Apps deployment token:
//    az staticwebapp secrets list --name <swa-name> --query "properties.apiKey" -o tsv
//
// 2. Configure GitHub secrets:
//    - AZURE_STATIC_WEB_APPS_API_TOKEN: <token from step 1>
//
// 3. Update Entra ID App Registration redirect URIs:
//    - Frontend: https://<swa-url>/.auth/login/aad/callback
//
// 4. Update frontend staticwebapp.config.json with API URL:
//    - API rewrite target: https://<app-gateway-fqdn>/api/*
// =============================================================================
