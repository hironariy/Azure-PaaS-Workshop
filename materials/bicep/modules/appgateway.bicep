// =============================================================================
// Application Gateway Module - WAF v2 with backend to App Service Private Endpoint
// =============================================================================
// This module creates:
// - Application Gateway with WAF v2 SKU
// - WAF Policy with OWASP 3.2 rules
// - Backend pool pointing to App Service via Private Endpoint
// - HTTPS listener with self-signed certificate
// - HTTP to HTTPS redirect
//
// Self-Signed Certificate Approach (Workshop):
//   - Certificate generated via script (OpenSSL) and uploaded as PFX
//   - Browser shows certificate warning (expected, students click "Proceed")
//   - Entra ID OAuth2.0 works with self-signed HTTPS redirect URIs
//   - Trade-off: Browser warning vs. HTTP-only insecure patterns
// =============================================================================

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

@description('Unique suffix for globally unique resource names')
param uniqueSuffix string

@description('Subnet ID for Application Gateway')
param appGatewaySubnetId string

@description('App Service default hostname (resolved via Private DNS Zone to Private Endpoint)')
param appServiceHostName string

@description('Self-signed SSL certificate in PFX format (base64 encoded)')
@secure()
param sslCertificateData string = ''

@description('Password for the PFX certificate')
@secure()
param sslCertificatePassword string = ''

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

// SSL configuration check
var sslConfigured = !empty(sslCertificateData) && !empty(sslCertificatePassword)

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
      // DNS label must be globally unique within the region
      domainNameLabel: '${baseName}-${uniqueSuffix}-api'
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
    // SSL certificates (only if configured)
    sslCertificates: sslConfigured ? [
      {
        name: 'ssl-cert-workshop'
        properties: {
          data: sslCertificateData
          password: sslCertificatePassword
        }
      }
    ] : []
    backendAddressPools: [
      {
        name: 'appServiceBackendPool'
        properties: {
          backendAddresses: [
            {
              // Use public hostname - Private DNS Zone resolves this to Private Endpoint IP
              fqdn: appServiceHostName
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
          pickHostNameFromBackendAddress: true  // Now safe - backend uses public hostname matching TLS cert
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
          pickHostNameFromBackendHttpSettings: true  // Now safe - picks public hostname
          minServers: 0
          match: {
            statusCodes: [
              '200-399'
            ]
          }
        }
      }
    ]
    httpListeners: concat(
      // HTTP listener (for redirect to HTTPS or fallback)
      [
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
      ],
      // HTTPS listener (only if SSL is configured)
      sslConfigured ? [
        {
          name: 'httpsListener'
          properties: {
            frontendIPConfiguration: {
              id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGatewayName, 'appGatewayFrontendIp')
            }
            frontendPort: {
              id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'port_443')
            }
            protocol: 'Https'
            sslCertificate: {
              id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', appGatewayName, 'ssl-cert-workshop')
            }
          }
        }
      ] : []
    )
    // Redirect configurations (HTTP → HTTPS)
    redirectConfigurations: sslConfigured ? [
      {
        name: 'httpToHttpsRedirect'
        properties: {
          redirectType: 'Permanent'  // 301 redirect
          targetListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
          }
          includePath: true
          includeQueryString: true
        }
      }
    ] : []
    // Request routing rules
    requestRoutingRules: concat(
      // HTTP rule (redirect to HTTPS if SSL configured, otherwise route to backend)
      [
        {
          name: 'httpRule'
          properties: {
            priority: 200
            ruleType: 'Basic'
            httpListener: {
              id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpListener')
            }
            // If SSL configured: redirect to HTTPS; otherwise: route to backend
            redirectConfiguration: sslConfigured ? {
              id: resourceId('Microsoft.Network/applicationGateways/redirectConfigurations', appGatewayName, 'httpToHttpsRedirect')
            } : null
            backendAddressPool: !sslConfigured ? {
              id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGatewayName, 'appServiceBackendPool')
            } : null
            backendHttpSettings: !sslConfigured ? {
              id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGatewayName, 'appServiceHttpSettings')
            } : null
          }
        }
      ],
      // HTTPS rule (only if SSL configured)
      sslConfigured ? [
        {
          name: 'httpsRule'
          properties: {
            priority: 100
            ruleType: 'Basic'
            httpListener: {
              id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
            }
            backendAddressPool: {
              id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGatewayName, 'appServiceBackendPool')
            }
            backendHttpSettings: {
              id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGatewayName, 'appServiceHttpSettings')
            }
          }
        }
      ] : []
    )
  }
}

// =============================================================================
// Outputs
// =============================================================================

output appGatewayId string = appGateway.id
output appGatewayName string = appGateway.name
output appGatewayPublicIp string = appGatewayPublicIp.properties.ipAddress
output appGatewayFqdn string = appGatewayPublicIp.properties.dnsSettings.fqdn
output appGatewayUrl string = sslConfigured ? 'https://${appGatewayPublicIp.properties.dnsSettings.fqdn}' : 'http://${appGatewayPublicIp.properties.dnsSettings.fqdn}'
output wafPolicyId string = wafPolicy.id
output sslEnabled bool = sslConfigured
