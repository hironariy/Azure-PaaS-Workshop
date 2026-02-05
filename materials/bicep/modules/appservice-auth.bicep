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
// - azureStaticWebApps identity provider: Required for SWA Linked Backend to work
// =============================================================================

@description('App Service name to configure')
param appServiceName string

@description('Microsoft Entra ID Tenant ID')
param entraTenantId string

@description('Microsoft Entra ID Backend Client ID')
param entraBackendClientId string

@description('Static Web App default hostname (for SWA linked backend identity provider)')
param staticWebAppDefaultHostName string

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
// 4. Configures Azure Static Web Apps provider (REQUIRED for Linked Backend)
//
// CRITICAL: The azureStaticWebApps identity provider MUST be included.
// SWA Linked Backend automatically adds this provider, but when we override
// authsettingsV2, we must explicitly include it or SWA routing will fail.
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
      // CRITICAL: Exclude endpoints that allow anonymous access
      // - /health, /api/health: Deployment health checks
      // - /robots933456.txt: Azure container readiness checks
      // - /api/posts: Public read access (GET only - EasyAuth doesn't support per-method)
      // - /api/posts/*: Public read access for individual posts
      excludedPaths: [
        '/health'
        '/api/health'
        '/robots933456.txt'
        '/api/posts'
        '/api/posts/*'
      ]
    }
    identityProviders: {
      // Azure Active Directory (Entra ID) - for direct API calls with bearer tokens
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
      // Azure Static Web Apps - REQUIRED for SWA Linked Backend routing
      // This allows requests proxied through SWA to access the backend
      // Without this, SWA's /api/* proxy will receive 401 Unauthorized
      azureStaticWebApps: {
        enabled: true
        registration: {
          // Must match SWA default hostname
          clientId: staticWebAppDefaultHostName
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
