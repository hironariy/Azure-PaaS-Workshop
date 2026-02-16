# Azure PaaS Workshop - Bicep Templates

This directory contains Infrastructure as Code (IaC) templates for deploying the Azure PaaS Workshop environment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────────────┐
│  Static Web Apps    │            │  Application Gateway + WAF v2   │
│  (React Frontend)   │            │  (Public IP)                    │
└─────────────────────┘            └─────────────────────────────────┘
                                               │
                                               ▼ (via Private Endpoint)
                            ┌─────────────────────────────────────────────┐
                            │              Virtual Network                 │
                            │                                             │
                            │  ┌──────────────────────────────────────┐   │
                            │  │  App Service (Node.js 22 LTS)        │   │
                            │  │  + VNet Integration (outbound)       │   │
                            │  │  + Private Endpoint (inbound)        │   │
                            │  └──────────────────────────────────────┘   │
                            │           │              │          │       │
                            │           ▼              ▼          ▼       │
                            │  ┌────────────┐  ┌────────────┐  ┌──────┐  │
                            │  │ Cosmos DB  │  │ Key Vault  │  │ NAT  │  │
                            │  │ (MongoDB)  │  │ (Secrets)  │  │ GW   │──┼──→ Internet
                            │  │ Private EP │  │ Private EP │  └──────┘  │   (App Insights)
                            │  └────────────┘  └────────────┘            │
                            └─────────────────────────────────────────────┘
```

## Module Structure

```
modules/
├── network.bicep       # VNet, Subnets, NAT Gateway, Private DNS Zones
├── monitoring.bicep    # Log Analytics, Application Insights
├── keyvault.bicep      # Key Vault with Private Endpoint
├── cosmosdb.bicep      # Cosmos DB for MongoDB vCore with Private Endpoint
├── appservice.bicep    # App Service with VNet Integration & Private Endpoint
├── appgateway.bicep    # Application Gateway WAF v2
└── staticwebapp.bicep  # Azure Static Web Apps
```

## Prerequisites

- Azure CLI installed and logged in
- Resource Group created
- Microsoft Entra ID App Registrations created:
  - Backend API (server application)
  - Frontend SPA (public client)

## Quick Start

### 1. Create Resource Group

```bash
# For single-group workshops
az group create --name rg-paasworkshop-dev --location japaneast

# For multi-group workshops (use your assigned group letter A-J)
az group create --name rg-blogapp-A-workshop --location japaneast
```

### 2. Configure Parameters

**Option A: Full deployment (production-like)**
```bash
cp main.bicepparam main.local.bicepparam
```

**Option B: Cost-optimized deployment (development/testing)**
```bash
cp dev.bicepparam main.local.bicepparam
```

**Option C: FastPath container deployment (Windows-first, prebuilt image)**
```bash
cp dev.fastpath.bicepparam dev.fastpath.local.bicepparam
# or production baseline
cp main.fastpath.bicepparam main.fastpath.local.bicepparam
```

Edit `main.local.bicepparam` with your values:

```bicep
using 'main.bicep'

param environment = 'dev'
param location = 'japaneast'
param baseName = 'blogapp'
param deploymentMode = 'standard' // 'standard' | 'fastpath-container'
param appServiceContainerImage = '' // Required only for fastpath-container
param groupId = ''  // Set to 'A'-'J' for multi-group workshops
param entraTenantId = '<your-tenant-id>'
param entraBackendClientId = '<your-backend-app-id>'
param entraFrontendClientId = '<your-frontend-app-id>'
param cosmosDbAdminPassword = '<strong-password>'

// Optional: SSL certificate for HTTPS (recommended)
// param sslCertificateData = '<base64-encoded-pfx>'
// param sslCertificatePassword = 'Workshop2024!'
```

**Mode guidance:**
- `standard`: Existing workshop flow (App Service code deployment + SWA linked backend)
- `fastpath-container`: App Service for Linux container mode (prebuilt image, no SWA linked backend deployment)

Example for FastPath mode:
```bicep
param deploymentMode = 'fastpath-container'
param appServiceContainerImage = 'docker.io/your-org/blogapp-api@sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

If you use Option C templates, these values are already preconfigured in the file and you only need to fill placeholders.

### 3. (Optional) Generate SSL Certificate for HTTPS

For HTTPS support on Application Gateway, generate a self-signed certificate:

```bash
# Generate certificate
./scripts/generate-ssl-cert.sh

# Add to your .local.bicepparam file:
param sslCertificateData = '<paste contents of cert-base64.txt>'
param sslCertificatePassword = 'Workshop2024!'
```

**Note:** Self-signed certificates cause browser warnings. This is expected for workshop purposes.
If you skip this step, Application Gateway will serve HTTP only (port 80).

### 4. Deploy

```bash
az deployment group create \
  --resource-group rg-paasworkshop-dev \
  --template-file main.bicep \
  --parameters main.local.bicepparam
```

### 5. Get Outputs

