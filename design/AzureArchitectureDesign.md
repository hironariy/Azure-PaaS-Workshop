# Azure PaaS Architecture Design

## Overview

This document defines the technical architecture requirements for the Azure PaaS Workshop. This serves as the specification that guides Bicep template creation, documentation, and workshop materials.

**Reference**: This workshop uses the same blog application as the [IaaS Workshop](../iaas/design/AzureArchitectureDesign.md) to enable direct comparison of architectural approaches.

## Target Architecture

### Application Overview
- **Application Type**: Multi-user blog site (same as IaaS Workshop)
- **Architecture Pattern**: PaaS-based 3-tier web application
- **Tiers**: Static Web Apps (Frontend) → App Service (API) → Cosmos DB (Database)
- **Traffic Flow**: 
  - Static assets: Internet → Static Web Apps (global CDN)
  - API calls: Internet → Application Gateway (WAF v2) → App Service → Cosmos DB
- **SSL/TLS**: Managed certificates (SWA built-in, App Gateway for API)
- **HA Strategy**: Built-in PaaS redundancy within region
- **DR Strategy**: Geo-replication options (Cosmos DB, App Service slots)
- **Authentication**: OAuth2.0 with Microsoft Entra ID (same as IaaS)

### Architecture Comparison: IaaS vs PaaS

| Component | IaaS Workshop | PaaS Workshop |
|-----------|---------------|---------------|
| Frontend | NGINX on 2 VMs | Azure Static Web Apps |
| Backend | Express on 2 VMs | Azure App Service |
| Database | MongoDB on 2 VMs | Cosmos DB for MongoDB vCore |
| Load Balancer | Internal LB + App Gateway | App Gateway (API only) |
| WAF | Application Gateway WAF v2 | Application Gateway WAF v2 |
| OS Management | Manual patching required | Fully managed |
| Scaling | Manual VM scaling | Auto-scale rules |

---

## Infrastructure Components

### 1. Frontend Tier: Azure Static Web Apps

#### Why Static Web Apps?

| Consideration | Static Web Apps | App Service (Static) |
|---------------|-----------------|---------------------|
| **Purpose** | Built for SPAs/static sites | General-purpose hosting |
| **Global Distribution** | ✅ Built-in (geographically distributed) | ❌ Requires Azure CDN |
| **Enterprise CDN (118+ edges)** | Optional (Enterprise-grade edge add-on) | Requires Azure Front Door |
| **Free SSL** | ✅ Automatic | ✅ Managed certs |
| **GitHub Integration** | ✅ Native CI/CD | Manual setup |
| **Cost** | Free tier available | Minimum ~$13/month |
| **API Proxy** | ✅ Built-in routing | N/A |

#### Static Web Apps Configuration

**SKU**: Free tier (sufficient for workshop)
- Custom domains: 2
- SSL certificates: Free (auto-provisioned)
- Bandwidth: 100 GB/month
- Build minutes: Included via GitHub Actions

**Deployment Configuration**:
```yaml
# .github/workflows/azure-static-web-apps.yml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/materials/frontend"
          output_location: "dist"
```

