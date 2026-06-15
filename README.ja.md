# Azure PaaS ワークショップ - マルチユーザー ブログアプリケーション

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English version: [README.md](./README.md)

> **受講者向け Cloud Shell 手順:** 新しい本線は [Azure PaaS Workshop 受講者ポータル](materials/docs/index.md) です。Azure Cloud Shell (Bash) だけで Day 0 / Day 1 / Day 2 / Cleanup を進める構成に整理しています。
>
> この README のローカル開発、Windows/WSL、PowerShell、GitHub Actions の手順は、代替・発展・講師向け参照として扱ってください。

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

## 目次

- [1. はじめに](#1-introduction)
  - [1.1 ワークショップについて](#11-about-this-workshop)
  - [1.2 学べること](#12-what-you-will-learn)
  - [1.3 アプリ概要](#13-application-overview)
  - [1.4 アーキテクチャ概要](#14-architecture-overview)
- [2. デプロイ手順](#2-how-to-deploy)
  - [2.1 事前準備](#21-prerequisites)
  - [2.2 Windows Fast Path（PowerShell / WSL2不要）](#22-windows-fast-path-powershell-no-wsl2)
  - [2.3 ローカル開発環境（任意）](#23-local-development-environment-optional)
  - [2.4 標準デプロイ（Bicep + 手動デプロイ）](#24-standard-azure-deployment)
  - [2.5 上級パス: GitHub Actions（代替）](#25-advanced-path-github-actions-alternative)
- [3. アプリケーションのテスト](#3-testing-the-application)
- [4. IaaS と PaaS の比較](#4-iaas-vs-paas-comparison)
- [5. 費用見積もり（概算）](#5-cost-estimate)
- [6. クリーンアップ](#6-cleanup)
- [7. トラブルシューティング](#7-troubleshooting)
- [8. クイックリファレンス](#8-quick-reference-card)

---

## 1. はじめに <a id="1-introduction"></a>

### 1.1 ワークショップについて <a id="11-about-this-workshop"></a>

このワークショップは、**Azure Platform as a Service (PaaS)** の設計・デプロイ・運用の要点を、実践的に学ぶことを目的としています。

**対象者（想定）:**
- 実務経験 3〜5 年程度のエンジニア（特に AWS 経験者）
- Azure 資格（AZ-104, AZ-305 など）を目指す方
- IaaS から PaaS へ移行/モダナイズを検討しているチーム

**関連ワークショップ:** Day 1 の [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop) の PaaS 版です。Day 1 を実施済みの場合、同一アプリを IaaS / PaaS で比較しながら学べます。

> 🎓 **For Instructors:** 教えどころ・よくある詰まりポイントは [Instructor Guide](docs/instructor-guide.ja.md) を参照してください。

> 📘 **アーキテクチャ/運用ガイド:**
> - [BCDR ガイド](materials/docs/disaster-recovery-guide.ja.md)
> - [監視ガイド](materials/docs/monitoring-guide.ja.md)
> - [Bicep ガイド](materials/docs/bicep-guide.ja.md)
> - [IaaS 版と PaaS 版のアプリケーションコード比較ガイド](materials/docs/application-code-comparison-iaas-paas.ja.md)
> - [IaaS vs PaaS App Code Comparison Guide (EN)](materials/docs/application-code-comparison-iaas-paas.md)

### 1.2 学べること <a id="12-what-you-will-learn"></a>

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

### 1.3 アプリ概要 <a id="13-application-overview"></a>

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

### 1.4 アーキテクチャ概要 <a id="14-architecture-overview"></a>

![Architecture Diagram](assets/images/architecture.png)

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

## 2. デプロイ手順 <a id="2-how-to-deploy"></a>

このセクションでは、Azure にアプリをデプロイする手順を説明します。

> **📝 ローカル開発を探している場合**
> [Section 2.3](#23-local-development-environment-optional) または [Local Development Guide](docs/local-development-setup.ja.md) を参照してください。

> **⚡ Windows 最短導線:** PowerShell のみで短時間に進めたい場合は、[Section 2.2](#22-windows-fast-path-powershell-no-wsl2) から開始してください。

### 2.1 事前準備 <a id="21-prerequisites"></a>

開始前に、必要なツールとアカウントを準備します。

#### 2.1.1 必要なツール

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

**Windows Fast Path（PowerShell + Node.js / WSL2・GitHub Actions不要）:**

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure CLI（Windows）** | 2.60+ | App Service / Key Vault など Fast Path 用リソース作成・設定 | [Install Guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows) |
| **Bicep CLI** | Latest | Bicep テンプレートのデプロイ | `az bicep install` |
| **Node.js（Windows）** | 22.x LTS | フロントエンドの build / deploy（npm 含む） | [Download](https://nodejs.org/) |
| **PowerShell** | 7.x+ | Fast Path コマンドの実行 | [Install Guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) |

<details>
<summary><strong>Windows（GitHub Actions を使わない場合 / WSL2 利用）</strong></summary>

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **WSL 2** | Latest | すべてのコマンドを Linux で実行するため | [Install Guide](https://learn.microsoft.com/windows/wsl/install) |
| **Ubuntu (on WSL)** | 22.04+ | 推奨ディストリビューション | [Get Ubuntu](https://apps.microsoft.com/detail/9PN20MSR04DW) |
| **Azure CLI** | 2.60+ | Azure 管理（WSL 内） | [Install Guide](https://learn.microsoft.com/cli/azure/install-azure-cli-linux) |
| **Node.js** | 22.x LTS | ビルド（WSL 内） | [NodeSource Guide](https://learn.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-wsl) |
| **SWA CLI** | Latest | SWA デプロイ（WSL 内） | `npm install -g @azure/static-web-apps-cli` |
| **jq** | Latest | JSON 出力確認 | `sudo apt-get install -y jq` |

</details>

<details>
<summary><strong>Windows（GitHub Actions を使う場合 / WSL2 不要）</strong></summary>

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Azure CLI（Windows）** | 2.60+ | Azure 管理と初期セットアップ確認（Windows ネイティブ） | [Install Guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows) |
| **Node.js（Windows）** | 22.x LTS | 変更を push する前のローカル build/test（Windows ネイティブ） | [Download](https://nodejs.org/) |
| **GitHub CLI (`gh`)** | Latest | Workflow の実行・確認・手動起動 | [Install Guide](https://cli.github.com/) |
| **PowerShell** | 7.x+ | Windows でセットアップ系コマンドを実行 | [Install Guide](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) |

</details>

> このツールセットは、企業のセキュリティポリシーで WSL2 を利用できない環境を想定しています。

<details>
<summary>⚠️ Azure CLI: デプロイスクリプトで必須</summary>

`deploy-backend.sh` / `deploy-frontend.sh` は Linux シェル前提です。
Windows では **WSL2 Ubuntu** で実行してください。

</details>

<details>
<summary>📦 ZIP 作成について</summary>

バックエンド ZIP はスクリプト側で作成されます。
WSL 実行で Linux 互換の ZIP が作成されます。

</details>

<details>
<summary>💡 WSL2 で Azure CLI / az bicep を使うときのヒント</summary>

Windows + WSL2 Ubuntu で作業するときのチェックリストです。

1. **WSL 内では Linux 版 Azure CLI を使う（Windows 版を使わない）。**
  ```bash
  which az
  type -a az
  ```
  期待値の例: `/usr/bin/az`
  `/mnt/c/...` が出る場合は Windows 版 Azure CLI を参照しています。

2. **`az bicep version` で WinError 193 が出る場合は、WSL 側で Bicep を再インストール。**
  ```bash
  rm -f ~/.azure/bin/bicep ~/.azure/bin/bicep.exe
  az bicep install
  az bicep version
  ```

3. **Bicep を最新版に更新。**
  ```bash
  az bicep upgrade
  ```

4. **ブラウザログインが使えない環境では device code ログインを使う。**
  ```bash
  az login --use-device-code
  ```

5. **`which az` が `/mnt/c/...` のままなら、Linux パスを優先。**
  ```bash
  echo 'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH' >> ~/.bashrc
  source ~/.bashrc
  hash -r
  which az
  ```

6. **デプロイスクリプト実行前の推奨確認コマンド:**
  ```bash
  az version
  az bicep version
  az account show --output table
  ```

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

**Windows Fast Path（PowerShell + Node.js）:**
```powershell
# Check Azure CLI
az --version
# Expected: azure-cli 2.60.x or newer

# Check Bicep
az bicep version
# Expected: Bicep CLI version 0.x.x

# Check Node.js
node --version
# Expected: v22.x.x

# Check npm
npm --version
# Expected: 10.x.x or newer

# Check PowerShell
pwsh --version
# Expected: PowerShell 7.x.x
```

<details>
<summary><strong>Windows（WSL2 Ubuntu）</strong></summary>

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

</details>

<details>
<summary><strong>Windows（GitHub Actions を使う場合 / WSL2 不要）</strong></summary>

```powershell
# Check Git
git --version
# Expected: git version 2.x.x

# Check Azure CLI
az --version
# Expected: azure-cli 2.60.x or newer

# Check Node.js
node --version
# Expected: v22.x.x

# Check GitHub CLI
gh --version
# Expected: gh version 2.x.x

# Check PowerShell
pwsh --version
# Expected: PowerShell 7.x.x
```

</details>

> **📝 Need Docker?** Docker は [local development](#23-local-development-environment-optional) のみで必要です。Azure へのデプロイだけなら不要です。

✅ **Checkpoint:** 必要ツールがインストールできた。

#### 2.1.2 必要なアカウント

必要なアカウントは以下です。

| Account | Purpose | How to Get |
|---------|---------|------------|
| **Microsoft Azure** | クラウド | [Free Account](https://azure.microsoft.com/free/)。サブスクリプションと Owner/Contributor 権限が必要です。 |
| **Microsoft Entra ID** | 認証 | Azure に付属 |
| **GitHub** (optional) | クローン / CI/CD | [Sign Up](https://github.com/join) |

> **💡 Tip:** 新規 Azure アカウントは $200 クレジットが付与されます（条件は変わる可能性があります）。

#### 2.1.3 Entra ID の必要権限

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

#### 2.1.4 リポジトリのクローン <a id="214-clone-the-repository"></a>

リポジトリをローカルにクローンします。

**macOS/Linux:**
```bash
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

**Windows (WSL2 Ubuntu):**
```bash
# Clone the repository
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git

# Navigate to the project folder
cd Azure-PaaS-Workshop
```

> **💡 Planning to use GitHub Actions?**
> 後で CI/CD（[上級パス: GitHub Actions](#25-advanced-path-github-actions-alternative)）を使う場合は、テンプレートから自分のリポジトリを作るのがおすすめです。
> 1. https://github.com/hironariy/Azure-PaaS-Workshop を開く
> 2. **"Use this template"** → **"Create a new repository"**
> 3. Visibility を **Public**（無料 Actions 前提の場合）
> 4. 自分のリポジトリをクローン: `git clone https://github.com/YOUR_USERNAME/Azure-PaaS-Workshop.git`

✅ **Checkpoint:** リポジトリをクローンできた。

#### 2.1.5 Microsoft Entra ID のアプリ登録

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

### 2.2 Windows Fast Path（PowerShell + Azure CLI + Node.js で完結 / WSL2不要） <a id="22-windows-fast-path-powershell-no-wsl2"></a>

このパスは、Windows ユーザーが **WSL2 / GitHub Actions なし** で短時間にハンズオンを完了するための最短導線です。
（同等の手順は macOS/Linux でも bash コマンドに置き換えて実行できます。）

**このパスの特徴:**
- 講師が事前に用意した **Docker Hub の公開済みコンテナイメージ** を使用
- **Azure CLI + PowerShell + Node.js(npm)** で実施
- ローカルビルド、ローカル Docker、CI/CD 構築をスキップ

**推奨対象:**
- Linux シェルや WSL2 に不慣れな受講者
- 限られた時間で PaaS の体験を優先したいクラス

#### Fast Path 手順

1. **Azure にログインし、サブスクリプションを選択**
  ```powershell
  az login
  az account set --subscription "<Your Subscription Name>"
  ```

  > **💡 複数テナントを利用している場合:** [Multiple Tenants? の Tips](#multiple-tenants-tip) を参照してください。

2. **FastPath 用の Bicep パラメータを準備**
  ```powershell
  Set-Location materials/bicep
  Copy-Item .\dev.fastpath.bicepparam .\dev.fastpath.local.bicepparam
  code .\dev.fastpath.local.bicepparam
  ```

  `dev.fastpath.local.bicepparam` に以下を設定してください:
  - `appServiceContainerImage`（digest 固定推奨）
  - `entraTenantId`, `entraBackendClientId`, `entraFrontendClientId`
  - `cosmosDbAdminPassword`

  > **Note:** カスタムイメージを使う場合は、コンテナの起動コマンドとビルド成果物のパスが一致していることを確認してください（例: `dist/src/app.js`）。

  > **💡 CosmosDB パスワード生成の Tips:** [Required Parameters の生成コマンド](#required-parameters-tip) を参照してください。

3. **Bicep で Azure リソースをデプロイ（FastPath モード）**
  ```powershell
  $rg = "<Resource-Group-Name>"
  az group create --name $rg --location japaneast

  az deployment group create `
    --resource-group $rg `
    --template-file .\main.bicep `
    --parameters .\dev.fastpath.local.bicepparam
  ```

  このデプロイで、Bicep によりワークショップで必要なリソース一式（DocumentDB / Key Vault / App Service / Static Web Apps / ネットワーク / 監視）を作成します。

  > **重要:** デプロイ後は、SWA ドメインを Entra ID のリダイレクト先に追加してください。手順は [手順 4: Entra ID の Redirect URI を更新](#step4-update-redirect-uri) を参照してください。

4. **（Git Bash 不要）PowerShell でフロントエンドをデプロイ**
  > この手順では、Windows PowerShell から `swa deploy` を直接実行します（`deploy-frontend.sh` は使いません）。

  ```powershell
  # One-time prerequisites
  npm install -g @azure/static-web-apps-cli

  # Move to frontend project
  Set-Location materials/frontend

  # Build frontend
  npm install
  npm run build

  # Inject runtime config into dist/index.html
  $entraTenantId = "<entraTenantId>"
  $entraFrontendClientId = "<entraFrontendClientId>"
  $entraBackendClientId = "<entraBackendClientId>"

  $configJson = (@{
    ENTRA_TENANT_ID = $entraTenantId
    ENTRA_FRONTEND_CLIENT_ID = $entraFrontendClientId
    ENTRA_BACKEND_CLIENT_ID = $entraBackendClientId
    API_BASE_URL = "/api"
  } | ConvertTo-Json -Compress)

  (Get-Content .\dist\index.html -Raw).Replace('window.__APP_CONFIG__=null;', "window.__APP_CONFIG__=$configJson;") | Set-Content .\dist\index.html

  # Deploy to Static Web Apps
  $swaName = az staticwebapp list --resource-group $rg --query "[0].name" -o tsv
  $swaToken = az staticwebapp secrets list --resource-group $rg --name $swaName --query "properties.apiKey" -o tsv
  swa deploy .\dist --deployment-token $swaToken --env production
  ```

5. **まずバックエンドの動作確認**
  ```powershell
  $appServiceName = az resource list --resource-group $rg --resource-type "Microsoft.Web/sites" --query "[0].name" -o tsv

  Invoke-RestMethod "https://$appServiceName.azurewebsites.net/health" | ConvertTo-Json
  ```

6. **SWA 経由 API の確認（フロントエンドをデプロイ後）**
  ```powershell
  $swaName = az staticwebapp list --resource-group $rg --query "[0].name" -o tsv
  $swaHost = az staticwebapp show --name $swaName --resource-group $rg --query "defaultHostname" -o tsv

  Invoke-RestMethod "https://$swaHost/api/health" | ConvertTo-Json
  ```
  `/api/health` は、SWA 側にフロントエンドアーティファクトをデプロイするまで `404` になることがあります。

✅ **Checkpoint:**
- Bicep デプロイ直後に `https://<app-service>/health` が `healthy`
- フロントエンドをデプロイ後に `https://<swa-host>/api/health` が `healthy`

> **Security notes（Fast Path）:**
> - シークレットをリポジトリや設定ファイルへコミットしない
> - mutable tag より `@sha256` digest 固定を優先
> - 機密値は Key Vault 参照で渡し、平文設定を避ける

---

### 2.3 ローカル開発環境（任意） <a id="23-local-development-environment-optional"></a>

> **📖 Full Guide:** ローカル開発の詳細は [Local Development Guide](docs/local-development-setup.ja.md) を参照してください。

ローカル開発は追加ツール（Docker など）が必要ですが、以下に役立ちます。
- コード修正とデバッグ
- Azure へデプロイする前の動作確認
- アプリ構成の理解

Azure へデプロイするだけなら、次へ進んでください。

---

### 2.4 標準デプロイ（Bicep + 手動デプロイ） <a id="24-standard-azure-deployment"></a>

以下の手順で Azure へデプロイします。

> **Windows ユーザー:**
> - WSL2 を使える場合は、このセクションの **WSL2 Ubuntu** コマンドを実行してください。
> - 企業ポリシーで WSL2 が使えない場合は、下記の **Windows（WSL2 なし / PowerShell）** と GitHub Actions コマンドを使ってください。

#### 手順 1: Azure にログイン

**macOS/Linux (bash/zsh):**
```bash
# Login to Azure
az login

# Verify you're logged in
az account show

# (Optional) Set specific subscription if you have multiple
az account set --subscription "Your Subscription Name"
```

**Windows (WSL2 Ubuntu):**
```bash
# macOS/Linux と同じ
az login
az account show
az account set --subscription "Your Subscription Name"
```

**Windows（WSL2 なし / PowerShell）:**
```powershell
# Login to Azure
az login

# Verify you're logged in
az account show

# (Optional) Set specific subscription if you have multiple
az account set --subscription "Your Subscription Name"
```

<a id="multiple-tenants-tip"></a>
> **💡 Multiple Tenants?**
> 複数テナントにアクセスできる場合は tenant 指定が必要なことがあります。
>
> **Azure CLI:**
> ```bash
> az login --tenant "your-tenant-id-or-domain.onmicrosoft.com"
> ```
>
> Windows (WSL) では上記の Azure CLI を使用してください。

✅ **Checkpoint:** Azure にログインできた。

#### 手順 2: Bicep パラメータを設定

**macOS/Linux:**
```bash
# Navigate to bicep folder
cd materials/bicep

# Copy template to local file (gitignored)
cp dev.bicepparam dev.local.bicepparam

# Edit with your values
code dev.local.bicepparam
```

**Windows (WSL2 Ubuntu):**
```bash
# macOS/Linux と同じ
cd materials/bicep
cp dev.bicepparam dev.local.bicepparam
code dev.local.bicepparam
```

**Windows（WSL2 なし / PowerShell）:**
```powershell
# Navigate to bicep folder
Set-Location materials/bicep

# Copy template to local file (gitignored)
Copy-Item .\dev.bicepparam .\dev.local.bicepparam

# Edit with your values
code .\dev.local.bicepparam
```

> **FastPath モード用テンプレート（コンテナ前提）**
> - 開発向け: `materials/bicep/dev.fastpath.bicepparam`
> - 本番向け: `materials/bicep/main.fastpath.bicepparam`
>
> 例（PowerShell）:
> ```powershell
> Copy-Item .\dev.fastpath.bicepparam .\dev.fastpath.local.bicepparam
> code .\dev.fastpath.local.bicepparam
> ```

<a id="required-parameters-tip"></a>
**Required Parameters:**

| Parameter | Description | How to Get |
|-----------|-------------|------------|
| `entraTenantId` | Entra テナント ID | Azure Portal → Entra ID → Overview |
| `entraBackendClientId` | Backend API client ID | Step 2.1.5 |
| `entraFrontendClientId` | Frontend SPA client ID | Step 2.1.5 |
| `cosmosDbAdminPassword` | DB 管理者パスワード | 生成: `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='` |

Generate `cosmosDbAdminPassword` with `openssl`:

**macOS/Linux:**
```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

**Windows (WSL2 Ubuntu):**
```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

**Windows（WSL2 なし / PowerShell）:**
```powershell
# URL-safe random password（openssl コマンドと同様の意図）
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 })) -replace '\+','-' -replace '/','_' -replace '='
```

> 補足: `openssl rand -base64 16` では `/` や `+` が含まれる場合があり、MongoDB 接続文字列では URI エンコードが必要になることがあります。
> このワークショップでは接続文字列の解釈トラブルを避けるため、上記の URL セーフな生成コマンドを使ってください。

> `openssl` がない場合は、WSL で `sudo apt-get install -y openssl` を実行してください。

Example `dev.local.bicepparam`:
```bicep
using 'main.bicep'

param environment = 'dev'
param location = 'japaneast'
param entraTenantId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param entraBackendClientId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param entraFrontendClientId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
param cosmosDbAdminPassword = 'your-secure-password-here'
```

✅ **Checkpoint:** `dev.local.bicepparam` を作成できた。

#### 手順 3: Bicep でインフラをデプロイ

<details>
<summary>⚠️ Resource Provider の登録（デプロイ前の確認推奨）</summary>

サブスクリプションによっては、必要な Resource Provider が未登録のことがあります。
このワークショップでは、デプロイ前に次の名前空間を確認してください。
- `Microsoft.Web`
- `Microsoft.Network`
- `Microsoft.DocumentDB`
- `Microsoft.KeyVault`
- `Microsoft.OperationalInsights`
- `Microsoft.Insights`
- `Microsoft.Authorization`
- `Microsoft.AlertManagement`（アラート関連依存のため事前登録推奨）

まとめて確認・登録する場合:
```bash
for ns in Microsoft.Web Microsoft.Network Microsoft.DocumentDB Microsoft.KeyVault Microsoft.OperationalInsights Microsoft.Insights Microsoft.Authorization Microsoft.AlertManagement; do
  state=$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)
  echo "$ns: $state"
  if [ "$state" != "Registered" ]; then
    az provider register --namespace "$ns"
  fi
done
```
登録完了まで数分かかることがあります。`az provider show --namespace <namespace> --query registrationState -o tsv` を再実行して、各 Provider が `Registered` になったことを確認してください。

</details>

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

**Windows (WSL2 Ubuntu):**
```bash
# macOS/Linux と同じ
az group create --name <Resource-Group-Name> --location japaneast
az deployment group create \
  --resource-group <Resource-Group-Name> \
  --template-file main.bicep \
  --parameters dev.local.bicepparam
```

**Windows（WSL2 なし / PowerShell）:**
```powershell
# Create resource group (use your own name)
az group create --name <Resource-Group-Name> --location japaneast

# Deploy infrastructure
az deployment group create `
  --resource-group <Resource-Group-Name> `
  --template-file main.bicep `
  --parameters dev.local.bicepparam
```

> **💡 Multi-Group Workshops:**
> 共有サブスクリプションで衝突する場合は `groupId` を使って回避できます。

**Verify Deployment:**

**macOS/Linux:**
```bash
az resource list --resource-group <Resource-Group-Name> --output table
```

**Windows (WSL2 Ubuntu):**
```bash
# macOS/Linux と同じ
az resource list --resource-group <Resource-Group-Name> --output table
```

**Windows（WSL2 なし / PowerShell）:**
```powershell
az resource list --resource-group <Resource-Group-Name> --output table
```

✅ **Checkpoint:** Bicep デプロイが完了し、リソースが見える。

#### 手順 4: Entra ID の Redirect URI を更新 <a id="step4-update-redirect-uri"></a>

デプロイ後、Frontend アプリ登録に Static Web Apps の URL を追加します。

1. **Get the SWA URL:**

   **macOS/Linux:**
   ```bash
   az staticwebapp show \
     --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
     --resource-group <Resource-Group-Name> \
     --query "defaultHostname" -o tsv
   ```

   **Windows (WSL2 Ubuntu):**
   ```bash
   az staticwebapp show \
     --name $(az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv) \
     --resource-group <Resource-Group-Name> \
     --query "defaultHostname" -o tsv
   ```

   **Windows（WSL2 なし / PowerShell）:**
   ```powershell
   $swaName = az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv
   az staticwebapp show --name $swaName --resource-group <Resource-Group-Name> --query "defaultHostname" -o tsv
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

Windows ユーザーは、上記 **macOS/Linux の Azure CLI 手順** を WSL で実行してください。

WSL2 なしの Windows 環境では、PowerShell で等価な Azure CLI コマンド（`$env:VAR` 形式の環境変数）を使うか、Azure Portal で Redirect URI を更新してください。

✅ **Checkpoint:** Redirect URI に SWA URL を追加できた。

> **🚀 Prefer CI/CD?** 手動デプロイではなく GitHub Actions を使いたい場合は、[上級パス: GitHub Actions](#25-advanced-path-github-actions-alternative) へ進んでください。

#### 手順 5: バックエンドを App Service にデプロイ

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

**Windows (WSL2 Ubuntu):**
```bash
# プロジェクトのルートから実行
cd <repository-root>

# Get the App Service name
APP_SERVICE_NAME=$(az deployment group show \
  --resource-group <Resource-Group-Name> \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)

./scripts/deploy-backend.sh <Resource-Group-Name> $APP_SERVICE_NAME
```

**Windows（WSL2 なし / GitHub Actions）:**
[上級パス: GitHub Actions](#25-advanced-path-github-actions-alternative) を参照してください。

✅ **Checkpoint:** `/health` が `{"status":"healthy"}` を返す。

#### 手順 6: フロントエンドを Static Web Apps にデプロイ

> 📖 **Script Details:** 詳細は [Deployment Scripts Guide](docs/deployment-scripts-guide.ja.md#frontend-deployment-script) を参照してください。

**Setup (one-time):**

**macOS/Linux:**
```bash
cp scripts/deploy-frontend.template.env scripts/deploy-frontend.local.env
code scripts/deploy-frontend.local.env
```

**Windows (WSL2 Ubuntu):**
```bash
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
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

**Windows (WSL2 Ubuntu):**
```bash
./scripts/deploy-frontend.sh <Resource-Group-Name>
```

**Windows（WSL2 なし / GitHub Actions）:**
[上級パス: GitHub Actions](#25-advanced-path-github-actions-alternative) を参照してください。

✅ **Checkpoint:** SWA の URL でアプリが表示できる。

#### 手順 7: デプロイ結果を確認

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

**Windows（WSL2 なし / PowerShell）:**
```powershell
$appServiceName = az deployment group show --resource-group <Resource-Group-Name> --name main --query "properties.outputs.appServiceName.value" -o tsv
$swaName = az staticwebapp list --resource-group <Resource-Group-Name> --query "[0].name" -o tsv
$swaHostname = az staticwebapp show --name $swaName --resource-group <Resource-Group-Name> --query "defaultHostname" -o tsv

Write-Host "=== Deployment URLs ==="
Write-Host "Frontend: https://$swaHostname"
Write-Host "API (via SWA): https://$swaHostname/api/health"
Write-Host "API (direct): https://$appServiceName.azurewebsites.net/health"

Write-Host ""
Write-Host "=== Testing Health Endpoints ==="
Invoke-RestMethod "https://$appServiceName.azurewebsites.net/health" | ConvertTo-Json
Invoke-RestMethod "https://$swaHostname/api/health" | ConvertTo-Json
```

---

### 2.5 上級パス: GitHub Actions（代替） <a id="25-advanced-path-github-actions-alternative"></a>

<a id="-advanced-github-actions-deployment-alternative---not-verified"></a>
<details>
<summary>🚀 <strong>[上級] GitHub Actions によるデプロイ（代替・未検証）</strong></summary>

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

### トリガーの挙動

- `materials/backend/**` に変更があるとバックエンドだけが動きます。
- `materials/frontend/**` に変更があるとフロントエンドだけが動きます。
- それ以外の変更のみでは、workflow は動きません。

バックエンド workflow は **OIDC（既定）** と **Service Principal secret（任意）** をサポートします。

---

## 手順 1（既定）: OIDC（フェデレーション資格情報）で Azure ログインを設定

OIDC は長期シークレットを GitHub に保存しないため推奨です。

### 1.1 GitHub Actions 用の Entra アプリを作成

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

### 1.2 GitHub Actions 用のフェデレーション資格情報を追加

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

### 1.3 リソースグループに RBAC を付与

```bash
SP_OBJECT_ID=$(az ad sp show --id "$AZURE_CLIENT_ID" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
```

---

## 手順 2: GitHub Actions の Variables/Secrets を設定

GitHub リポジトリ → **Settings** → **Secrets and variables** → **Actions**。

> **💡 Use Repository-level, not Environment-level.**
> workflow templates は GitHub Environment を使わないため、Repository レベル（既定）の Variables/Secrets で十分です。

### Variables（変数）

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

### Secrets（シークレット）

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

## 手順 3: デプロイをトリガー

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

## （任意のフォールバック）: Service Principal のシークレット（`AZURE_CREDENTIALS`）

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

## 3. アプリケーションのテスト <a id="3-testing-the-application"></a>

### 3.1 ヘルスチェック

**macOS/Linux:**
```bash
curl -s "https://<app-service-name>.azurewebsites.net/health" | jq .
curl -s "https://<swa-hostname>.azurestaticapps.net/api/health" | jq .
```

**Windows (WSL2 Ubuntu):**
```bash
curl -s "https://<app-service-name>.azurewebsites.net/health" | jq .
curl -s "https://<swa-hostname>.azurestaticapps.net/api/health" | jq .
```

✅ **Checkpoint:** 200 OK。

### 3.2 認証のテスト

1. `https://<swa-hostname>.azurestaticapps.net` を開く
2. "Sign In" をクリック
3. Microsoft ログインへ遷移
4. ログイン後、プロフィールが表示される

✅ **Checkpoint:** ログインできる。

### 3.3 CRUD 操作のテスト

ログイン後:

1. **Create Post:** "New Post" → 入力 → "Publish"
2. **View Post:** タイトルをクリック
3. **Edit Post:** "Edit" → 変更 → 保存
4. **Delete Post:** "Delete" → 確認

✅ **Checkpoint:** CRUD が動作。

---

## 4. IaaS と PaaS の比較 <a id="4-iaas-vs-paas-comparison"></a>

（内容は英語版 README と同じ構成です。必要に応じて比較しながら読み進めてください。）

### 4.1 アーキテクチャの違い

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

### 4.2 バックエンドコードの違い

**IaaS (MongoDB Replica Set):**
```typescript
const uri = "mongodb://user:pass@10.0.3.4:27017,10.0.3.5:27017,10.0.3.6:27017/blogdb?replicaSet=rs0";
```

**PaaS (Azure DocumentDB):**
```typescript
const uri = process.env.COSMOSDB_CONNECTION_STRING;
```

### 4.3 フロントエンドコードの違い

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

## 5. 費用見積もり（概算） <a id="5-cost-estimate"></a>

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

## 6. クリーンアップ <a id="6-cleanup"></a>

**macOS/Linux:**
```bash
az group delete --name <Resource-Group-Name> --yes --no-wait
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
```

**Windows (WSL2 Ubuntu):**
```bash
az group delete --name <Resource-Group-Name> --yes --no-wait
az ad app delete --id <frontend-app-id>
az ad app delete --id <backend-app-id>
```

✅ **Checkpoint:** RG が削除された。

---

## 7. トラブルシューティング <a id="7-troubleshooting"></a>

### よくある問題

| Symptom | Cause | Solution |
|---------|-------|----------|
| Bicep deployment fails | Entra ID パラメータ不足 | `dev.local.bicepparam` を確認 |
| Backend returns 502 | 起動中 | 60-90秒待ってログ確認 |
| Health check returns 401 | EasyAuth が `/health` をブロック | `excludedPaths` を確認 |
| Login redirect fails | Redirect URI 不足 | フロントアプリに SWA URL を追加 |
| Login fails with `AADSTS900144` | フロント runtime config が空 | `index.html` に `window.__APP_CONFIG__={...}` が注入されているか確認 |
| API calls fail with 404 | Linked Backend 未設定 | SWA の Linked Backend を確認 |
| `tsc: not found` during deploy | リモートビルド有効 | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` を設定 |
| Windows ネイティブシェルで ZIP を作成してデプロイ後に Backend が起動しない | ZIP が WSL 外で作成され、Windows 区切りパスが混入 | WSL で `./scripts/deploy-backend.sh` を再実行して再デプロイしてください。 |

### ログの確認

**macOS/Linux:**
```bash
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

az webapp log download \
  --resource-group <Resource-Group-Name> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

**Windows (WSL2 Ubuntu):**
```bash
az webapp log tail --resource-group <Resource-Group-Name> --name <app-service-name>

az webapp log download \
  --resource-group <Resource-Group-Name> \
  --name <app-service-name> \
  --log-file /tmp/app-logs.zip
```

---

## 8. クイックリファレンス <a id="8-quick-reference-card"></a>

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

## 📝 ライセンス

このワークショップは [MIT License](LICENSE) で提供されています。

---

## 🙏 謝辞

本ワークショップは Azure PaaS をハンズオンで学ぶために作成されました。

**Companion Workshop:** [Azure IaaS Workshop](https://github.com/hironariy/Azure-IaaS-Workshop)
