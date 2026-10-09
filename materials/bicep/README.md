# Azure PaaS Workshop - Bicep Templates

This directory contains Infrastructure as Code (IaC) templates for deploying the Azure PaaS Workshop environment.

The executable learner path is the [Japanese Cloud Shell guide](../docs/learner/cloud-shell-quickstart.ja.md).
Use its JSON state, private parameter file, exact subscription targets and
safe deployment/cleanup scripts. Local development and container FastPath are
alternatives, not learner prerequisites.

## Architecture Overview

```
Browser -> SWA Standard -> /api/* linked backend -> App Service B1 (public HTTPS)
                                                   |
                                          outbound VNet integration
                                           /                 \
                         DocumentDB private endpoint     Key Vault private endpoint
                         M25, one shard, HA=false        MI + Secrets User RBAC
                                                   |
                                         NAT / App Insights / Log Analytics
```

VNet integration is **outbound**, not an inbound App Service private endpoint.
Public reads/health and protected writes have different EasyAuth/application
rules; Entra authentication is not a replacement for WAF. App Gateway is not
deployed by `main.bicep`. DocumentDB private endpoints/DNS are configured; the
pinned `2024-02-15-preview` cluster API has no `publicNetworkAccess` property,
so inspect actual network/firewall behavior rather than claiming this template
sets it to Disabled.

## Module Structure

```
modules/
├── network.bicep       # VNet, Subnets, NAT Gateway, Private DNS Zones
├── monitoring.bicep    # Log Analytics, Application Insights
├── keyvault.bicep      # Key Vault with Private Endpoint
├── keyvault-rbac.bicep # Role assignment to the existing vault only
├── cosmosdb.bicep      # Cosmos DB for MongoDB vCore with Private Endpoint
├── appservice.bicep    # Public App Service with outbound VNet Integration
├── appservice-auth.bicep # EasyAuth after SWA Linked Backend
└── staticwebapp.bicep  # Azure Static Web Apps
```

`keyvault.bicep` is the sole writer of the vault, its endpoint and DNS group.
`keyvault-rbac.bicep` references that vault after App Service creates its MI.
The vault-scoped Secrets User role and deterministic GUID remain unchanged;
moving the assignment does not remove its permission prerequisite. Existing
resource names and secret references are unchanged. Repeated live deployments
are still an acceptance check, not proven by local compilation.

## Prerequisites

- Azure CLI installed and logged in
- Resource Group created
- Microsoft Entra ID App Registrations created:
  - Backend API (server application)
  - Frontend SPA (public client)

### Permission boundary before creating resources

**Contributor-only, with no organizer preparation, cannot complete the current
fresh deployment.** `modules/keyvault-rbac.bicep` creates a Key Vault Secrets User
assignment for App Service's Managed Identity. This requires
`Microsoft.Authorization/roleAssignments/write`, which Contributor excludes.
Resource management, permission assignment, Key Vault secret access, and Entra
registration/consent are different authorization planes.

After selecting and verifying the intended subscription and tenant, run the
read-only check **from the repository root** with Node.js 24:

```bash
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
RESOURCE_GROUP="rg-paasworkshop-dev" # Match your intended deployment group

node scripts/check-role-assignment-permission.cjs \
  "$SUBSCRIPTION_ID" "$TENANT_ID" "$RESOURCE_GROUP" || exit "$?"
```

Exit `3` means the required action is not reported at the checked scope.
Exit `1` means the check failed (context/API/response error), not permission
denial or success. Exit `0` checks only this reported management action, not
deny/role conditions, policy, region/quota, Entra consent, or data-plane access.
Absent groups are checked at their parent subscription; resource-specific
permissions on existing infrastructure require separate review.

Do not skip the required assignment, turn off Key Vault RBAC, switch to access
policies, or expose secrets as a workaround. A separately authorized
administrator deployment can verify the infrastructure, but cannot establish
Contributor-only success. See the [learner prerequisites](../docs/learner/day-0-prerequisites.ja.md)
and [Key Vault RBAC documentation](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide).

## Quick Start

### 1. Create Resource Group

```bash
# For single-group workshops
az group create --name rg-paasworkshop-dev --location japaneast

# For multi-group workshops (use your assigned group letter A-J)
az group create --name rg-blogapp-A-workshop --location japaneast
```

### 2. Configure Parameters

**Option A: Alternative M30 sizing (not a production-readiness guarantee)**
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

param appServiceSku = 'B1'
param cosmosDbTier = 'M25'
param cosmosDbEnableHa = false
param staticWebAppSku = 'Standard'
```

**Mode guidance:**
- `standard`: Existing workshop flow (App Service code deployment + SWA linked backend)
- `fastpath-container`: App Service for Linux container mode; SWA Standard and Linked Backend are still deployed

Example for FastPath mode:
```bicep
param deploymentMode = 'fastpath-container'
param appServiceContainerImage = 'docker.io/your-org/blogapp-api@sha256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

If you use Option C templates, these values are already preconfigured in the file and you only need to fill placeholders.

### 3. Verify the baseline and prerequisites