**staticwebapp.config.json**:
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.ico", "/*.png", "/*.jpg"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous", "authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad"
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  }
}
```

#### Why No Application Gateway for Static Web Apps?

Static Web Apps does **NOT** require Application Gateway because:

1. **Read-only content**: Static assets cannot be modified by attackers
2. **Built-in DDoS protection**: Azure-level protection included
3. **Global distribution**: Content served from geographically distributed points
4. **Free SSL**: Automatic certificate management
5. **WAF irrelevant**: SQL injection, XSS attacks target APIs, not static files

**Note**: For 118+ edge locations with advanced caching, consider enabling **Enterprise-grade edge** (Azure Front Door integration) as an optional enhancement.

**Cost/Latency Impact of Adding App Gateway to SWA**:
- Additional cost: ~$250/month
- Added latency: +10-50ms per request
- Security benefit: Minimal (static content has no attack surface)

---

### 2. Backend Tier: Azure App Service

#### App Service Plan Configuration

**SKU Selection for Workshop**:

| SKU | vCPU | Memory | Cost/Month | Recommendation |
|-----|------|--------|------------|----------------|
| B1 | 1 | 1.75 GB | ~$13 | ✅ Workshop (cost-optimized) |
| S1 | 1 | 1.75 GB | ~$73 | Auto-scale, deployment slots |
| P1v3 | 2 | 8 GB | ~$138 | Production workloads |

**Workshop Recommendation**: **B1** (Basic tier)
- Sufficient for 20-30 concurrent workshop users
- Cost-effective for learning environment
- Note: No deployment slots (S1+ required)

**Alternative**: **S1** if demonstrating deployment slots is important

#### App Service Configuration

**Runtime Stack**:
- OS: Linux
- Runtime: Node.js 20 LTS
- Startup Command: `npm start` (runs compiled JS)

**App Settings (Environment Variables)**:

| Setting | Value | Description |
|---------|-------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `8080` | App Service default port |
| `COSMOS_CONNECTION_STRING` | `@Microsoft.KeyVault(...)` | Key Vault reference |
| `ENTRA_TENANT_ID` | `<tenant-id>` | Microsoft Entra tenant |
| `ENTRA_CLIENT_ID` | `<client-id>` | Backend API app registration |
| `CORS_ORIGINS` | `https://<swa-url>` | Allowed origins |

**Key Vault Integration**:
```bicep
// App Service can reference Key Vault secrets directly
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=cosmos-connection-string)'
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'  // Managed Identity for Key Vault access
  }
}
```

#### Managed Identity Configuration

**System-assigned Managed Identity**:
- Automatically created with App Service
- Used for accessing Key Vault secrets
- Used for accessing Cosmos DB (optional, connection string alternative)

**RBAC Role Assignments**:

| Resource | Role | Purpose |
|----------|------|---------|
| Key Vault | Key Vault Secrets User | Read connection strings |
| Cosmos DB | (Optional) Cosmos DB Account Reader | Metadata access |

#### Health Checks

**App Service Health Check Configuration**:
```bicep
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  properties: {
    siteConfig: {
      healthCheckPath: '/health'  // Must return 200 OK
    }
  }
}
```

**Health Check Endpoint Requirements**:
- Path: `/health`
- Expected response: `200 OK` with JSON body
- Checks: Database connectivity, memory usage
- Timeout: 10 seconds

#### VNet Integration (Optional but Recommended)

**Purpose**: Secure connectivity to Cosmos DB via Private Endpoint

```bicep
resource appServiceVnetIntegration 'Microsoft.Web/sites/networkConfig@2023-01-01' = {
  parent: appService
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: appServiceSubnet.id
    swiftSupported: true
  }
}
```

**Subnet Requirements**:
- Minimum size: /26 (64 addresses)
- Delegation: `Microsoft.Web/serverFarms`
- Name convention: `snet-appservice-integration`

---

### 3. Database Tier: Azure Cosmos DB for MongoDB vCore

#### Why Cosmos DB for MongoDB vCore?

| Consideration | Cosmos DB vCore | Cosmos DB RU-based | Self-managed MongoDB |
|---------------|-----------------|--------------------|--------------------|
| **MongoDB Compatibility** | High | Partial | Full |
| **Pricing Model** | vCore (predictable) | RU (variable) | VM hours |
| **Mongoose Support** | ✅ Compatible | ⚠️ Some limitations | ✅ Native |
| **Learning Curve** | Familiar | RU concept new | Familiar |
| **Workshop Focus** | ✅ Managed service | Cosmos DB concepts | IaaS patterns |

#### Cluster Configuration

**Cluster Tier for Workshop**:

| Tier | vCores | RAM | Storage | Cost/Month | Recommendation |
|------|--------|-----|---------|------------|----------------|
| M25 | 2 | 8 GB | 32 GB | ~$100 | Minimum viable |
| M30 | 2 | 8 GB | 128 GB | ~$200 | ✅ Workshop recommended |
| M40 | 4 | 16 GB | 128 GB | ~$400 | Production workloads |

**Workshop Recommendation**: **M30**
- Sufficient compute for workshop load
- Reasonable storage for blog data
- Cost-effective for learning

#### Bicep Resource Definition

```bicep
resource cosmosCluster 'Microsoft.DocumentDB/mongoClusters@2024-02-15-preview' = {
  name: cosmosClusterName
  location: location
  properties: {
    administratorLogin: 'blogadmin'
    administratorLoginPassword: cosmosAdminPassword  // @secure() parameter
    serverVersion: '6.0'
    nodeGroupSpecs: [
      {
        kind: 'Shard'
        nodeCount: 1
        sku: 'M30'
        diskSizeGB: 128
        enableHa: true  // High availability within region
      }
    ]
  }
}
```

#### Connection String Pattern

**Format**:
```
mongodb+srv://blogadmin:<password>@<cluster-name>.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000
```

**Key Parameters**:
- `tls=true`: Required for Cosmos DB
- `authMechanism=SCRAM-SHA-256`: Authentication method
- `retrywrites=false`: Cosmos DB limitation
- `maxIdleTimeMS=120000`: Connection pool management

#### Private Endpoint Configuration

**Purpose**: Secure connectivity from App Service (no public internet exposure)

```bicep
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: 'pe-cosmos-${cosmosClusterName}'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-connection'
        properties: {
          privateLinkServiceId: cosmosCluster.id
          groupIds: ['MongoCluster']
        }
      }
    ]
  }
}

resource cosmosPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.mongocluster.cosmos.azure.com'
  location: 'global'
}
```

---

### 4. Application Gateway with WAF v2 (API Protection)

#### Why Application Gateway for API Only?

In this PaaS architecture, Application Gateway protects **only the App Service (API)**:

| Traffic Type | Protection | Why |
|--------------|------------|-----|
| Static assets (SWA) | SWA built-in | Read-only, no attack surface |
| API calls (App Service) | ✅ App Gateway WAF | Writable endpoints, SQL injection, XSS |

#### Application Gateway Configuration

**SKU**: WAF_v2
- Zone redundant: Yes (zones 1, 2, 3)
- Autoscale: 1-2 instances (workshop)
- WAF Mode: Prevention

**Backend Pool**:
```bicep
backendAddressPools: [
  {
    name: 'appServiceBackend'
    properties: {
      backendAddresses: [
        {
          fqdn: '${appServiceName}.azurewebsites.net'
        }
      ]
    }
  }
]
```

**Health Probe**:
```bicep
probes: [
  {
    name: 'appServiceHealthProbe'
    properties: {
      protocol: 'Https'
      host: '${appServiceName}.azurewebsites.net'
      path: '/health'
      interval: 30
      timeout: 30
      unhealthyThreshold: 3
      pickHostNameFromBackendHttpSettings: true
    }
  }
]
```

**WAF Policy**:
```bicep
resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2023-05-01' = {
  name: 'waf-policy-blogapp'
  location: location
  properties: {
    policySettings: {
      mode: 'Prevention'
      state: 'Enabled'
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
        }
      ]
    }
  }
}
```

---

### 5. Networking Architecture

#### Virtual Network Design

**Address Space**: `10.1.0.0/16`

| Subnet | CIDR | Purpose | Delegation |
|--------|------|---------|------------|
| `snet-appgw` | `10.1.0.0/24` | Application Gateway | None |
| `snet-appservice` | `10.1.1.0/24` | App Service VNet Integration (outbound) | Microsoft.Web/serverFarms |
| `snet-privateendpoint` | `10.1.2.0/24` | Private Endpoints (App Service, Cosmos DB, Key Vault) | None |

#### NAT Gateway Configuration

**Why NAT Gateway is Required**:

When App Service uses VNet Integration, outbound traffic from the app goes through the VNet. To allow App Service to:
- Send logs to Application Insights (public endpoint)
- Access external APIs (npm registry, etc.)
- Reach any internet-based service

A **NAT Gateway** is required to provide outbound internet connectivity.

```bicep
// Public IP for NAT Gateway
resource natGatewayPublicIp 'Microsoft.Network/publicIPAddresses@2023-05-01' = {
  name: 'pip-nat-${environment}'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

// NAT Gateway
resource natGateway 'Microsoft.Network/natGateways@2023-05-01' = {
  name: 'nat-${environment}'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIpAddresses: [
      {
        id: natGatewayPublicIp.id
      }
    ]
    idleTimeoutInMinutes: 10
  }
}

// Associate NAT Gateway with App Service integration subnet
resource appServiceSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  name: 'snet-appservice'
  properties: {
    addressPrefix: '10.1.1.0/24'
    natGateway: {
      id: natGateway.id
    }
    delegations: [
      {
        name: 'Microsoft.Web.serverFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
      }
    ]
  }
}
```

**Traffic Flow with NAT Gateway**:
```
App Service (VNet Integration)
    │
    ├─→ Private Endpoint (Cosmos DB)     → Stays in VNet
    ├─→ Private Endpoint (Key Vault)     → Stays in VNet
    └─→ NAT Gateway → Internet           → Application Insights, external APIs
```

#### Private Endpoint Architecture

**All PaaS services are accessed via Private Endpoints** (no public endpoints):

| Service | Private Endpoint | Private DNS Zone |
|---------|-----------------|------------------|
| App Service | `pe-appservice-*` | `privatelink.azurewebsites.net` |
| Cosmos DB | `pe-cosmos-*` | `privatelink.mongocluster.cosmos.azure.com` |
| Key Vault | `pe-keyvault-*` | `privatelink.vaultcore.azure.net` |

**Traffic Flow (Fully Private)**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Virtual Network                                 │
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│  │ App Gateway │────→│ Private Endpoint (App Service)                  │   │
│  │ (Public IP) │     │ snet-privateendpoint                            │   │
│  └─────────────┘     └─────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ App Service (VNet Integration)                                       │   │
│  │ snet-appservice                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                 │
│  │ PE: Cosmos  │      │ PE: KeyVault│      │ NAT Gateway │──→ Internet     │
│  │ DB          │      │             │      │ (App Insights)               │
│  └─────────────┘      └─────────────┘      └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### App Service Private Endpoint

**Purpose**: Application Gateway connects to App Service via Private Endpoint (not public endpoint with firewall)

```bicep
// App Service Private Endpoint
resource appServicePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: 'pe-appservice-${appServiceName}'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: 'appservice-connection'
        properties: {
          privateLinkServiceId: appService.id
          groupIds: ['sites']
        }
      }
    ]
  }
}

// Private DNS Zone for App Service
resource appServicePrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.azurewebsites.net'
  location: 'global'
}

resource appServicePrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: appServicePrivateDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource appServicePrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: appServicePrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: appServicePrivateDnsZone.id
        }
      }
    ]
  }
}

// Disable public access to App Service main site, but allow SCM for GitHub Actions
resource appServicePublicAccess 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'web'
  properties: {
    publicNetworkAccess: 'Disabled'  // Main site: Private Endpoint only
    scmIpSecurityRestrictionsUseMain: false  // SCM uses separate rules
    scmIpSecurityRestrictionsDefaultAction: 'Allow'  // SCM (Kudu): Allow public access for GitHub Actions
  }
}
```

#### GitHub Actions Deployment with Private Endpoint

**Challenge**: When App Service has Private Endpoint enabled, the Kudu/SCM deployment endpoint (`*.scm.azurewebsites.net`) also becomes private by default, blocking GitHub Actions (which runs on public Microsoft-hosted runners).

**Solution**: App Service allows **separate access rules** for the main site vs SCM site:

| Site | Access | Why |
|------|--------|-----|
| Main site (`*.azurewebsites.net`) | Private Endpoint only | Production traffic via Application Gateway |
| SCM site (`*.scm.azurewebsites.net`) | Public (GitHub Actions) | Deployment from GitHub-hosted runners |

**Configuration Options**:

**Option 1: Allow Public SCM Access (Recommended for Workshop)**

This is the simplest approach - keep the main site private while allowing deployment from public internet:

```bicep
resource appServiceConfig 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'web'
  properties: {
    publicNetworkAccess: 'Disabled'  // Main site private
    scmIpSecurityRestrictionsUseMain: false  // Separate SCM rules
    scmIpSecurityRestrictionsDefaultAction: 'Allow'  // Allow public SCM access
  }
}
```

**GitHub Actions Workflow for App Service**:
```yaml
# .github/workflows/backend-deploy.yml
name: Deploy Backend to App Service

on:
  push:
    branches: [main]
    paths:
      - 'materials/backend/**'

permissions:
  id-token: write  # Required for OIDC authentication
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        working-directory: ./materials/backend
        
      - name: Build
        run: npm run build
        working-directory: ./materials/backend
        
      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          
      - name: Deploy to App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ vars.AZURE_WEBAPP_NAME }}
          package: ./materials/backend
```

**Option 2: Self-Hosted Runner (Enterprise Scenario)**

For stricter security requirements, deploy a GitHub Actions runner VM inside the VNet:

```bicep
// Self-hosted runner VM in VNet (optional - for high-security scenarios)
resource runnerSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  name: 'snet-github-runner'
  properties: {
    addressPrefix: '10.1.3.0/24'
  }
}
```

```yaml
# .github/workflows/backend-deploy-private.yml
jobs:
  deploy:
    runs-on: self-hosted  # Uses VNet-connected runner
    # ... deployment steps
```

**Option 3: Restrict SCM to GitHub IP Ranges (Production Consideration)**

For tighter security, restrict SCM access to GitHub's IP ranges:

```bicep
resource appServiceConfig 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'web'
  properties: {
    publicNetworkAccess: 'Disabled'
    scmIpSecurityRestrictionsUseMain: false
    scmIpSecurityRestrictions: [
      {
        name: 'AllowGitHubActions'
        action: 'Allow'
        priority: 100
        // GitHub Actions IP ranges (example - check GitHub docs for current ranges)
        ipAddress: '20.0.0.0/8'  // Simplified - use actual GitHub IP ranges
        description: 'Allow GitHub Actions deployment'
      }
    ]
    scmIpSecurityRestrictionsDefaultAction: 'Deny'
  }
}
```

> **Note**: GitHub's IP ranges change periodically. For production, use GitHub's [meta API](https://api.github.com/meta) to get current ranges, or use Option 1 for simplicity.

**Authentication Method Comparison**:

| Method | Security | Setup Complexity | Recommended For |
|--------|----------|-----------------|-----------------|
| OIDC (Federated Identity) | ✅ High | Medium | Production, Enterprise |
| Service Principal + Secret | Medium | Low | Development, Workshop |
| Publish Profile | ⚠️ Low | Very Low | Quick tests only |

**OIDC Setup (Recommended)**:

1. Create App Registration in Entra ID
2. Add Federated Credential for GitHub Actions:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:<owner>/<repo>:ref:refs/heads/main`
3. Assign `Contributor` role on App Service

```bash
# Create federated credential
az ad app federated-credential create \
  --id <app-id> \
  --parameters '{
    "name": "github-deploy",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:your-org/AzurePaaSWorkshop:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

**Application Gateway Backend Pool** (uses Private Endpoint):
```bicep
backendAddressPools: [
  {
    name: 'appServiceBackend'
    properties: {
      backendAddresses: [
        {
          // Use Private Endpoint IP or FQDN resolved via Private DNS
          fqdn: '${appServiceName}.privatelink.azurewebsites.net'
        }
      ]
    }
  }
]
```

#### Key Vault Private Endpoint

**Purpose**: App Service accesses Key Vault secrets via Private Endpoint

```bicep
// Key Vault Private Endpoint
resource keyVaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: 'pe-keyvault-${keyVaultName}'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: 'keyvault-connection'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}

// Private DNS Zone for Key Vault
resource keyVaultPrivateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
}

resource keyVaultPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: keyVaultPrivateDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource keyVaultPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-05-01' = {
  parent: keyVaultPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: keyVaultPrivateDnsZone.id
        }
      }
    ]
  }
}

// Disable public access to Key Vault
resource keyVaultNetworkAcls 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  properties: {
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'  // No bypass - Private Endpoint only
    }
    publicNetworkAccess: 'Disabled'
  }
}
```

#### Cosmos DB Private Endpoint (unchanged)

```bicep
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-05-01' = {
  name: 'pe-cosmos-${cosmosClusterName}'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnet.id
    }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-connection'
        properties: {
          privateLinkServiceId: cosmosCluster.id
          groupIds: ['MongoCluster']
        }
      }
    ]
  }
}
```

---

### 6. Identity and Security

#### Microsoft Entra ID Integration

**App Registrations** (same pattern as IaaS):

| Registration | Purpose | Redirect URI |
|--------------|---------|--------------|
| Frontend SPA | User authentication | `https://<swa-url>/.auth/login/aad/callback` |
| Backend API | Token validation | N/A (API only) |

**API Permissions**:
- Frontend requests scope: `api://<backend-client-id>/access_as_user`
- Backend validates: audience = backend client ID

#### Key Vault Configuration

**Secrets Stored**:

| Secret Name | Description |
|-------------|-------------|
| `cosmos-connection-string` | Cosmos DB connection string |
| `cosmos-admin-password` | Cosmos DB admin password |

**Access Policy**:
- App Service Managed Identity: Get, List secrets

---

### 7. Monitoring and Diagnostics

#### Application Insights

**Integration**:
```bicep
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-blogapp-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

// App Service configuration
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  properties: {
    siteConfig: {
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}
```

**Metrics to Monitor**:
- Request rate and latency
- Error rate (4xx, 5xx)
- Database query performance
- Memory and CPU usage

#### Log Analytics Workspace

**Log Sources**:
- App Service logs
- Application Gateway access logs
- Cosmos DB diagnostic logs
- Key Vault audit logs

---

## Deployment Strategy

### Bicep Module Structure

```
materials/bicep/
├── main.bicep                    # Main deployment orchestrator
├── main.bicepparam               # Student parameters
├── modules/
│   ├── network.bicep             # VNet, subnets, NAT Gateway, Private DNS Zones
│   ├── staticwebapp.bicep        # Static Web Apps
│   ├── appservice.bicep          # App Service Plan + Web App + Private Endpoint
│   ├── cosmosdb.bicep            # Cosmos DB cluster + Private Endpoint
│   ├── keyvault.bicep            # Key Vault + secrets + Private Endpoint
│   ├── appgateway.bicep          # Application Gateway + WAF
│   └── monitoring.bicep          # App Insights + Log Analytics
└── README.md
```

### Deployment Order

1. **Network** (VNet, subnets, NAT Gateway, Private DNS Zones)
2. **Key Vault** (with Private Endpoint)
3. **Cosmos DB** (with Private Endpoint)
4. **App Service** (with VNet Integration + Private Endpoint)
5. **Application Gateway** (backend = App Service Private Endpoint)
6. **Monitoring** (App Insights with public endpoint - accessed via NAT Gateway)
7. **Static Web Apps** (via GitHub Actions, separate workflow)

### Student Configuration (main.bicepparam)

```bicep
using 'main.bicep'

// Required parameters - students must configure
param environment = 'dev'
param location = 'japaneast'
param entraTenantId = '<your-tenant-id>'
param entraBackendClientId = '<backend-app-registration-id>'
param entraFrontendClientId = '<frontend-app-registration-id>'

// Optional parameters with defaults
param appServiceSku = 'B1'
param cosmosDbTier = 'M30'
```

---

## Cost Estimates

### Workshop Environment (Japan East)

| Component | SKU | Monthly Cost |
|-----------|-----|--------------|
| Static Web Apps | Free | $0 |
| App Service | B1 | ~$13 |
| Cosmos DB vCore | M30 | ~$200 |
| Application Gateway | WAF_v2 (1 instance) | ~$250 |
| Key Vault | Standard | ~$1 |
| VNet/Private Endpoint | - | ~$10 |
| **Total** | | **~$475/month** |

### Cost Comparison with IaaS

| Component | IaaS | PaaS | Savings |
|-----------|------|------|---------|
| Frontend | ~$60 (2 VMs) | $0 (SWA Free) | $60 |
| Backend | ~$60 (2 VMs) | ~$13 (B1) | $47 |
| Database | ~$240 (2 VMs) | ~$200 (M30) | $40 |
| App Gateway | ~$250 | ~$250 | $0 |
| **Total** | **~$610** | **~$475** | **~$135 (22%)** |

---

## Workshop Learning Objectives

By completing this workshop, participants will:

1. **Understand PaaS benefits**: Reduced operational overhead, automatic scaling, managed security
2. **Deploy App Service**: Configuration, deployment slots (S1+), health checks
3. **Configure Cosmos DB vCore**: Connection strings, MongoDB compatibility
4. **Use Static Web Apps**: GitHub Actions integration, routing configuration
5. **Implement Private Endpoints**: Secure PaaS-to-PaaS connectivity
6. **Configure Application Gateway**: WAF policies, backend pools for App Service
7. **Compare IaaS vs PaaS**: Cost, complexity, operational differences

---

## Appendix: IaaS to PaaS Migration Checklist

| IaaS Component | PaaS Equivalent | Migration Notes |
|----------------|-----------------|-----------------|
| NGINX config | SWA staticwebapp.config.json | Convert proxy rules to route config |
| PM2/systemd | App Service always-on | No process manager needed |
| MongoDB RS | Cosmos DB vCore | Update connection string format |
| VM env files | App Service App Settings | Move to portal or Bicep |
| NSG rules | Access restrictions + Private Endpoints | Different security model |
| Custom Script Extension | Deployment slots | CI/CD handles configuration |
