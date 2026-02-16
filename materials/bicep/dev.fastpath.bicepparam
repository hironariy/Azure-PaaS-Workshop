using 'main.bicep'

// =============================================================================
// FastPath Parameters Template (Development)
// =============================================================================
// Purpose:
// - Windows Fast Path (PowerShell / no WSL2)
// - App Service for Linux container with prebuilt public image
//
// Usage:
// 1) Copy to your local gitignored file:
//    cp dev.fastpath.bicepparam dev.fastpath.local.bicepparam
// 2) Fill placeholders below
// 3) Deploy:
//    az deployment group create \
//      --resource-group <Resource-Group-Name> \
//      --template-file main.bicep \
//      --parameters dev.fastpath.local.bicepparam
// =============================================================================

param location = 'japaneast'
param environment = 'dev'
param baseName = 'blogapp'
param groupId = ''

// Mode switch (must stay as fastpath-container for this template)
param deploymentMode = 'fastpath-container'

// REQUIRED: immutable image reference is strongly recommended
// Example: 'docker.io/your-org/blogapp-api@sha256:xxxxxxxx...'
param appServiceContainerImage = 'docker.io/hironariy/azure-paas-workshop-backend@sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964'

// Microsoft Entra configuration
param entraTenantId = '<your-tenant-id>'
param entraBackendClientId = '<backend-api-client-id>'
param entraFrontendClientId = '<frontend-spa-client-id>'

// Cosmos DB admin password (used by Cosmos DB module)
param cosmosDbAdminPassword = '<strong-password>'

// Cost-optimized defaults for dev
param appServiceSku = 'B1'
param cosmosDbTier = 'M25'
param cosmosDbEnableHa = false

// SWA is deployed in fastpath-container mode as well (for full blog app resources)
// Keep Standard to enable SWA Linked Backend feature
param staticWebAppSku = 'Standard'
param staticWebAppLocation = 'eastasia'
