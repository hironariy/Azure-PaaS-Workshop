# IaaS to PaaS Migration: Detailed Change Document

## Overview

This document provides a detailed, file-by-file comparison of what changes are required when migrating the blog application from the IaaS Workshop to the PaaS Workshop.

**Source**: [IaaS Workshop materials](../iaas/materials/)
**Target**: PaaS Workshop materials

---

## Summary of Changes

| Category | Files Changed | Change Type |
|----------|--------------|-------------|
| **Backend** | 4 files modified | Configuration changes |
| **Frontend** | 3 files modified, 1 file added | Configuration + SWA config |
| **Database** | 0 files | Schema unchanged (Mongoose models work as-is) |
| **Infrastructure** | All new | Bicep templates completely rewritten |

---

## Backend Changes

### Files Modified

| File | Change Type | Effort |
|------|-------------|--------|
| `src/config/database.ts` | Modified | Low |
| `src/config/environment.ts` | Modified | Low |
| `src/utils/logger.ts` | Modified | Low |
| `src/server.ts` | Modified | Low |
| `package.json` | Modified | Low |

### No Changes Required

| File | Reason |
|------|--------|
| `src/models/*.ts` | Mongoose models work unchanged with Cosmos DB vCore |
| `src/routes/*.ts` | API routes unchanged |
| `src/controllers/*.ts` | Business logic unchanged |
| `src/services/*.ts` | Service layer unchanged |
| `src/middleware/*.ts` | Auth middleware unchanged |

---

### File: `src/config/database.ts`

#### IaaS Version (MongoDB Replica Set)

```typescript
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const connectOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(MONGODB_URI, connectOptions);
  console.log('Connected to MongoDB Replica Set');
};
```

#### PaaS Version (Cosmos DB for MongoDB vCore)

```typescript
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

// Support both IaaS and PaaS environment variable names
const MONGODB_URI = process.env.COSMOS_CONNECTION_STRING || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Database connection string not configured');
}

const connectOptions: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // ★ Cosmos DB vCore specific settings (ADD THESE)
  retryWrites: false,    // Required: Cosmos DB doesn't support retry writes
  tls: true,             // Required: Cosmos DB requires TLS
  maxIdleTimeMS: 120000, // Recommended: Close idle connections
};

export const connectDatabase = async (): Promise<void> => {
  await mongoose.connect(MONGODB_URI, connectOptions);
  logger.info('Connected to Cosmos DB for MongoDB vCore');
};
```

#### Change Summary

| Line | IaaS | PaaS | Reason |
|------|------|------|--------|
| Env var | `MONGODB_URI` | `COSMOS_CONNECTION_STRING \|\| MONGODB_URI` | Support both |
| Option | - | `retryWrites: false` | Cosmos DB limitation |
| Option | - | `tls: true` | Cosmos DB requirement |
| Option | - | `maxIdleTimeMS: 120000` | Connection pool management |

---

### File: `src/config/environment.ts`

#### IaaS Version

```typescript
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUri: process.env.MONGODB_URI,
  entraTenantId: process.env.ENTRA_TENANT_ID,
  entraClientId: process.env.ENTRA_CLIENT_ID,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  logLevel: process.env.LOG_LEVEL || 'info',
};
```

#### PaaS Version

```typescript
export const config = {
  // ★ Changed: App Service uses PORT=8080 by default
  port: parseInt(process.env.PORT || '8080', 10),
  
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // ★ Changed: Support both environment variable names
  databaseUri: process.env.COSMOS_CONNECTION_STRING || process.env.MONGODB_URI,
  
  entraTenantId: process.env.ENTRA_TENANT_ID,
  entraClientId: process.env.ENTRA_CLIENT_ID,
  
  // ★ Changed: Default to SWA URL pattern
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  
  logLevel: process.env.LOG_LEVEL || 'info',
};
```

#### Change Summary

| Setting | IaaS | PaaS | Reason |
|---------|------|------|--------|
| `port` default | `3000` | `8080` | App Service default |
| `databaseUri` | `MONGODB_URI` | `COSMOS_CONNECTION_STRING \|\| MONGODB_URI` | Support both |

---

### File: `src/utils/logger.ts`

