---
title: "Day 0: Entra ID と認証設定"
---

# Day 0: Entra ID と認証設定

このワークショップのブログアプリは Microsoft Entra ID でサインインし、フロントエンド SPA が取得したアクセストークンを使ってバックエンド API を呼び出します。このページでは、Cloud Shell からバックエンド用とフロントエンド用の 2 つのアプリ登録を作成します。

> **必要な Entra ロール:**
> **Application Developer（アプリケーション開発者）** ロールを使用します。受講者自身が作成・所有するアプリに対して、`--consent-type Principal`（サインイン中の本人に対する個人同意）を付与することで、テナント全体の管理者同意（Global Administrator 等）なしで完結できます。PIM を利用している場合は開始前に有効化してください。

## 1. アプリ名とスコープ ID を準備する

登録するアプリの表示名と OAuth2 スコープ用の UUID を準備します。

> 💡 Cloud Shell が再接続されて変数が消えた場合のみ、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load base` を先に実行してください。

```bash
export BACKEND_APP_NAME="paas-blog-backend-${GROUP_ID}"
export FRONTEND_APP_NAME="paas-blog-frontend-${GROUP_ID}"
export ACCESS_SCOPE_ID="${ACCESS_SCOPE_ID:-$(node -p 'require("node:crypto").randomUUID()')}"
SIGNED_IN_USER_ID="$(az ad signed-in-user show --query id -o tsv)"
```

すでに `BACKEND_CLIENT_ID` や `FRONTEND_CLIENT_ID` が設定されている場合は、以下の手順を再実行しても新しいアプリは重複作成されず、既存のアプリ登録がそのまま使われます。

## 2. バックエンド API 用のアプリ登録を作成する

バックエンド API を表すアプリ登録を作成し、識別子 URI（`api://<BACKEND_CLIENT_ID>`）を設定します。

```bash
if [ -z "${BACKEND_CLIENT_ID:-}" ]; then
  BACKEND_CLIENT_ID="$(az ad app create \
    --display-name "$BACKEND_APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query appId -o tsv)"
  export BACKEND_CLIENT_ID
else
  az ad app show --id "$BACKEND_CLIENT_ID" --output none
fi

BACKEND_OBJECT_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query id -o tsv)"
export BACKEND_OBJECT_ID

SIGNED_IN_USER_ID="${SIGNED_IN_USER_ID:-$(az ad signed-in-user show --query id -o tsv)}"
if [ -z "$(az ad app owner list --id "$BACKEND_CLIENT_ID" --query "[?id=='$SIGNED_IN_USER_ID'].id" -o tsv)" ]; then
  az ad app owner add --id "$BACKEND_CLIENT_ID" --owner-object-id "$SIGNED_IN_USER_ID"
fi

az ad app update \
  --id "$BACKEND_CLIENT_ID" \
  --identifier-uris "api://$BACKEND_CLIENT_ID"
```

続けて、フロントエンドから委任アクセスするための `access_as_user` スコープを公開します。

> **補足:** 新規作成した直後のアプリ登録に対して `az ad app update --set api.oauth2PermissionScopes=...` を実行すると、`api` プロパティが未初期化のためエラーになることがあります。ここでは Microsoft Graph REST API（`az rest`）を使ってオブジェクト ID（`BACKEND_OBJECT_ID`）へ直接 PATCH します。既存のアプリ登録に `access_as_user` スコープが存在する場合はそのスコープ ID を引き継ぎます。

```bash
export BACKEND_OBJECT_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query id -o tsv)"

echo "BACKEND_OBJECT_ID=$BACKEND_OBJECT_ID"

EXISTING_SCOPE_ID="$(az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)"
export ACCESS_SCOPE_ID="${EXISTING_SCOPE_ID:-${ACCESS_SCOPE_ID:-$(node -p 'require("node:crypto").randomUUID()')}}"

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

設定された内容を確認します。`scopes` に `["access_as_user"]` が含まれていれば成功です。

```bash
az ad app show \
  --id "$BACKEND_CLIENT_ID" \
  --query "{displayName:displayName,appId:appId,identifierUris:identifierUris,scopes:api.oauth2PermissionScopes[].value}" \
  -o jsonc
