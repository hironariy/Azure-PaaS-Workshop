---
title: "Day 0: 事前準備 1 Cloud Shell 設定"
---

# Day 0: 事前準備 1 Cloud Shell 設定

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
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
export ENV_FILE="$WORKSHOP_STATE_DIR/paas-workshop.json"

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
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
if [ -f "$ENV_FILE" ]; then
  workshop_state_load base || exit 1
else
  export LOCATION="japaneast"
  export SWA_LOCATION="eastasia"
  export BASE_NAME="blogapp"
  export GROUP_ID="A"
  export RESOURCE_GROUP="rg-${BASE_NAME}${GROUP_ID:+-${GROUP_ID}}-paas-workshop"
  export PARAM_FILE="$WORKSHOP_STATE_DIR/dev.local.bicepparam"
  export SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
  export TENANT_ID="$(az account show --query tenantId -o tsv)"
  workshop_state_init || exit 1
fi
```

保存形式は version 付き JSON です。既存ファイルを無条件に上書きせず、保存は一時ファイルから atomic rename します。`source` するのはリポジトリ内の既知の helper だけで、保存した値をシェルコードとして実行しません。秘密値は保存しません。

state はリポジトリ外の専用ディレクトリに保存します。`/`、ホームディレクトリ自体、リポジトリ内は指定できません。JSON の秘密値非保存とは別に、`PARAM_FILE` は DB パスワードを含むため Git に追加・共有しないでください。Cloud Shell / Azure Files 上の権限と rename の実機確認は未完了です。ファイル操作が失敗した場合は停止し、保存成功と扱いません。

RG 名は `rg-<BASE_NAME>-<GROUP_ID>-paas-workshop` に統一します。個人演習で `GROUP_ID=""` とした場合は `rg-<BASE_NAME>-paas-workshop` です。承認された専用 RG を使う場合は初期化前に上の `RESOURCE_GROUP` を変更してください。別グループ・別 tenant/subscription に切り替える場合は新しい `WORKSHOP_STATE_DIR` を選び、既存 state の対象を上書きしません。

旧 `paas-workshop.env` は自動で実行・移行しません。既存の app ID や対象を手動で確認し、別の state ディレクトリで初期化してから必要な値を保存します。リポジトリの clone 先を変更した場合は、再接続時も実際の `WORKSHOP_REPO_DIR` を指定してください。

確認します。

```bash
echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$SUBSCRIPTION_ID"
echo "$TENANT_ID"
```

Cloud Shell のセッションが切れた場合は、次で復元できます。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
```

## 次に進む

- [Day 0: 事前準備](day-0-prerequisites.ja.html)
- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
