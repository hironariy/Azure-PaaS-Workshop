# Repository-Wide Design Rules for Azure PaaS Workshop

## Overview

This document defines the **design rules and patterns** that apply across all materials in this PaaS Workshop. These rules ensure consistency, security, and maintainability throughout the codebase.

**Purpose**: Serve as the authoritative reference for architectural decisions and coding standards specific to PaaS deployment patterns.

---

## 1. Network Security Patterns

### 1.1 Private Endpoint First Strategy

**Rule**: All PaaS services with data or business logic MUST use Private Endpoints.

| Service | Private Endpoint Required | Reason |
|---------|--------------------------|--------|
| App Service | ✅ Yes | API contains business logic |
| Cosmos DB | ✅ Yes | Contains user data |
| Key Vault | ✅ Yes | Contains secrets |
| Static Web Apps | ❌ No | Public static content only |
| Application Insights | ❌ No | Monitoring (outbound via NAT) |

### 1.2 App Service Network Access Rules

**Rule**: Separate firewall rules for Main Site vs SCM (Kudu) endpoint.

```
┌─────────────────────────────────────────────────────────────────┐
│                    App Service Network Access                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Site (*.azurewebsites.net)                                │
│  ├── publicNetworkAccess: Disabled                              │
│  ├── Access: Private Endpoint ONLY                              │
│  └── Traffic: Application Gateway → Private Endpoint → App      │
│                                                                  │
│  SCM Site (*.scm.azurewebsites.net)                             │
│  ├── scmIpSecurityRestrictionsUseMain: false                    │
│  ├── scmIpSecurityRestrictionsDefaultAction: Allow              │
│  └── Traffic: GitHub Actions → Public SCM → Kudu deployment     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Bicep Implementation**:

```bicep
// ✅ CORRECT: Separate rules for main site and SCM
resource appServiceConfig 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'web'
  properties: {
    // Main site: Private Endpoint only (no public access)
    publicNetworkAccess: 'Disabled'
    ipSecurityRestrictionsDefaultAction: 'Deny'
    
    // SCM site: Separate rules (allow public for GitHub Actions)
    scmIpSecurityRestrictionsUseMain: false  // ★ Key setting
    scmIpSecurityRestrictionsDefaultAction: 'Allow'
  }
}
```

```bicep
// ❌ INCORRECT: Using same rules for both (blocks GitHub Actions)
resource appServiceConfig 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'web'
  properties: {
    publicNetworkAccess: 'Disabled'
    scmIpSecurityRestrictionsUseMain: true  // SCM inherits main site rules = blocked
  }
}
```

**Security Consideration**: 
- SCM endpoint requires authentication (deployment credentials or OIDC)
- Even with public SCM access, unauthorized deployments are rejected
- For higher security environments, use self-hosted runners in VNet

### 1.3 Outbound Traffic Pattern

**Rule**: Use NAT Gateway for all App Service outbound internet traffic.

```
App Service (VNet Integration)
    │
    ├─→ Cosmos DB (Private Endpoint)     → Internal traffic
    ├─→ Key Vault (Private Endpoint)     → Internal traffic
    └─→ NAT Gateway → Internet           → Application Insights, npm, etc.
```

**Required Subnet Configuration**:

```bicep
resource appServiceSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-05-01' = {
  name: 'snet-appservice'
  properties: {
    addressPrefix: '10.1.1.0/24'
    natGateway: {
      id: natGateway.id  // ★ Required for outbound
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

---

## 2. Authentication and Authorization Patterns

### 2.1 OIDC for GitHub Actions (Federated Credentials)

**Rule**: Use OIDC with Federated Credentials instead of Service Principal secrets.

| Method | Security | Rotation | Recommended |
|--------|----------|----------|-------------|
| OIDC (Federated) | ✅ High | Not needed | ✅ Yes |
| Service Principal Secret | Medium | Every 90 days | ⚠️ Acceptable |
| Publish Profile | ⚠️ Low | Manual | ❌ No |

**GitHub Actions Configuration**:

```yaml
# ✅ CORRECT: OIDC authentication
permissions:
  id-token: write  # Required for OIDC
  contents: read

- name: Azure Login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

```yaml
# ❌ AVOID: Service Principal with client secret
- name: Azure Login
  uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}  # Contains client secret
```

### 2.2 Managed Identity for PaaS-to-PaaS

**Rule**: Use System-assigned Managed Identity for App Service to access other Azure services.

| Access Pattern | Authentication Method |
|----------------|----------------------|
| App Service → Key Vault | Managed Identity + RBAC |
| App Service → Cosmos DB | Connection string from Key Vault |
| App Service → App Insights | Connection string (auto-configured) |

**Key Vault Reference Pattern**:

```bicep
// App Service references Key Vault secrets directly
appSettings: [
  {
    name: 'COSMOS_CONNECTION_STRING'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=cosmos-connection-string)'
  }
]
```

### 2.3 Entra ID for User Authentication

**Rule**: Use Microsoft Entra ID (Azure AD) with MSAL for all user authentication.

| Component | MSAL Library | Redirect URI Pattern |
|-----------|--------------|---------------------|
| Frontend (SWA) | @azure/msal-browser | `https://<swa-url>/.auth/login/aad/callback` |
| Backend (App Service) | @azure/msal-node | N/A (validates tokens only) |

