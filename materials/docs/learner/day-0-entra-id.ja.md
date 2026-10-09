---
title: "Day 0: Entra ID と認証設定"
---

# Day 0: Entra ID と認証設定

このアプリは Microsoft Entra ID でサインインし、フロントエンド SPA がバックエンド API を呼び出します。Cloud Shell から 2 つのアプリ登録を作成します。

> **権限を先に確認:** Azure の Contributor は Entra のアプリ登録・同意権限ではありません。本線はグループ専用の所有アプリを作成し、許可されたユーザーがブラウザーで自分に同意する経路です。登録またはユーザー同意がテナントポリシーで禁止されている場合、「Contributor のみ・主催者の事前準備なし」では完了できません。権限を昇格したり、共有アプリの grant を変更したりせず、制約を記録して停止します。

| 操作 | 必要な権限・条件 | Contributor で付与されるか |
|---|---|---|
| Azure リソース作成 | 対象スコープの Azure RBAC | 対象スコープ内で可能 |
| アプリ登録作成・所有アプリ設定 | 許可された登録設定、Application Developer 等 | いいえ |
| API permission 要求 | Frontend アプリの管理権限 | いいえ |
| 自分への同意 | 対象 scope とテナントのユーザー同意ポリシー | いいえ |
| 全ユーザーへの同意 | Cloud Application Administrator / Application Administrator 等 | いいえ |

`access_as_user` を `type: "User"` にしても、ユーザー同意ポリシーは回避できません。未検証の自動完結を保証するものではありません。

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

保存済みの `BACKEND_CLIENT_ID` / `FRONTEND_CLIENT_ID` がある場合、以下のコードは作成を省略して既存アプリを確認します。削除済み・権限不足・tenant 不一致を区別し、新しいアプリを無断で作成しません。アプリ作成と state 保存は別サービスの操作であり、同時に確定できません。作成直後に保存が失敗した場合は、その ID を保持して保存を再試行します。ID を失った場合は専用アプリの名前・所有者を確認して復元し、作成コードをそのまま再実行しません。

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

`az ad app permission add` は「この API scope を要求する」という設定です。**実際の同意ではありません。** 本線では Day 1 の MSAL サインイン時に対象ユーザーが自分に同意します。Day 0 で grant がないこと自体は失敗ではありません。

受講者は `az ad app permission grant` を実行しません。`--consent-type` 省略時は `AllPrincipals`（テナント全体）です。単に `Principal` に置き換えて繰り返す方法も採用しません。CLI の実装によっては同じ client/resource の既存 grant を削除・置換し、共有アプリの他ユーザーの同意へ影響するためです。

確認します。

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
