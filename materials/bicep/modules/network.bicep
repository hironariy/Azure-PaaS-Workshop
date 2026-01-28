// =============================================================================
// Network Module - VNet, Subnets, NAT Gateway, Private DNS Zones
// =============================================================================
// This module creates the networking foundation for the PaaS Workshop:
// - Virtual Network with three subnets
// - NAT Gateway for App Service outbound internet access
// - Private DNS Zones for Private Endpoints
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('VNet address space')
param vnetAddressPrefix string = '10.1.0.0/16'

@description('Application Gateway subnet CIDR')
param appGatewaySubnetPrefix string = '10.1.0.0/24'

@description('App Service VNet Integration subnet CIDR')
param appServiceSubnetPrefix string = '10.1.1.0/24'

@description('Private Endpoint subnet CIDR')
param privateEndpointSubnetPrefix string = '10.1.2.0/24'

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

var vnetName = 'vnet-${baseName}-${environment}'
var natGatewayName = 'nat-${baseName}-${environment}'
var natGatewayPipName = 'pip-nat-${baseName}-${environment}'

// =============================================================================
// NAT Gateway Public IP
// =============================================================================

resource natGatewayPublicIp 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: natGatewayPipName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
  }
}

// =============================================================================
// NAT Gateway
// =============================================================================

resource natGateway 'Microsoft.Network/natGateways@2023-09-01' = {
  name: natGatewayName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    idleTimeoutInMinutes: 10
    publicIpAddresses: [
      {
        id: natGatewayPublicIp.id
      }
    ]
  }
}

// =============================================================================
// Virtual Network
// =============================================================================

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: 'snet-appgw'
        properties: {
          addressPrefix: appGatewaySubnetPrefix
          privateEndpointNetworkPolicies: 'Enabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'snet-appservice'
        properties: {
          addressPrefix: appServiceSubnetPrefix
          privateEndpointNetworkPolicies: 'Enabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
          natGateway: {
            id: natGateway.id
          }
          delegations: [
            {
              name: 'Microsoft.Web.serverFarms'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'snet-privateendpoint'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Enabled'
        }
      }
    ]
  }
}

// =============================================================================
// Private DNS Zones
// =============================================================================

// App Service Private DNS Zone
resource appServicePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
  tags: tags
}

resource appServicePrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: appServicePrivateDnsZone
  name: 'link-${vnetName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Cosmos DB Private DNS Zone (MongoDB vCore)
resource cosmosPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.mongocluster.cosmos.azure.com'
  location: 'global'
  tags: tags
}

resource cosmosPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cosmosPrivateDnsZone
  name: 'link-${vnetName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// Key Vault Private DNS Zone
resource keyVaultPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

resource keyVaultPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: keyVaultPrivateDnsZone
  name: 'link-${vnetName}'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

// =============================================================================
// Outputs
// =============================================================================

output vnetId string = vnet.id
output vnetName string = vnet.name

output appGatewaySubnetId string = vnet.properties.subnets[0].id
output appServiceSubnetId string = vnet.properties.subnets[1].id
output privateEndpointSubnetId string = vnet.properties.subnets[2].id

output appServicePrivateDnsZoneId string = appServicePrivateDnsZone.id
output cosmosPrivateDnsZoneId string = cosmosPrivateDnsZone.id
output keyVaultPrivateDnsZoneId string = keyVaultPrivateDnsZone.id

output natGatewayId string = natGateway.id
output natGatewayPublicIp string = natGatewayPublicIp.properties.ipAddress
