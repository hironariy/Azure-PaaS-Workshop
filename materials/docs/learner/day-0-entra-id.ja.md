---
title: "Day 0: Entra ID と認証設定"
---

# Day 0: Entra ID と認証設定

このアプリは Microsoft Entra ID でサインインし、フロントエンド SPA がバックエンド API を呼び出します。Cloud Shell から 2 つのアプリ登録を作成します。

> テナントポリシーにより app registration 作成が禁止されている場合は、このページの CLI 手順ではなく、講師から配布された `TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` を使ってください。

## 1. 名前を決める

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"

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

> `az ad app update --set api.oauth2PermissionScopes=...` は、新規 app registration の `api` プロパティがまだ初期化されていない場合に `Couldn't find 'api' in ''` で失敗することがあります。この手順では Microsoft Graph の application object ID (`BACKEND_OBJECT_ID`) に対して `az rest` で PATCH します。`BACKEND_OBJECT_ID` が空だと `/applications/` への PATCH になり `Method Not Allowed` になるため、PATCH 直前に再取得して確認します。

```bash
export BACKEND_OBJECT_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query id -o tsv)"

if [ -z "$BACKEND_OBJECT_ID" ]; then
  echo "BACKEND_OBJECT_ID を取得できませんでした。BACKEND_CLIENT_ID=$BACKEND_CLIENT_ID を確認してください。"
  exit 1
fi

echo "BACKEND_OBJECT_ID=$BACKEND_OBJECT_ID"

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
export FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"

if [ -z "$FRONTEND_OBJECT_ID" ]; then
  echo "FRONTEND_OBJECT_ID を取得できませんでした。FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID を確認してください。"
  exit 1
fi

echo "FRONTEND_OBJECT_ID=$FRONTEND_OBJECT_ID"

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

`az ad app permission add` は Frontend app registration に「この API scope を要求する」という設定を追加します。実際に delegated permission を有効にするには、service principal を作成したうえで `permission grant` に scope 名を渡します。

```bash
if ! az ad sp show --id "$BACKEND_CLIENT_ID" 1>/dev/null 2>&1; then
  az ad sp create --id "$BACKEND_CLIENT_ID" 1>/dev/null
fi

if ! az ad sp show --id "$FRONTEND_CLIENT_ID" 1>/dev/null 2>&1; then
  az ad sp create --id "$FRONTEND_CLIENT_ID" 1>/dev/null
fi

az ad app permission grant \
  --id "$FRONTEND_CLIENT_ID" \
  --api "$BACKEND_CLIENT_ID" \
  --scope "access_as_user"
```

`--scope` は scope の ID (`ACCESS_SCOPE_ID`) ではなく、Backend API で公開した scope value の `access_as_user` を指定します。管理者権限がない場合は `permission grant` が失敗することがあります。その場合は講師またはテナント管理者に依頼してください。

確認します。

```bash
echo "TENANT_ID=$TENANT_ID"
echo "BACKEND_CLIENT_ID=$BACKEND_CLIENT_ID"
echo "FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID"

az ad app permission list \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc

az ad app permission list-grants \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc
```

確認の見方:

| 確認先 | 何を見ているか | 期待値 |
|---|---|---|
| `az ad app permission list` | Frontend app registration の API permission 要求 (`requiredResourceAccess`) | Backend API の `access_as_user` が含まれる |
| `az ad app permission list-grants` | Frontend service principal に対する delegated permission grant | `scope` に `access_as_user` が含まれる |
| Azure Portal の **App registrations > Frontend > API permissions** | `requiredResourceAccess` の表示 | 反映に時間がかかる場合があります。ブラウザー更新、Portal 再ログイン、対象 tenant/app の確認を行います。 |

Portal に表示されない場合でも、次の CLI で `resourceAppId` が `$BACKEND_CLIENT_ID`、`resourceAccess[].id` が `$ACCESS_SCOPE_ID` であれば、Frontend app registration には API permission 要求が入っています。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
  -o jsonc
```

## 4. 値を Cloud Shell に保存する

Cloud Shell のセッション切断に備え、再利用する値を Azure Files 側の state ファイルに保存します。

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
export BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
export FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
export ACCESS_SCOPE_ID="$ACCESS_SCOPE_ID"
EOF

cat "$ENV_FILE"
```

次回 Cloud Shell を開いたら、次で復元できます。

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
```

## 次に進む

- [Day 1: PaaS インフラをデプロイ](day-1-deploy-infrastructure.ja.html)
