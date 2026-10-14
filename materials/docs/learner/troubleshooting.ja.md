---
title: トラブルシューティング
---

# トラブルシューティング

Cloud Shell 専用手順で詰まりやすい問題を、症状別に確認します。

## Owner の前提権限が不足している

本ワークショップは、利用する Azure サブスクリプションの **Owner** を受講者の前提とします。Contributor のみでは、Day 1 の `Microsoft.Authorization/roleAssignments/write`（App Service の Managed Identity への Key Vault Secrets User 割り当て）が拒否されます。

[Day 0 の Owner 確認](day-0-prerequisites.ja.html)で、対象 subscription、グループ経由・継承の割り当て、PIM の有効化を確認してください。Owner を確認できなければデプロイ前に停止し、講師またはサブスクリプション管理担当に受講環境を確認します。必要な割り当ての省略、Key Vault RBAC 無効化、無断の権限昇格で回避しません。Owner 確認後も拒否される場合は、Deny Assignment・Azure Policy・対象スコープを調べます。

Azure Owner は Entra の Application Developer や組織全体同意の権限を意味しません。アプリ登録・本人同意の失敗は別途切り分けます。

## Cloud Shell の変数が空になる

症状:

```bash
echo "$RESOURCE_GROUP"
```

が空になる。

対処:

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cat "$WORKSHOP_STATE_DIR/paas-workshop.env"
```

ファイルが無い場合は [受講者クイックスタート](cloud-shell-quickstart.ja.html) から変数を再設定します。

## Provider 登録で失敗する

症状:

```text
AuthorizationFailed
```

可能性:

- サブスクリプションに対する権限が不足している。
- 講師指定のサブスクリプションを選択していない。

確認:

```bash
az account show --output table
az role assignment list --assignee "$(az ad signed-in-user show --query id -o tsv)" --all -o table
```

## Entra ID app registration を作成できない

症状:

```text
Insufficient privileges
```

対処:

- 対象 tenant、本人の Application Developer、有効化が必要な PIM、適用ポリシーを確認します。Azure Owner があるだけでは Entra の権限不足は解消しません。
- [Day 0 の Entra 手順](day-0-entra-id.ja.html)で本人が作成・所有する演習専用アプリを使います。共有 Client ID の配布や全ユーザーへの管理者同意を標準の回避策にしません。
- 解消できない場合はエラーを記録して停止し、講師・テナント管理担当へ相談してください。

## Bicep デプロイが失敗する

まず詳細を確認します。

```bash
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.error" -o jsonc
```

よくある原因:

| 症状 | 確認 |
|---|---|
| SKU quota | App Service Plan / Cosmos DB tier の quota |
| region unavailable | `LOCATION` と `SWA_LOCATION` |
| invalid password | `COSMOS_PASSWORD` が空でないか |
| app registration mismatch | `BACKEND_CLIENT_ID` / `FRONTEND_CLIENT_ID` |

## App Service `/health` が失敗する

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

確認ポイント:

- backend ZIP deploy が完了しているか。
- App Service の startup command が `node dist/src/app.js` になっているか。
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` が設定されているか。
- Key Vault reference が解決できているか。
- Cosmos DB 接続で失敗していないか。

```bash
az webapp config show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{startupFile:appCommandLine,linuxFxVersion:linuxFxVersion}" \
  -o jsonc

az webapp config appsettings list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT' || name=='COSMOS_CONNECTION_STRING'].{name:name,value:value}" \
  -o table
```

### `Cannot find module '/home/site/wwwroot/src/app.js'`

原因:

- 古い手順または古いスクリプトで App Service の startup command が `node src/app.js` のままになっている。
- ZIP deploy が完了する前に App Service が再起動し、まだ起動ファイルが配置されていない。

対処:

```bash
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --startup-file "node dist/src/app.js"

./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

`az webapp deploy` の出力が `Warmed up Kudu instance successfully.` でしばらく止まって見える場合があります。Cloud Shell から ZIP をアップロードしている間は追加ログが出ないことがあるため、数分待ってから App Service logs と `/health` を確認します。

## SWA `/api/health` が 404

可能性:

- フロントエンド成果物が Static Web Apps にまだデプロイされていない。
- Static Web Apps が Standard SKU ではない。
- Linked Backend が作成されていない。

確認:

```bash
az staticwebapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SWA_NAME" \
  --query "{name:name,sku:sku,defaultHostname:defaultHostname}" -o jsonc

az resource list \
  --resource-group "$RESOURCE_GROUP" \
  --resource-type "Microsoft.Web/staticSites/linkedBackends" \
  -o table
```

## サインイン後に戻れない

Frontend SPA app registration の redirect URI を確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

`https://<swa-hostname>` が無い場合は追加します。

```bash
REDIRECT_URIS="$(jq -nc --arg swa "https://$SWA_HOSTNAME" '["http://localhost:4280", $swa, ($swa + "/")]')"

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

## Frontend の API permissions が Portal に表示されない

`az ad app permission add` は Frontend app registration の API permission 要求を追加し、`az ad app permission grant` は Frontend service principal に delegated permission grant を作成します。Portal の **App registrations > Frontend > API permissions** は前者を表示しますが、反映に時間がかかることがあります。

CLI で状態を確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
  -o jsonc

az ad app permission list-grants \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc
```

期待値:

