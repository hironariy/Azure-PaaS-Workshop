# Azure PaaS Workshop - Multi-User Blog Application

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English version: [README.md](./README.md)

本リポジトリは、Azure の PaaS パターンを学ぶためのハンズオンワークショップです。実運用を意識した構成で、Web アプリケーションを Azure 上にデプロイします。

> 📚 **Workshop Series - Day 2**
>
> このワークショップは **2日間の Azure ワークショップシリーズ**の Day 2（PaaS）です。
>
> | Day | Workshop | Focus |
> |-----|----------|-------|
> | **Day 1** | [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) | Virtual Machines, Load Balancers, Availability Zones |
> | **Day 2** | **Azure PaaS Workshop** (this repository) | App Service, Static Web Apps, Azure DocumentDB, Managed Services |
>
> 2日通して実施すると、IaaS と PaaS のアーキテクチャ/運用の違いを体系的に理解できます。

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

このワークショップは、**Azure Platform as a Service (PaaS)** の設計・デプロイ・運用の要点を、実践的に学ぶことを目的としています。

**対象者（想定）:**
- 実務経験 3〜5 年程度のエンジニア（特に AWS 経験者）
- Azure 資格（AZ-104, AZ-305 など）を目指す方
- IaaS から PaaS へ移行/モダナイズを検討しているチーム

**関連ワークショップ:** Day 1 の [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) の PaaS 版です。Day 1 を実施済みの場合、同一アプリを IaaS / PaaS で比較しながら学べます。

> 🎓 **For Instructors:** 教えどころ・よくある詰まりポイントは [Instructor Guide](docs/instructor-guide.ja.md) を参照してください。

### 1.2 What You Will Learn

このワークショップでは、次のトピックを体験します。

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

**Discussion Question:** 開始前にグループで話してみてください。
- これまで使った PaaS（Azure/AWS/その他）は？
- IaaS（Day 1）と比べて、何が変わると想像する？
- マネージドサービスに対して不安/懸念はある？

</details>

### 1.3 Application Overview

サンプルアプリは **マルチユーザー対応のブログプラットフォーム**です。

**全ユーザー（公開）:**
- 📖 投稿一覧の閲覧
- 🔍 投稿詳細（著者情報含む）の閲覧

**認証ユーザー:**
- ✍️ 自分の投稿の作成/編集/削除
- 📝 下書き保存
- 👤 プロフィールの管理・自分の投稿一覧

**Technology Stack:**

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, Vite |
| Backend | Node.js 22, Express.js, TypeScript |
| Database | Azure DocumentDB (formerly called as Cosmos DB for MongoDB vCore) |
| Authentication | Microsoft Entra ID with MSAL.js |

### 1.4 Architecture Overview

![Architecture Diagram](assets/images/architecture.png)

> 📝 **Note:** アーキテクチャ図は追記予定です。Static Web Apps、App Service、Azure DocumentDB、プライベートネットワークで構成されます。

**使用する主要 Azure サービス:**

| Service | Purpose |
|---------|---------|
| **Static Web Apps** | React フロントエンドのホスティング（CDN） |
| **App Service** | Node.js API バックエンド（VNet 統合） |
| **Azure DocumentDB** | MongoDB 互換のマネージド DB |
| **Key Vault** | 接続文字列やシークレットの安全な保管 |
| **Virtual Network** | ネットワーク分離 |
| **Private Endpoints** | DB/Key Vault をインターネット非公開に |
| **NAT Gateway** | VNet 統合サービスの outbound |
| **Application Insights** | 監視/可観測性 |

---

## 2. How to Deploy

このセクションでは、Azure にアプリをデプロイする手順を説明します。

