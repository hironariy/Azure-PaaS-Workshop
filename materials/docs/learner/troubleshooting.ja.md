---
title: トラブルシューティング
---

# トラブルシューティング

Cloud Shell での演習中によくある問題と、症状別の確認・対処方法をまとめています。

## サブスクリプションの Owner 権限が不足している

このワークショップでは、対象 Azure サブスクリプションの **Owner（所有者）** ロールが必要です。Contributor（共同作成者）のみでは、Day 1 の Bicep デプロイで App Service のマネージド ID に対する Key Vault ロール割り当て（`Microsoft.Authorization/roleAssignments/write`）を作成できません。

- [Day 0: 事前準備 2](day-0-prerequisites.ja.html) の確認コマンドで、対象サブスクリプションの Owner ロールが有効になっているか確認してください。
- PIM（Privileged Identity Management）を利用している場合は、ロールを有効化してから再実行してください。
- Azure の Owner ロールと Microsoft Entra ID の Application Developer ロールは別の権限です。アプリ登録や同意で権限エラーになる場合は、Entra ID 側のロール割り当てを確認してください。

## Cloud Shell の環境変数が消えてしまった

**症状:**
`echo "$RESOURCE_GROUP"` などを実行しても空欄になる（Cloud Shell のセッション再接続後など）。

**対処:**
永続ストレージ（`~/clouddrive/paas-workshop/paas-workshop.json`）に保存された変数を復元します。

```bash
export WORKSHOP_REPO_DIR="${WORKSHOP_REPO_DIR:-$HOME/Azure-PaaS-Workshop}"
export WORKSHOP_STATE_DIR="${WORKSHOP_STATE_DIR:-$HOME/clouddrive/paas-workshop}"
source "$WORKSHOP_REPO_DIR/scripts/workshop-state.sh"
workshop_state_load base
printf 'State: %s / Subscription: %s / RG: %s\n' "$ENV_FILE" "$SUBSCRIPTION_ID" "$RESOURCE_GROUP"
```

Day 0 の Entra ID 設定まで完了している場合は `workshop_state_load identity`、Day 1 のインフラデプロイまで完了している場合は `workshop_state_load deployed` で復元できます。

もしサブスクリプションの不一致エラーが出た場合は、`az account set --subscription "$SUBSCRIPTION_ID"` を実行してから再度読み込んでください。

## SWA CLI のインストールが `EACCES` で失敗する

**症状:**
`npm install -g @azure/static-web-apps-cli@2.0.10` で `EACCES: permission denied, mkdir '/usr/lib/node_modules/@azure'` などが表示される。

**原因:**
npm がシステム領域へグローバルインストールしようとしています。Cloud Shell の一般ユーザーにはそのディレクトリへの書き込み権限がありません。Azure の Owner ロールや Entra ID の権限とは別の、OS のファイルアクセス権限の問題です。

**対処と確認:**
[Day 1: フロントエンドのデプロイ](day-1-deploy-frontend.ja.html)の「SWA CLI をユーザー領域にインストールする」を実行してください。`--prefix "$HOME/.local"` でインストール先を指定し、`$HOME/.local/bin` を `PATH` に追加します。`swa --version` が成功してから、同じ Cloud Shell でデプロイを再開します。

`sudo` やシステムディレクトリの権限変更は不要です。再接続後に `swa: command not found` となった場合も、同じ手順で `PATH` を再設定してください。

## リソースプロバイダーの登録で失敗する

**症状:**
`AuthorizationFailed` が表示される。

**原因と確認:**
選択しているサブスクリプションが異なるか、サブスクリプションの権限が有効になっていません。

```bash
az account show --output table
az role assignment list --assignee "$(az ad signed-in-user show --query id -o tsv)" --all -o table
```

## Entra ID のアプリ登録を作成できない

**症状:**
`az ad app create` や `az rest` 実行時に `Insufficient privileges` が表示される。

**確認と対処:**
- 対象テナントで **Application Developer（アプリケーション開発者）** ロールが割り当てられているか、PIM の有効化が必要でないか確認します。
- すでに作成したアプリがある場合は、[Day 0: Entra ID と認証設定](day-0-entra-id.ja.html) の手順で自分が所有者（Owner）になっているアプリを使用します。

## Day 0 の本人同意（`permission grant`）でエラーになる

