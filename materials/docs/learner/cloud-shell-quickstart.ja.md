---
title: "Day 0: 事前準備 1 — Cloud Shell の設定"
---

# Day 0: 事前準備 1 — Cloud Shell の設定

このページは、Azure PaaS Workshop を **Azure Cloud Shell (Bash) だけ**で進めるためのスタートガイドです。ローカル PC に Azure CLI、Node.js、Docker、WSL、PowerShell などをインストールする必要はありません。バックエンドとフロントエンドは、このリポジトリのソースコードから Cloud Shell 上でビルドしてデプロイします。

> **前提となる権限:**
> - **Azure サブスクリプションの Owner（所有者）ロール**: Day 1 で App Service のマネージド ID に対して Key Vault のロール割り当て（Key Vault Secrets User）を作成するため、Owner ロールが必要です（Contributor のみではロール割り当てを作成できません）。
> - **Microsoft Entra ID の Application Developer（アプリケーション開発者）ロール**: Day 0 で認証用のアプリ登録と本人同意を行うために使用します。
>
> PIM（Privileged Identity Management）を利用している場合は、ワークショップ開始前にロールを有効化し、[事前準備 2: サブスクリプションとリソースグループ](day-0-prerequisites.ja.html)で割り当て状態を確認してください。

## このワークショップで構築する構成

| レイヤー | 使用する Azure PaaS サービス |
|---|---|
| フロントエンド | Azure Static Web Apps (Standard) |
| バックエンド API | Azure App Service for Linux (Node.js) |
| データベース | Azure Cosmos DB for MongoDB vCore（MongoDB API 互換） |
| シークレット管理 | Azure Key Vault + マネージド ID |
| 監視・ログ | Application Insights + Log Analytics |
| API ルーティング | Static Web Apps Linked Backend (`/api/*`) |

> この PaaS ワークショップでは、Application Gateway、Azure Bastion、仮想マシン（VM）、SSH 接続は使用しません。

## 全体の流れ

1. **Day 0**: Cloud Shell の準備、サブスクリプションと権限の確認、Entra ID のアプリ登録、共通変数の設定を行います。
2. **Day 1**: Bicep で PaaS インフラをデプロイし、バックエンドとフロントエンドをビルド・デプロイして動作を確認します。
3. **Day 2**: Application Insights と Log Analytics による監視・運用、再起動や再デプロイ時の復旧確認、最後のリソース削除（クリーンアップ）を行います。

## 1. Cloud Shell を開く

1. [Azure Portal](https://portal.azure.com) にサインインします。
2. 画面上部の `>_` アイコンを選択して Cloud Shell を開きます。
3. シェルの種類は **Bash** を選択します。

Cloud Shell で次のコマンドを実行し、Azure CLI が利用できることを確認します。

```bash
az account show --output table
az version --query '"azure-cli"' -o tsv
```

複数のサブスクリプションがある場合は、演習で使用するサブスクリプションを選択します。

```bash
az account list --output table
az account set --subscription "<subscription-id-or-name>"
az account show --output table
```

## 2. リポジトリを取得する

Cloud Shell の `~/clouddrive` は Azure Files にマウントされた永続ストレージです。ただし、Node.js の `npm ci` やビルド処理を `~/clouddrive` 上で実行するとファイル I/O が遅くなりやすいため、リポジトリ本体はホームディレクトリ直下の `~/Azure-PaaS-Workshop` に配置し、セッションをまたいで保持したい設定ファイルだけを `~/clouddrive/paas-workshop` に保存します。

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

作業ディレクトリの内容を確認します。

```bash
pwd
ls
```

期待される出力例:

```text
README.ja.md
materials
docs
scripts
```

## 3. Cloud Shell のツールを確認する

```bash
az bicep version || az bicep install
az extension add --name staticwebapp --upgrade
git --version
jq --version
node --version
npm --version
zip -v | head -1
```

バックエンドとフロントエンドのビルド・デプロイで Node.js、npm、`zip` コマンドを使用します。`node`、`npm`、`zip` が見つからない場合は講師に相談してください。

## 4. ワークショップ共通変数を設定する

以降のページで使用する環境変数を初期化し、`~/clouddrive/paas-workshop/paas-workshop.json` に保存します。グループ演習で `GROUP_ID` が指定されている場合は、自分のグループ名（`A`、`B` など）に変更してください。

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

**変数管理のポイント:**

- 設定値（サブスクリプション ID、テナント ID、リソースグループ名など）は JSON ファイル（`$ENV_FILE`）に安全に保存され、パスワードやトークンなどの秘密情報は含まれません。
- Day 1 で作成する Bicep パラメータファイル（`$PARAM_FILE`）には DB 管理者パスワードが含まれるため、Git リポジトリへのコミットや共有は行わないでください。
- リソースグループ名は `rg-<BASE_NAME>-<GROUP_ID>-paas-workshop`（個人演習で `GROUP_ID=""` とした場合は `rg-<BASE_NAME>-paas-workshop`）の形式に統一されます。別のグループやサブスクリプションで演習をやり直す場合は、新しい `WORKSHOP_STATE_DIR` を指定して初期化してください。

設定された変数を確認します。

```bash
echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$SUBSCRIPTION_ID"
echo "$TENANT_ID"
```

Cloud Shell のセッションが切断されたり再起動した場合は、いつでも次のコマンドで変数を復元できます。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1
```

## 次に進む

- [Day 0: 事前準備 2 — サブスクリプションとリソースグループ](day-0-prerequisites.ja.html)
- [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html)
