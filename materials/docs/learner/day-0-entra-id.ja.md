---
title: "Day 0: Entra ID と認証設定"
---

# Day 0: Entra ID と認証設定

このアプリは Microsoft Entra ID でサインインし、フロントエンド SPA がバックエンド API を呼び出します。Cloud Shell から 2 つのアプリ登録を作成します。

> **Entra の必要ロールは Application Developer（アプリケーション開発者）です。** 自分が作成・所有する演習専用アプリと、自分だけへの `Principal` 同意を使います。Application Administrator / Cloud Application Administrator / Global Administrator による組織全体同意は不要です。Azure の Owner / Contributor は別の権限であり、Entra ロールの代わりにはなりません。
>
> Application Developer が PIM の対象の場合は開始前に有効化してください。本人同意にもテナントの適用ポリシー・対象 scope・CLI の Graph 認可が関係します。拒否された場合はエラーを記録し、[トラブルシューティング](troubleshooting.ja.html)で切り分けます。管理者ロールの追加やテナントポリシーの変更で自動回避しません。

Azure リソース側の受講前提はサブスクリプションの **Owner** です。ここで使う Application Developer と本人専用 `Principal` 同意は、Owner 前提に変更しても維持します。

## 1. 名前を決める

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load base || exit 1

export BACKEND_APP_NAME="paas-blog-backend-${GROUP_ID}"
export FRONTEND_APP_NAME="paas-blog-frontend-${GROUP_ID}"
export ACCESS_SCOPE_ID="${ACCESS_SCOPE_ID:-$(node -p 'require("node:crypto").randomUUID()')}"
SIGNED_IN_USER_ID="$(az ad signed-in-user show --query id -o tsv)" || exit 1
workshop_state_save base || exit 1
```

保存済みの `BACKEND_CLIENT_ID` / `FRONTEND_CLIENT_ID` がある場合、以下のコードは作成を省略して既存アプリを確認します。削除済み・権限不足・tenant 不一致を区別し、新しいアプリを無断で作成しません。1 組の Backend / Frontend は作成者本人の演習専用とし、他グループや複数受講者で同意コマンドを共有・並行実行しません。

## 2. Backend API アプリ登録を作成する

```bash
if [ -z "$BACKEND_CLIENT_ID" ]; then
  BACKEND_CLIENT_ID="$(az ad app create \
    --display-name "$BACKEND_APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query appId -o tsv)" || exit 1
  export BACKEND_CLIENT_ID
else
  az ad app show --id "$BACKEND_CLIENT_ID" --output none || exit 1
fi
workshop_state_save base || exit 1

BACKEND_OBJECT_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query id -o tsv)" || exit 1
export BACKEND_OBJECT_ID

APP_OWNERS="$(az ad app owner list --id "$BACKEND_CLIENT_ID" -o json)" || exit 1
printf '%s' "$APP_OWNERS" | jq -e --arg user "$SIGNED_IN_USER_ID" 'any(.[]; .id == $user)' >/dev/null || {
  echo "自分が所有する Backend アプリでないため、変更を停止します。"
  exit 1
}

az ad app update \
  --id "$BACKEND_CLIENT_ID" \
  --identifier-uris "api://$BACKEND_CLIENT_ID"
```

`access_as_user` スコープを追加します。

Backend は `api://$BACKEND_CLIENT_ID/access_as_user` を要求した **user access token** を検証します。token の `aud` は v1 では Backend の GUID または `api://$BACKEND_CLIENT_ID`、v2 では Backend の GUID です。scope を要求する URI と、token に返る audience の表現は同じとは限りません。Frontend の ID token、app-only role token、別 API の token は代替にしません。

API は signature / tenant issuer / expiry / Backend audience と、`scp` の `access_as_user`、user identity を検査します。無効な token は 401、正しい user resource token でも必要 scope がなければ 403 です。403 の場合は Frontend の API permission 要求と実際の consent/grant を確認し、tenant policy を無断で変更しません。token 本文を教材・ログ・Issue に貼り付けないでください。

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
if [ -z "$FRONTEND_CLIENT_ID" ]; then
  FRONTEND_CLIENT_ID="$(az ad app create \
    --display-name "$FRONTEND_APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query appId -o tsv)" || exit 1
  export FRONTEND_CLIENT_ID
