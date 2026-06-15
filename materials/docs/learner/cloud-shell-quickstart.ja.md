---
title: 受講者クイックスタート
---

# 受講者クイックスタート

このページは、Azure PaaS Workshop を **Azure Cloud Shell (Bash) だけ**で進めるための入口です。ローカル PC への Azure CLI、Node.js、Docker、WSL、PowerShell のインストールは不要です。

## このワークショップで作るもの

| レイヤー | Azure PaaS サービス |
|---|---|
| Frontend | Azure Static Web Apps |
| Backend | Azure App Service for Linux |
| Database | Azure Cosmos DB for MongoDB vCore / Azure DocumentDB 互換の MongoDB API |
| Secrets | Azure Key Vault + Managed Identity |
| Observability | Application Insights + Log Analytics |
| Routing | Static Web Apps Linked Backend (`/api/*`) |

> この PaaS ワークショップでは Application Gateway、Bastion、VM、SSH 手順は使いません。

## 進め方

1. Day 0 で Cloud Shell、サブスクリプション、Entra ID、パラメータを準備します。
2. Day 1 で PaaS リソースを Bicep でデプロイし、フロントエンドを Static Web Apps に配置します。
3. Day 2 で監視、ログ、信頼性、復旧観点、cleanup を確認します。

## Cloud Shell を開く

1. Azure Portal を開きます。
2. 画面上部の `>_` アイコンから Cloud Shell を開きます。
3. シェルの種類は **Bash** を選択します。

Cloud Shell で次を実行し、Azure CLI が利用できることを確認します。

```bash
az account show --output table
az version --query '"azure-cli"' -o tsv
```

複数サブスクリプションがある場合は、講師から指定されたサブスクリプションを選択します。

```bash
az account list --output table
az account set --subscription "<subscription-id-or-name>"
az account show --output table
```

## リポジトリを取得する

```bash
cd ~
git clone https://github.com/hironariy/Azure-PaaS-Workshop.git
cd Azure-PaaS-Workshop
```

作業ディレクトリを確認します。

```bash
pwd
ls
```

期待値:

```text
README.ja.md
materials
docs
scripts
```

## Cloud Shell のツールを確認する

```bash
az bicep version || az bicep install
az extension add --name staticwebapp --upgrade
git --version
jq --version
node --version
npm --version
```

Node.js が古い、または `npm` が見つからない場合は講師に相談してください。フロントエンドの build/deploy で Node.js と npm を使用します。

## ワークショップ共通変数を設定する

以降のページでは、次の環境変数を使います。`GROUP_ID` は講師から指定された値に変更してください。

```bash
export LOCATION="japaneast"
export SWA_LOCATION="eastasia"
export BASE_NAME="blogapp"
export GROUP_ID="A"
export RESOURCE_GROUP="rg-${BASE_NAME}-${GROUP_ID}-workshop"
export PARAM_FILE="materials/bicep/dev.fastpath.local.bicepparam"
export BACKEND_IMAGE="docker.io/hironariy/azure-paas-workshop-backend@sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964"
export TENANT_ID="$(az account show --query tenantId -o tsv)"
```

確認します。

```bash
echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
```

Cloud Shell のセッションが切れた場合は、このページの「ワークショップ共通変数を設定する」から再実行してください。

## 次に進む

- [Day 0: 事前準備](day-0-prerequisites.ja.html)
- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