---

## 3. Deployment Patterns

### 3.1 Infrastructure as Code (Bicep)

**Rule**: All infrastructure MUST be defined in Bicep templates.

**Module Structure**:

```
materials/bicep/
├── main.bicep                    # Orchestrator
├── main.bicepparam               # Parameters
├── modules/
│   ├── network.bicep             # VNet, subnets, NAT Gateway, Private DNS
│   ├── staticwebapp.bicep        # Static Web Apps
│   ├── appservice.bicep          # App Service + Private Endpoint
│   ├── cosmosdb.bicep            # Cosmos DB + Private Endpoint
│   ├── keyvault.bicep            # Key Vault + Private Endpoint
│   ├── appgateway.bicep          # Application Gateway + WAF
│   └── monitoring.bicep          # App Insights + Log Analytics
└── README.md
```

**Naming Convention**:

| Resource Type | Pattern | Example |
|--------------|---------|---------|
| Resource Group | `rg-{app}-{env}` | `rg-blogapp-dev` |
| App Service | `app-{app}-{env}` | `app-blogapp-dev` |
| Cosmos DB | `cosmos-{app}-{env}` | `cosmos-blogapp-dev` |
| Key Vault | `kv-{app}-{env}` | `kv-blogapp-dev` |
| Private Endpoint | `pe-{service}-{resource}` | `pe-appservice-blogapp` |
| Private DNS Zone | `privatelink.{service}.azure.com` | `privatelink.azurewebsites.net` |

### 3.2 GitHub Actions CI/CD

**Rule**: Use GitHub Actions for all deployments.

| Workflow | Trigger | Target |
|----------|---------|--------|
| `azure-static-web-apps.yml` | Push to `materials/frontend/**` | Static Web Apps |
| `backend-deploy.yml` | Push to `materials/backend/**` | App Service (via SCM) |
| `infrastructure-deploy.yml` | Manual or tag | Bicep templates |

**Deployment Order**:

```
1. Infrastructure (Bicep)
   └─→ VNet, NAT Gateway, Private DNS Zones
   └─→ Key Vault + Private Endpoint
   └─→ Cosmos DB + Private Endpoint  
   └─→ App Service + VNet Integration + Private Endpoint
   └─→ Application Gateway
   └─→ Monitoring (App Insights)

2. Backend (GitHub Actions → App Service SCM)
   └─→ Build TypeScript
   └─→ Deploy to Kudu endpoint

3. Frontend (GitHub Actions → Static Web Apps)
   └─→ Build Vite/React
   └─→ Deploy to SWA
```

### 3.3 Environment Configuration

**Rule**: Use App Service App Settings for environment variables, Key Vault for secrets.

| Variable Type | Storage | Example |
|---------------|---------|---------|
| Configuration | App Settings | `NODE_ENV=production`, `PORT=8080` |
| Secrets | Key Vault Reference | `COSMOS_CONNECTION_STRING` |
| Build-time | GitHub Variables | `VITE_ENTRA_CLIENT_ID` |

---

## 4. Code Patterns

### 4.1 Backend (Node.js/Express)

**Cosmos DB Connection Options**:

```typescript
// ✅ REQUIRED: Cosmos DB vCore specific options
const connectOptions: mongoose.ConnectOptions = {
  retryWrites: false,    // Required: Cosmos DB doesn't support retry writes
  tls: true,             // Required: Cosmos DB requires TLS
  maxIdleTimeMS: 120000, // Recommended: Close idle connections
  maxPoolSize: 10,
  minPoolSize: 2,
};
```

**Graceful Shutdown**:

```typescript
// ✅ REQUIRED: App Service sends SIGTERM on restart/scale
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Logging**:

```typescript
// ✅ CORRECT: Console only (App Service captures stdout)
const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
});

// ❌ INCORRECT: File transports (App Service filesystem is ephemeral)
const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: 'error.log' })],
});
```

### 4.2 Frontend (React/Vite)

**API Base URL**:

```typescript
// ✅ CORRECT: Relative URL (SWA proxies to backend)
const API_BASE_URL = '/api';