SWA Standard is mandatory for the linked backend; Free is rejected by the
orchestrator instead of silently creating a frontend with no API link.
B1 has no deployment slots or zone redundancy. M25 is Dev/Test without HA;
M30+ cannot be scaled back to M25. Neither `environment = 'prod'` nor M30
alone enables HA. Review RBAC, consent, provider/region, subscription quota,
tier eligibility and physical capacity before any paid operation.

**Existing deployment compatibility:** if an existing cluster used the former
implicit M30 default, preserve `param cosmosDbTier = 'M30'` explicitly (or its
actual current tier) before redeployment. The new fresh-baseline M25 default
is not a migration/downgrade command. Review parameter changes and current
resources first; do not reset existing parameters to a new template.

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
  --query properties.outputs.staticWebAppUrl.value -o tsv
```

## Post-Deployment Steps

Follow the learner [infrastructure output/redirect steps](../docs/learner/day-1-deploy-infrastructure.ja.md),
[backend deployment](../docs/learner/day-1-deploy-backend.ja.md),
[frontend deployment](../docs/learner/day-1-deploy-frontend.ja.md) and
[validation](../docs/learner/day-1-validation.ja.md).
The Frontend MSAL redirect is the SWA **origin**, not an EasyAuth callback.
`/api` is routed by the Standard linked backend; no App Gateway URL rewrite is
needed. Public runtime IDs are injected into the built frontend, while the
SWA deployment token stays in the deployment process environment and is not
printed or committed. GitHub Actions setup is an optional separate path.

## Resource Naming Convention

| Resource Type | Pattern | Example |
|--------------|---------|---------|
| Resource Group | From saved learner state | `rg-blogapp-A-paas-workshop` |
| Virtual Network | `vnet-{baseName}-{env}` | `vnet-blogapp-dev` |
| App Service Plan | `asp-{baseName}-{uniqueSuffix}` | Use deployment outputs |
| App Service | `app-{baseName}-{uniqueSuffix}` | Use actual default hostname |
| Cosmos DB | `cosmos-{baseName}-{uniqueSuffix}` | Use deployment outputs |
| Key Vault | `kv-{baseName}-{uniqueSuffix}` | Use deployment outputs |
| Static Web Apps | `swa-{baseName}-{uniqueSuffix}` | Use actual default hostname |
| NAT Gateway | `nat-{baseName}-{env}` | `nat-blogapp-dev` |
| Private Endpoint | `pe-{service}-{baseName}-{uniqueSuffix}` | DB / Key Vault only |

## Estimate costs for the actual baseline

Do not reuse an undated fixed USD/month total. Use the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/)
with the selected regions, currency, quote date and billable duration. Include
SWA **Standard**, App Service B1, DocumentDB M25 + 128 GiB storage, Key Vault
operations, two private endpoints, NAT gateway + public IP + processed data,
and App Insights/Log Analytics ingestion and retention. App Gateway is absent.
SWA uses its own supported region, not necessarily Japan East.

Fixed fees/minimum billing, deployment/warm-up/cleanup time, data transfer,
tax and subscription offers prevent a monthly-total/730 shortcut from
guaranteeing a four-hour price. Stopping the app does not delete the plan,
database, NAT or other billable infrastructure.

## Maintain the compiled ARM artifact

`main.json` is distributed and must match `main.bicep`. Use Bicep **0.44.1**,
the version pinned by the app/Bicep quality workflow, from the repository root:

```bash
az bicep version
az bicep build --file materials/bicep/main.bicep --outfile materials/bicep/main.json
git diff -- materials/bicep/main.json
node --test scripts/test/bicep-contract.test.cjs
```

Review the generated diff and commit source and ARM together. Compilation and
native contract tests do not prove deployment permissions or cloud readiness.

## Cleanup

Use the [state-scoped cleanup guide](../docs/learner/cleanup.ja.md), which
checks ownership and waits for actual absence before removing Entra apps.
`--no-wait` acceptance is not deletion completion.

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

2. **Do not use F1 as a baseline workaround:** it is not allowed by the
   template and does not provide the required VNet integration.

3. **Consider Standard Tier only with verified quota, cost and approval:**
   - Edit `dev.local.bicepparam` and change:
     ```bicep
     param appServiceSku = 'S1'  // Standard tier (~$73/month)
     ```

### Deployment Fails with "Key Vault not found"

The Key Vault module needs to complete before Cosmos DB can store secrets. The deployment handles dependencies automatically, but if you see this error, try deploying again.

### App Service Can't Access Key Vault

Ensure the App Service Managed Identity has the `Key Vault Secrets User` role on the Key Vault. The template handles this via RBAC.

### SWA linked API is unhealthy

1. Check that the App Service health endpoint (`/health`) returns 200 OK
2. Verify the Private DNS Zone is correctly linked to the VNet
3. Verify the Standard linked backend, EasyAuth, startup and DB readiness separately

### GitHub Actions Can't Deploy to App Service

Ensure SCM site allows public access:
- Baseline main/SCM defaults are public Allow, so `scmIpSecurityRestrictionsUseMain` is `true`
- `scmIpSecurityRestrictionsDefaultAction` should be `Allow`

## References

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Cosmos DB for MongoDB vCore](https://docs.microsoft.com/azure/cosmos-db/mongodb/vcore/)
- [Private Endpoints](https://docs.microsoft.com/azure/private-link/private-endpoint-overview)
