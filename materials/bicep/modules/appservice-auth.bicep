// =============================================================================
// App Service EasyAuth Configuration Module
// =============================================================================
// This module configures EasyAuth (Authentication/Authorization) for App Service.
// 
// IMPORTANT: This module should be deployed AFTER the SWA Linked Backend is created
// because the Linked Backend automatically configures EasyAuth with default settings
// (RedirectToLoginPage). This module overrides those settings with the correct
// configuration for API backends (Return401).
//
// Key Configuration:
// - unauthenticatedClientAction: 'Return401' - Required for APIs (not redirects)
// - excludedPaths: ['/health', '/robots933456.txt'] - For deployment health checks
// =============================================================================

@description('App Service name to configure')
param appServiceName string

@description('Microsoft Entra ID Tenant ID')
param entraTenantId string

@description('Microsoft Entra ID Backend Client ID')
param entraBackendClientId string

// =============================================================================
// Reference existing App Service
// =============================================================================

resource appService 'Microsoft.Web/sites@2024-04-01' existing = {
  name: appServiceName
}

// =============================================================================
// EasyAuth Configuration
// =============================================================================
// This configuration:
// 1. Returns 401 for unauthenticated requests (correct for APIs)
// 2. Excludes /health from auth (required for deployment health checks)
// 3. Configures Entra ID as the identity provider
//
// Note: SWA Linked Backend will also add "Azure Static Web Apps (Linked)" as
// an identity provider, which allows requests proxied through SWA.
// =============================================================================

resource authSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: appService
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      requireAuthentication: true
      // CRITICAL: Must be Return401 for APIs, not RedirectToLoginPage
      unauthenticatedClientAction: 'Return401'
      // CRITICAL: Exclude health endpoint from auth for deployment health checks
      // /robots933456.txt is used by Azure for container readiness checks
      excludedPaths: [
        '/health'
        '/robots933456.txt'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraBackendClientId
          openIdIssuer: 'https://sts.windows.net/${entraTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            'api://${entraBackendClientId}'
          ]
        }
      }
    }
    login: {
      tokenStore: {
        enabled: false
      }
    }
  }
}

// =============================================================================
// Outputs
// =============================================================================

output authSettingsConfigured bool = true
