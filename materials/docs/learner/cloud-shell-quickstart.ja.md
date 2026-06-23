---
title: "Day 0: 事前準備 1 Cloud Shell 設定"
---

# 受講者クイックスタート

このページは、Azure PaaS Workshop を **Azure Cloud Shell (Bash) だけ**で進めるための入口です。ローカル PC への Azure CLI、Node.js、Docker、WSL、PowerShell のインストールは不要です。バックエンドは、このリポジトリのソースコードから Cloud Shell 上で build して App Service に ZIP deploy します。

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
2. Day 1 で PaaS リソースを Bicep の標準 mode でデプロイし、バックエンドとフロントエンドをソースコードから build/deploy します。
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

Cloud Shell の `~/clouddrive` は Azure Files にマウントされた永続領域です。一方、Node.js の `npm install` / build は Azure Files 上だと遅くなりやすいため、リポジトリ本体は `~/Azure-PaaS-Workshop` に配置します。セッションをまたいで残したい変数やパラメータファイルだけを `~/clouddrive/paas-workshop` に保存します。

```bash
export WORKSHOP_REPO_DIR="$HOME/Azure-PaaS-Workshop"
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
export ENV_FILE="$WORKSHOP_STATE_DIR/paas-workshop.env"

mkdir -p "$WORKSHOP_STATE_DIR"

cd "$HOME"
if [ ! -d "$WORKSHOP_REPO_DIR/.git" ]; then
  git clone https://github.com/hironariy/Azure-PaaS-Workshop.git "$WORKSHOP_REPO_DIR"
else
  git -C "$WORKSHOP_REPO_DIR" pull --ff-only
fi

cd "$WORKSHOP_REPO_DIR"
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
zip -v | head -1
```

Node.js が古い、`npm` または `zip` が見つからない場合は講師に相談してください。backend/frontend の build/deploy で Node.js、npm、ZIP 作成を使用します。

## ワークショップ共通変数を設定する

以降のページでは、次の環境変数を使います。`GROUP_ID` は講師から指定された値に変更してください。

```bash
export LOCATION="japaneast"
export SWA_LOCATION="eastasia"
export BASE_NAME="blogapp"
export GROUP_ID="A"
export RESOURCE_GROUP="rg-${BASE_NAME}-${GROUP_ID}-paas-workshop"
export PARAM_FILE="$WORKSHOP_STATE_DIR/dev.local.bicepparam"
export TENANT_ID="$(az account show --query tenantId -o tsv)"
```

共通変数を Azure Files 側に保存します。

```bash
cat > "$ENV_FILE" <<EOF
export WORKSHOP_REPO_DIR="$WORKSHOP_REPO_DIR"
export WORKSHOP_STATE_DIR="$WORKSHOP_STATE_DIR"
export ENV_FILE="$ENV_FILE"
export LOCATION="$LOCATION"
export SWA_LOCATION="$SWA_LOCATION"
export BASE_NAME="$BASE_NAME"
export GROUP_ID="$GROUP_ID"
export RESOURCE_GROUP="$RESOURCE_GROUP"
export PARAM_FILE="$PARAM_FILE"
export TENANT_ID="$TENANT_ID"
EOF
```

確認します。

```bash
echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
```

Cloud Shell のセッションが切れた場合は、次で復元できます。

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
```

## 次に進む

- [Day 0: 事前準備](day-0-prerequisites.ja.html)
- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
