---
title: "Day 0: Entra ID と認証設定"
---

# Day 0: Entra ID と認証設定

このアプリは Microsoft Entra ID でサインインし、フロントエンド SPA がバックエンド API を呼び出します。Cloud Shell から 2 つのアプリ登録を作成します。

> テナントポリシーにより app registration 作成が禁止されている場合は、このページの CLI 手順ではなく、講師から配布された `TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` を使ってください。

## 1. 名前を決める

```bash
export BACKEND_APP_NAME="paas-blog-backend-${GROUP_ID}"
export FRONTEND_APP_NAME="paas-blog-frontend-${GROUP_ID}"
export ACCESS_SCOPE_ID="$(uuidgen)"
```

## 2. Backend API アプリ登録を作成する

```bash
export BACKEND_CLIENT_ID="$(az ad app create \
  --display-name "$BACKEND_APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --query appId -o tsv)"

export BACKEND_OBJECT_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query id -o tsv)"

az ad app update \
  --id "$BACKEND_CLIENT_ID" \
  --identifier-uris "api://$BACKEND_CLIENT_ID"
```

`access_as_user` スコープを追加します。

> `az ad app update --set api.oauth2PermissionScopes=...` は、新規 app registration の `api` プロパティがまだ初期化されていない場合に `Couldn't find 'api' in ''` で失敗することがあります。この手順では Microsoft Graph の application object ID (`BACKEND_OBJECT_ID`) に対して `az rest` で PATCH します。

```bash
SCOPES_JSON="$(jq -nc --arg id "$ACCESS_SCOPE_ID" '[{
  id: $id,
  isEnabled: true,
  type: "User",
  value: "access_as_user",
  adminConsentDisplayName: "Access PaaS Blog API",
  adminConsentDescription: "Allow the application to access the PaaS Blog API on behalf of the signed-in user.",
  userConsentDisplayName: "Access PaaS Blog API",
  userConsentDescription: "Allow this app to access the PaaS Blog API on your behalf."
}]')"

API_PATCH="$(jq -nc --argjson scopes "$SCOPES_JSON" '{
  api: {
    oauth2PermissionScopes: $scopes
  }
}')"

az rest \
  --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$BACKEND_OBJECT_ID" \
  --body "$API_PATCH"
```

確認します。

```bash
az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query "{displayName:displayName,appId:appId,identifierUris:identifierUris,scopes:api.oauth2PermissionScopes[].value}" \
  -o jsonc
```

## 3. Frontend SPA アプリ登録を作成する

```bash
export FRONTEND_CLIENT_ID="$(az ad app create \
  --display-name "$FRONTEND_APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --query appId -o tsv)"

export FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"
```

Cloud Shell では本番の Static Web Apps URL がまだ分からないため、まずローカル/検証用 URI を入れておきます。Day 1 のデプロイ後に SWA URL を追加します。

```bash
SPA_PATCH="$(jq -nc '{
  spa: {
    redirectUris: ["http://localhost:4280"]
  }
}')"

az rest \
  --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$FRONTEND_OBJECT_ID" \
  --body "$SPA_PATCH"
```

Frontend から Backend API のスコープを呼べるようにします。

```bash
echo "Waiting for Microsoft Graph propagation..."
sleep 10

az ad app permission add \
  --id "$FRONTEND_CLIENT_ID" \
  --api "$BACKEND_CLIENT_ID" \
  --api-permissions "${ACCESS_SCOPE_ID}=Scope"
```

管理者権限がある場合は admin consent を付与します。権限がない場合はエラーになっても構いません。講師またはテナント管理者に依頼してください。

```bash
az ad app permission admin-consent --id "$FRONTEND_CLIENT_ID" || true
```

確認します。

```bash
echo "TENANT_ID=$TENANT_ID"
echo "BACKEND_CLIENT_ID=$BACKEND_CLIENT_ID"
echo "FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID"
```

## 4. 値を Cloud Shell に保存する

Cloud Shell のセッション切断に備え、再利用する値をファイルに保存します。

```bash
cat > ~/paas-workshop.env <<EOF
export LOCATION="$LOCATION"
export SWA_LOCATION="$SWA_LOCATION"
export BASE_NAME="$BASE_NAME"
export GROUP_ID="$GROUP_ID"
export RESOURCE_GROUP="$RESOURCE_GROUP"
export PARAM_FILE="$PARAM_FILE"
export TENANT_ID="$TENANT_ID"
export BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
export FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
export ACCESS_SCOPE_ID="$ACCESS_SCOPE_ID"
EOF

cat ~/paas-workshop.env
```

次回 Cloud Shell を開いたら、次で復元できます。

```bash
source ~/paas-workshop.env
```

## 次に進む

- [Day 1: PaaS インフラをデプロイ](day-1-deploy-infrastructure.ja.html)
