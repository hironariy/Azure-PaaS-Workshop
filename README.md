# Azure PaaS Workshop - Multi-User Blog Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

日本語版: [README.ja.md](./README.ja.md)

A hands-on workshop for learning Azure PaaS patterns through building and deploying a production-ready web application.

> 📚 **Workshop Series - Day 2**
> 
> This workshop is part of a **2-day Azure workshop series**:
> 
> | Day | Workshop | Focus |
> |-----|----------|-------|
> | **Day 1** | [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) | Virtual Machines, Load Balancers, Availability Zones |
> | **Day 2** | **Azure PaaS Workshop** (this repository) | App Service, Static Web Apps, Azure DocumentDB, Managed Services |
> 
> Complete both workshops to understand the architectural differences between IaaS and PaaS approaches!

---

## Table of Contents

- [1. Introduction](#1-introduction)
  - [1.1 About This Workshop](#11-about-this-workshop)
  - [1.2 What You Will Learn](#12-what-you-will-learn)
  - [1.3 Application Overview](#13-application-overview)
  - [1.4 Architecture Overview](#14-architecture-overview)
- [2. How to Deploy](#2-how-to-deploy)
  - [2.1 Prerequisites](#21-prerequisites)
  - [2.2 Local Development Environment (Optional)](#22-local-development-environment-optional)
  - [2.3 Azure Deployment](#23-azure-deployment)
- [3. Testing the Application](#3-testing-the-application)
- [4. IaaS vs PaaS Comparison](#4-iaas-vs-paas-comparison)
- [5. Cost Estimate](#5-cost-estimate)
- [6. Cleanup](#6-cleanup)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Quick Reference Card](#8-quick-reference-card)

---

## 1. Introduction

### 1.1 About This Workshop

This workshop is designed for engineers who want to learn **Azure Platform as a Service (PaaS)** patterns by building a real-world, production-ready web application.

**Target Audience:**
- Engineers with 3-5 years of experience (particularly those familiar with AWS)
- Developers preparing for Azure certifications (AZ-104, AZ-305)
- Teams modernizing from IaaS to PaaS architectures

**Companion Workshop:** This is the PaaS version of the [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop). If you completed Day 1, you'll see how the same application can be deployed using managed services instead of VMs!

> 🎓 **For Instructors:** See the [Instructor Guide](docs/instructor-guide.md) for teaching points, common issues, and facilitation notes.

### 1.2 What You Will Learn

By completing this workshop, you will gain hands-on experience with:

| Topic | Azure Services |
|-------|----------------|
| **Managed Compute** | App Service, Static Web Apps |
| **Managed Database** | Azure DocumentDB (formerly called as Cosmos DB for MongoDB vCore) |
| **Security** | Private Endpoints, Key Vault, Managed Identities |
| **Networking** | Virtual Networks, VNet Integration, NAT Gateway |
| **Identity** | Microsoft Entra ID, EasyAuth |
| **Infrastructure as Code** | Bicep templates |
| **CI/CD** | Azure CLI deployment, GitHub Actions (optional) |

<details>
<summary>👥 <strong>Group Discussion</strong></summary>

**Discussion Question:** Before starting the workshop, discuss with your group:
- What PaaS services have you used before (Azure, AWS, or other)?
- What do you expect to be different between IaaS (Day 1) and PaaS (Day 2)?
- What concerns do you have about using managed services?

</details>

### 1.3 Application Overview

The sample application is a **multi-user blog platform** with the following features:

**For All Users (Public):**
- 📖 Browse and read published blog posts
- 🔍 View post details with author information

**For Authenticated Users:**
- ✍️ Create, edit, and delete your own blog posts
- 📝 Save posts as drafts before publishing
- 👤 Manage your profile and view your posts

**Technology Stack:**

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, Vite |
| Backend | Node.js 20, Express.js, TypeScript |
| Database | Azure DocumentDB (formerly called as Cosmos DB for MongoDB vCore) |
| Authentication | Microsoft Entra ID with MSAL.js |

### 1.4 Architecture Overview

![Architecture Diagram](assets/images/architecture.png)

> 📝 **Note:** Architecture diagram will be added. The diagram shows the PaaS architecture with Static Web Apps, App Service, Azure DocumentDB, and private networking.

**Key Azure Services Used:**

| Service | Purpose |
|---------|---------|
| **Static Web Apps** | React frontend hosting with global CDN |
| **App Service** | Node.js API backend with VNet integration |
| **Azure DocumentDB** | Managed MongoDB-compatible database |
| **Key Vault** | Secure storage of secrets and connection strings |
| **Virtual Network** | Network isolation with subnets |
| **Private Endpoints** | Secure access to Azure DocumentDB and Key Vault |
| **NAT Gateway** | Outbound internet for VNet-integrated services |
| **Application Insights** | Monitoring and observability |

---

## 2. How to Deploy

This section explains how to deploy the application to Azure.

> **📝 Looking for local development setup?**
> See [Section 2.2](#22-local-development-environment-optional) or the [Local Development Guide](docs/local-development-setup.md) for running the application on your local machine.

### 2.1 Prerequisites

Before starting, make sure you have the following tools and accounts set up.

#### 2.1.1 Required Tools

Install these tools on your computer:

**All Platforms:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Git** | 2.x+ | Version control | [Download](https://git-scm.com/) |
| **VS Code** | Latest | Code editor (recommended) | [Download](https://code.visualstudio.com/) |

**macOS/Linux:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure CLI** | 2.60+ | Azure management | [Install Guide](https://docs.microsoft.com/cli/azure/install-azure-cli) |
| **Node.js** | 20.x LTS | Build frontend/backend | [Download](https://nodejs.org/) |
| **SWA CLI** | Latest | Deploy to Static Web Apps | `npm install -g @azure/static-web-apps-cli` |

**Windows:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure PowerShell** | 12.0+ | Azure management | [Install Guide](https://docs.microsoft.com/powershell/azure/install-azure-powershell) |
| **Bicep CLI** | Latest | Infrastructure as Code | [Install Guide](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install#windows) |
| **Node.js** | 20.x LTS | Build frontend/backend | [Download](https://nodejs.org/) |
| **SWA CLI** | Latest | Deploy to Static Web Apps | `npm install -g @azure/static-web-apps-cli` |
| **Azure CLI** | 2.60+ | For deployment scripts | [Install Guide](https://docs.microsoft.com/cli/azure/install-azure-cli) |

> **⏱️ Note: Azure PowerShell Installation Time**  
> Installing Azure PowerShell modules may take **5-15 minutes**. The progress indicator appears at the **top of the VS Code terminal window** or PowerShell window. Please wait for the installation to complete before proceeding.
> - Use `-Scope CurrentUser` if you don't have administrator privileges:
>   ```powershell
>   Install-Module -Name Az -Repository PSGallery -Force -Scope CurrentUser
>   ```

> **⚠️ Important: Bicep CLI Required for Windows**  
> Unlike Azure CLI (which auto-installs Bicep), Azure PowerShell requires manual Bicep CLI installation.
> 
> **Recommended installation method (winget):**
> ```powershell
> winget install -e --id Microsoft.Bicep
> ```
> 
> **Alternative methods:**
> - **Chocolatey:** `choco install bicep`
> - **Windows Installer:** [Download bicep-setup-win-x64.exe](https://github.com/Azure/bicep/releases/latest/download/bicep-setup-win-x64.exe)
> 
> After installation, close and reopen your terminal, then verify:
> ```powershell
> bicep --version
> # Expected: Bicep CLI version 0.x.x
> ```

> **⚠️ Windows Users: Azure CLI Required for Deployment Scripts**  
> The deployment scripts (`deploy-backend.sh`, `deploy-frontend.sh`) use Azure CLI. Windows users should run these scripts in **Git Bash** or **WSL**, or use the equivalent PowerShell commands provided in each step.

**Verify your installation:**

**macOS/Linux:**
```bash
# Check Git
git --version
# Expected: git version 2.x.x

# Check Azure CLI
az --version
# Expected: azure-cli 2.60.x or newer

# Check Bicep (included with Azure CLI)
az bicep version
# Expected: Bicep CLI version 0.x.x

# Check Node.js
node --version
# Expected: v20.x.x

# Check SWA CLI
swa --version
# Expected: 2.x.x
```

**Windows PowerShell:**
```powershell
# Check Git
git --version
# Expected: git version 2.x.x

# Check Azure PowerShell
Get-InstalledModule -Name Az | Select-Object Name, Version
# Expected: Az 12.x.x or newer
# 💡 Alternative if above fails: Get-Module -Name Az.* -ListAvailable | Select-Object Name, Version

# Check Bicep CLI
bicep --version
# Expected: Bicep CLI version 0.x.x

# Check Node.js
node --version
# Expected: v20.x.x

# Check SWA CLI
swa --version
# Expected: 2.x.x

# Check Azure CLI (for deployment scripts)
az --version
# Expected: azure-cli 2.60.x or newer
```

> **📝 Need Docker?** Docker is only required for [local development](#22-local-development-environment-optional), not for Azure deployment.

✅ **Checkpoint:** All tools installed and versions verified.

#### 2.1.2 Required Accounts

You need access to the following:

| Account | Purpose | How to Get |
|---------|---------|------------|
| **Microsoft Azure** | Cloud platform | [Free Account](https://azure.microsoft.com/free/). Workshop attendees must have an active subscription with Owner or Contributor role. |
| **Microsoft Entra ID** | Authentication | Included with Azure subscription |
| **GitHub** (optional) | Clone repository, CI/CD | [Sign Up](https://github.com/join) |

> **💡 Tip for Azure beginners:** Azure offers $200 free credit for new accounts. This is more than enough to complete this workshop.

#### 2.1.3 Required Permissions for Entra ID

> ⚠️ **IMPORTANT: Check Your Permissions Before Starting**
>
> To create app registrations in Microsoft Entra ID, you need one of the following:
>
> | Role/Setting | Who Has It |
> |--------------|------------|
> | **Application Developer** role | Assigned by your IT admin |
> | **Cloud Application Administrator** role | Assigned by your IT admin |
> | **Global Administrator** role | Tenant administrators |
> | **"Users can register applications"** = Yes | Default tenant setting (may be disabled) |
>
> **How to check if you have permission:**
> 1. Go to [Azure Portal](https://portal.azure.com) → Microsoft Entra ID → App registrations
> 2. Click "+ New registration"
> 3. If you see the registration form, you have permission ✅
> 4. If you see an error or the button is disabled, contact your IT administrator ❌
>
> **For Workshop Organizers:**
> If participants cannot create app registrations, you have two options:
> 1. **Ask IT admin** to assign the "Application Developer" role to participants
> 2. **Pre-create app registrations** and share the Client IDs with participants
>
> **For Personal/Free Azure Accounts:**
> If you created your own Azure account, you are automatically the Global Administrator and can create app registrations without any additional setup.

#### 2.1.4 Clone the Repository

Clone the workshop repository to your local machine:

**macOS/Linux:**
```bash
# Clone the official repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

**Windows PowerShell:**
```powershell
# Clone the official repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

> **💡 For Workshop Participants:** If you forked this repository to your own GitHub account, clone your fork instead:
> ```bash
> git clone https://github.com/YOUR_USERNAME/Azure-PaaS-Workshop.git
> cd Azure-PaaS-Workshop
> ```

✅ **Checkpoint:** Repository cloned and you are in the project directory.

#### 2.1.5 Microsoft Entra ID App Registrations

You need to create **two app registrations** in Microsoft Entra ID. This is required for Azure deployment (and also for local development).

> **Why two app registrations?**
> - **Frontend App**: Handles user login via MSAL.js (browser-based)
> - **Backend API App**: Validates JWT tokens and protects API endpoints

**Step-by-step guide:**

<details>
<summary>📝 Click to expand: Create Frontend App Registration</summary>

1. **Open Azure Portal**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Sign in with your Microsoft account

2. **Navigate to Entra ID**
   - In the search bar at the top, type "Entra ID"
   - Click on "Microsoft Entra ID"

3. **Create App Registration**
   - In the left menu, click "Manage" > "App registrations"
   - Click "+ New registration" button

4. **Configure the App**
   - **Name**: `BlogApp Frontend (PaaS)` (or any name you prefer)
   - **Supported account types**: Select "Accounts in this organizational directory only"
   - **Redirect URI**: 
     - Select **"Single-page application (SPA)"** from the dropdown
     - Enter: `http://localhost:5173`

   > ⚠️ **CRITICAL**: You MUST select **"Single-page application (SPA)"** - NOT "Web". 
   > If you select "Web", authentication will fail with error `AADSTS9002326`.

5. **Click "Register"**

6. **Copy Important Values** (you'll need these later)
   - **Application (client) ID**: This is your `VITE_ENTRA_CLIENT_ID` / `entraFrontendClientId`
   - **Directory (tenant) ID**: This is your `VITE_ENTRA_TENANT_ID` / `entraTenantId`

   > 💡 Keep this browser tab open - you'll need these values soon.

</details>

<details>
<summary>📝 Click to expand: Create Backend API App Registration</summary>

1. **Create Another App Registration**
   - Go back to "App registrations"
   - Click "+ New registration"

2. **Configure the App**
   - **Name**: `BlogApp API (PaaS)`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: Leave empty (APIs don't need redirect URIs)

3. **Click "Register"**

4. **Copy the Application (client) ID**
   - This is your `ENTRA_CLIENT_ID` / `entraBackendClientId`
   - Also used as `VITE_API_CLIENT_ID`

5. **Expose an API Scope**
   - In the left menu, click "Manage" > "Expose an API"
   - Click "Add a scope"
   - If asked for Application ID URI, click "Save and continue" (accept default)
   - Configure the scope:
     - **Scope name**: `access_as_user`
     - **Who can consent**: Admins and users
     - **Admin consent display name**: `Access BlogApp API`
     - **Admin consent description**: `Allows the app to access BlogApp API on behalf of the signed-in user`
   - Click "Add scope"

</details>

<details>
<summary>📝 Click to expand: Grant Frontend Permission to Call Backend API</summary>

1. **Go to Frontend App Registration**
   - Navigate to App registrations → `BlogApp Frontend (PaaS)`

2. **Add API Permission**
   - In the left menu, click "API permissions"
   - Click "+ Add a permission"
   - Select "APIs my organization uses" tab (or "My APIs" tab if visible)
   - Click on "BlogApp API (PaaS)"
   - Check the box next to `access_as_user`
   - Click "Add permissions"

3. **(Optional) Grant Admin Consent**
   - If you're an admin, click "Grant admin consent for [Your Organization]"
   - This prevents users from needing to consent individually

</details>

**Summary of Values You'll Need:**

| Value | Where to Find | Used For |
|-------|---------------|----------|
| `entraTenantId` | Any app → Overview → Directory (tenant) ID | Bicep parameter |
| `entraFrontendClientId` | Frontend app → Overview → Application (client) ID | Bicep parameter |
| `entraBackendClientId` | Backend API app → Overview → Application (client) ID | Bicep parameter |

✅ **Checkpoint:** Both app registrations created. You have the three IDs noted above.

---

### 2.2 Local Development Environment (Optional)

> **📖 Full Guide:** For local development setup, see the [Local Development Guide](docs/local-development-setup.md).

Local development requires additional tools (Docker for MongoDB) and is useful for:
- Making code changes and debugging
- Testing features before Azure deployment
- Learning the application architecture

If you just want to deploy to Azure, skip to the next section.

---

### 2.3 Azure Deployment

Follow these steps to deploy the application to Azure.

#### Step 1: Login to Azure

**macOS/Linux (bash/zsh):**
```bash
# Login to Azure
az login

# Verify you're logged in
az account show

# (Optional) Set specific subscription if you have multiple
az account set --subscription "Your Subscription Name"
```

**Windows PowerShell:**
```powershell
# Login to Azure
Connect-AzAccount

# Verify you're logged in
Get-AzContext

# (Optional) Set specific subscription if you have multiple
Set-AzContext -Subscription "Your Subscription Name"
```

> **💡 Multiple Tenants?** If you have access to multiple Entra ID tenants (e.g., personal and work accounts), you may need to specify the tenant explicitly:
> 
> **Azure CLI:**
> ```bash
> az login --tenant "your-tenant-id-or-domain.onmicrosoft.com"
> ```
> 
> **Azure PowerShell:**
> ```powershell
> Connect-AzAccount -Tenant "your-tenant-id"
> # Or set both tenant and subscription:
> Set-AzContext -Tenant "your-tenant-id" -Subscription "Your Subscription Name"
> ```
> 
> To find your tenant ID: Azure Portal → Microsoft Entra ID → Overview → Tenant ID

✅ **Checkpoint:** Logged in to Azure and correct subscription selected.

#### Step 2: Configure Bicep Parameters

**macOS/Linux:**
```bash
# Navigate to bicep folder
cd materials/bicep

# Copy template to local file (gitignored)
cp dev.bicepparam dev.local.bicepparam

# Edit with your values
# You can use any text editor (vim, nano, code, etc.)
code dev.local.bicepparam
```

**Windows PowerShell:**
```powershell
# Navigate to bicep folder
cd materials\bicep

# Copy template to local file (gitignored)
Copy-Item dev.bicepparam dev.local.bicepparam

# Edit with your values
code dev.local.bicepparam
```

**Required Parameters:**

| Parameter | Description | How to Get |
|-----------|-------------|------------|
| `entraTenantId` | Your Entra ID tenant ID | Azure Portal → Entra ID → Overview |
| `entraBackendClientId` | Backend API app client ID | From Step 2.1.5 |
| `entraFrontendClientId` | Frontend SPA app client ID | From Step 2.1.5 |
| `cosmosDbAdminPassword` | Database admin password | Generate: `openssl rand -base64 16` |

Example `dev.local.bicepparam`:
```bicep
using 'main.bicep'

param environmentName = 'dev'
param location = 'japaneast'
param entraTenantId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param entraBackendClientId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param entraFrontendClientId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param cosmosDbAdminPassword = 'your-secure-password-here'
```

✅ **Checkpoint:** `dev.local.bicepparam` file created with your values.

#### Step 3: Deploy Infrastructure with Bicep

**macOS/Linux:**
```bash
# Create resource group (use your own name)
az group create --name rg-blogapp-paas --location japaneast

# Deploy infrastructure
az deployment group create \
  --resource-group rg-blogapp-paas \
  --template-file main.bicep \
  --parameters dev.local.bicepparam

# Note: Deployment takes approximately 10-15 minutes
```

**Windows PowerShell:**
```powershell
# Create resource group (use your own name)
New-AzResourceGroup -Name "rg-blogapp-paas" -Location "japaneast"

# Deploy infrastructure
New-AzResourceGroupDeployment `
  -ResourceGroupName "rg-blogapp-paas" `
  -TemplateFile "main.bicep" `
  -TemplateParameterFile "dev.local.bicepparam"

# Note: Deployment takes approximately 10-15 minutes
```

> **💡 Multi-Group Workshops:** If multiple groups are deploying to the same subscription, use the `groupId` parameter to avoid naming conflicts:
> 
> **macOS/Linux:**
> ```bash
> az deployment group create \
>   --resource-group rg-blogapp-team-A \
>   --template-file main.bicep \
>   --parameters dev.local.bicepparam \
>   --parameters groupId='A'
> ```
> 
> **Windows PowerShell:**
> ```powershell
> New-AzResourceGroupDeployment `
>   -ResourceGroupName "rg-blogapp-team-A" `
>   -TemplateFile "main.bicep" `
>   -TemplateParameterFile "dev.local.bicepparam" `
>   -groupId "A"
> ```

**Verify Deployment:**

**macOS/Linux:**
```bash
# List deployed resources
az resource list --resource-group rg-blogapp-paas --output table
```

**Windows PowerShell:**
```powershell
# List deployed resources
Get-AzResource -ResourceGroupName "rg-blogapp-paas" | Format-Table Name, ResourceType
```

✅ **Checkpoint:** Bicep deployment completed successfully. You can see the resources in Azure Portal.

<details>
<summary>👥 <strong>Group Discussion</strong></summary>

**Discussion Question:** Compare the Bicep deployment experience with the IaaS workshop (Day 1):
- How many resources were created?
- Which resources don't exist in the PaaS version? (e.g., VMs, Bastion)
- What's the difference in operational responsibility?

</details>

#### Step 4: Update Entra ID Redirect URIs

After deployment, you need to add the Static Web App URL to your Frontend app registration.

1. **Get the SWA URL:**

   **macOS/Linux:**
   ```bash
   # Get the SWA hostname
   az staticwebapp show \
     --name $(az staticwebapp list --resource-group rg-blogapp-paas --query "[0].name" -o tsv) \
     --resource-group rg-blogapp-paas \
     --query "defaultHostname" -o tsv
   ```

   **Windows PowerShell:**
   ```powershell
   # Get the SWA hostname
   $swaName = (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas")[0].Name
   (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas" -Name $swaName).DefaultHostname
   ```

2. **Add Redirect URI in Azure Portal:**
   - Go to Azure Portal → Microsoft Entra ID → App registrations → `BlogApp Frontend (PaaS)`
   - Click "Authentication" in the left menu
   - Under "Single-page application" Redirect URIs, click "Add URI"
   - Add: `https://<your-swa-hostname>.azurestaticapps.net`
   - Click "Save"

✅ **Checkpoint:** SWA URL added to Frontend app registration redirect URIs.

#### Step 5: Deploy Backend to App Service

Use the deployment script to deploy the backend API.

**macOS/Linux:**
```bash
# Return to repository root
cd ../..

# Get the App Service name from deployment outputs
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group rg-blogapp-paas \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

echo "App Service Name: $APP_SERVICE_NAME"

# Deploy backend
./scripts/deploy-backend.sh rg-blogapp-paas $APP_SERVICE_NAME
```

**Windows (Git Bash or WSL):**
```bash
# Run in Git Bash or WSL
cd /path/to/Azure-PaaS-Workshop

# Get the App Service name
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group rg-blogapp-paas \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

# Deploy backend
./scripts/deploy-backend.sh rg-blogapp-paas $APP_SERVICE_NAME
```

**Windows PowerShell (Alternative):**
```powershell
# Get the App Service name
$deployment = Get-AzResourceGroupDeployment -ResourceGroupName "rg-blogapp-paas" -Name "main"
$appServiceName = $deployment.Outputs.appServiceName.Value
Write-Host "App Service Name: $appServiceName"

# Navigate to backend
cd materials\backend

# Install dependencies and build
npm install
npm run build

# Create deployment package
Copy-Item package.json, package-lock.json dist\
Push-Location dist
npm ci --omit=dev
Compress-Archive -Path * -DestinationPath ..\deploy.zip -Force
Pop-Location

# Configure App Service
az webapp config appsettings set `
  --resource-group "rg-blogapp-paas" `
  --name $appServiceName `
  --settings "SCM_DO_BUILD_DURING_DEPLOYMENT=false"

az webapp config set `
  --resource-group "rg-blogapp-paas" `
  --name $appServiceName `
  --startup-file "node src/app.js"

# Deploy
az webapp deploy `
  --resource-group "rg-blogapp-paas" `
  --name $appServiceName `
  --src-path deploy.zip `
  --type zip `
  --async true

# Wait and verify health
Start-Sleep -Seconds 90
Invoke-RestMethod -Uri "https://$appServiceName.azurewebsites.net/health"

# Cleanup
Remove-Item deploy.zip
cd ..\..
```

The script will:
1. Build the TypeScript backend
2. Create a deployment package
3. Deploy to App Service
4. Wait for health check to pass

> **⏱️ Note:** First deployment takes ~2-3 minutes. App startup takes 60-90 seconds due to VNet integration and Key Vault reference resolution.

✅ **Checkpoint:** Backend deployed. Health check returns `{"status":"healthy"}`.

#### Step 6: Deploy Frontend to Static Web Apps

**Setup (one-time):**

**macOS/Linux:**
```bash
# Copy template to local config file (gitignored)
cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env

# Edit with your Entra ID values
code scripts/deploy-frontend.local.env
```

**Windows PowerShell:**
```powershell
# Copy template to local config file (gitignored)
Copy-Item scripts\deploy-frontend.template.env scripts\deploy-frontend.local.env

# Edit with your Entra ID values
code scripts\deploy-frontend.local.env
```

**Edit `deploy-frontend.local.env`:**
```bash
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_FRONTEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_BACKEND_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Deploy:**

**macOS/Linux:**
```bash
# Deploy frontend
./scripts/deploy-frontend.sh rg-blogapp-paas
```

**Windows (Git Bash or WSL):**
```bash
# Run in Git Bash or WSL
./scripts/deploy-frontend.sh rg-blogapp-paas
```

**Windows PowerShell (Alternative):**
```powershell
# Get SWA details
$swaName = (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas")[0].Name
$swaHostname = (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas" -Name $swaName).DefaultHostname
$deploymentToken = (Get-AzStaticWebAppSecret -ResourceGroupName "rg-blogapp-paas" -Name $swaName).Properties.ApiKey

# Build frontend
cd materials\frontend
npm install
npm run build

# Create config (inline injection into index.html)
$config = @"
window.__APP_CONFIG__={
  "entraClientId": "$env:ENTRA_FRONTEND_CLIENT_ID",
  "entraTenantId": "$env:ENTRA_TENANT_ID",
  "entraRedirectUri": "https://$swaHostname",
  "apiClientId": "$env:ENTRA_BACKEND_CLIENT_ID",
  "apiBaseUrl": "https://$swaHostname/api"
};
"@

# Inject config into index.html
$indexHtml = Get-Content dist\index.html -Raw
$indexHtml = $indexHtml -replace 'window.__APP_CONFIG__=null;', $config
Set-Content dist\index.html $indexHtml

# Deploy with SWA CLI
swa deploy dist --deployment-token $deploymentToken

cd ..\..
```

✅ **Checkpoint:** Frontend deployed. SWA URL loads the blog application.

#### Step 7: Verify Deployment

**macOS/Linux:**
```bash
# Get URLs
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group rg-blogapp-paas \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

SWA_HOSTNAME=$(az staticwebapp show \
  --name $(az staticwebapp list --resource-group rg-blogapp-paas --query "[0].name" -o tsv) \
  --resource-group rg-blogapp-paas \
  --query "defaultHostname" -o tsv)

echo "=== Deployment URLs ==="
echo "Frontend: https://$SWA_HOSTNAME"
echo "API (via SWA): https://$SWA_HOSTNAME/api/health"
echo "API (direct): https://$APP_SERVICE_NAME.azurewebsites.net/health"

# Test endpoints
echo ""
echo "=== Testing Health Endpoints ==="
curl -s "https://$APP_SERVICE_NAME.azurewebsites.net/health" | jq .
curl -s "https://$SWA_HOSTNAME/api/health" | jq .
```

**Windows PowerShell:**
```powershell
# Get URLs
$deployment = Get-AzResourceGroupDeployment -ResourceGroupName "rg-blogapp-paas" -Name "main"
$appServiceName = $deployment.Outputs.appServiceName.Value
$swaName = (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas")[0].Name
$swaHostname = (Get-AzStaticWebApp -ResourceGroupName "rg-blogapp-paas" -Name $swaName).DefaultHostname

Write-Host "=== Deployment URLs ==="
Write-Host "Frontend: https://$swaHostname"
Write-Host "API (via SWA): https://$swaHostname/api/health"
Write-Host "API (direct): https://$appServiceName.azurewebsites.net/health"

# Test endpoints
Write-Host ""
Write-Host "=== Testing Health Endpoints ==="
Invoke-RestMethod -Uri "https://$appServiceName.azurewebsites.net/health"
Invoke-RestMethod -Uri "https://$swaHostname/api/health"
```

✅ **Checkpoint:** Both health endpoints return `{"status":"healthy"}`. Frontend loads in browser.

---

<details>
<summary>🚀 <strong>[Advanced] GitHub Actions Deployment (Alternative - Not Verified)</strong></summary>

> ⚠️ **Note:** This section describes CI/CD deployment using GitHub Actions. This method has not been fully verified and is provided as an alternative for teams who prefer automated deployments.

GitHub Actions can automate deployments on every push to the main branch.

**Prerequisites:**
- Repository forked to your GitHub account
- GitHub CLI installed (`gh`)

**Step 1: Create Service Principal**

```bash
# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "github-actions-blogapp" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-blogapp-paas \
  --json-auth
```

**Step 2: Configure GitHub Secrets**

Go to your repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | JSON output from service principal creation |
| `SWA_DEPLOYMENT_TOKEN` | Get from: `az staticwebapp secrets list --name <swa-name> --query "properties.apiKey" -o tsv` |

| Variable | Value |
|----------|-------|
| `AZURE_WEBAPP_NAME` | Your App Service name |
| `VITE_ENTRA_CLIENT_ID` | Frontend app client ID |
| `VITE_ENTRA_TENANT_ID` | Tenant ID |
| `VITE_API_CLIENT_ID` | Backend API client ID |

**Step 3: Trigger Deployment**

Push a commit to trigger the workflows:
```bash
git commit --allow-empty -m "Trigger CI/CD"
git push
```

See `.github/workflows/` for the workflow files.

</details>

---

## 3. Testing the Application

### 3.1 Health Check

Verify all components are running:

**macOS/Linux:**
```bash
# Backend health (direct)
curl -s "https://<app-service-name>.azurewebsites.net/health" | jq .

# Backend health (via SWA Linked Backend)
curl -s "https://<swa-hostname>.azurestaticapps.net/api/health" | jq .
```

**Windows PowerShell:**
```powershell
# Backend health (direct)
Invoke-RestMethod -Uri "https://<app-service-name>.azurewebsites.net/health"

# Backend health (via SWA Linked Backend)
Invoke-RestMethod -Uri "https://<swa-hostname>.azurestaticapps.net/api/health"
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00.000Z"
}
```

✅ **Checkpoint:** Health endpoints return 200 OK.

### 3.2 Authentication Test

1. Open the SWA URL in a browser: `https://<swa-hostname>.azurestaticapps.net`
2. Click "Sign In" button
3. You should be redirected to Microsoft login
4. After authentication, you should see your profile

✅ **Checkpoint:** Can sign in with Microsoft account and see profile.

### 3.3 CRUD Operations Test

After signing in:

1. **Create Post:** Click "New Post" → Fill title and content → Click "Publish"
2. **View Post:** Click on the post title to view details
3. **Edit Post:** Click "Edit" → Modify content → Save
4. **Delete Post:** Click "Delete" → Confirm

✅ **Checkpoint:** All CRUD operations work correctly.

---

## 4. IaaS vs PaaS Comparison

This section highlights the key differences between the IaaS (Day 1) and PaaS (Day 2) implementations.

### 4.1 Architecture Differences

| Component | IaaS (Day 1) | PaaS (Day 2) |
|-----------|--------------|--------------|
| **Frontend Hosting** | Nginx on VM | Static Web Apps |
| **Backend Hosting** | Node.js on VM | App Service |
| **Database** | MongoDB on VM | Azure DocumentDB |
| **Load Balancer** | Application Gateway | SWA Linked Backend |
| **SSL Certificate** | Manual (self-signed) | Automatic (managed) |
| **OS Patching** | Your responsibility | Microsoft managed |
| **Auto-scaling** | Manual VM Scale Set | Built-in |
| **High Availability** | Availability Zones + VMs | Built-in to services |

### 4.2 Backend Code Differences

The backend code is largely identical, but there are key differences in database connection:

**IaaS (MongoDB Replica Set):**
```typescript
// Connection string format for MongoDB Replica Set on VMs
const uri = "mongodb://user:pass@10.0.3.4:27017,10.0.3.5:27017,10.0.3.6:27017/blogdb?replicaSet=rs0";
```

**PaaS (Azure DocumentDB):**
```typescript
// Connection string format for Azure DocumentDB (from Key Vault reference)
const uri = process.env.COSMOSDB_CONNECTION_STRING;
// Format: mongodb+srv://user:pass@cluster.mongocluster.cosmos.azure.com/?tls=true
```

**Key Differences:**
- Azure DocumentDB uses `mongodb+srv://` protocol
- TLS is required for Azure DocumentDB
- Connection string is stored in Key Vault, accessed via managed identity

### 4.3 Frontend Code Differences

**IaaS (config.json served by Nginx):**
```typescript
// Config loaded from /config.json served by VM
const response = await fetch('/config.json');
const config = await response.json();
```

**PaaS (Inline config injection):**
```typescript
// Config injected into index.html at deploy time
const config = window.__APP_CONFIG__ || await fetchConfig();
```

**Key Differences:**
- PaaS uses inline config injection for security (no `/config.json` endpoint exposed)
- Config values are baked into `index.html` during deployment
- API calls go through SWA's Linked Backend proxy (`/api/*`)

### 4.4 Deployment Differences

| Aspect | IaaS (Day 1) | PaaS (Day 2) |
|--------|--------------|--------------|
| **Infrastructure** | Bicep → VMs + networking | Bicep → Managed services |
| **App Deployment** | SSH + rsync to VMs | ZIP deploy + SWA CLI |
| **Config Management** | Files on VMs | Environment variables + Key Vault |
| **Secrets** | Key Vault + VM scripts | Key Vault references (automatic) |
| **SSL Setup** | Generate cert + upload to App Gateway | Automatic (SWA provides free SSL) |
| **Deployment Time** | ~30-45 minutes | ~15-20 minutes |

<details>
<summary>👥 <strong>Group Discussion</strong></summary>

**Discussion Questions:**
1. **When would you choose IaaS over PaaS?**
   - Custom OS requirements
   - Stateful applications
   - Legacy software dependencies
   - Specific hardware requirements

2. **What are the trade-offs of managed services?**
   - Less control vs. less operational overhead
   - Potential vendor lock-in vs. faster time-to-market
   - Cost predictability vs. pay-per-use

3. **How would you migrate from IaaS to PaaS?**
   - Identify stateless vs. stateful components
   - Evaluate database migration options
   - Plan for connection string and config changes

</details>

---

## 5. Cost Estimate

Estimated costs (Japan East region, dev configuration):

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| Static Web Apps | Free | $0 |
| App Service | B1 | ~$13 |
| Azure DocumentDB | M25 | ~$100 |
| Key Vault | Standard | ~$1 |
| VNet / Private Endpoints | - | ~$10 |
| NAT Gateway | Standard | ~$45 |
| Application Insights | Free tier | $0 |
| **Total (Dev)** | | **~$170/month** |

> ⚠️ **Important**: Remember to delete resources after the workshop to avoid charges!
> 
> For a 4-hour workshop, expected cost is approximately **$0.50 - $1.00**.

---

## 6. Cleanup

After completing the workshop, delete all Azure resources:

**macOS/Linux:**
```bash
# Delete resource group (removes all contained resources)
az group delete --name rg-blogapp-paas --yes --no-wait

# Optional: Delete Entra ID app registrations
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
```

**Windows PowerShell:**
```powershell
# Delete resource group (removes all contained resources)
Remove-AzResourceGroup -Name "rg-blogapp-paas" -Force -AsJob

# Optional: Delete Entra ID app registrations
Remove-AzADApplication -ObjectId <frontend-app-object-id>
Remove-AzADApplication -ObjectId <backend-app-object-id>
```

✅ **Checkpoint:** Resource group deleted. Verify in Azure Portal that no resources remain.

---

## 7. Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Bicep deployment fails | Missing Entra ID parameters | Ensure all three IDs are in `dev.local.bicepparam` |
| Backend returns 502 | App not started yet | Wait 60-90 seconds; check logs |
| Health check returns 401 | EasyAuth blocking `/health` | Verify `/health` is in `excludedPaths` |
| Login redirect fails | Missing redirect URI | Add SWA URL to Entra ID app registration |
| API calls fail with 404 | Linked Backend not configured | Check SWA configuration in Azure Portal |
| `tsc: not found` during deploy | Remote build enabled | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` |

### Viewing Logs

**macOS/Linux:**
```bash
# Stream live logs
az webapp log tail --resource-group rg-blogapp-paas --name <app-service-name>

# Download logs
az webapp log download \
  --resource-group rg-blogapp-paas \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

**Windows PowerShell:**
```powershell
# Stream live logs (requires Azure CLI)
az webapp log tail --resource-group rg-blogapp-paas --name <app-service-name>

# Download logs
az webapp log download `
  --resource-group rg-blogapp-paas `
  --name <app-service-name> `
  --log-file C:\Temp\app-logs.zip
```

---

## 8. Quick Reference Card

Copy this section and fill in your values for quick reference:

```
=== Azure PaaS Workshop - Quick Reference ===

Resource Group:     rg-blogapp-paas
Subscription:       ________________________________

--- Entra ID ---
Tenant ID:          ________________________________
Frontend Client ID: ________________________________
Backend Client ID:  ________________________________

--- Azure Resources ---
App Service:        ________________________________.azurewebsites.net
Static Web App:     ________________________________.azurestaticapps.net
Azure DocumentDB:          ________________________________.mongocluster.cosmos.azure.com
Key Vault:          ________________________________.vault.azure.net

--- URLs ---
Frontend:           https://________________________________.azurestaticapps.net
API Health:         https://________________________________.azurewebsites.net/health
API via SWA:        https://________________________________.azurestaticapps.net/api/health

--- Useful Commands ---
# View resources
az resource list --resource-group rg-blogapp-paas --output table

# Stream logs
az webapp log tail --resource-group rg-blogapp-paas --name <app-service-name>

# Cleanup
az group delete --name rg-blogapp-paas --yes --no-wait
```

---

## 📝 License

This workshop is provided under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

This workshop was created to help developers learn Azure PaaS services through hands-on experience.

**Companion Workshop:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) - Complete both for a comprehensive understanding of Azure!

If you find this workshop helpful, please ⭐ star this repository!
