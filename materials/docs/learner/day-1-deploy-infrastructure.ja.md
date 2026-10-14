---
title: "Day 1: PaaS インフラのデプロイ"
---

# Day 1: PaaS インフラのデプロイ

Cloud Shell から Bicep テンプレートを実行し、Azure PaaS リソース一式を作成します。このページでは `dev.bicepparam` をベースに自分用のパラメータファイルを作成し、**標準モード (`deploymentMode = 'standard'`)** でデプロイします。バックエンドのアプリケーションコードは次のページでソースコードからビルドして App Service へ ZIP デプロイするため、外部のコンテナイメージには依存しません。

> **前提条件:**
> Bicep デプロイでは、App Service のマネージド ID に対して Key Vault の `Key Vault Secrets User` ロールを割り当てます。そのため、対象サブスクリプションの **Owner（所有者）** ロールが必要です。[Day 0 の事前準備](day-0-prerequisites.ja.html)を完了してから進めてください。

## 1. 変数と作業ディレクトリを確認する

Day 0 から続けて作業している場合は、そのまますべての変数が揃っていることを確認します。

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load identity` を先に実行してください。

```bash
cd "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
echo "$BACKEND_CLIENT_ID"
echo "$FRONTEND_CLIENT_ID"
echo "$PARAM_FILE"
```

空の値がある場合は、[事前準備 1: Cloud Shell 設定](cloud-shell-quickstart.ja.html) または [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html) に戻って設定してください。

## 2. パラメータファイルを初期化する

テンプレート（`materials/bicep/dev.bicepparam`）から自分用のパラメータファイル（`$PARAM_FILE`）を作成します。初回作成時は、暗号学的に安全な乱数で Cosmos DB 管理者パスワード（大文字・小文字・数字・記号を含む文字列）を自動生成してファイルへ直接書き込みます。再実行時は既存のファイルとパスワードをそのまま保持します。

```bash
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const file = process.env.PARAM_FILE;
const created = !fs.existsSync(file);
if (!created && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) {
  throw new Error('パラメータは通常ファイルでなければなりません');
}
const relative = path.relative(path.dirname(file),
  path.join(process.env.WORKSHOP_REPO_DIR, 'materials/bicep/main.bicep')).split(path.sep).join('/');
const using = `using '${relative.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let source = fs.readFileSync(created
  ? path.join(process.env.WORKSHOP_REPO_DIR, 'materials/bicep/dev.bicepparam') : file, 'utf8');
const pattern = /^using '(?:\\.|[^'\\])*'/m;
if (!pattern.test(source)) throw new Error('パラメータの using 行を確認してください');
source = source.replace(pattern, () => using);
if (created) {
  const passwordLine = /^param cosmosDbAdminPassword = ''/m;
  if (!passwordLine.test(source)) throw new Error('テンプレートのパスワード行を確認してください');
  source = source.replace(passwordLine,
    () => `param cosmosDbAdminPassword = 'Aa1_${randomBytes(24).toString('base64url')}'`);
}
fs.writeFileSync(file, source, { mode: 0o600, flag: created ? 'wx' : 'w' });
fs.chmodSync(file, 0o600);
console.log(created ? 'パラメータを作成しました（秘密値は非表示）' : '既存パラメータ・秘密値を保持しました');
NODE
```

## 3. パラメータファイルを編集する

設定する公開パラメータの値を確認します（`cosmosDbAdminPassword` はすでに自動設定されているため、変更する必要はありません）。

```bash
cat <<EOF
PARAM_FILE=$PARAM_FILE
location=$LOCATION
staticWebAppLocation=$SWA_LOCATION
baseName=$BASE_NAME
groupId=$GROUP_ID
entraTenantId=$TENANT_ID
entraBackendClientId=$BACKEND_CLIENT_ID
entraFrontendClientId=$FRONTEND_CLIENT_ID
EOF
```

Cloud Shell の `code` エディターでパラメータファイルを開きます。

```bash
code "$PARAM_FILE"
```

