---
title: "Day 1: PaaS インフラをデプロイ"
---

# Day 1: PaaS インフラをデプロイ

Cloud Shell から Bicep を実行し、PaaS リソースを作成します。このページでは `dev.bicepparam` をコピーして **標準 mode (`deploymentMode = 'standard'`)** でデプロイします。バックエンドのアプリケーションコードは次のページでリポジトリから build して App Service に ZIP deploy するため、外部の既成コンテナイメージには依存しません。

## 1. 変数と作業ディレクトリを確認する

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1

echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
echo "$BACKEND_CLIENT_ID"
echo "$FRONTEND_CLIENT_ID"
echo "$PARAM_FILE"
```

値が空の場合は、[受講者クイックスタート](cloud-shell-quickstart.ja.html) と [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html) に戻って設定してください。

## 2. Cosmos DB 管理者パスワードの扱いを確認する

次の手順で初めてパラメータファイルを作る場合だけ、暗号学的乱数から URL-safe なパスワードを生成してファイルへ直接保存します。大文字・小文字・数字・記号を必ず含めます。パスワードをターミナルへ表示せず、JSON state に保存しません。再実行時は既存の値を保持し、意図しない DB パスワード変更を防ぎます。

## 3. 標準デプロイ用パラメータファイルを作成する

テンプレートをローカル用ファイルにコピーし、Cloud Shell のエディターで自分の値に変更します。この章では、パラメータの意味を確認しながら手動で編集します。

```bash
node <<'NODE' || exit 1
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

`PARAM_FILE` は state ディレクトリ直下に保存します。`using` は実際の clone 先への相対パスから生成するため、ディレクトリ名を固定しません。再実行時は既存パラメータ・秘密値を上書きせず、テンプレート変更は手動で確認します。

編集に使う公開設定値だけを確認します。`cosmosDbAdminPassword` は生成済みで、表示・コピーする必要はありません。

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

エディターが開いたら、次の行を変更します。変更後は `Ctrl+S` で保存します。

| パラメータ | 設定する値 | 補足 |
|---|---|---|
| `param location` | `$LOCATION` の値 | App Service、DocumentDB、Key Vault などのリージョン |
| `param baseName` | `$BASE_NAME` の値 | リソース名のベース |
| `param groupId` | `$GROUP_ID` の値 | 個人演習では空文字、グループ演習では割り当てられた文字 |
| `param deploymentMode` | `'standard'` のまま | App Service へ ZIP deploy する本線 |
| `param appServiceContainerImage` | `''` のまま | 標準デプロイでは使いません |
| `param entraTenantId` | `$TENANT_ID` の値 | Day 0 で確認した tenant ID |
| `param entraBackendClientId` | `$BACKEND_CLIENT_ID` の値 | Backend API app registration の client ID |
| `param entraFrontendClientId` | `$FRONTEND_CLIENT_ID` の値 | Frontend SPA app registration の client ID |
| `param cosmosDbAdminPassword` | 生成済みの値を保持 | 表示・コピー・再生成しない |
| `param staticWebAppSku` | `'Standard'` のまま | Static Web Apps Linked Backend に必要 |
| `param staticWebAppLocation` | `$SWA_LOCATION` の値 | Static Web Apps のリージョン |

保存後、編集結果を確認します。パスワード値は表示しません。

```bash
grep -E "param (location|baseName|groupId|deploymentMode|entraTenantId|entraBackendClientId|entraFrontendClientId|staticWebAppSku|staticWebAppLocation)" "$PARAM_FILE"

if grep -q "param cosmosDbAdminPassword = ''" "$PARAM_FILE"; then
  echo "cosmosDbAdminPassword が未設定です。code \"$PARAM_FILE\" で設定してください。"
else
  echo "cosmosDbAdminPassword is set (value hidden)"
fi
```

`deploymentMode` が `standard`、`staticWebAppSku` が `Standard` であることを確認します。