```

## 3. フロントエンド SPA 用のアプリ登録を作成する

次に、React フロントエンド（SPA）用のアプリ登録を作成します。

```bash
if [ -z "${FRONTEND_CLIENT_ID:-}" ]; then
  FRONTEND_CLIENT_ID="$(az ad app create \
    --display-name "$FRONTEND_APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --query appId -o tsv)"
  export FRONTEND_CLIENT_ID
else
  az ad app show --id "$FRONTEND_CLIENT_ID" --output none
fi

FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"
export FRONTEND_OBJECT_ID

SIGNED_IN_USER_ID="${SIGNED_IN_USER_ID:-$(az ad signed-in-user show --query id -o tsv)}"
if [ -z "$(az ad app owner list --id "$FRONTEND_CLIENT_ID" --query "[?id=='$SIGNED_IN_USER_ID'].id" -o tsv)" ]; then
  az ad app owner add --id "$FRONTEND_CLIENT_ID" --owner-object-id "$SIGNED_IN_USER_ID"
fi
```

この時点では本番の Static Web Apps の URL がまだ決まっていないため、まずローカル検証用のリダイレクト URI（`http://localhost:4280`）を SPA として登録します。Static Web Apps の本番 URL は Day 1 のインフラデプロイ後に追加します。

```bash
export FRONTEND_OBJECT_ID="$(az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query id -o tsv)"

echo "FRONTEND_OBJECT_ID=$FRONTEND_OBJECT_ID"

EXISTING_REDIRECTS="$(az ad app show --id "$FRONTEND_CLIENT_ID" --query spa.redirectUris -o json)"
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

続いて、フロントエンドからバックエンド API の `access_as_user` スコープを呼び出せるように API アクセス許可を追加します。

```bash
echo "Waiting for Microsoft Graph propagation..."
sleep 10

az ad app permission add \
  --id "$FRONTEND_CLIENT_ID" \
  --api "$BACKEND_CLIENT_ID" \
  --api-permissions "${ACCESS_SCOPE_ID}=Scope"
