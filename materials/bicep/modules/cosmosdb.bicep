// =============================================================================
// Cosmos DB Module - Azure Cosmos DB for MongoDB vCore with Private Endpoint
// =============================================================================
// This module creates:
// - Cosmos DB for MongoDB vCore cluster
// - Private Endpoint for secure access
// - Stores connection string in Key Vault
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Unique suffix for globally unique resource names')
param uniqueSuffix string

@description('Subnet ID for Private Endpoint')
param privateEndpointSubnetId string

@description('Private DNS Zone ID for Cosmos DB')
param cosmosPrivateDnsZoneId string

@description('Administrator login username')
param administratorLogin string = 'blogadmin'

@description('Administrator login password')
@secure()
param administratorPassword string

@description('Cosmos DB vCore tier (M25, M30, M40, M50, M60, M80)')
@allowed([
  'M25'
  'M30'
  'M40'
  'M50'
  'M60'
  'M80'
])
param tier string = 'M30'

@description('Disk size in GB')
param storageSizeGb int = 128

@description('Enable high availability')
param enableHa bool = false

@description('Key Vault name for storing connection string')
param keyVaultName string

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

// Cosmos DB cluster name must be globally unique (3-44 chars, lowercase alphanumeric and hyphens)
var clusterName = 'cosmos-${baseName}-${uniqueSuffix}'
var privateEndpointName = 'pe-cosmos-${baseName}-${uniqueSuffix}'

// =============================================================================
// Cosmos DB for MongoDB vCore Cluster
// =============================================================================

resource cosmosCluster 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' = {
  name: clusterName
  location: location
  tags: tags
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    serverVersion: '6.0'
    nodeGroupSpecs: [
      {
        kind: 'Shard'
        nodeCount: 1
        sku: tier
        diskSizeGB: storageSizeGb
        enableHa: enableHa
      }
    ]
    // Note: publicNetworkAccess is configured via Private Endpoint only
  }
}

// =============================================================================
// Private Endpoint
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
        name: 'cosmos-connection'
        properties: {
          privateLinkServiceId: cosmosCluster.id
          groupIds: [
            'MongoCluster'
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
          privateDnsZoneId: cosmosPrivateDnsZoneId
        }
      }
    ]
  }
}

// =============================================================================
// Store Connection String in Key Vault
// =============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Connection string format for Cosmos DB MongoDB vCore
var connectionString = 'mongodb+srv://${administratorLogin}:${administratorPassword}@${cosmosCluster.name}.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000'

resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: connectionString
    contentType: 'text/plain'
  }
}

resource cosmosAdminPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-admin-password'
  properties: {
    value: administratorPassword
    contentType: 'text/plain'
  }
}

// =============================================================================
// Outputs
// =============================================================================

output clusterId string = cosmosCluster.id
output clusterName string = cosmosCluster.name
output privateEndpointId string = privateEndpoint.id

// Output connection string secret reference (not the actual connection string)
output connectionStringSecretUri string = cosmosConnectionStringSecret.properties.secretUri