エディターが開いたら、次の表に合わせて各パラメータを設定し、`Ctrl+S`（macOS は `Cmd+S`）で保存します。

| パラメータ | 設定する値 | 説明 |
|---|---|---|
| `param location` | `$LOCATION` の値 | App Service、Cosmos DB、Key Vault などのデプロイ先リージョン |
| `param baseName` | `$BASE_NAME` の値 | リソース名のベース文字列 |
| `param groupId` | `$GROUP_ID` の値 | グループ識別子（個人演習では空文字または `'A'`） |
| `param deploymentMode` | `'standard'` のまま | ソースからビルドして App Service へ ZIP デプロイする標準モード |
| `param appServiceContainerImage` | `''` のまま | 標準モードでは使用しません |
| `param entraTenantId` | `$TENANT_ID` の値 | Microsoft Entra テナント ID |
| `param entraBackendClientId` | `$BACKEND_CLIENT_ID` の値 | バックエンド API アプリの Client ID |
| `param entraFrontendClientId` | `$FRONTEND_CLIENT_ID` の値 | フロントエンド SPA アプリの Client ID |
| `param cosmosDbAdminPassword` | 生成済みの値を保持 | 自動生成されたパスワードをそのまま使います |
| `param staticWebAppSku` | `'Standard'` のまま | Static Web Apps Linked Backend の利用に必要です |
| `param staticWebAppLocation` | `$SWA_LOCATION` の値 | Static Web Apps のデプロイ先リージョン |

保存後、設定内容をコマンドで確認します（パスワードの値は表示されません）。

```bash
grep -E "param (location|baseName|groupId|deploymentMode|entraTenantId|entraBackendClientId|entraFrontendClientId|staticWebAppSku|staticWebAppLocation)" "$PARAM_FILE"

if grep -q "param cosmosDbAdminPassword = ''" "$PARAM_FILE"; then
  echo "cosmosDbAdminPassword が未設定です。code \"$PARAM_FILE\" で設定してください。"
else
  echo "cosmosDbAdminPassword is set (value hidden)"
fi
```

`deploymentMode` が `'standard'`、`staticWebAppSku` が `'Standard'` になっており、Entra ID の 3 つの GUID が正しく入っていることを確認します。

## 4. Bicep テンプレートを検証する

デプロイを実行する前に、`az deployment group validate` でテンプレートとパラメータの整合性を検証します。

```bash
az deployment group validate \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE"
```

## 5. PaaS リソースをデプロイする

検証が通ったら、Bicep デプロイを実行します。

```bash
az deployment group create \
  --subscription "$SUBSCRIPTION_ID" \
  --name main \
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE"
```

Cosmos DB for MongoDB vCore クラスターの作成を含むため、完了まで **10〜15 分程度**かかる場合があります。進捗を確認したい場合は、別の Cloud Shell タブを開いて次のコマンドを実行してください。

```bash
source "$HOME/Azure-PaaS-Workshop/scripts/workshop-state.sh"
workshop_state_load identity
az deployment group show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name main \
  --query '{state:properties.provisioningState,started:properties.timestamp,correlationId:properties.correlationId}' -o jsonc
az deployment operation group list --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name main \
  --query '[].{type:properties.targetResource.resourceType,name:properties.targetResource.resourceName,state:properties.provisioningState}' \
  -o table
```

このデプロイで作成される主なリソースは次のとおりです。

- Azure Static Web Apps (`Standard`) + Linked Backend
- Azure App Service Plan (`B1`) + App Service for Linux
- Azure Cosmos DB for MongoDB vCore (`M25`)
- Azure Key Vault + ロール割り当て (`Key Vault Secrets User`)
- Virtual Network / サブネット / NAT Gateway / Private Endpoint / Private DNS Zone
- Application Insights + Log Analytics ワークスペース

## 6. デプロイ出力を保存する

デプロイが完了したら、作成された App Service 名と Static Web Apps のホスト名を取得し、設定ファイル（`$ENV_FILE`）に保存します。

