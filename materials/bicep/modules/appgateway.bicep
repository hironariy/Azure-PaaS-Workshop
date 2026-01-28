// =============================================================================
// Application Gateway Module - WAF v2 with backend to App Service Private Endpoint
// =============================================================================
// This module creates:
// - Application Gateway with WAF v2 SKU
// - WAF Policy with OWASP 3.2 rules
// - Backend pool pointing to App Service via Private Endpoint
// - SSL certificate (managed or custom)
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Subnet ID for Application Gateway')
param appGatewaySubnetId string

@description('App Service FQDN (private link)')
param appServicePrivateLinkFqdn string

@description('Minimum capacity for autoscale')
@minValue(1)
@maxValue(10)
param minCapacity int = 1

@description('Maximum capacity for autoscale')
@minValue(2)
@maxValue(10)
param maxCapacity int = 2

@description('Tags to apply to all resources')
param tags object = {}

// =============================================================================
// Variables
// =============================================================================

var appGatewayName = 'agw-${baseName}-${environment}'
var appGatewayPipName = 'pip-agw-${baseName}-${environment}'
var wafPolicyName = 'waf-${baseName}-${environment}'

// =============================================================================
// Public IP for Application Gateway
// =============================================================================

resource appGatewayPublicIp 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: appGatewayPipName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    publicIPAddressVersion: 'IPv4'
    dnsSettings: {
      domainNameLabel: '${baseName}-${environment}-api'
    }
  }
}

// =============================================================================
// WAF Policy
// =============================================================================

resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2023-09-01' = {
  name: wafPolicyName
  location: location
  tags: tags
  properties: {
    policySettings: {
      mode: 'Prevention'
      state: 'Enabled'
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
      fileUploadLimitInMb: 100
      requestBodyInspectLimitInKB: 128
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
          ruleGroupOverrides: []
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleGroupOverrides: []
        }
      ]
      exclusions: []
    }
    customRules: []
  }
}

// =============================================================================
// Application Gateway
// =============================================================================

resource appGateway 'Microsoft.Network/applicationGateways@2023-09-01' = {
  name: appGatewayName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'WAF_v2'
      tier: 'WAF_v2'
    }
    autoscaleConfiguration: {
      minCapacity: minCapacity
      maxCapacity: maxCapacity
    }
    enableHttp2: true
    firewallPolicy: {
      id: wafPolicy.id
    }
    gatewayIPConfigurations: [
      {
        name: 'appGatewayIpConfig'
        properties: {
          subnet: {
            id: appGatewaySubnetId
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'appGatewayFrontendIp'
        properties: {
          publicIPAddress: {
            id: appGatewayPublicIp.id
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'port_80'
        properties: {
          port: 80
        }
      }
      {
        name: 'port_443'
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: 'appServiceBackendPool'
        properties: {
          backendAddresses: [
            {
              fqdn: appServicePrivateLinkFqdn
            }
          ]
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'appServiceHttpSettings'
        properties: {
          port: 443
          protocol: 'Https'
          cookieBasedAffinity: 'Disabled'
          pickHostNameFromBackendAddress: true
          requestTimeout: 30
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', appGatewayName, 'appServiceHealthProbe')
          }
        }
      }
    ]
    probes: [
      {
        name: 'appServiceHealthProbe'
        properties: {
          protocol: 'Https'
          path: '/health'
          interval: 30
          timeout: 30
          unhealthyThreshold: 3
          pickHostNameFromBackendHttpSettings: true
          minServers: 0
          match: {
            statusCodes: [
              '200-399'
            ]
          }
        }
      }
    ]
    httpListeners: [
      {
        name: 'httpListener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGatewayName, 'appGatewayFrontendIp')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'port_80')
          }
          protocol: 'Http'
        }
      }
    ]
    redirectConfigurations: []
    requestRoutingRules: [
      {
        name: 'httpToBackendRule'
        properties: {
          priority: 100
          ruleType: 'Basic'
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpListener')
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGatewayName, 'appServiceBackendPool')
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGatewayName, 'appServiceHttpSettings')
          }
        }
      }
    ]
  }
}

// =============================================================================
// Outputs
// =============================================================================

output appGatewayId string = appGateway.id
output appGatewayName string = appGateway.name
output appGatewayPublicIp string = appGatewayPublicIp.properties.ipAddress
output appGatewayFqdn string = appGatewayPublicIp.properties.dnsSettings.fqdn
output wafPolicyId string = wafPolicy.id
