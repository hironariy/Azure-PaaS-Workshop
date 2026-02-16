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
param appServiceContainerImage = 'docker.io/hironariy/azure-paas-workshop-backend@sha256:78a6d0dd1f0055628b80f5e0cbc0f727a9e4dae8f77d9bc24061c66d1e08fac6'

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
