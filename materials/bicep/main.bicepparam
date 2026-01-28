// =============================================================================
// Bicep Parameters File - Azure PaaS Workshop
// =============================================================================
// This file contains the parameter values for deploying the workshop infrastructure.
// 
// INSTRUCTIONS:
// 1. Copy this file to main.local.bicepparam (which is gitignored)
// 2. Fill in your specific values
// 3. Deploy with: az deployment group create -g <rg-name> -f main.bicep -p main.local.bicepparam
// =============================================================================

using 'main.bicep'

// =============================================================================
// Required Parameters - You MUST configure these
// =============================================================================

// Environment: dev, staging, or prod
param environment = 'dev'

// Azure region (japaneast recommended for this workshop)
param location = 'japaneast'

// Base name for resources (3-15 chars, alphanumeric)
// Example: 'blogapp' → creates 'app-blogapp-dev', 'kv-blogapp-dev', etc.
param baseName = 'blogapp'

// Microsoft Entra ID (Azure AD) Configuration
// Get these from Azure Portal → Microsoft Entra ID → App registrations
param entraTenantId = '<your-tenant-id>'           // e.g., '12345678-1234-1234-1234-123456789012'
param entraBackendClientId = '<backend-app-id>'    // Backend API app registration
param entraFrontendClientId = '<frontend-app-id>'  // Frontend SPA app registration

// Cosmos DB admin password (use a strong password!)
// This will be stored securely in Key Vault
param cosmosDbAdminPassword = '<your-secure-password>'

// =============================================================================
// Optional Parameters - Defaults are suitable for workshop
// =============================================================================

// App Service SKU: B1 (Basic) for workshop, S1+ for production
// B1 = ~$13/month, S1 = ~$73/month (includes deployment slots)
param appServiceSku = 'B1'

// Cosmos DB vCore tier: M30 recommended for workshop
// M25 = ~$100/month, M30 = ~$200/month, M40 = ~$400/month
param cosmosDbTier = 'M30'

// Enable High Availability for Cosmos DB (adds cost)
// false for workshop, true for production
param cosmosDbEnableHa = false

// Static Web Apps SKU: Free for workshop
// Free = $0, Standard = ~$9/month (custom domains, more bandwidth)
param staticWebAppSku = 'Free'

// Application Gateway autoscale capacity
// 1-2 instances for workshop (saves cost when idle)
param appGatewayMinCapacity = 1
param appGatewayMaxCapacity = 2