- `requiredResourceAccess[].resourceAppId` が `$BACKEND_CLIENT_ID`
- `requiredResourceAccess[].resourceAccess[].id` が `$ACCESS_SCOPE_ID`
- `list-grants` の `clientId` は Frontend service principal object ID、`resourceId` は Backend service principal object ID（application の object ID / Client ID とは別）
- `scope` に `access_as_user`、`consentType` は `Principal`、`principalId` は `az ad signed-in-user show --query id -o tsv` で取得する本人の user object ID

CLI では見えるのに Portal で見えない場合は、ブラウザー更新、Portal 再ログイン、正しい tenant と Frontend app registration を開いているかを確認します。

## Day 0 の本人同意が拒否される・既存 grant で停止する

| 症状 | 確認と対処 |
|---|---|
| `permission grant` が権限不足 | `--consent-type Principal` と `--principal-id` があるか確認します。省略時は `AllPrincipals` となり、Application Developer 単独では不足します。 |
| 正しい `Principal` でも拒否 | `az account show --query "{tenant:tenantId,userType:user.type}" -o jsonc` で対象 tenant と本人ログインを確認。Application Developer の PIM 有効化、所有アプリ、`type: User` の scope、適用 consent policy と CLI の Graph OAuth 認可を切り分けます。Azure Owner / Contributor では代替できません。 |
| service principal の検索・grant の読み取りが失敗 | 読み取り拒否を「存在しない」と解釈して作成・上書きしません。実エラーを確認し、Graph 反映待ちなら時間をおいて Day 0 のガード付きブロックを再実行します。 |
| 「別の grant があります」で停止 | 他ユーザーや全ユーザーへの既存同意を保護しています。grant を削除せず、本人専用の新規アプリで演習するか、既存アプリの管理担当に確認します。 |
| Day 1 で同意画面が出ない | Day 0 で本人の `Principal` grant を作成済みなら正常です。本人の grant と認証 CRUD を確認します。同意画面が出ないことだけで新規同意の成否を判断しません。 |

CLI バージョン (`az version`)、実効ロール・PIM 状態、失敗した操作、エラーコードと本文を記録してください。共有 Issue へ token、資格情報、本人の object ID などの個人情報を貼らないでください。講師への相談時も必要な tenant/client/scope の値は承認済みの連絡経路で共有します。管理者は対象・ポリシー・CLI 認可を調査する担当であり、受講者全員への管理者ロール付与や無条件の組織全体同意を依頼する手順ではありません。

参考: [CLI の consent type と principal ID](https://learn.microsoft.com/en-us/cli/azure/ad/app/permission?view=azure-cli-latest#az-ad-app-permission-grant)、[Application Developer の権限](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/permissions-reference#application-developer)。

## ログイン時に `AADSTS900144` が出る

症状:

```text
AADSTS900144: The request body must contain the following parameter: 'client_id'.
```

原因:

- Static Web Apps にデプロイされた `index.html` の `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID` が入っていない。
- `$WORKSHOP_STATE_DIR/deploy-frontend.local.env` の値が空、または古い frontend 成果物を再デプロイしている。

確認:

```bash
curl -fsS "https://${SWA_HOSTNAME}" \
  | grep -o 'window.__APP_CONFIG__=[^<]*'

cat "$WORKSHOP_STATE_DIR/deploy-frontend.local.env"
```

期待値は `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID`、`ENTRA_TENANT_ID`、`ENTRA_BACKEND_CLIENT_ID` が含まれることです。

`window.__APP_CONFIG__` が正しいのに同じエラーが続く場合は、古いデプロイスクリプトで Vite の development bundle をデプロイしている可能性があります。`git pull` 後に `./scripts/deploy-frontend.sh "$RESOURCE_GROUP"` を再実行してください。スクリプトは `NODE_ENV=production` を強制し、development bundle が混入した場合はデプロイ前に停止します。また、このワークショップ本線では Static Web Apps 組み込み認証の `/.auth/login/aad` ではなく、アプリ画面の **Sign in with Microsoft** ボタンから MSAL でログインします。

対処:

```bash
cat > "$WORKSHOP_STATE_DIR/deploy-frontend.local.env" <<EOF
ENTRA_TENANT_ID="$TENANT_ID"
ENTRA_FRONTEND_CLIENT_ID="$FRONTEND_CLIENT_ID"
ENTRA_BACKEND_CLIENT_ID="$BACKEND_CLIENT_ID"
EOF

./scripts/deploy-frontend.sh "$RESOURCE_GROUP"
```

## フロントエンド build が失敗する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR/materials/frontend"
node --version
npm --version
npm ci
npm run build
```

Node.js が古い場合、Cloud Shell 環境差異の可能性があります。講師に相談してください。

## バックエンド build / ZIP deploy が失敗する

```bash
export WORKSHOP_STATE_DIR="$HOME/clouddrive/paas-workshop"
source "$WORKSHOP_STATE_DIR/paas-workshop.env"
cd "$WORKSHOP_REPO_DIR"
node --version
npm --version
zip -v | head -1
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

確認ポイント:

- `materials/backend/package-lock.json` が存在する。
- `npm run build` が成功している。
- `deploy.zip` の中身に `dist/src/app.js` があり、パスが `/` 区切りになっている。
- App Service logs に `Cannot find module` や Key Vault reference のエラーが出ていない。