else
  az ad app show --id "$FRONTEND_CLIENT_ID" --output none || exit 1
fi
workshop_state_save base || exit 1

FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)" || exit 1
export FRONTEND_OBJECT_ID

APP_OWNERS="$(az ad app owner list --id "$FRONTEND_CLIENT_ID" -o json)" || exit 1
printf '%s' "$APP_OWNERS" | jq -e --arg user "$SIGNED_IN_USER_ID" 'any(.[]; .id == $user)' >/dev/null || {
  echo "自分が所有する Frontend アプリでないため、変更を停止します。"
  exit 1
}
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

EXISTING_REDIRECTS="$(az ad app show --id "$FRONTEND_CLIENT_ID" --query spa.redirectUris -o json)" || exit 1
SPA_PATCH="$(jq -nc --argjson existing "$EXISTING_REDIRECTS" '{
  spa: {
    redirectUris: (($existing // []) + ["http://localhost:4280"] | unique)
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

`az ad app permission add` は API permission の**要求設定**です。同意の付与ではありません。Backend scope の `type: "User"` は本人同意の対象であることを示しますが、組織全体同意の権限を与える設定ではありません。

## 4. Application Developer として本人だけに同意する

`--consent-type Principal` と `--principal-id` によって、**Cloud Shell にサインイン中の本人だけ**に `access_as_user` を付与します。`--principal-id` はメールアドレスや Client ID ではなく、対象テナント内の本人の user object ID です。省略時の `AllPrincipals` は全ユーザーへの同意であり、Application Developer 単独では実行できません。

**再実行の注意:** Azure CLI の grant 実装は同じ client/resource の既存 grant を削除してから作成するため、単に `Principal` を付けて繰り返してはいけません。次のブロックは本人の完全な既存 grant があれば再利用し、他ユーザー・全ユーザー・不足 scope の既存 grant があれば変更せず停止します。共有アプリでは実行しないでください。

括弧内は subshell です。読み取りや作成のエラーで停止しても Cloud Shell 自体は終了しません。

```bash
(
  set -euo pipefail
  : "${TENANT_ID:?Day 0 の tenant を復元してください}"
  : "${BACKEND_CLIENT_ID:?Backend Client ID を復元してください}"
  : "${FRONTEND_CLIENT_ID:?Frontend Client ID を復元してください}"
  GUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  for id in "$TENANT_ID" "$BACKEND_CLIENT_ID" "$FRONTEND_CLIENT_ID"; do
    if [[ ! "$id" =~ $GUID_PATTERN ]]; then
      echo "ERROR: tenant/client ID は GUID で指定してください。" >&2
      exit 1
    fi
  done
  ACCOUNT="$(az account show -o json)"
  if ! jq -e --arg tenant "$TENANT_ID" \
    '.tenantId == $tenant and .user.type == "user"' <<< "$ACCOUNT" >/dev/null; then
    echo "ERROR: 対象 tenant の本人アカウントで Cloud Shell にサインインしてください。" >&2
    exit 1
  fi
  USER_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"
  if [[ ! "$USER_OBJECT_ID" =~ $GUID_PATTERN ]]; then
    echo "ERROR: 本人の user object ID を取得できませんでした。" >&2
    exit 1
  fi
  for app_id in "$BACKEND_CLIENT_ID" "$FRONTEND_CLIENT_ID"; do
    OWNERS="$(az ad app owner list --id "$app_id" -o json)"
    if ! jq -e --arg user "$USER_OBJECT_ID" \
      'type == "array" and any(.[]; .id == $user)' <<< "$OWNERS" >/dev/null; then
      echo "ERROR: 本人が所有する演習専用アプリを指定してください。" >&2
      exit 1
    fi
  done
  for app_id in "$BACKEND_CLIENT_ID" "$FRONTEND_CLIENT_ID"; do
    SPS="$(az ad sp list --filter "appId eq '$app_id'" -o json)"
    if ! jq -e 'type == "array" and length <= 1' <<< "$SPS" >/dev/null; then
      echo "ERROR: service principal の検索結果が不正です。" >&2
      exit 1
    fi
    if [ "$(jq 'length' <<< "$SPS")" -eq 0 ]; then
      az ad sp create --id "$app_id" -o none
    fi
  done
  BACKEND_SP_ID="$(az ad sp show --id "$BACKEND_CLIENT_ID" --query id -o tsv)"
  FRONTEND_SP_ID="$(az ad sp show --id "$FRONTEND_CLIENT_ID" --query id -o tsv)"
  for id in "$BACKEND_SP_ID" "$FRONTEND_SP_ID"; do
    if [[ ! "$id" =~ $GUID_PATTERN ]]; then
      echo "ERROR: service principal object ID を取得できませんでした。" >&2
      exit 1
    fi
  done
  GRANTS="$(az ad app permission list-grants --id "$FRONTEND_CLIENT_ID" -o json)"
  if ! jq -e 'type == "array" and all(.[];
    (.clientId | type) == "string" and (.resourceId | type) == "string" and
    (.scope | type) == "string" and
    ((.consentType == "Principal" and (.principalId | type) == "string") or
     (.consentType == "AllPrincipals" and .principalId == null)))' <<< "$GRANTS" >/dev/null; then
    echo "ERROR: grant の読み取り結果が不正です。変更しません。" >&2
    exit 1
  fi
  PAIR_GRANTS="$(jq --arg client "$FRONTEND_SP_ID" --arg resource "$BACKEND_SP_ID" \
    '[.[] | select(.clientId == $client and .resourceId == $resource)]' <<< "$GRANTS")"
  if [ "$(jq 'length' <<< "$PAIR_GRANTS")" -eq 0 ]; then
    az ad app permission grant \
      --id "$FRONTEND_CLIENT_ID" \
      --api "$BACKEND_CLIENT_ID" \
      --scope "access_as_user" \
      --consent-type Principal \
      --principal-id "$USER_OBJECT_ID" \
      -o none
  elif jq -e --arg user "$USER_OBJECT_ID" \
    'length == 1 and all(.[];
      .consentType == "Principal" and .principalId == $user and
      (.scope | split(" ") | index("access_as_user")) != null)' <<< "$PAIR_GRANTS" >/dev/null; then
    echo "本人の既存 Principal grant を再利用します。"
  else
    echo "ERROR: 同じ client/resource に別の grant があります。削除・置換しません。" >&2
    exit 1
  fi
  VERIFIED_GRANTS="$(az ad app permission list-grants --id "$FRONTEND_CLIENT_ID" -o json)"
  if ! jq -e --arg client "$FRONTEND_SP_ID" --arg resource "$BACKEND_SP_ID" --arg user "$USER_OBJECT_ID" \
    'type == "array" and any(.[];
      .clientId == $client and .resourceId == $resource and
      .consentType == "Principal" and .principalId == $user and
      (.scope | split(" ") | index("access_as_user")) != null)' <<< "$VERIFIED_GRANTS" >/dev/null; then
    echo "ERROR: 本人の Principal grant を確認できませんでした。Day 1 に進まないでください。" >&2
    exit 1
  fi
  echo "本人の Principal grant を確認しました。"
)
```

`--scope` は scope ID (`ACCESS_SCOPE_ID`) ではなく scope value `access_as_user` です。Graph の反映待ちや権限不足の場合は実エラーを確認し、時間をおいてこの**ガード付きブロック全体**を再実行します。CLI に必要な Graph OAuth 権限と本人の Entra ロールは別の認可要素です。拒否されたときに受講者アプリへ Graph の強い権限を追加したり、`AllPrincipals` に変更したりしません。

要求設定と実際の grant を確認します。

```bash
echo "TENANT_ID=$TENANT_ID"
echo "BACKEND_CLIENT_ID=$BACKEND_CLIENT_ID"
echo "FRONTEND_CLIENT_ID=$FRONTEND_CLIENT_ID"

az ad app permission list \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc

az ad app owner list --id "$BACKEND_CLIENT_ID" --query "[].id" -o jsonc
az ad app owner list --id "$FRONTEND_CLIENT_ID" --query "[].id" -o jsonc
```

確認の見方:

| 確認先 | 何を見ているか | 期待値 |
|---|---|---|
| `az ad app permission list` | Frontend app registration の API permission 要求 (`requiredResourceAccess`) | Backend API の `access_as_user` が含まれる |
| `az ad app owner list` | 登録アプリの所有者 | 自分のユーザー object ID が含まれる。グループ専用アプリ以外は変更しない |
| `az ad app permission list-grants` | Frontend service principal に対する delegated permission grant | `clientId` は Frontend **service principal object ID**、`resourceId` は Backend **service principal object ID**。`scope` に `access_as_user`、`consentType` は `Principal`、`principalId` はサインイン中の本人の **user object ID** |
| Azure Portal の **App registrations > Frontend > API permissions** | `requiredResourceAccess` の表示 | 反映に時間がかかる場合があります。ブラウザー更新、Portal 再ログイン、対象 tenant/app の確認を行います。 |

Portal に表示されない場合でも、次の CLI で `resourceAppId` が `$BACKEND_CLIENT_ID`、`resourceAccess[].id` が `$ACCESS_SCOPE_ID` であれば、Frontend app registration には API permission 要求が入っています。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
  -o jsonc
```

## 5. 値を Cloud Shell に保存する

Cloud Shell のセッション切断に備え、再利用する値を Azure Files 側の state ファイルに保存します。

```bash
workshop_state_save identity || exit 1
printf 'State saved: %s\n' "$ENV_FILE"
```

次回 Cloud Shell を開いたら、次で復元できます。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh" || exit 1
workshop_state_load identity || exit 1
```

## 次に進む

- [Day 1: PaaS インフラをデプロイ](day-1-deploy-infrastructure.ja.html)

## Day 1 のサインイン後に自己同意を検証する

Frontend の SWA URL を SPA redirect URI に追加し、デプロイした画面の **Sign in with Microsoft** から同じテナントの受講者アカウントでサインインします。要求先が自分の Backend API の `api://<BACKEND_CLIENT_ID>/access_as_user` であることを同意画面で確認します。管理者の承認が必要と表示されたら、その時点で本線はブロックです。テナント設定を変更しません。

次の確認は service principal が作成された**サインイン後**に行います。Client ID と service principal object ID は別です。Cloud Shell とブラウザーで異なるアカウントを使わないでください。

```bash
BACKEND_SP_ID="$(az ad sp show --id "$BACKEND_CLIENT_ID" --query id -o tsv)"
FRONTEND_SP_ID="$(az ad sp show --id "$FRONTEND_CLIENT_ID" --query id -o tsv)"
SIGNED_IN_USER_ID="$(az ad signed-in-user show --query id -o tsv)"

if [ -z "$BACKEND_SP_ID" ] || [ -z "$FRONTEND_SP_ID" ] || [ -z "$SIGNED_IN_USER_ID" ]; then
  echo "同意検証に必要な object ID を取得できません。tenant、アカウント、Graph 読み取り権限を確認してください。"
  exit 1
fi

az ad app permission list-grants --id "$FRONTEND_CLIENT_ID" \
  --query "[?clientId=='$FRONTEND_SP_ID' && resourceId=='$BACKEND_SP_ID'].{clientId:clientId,resourceId:resourceId,consentType:consentType,principalId:principalId,scope:scope}" \
  -o jsonc
```

自己同意の期待値は `consentType: Principal`、`principalId: <SIGNED_IN_USER_ID>`、`scope` の空白区切りの値に `access_as_user` があることです。`AllPrincipals` / `principalId: null` は組織全体同意であり、自己同意成功の証拠ではありません。読み取りが拒否された場合も「grant がない」とは断定せず、検証不能として記録します。

続けて [アプリ検証](day-1-validation.ja.html) の認証付き記事作成を行います。同意、API の audience/scope、アプリ起動・DB 接続は別々の検証です。トークンをログへ出力したり、外部の解析サイトへ送信したりしないでください。管理者による組織全体同意は [インストラクターガイド（GitHub 上の補足資料）](https://github.com/hironariy/Azure-PaaS-Workshop/blob/main/docs/instructor-guide.ja.md) の任意例外で、本線の自己完結の証拠にはなりません。

参考: [Microsoft Graph: delegated permission grant](https://learn.microsoft.com/en-us/graph/api/oauth2permissiongrant-post)、[ユーザー同意の設定](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent)、[Azure CLI: permission grant](https://learn.microsoft.com/en-us/cli/azure/ad/app/permission#az-ad-app-permission-grant)。