> **📝 ローカル開発を探している場合**
> [Section 2.2](#22-local-development-environment-optional) または [Local Development Guide](docs/local-development-setup.ja.md) を参照してください。

### 2.1 Prerequisites

開始前に、必要なツールとアカウントを準備します。

#### 2.1.1 Required Tools

以下のツールをインストールしてください。

**All Platforms:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Git** | 2.x+ | バージョン管理 | [Download](https://git-scm.com/) |
| **VS Code** | Latest | エディタ（推奨） | [Download](https://code.visualstudio.com/) |

**macOS/Linux:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure CLI** | 2.60+ | Azure 管理 | [Install Guide](https://docs.microsoft.com/cli/azure/install-azure-cli) |
| **Node.js** | 22.x LTS | ビルド（フロント/バック） | [Download](https://nodejs.org/) |
| **SWA CLI** | Latest | Static Web Apps へデプロイ | `npm install -g @azure/static-web-apps-cli` |

**Windows:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Git Bash** | Latest | デプロイスクリプト実行 | [Git for Windows](https://git-scm.com/download/win) に同梱 |
| **Azure PowerShell** | 12.0+ | Azure 管理 | [Install Guide](https://docs.microsoft.com/powershell/azure/install-azure-powershell) |
| **Bicep CLI** | Latest | IaC | [Install Guide](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install#windows) |
| **Node.js** | 22.x LTS | ビルド | [Download](https://nodejs.org/) |
| **SWA CLI** | Latest | SWA デプロイ | `npm install -g @azure/static-web-apps-cli` |
| **Azure CLI** | 2.60+ | デプロイスクリプト用 | [Install Guide](https://docs.microsoft.com/cli/azure/install-azure-cli) |

> **⏱️ Note: Azure PowerShell Installation Time**
> Azure PowerShell のインストールは **5-15 分**かかることがあります。完了まで待ってから進めてください。
> - 管理者権限がない場合は `-Scope CurrentUser` を使ってください:
>   ```powershell
>   Install-Module -Name Az -Repository PSGallery -Force -Scope CurrentUser
>   ```

> **⚠️ Important: Bicep CLI Required for Windows**
> Azure CLI には Bicep が同梱/自動導入されますが、Azure PowerShell では別途 Bicep CLI のインストールが必要です。
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
> インストール後、ターミナルを開き直して確認:
> ```powershell
> bicep --version
> # Expected: Bicep CLI version 0.x.x
> ```

> **⚠️ Windows Users: Azure CLI Required for Deployment Scripts**
> `deploy-backend.sh` / `deploy-frontend.sh` は Azure CLI を使用します。Windows は **Git Bash** または **WSL** で実行するか、記載の PowerShell 代替手順を使ってください。

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
# Expected: v22.x.x

# Check SWA CLI
swa --version
# Expected: 2.x.x

# Check Azure CLI (for deployment scripts)
az --version
# Expected: azure-cli 2.60.x or newer
```

> **📝 Need Docker?** Docker は [local development](#22-local-development-environment-optional) のみで必要です。Azure へのデプロイだけなら不要です。

✅ **Checkpoint:** 必要ツールがインストールできた。

#### 2.1.2 Required Accounts

必要なアカウントは以下です。

| Account | Purpose | How to Get |
|---------|---------|------------|
| **Microsoft Azure** | クラウド | [Free Account](https://azure.microsoft.com/free/)。サブスクリプションと Owner/Contributor 権限が必要です。 |
| **Microsoft Entra ID** | 認証 | Azure に付属 |
| **GitHub** (optional) | クローン / CI/CD | [Sign Up](https://github.com/join) |

> **💡 Tip:** 新規 Azure アカウントは $200 クレジットが付与されます（条件は変わる可能性があります）。

#### 2.1.3 Required Permissions for Entra ID

> ⚠️ **IMPORTANT: Check Your Permissions Before Starting**
>
> Entra ID でアプリ登録を作るには、以下のいずれかが必要です。
>
> | Role/Setting | Who Has It |
> |--------------|------------|
> | **Application Developer** role | IT 管理者が付与 |
> | **Cloud Application Administrator** role | IT 管理者が付与 |
> | **Global Administrator** role | テナント管理者 |
> | **"Users can register applications"** = Yes | 既定テナント設定（無効化されていることも） |
>
> **確認方法:**
> 1. [Azure Portal](https://portal.azure.com) → Microsoft Entra ID → App registrations
> 2. "+ New registration" を押す
> 3. 登録フォームが出れば OK ✅
> 4. エラーやボタン無効なら IT 管理者へ相談 ❌
>
> **ワークショップ運営向け:**
> 参加者がアプリ登録できない場合:
> 1. IT 管理者に "Application Developer" を付与してもらう
> 2. 事前にアプリ登録を作成し、Client ID を配布する
>
> **個人/無料 Azure アカウントの場合:**
> 多くの場合、自分がテナント管理者になり追加設定なしで作成できます。

#### 2.1.4 Clone the Repository

リポジトリをローカルにクローンします。

**macOS/Linux:**
```bash
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

**Windows PowerShell:**
```powershell
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

> **💡 Planning to use GitHub Actions?**
> 後で CI/CD（[Advanced: GitHub Actions Deployment](#-advanced-github-actions-deployment-alternative---not-verified)）を使う場合は、テンプレートから自分のリポジトリを作るのがおすすめです。
> 1. https://github.com/hironariy/Azure-PaaS-Workshop を開く
> 2. **"Use this template"** → **"Create a new repository"**
> 3. Visibility を **Public**（無料 Actions 前提の場合）
> 4. 自分のリポジトリをクローン: `git clone https://github.com/YOUR_USERNAME/Azure-PaaS-Workshop.git`

✅ **Checkpoint:** リポジトリをクローンできた。

#### 2.1.5 Microsoft Entra ID App Registrations

Microsoft Entra ID で **2つのアプリ登録**を作成します（Azure デプロイでもローカル開発でも必要です）。

> **なぜ 2つ？**
> - **Frontend App**: ブラウザ側（MSAL.js）でログイン
> - **Backend API App**: JWT を検証し API を保護

**Step-by-step guide:**

<details>
<summary>📝 Click to expand: Create Frontend App Registration</summary>

1. **Open Azure Portal**
   - [portal.azure.com](https://portal.azure.com) を開く
   - Microsoft アカウントでサインイン

2. **Navigate to Entra ID**
   - 上部検索で "Entra ID" を検索
   - "Microsoft Entra ID" を開く

3. **Create App Registration**
   - 左メニュー "Manage" > "App registrations"
   - "+ New registration"

4. **Configure the App**
   - **Name**: `BlogApp Frontend <Team-Name> (PaaS)`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**:
     - ドロップダウンで **"Single-page application (SPA)"**
     - `http://localhost:5173`

   > ⚠️ **CRITICAL**: 必ず **SPA** を選択してください（"Web" は不可）。
   > "Web" にすると `AADSTS9002326` で失敗します。

5. **Click "Register"**

6. **Copy Important Values**
   - **Application (client) ID**: `VITE_ENTRA_CLIENT_ID` / `entraFrontendClientId`
   - **Directory (tenant) ID**: `VITE_ENTRA_TENANT_ID` / `entraTenantId`

</details>

<details>
<summary>📝 Click to expand: Create Backend API App Registration</summary>

1. **Create Another App Registration**
   - "App registrations" に戻り "+ New registration"

2. **Configure the App**
   - **Name**: `BlogApp API <Team-Name> (PaaS)`
   - **Supported account types**: "Accounts in this organizational directory only"
   - **Redirect URI**: 空（API は不要）

3. **Click "Register"**

4. **Copy the Application (client) ID**
   - `ENTRA_CLIENT_ID` / `entraBackendClientId`
   - `VITE_API_CLIENT_ID` としても使用

5. **Expose an API Scope**
   - 左メニュー "Manage" > "Expose an API"
   - "Add a scope"
   - Application ID URI は既定のまま "Save and continue"
   - スコープ:
     - **Scope name**: `access_as_user`
     - **Who can consent**: Admins and users
     - **Admin consent display name**: `Access BlogApp API`
     - **Admin consent description**: `Allows the app to access BlogApp API on behalf of the signed-in user`
   - "Add scope"

</details>

<details>
<summary>📝 Click to expand: Grant Frontend Permission to Call Backend API</summary>

1. **Go to Frontend App Registration**
   - `BlogApp Frontend <Team-Name> (PaaS)` を開く

2. **Add API Permission**
   - 左メニュー "API permissions"
   - "+ Add a permission"
   - "APIs my organization uses"（または "My APIs"）
   - `BlogApp API <Team-Name> (PaaS)` を選択
   - `access_as_user` にチェック
   - "Add permissions"

3. **(Optional) Grant Admin Consent**
   - 管理者なら "Grant admin consent" を実行

</details>

**Summary of Values You'll Need:**

| Value | Where to Find | Used For |
|-------|---------------|----------|
| `entraTenantId` | Directory (tenant) ID | Bicep parameter |
| `entraFrontendClientId` | Frontend app client ID | Bicep parameter |
| `entraBackendClientId` | Backend app client ID | Bicep parameter |

✅ **Checkpoint:** 3つの ID を控えた。

---

### 2.2 Local Development Environment (Optional)

> **📖 Full Guide:** ローカル開発の詳細は [Local Development Guide](docs/local-development-setup.ja.md) を参照してください。

ローカル開発は追加ツール（Docker など）が必要ですが、以下に役立ちます。
- コード修正とデバッグ
- Azure へデプロイする前の動作確認
- アプリ構成の理解

Azure へデプロイするだけなら、次へ進んでください。

---

### 2.3 Azure Deployment

以下の手順で Azure へデプロイします。

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

> **💡 Multiple Tenants?**
> 複数テナントにアクセスできる場合は tenant 指定が必要なことがあります。
>
> **Azure CLI:**
> ```bash
> az login --tenant "your-tenant-id-or-domain.onmicrosoft.com"
> ```
>
> **Azure PowerShell:**
> ```powershell
> Connect-AzAccount -Tenant "your-tenant-id"
> Set-AzContext -Tenant "your-tenant-id" -Subscription "Your Subscription Name"
> ```

✅ **Checkpoint:** Azure にログインできた。

#### Step 2: Configure Bicep Parameters

**macOS/Linux:**
```bash
# Navigate to bicep folder
cd materials/bicep

# Copy template to local file (gitignored)
cp dev.bicepparam dev.local.bicepparam

# Edit with your values
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
| `entraTenantId` | Entra テナント ID | Azure Portal → Entra ID → Overview |
| `entraBackendClientId` | Backend API client ID | Step 2.1.5 |
| `entraFrontendClientId` | Frontend SPA client ID | Step 2.1.5 |
| `cosmosDbAdminPassword` | DB 管理者パスワード | 生成: `openssl rand -base64 16` |

Generate `cosmosDbAdminPassword` with `openssl`:

**macOS/Linux:**
```bash
openssl rand -base64 16
```

**Windows (Git Bash):**
```bash
openssl rand -base64 16
```

> **Windows note (if `openssl` is not installed):**
> PowerShell でも同等の強度で生成できます:
> ```powershell
> $bytes = New-Object byte[] 16
> [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
> [Convert]::ToBase64String($bytes)
> ```

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

✅ **Checkpoint:** `dev.local.bicepparam` を作成できた。

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

**Windows PowerShell:**
```powershell
New-AzResourceGroup -Name "<Resource-Group-Name>" -Location "japaneast"

New-AzResourceGroupDeployment `
  -Name "main" `
  -ResourceGroupName "<Resource-Group-Name>" `
  -TemplateFile "main.bicep" `
  -TemplateParameterFile "dev.local.bicepparam"
```

> **💡 Multi-Group Workshops:**
> 共有サブスクリプションで衝突する場合は `groupId` を使って回避できます。

**Verify Deployment:**

**macOS/Linux:**
```bash
az resource list --resource-group <Resource-Group-Name> --output table
```

**Windows PowerShell:**
```powershell
Get-AzResource -ResourceGroupName "<Resource-Group-Name>" | Format-Table Name, ResourceType
```

✅ **Checkpoint:** Bicep デプロイが完了し、リソースが見える。

#### Step 4: Update Entra ID Redirect URIs

デプロイ後、Frontend アプリ登録に Static Web Apps の URL を追加します。

1. **Get the SWA URL:**

   **macOS/Linux:**
   ```bash
   az staticwebapp show \
     --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
     --resource-group <Resource-Group-Name> \
     --query "defaultHostname" -o tsv
   ```

   **Windows PowerShell:**
   ```powershell
   $swaName = (Get-AzStaticWebApp -ResourceGroupName "<Resource-Group-Name>")[0].Name
   (Get-AzStaticWebApp -ResourceGroupName "<Resource-Group-Name>" -Name $swaName).DefaultHostname
   ```

2. **Add Redirect URI in Azure Portal:**
   - Azure Portal → Entra ID → App registrations → `BlogApp Frontend <Team-Name> (PaaS)`
   - "Authentication"
   - "Single-page application" の Redirect URIs に追加
   - `https://<your-swa-hostname>.azurestaticapps.net`
   - Save

**Alternative (Azure CLI): Update Redirect URIs via Command Line**

> ⚠️ Notes
> - アプリ登録更新権限が必要です。
> - 既存 `spa.redirectUris` に SWA URL を **追加**して書き戻します。
> - Azure CLI は `spa={}` を同じ update 呼び出しで先にセットする必要があります。

**macOS/Linux (bash/zsh):**
```bash
FRONTEND_APP_ID="<entraFrontendClientId>"

SWA_HOSTNAME=$(az staticwebapp show \
  --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
  --resource-group <Resource-Group-Name> \
  --query "defaultHostname" -o tsv)

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

az ad app show --id "$FRONTEND_APP_ID" --query "spa.redirectUris" -o jsonc
```

**Windows (PowerShell):**
```powershell
$frontendAppId = "<entraFrontendClientId>"

$swaName = az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv
$swaHostname = az staticwebapp show --name $swaName --resource-group <Resource-Group-Name> --query "defaultHostname" -o tsv

$existing = az ad app show --id $frontendAppId --query "spa.redirectUris" -o json | ConvertFrom-Json
$toAdd = @("https://$swaHostname", "https://$swaHostname/")

$new = @($existing + $toAdd)
$new = @($new | Sort-Object -Unique)

$newPyList = '[' + (($new | ForEach-Object { "'$_'" }) -join ',') + ']'

az ad app update --id $frontendAppId --set "spa={}" --set "spa.redirectUris=$newPyList"

az ad app show --id $frontendAppId --query "spa.redirectUris" -o jsonc
```

✅ **Checkpoint:** Redirect URI に SWA URL を追加できた。

> **🚀 Prefer CI/CD?** 手動デプロイではなく GitHub Actions を使いたい場合は、[Advanced: GitHub Actions Deployment](#-advanced-github-actions-deployment-alternative---not-verified) へ進んでください。

#### Step 5: Deploy Backend to App Service

> 📖 **Script Details:** 詳細は [Deployment Scripts Guide](docs/deployment-scripts-guide.ja.md#backend-deployment-script) を参照してください。

**macOS/Linux:**
```bash
cd ../..

APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

echo "App Service Name: $APP_SERVICE_NAME"

./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME
```

**Windows (Git Bash or WSL):**
```bash
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME
```

✅ **Checkpoint:** `/health` が `{"status":"healthy"}` を返す。

#### Step 6: Deploy Frontend to Static Web Apps

> 📖 **Script Details:** 詳細は [Deployment Scripts Guide](docs/deployment-scripts-guide.ja.md#frontend-deployment-script) を参照してください。

**Setup (one-time):**

**macOS/Linux:**
```bash
cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env
code scripts/deploy-frontend.local.env
```

**Windows PowerShell:**
```powershell
Copy-Item scripts\deploy-frontend.template.env scripts\deploy-frontend.local.env
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
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

**Windows (Git Bash or WSL):**
```bash
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

✅ **Checkpoint:** SWA の URL でアプリが表示できる。

#### Step 7: Verify Deployment

**macOS/Linux:**
```bash
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

✅ **Checkpoint:** 2つの health endpoint が healthy。

---

<details>
<summary>🚀 <strong>[Advanced] GitHub Actions Deployment (Alternative - Not Verified)</strong></summary>

> ⚠️ **Note:** このセクションは GitHub Actions による CI/CD の代替手順です。完全な検証はしていないため、必要に応じて読み替えてください。

GitHub Actions により、main ブランチへの push で自動デプロイできます。

**Prerequisites:**
- テンプレートから作成した自分のリポジトリ（[Section 2.1.4](#214-clone-the-repository) の Tip 参照）
- GitHub Actions が有効

このリポジトリには **workflow templates**（既定では無効）が含まれています:
- `.github/workflow-templates/deploy-backend.yml`（App Service）
- `.github/workflow-templates/deploy-frontend.yml`（Static Web Apps）

有効化するには `.github/workflows/` にコピーします。

```bash
mkdir -p .github/workflows
cp .github/workflow-templates/deploy-backend.yml .github/workflows/
cp .github/workflow-templates/deploy-frontend.yml .github/workflows/
```

### Trigger behavior

- `materials/backend/**` に変更があるとバックエンドだけが動きます。
- `materials/frontend/**` に変更があるとフロントエンドだけが動きます。
- それ以外の変更のみでは、workflow は動きません。

バックエンド workflow は **OIDC（既定）** と **Service Principal secret（任意）** をサポートします。

---

## Step 1 (Default): Configure Azure login via OIDC (Federated Credentials)

OIDC は長期シークレットを GitHub に保存しないため推奨です。

### 1.1 Create an Entra app for GitHub Actions

```bash
SUBSCRIPTION_ID="<subscription-id>"
RESOURCE_GROUP="<Resource-Group-Name>"

GITHUB_REPO="<owner>/<repo>"

AZURE_CLIENT_ID=$(az ad app create \
  --display-name "github-actions-blogapp-<TeamName>" \
  --query appId -o tsv)

az ad sp create --id "$AZURE_CLIENT_ID" 1>/dev/null
echo "AZURE_CLIENT_ID=$AZURE_CLIENT_ID"
```

### 1.2 Add a federated credential for GitHub Actions

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

GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**。

> **💡 Use Repository-level, not Environment-level.**
> workflow templates は GitHub Environment を使わないため、Repository レベル（既定）の Variables/Secrets で十分です。

### Variables

| Variable | Value |
|----------|-------|
| `AZURE_CLIENT_ID` | Step 1.1 で表示された値 |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | subscription ID |
| `AZURE_RESOURCE_GROUP` | resource group name |
| `AZURE_WEBAPP_NAME` | App Service name |
| `ENTRA_TENANT_ID` | frontend runtime config 用 |
| `ENTRA_FRONTEND_CLIENT_ID` | frontend SPA client ID |
| `ENTRA_BACKEND_CLIENT_ID` | backend API app client ID |

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

各 workflow は監視パス配下の変更があった場合にのみ自動実行されます。

| Workflow | Trigger path |
|----------|-------------|
| `deploy-backend.yml` | `materials/backend/**` |
| `deploy-frontend.yml` | `materials/frontend/**` |

**Option A — 監視パス配下に変更を push:**

```bash
# Example: trigger the backend workflow
# materials/backend/ 配下で小さな変更を作り commit/push する
git add materials/backend/
git commit -m "Trigger backend deployment"
git push
```

**Option B — 手動実行（コード変更不要）:**

workflow templates は `workflow_dispatch` を含むため、GitHub UI から実行できます。

1. リポジトリ → **Actions**
2. 対象 workflow（例: Deploy Backend）を選択
3. **Run workflow** → `main` を選択 → 実行

または GitHub CLI:

```bash
gh workflow run deploy-backend.yml --ref main
gh workflow run deploy-frontend.yml --ref main
```

---

## (Optional Fallback): Service Principal Secret (`AZURE_CREDENTIALS`)

OIDC が使えない場合のフォールバックとして、サービスプリンシパルのシークレット（JSON）を使えます。

1. RG にスコープした SP を作成:

```bash
az ad sp create-for-rbac \
  --name "github-actions-blogapp-<TeamName>" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<Resource-Group-Name> \
  --json-auth
```

2. GitHub Actions secret を追加:

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | 上の JSON 出力 |

バックエンド workflow は、OIDC 変数が未設定の場合にのみ `AZURE_CREDENTIALS` を使用します。

</details>

---

## 3. Testing the Application

### 3.1 Health Check

**macOS/Linux:**
```bash
curl -s "https://<app-service-name>.azurewebsites.net/health" | jq .
curl -s "https://<swa-hostname>.azurestaticapps.net/api/health" | jq .
```

**Windows PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://<app-service-name>.azurewebsites.net/health"
Invoke-RestMethod -Uri "https://<swa-hostname>.azurestaticapps.net/api/health"
```

✅ **Checkpoint:** 200 OK。

### 3.2 Authentication Test

1. `https://<swa-hostname>.azurestaticapps.net` を開く
2. "Sign In" をクリック
3. Microsoft ログインへ遷移
4. ログイン後、プロフィールが表示される

✅ **Checkpoint:** ログインできる。

### 3.3 CRUD Operations Test

ログイン後:

1. **Create Post:** "New Post" → 入力 → "Publish"
2. **View Post:** タイトルをクリック
3. **Edit Post:** "Edit" → 変更 → 保存
4. **Delete Post:** "Delete" → 確認

✅ **Checkpoint:** CRUD が動作。

---

## 4. IaaS vs PaaS Comparison

（内容は英語版 README と同じ構成です。必要に応じて比較しながら読み進めてください。）

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

**IaaS (MongoDB Replica Set):**
```typescript
const uri = "mongodb://user:pass@10.0.3.4:27017,10.0.3.5:27017,10.0.3.6:27017/blogdb?replicaSet=rs0";
```

**PaaS (Azure DocumentDB):**
```typescript
const uri = process.env.COSMOSDB_CONNECTION_STRING;
```

### 4.3 Frontend Code Differences

**IaaS:**
```typescript
const response = await fetch('/config.json');
const config = await response.json();
```

**PaaS:**
```typescript
const config = window.__APP_CONFIG__ || await fetchConfig();
```

---

## 5. Cost Estimate

（概算。リージョンや価格は変更される可能性があります。）

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

> ⚠️ **Important**: ワークショップ後は必ず削除して課金を防いでください。

---

## 6. Cleanup

**macOS/Linux:**
```bash
az group delete --name <Resource-Group-Name> --yes --no-wait
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
```

**Windows PowerShell:**
```powershell
Remove-AzResourceGroup -Name "<Resource-Group-Name>" -Force -AsJob
Remove-AzADApplication -ObjectId <frontend-app-object-id>
Remove-AzADApplication -ObjectId <backend-app-object-id>
```

✅ **Checkpoint:** RG が削除された。

---

## 7. Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Bicep deployment fails | Entra ID パラメータ不足 | `dev.local.bicepparam` を確認 |
| Backend returns 502 | 起動中 | 60-90秒待ってログ確認 |
| Health check returns 401 | EasyAuth が `/health` をブロック | `excludedPaths` を確認 |
| Login redirect fails | Redirect URI 不足 | フロントアプリに SWA URL を追加 |
| Login fails with `AADSTS900144` | フロント runtime config が空 | `index.html` に `window.__APP_CONFIG__={...}` が注入されているか確認 |
| API calls fail with 404 | Linked Backend 未設定 | SWA の Linked Backend を確認 |
| `tsc: not found` during deploy | リモートビルド有効 | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` を設定 |

### Viewing Logs

**macOS/Linux:**
```bash
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

az webapp log download \
  --resource-group <Resource-Group-Name> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

**Windows PowerShell:**
```powershell
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

az webapp log download `
  --resource-group <Resource-Group-Name> `
  --name <app-service-name> `
  --log-file C:\Temp\app-logs.zip
```

---

## 8. Quick Reference Card

（英語版と同じ。値を埋めてメモとして使ってください。）

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

このワークショップは [MIT License](LICENSE) で提供されています。

---

## 🙏 Acknowledgments

本ワークショップは Azure PaaS をハンズオンで学ぶために作成されました。

**Companion Workshop:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop)