// ❌ INCORRECT: Hardcoded URL
const API_BASE_URL = 'http://10.0.2.10:3000/api';
```

**MSAL Configuration**:

```typescript
// ✅ CORRECT: Dynamic redirect URI
redirectUri: window.location.origin,

// ❌ INCORRECT: Hardcoded URL
redirectUri: 'https://specific-url.com',
```

### 4.3 Static Web Apps Configuration

**staticwebapp.config.json Structure**:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.ico", "/*.png"]
  },
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://<app-gateway-fqdn>/api/*"
    }
  ],
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  }
}
```

---

## 5. Security Patterns

### 5.1 Network Security

| Layer | Control | Configuration |
|-------|---------|---------------|
| Perimeter | Application Gateway WAF v2 | OWASP 3.2, Prevention mode |
| Transport | TLS 1.2+ | Enforced on all endpoints |
| App Service | Private Endpoint | Main site private only |
| Cosmos DB | Private Endpoint | No public access |
| Key Vault | Private Endpoint | No bypass |

### 5.2 Secret Management

**Rule**: Never store secrets in code, environment files, or Git.

| Secret | Storage | Access Method |
|--------|---------|---------------|
| Cosmos DB connection string | Key Vault | Key Vault Reference |
| Cosmos DB admin password | Key Vault | Bicep @secure() parameter |
| Entra ID client secret | Not used | MSAL public client flow |
| GitHub deployment | Federated Credential | OIDC token exchange |

### 5.3 CORS Configuration

```typescript
// App Service CORS (via App Settings or code)
const corsOptions = {
  origin: [
    process.env.SWA_URL,  // Static Web Apps URL
    'https://<app-gateway-fqdn>',  // Application Gateway (if direct API access)
  ],
  credentials: true,
};
```

---

## 6. Monitoring Patterns

### 6.1 Application Insights Integration

**Rule**: All applications MUST send telemetry to Application Insights.

| Component | Integration Method |
|-----------|-------------------|
| App Service | Auto-instrumentation (connection string) |
| Static Web Apps | Browser SDK (optional) |
| Application Gateway | Diagnostic settings |
| Cosmos DB | Diagnostic settings |

### 6.2 Health Checks

**App Service Health Check**:

```bicep
siteConfig: {
  healthCheckPath: '/health'  // Must return 200 OK
}
```

**Health Endpoint Implementation**:

```typescript
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'healthy', timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

---

## 7. Cost Optimization Patterns

### 7.1 Right-sizing for Workshop

| Resource | Production | Workshop | Savings |
|----------|------------|----------|---------|
| App Service | P1v3 | B1 | ~$125/month |
| Cosmos DB | M40 | M30 | ~$200/month |
| App Gateway | 2+ instances | 1 instance | ~$250/month |
| Static Web Apps | Standard | Free | ~$9/month |

### 7.2 Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| App Service SKU | B1 | S1+ (auto-scale) |
| Cosmos DB HA | Disabled | Enabled |
| App Gateway zones | Single | Zone-redundant |
| Private DNS | Shared | Dedicated |

---

## 8. Documentation Standards

### 8.1 File Naming

| Document Type | Pattern | Example |
|--------------|---------|---------|
| Design spec | `{Component}Design.md` | `AzureArchitectureDesign.md` |
| How-to guide | `{topic}-guide.md` | `deployment-guide.md` |
| API reference | `api-{version}.md` | `api-v1.md` |

### 8.2 Code Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Cosmos DB vCore doesn't support retryWrites - disable to prevent errors
retryWrites: false,

// ❌ BAD: Obvious comment
// Set retryWrites to false
retryWrites: false,
```

---

## Appendix: Quick Reference

### Required GitHub Secrets

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `AZURE_CLIENT_ID` | App Registration client ID | Entra ID → App Registrations |
| `AZURE_TENANT_ID` | Entra ID tenant ID | Entra ID → Overview |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Subscriptions blade |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA deployment token | SWA → Manage deployment token |

### Required GitHub Variables

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `AZURE_WEBAPP_NAME` | App Service name | `app-blogapp-dev` |
| `VITE_ENTRA_CLIENT_ID` | Frontend app registration | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_ENTRA_TENANT_ID` | Entra ID tenant | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

### Bicep Parameter File Template

```bicep
using 'main.bicep'

param environment = 'dev'
param location = 'japaneast'
param entraTenantId = '<your-tenant-id>'
param entraBackendClientId = '<backend-app-registration-id>'
param entraFrontendClientId = '<frontend-app-registration-id>'
param appServiceSku = 'B1'
param cosmosDbTier = 'M30'
```
