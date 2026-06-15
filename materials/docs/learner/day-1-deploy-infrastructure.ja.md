---
title: "Day 1: PaaS インフラをデプロイ"
---

# Day 1: PaaS インフラをデプロイ

Cloud Shell から Bicep を実行し、PaaS リソースを作成します。このページでは `dev.bicepparam` をコピーして **標準 mode (`deploymentMode = 'standard'`)** でデプロイします。バックエンドのアプリケーションコードは次のページでリポジトリから build して App Service に ZIP deploy するため、外部の既成コンテナイメージには依存しません。

## 1. 変数と作業ディレクトリを確認する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env 2>/dev/null || true

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
```

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

cat >> ~/paas-workshop.env <<EOF
export APP_SERVICE_NAME="$APP_SERVICE_NAME"
export SWA_NAME="$SWA_NAME"
export SWA_HOSTNAME="$SWA_HOSTNAME"
EOF

echo "App Service: $APP_SERVICE_NAME"
echo "Static Web App: https://$SWA_HOSTNAME"
```

## 7. Static Web Apps URL を Entra ID に追加する

```bash
REDIRECT_URIS="$(jq -nc --arg swa "https://$SWA_HOSTNAME" '["http://localhost:4280", $swa, ($swa + "/")]')"

FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"

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
