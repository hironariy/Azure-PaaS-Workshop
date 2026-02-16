using 'main.bicep'

// =============================================================================
// FastPath Parameters Template (Production / Staging)
// =============================================================================
// Purpose:
// - Container-based App Service deployment with prebuilt image
// - Keeps infrastructure behavior consistent with main.bicepparam style
// =============================================================================

param environment = 'prod'
param location = 'japaneast'
param baseName = 'blogapp'
param groupId = ''

// Mode switch (must stay as fastpath-container for this template)
param deploymentMode = 'fastpath-container'

// REQUIRED: use digest-pinned image in production
param appServiceContainerImage = 'docker.io/hironariy/azure-paas-workshop-backend@sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964'

// Microsoft Entra ID (Azure AD)
param entraTenantId = '<your-tenant-id>'
param entraBackendClientId = '<backend-app-id>'
param entraFrontendClientId = '<frontend-app-id>'

// Cosmos DB admin password
param cosmosDbAdminPassword = '<your-secure-password>'

// Optional sizing
param appServiceSku = 'B1'
param cosmosDbTier = 'M30'
param cosmosDbEnableHa = false

// SWA is deployed in fastpath-container mode as well (for full blog app resources)
// Keep Standard to enable SWA Linked Backend feature
param staticWebAppSku = 'Standard'
param staticWebAppLocation = 'eastasia'