#### IaaS Version

```typescript
import winston from 'winston';

const { combine, timestamp, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' 
        ? combine(colorize(), timestamp(), devFormat)
        : combine(timestamp(), json()),
    }),
    // ★ IaaS: Also write to file
    new winston.transports.File({ 
      filename: '/var/log/blogapp/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/var/log/blogapp/combined.log' 
    }),
  ],
});
```

#### PaaS Version

```typescript
import winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

// ★ PaaS: App Service captures stdout/stderr automatically
// No file transports needed - logs go to Log Analytics via App Insights
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    json()  // JSON format for structured logging in App Insights
  ),
  defaultMeta: {
    service: 'blogapp-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // ★ Console only - App Service captures this
    new winston.transports.Console(),
  ],
});

// Optional: Log when App Insights is enabled
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  logger.info('Application Insights enabled');
}
```

#### Change Summary

| Aspect | IaaS | PaaS | Reason |
|--------|------|------|--------|
| File transports | Yes (error.log, combined.log) | No | App Service captures stdout |
| Format | JSON + colorize (dev) | JSON only | Structured logging for App Insights |
| Default meta | None | service, environment | Better log correlation |

---

### File: `src/server.ts`

#### IaaS Version

```typescript
import { app } from './app';
import { config } from './config/environment';
import { connectDatabase } from './config/database';

const startServer = async () => {
  try {
    await connectDatabase();
    
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

#### PaaS Version

```typescript
import { app } from './app';
import { config } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    await connectDatabase();
    
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        nodeEnv: config.nodeEnv,
        port: config.port,
      });
    });

    // ★ PaaS: Graceful shutdown for App Service
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force exit after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
```

#### Change Summary

| Aspect | IaaS | PaaS | Reason |
|--------|------|------|--------|
| Graceful shutdown | No | Yes (SIGTERM, SIGINT) | App Service sends SIGTERM on restart |
| Logging | console.log | Winston logger | Structured logging |
| Disconnect | No | Yes | Clean database disconnect |

---

### File: `package.json`

#### Changes Required

```json
{
  "scripts": {
    // ★ IaaS: Uses PM2 for process management
    // "start": "pm2 start dist/server.js --name blogapp",
    
    // ★ PaaS: Direct node execution (App Service manages process)
    "start": "node dist/server.js",
    
    "build": "tsc",
    "dev": "tsx watch src/server.ts"
  }
}
```

#### Change Summary

| Script | IaaS | PaaS | Reason |
|--------|------|------|--------|
| `start` | `pm2 start ...` | `node dist/server.js` | App Service manages process |

---

## Frontend Changes

### Files Modified

| File | Change Type | Effort |
|------|-------------|--------|
| `src/config/msal.ts` | Modified | Low |
| `src/services/api/client.ts` | Modified | Low |
| `vite.config.ts` | Modified | Low |
| `staticwebapp.config.json` | **NEW** | Medium |
| `.github/workflows/azure-static-web-apps.yml` | **NEW** | Medium |

### No Changes Required

| File | Reason |
|------|--------|
| `src/components/*.tsx` | UI components unchanged |
| `src/pages/*.tsx` | Pages unchanged |
| `src/hooks/*.ts` | Custom hooks unchanged |
| `src/types/*.ts` | Type definitions unchanged |

---

### File: `src/config/msal.ts`

#### IaaS Version

```typescript
import { Configuration } from '@azure/msal-browser';

export const getMsalConfig = (): Configuration => ({
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    // ★ IaaS: App Gateway URL
    redirectUri: import.meta.env.VITE_REDIRECT_URI || 'https://blogapp.japaneast.cloudapp.azure.com',
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI || 'https://blogapp.japaneast.cloudapp.azure.com',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
});
```

#### PaaS Version

```typescript
import { Configuration } from '@azure/msal-browser';

export const getMsalConfig = (): Configuration => ({
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    // ★ PaaS: Static Web Apps URL (or current origin)
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
});
```

#### Change Summary

| Setting | IaaS | PaaS | Reason |
|---------|------|------|--------|
| `redirectUri` | App Gateway URL | `window.location.origin` | SWA URL is dynamic |
| `navigateToLoginRequestUrl` | - | `true` | Better SPA experience |

---

### File: `src/services/api/client.ts`

#### IaaS Version

```typescript
import axios from 'axios';

// ★ IaaS: Full URL to backend via load balancer
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://10.0.2.10:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});
```

#### PaaS Version

```typescript
import axios from 'axios';

// ★ PaaS: Use relative URL - SWA proxies to App Service
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});
```

#### Change Summary

| Setting | IaaS | PaaS | Reason |
|---------|------|------|--------|
| `API_BASE_URL` | `http://10.0.2.10:3000/api` (full URL) | `/api` (relative) | SWA proxy handles routing |

---

### File: `staticwebapp.config.json` (NEW)

This file does not exist in IaaS Workshop. Create new:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.ico", "/*.png", "/*.jpg", "/*.svg"]
  },
  "routes": [
    {
      "route": "/api/*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedRoles": ["anonymous", "authenticated"],
      "rewrite": "https://<app-gateway-fqdn>/api/*"
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/aad?post_login_redirect_uri=/"
    },
    "404": {
      "rewrite": "/index.html"
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
}
```

#### IaaS Equivalent (nginx.conf)

```nginx
# This nginx.conf becomes staticwebapp.config.json in PaaS

server {
    listen 80;
    root /var/www/html;
    index index.html;

    # SPA fallback → navigationFallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy → routes[].rewrite
    location /api/ {
        proxy_pass http://10.0.2.10:3000/api/;
        proxy_set_header Host $host;
    }

    # Security headers → globalHeaders
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
}
```

---

### File: `.github/workflows/azure-static-web-apps.yml` (NEW)

This file does not exist in IaaS Workshop. Create new:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]
    paths: ['materials/frontend/**']
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
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
        env:
          VITE_ENTRA_CLIENT_ID: ${{ vars.VITE_ENTRA_CLIENT_ID }}
          VITE_ENTRA_TENANT_ID: ${{ vars.VITE_ENTRA_TENANT_ID }}
          VITE_ENTRA_BACKEND_CLIENT_ID: ${{ vars.VITE_ENTRA_BACKEND_CLIENT_ID }}
          VITE_API_URL: "/api"
```

#### IaaS Equivalent (Manual Deployment)

```bash
# IaaS: Manual deployment via SCP
npm run build
scp -r dist/* user@web-vm:/var/www/html/
ssh user@web-vm "sudo systemctl reload nginx"
```

---

## Database Changes

### Schema Changes: NONE

The Mongoose models work **unchanged** with Cosmos DB for MongoDB vCore:

| Model File | Changes Required |
|------------|-----------------|
| `src/models/User.model.ts` | ❌ None |
| `src/models/Post.model.ts` | ❌ None |
| `src/models/index.ts` | ❌ None |

### Why No Changes?

1. **Cosmos DB vCore uses MongoDB wire protocol** - Mongoose connects as if it's MongoDB
2. **Schema validation works the same** - JSON Schema validation supported
3. **Indexes work the same** - Create indexes with same syntax
4. **Queries work the same** - Find, aggregate, etc. all compatible

### Connection String Change Only

| Environment | Connection String Format |
|-------------|-------------------------|
| IaaS | `mongodb://user:pass@10.0.3.4:27017,10.0.3.5:27017/blogapp?replicaSet=rs0` |
| PaaS | `mongodb+srv://user:pass@cluster.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false` |

---

## Infrastructure Changes (Bicep)

The Bicep templates are **completely rewritten** for PaaS:

### IaaS Bicep Modules

```
iaas/materials/bicep/modules/
├── network.bicep           # VNet, NSGs, NAT Gateway
├── bastion.bicep           # Azure Bastion
├── web-tier.bicep          # Web VMs (NGINX)
├── app-tier.bicep          # App VMs (Node.js)
├── db-tier.bicep           # DB VMs (MongoDB)
├── loadbalancer.bicep      # Internal Load Balancer
├── appgateway.bicep        # Application Gateway
└── keyvault.bicep          # Key Vault
```

### PaaS Bicep Modules

```
paas/materials/bicep/modules/
├── network.bicep           # VNet, NAT Gateway, Private DNS Zones
├── staticwebapp.bicep      # Static Web Apps (NEW)
├── appservice.bicep        # App Service + Private Endpoint (NEW)
├── cosmosdb.bicep          # Cosmos DB + Private Endpoint (NEW)
├── appgateway.bicep        # Application Gateway (modified for PE backend)
├── keyvault.bicep          # Key Vault + Private Endpoint (modified)
└── monitoring.bicep        # App Insights + Log Analytics (NEW)
```

### Resource Comparison

| IaaS Resource | PaaS Resource | Change |
|---------------|---------------|--------|
| 2x Web VMs | Static Web Apps | Replaced |
| 2x App VMs | App Service (B1) | Replaced |
| 2x DB VMs | Cosmos DB vCore (M30) | Replaced |
| Internal LB | (None needed) | Removed |
| Azure Bastion | (None needed) | Removed |
| VM Extensions | (None needed) | Removed |
| NSGs (per subnet) | Private Endpoints | Replaced |
| - | NAT Gateway | Added (for outbound) |
| - | Private DNS Zones (3x) | Added |
| - | Private Endpoints (3x) | Added |

---

## Environment Variables Comparison

### Backend Environment Variables

| Variable | IaaS | PaaS | Notes |
|----------|------|------|-------|
| `NODE_ENV` | `production` | `production` | Same |
| `PORT` | `3000` | `8080` | Changed (App Service default) |
| `MONGODB_URI` | `mongodb://...` | - | Renamed |
| `COSMOS_CONNECTION_STRING` | - | `mongodb+srv://...` | New name |
| `ENTRA_TENANT_ID` | Same | Same | - |
| `ENTRA_CLIENT_ID` | Same | Same | - |
| `CORS_ORIGINS` | `http://<lb-ip>` | `https://<swa-url>` | Changed |
| `LOG_LEVEL` | `info` | `info` | Same |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | - | Auto-set | New (PaaS) |

### Frontend Environment Variables

| Variable | IaaS | PaaS | Notes |
|----------|------|------|-------|
| `VITE_API_URL` | `http://<lb-ip>/api` | `/api` | Changed (relative) |
| `VITE_ENTRA_CLIENT_ID` | Same | Same | - |
| `VITE_ENTRA_TENANT_ID` | Same | Same | - |
| `VITE_ENTRA_BACKEND_CLIENT_ID` | Same | Same | - |
| `VITE_REDIRECT_URI` | `https://<appgw-fqdn>` | `https://<swa-url>` | Changed |

---

## Deployment Process Comparison

### IaaS Deployment

```bash
# 1. Deploy infrastructure
az deployment group create -g rg-blogapp -f main.bicep -p main.bicepparam

# 2. SSH to VMs and configure
ssh -J bastion user@web-vm "sudo apt update && sudo apt install nginx"
ssh -J bastion user@app-vm "sudo npm install -g pm2"
ssh -J bastion user@db-vm "sudo mongod --replSet rs0"

# 3. Deploy application code
scp -r backend/* user@app-vm:/opt/blogapp/
scp -r frontend/dist/* user@web-vm:/var/www/html/

# 4. Start services
ssh user@app-vm "cd /opt/blogapp && pm2 start"
ssh user@web-vm "sudo systemctl restart nginx"
```

### PaaS Deployment

```bash
# 1. Deploy infrastructure (all PaaS resources)
az deployment group create -g rg-blogapp -f main.bicep -p main.bicepparam

# 2. Configure GitHub repository secrets and variables (one-time)
gh secret set AZURE_CLIENT_ID --body "<federated-credential-client-id>"
gh secret set AZURE_TENANT_ID --body "<tenant-id>"
gh secret set AZURE_SUBSCRIPTION_ID --body "<subscription-id>"
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --body "<swa-deployment-token>"
gh variable set AZURE_WEBAPP_NAME --body "app-blogapp"

# 3. Push code → GitHub Actions deploys automatically
git push origin main

# Frontend: Static Web Apps GitHub Action deploys to SWA
# Backend: App Service GitHub Action deploys to Kudu/SCM endpoint
```

### GitHub Actions Workflow: Backend (NEW)

Create `.github/workflows/backend-deploy.yml`:

```yaml
name: Deploy Backend to App Service

on:
  push:
    branches: [main]
    paths: ['materials/backend/**']
  workflow_dispatch:  # Allow manual trigger

permissions:
  id-token: write  # Required for OIDC authentication
  contents: read

env:
  NODE_VERSION: '20'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: './materials/backend/package-lock.json'
          
      - name: Install dependencies
        run: npm ci
        working-directory: ./materials/backend
        
      - name: Build TypeScript
        run: npm run build
        working-directory: ./materials/backend
        
      - name: Create deployment package
        run: |
          cd materials/backend
          zip -r ../../backend-deploy.zip . -x "node_modules/*" -x "src/*" -x "*.ts"
        
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: backend-deploy
          path: backend-deploy.zip
          retention-days: 1

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: backend-deploy
          
      - name: Azure Login (OIDC - Federated Credential)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          
      - name: Deploy to App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: ${{ vars.AZURE_WEBAPP_NAME }}
          package: backend-deploy.zip
          
      - name: Azure Logout
        run: az logout
        if: always()
```

#### OIDC Setup for GitHub Actions (Federated Credential)

**Why OIDC over Service Principal Secret?**
- No secrets to rotate
- No credentials stored in GitHub
- Uses short-lived tokens
- More secure than long-lived credentials

**Setup Steps:**

```bash
# 1. Create App Registration for GitHub Actions
az ad app create --display-name "GitHub Actions - PaaS Workshop"
APP_ID=$(az ad app list --display-name "GitHub Actions - PaaS Workshop" --query "[0].appId" -o tsv)

# 2. Create Service Principal
az ad sp create --id $APP_ID
SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query "id" -o tsv)

# 3. Assign Contributor role on resource group
az role assignment create \
  --assignee-object-id $SP_OBJECT_ID \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/<subscription-id>/resourceGroups/rg-blogapp"

# 4. Create Federated Credential for GitHub Actions
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-main-branch",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:<your-org>/AzurePaaSWorkshop:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# 5. Store in GitHub repository secrets
gh secret set AZURE_CLIENT_ID --body "$APP_ID"
gh secret set AZURE_TENANT_ID --body "<tenant-id>"
gh secret set AZURE_SUBSCRIPTION_ID --body "<subscription-id>"
```

---

## Migration Checklist

### Pre-requisites

- [ ] Azure subscription with Contributor access
- [ ] GitHub repository created
- [ ] Azure CLI installed locally

### Backend Migration

- [ ] Update `src/config/database.ts` - Add Cosmos DB options
- [ ] Update `src/config/environment.ts` - Change port, add env var fallback
- [ ] Update `src/utils/logger.ts` - Remove file transports
- [ ] Update `src/server.ts` - Add graceful shutdown
- [ ] Update `package.json` - Change start script
- [ ] Test connection to Cosmos DB vCore

### Frontend Migration

- [ ] Update `src/config/msal.ts` - Change redirect URI
- [ ] Update `src/services/api/client.ts` - Change to relative URL
- [ ] Create `staticwebapp.config.json` - SWA routing config
- [ ] Create `.github/workflows/azure-static-web-apps.yml` - CI/CD
- [ ] Update Entra ID app registration with SWA redirect URI
- [ ] Test authentication flow

### Infrastructure Migration

- [ ] Create new Bicep templates for PaaS resources
- [ ] Configure Private Endpoints for all services
- [ ] Configure NAT Gateway for outbound traffic
- [ ] Configure Private DNS Zones
- [ ] Configure App Service SCM public access for GitHub Actions
- [ ] Deploy and test connectivity

### GitHub Actions Setup

- [ ] Create Entra ID App Registration for GitHub Actions
- [ ] Create Federated Credential for OIDC authentication
- [ ] Assign Contributor role on resource group
- [ ] Create `.github/workflows/backend-deploy.yml`
- [ ] Set GitHub repository secrets (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID)
- [ ] Set GitHub repository variable (AZURE_WEBAPP_NAME)
- [ ] Get SWA deployment token and set as AZURE_STATIC_WEB_APPS_API_TOKEN secret
- [ ] Test deployment by pushing to main branch
