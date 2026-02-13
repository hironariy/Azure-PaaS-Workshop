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
| Backend | Node.js 22, Express.js, TypeScript |
| Database | Azure DocumentDB (formerly called as Cosmos DB for MongoDB vCore) |
| Authentication | Microsoft Entra ID with MSAL.js |

### 1.4 Architecture Overview

![Architecture Diagram](assets/images/architecture.png)

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
| **Node.js** | 22.x LTS | Build frontend/backend | [Download](https://nodejs.org/) |
| **SWA CLI** | Latest | Deploy to Static Web Apps | `npm install -g @azure/static-web-apps-cli` |

**Windows (without GitHub Actions):**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **WSL 2** | Latest | Linux runtime for all workshop commands | [Install Guide](https://learn.microsoft.com/windows/wsl/install) |
| **Ubuntu (on WSL)** | 22.04+ | Recommended distro for workshop | [Get Ubuntu](https://apps.microsoft.com/detail/9PN20MSR04DW) |
| **Azure CLI** | 2.60+ | Azure management (inside WSL) | [Install Guide](https://learn.microsoft.com/cli/azure/install-azure-cli-linux) |
| **Node.js** | 22.x LTS | Build frontend/backend (inside WSL) | [NodeSource Guide](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl) |
| **SWA CLI** | Latest | Deploy to Static Web Apps (inside WSL) | `npm install -g @azure/static-web-apps-cli` |
| **jq** | Latest | Parse JSON in script outputs | `sudo apt-get install -y jq` |

**Windows (with GitHub Actions, no WSL2 required):**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure CLI (Windows)** | 2.60+ | Azure management and setup validation (native Windows) | [Install Guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows) |
| **Node.js (Windows)** | 22.x LTS | Local build/test before pushing changes (native Windows) | [Download](https://nodejs.org/) |
| **GitHub CLI (`gh`)** | Latest | Run/monitor workflows and manual workflow dispatch | [Install Guide](https://cli.github.com/) |
| **PowerShell** | 7.x+ | Run workshop setup commands on Windows | [Install Guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) |

> This toolset is intended for organizations where WSL2 is restricted by security policy.

<details>
<summary>🪟 Windows policy: use WSL for all commands</summary>

For this workshop, Windows users should run **all build/deploy/test commands in WSL (Ubuntu)**.

Recommended first-time setup:

```powershell
wsl --install -d Ubuntu
```

After installation:
1. Reboot Windows.
2. Open **Ubuntu** terminal.
3. Run all commands from this README in that Ubuntu terminal.

Do not run deployment steps in Windows PowerShell or Git Bash.

</details>

<details>
<summary>⚠️ Azure CLI: required for deployment scripts</summary>

The deployment scripts (`deploy-backend.sh`, `deploy-frontend.sh`) use Azure CLI and are designed to run in Linux shell.
On Windows, run them in **WSL Ubuntu**.

</details>

<details>
<summary>📦 ZIP packaging on Windows</summary>

Backend packaging is handled by the deployment script.
When using WSL, Linux-compatible ZIPs are created correctly.

</details>

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
# Expected: v22.x.x

# Check SWA CLI
swa --version
# Expected: 2.x.x
```

**Windows (WSL Ubuntu):**
```bash
# Check Git
git --version
# Expected: git version 2.x.x

# Check Azure CLI
az --version
# Expected: azure-cli 2.60.x or newer

# Check Bicep
az bicep version
# Expected: Bicep CLI version 0.x.x

# Check Node.js
node --version
# Expected: v22.x.x

# Check SWA CLI
swa --version
# Expected: 2.x.x

# Check jq
jq --version
# Expected: jq-1.6 or newer
```

> ⚠️ **WSL note (`az bicep version` / WinError 193):**
> If you see `[WinError 193] %1 is not a valid Win32 application`, your WSL shell is likely calling Windows `az` from `/mnt/c/...`.
> Run `which az` and confirm it points to Linux `az` (for example `/usr/bin/az`), not a Windows path.
> If needed, reinstall Azure CLI inside WSL Ubuntu and then run `az bicep install`.

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

Clone the workshop repository to your local machine.

**macOS/Linux:**
```bash
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

**Windows (WSL Ubuntu):**
```bash
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

> **💡 Planning to use GitHub Actions?**
> If you want to set up CI/CD later (see [Advanced: GitHub Actions Deployment](#-advanced-github-actions-deployment-alternative---not-verified)), you should create your own repository from the template instead of cloning directly:
> 1. Go to [https://github.com/hironariy/Azure-PaaS-Workshop](https://github.com/hironariy/Azure-PaaS-Workshop)
> 2. Click the green **"Use this template"** → **"Create a new repository"**
> 3. Set visibility to **Public** (required for free GitHub Actions)
> 4. Clone **your** repository: `git clone https://github.com/YOUR_USERNAME/Azure-PaaS-Workshop.git`

✅ **Checkpoint:** Repository cloned to your local machine.

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
   - **Name**: `BlogApp Frontend <Team-Name> (PaaS)` (replace `<Team-Name>` with your team name/number)
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
   - **Name**: `BlogApp API <Team-Name> (PaaS)` (replace `<Team-Name>` with your team name/number)
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
   - Navigate to App registrations → `BlogApp Frontend <Team-Name> (PaaS)`

2. **Add API Permission**
   - In the left menu, click "API permissions"
   - Click "+ Add a permission"
   - Select "APIs my organization uses" tab (or "My APIs" tab if visible)
   - Click on "BlogApp API <Team-Name> (PaaS)"
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

> **Windows users:** Use **WSL (Ubuntu)** for all commands in this section.

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

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
az login
az account show
az account set --subscription "Your Subscription Name"
```

> **💡 Multiple Tenants?** If you have access to multiple Entra ID tenants (e.g., personal and work accounts), you may need to specify the tenant explicitly:
> 
> **Azure CLI:**
> ```bash
> az login --tenant "your-tenant-id-or-domain.onmicrosoft.com"
> ```
> 
> Windows users in WSL should use Azure CLI command above.
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

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
cd materials/bicep
cp dev.bicepparam dev.local.bicepparam
code dev.local.bicepparam
```

**Required Parameters:**

| Parameter | Description | How to Get |
|-----------|-------------|------------|
| `entraTenantId` | Your Entra ID tenant ID | Azure Portal → Entra ID → Overview |
| `entraBackendClientId` | Backend API app client ID | From Step 2.1.5 |
| `entraFrontendClientId` | Frontend SPA app client ID | From Step 2.1.5 |
| `cosmosDbAdminPassword` | Database admin password | Generate: `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='` |

Generate `cosmosDbAdminPassword` with `openssl`:

**macOS/Linux:**
```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

**Windows (WSL Ubuntu):**
```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

> Note: `openssl rand -base64 16` can include `/` or `+`. These can require URI encoding in MongoDB connection strings.
> To avoid connection string parsing issues in this workshop, use the command above (URL-safe output).

> If `openssl` is missing in WSL, install it with `sudo apt-get install -y openssl`.

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
az group create --name <Resource-Group-Name> --location japaneast

# Deploy infrastructure
az deployment group create \
  --resource-group <Resource-Group-Name> \
  --template-file main.bicep \
  --parameters dev.local.bicepparam

# Note: Deployment takes approximately 10-15 minutes
```

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
az group create --name <Resource-Group-Name> --location japaneast
az deployment group create \
  --resource-group <Resource-Group-Name> \
  --template-file main.bicep \
  --parameters dev.local.bicepparam
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
> **Windows (WSL Ubuntu):** use the Azure CLI command above with `--parameters groupId='A'`.

**Verify Deployment:**

**macOS/Linux:**
```bash
# List deployed resources
az resource list --resource-group <Resource-Group-Name> --output table
```

**Windows (WSL Ubuntu):**
```bash
# Same command as macOS/Linux
az resource list --resource-group <Resource-Group-Name> --output table
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
     --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
     --resource-group <Resource-Group-Name> \
     --query "defaultHostname" -o tsv
   ```

   **Windows (WSL Ubuntu):**
   ```bash
   # Same command as macOS/Linux
   az staticwebapp show \
     --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
     --resource-group <Resource-Group-Name> \
     --query "defaultHostname" -o tsv
   ```

2. **Add Redirect URI in Azure Portal:**
   - Go to Azure Portal → Microsoft Entra ID → App registrations → `BlogApp Frontend <Team-Name> (PaaS)`
   - Click "Authentication" in the left menu
   - Under "Single-page application" Redirect URIs, click "Add URI"
   - Add: `https://<your-swa-hostname>.azurestaticapps.net`
   - Click "Save"

**Alternative (Azure CLI): Update Redirect URIs via Command Line**

If you prefer (or if you're automating workshop setup), you can update the Frontend app registration using Azure CLI.

> ⚠️ Notes
> - You must have permission to update app registrations (see "Required Permissions for Entra ID").
> - These commands **merge** the new SWA URL into the existing `spa.redirectUris` list, then write the merged list back.
> - This updates the **Frontend** app registration (the SPA), not the Backend API app.
> - Azure CLI requires setting `spa={}` in the same update call before setting `spa.redirectUris`.

**macOS/Linux (bash/zsh):**
```bash
# Set your Frontend App Registration (Application / Client ID)
FRONTEND_APP_ID="<entraFrontendClientId>"

# Get the SWA hostname (same as Step 4.1)
SWA_HOSTNAME=$(az staticwebapp show \
  --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
  --resource-group <Resource-Group-Name> \
  --query "defaultHostname" -o tsv)

# Merge redirect URIs and update the app registration
export SWA_HOSTNAME
NEW_REDIRECT_URIS=$(az ad app show \
  --id "$FRONTEND_APP_ID" \
  --query "spa.redirectUris" -o json \
  | node -e '
    const fs = require("fs");
    const existing = JSON.parse(fs.readFileSync(0, "utf8") || "[]");
    const host = process.env.SWA_HOSTNAME;
    const toAdd = [`https://${host}`, `https://${host}/`];
    const merged = [...new Set([...existing, ...toAdd])];
    process.stdout.write(JSON.stringify(merged));
  ')

az ad app update \
  --id "$FRONTEND_APP_ID" \
  --set "spa={}" \
  --set "spa.redirectUris=$NEW_REDIRECT_URIS"

# Verify
az ad app show --id "$FRONTEND_APP_ID" --query "spa.redirectUris" -o jsonc
```

Windows users should run the **macOS/Linux Azure CLI** block above in WSL.

✅ **Checkpoint:** SWA URL added to Frontend app registration redirect URIs.

> **🚀 Prefer CI/CD?** If you'd rather deploy via GitHub Actions instead of the manual steps below, skip to the [Advanced: GitHub Actions Deployment](#-advanced-github-actions-deployment-alternative---not-verified) section.

#### Step 5: Deploy Backend to App Service

Use the deployment script to deploy the backend API.

> 📖 **Script Details:** See [Deployment Scripts Guide](docs/deployment-scripts-guide.md#backend-deployment-script) for a detailed explanation of what the script does.

**macOS/Linux:**
```bash
# Return to repository root
cd ../..

# Get the App Service name from deployment outputs
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

echo "App Service Name: $APP_SERVICE_NAME"

# Deploy backend
./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME
```

**Windows (WSL Ubuntu):**
```bash
# Run in WSL Ubuntu
cd /path/to/Azure-PaaS-Workshop

# Get the App Service name
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

# Deploy backend
./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME
```

The script will:
1. Build the TypeScript backend
2. Create a deployment package
3. Deploy to App Service
4. Wait for health check to pass

> **⏱️ Note:** First deployment takes ~2-3 minutes. App startup takes 60-90 seconds due to VNet integration and Key Vault reference resolution.

✅ **Checkpoint:** Backend deployed. Health check returns `{"status":"healthy"}`.

#### Step 6: Deploy Frontend to Static Web Apps

> 📖 **Script Details:** See [Deployment Scripts Guide](docs/deployment-scripts-guide.md#frontend-deployment-script) for a detailed explanation of what the script does.

**Setup (one-time):**

**macOS/Linux:**
```bash
# Copy template to local config file (gitignored)
cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env

# Edit with your Entra ID values
code scripts/deploy-frontend.local.env
```

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env
code scripts/deploy-frontend.local.env
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
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

**Windows (WSL Ubuntu):**
```bash
# Run in WSL Ubuntu
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

✅ **Checkpoint:** Frontend deployed. SWA URL loads the blog application.

#### Step 7: Verify Deployment

**macOS/Linux:**
```bash
# Get URLs
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

SWA_HOSTNAME=$(az staticwebapp show \
  --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
  --resource-group <Resource-Group-Name> \
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

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

SWA_HOSTNAME=$(az staticwebapp show \
  --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
  --resource-group <Resource-Group-Name> \
  --query "defaultHostname" -o tsv)

echo "=== Deployment URLs ==="
echo "Frontend: https://$SWA_HOSTNAME"
echo "API (via SWA): https://$SWA_HOSTNAME/api/health"
echo "API (direct): https://$APP_SERVICE_NAME.azurewebsites.net/health"

echo ""
echo "=== Testing Health Endpoints ==="
curl -s "https://$APP_SERVICE_NAME.azurewebsites.net/health" | jq .
curl -s "https://$SWA_HOSTNAME/api/health" | jq .
```

✅ **Checkpoint:** Both health endpoints return `{"status":"healthy"}`. Frontend loads in browser.

---

<details>
<summary>🚀 <strong>[Advanced] GitHub Actions Deployment (Alternative - Not Verified)</strong></summary>

> ⚠️ **Note:** This section describes CI/CD deployment using GitHub Actions. This method has not been fully verified and is provided as an alternative for teams who prefer automated deployments.

GitHub Actions can automate deployments on every push to the main branch.

**Prerequisites:**
- Your own repository created from this template (see [Section 2.1.4](#214-clone-the-repository) tip)
- GitHub Actions enabled for your repository

This repository includes workflow **templates** (not enabled by default):
- `.github/workflow-templates/deploy-backend.yml` (App Service)
- `.github/workflow-templates/deploy-frontend.yml` (Static Web Apps)

To enable CI/CD in *your* repository, copy the templates into `.github/workflows/`.

```bash
mkdir -p .github/workflows
cp .github/workflow-templates/deploy-backend.yml .github/workflows/
cp .github/workflow-templates/deploy-frontend.yml .github/workflows/
```

### Trigger behavior

- If a commit changes `materials/backend/**`, **only** the backend workflow runs.
- If a commit changes `materials/frontend/**`, **only** the frontend workflow runs.
- If a commit changes other paths only, **no workflows run**.

The backend workflow supports **OIDC (default)** and **Service Principal secret (optional)**.

---

## Step 1 (Default): Configure Azure login via OIDC (Federated Credentials)

OIDC is the modern and recommended approach because it avoids storing a long-lived Azure client secret in GitHub.

### 1.1 Create an Entra app for GitHub Actions

```bash
# Set values
SUBSCRIPTION_ID="<subscription-id>"
RESOURCE_GROUP="<Resource-Group-Name>"

# Your GitHub repo, e.g. "hironariy/Azure-PaaS-Workshop"
GITHUB_REPO="<owner>/<repo>"

# Create an app registration and service principal
AZURE_CLIENT_ID=$(az ad app create \
  --display-name "github-actions-blogapp-<TeamName>" \
  --query appId -o tsv)

az ad sp create --id "$AZURE_CLIENT_ID" 1>/dev/null
echo "AZURE_CLIENT_ID=$AZURE_CLIENT_ID"
```

### 1.2 Add a federated credential for GitHub Actions

This binds token exchange to your repository and `main` branch.

```bash
cat > federated-credential.json <<JSON
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:ref:refs/heads/main",
  "description": "GitHub Actions (main branch)",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON

az ad app federated-credential create \
  --id "$AZURE_CLIENT_ID" \
  --parameters federated-credential.json
```

### 1.3 Grant RBAC to the resource group

```bash
SP_OBJECT_ID=$(az ad sp show --id "$AZURE_CLIENT_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
```

---

## Step 2: Configure GitHub Actions Variables/Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions**.

> **💡 Use Repository-level, not Environment-level.**
> Add all variables under the **"Variables"** tab and secrets under the **"Secrets"** tab at the **Repository** level (the default view). Do **not** create a GitHub Environment — the workflow templates don't use one, and repository-level is sufficient for this single-environment workshop.

### Variables

| Variable | Value |
|----------|-------|
| `AZURE_CLIENT_ID` | The value printed in Step 1.1 |
| `AZURE_TENANT_ID` | Your Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | Your resource group name |
| `AZURE_WEBAPP_NAME` | Your App Service name |
| `ENTRA_TENANT_ID` | Tenant ID (used by frontend runtime config injection) |
| `ENTRA_FRONTEND_CLIENT_ID` | Frontend SPA app client ID |
| `ENTRA_BACKEND_CLIENT_ID` | Backend API app client ID |

### Secrets

| Secret | Value |
|--------|-------|
| `SWA_DEPLOYMENT_TOKEN` | SWA deployment token |

Get `SWA_DEPLOYMENT_TOKEN` from Azure:

```bash
SWA_NAME=$(az staticwebapp list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv)
az staticwebapp secrets list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query "properties.apiKey" -o tsv
```

---

## Step 3: Trigger Deployment

Each workflow only runs when files under its watched path change:

| Workflow | Trigger path |
|----------|-------------|
| `deploy-backend.yml` | `materials/backend/**` |
| `deploy-frontend.yml` | `materials/frontend/**` |

**Option A — Push a change to the watched path:**

```bash
# Example: trigger the backend workflow
# Make any small change inside materials/backend/ (e.g., add a comment)
git add materials/backend/
git commit -m "Trigger backend deployment"
git push
```

**Option B — Manual trigger (no code change required):**

Both workflows include `workflow_dispatch`, so you can run them from the GitHub UI:

1. Go to your repository → **Actions** tab
2. Select the workflow (e.g., **Deploy Backend**)
3. Click **"Run workflow"** → choose the `main` branch → **"Run workflow"**

Or use the GitHub CLI:

```bash
gh workflow run deploy-backend.yml --ref main
gh workflow run deploy-frontend.yml --ref main
```

---

## (Optional Fallback): Service Principal Secret (`AZURE_CREDENTIALS`)

If you can’t use OIDC in your tenant/policy, you can use a classic service principal secret instead.

1. Create a service principal scoped to your resource group:

```bash
az ad sp create-for-rbac \
  --name "github-actions-blogapp-<TeamName>" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<Resource-Group-Name> \
  --json-auth
```

2. Add a GitHub Actions secret:

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | JSON output from the command above |

The backend workflow will automatically use `AZURE_CREDENTIALS` only if OIDC variables are not set.

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

**Windows (WSL Ubuntu):**
```bash
# Backend health (direct)
curl -s "https://<app-service-name>.azurewebsites.net/health" | jq .

# Backend health (via SWA Linked Backend)
curl -s "https://<swa-hostname>.azurestaticapps.net/api/health" | jq .
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
az group delete --name <Resource-Group-Name> --yes --no-wait

# Optional: Delete Entra ID app registrations
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
```

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
az group delete --name <Resource-Group-Name> --yes --no-wait
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
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
| Login fails with `AADSTS900144` (missing `client_id`) | Frontend runtime config not injected (or injected as empty) | Re-run Step 6 frontend deploy from WSL and ensure `deploy-frontend.local.env` has values |
| API calls fail with 404 | Linked Backend not configured | Check SWA configuration in Azure Portal |
| `tsc: not found` during deploy | Remote build enabled | Set `SCM_DO_BUILD_DURING_DEPLOYMENT=false` |
| Backend fails after ZIP deploy from Windows native shell | ZIP was created outside WSL and contains Windows-style paths | Re-run backend deployment from WSL using `./scripts/deploy-backend.sh` |

### Viewing Logs

**macOS/Linux:**
```bash
# Stream live logs
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

# Download logs
az webapp log download \
  --resource-group <Resource-Group-Name> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

**Windows (WSL Ubuntu):**
```bash
# Same commands as macOS/Linux
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

az webapp log download \
  --resource-group <Resource-Group-Name> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

---

## 8. Quick Reference Card

Copy this section and fill in your values for quick reference:

```
=== Azure PaaS Workshop - Quick Reference ===

Resource Group:     <Resource-Group-Name>
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
az resource list --resource-group <Resource-Group-Name> --output table

# Stream logs
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

# Cleanup
az group delete --name <Resource-Group-Name> --yes --no-wait
```

---

## 📝 License

This workshop is provided under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

This workshop was created to help developers learn Azure PaaS services through hands-on experience.

**Companion Workshop:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) - Complete both for a comprehensive understanding of Azure!

If you find this workshop helpful, please ⭐ star this repository!
