# Deployment Scripts Guide

This document explains the deployment scripts used in the Azure PaaS Workshop. These scripts automate the deployment of the backend API to Azure App Service and the frontend to Azure Static Web Apps.

---

## Table of Contents

- [Backend Deployment Script](#backend-deployment-script)
- [Frontend Deployment Script](#frontend-deployment-script)
- [Troubleshooting](#troubleshooting)

---

## Backend Deployment Script

**Script:** `scripts/deploy-backend.sh`

### Purpose

Deploys the Node.js/Express backend API to Azure App Service with proper handling for VNet integration and Key Vault initialization startup time.

### Usage

```bash
./scripts/deploy-backend.sh <resource-group> <app-service-name>

# Example
./scripts/deploy-backend.sh rg-blogapp-paas app-blogapp-abc123
```

### What the Script Does

The script performs the following steps:

#### Step 1: Build Application
```
📦 npm install
📦 npm run build
```
- Installs all dependencies (including devDependencies for TypeScript compilation)
- Compiles TypeScript source code to JavaScript in the `dist/` folder

#### Step 2: Create Deployment Package
```
📁 Copy package.json and package-lock.json to dist/
📁 Run npm ci --omit=dev (production dependencies only)
📁 Create deploy.zip
```
- Copies only the files needed for production
- Installs only production dependencies (no devDependencies)
- Creates a ZIP package for deployment

#### Step 3: Configure App Service
```
⚙️ SCM_DO_BUILD_DURING_DEPLOYMENT=false
⚙️ Startup command: node src/app.js
```
- **Disables remote build**: Prevents Azure from trying to run `npm install` and `tsc` on the server (which would fail because TypeScript is a devDependency)
- **Sets startup command**: Tells App Service how to start the pre-compiled application

#### Step 4: Deploy to App Service
```
🚀 az webapp deploy --async true
```
- Uploads the ZIP package to App Service
- Uses `--async true` to avoid timeout during upload
- The `--clean true` flag removes old files before deployment

#### Step 5: Health Check Verification
```
🏥 Wait 20 seconds (initial delay)
🏥 Poll /health endpoint every 15 seconds
🏥 Maximum 30 retries (~7.5 minutes total)
```
- Waits for the application to start (60-90 seconds is normal due to VNet + Key Vault)
- Continuously polls the health endpoint until it returns HTTP 200
- Provides clear success/failure output

### Why These Steps Are Necessary

| Challenge | Solution |
|-----------|----------|
| **TypeScript compilation** | Pre-build locally, disable remote build |
| **VNet integration startup delay** | Use async deploy + health check polling |
| **Key Vault reference resolution** | Allow 60-90 seconds for app initialization |
| **Deployment timeout** | Use `--async true` flag |

### Script Output Example

```
==============================================
Backend Deployment Script
==============================================
Resource Group: rg-blogapp-paas
App Service: app-blogapp-abc123
==============================================

Step 1: Building application...
✅ Build complete

Step 2: Creating deployment package...
✅ Deployment package created (deploy.zip)

Step 3: Configuring App Service...
✅ App Service configured

Step 4: Deploying to App Service...
✅ Deployment package uploaded

Step 5: Waiting for app to start (this may take 60-90 seconds)...
Health endpoint: https://app-blogapp-abc123.azurewebsites.net/health
Initial wait: 20s
Attempt 1/30...
  Status: HTTP 503 (waiting 15s...)
Attempt 2/30...
  Status: HTTP 503 (waiting 15s...)
...
Attempt 5/30...

✅ App is healthy! (HTTP 200)

Health check response:
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00.000Z"
}

==============================================
Deployment successful!
App URL: https://app-blogapp-abc123.azurewebsites.net
==============================================
```

---

## Frontend Deployment Script

**Script:** `scripts/deploy-frontend.sh`

### Purpose

Builds the React frontend, injects runtime configuration, and deploys to Azure Static Web Apps using the SWA CLI.

### Prerequisites

Before running this script:

1. **Create local configuration file:**
   ```bash
   cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env
   ```

2. **Edit with your Entra ID values:**
   ```bash
   # scripts/deploy-frontend.local.env
   ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ENTRA_FRONTEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ENTRA_BACKEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

### Usage

```bash
./scripts/deploy-frontend.sh <resource-group>

# Example
./scripts/deploy-frontend.sh rg-blogapp-paas
```

### What the Script Does

The script performs the following steps:

#### Step 0: Load Entra ID Configuration
```
📄 Source deploy-frontend.local.env
✅ Validate required values are set
```
- Reads Entra ID configuration from the local (gitignored) file
- Validates that all required values are configured

#### Step 1: Query Azure Resources
```
🔍 Get SWA hostname
🔍 Get SWA deployment token
```
- Queries Azure to find the Static Web App in the resource group
- Retrieves the deployment token for authentication

#### Step 2: Build Application
```
📦 npm install
📦 npm run build
```
- Installs dependencies
- Builds the production React application to `dist/` folder

#### Step 3: Inject Configuration
```
🔧 Create config JSON with Entra ID values
🔧 Replace placeholder in index.html
```
- Creates a JSON configuration object with:
  - Tenant ID
  - Frontend Client ID
  - Backend Client ID
  - API Base URL (`/api` - routed through SWA Linked Backend)
- Injects the config directly into `index.html`

**Why inline injection?**
- More secure than exposing a `/config.json` endpoint
- Config is baked into the HTML at deploy time
- No additional HTTP request needed to load config

#### Step 4: Deploy to Static Web Apps
```
🚀 swa deploy ./dist --deployment-token $TOKEN
```
- Uses the SWA CLI to deploy the built application
- The deployment token authenticates the upload

### Configuration Injection Details

**Before injection (in source `index.html`):**
```html
<script>window.__APP_CONFIG__=null;</script>
```

**After injection (in built `dist/index.html`):**
```html
<script>window.__APP_CONFIG__={"ENTRA_TENANT_ID":"xxx","ENTRA_FRONTEND_CLIENT_ID":"xxx","ENTRA_BACKEND_CLIENT_ID":"xxx","API_BASE_URL":"/api"};</script>
```

The React application reads this config at runtime:
```typescript
const config = window.__APP_CONFIG__;
// Use config.ENTRA_TENANT_ID, etc.
```

### Script Output Example

```
==============================================
Frontend Deployment Script (Static Web Apps)
==============================================
Resource Group: rg-blogapp-paas
==============================================

Step 0: Loading Entra ID configuration...
  Loading from: /path/to/scripts/deploy-frontend.local.env
  Tenant ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Frontend Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Backend Client ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ Entra ID configuration loaded

Step 1: Querying Azure resources...
  SWA Hostname: blue-plant-abc123.azurestaticapps.net
  SWA Token: ****a1b2c3d4
✅ Azure resources found

Step 2: Building application...
✅ Build complete

Step 3: Injecting config into index.html...
  Config injected into dist/index.html
✅ Config injected (no separate config.json file)

Step 4: Deploying to Static Web Apps...
[SWA CLI output...]

==============================================
✅ Deployment Complete!
==============================================

Frontend URL: https://blue-plant-abc123.azurestaticapps.net

Next steps:
  1. Verify Entra ID Redirect URI includes: https://blue-plant-abc123.azurestaticapps.net
  2. Test the application at: https://blue-plant-abc123.azurestaticapps.net
```

---

## Troubleshooting

### Backend Deployment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `tsc: not found` | Remote build enabled | Script sets `SCM_DO_BUILD_DURING_DEPLOYMENT=false` automatically |
| Health check timeout | App taking too long to start | Check logs: `az webapp log tail --resource-group <rg> --name <app>` |
| HTTP 502 after deploy | App crashed on startup | Check logs for Key Vault or database connection errors |
| Permission denied | Script not executable | Run: `chmod +x scripts/deploy-backend.sh` |

### Frontend Deployment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Local configuration file not found" | Missing `.local.env` file | Copy template: `cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env` |
| "No Static Web App found" | Wrong resource group | Verify resource group name |
| "Could not get SWA deployment token" | Permissions issue | Ensure you have Contributor access |
| SWA CLI not found | Not installed | Install: `npm install -g @azure/static-web-apps-cli` |
| Login redirect fails | Missing redirect URI | Add SWA URL to Entra ID app registration |

### Viewing Logs

**Backend (App Service):**
```bash
# Stream live logs
az webapp log tail --resource-group <resource-group> --name <app-service-name>

# Download logs
az webapp log download \
  --resource-group <resource-group> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

**Frontend (Static Web Apps):**
- Static Web Apps logs are available in the Azure Portal
- Go to Static Web App → Monitoring → Application Insights (if enabled)

---

## Script Files Reference

| File | Purpose |
|------|---------|
| `scripts/deploy-backend.sh` | Main backend deployment script |
| `scripts/deploy-frontend.sh` | Main frontend deployment script |
| `scripts/deploy-frontend.template.env` | Template for frontend config (committed to git) |
| `scripts/deploy-frontend.local.env` | Local frontend config (gitignored) |

---

## See Also

- [Main README](../README.md) - Workshop instructions
- [Local Development Guide](local-development-setup.md) - Running locally
- [Bicep Guide](bicep-guide.md) - Infrastructure as Code details