```

## 4. Application Developer として本人だけに同意する

`az ad app permission add` は「アプリが必要とする API アクセス許可の定義」を追加するコマンドです。続けて `--consent-type Principal` と `--principal-id` を指定し、**現在 Cloud Shell にサインインしている受講者本人**に対して `access_as_user` スコープの同意（grant）を付与します。

> **補足:** `--consent-type` を省略するとテナント全ユーザー対象の `AllPrincipals` となり、Application Developer ロールでは権限不足になります。また、再実行時に既存の同意を上書きしないよう、以下のスクリプトではサービスプリンシパルと既存の同意状態を確認してから付与します。

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

#### 出力メッセージと状態一覧

上のコマンドブロックを実行した際の出力メッセージと、それぞれの状態・対処方法は以下のとおりです。

| 出力メッセージ | 現在の状態 | 次のアクション |
|---|---|---|
| `本人の Principal grant を確認しました。` | **正常完了（新規付与）**<br>サインイン中の本人に対する個人同意（`consentType: Principal` / `scope: access_as_user`）が付与され、Microsoft Graph 上でも確認できた状態です。 | そのまま下の確認コマンドへ進んでください。 |
| `本人の既存 Principal grant を再利用します。`<br>`本人の Principal grant を確認しました。` | **正常完了（既存同意の再利用）**<br>すでに本人に対する個人同意が存在していたため、重複作成や上書きを行わずに既存の同意を再利用した状態です。 | そのまま下の確認コマンドへ進んでください。 |
| `Day 0 の tenant を復元してください`<br>`Backend Client ID を復元してください`<br>`Frontend Client ID を復元してください`<br>`ERROR: tenant/client ID は GUID で指定してください。` | **環境変数の未設定・形式不正**<br>`TENANT_ID`、`BACKEND_CLIENT_ID`、`FRONTEND_CLIENT_ID` のいずれかが現在のシェルに設定されていないか、GUID 形式ではありません。 | `source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load base` を実行し、手順 1〜3 を順に実行してから再実行してください。 |
| `ERROR: 対象 tenant の本人アカウントで Cloud Shell にサインインしてください。`<br>`ERROR: 本人の user object ID を取得できませんでした。` | **サインインアカウント・テナントの不一致**<br>現在の Azure CLI セッションが `TENANT_ID` と異なるテナントを向いているか、ユーザーアカウント以外でサインインしています。 | `az login --tenant "$TENANT_ID"` で受講者本人のアカウントでサインインし直してから再実行してください。 |
| `ERROR: 本人が所有する演習専用アプリを指定してください。` | **アプリ所有者の不一致**<br>バックエンドまたはフロントエンドのアプリ登録の所有者（`owners`）に、サインイン中の本人が含まれていません。 | 手順 2・手順 3 のアプリ作成・所有者追加コマンドを再実行するか、他者の同名アプリと衝突している場合は `GROUP_ID` を変更して新規作成してください。 |
| `ERROR: service principal の検索結果が不正です。`<br>`ERROR: service principal object ID を取得できませんでした。` | **サービスプリンシパルの反映待ち**<br>エンタープライズ アプリケーション（サービスプリンシパル）作成直後で、Microsoft Graph への反映が完了していません。 | 10〜20 秒ほど待ってから、上のコードブロック全体を再実行してください。 |
| `ERROR: 同じ client/resource に別の grant があります。削除・置換しません。`<br>`ERROR: grant の読み取り結果が不正です。変更しません。` | **既存の別同意との競合**<br>対象アプリに別ユーザーの同意や過去の `AllPrincipals`（テナント全体）同意が残っており、安全のため上書きせず停止しています。 | 過去の演習で作成した同名アプリが残っている場合は、古いアプリ登録を削除するか `GROUP_ID` を変えて手順 1 から新規作成してください。 |
| `ERROR: 本人の Principal grant を確認できませんでした。Day 1 に進まないでください。` | **同意付与後の反映待ち**<br>同意付与直後の読み取りで Microsoft Graph へのレプリケーションがまだ完了していません。 | 10〜20 秒ほど待ってから、上のコードブロック全体を再実行してください。 |

設定された API アクセス許可と所有者を確認します。

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

| 確認コマンド | 確認内容 | 期待される結果 |
|---|---|---|
| `az ad app permission list` | フロントエンドアプリの API アクセス許可設定 (`requiredResourceAccess`) | バックエンド API のスコープ ID (`$ACCESS_SCOPE_ID`) が含まれていること |
| `az ad app owner list` | アプリ登録の所有者 | サインイン中の自分のユーザー Object ID が含まれていること |
| `az ad app permission list-grants` | フロントエンドに対する委任されたアクセス許可の同意 (`oauth2PermissionGrants`) | `consentType` が `Principal`、`principalId` が自分のユーザー Object ID、`scope` に `access_as_user` が含まれていること |

> Azure Portal の **アプリの登録 > フロントエンドアプリ > API のアクセス許可** 画面には反映まで少し時間がかかる場合があります。次のコマンドで `requiredResourceAccess` が表示されていれば設定は完了しています。
>
> ```bash
> az ad app show \
>   --id "$FRONTEND_CLIENT_ID" \
>   --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
>   -o jsonc
> ```

## 5. 設定値を Cloud Shell に保存する

作成した Client ID とスコープ ID を永続ストレージ（`$ENV_FILE`）に保存します。

```bash
workshop_state_save identity
printf 'State saved: %s\n' "$ENV_FILE"
```

> 💡 Cloud Shell のセッションが切れた場合は、`source ~/Azure-PaaS-Workshop/scripts/workshop-state.sh && workshop_state_load identity` でここまでの変数を復元できます。

## 次に進む

- [Day 1: PaaS インフラのデプロイ](day-1-deploy-infrastructure.ja.html)