## 4. Bicep を検証する

```bash
az deployment group validate \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE" || exit 1
```

## 5. PaaS リソースをデプロイする

[Day 0 の catalog / quota / tier 確認](day-0-prerequisites.ja.html#5-quota-と費用の前提を確認する) と RBAC・Entra の条件を満たした場合だけ実行します。catalog が成功しても `deploymentReady: false` のままです。制約を無視して deployment を試す手順ではありません。

```bash
az deployment group create \
  --subscription "$SUBSCRIPTION_ID" \
  --name main \
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE" || exit 1
```

このコマンドはリソース作成を待つため、数分以上かかる場合があります。進捗を見る場合は別の Cloud Shell セッションで同じ state をロードし、次を実行します。リソース名・type・状態だけを表示し、パラメータや秘密値は出しません。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1
az deployment group show --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name main \
  --query '{state:properties.provisioningState,started:properties.timestamp,correlationId:properties.correlationId}' -o jsonc
az deployment operation group list --subscription "$SUBSCRIPTION_ID" --resource-group "$RESOURCE_GROUP" --name main \
  --query '[].{type:properties.targetResource.resourceType,name:properties.targetResource.resourceName,state:properties.provisioningState}' \
  -o table
```

再実行時は前回の `Succeeded` と取り違えず、開始時刻・correlation ID と現在の作成コマンドの結果を照合します。`Failed` / `Canceled` / quota / regional capacity エラーでは deployment 出力の保存やアプリ deploy へ進みません。region/SKU/HA を自動変更せず、エラーコード・resource type・correlation ID を記録します。

作成される主なリソース:

- Azure Static Web Apps (Standard)
- Azure App Service for Linux
- Azure Cosmos DB for MongoDB vCore / DocumentDB 互換リソース
- Azure Key Vault
- Virtual Network / Private Endpoints
- Application Insights / Log Analytics

## 6. デプロイ出力を保存する

```bash
APP_SERVICE_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)" || exit 1

SWA_NAME="$(az deployment group show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.staticWebAppName.value" -o tsv)" || exit 1

SWA_HOSTNAME="$(az staticwebapp show \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query defaultHostname -o tsv)" || exit 1

export APP_SERVICE_NAME SWA_NAME SWA_HOSTNAME

workshop_state_save deployed || exit 1

echo "App Service: $APP_SERVICE_NAME"
echo "Static Web App: https://$SWA_HOSTNAME"
```

## 7. Static Web Apps URL を Entra ID に追加する

```bash
EXISTING_REDIRECTS="$(az ad app show --id "$FRONTEND_CLIENT_ID" --query spa.redirectUris -o json)" || exit 1
REDIRECT_URIS="$(jq -nc --argjson existing "$EXISTING_REDIRECTS" --arg swa "https://$SWA_HOSTNAME" \
  '(($existing // []) + ["http://localhost:4280", $swa, ($swa + "/")]) | unique')" || exit 1

FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"

if [ -z "$FRONTEND_OBJECT_ID" ]; then
  echo "FRONTEND_OBJECT_ID を取得できませんでした。FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID を確認してください。"
  exit 1
fi

SPA_PATCH="$(jq -nc --argjson redirectUris "$REDIRECT_URIS" '{
  spa: {
    redirectUris: $redirectUris
  }
}')"

az rest \
  --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$FRONTEND_OBJECT_ID" \
  --body "$SPA_PATCH"
```

確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

## 8. App Service の作成状態を確認する

この時点ではまだバックエンドコードをデプロイしていないため、`/health` は成功しなくて構いません。App Service が作成され、`Running` になっていることだけ確認します。

```bash
az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{name:name,state:state,defaultHostName:defaultHostName,httpsOnly:httpsOnly}" \
  -o jsonc
```

## 次に進む

- [Day 1: バックエンドをデプロイ](day-1-deploy-backend.ja.html)