| 症状 | 確認と対処 |
|---|---|
| `permission grant` で権限不足になる | `--consent-type Principal` と `--principal-id "$USER_OBJECT_ID"` が指定されているか確認します。省略すると全ユーザー対象の `AllPrincipals` になり、Application Developer ロールでは実行できません。 |
| サービスプリンシパルや grant の取得に失敗する | アプリ作成直後は Microsoft Graph への反映に数秒〜十数秒かかる場合があります。少し時間をおいて、[Day 0 手順 4](day-0-entra-id.ja.html#4-application-developer-として本人だけに同意する) のコードブロック全体を再実行してください。 |
| 「別の grant があります」で停止する | 他のユーザーまたは `AllPrincipals` の既存同意を上書きしないよう保護しています。自分が所有する演習専用アプリであることを確認してください。 |
| Day 1 のブラウザーサインインで同意画面が出ない | Day 0 で本人の `Principal` 同意がすでに付与されているため正常です。そのままサインインと記事作成（CRUD）へ進んでください。 |

## Frontend の API アクセス許可が Azure Portal に表示されない

Azure Portal の **アプリの登録 > フロントエンドアプリ > API のアクセス許可** 画面は、反映に少し時間がかかる場合があります。次の CLI コマンドで設定値と同意（grant）が確認できれば問題ありません。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "requiredResourceAccess[?resourceAppId=='$BACKEND_CLIENT_ID']" \
  -o jsonc

az ad app permission list-grants \
  --id "$FRONTEND_CLIENT_ID" \
  -o jsonc
```

- `requiredResourceAccess[].resourceAppId` が `$BACKEND_CLIENT_ID`、スコープ ID が `$ACCESS_SCOPE_ID` になっていること。
- `list-grants` の `consentType` が `Principal`、`principalId` が自分のユーザー Object ID、`scope` に `access_as_user` が含まれていること。

## Bicep デプロイが失敗する

まずデプロイエラーの詳細を確認します。

```bash
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query "properties.error" -o jsonc
```

| よくある原因 | 確認ポイント |
|---|---|
| SKU のクォータ不足・容量制限 | App Service Plan (`B1`) や Cosmos DB (`M25`) のリージョン制限・サブスクリプションクォータを確認する |
| リージョン指定の誤り | `LOCATION` と `SWA_LOCATION`（Static Web Apps 対応リージョン）を確認する |
| パスワード要件エラー | `$PARAM_FILE` の `cosmosDbAdminPassword` が空になっていないか確認する |
| Entra ID パラメータの未設定 | `$PARAM_FILE` の `entraTenantId` / `entraBackendClientId` / `entraFrontendClientId` を確認する |

## App Service の `/health` が失敗する

まずアプリケーションのログストリームを確認します。

```bash
az webapp log tail \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME"
```

主な確認ポイント:
- バックエンドの ZIP デプロイが完了しているか。
- スタートアップコマンドが `node dist/src/app.js` になっているか。
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` が設定されているか。
- Key Vault 参照（`COSMOS_CONNECTION_STRING`）が解決できているか。

```bash
az webapp config show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "{startupFile:appCommandLine,linuxFxVersion:linuxFxVersion}" \
  -o jsonc

az webapp config appsettings list \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT'].{name:name,value:value}" \
  -o table

az webapp config appsettings list \
  --subscription "$SUBSCRIPTION_ID" \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --query "[?name=='COSMOS_CONNECTION_STRING'].{name:name}" \
  -o table
```

### `Cannot find module '/home/site/wwwroot/src/app.js'` が出る場合

スタートアップコマンドが古い `node src/app.js` になっているか、ZIP デプロイが完了する前に再起動されています。次のコマンドで修正して再デプロイします。

```bash
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --startup-file "node dist/src/app.js"

./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```

※ `az webapp deploy` の実行中、`Warmed up Kudu instance successfully.` の表示のまま 1〜2 分ほど待つ場合がありますが、バックグラウンドで展開処理が進んでいます。

## Static Web Apps の `/api/health` が 404 になる

**主な原因:**
- フロントエンド（`staticwebapp.config.json` を含む）がまだ Static Web Apps にデプロイされていない。
- Static Web Apps が `Standard` SKU で作成されていない、または Linked Backend が設定されていない。

**確認コマンド:**

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

## サインイン後にリダイレクトエラー（`AADSTS50011`）が出る

フロントエンドのアプリ登録に Static Web Apps の URL が SPA リダイレクト URI として登録されているか確認します。

```bash
az ad app show \
  --id "$FRONTEND_CLIENT_ID" \
  --query "spa.redirectUris" -o jsonc
```

`https://<SWA_HOSTNAME>` が含まれていない場合は、次のコマンドで追加します。

```bash
(
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
)
```

## サインイン時に `AADSTS900144`（`client_id` 不足）が出る

**症状:**
`AADSTS900144: The request body must contain the following parameter: 'client_id'.`

**原因:**
Static Web Apps に配信されている `index.html` の `window.__APP_CONFIG__` に `ENTRA_FRONTEND_CLIENT_ID` が設定されていません。

**確認と対処:**

```bash
curl -fsS "https://${SWA_HOSTNAME}" \
  | grep -o 'window.__APP_CONFIG__=[^<]*'

printf 'Tenant: %s / Frontend: %s / Backend: %s\n' "$TENANT_ID" "$FRONTEND_CLIENT_ID" "$BACKEND_CLIENT_ID"
```

値が空または古い場合は、[Day 1: フロントエンドのデプロイ](day-1-deploy-frontend.ja.html) に従って `./scripts/deploy-frontend.sh "$RESOURCE_GROUP"` を再実行してください。

## フロントエンドまたはバックエンドのビルドが失敗する

フロントエンドの手動ビルド確認:

```bash
cd "$WORKSHOP_REPO_DIR/materials/frontend"
node --version
npm --version
npm ci
npm run build
```

バックエンドの再デプロイ確認:

```bash
cd "$WORKSHOP_REPO_DIR"
./scripts/deploy-backend.sh "$RESOURCE_GROUP" "$APP_SERVICE_NAME"
```