```bash
# Get all outputs
az deployment group show \
  --resource-group rg-paasworkshop-dev \
  --name main \
  --query properties.outputs

# Get specific outputs
az deployment group show \
  --resource-group rg-paasworkshop-dev \
  --name main \
  --query properties.outputs.appGatewayFqdn.value -o tsv
```

## Post-Deployment Steps

### 1. Get Static Web Apps Deployment Token

```bash
SWA_NAME=$(az deployment group show -g rg-paasworkshop-dev -n main --query properties.outputs.staticWebAppName.value -o tsv)
az staticwebapp secrets list --name $SWA_NAME --query "properties.apiKey" -o tsv
```

### 2. Configure GitHub Secrets

Add to your GitHub repository secrets:
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Token from step 1

### 3. Update Entra ID Redirect URIs

Add redirect URI to your Frontend App Registration:
```
https://<swa-url>/.auth/login/aad/callback
```

### 4. Update Frontend Configuration

Update `materials/frontend/staticwebapp.config.json` with the Application Gateway URL:
```json
{
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://<app-gateway-fqdn>/api/*"
    }
  ]
}
```

## Resource Naming Convention

| Resource Type | Pattern | Example |
|--------------|---------|---------|
| Resource Group | `rg-{baseName}-{env}` | `rg-blogapp-dev` |
| Virtual Network | `vnet-{baseName}-{env}` | `vnet-blogapp-dev` |
| App Service Plan | `asp-{baseName}-{env}` | `asp-blogapp-dev` |
| App Service | `app-{baseName}-{env}` | `app-blogapp-dev` |
| Cosmos DB | `cosmos-{baseName}-{env}` | `cosmos-blogapp-dev` |
| Key Vault | `kv-{baseName}-{env}` | `kv-blogapp-dev` |
| Application Gateway | `agw-{baseName}-{env}` | `agw-blogapp-dev` |
| Static Web Apps | `swa-{baseName}-{env}` | `swa-blogapp-dev` |
| NAT Gateway | `nat-{baseName}-{env}` | `nat-blogapp-dev` |
| Private Endpoint | `pe-{service}-{baseName}` | `pe-appservice-blogapp` |

## Estimated Costs (Japan East)

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| Static Web Apps | Free | $0 |
| App Service | B1 | ~$13 |
| Cosmos DB vCore | M30 | ~$200 |
| Application Gateway | WAF_v2 (1 instance) | ~$250 |
| Key Vault | Standard | ~$1 |
| NAT Gateway | Standard | ~$45 |
| VNet / Private Endpoints | - | ~$10 |
| **Total** | | **~$520/month** |

## Cleanup

Delete all resources:

```bash
az group delete --name rg-paasworkshop-dev --yes --no-wait
```

## Troubleshooting

### App Service Quota Error (InternalSubscriptionIsOverQuotaForSku)

If you see an error like:
```
InternalSubscriptionIsOverQuotaForSku: Operation cannot be completed without additional quota.
Current Limit (Basic VMs): 0
```

**Cause:** Your subscription has insufficient quota for the App Service tier (B1 uses Basic tier VMs).

**Solutions:**

1. **Request Quota Increase (Recommended for workshop):**
   - Go to Azure Portal > Subscriptions > Your Subscription > Usage + quotas
   - Filter by "App Service"
   - Request increase for "Basic vCPUs" in your region
   - Or visit: https://aka.ms/antquotahelp

2. **Use Free Tier (Temporary workaround):**
   - Edit `dev.local.bicepparam` and change:
     ```bicep
     param appServiceSku = 'F1'  // Free tier
     ```
   - **Note:** F1 has limitations (60 min/day CPU, no VNet integration, no custom domains)

3. **Use Standard Tier (If you have S1 quota but not B1):**
   - Edit `dev.local.bicepparam` and change:
     ```bicep
     param appServiceSku = 'S1'  // Standard tier (~$73/month)
     ```

### Deployment Fails with "Key Vault not found"

The Key Vault module needs to complete before Cosmos DB can store secrets. The deployment handles dependencies automatically, but if you see this error, try deploying again.

### App Service Can't Access Key Vault

Ensure the App Service Managed Identity has the `Key Vault Secrets User` role on the Key Vault. The template handles this via RBAC.

### Application Gateway Shows Unhealthy Backend

1. Check that the App Service health endpoint (`/health`) returns 200 OK
2. Verify the Private DNS Zone is correctly linked to the VNet
3. Check NSG rules aren't blocking traffic

### GitHub Actions Can't Deploy to App Service

Ensure SCM site allows public access:
- `scmIpSecurityRestrictionsUseMain` should be `false`
- `scmIpSecurityRestrictionsDefaultAction` should be `Allow`

## References

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB for MongoDB vCore](https://docs.microsoft.com/azure/cosmos-db/mongodb/vcore/)
- [Application Gateway WAF](https://docs.microsoft.com/azure/web-application-firewall/ag/ag-overview)
- [Private Endpoints](https://docs.microsoft.com/azure/private-link/private-endpoint-overview)
