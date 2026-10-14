---
title: "Day 1: PaaS インフラをデプロイ"
---

# Day 1: PaaS インフラをデプロイ

Cloud Shell から Bicep を実行し、PaaS リソースを作成します。このページでは `dev.bicepparam` をコピーして **標準 mode (`deploymentMode = 'standard'`)** でデプロイします。バックエンドのアプリケーションコードは次のページでリポジトリから build して App Service に ZIP deploy するため、外部の既成コンテナイメージには依存しません。

> **利用するサブスクリプションの Owner が必須です。** Bicep は App Service の Managed Identity に Key Vault Secrets User を割り当てます。Contributor のみでは `Microsoft.Authorization/roleAssignments/write` がなく、この処理を実行できません。[Day 0 の Owner 確認](day-0-prerequisites.ja.html)を済ませてから進めてください。Owner でも policy、Deny Assignment、quota などの制約は別途確認します。

## 1. 変数と作業ディレクトリを確認する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env" 2>/dev/null || true
cd "$WORKSHOP_REPO_DIR"

echo "$WORKSHOP_REPO_DIR"
echo "$WORKSHOP_STATE_DIR"
echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
echo "$BACKEND_CLIENT_ID"
echo "$FRONTEND_CLIENT_ID"
echo "$PARAM_FILE"
```

値が空の場合は、[受講者クイックスタート](cloud-shell-quickstart.ja.html) と [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html) に戻って設定してください。

## 2. Cosmos DB 管理者パスワードを生成する

接続文字列で扱いやすいよう、URL-safe な値を使います。

```bash
export COSMOS_PASSWORD="$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=' | cut -c1-32)"
echo "Password length: ${#COSMOS_PASSWORD}"
```

## 3. 標準デプロイ用パラメータファイルを作成する

テンプレートをローカル用ファイルにコピーし、Cloud Shell のエディターで自分の値に変更します。この章では、パラメータの意味を確認しながら手動で編集します。

```bash
cp materials/bicep/dev.bicepparam "$PARAM_FILE"

sed -i.bak "s|using 'main.bicep'|using '../../Azure-PaaS-Workshop/materials/bicep/main.bicep'|" "$PARAM_FILE"
rm -f "${PARAM_FILE}.bak"
```

`PARAM_FILE` は `~/clouddrive/paas-workshop` 配下に保存します。Bicep の `using` 行だけは、永続領域から `~/Azure-PaaS-Workshop/materials/bicep/main.bicep` を参照できるように調整します。

編集に使う値を確認します。`cosmosDbAdminPassword` はこのあとパラメータファイルに貼り付けるため、このタイミングだけ表示します。

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
cosmosDbAdminPassword=$COSMOS_PASSWORD
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
| `param cosmosDbAdminPassword` | `$COSMOS_PASSWORD` の値 | 直前に生成した URL-safe なパスワード |
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
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE"
```

## 5. PaaS リソースをデプロイする

```bash
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file materials/bicep/main.bicep \
  --parameters "$PARAM_FILE"
```

作成される主なリソース:

- Azure Static Web Apps (Standard)
- Azure App Service for Linux
- Azure Cosmos DB for MongoDB vCore / DocumentDB 互換リソース
- Azure Key Vault
- Virtual Network / Private Endpoints
- Application Insights / Log Analytics

## 6. デプロイ出力を保存する

```bash
export APP_SERVICE_NAME="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.appServiceName.value" -o tsv)"

export SWA_NAME="$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.outputs.staticWebAppName.value" -o tsv)"

export SWA_HOSTNAME="$(az staticwebapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query defaultHostname -o tsv)"

cat >> "$ENV_FILE" <<EOF
export APP_SERVICE_NAME="$APP_SERVICE_NAME"
export SWA_NAME="$SWA_NAME"
export SWA_HOSTNAME="$SWA_HOSTNAME"
EOF

echo "App Service: $APP_SERVICE_NAME"
echo "Static Web App: https://$SWA_HOSTNAME"
```

## 7. Static Web Apps URL を Entra ID に追加する

Day 0 で自分のグループが作成した Frontend アプリ登録に、手順 6 で取得した実際の SWA URL を **SPA のリダイレクト URI** として追加します。Azure への配備だけでは、この登録は自動更新されません。アプリは `window.location.origin` をログイン後の戻り先に使います。

既存の localhost や他のリダイレクト URI は保持します。共有アプリや別グループの Client ID は使わないでください。この操作は自分のアプリ登録の設定であり、テナントの管理者同意やポリシー変更ではありません。Azure Contributor と Entra アプリの所有権は別の権限です。

`SUBSCRIPTION_ID` は現在選択中のサブスクリプションから取得し、Day 0 に保存した `TENANT_ID` と一致することを確認します。既定のサブスクリプションは変更しません。

```bash
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
```

読み戻して、実際の SWA URL が含まれ、既存 URI が残っていることを確認します。

```bash
az ad app show \
  --subscription "$SUBSCRIPTION_ID" \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

期待値は、既存の `http://localhost:4280` などに加えて `https://$SWA_HOSTNAME` が表示されることです。同じ手順を繰り返しても同じ URI は重複追加されません。`Insufficient privileges` が出た場合は別の共有アプリに切り替えず、Day 0 の自分のアプリ登録とテナントを確認します。

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