```bash
APP_SERVICE_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)"

SWA_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.staticWebAppName.value" -o tsv)"

SWA_HOSTNAME="$(az staticwebapp show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query defaultHostname -o tsv)"

export APP_SERVICE_NAME SWA_NAME SWA_HOSTNAME

workshop_state_save deployed

echo "App Service: $APP_SERVICE_NAME"
echo "Static Web App: https://$SWA_HOSTNAME"
```

## 7. Static Web Apps URL を Entra ID に追加する

Day 0 で作成したフロントエンドのアプリ登録に対して、手順 6 で確定した Static Web Apps の URL（`https://$SWA_HOSTNAME`）を **SPA のリダイレクト URI** として追加します。既存の `http://localhost:4280` などの設定は保持されます。

```bash
(
  if ! ACCOUNT_JSON="$(az account show -o json)"; then
    echo "Azure のログイン状態を確認できません。" >&2
    exit 1
  fi
  if ! SUBSCRIPTION_ID="$(jq -er --arg tenant "$TENANT_ID" \
    'select(.tenantId == $tenant) | .id | select(type == "string" and length > 0)' \
    <<< "$ACCOUNT_JSON")"; then
    echo "現在のテナントが Day 0 の TENANT_ID と一致しません。更新を中止します。" >&2
    exit 1
  fi
  export SUBSCRIPTION_ID
  if [ -z "$SWA_HOSTNAME" ] || [ "$SWA_HOSTNAME" = null ]; then
    echo "手順 6 の SWA_HOSTNAME を確認してください。" >&2
    exit 1
  fi

  if ! FRONTEND_APP_JSON="$(az ad app show \
    --subscription "$SUBSCRIPTION_ID" \
    --id "$FRONTEND_CLIENT_ID" \
    -o json)"; then
    echo "Frontend アプリ登録を取得できません。テナント、Client ID、アプリの所有権を確認してください。" >&2
    exit 1
  fi

  if ! FRONTEND_OBJECT_ID="$(jq -er --arg client "$FRONTEND_CLIENT_ID" \
    'select(.appId == $client) | .id | select(type == "string" and length > 0)' \
    <<< "$FRONTEND_APP_JSON")"; then
    echo "Frontend アプリ登録の Client ID と Object ID を確認できませんでした。" >&2
    exit 1
  fi

  if ! REDIRECT_URIS="$(jq -ce --arg swa "https://$SWA_HOSTNAME" '
    (.spa.redirectUris // []) |
    if type == "array" and all(.[]; type == "string") then
      (. + [$swa] | unique)
    else error("SPA redirectUris must be an array of strings") end
  ' <<< "$FRONTEND_APP_JSON")"; then
    echo "既存の SPA リダイレクト URI を読み取れないため、更新を中止します。" >&2
    exit 1
  fi

  SPA_PATCH="$(jq -nc --argjson redirectUris "$REDIRECT_URIS" '{
    spa: {
      redirectUris: $redirectUris
    }
  }')"

  az rest \
    --subscription "$SUBSCRIPTION_ID" \
    --method PATCH \
    --uri "https://graph.microsoft.com/v1.0/applications/$FRONTEND_OBJECT_ID" \
    --body "$SPA_PATCH"
)
```

リダイレクト URI が正しく登録されたことを確認します。

```bash
az ad app show \
  --subscription "$SUBSCRIPTION_ID" \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

`http://localhost:4280` に加えて `https://<SWA_HOSTNAME>` が表示されれば完了です。

## 8. App Service の状態を確認する

この時点ではまだバックエンドのアプリケーションコードをデプロイしていませんが、App Service リソース自体が作成され、`state` が `Running` になっていることを確認します。

```bash
az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{name:name,state:state,defaultHostName:defaultHostName,httpsOnly:httpsOnly}" \
  -o jsonc
```

## 次に進む

- [Day 1: バックエンドのデプロイ](day-1-deploy-backend.ja.html)
