// =============================================================================
// Key Vault Module - Key Vault with Private Endpoint
// =============================================================================
// This module creates:
// - Azure Key Vault for storing secrets
// - Private Endpoint for secure access
// App Service RBAC is owned by keyvault-rbac.bicep after identity creation.
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

@description('Private DNS Zone ID for Key Vault')
param keyVaultPrivateDnsZoneId string

@description('Tenant ID for the vault')
param tenantId string

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

// Key Vault name must be globally unique (3-24 chars, alphanumeric and hyphens)
var keyVaultName = 'kv-${baseName}-${uniqueSuffix}'
var privateEndpointName = 'pe-keyvault-${baseName}-${uniqueSuffix}'

// =============================================================================
// Key Vault
// =============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'  // Required when enabledForTemplateDeployment is true
      ipRules: []
      virtualNetworkRules: []
    }
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
        name: 'keyvault-connection'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: [
            'vault'
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
          privateDnsZoneId: keyVaultPrivateDnsZoneId
        }
      }
    ]
  }
}

// =============================================================================
// Outputs
// =============================================================================

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output privateEndpointId string = privateEndpoint.id
