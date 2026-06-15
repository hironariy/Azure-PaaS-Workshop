---
title: "Day 1: PaaS インフラをデプロイ"
---

# Day 1: PaaS インフラをデプロイ

Cloud Shell から Bicep を実行し、PaaS リソースを作成します。バックエンドは prebuilt container image を使うため、受講者がローカルで backend を build する必要はありません。

## 1. 変数と作業ディレクトリを確認する

```bash
cd ~/Azure-PaaS-Workshop
source ~/paas-workshop.env 2>/dev/null || true

echo "$RESOURCE_GROUP"
echo "$TENANT_ID"
echo "$BACKEND_CLIENT_ID"
echo "$FRONTEND_CLIENT_ID"
```

値が空の場合は、[受講者クイックスタート](cloud-shell-quickstart.ja.html) と [Day 0: Entra ID と認証設定](day-0-entra-id.ja.html) に戻って設定してください。

## 2. Cosmos DB 管理者パスワードを生成する

接続文字列で扱いやすいよう、URL-safe な値を使います。

```bash
export COSMOS_PASSWORD="$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=' | cut -c1-32)"
echo "Password length: ${#COSMOS_PASSWORD}"
```

## 3. FastPath 用パラメータファイルを作成する

```bash
cp materials/bicep/dev.fastpath.bicepparam "$PARAM_FILE"
```

Cloud Shell から安全に値を置換します。

```bash
python3 - <<'PY'
from pathlib import Path
import os

path = Path(os.environ["PARAM_FILE"])
text = path.read_text()
replacements = {
    "param baseName = 'blogapp'": f"param baseName = '{os.environ['BASE_NAME']}'",
    "param groupId = ''": f"param groupId = '{os.environ['GROUP_ID']}'",
    "<your-tenant-id>": os.environ["TENANT_ID"],
    "<backend-api-client-id>": os.environ["BACKEND_CLIENT_ID"],
    "<frontend-spa-client-id>": os.environ["FRONTEND_CLIENT_ID"],
    "<strong-password>": os.environ["COSMOS_PASSWORD"],
}
for old, new in replacements.items():
    text = text.replace(old, new)
text = text.replace("param location = 'japaneast'", f"param location = '{os.environ['LOCATION']}'")
text = text.replace("param staticWebAppLocation = 'eastasia'", f"param staticWebAppLocation = '{os.environ['SWA_LOCATION']}'")
text = text.replace("param appServiceContainerImage = 'docker.io/hironariy/azure-paas-workshop-backend@sha256:7af2ad591a0d791f37810cd9d1349faee7e982f4c1fa337f0cf0d7157d84f964'", f"param appServiceContainerImage = '{os.environ['BACKEND_IMAGE']}'")
path.write_text(text)
PY
```

確認します。パスワードは表示しません。

```bash
grep -E "param (location|baseName|groupId|deploymentMode|appServiceContainerImage|entraTenantId|entraBackendClientId|entraFrontendClientId|staticWebAppSku|staticWebAppLocation)" "$PARAM_FILE"
```

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
REDIRECT_URIS="$(jq -nc --arg swa "https://$SWA_HOSTNAME" '["http://localhost:4280", $swa]')"

az ad app update \
  --id "$FRONTEND_CLIENT_ID" \
  --set spa.redirectUris="$REDIRECT_URIS"
```

確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

## 8. App Service のヘルスチェック

```bash
curl -fsS "https://${APP_SERVICE_NAME}.azurewebsites.net/health" | jq .
```

期待値:

```json
{
  "status": "healthy"
}
```

`/api/health` はフロントエンド成果物を Static Web Apps にデプロイするまで `404` になることがあります。

## 次に進む

- [Day 1: フロントエンドをデプロイ](day-1-deploy-frontend.ja.html)
